import CloudKit
import Foundation

// Cloud transport stays independent of Expo and the local SQLite store.
actor CloudMemoSyncEngine {
  #if targetEnvironment(simulator)
  private let container: CKContainer? = nil
  #else
  private let container: CKContainer? = CKContainer(identifier: "iCloud.com.phyunsoo.swishmemo")
  #endif
  private let photoStore = CloudMemoPhotoStore()
  private var lastSyncStatus = "notStarted"
  private let notesType = "SwishMemoNote"
  private let foldersType = "SwishMemoFolder"
  private let tombstonesType = "SwishMemoTombstone"

  func getStatus() async -> [String: String] {
    guard let container else {
      return ["status": "unavailable", "syncStatus": lastSyncStatus]
    }

    do {
      let status: String
      switch try await container.accountStatus() {
      case .available: status = "available"
      case .noAccount: status = "noAccount"
      case .restricted: status = "restricted"
      case .couldNotDetermine: status = "unknown"
      case .temporarilyUnavailable: status = "temporarilyUnavailable"
      @unknown default: status = "unknown"
      }
      return ["status": status, "syncStatus": lastSyncStatus]
    } catch {
      return ["status": "error", "syncStatus": lastSyncStatus, "message": error.localizedDescription]
    }
  }

  func syncSnapshot(_ json: String) async throws -> String {
    guard container != nil else {
      throw NSError(
        domain: "CloudMemoSync",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "iCloud sync is unavailable in the iOS Simulator."]
      )
    }

    do {
      let result = try await sync(json)
      lastSyncStatus = "synced"
      return result
    } catch {
      lastSyncStatus = "error"
      throw error
    }
  }

  private func fetchAll(type: String, database: CKDatabase) async throws -> [CKRecord] {
    let query = CKQuery(recordType: type, predicate: NSPredicate(value: true))
    var result = try await database.records(matching: query, resultsLimit: CKQueryOperation.maximumResults)
    var records = try result.matchResults.map { try $0.1.get() }
    while let cursor = result.queryCursor {
      result = try await database.records(continuingMatchFrom: cursor,
                                          resultsLimit: CKQueryOperation.maximumResults)
      records.append(contentsOf: try result.matchResults.map { try $0.1.get() })
    }
    return records
  }

  private func sync(_ json: String) async throws -> String {
    guard let container else {
      throw NSError(
        domain: "CloudMemoSync",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "iCloud sync is unavailable in the iOS Simulator."]
      )
    }

    let database = container.privateCloudDatabase
    let local = try CloudMemoPayload.snapshot(json)
    var notes = local["notes"] as? [[String: Any]] ?? []
    var folders = local["folders"] as? [[String: Any]] ?? []
    var tombstones = local["syncTombstones"] as? [[String: Any]] ?? []
    let remoteNotes = try CloudMemoRecordIndex(await fetchAll(type: notesType, database: database))
    let remoteFolders = try CloudMemoRecordIndex(await fetchAll(type: foldersType, database: database))
    let remoteTombstones = try CloudMemoRecordIndex(await fetchAll(type: tombstonesType, database: database))
    var tombstoneMap = Dictionary(uniqueKeysWithValues: tombstones.compactMap { item -> (String, [String: Any])? in
      guard let key = item["key"] as? String, let entity = item["entity"] as? String else { return nil }
      return ("\(entity):\(key)", item)
    })
    for value in remoteTombstones.values.values {
      guard let key = value["key"] as? String, let entity = value["entity"] as? String else { continue }
      let mapKey = "\(entity):\(key)"
      if let current = tombstoneMap[mapKey],
         let currentDate = current["modifiedAt"] as? Double,
         let remoteDate = value["modifiedAt"] as? Double, currentDate >= remoteDate { continue }
      tombstoneMap[mapKey] = value
    }
    tombstones = Array(tombstoneMap.values)
    func isDeleted(_ entity: String, _ key: String, _ modifiedAt: Double) -> Bool {
      guard let tombstone = tombstoneMap["\(entity):\(key)"],
            let deletedAt = (tombstone["modifiedAt"] as? NSNumber)?.doubleValue else { return false }
      return deletedAt >= modifiedAt
    }
    let localDraftIDs = Set(notes.compactMap { note -> String? in
      guard note["state"] as? String == "draft" else { return nil }
      let legacyID = (note["id"] as? NSNumber)?.stringValue ?? ""
      return note["syncID"] as? String ?? "legacy-\(legacyID)"
    })
    var remoteNoteByID = remoteNotes.records
    var remoteFolderByID = remoteFolders.records
    var saves: [CKRecord] = []
    var deletes: [CKRecord.ID] = []

    for index in notes.indices where notes[index]["state"] as? String != "draft" {
      let legacyID = (notes[index]["id"] as? NSNumber)?.stringValue ?? ""
      let id = notes[index]["syncID"] as? String ?? "legacy-\(legacyID)"
      notes[index]["syncID"] = id
      let recordID = "note_\(id)"
      let noteMillis = (notes[index]["modifiedAt"] as? NSNumber)?.doubleValue
        ?? (notes[index]["timestamp"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000
      if isDeleted("note", id, noteMillis) { continue }
      let localDate = Date(timeIntervalSince1970: noteMillis / 1000)
      if let remote = remoteNoteByID.removeValue(forKey: recordID),
         let value = remoteNotes.preferredRemoteValue(recordID, localDate: localDate,
                                                     changeID: notes[index]["changeID"] as? String ?? "") {
        notes[index] = try photoStore.restore(in: value, from: remote)
      } else {
        let record = remoteNotes.records[recordID]
          ?? CKRecord(recordType: notesType, recordID: CKRecord.ID(recordName: recordID))
        try photoStore.attach(from: notes[index], to: record)
        try updateRecord(record, value: notes[index], modifiedAt: localDate)
        saves.append(record)
      }
    }

    // A device may have been offline when a note was created elsewhere.
    for (recordID, remote) in remoteNoteByID {
      guard let value = remoteNotes.values[recordID] else { continue }
      let id = value["syncID"] as? String ?? String(recordID.dropFirst("note_".count))
      let millis = (value["modifiedAt"] as? NSNumber)?.doubleValue
        ?? (value["timestamp"] as? NSNumber)?.doubleValue ?? 0
      if !isDeleted("note", id, millis) && !localDraftIDs.contains(id)
          && value["state"] as? String != "draft" {
        notes.append(try photoStore.restore(in: value, from: remote))
      }
    }

    for index in folders.indices {
      guard let id = folders[index]["id"] as? String else { continue }
      let recordID = "folder_\(id)"
      let folderMillis = (folders[index]["modifiedAt"] as? NSNumber)?.doubleValue
        ?? (folders[index]["createdAt"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000
      if isDeleted("folder", id, folderMillis) { continue }
      let localDate = Date(timeIntervalSince1970: folderMillis / 1000)
      if remoteFolderByID.removeValue(forKey: recordID) != nil,
         let value = remoteFolders.preferredRemoteValue(recordID, localDate: localDate,
                                                     changeID: folders[index]["changeID"] as? String ?? "") {
        folders[index] = value
      } else {
        let record = remoteFolders.records[recordID]
          ?? CKRecord(recordType: foldersType, recordID: CKRecord.ID(recordName: recordID))
        try updateRecord(record, value: folders[index], modifiedAt: localDate)
        saves.append(record)
      }
    }
    for recordID in remoteFolderByID.keys {
      if let value = remoteFolders.values[recordID] {
        let millis = (value["modifiedAt"] as? NSNumber)?.doubleValue
          ?? (value["createdAt"] as? NSNumber)?.doubleValue ?? 0
        if let id = value["id"] as? String, !isDeleted("folder", id, millis) { folders.append(value) }
      }
    }

    let savingIDs = Set(saves.map { $0.recordID.recordName })
    for tombstone in tombstones {
      guard let key = tombstone["key"] as? String, let entity = tombstone["entity"] as? String else { continue }
      let recordID = "tombstone_\(entity)_\(key)"
      let existing = remoteTombstones.records[recordID]
      let record = existing ?? CKRecord(recordType: tombstonesType, recordID: CKRecord.ID(recordName: recordID))
      let previousPayload = record["payload"] as? String
      record["payload"] = try jsonString(tombstone) as CKRecordValue
      if let milliseconds = tombstone["modifiedAt"] as? Double {
        record["modifiedAt"] = Date(timeIntervalSince1970: milliseconds / 1000)
      }
      if existing == nil || previousPayload != record["payload"] as? String { saves.append(record) }
      let sourceRecordID = entity == "note" ? "note_\(key)" : "folder_\(key)"
      let source = entity == "note"
        ? remoteNotes.records[sourceRecordID]
        : remoteFolders.records[sourceRecordID]
      if let source,
         !savingIDs.contains(sourceRecordID),
         isDeleted(entity, key, ((source["modifiedAt"] as? Date)?.timeIntervalSince1970 ?? 0) * 1000) {
        deletes.append(source.recordID)
      }
    }

    // CloudKit's operation limit applies to saves and deletes together.
    for start in stride(from: 0, to: saves.count, by: 200) {
      let batch = Array(saves[start..<min(start + 200, saves.count)])
      let result = try await database.modifyRecords(saving: batch, deleting: [],
                                                    savePolicy: .ifServerRecordUnchanged, atomically: false)
      for outcome in result.saveResults.values { _ = try outcome.get() }
    }
    for start in stride(from: 0, to: deletes.count, by: 200) {
      let batch = Array(deletes[start..<min(start + 200, deletes.count)])
      let result = try await database.modifyRecords(saving: [], deleting: batch,
                                                    savePolicy: .ifServerRecordUnchanged, atomically: false)
      for outcome in result.deleteResults.values { try outcome.get() }
    }
    var merged = local
    merged["notes"] = notes.filter { note in
      guard let id = note["syncID"] as? String else { return true }
      return !isDeleted("note", id, (note["modifiedAt"] as? NSNumber)?.doubleValue
        ?? (note["timestamp"] as? NSNumber)?.doubleValue ?? 0)
    }
    merged["folders"] = folders.filter { folder in
      guard let id = folder["id"] as? String else { return true }
      return !isDeleted("folder", id, (folder["modifiedAt"] as? NSNumber)?.doubleValue
        ?? (folder["createdAt"] as? NSNumber)?.doubleValue ?? 0)
    }
    merged["syncTombstones"] = tombstones
    return try jsonString(merged)
  }

  private func updateRecord(_ record: CKRecord, value: [String: Any], modifiedAt: Date) throws {
    record["payload"] = try jsonString(value) as CKRecordValue
    record["modifiedAt"] = modifiedAt
  }

  private func jsonString(_ value: Any) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    return String(decoding: data, as: UTF8.self)
  }

}
