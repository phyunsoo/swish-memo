import CloudKit
import Foundation

// Decode required fields before touching local files or sending cloud writes.
// Keep the original dictionary so newer, unknown fields survive round trips.
enum CloudMemoPayload {
  private struct Photo: Decodable {
    let fileName: String
    let width: Double
    let height: Double
  }
  private enum NoteState: String, Decodable { case draft, saved, trash }
  private enum FolderKind: String, Decodable { case todo, custom }
  private enum Entity: String, Decodable { case note, folder }
  private struct Note: Decodable {
    let id: Double
    let text: String
    let timestamp: Double
    let state: NoteState
    let folderId: String?
    let photos: [Photo]?
    let syncID: String?
    let modifiedAt: Double?
    let changeID: String?
    let deletedAt: Double?
    let sortOrder: Double?
    let todoGeneration: String?
  }
  private struct Folder: Decodable {
    let id: String
    let name: String
    let kind: FolderKind
    let createdAt: Double
    let modifiedAt: Double?
    let changeID: String?
  }
  private struct Tombstone: Decodable {
    let key: String
    let entity: Entity
    let modifiedAt: Double
  }
  private struct Snapshot: Decodable {
    let notes: [Note]
    let folders: [Folder]
    let syncTombstones: [Tombstone]?
  }

  static func snapshot(_ json: String) throws -> [String: Any] {
    let data = Data(json.utf8)
    let snapshot = try JSONDecoder().decode(Snapshot.self, from: data)
    for note in snapshot.notes { try validatePhotos(note.photos) }
    return try dictionary(data)
  }

  static func record(_ record: CKRecord) throws -> [String: Any] {
    guard let json = record["payload"] as? String, record["modifiedAt"] is Date else {
      throw invalid("\(record.recordID.recordName): payload/modifiedAt")
    }
    let data = Data(json.utf8)
    do {
      switch record.recordType {
      case "SwishMemoNote":
        let note = try JSONDecoder().decode(Note.self, from: data)
        try validatePhotos(note.photos)
      case "SwishMemoFolder": _ = try JSONDecoder().decode(Folder.self, from: data)
      case "SwishMemoTombstone": _ = try JSONDecoder().decode(Tombstone.self, from: data)
      default: throw invalid(record.recordType)
      }
      return try dictionary(data)
    } catch {
      throw invalid("\(record.recordID.recordName): \(error)")
    }
  }

  private static func dictionary(_ data: Data) throws -> [String: Any] {
    guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw invalid("expected object")
    }
    return value
  }

  private static func validatePhotos(_ photos: [Photo]?) throws {
    for photo in photos ?? [] {
      let name = photo.fileName
      guard !name.isEmpty, name != ".", name != "..", name == (name as NSString).lastPathComponent else {
        throw invalid("photo filename")
      }
    }
  }

  private static func invalid(_ field: String) -> NSError {
    NSError(domain: "SwishMemoSync", code: 3,
            userInfo: [NSLocalizedDescriptionKey: "Invalid memo data: \(field)"])
  }
}

// Validate every downloaded record once, then use constant-time ID lookups.
struct CloudMemoRecordIndex {
  let records: [String: CKRecord]
  let values: [String: [String: Any]]

  init(_ records: [CKRecord]) throws {
    var indexed: [String: CKRecord] = [:]
    var values: [String: [String: Any]] = [:]
    for record in records {
      let id = record.recordID.recordName
      indexed[id] = record
      values[id] = try CloudMemoPayload.record(record)
    }
    self.records = indexed
    self.values = values
  }

  // Same last-modified and edit-token ordering as memo-sync.ts.
  func preferredRemoteValue(_ id: String, localDate: Date, changeID: String) -> [String: Any]? {
    guard let remoteDate = records[id]?["modifiedAt"] as? Date, let value = values[id] else { return nil }
    return remoteDate > localDate || (remoteDate == localDate && (value["changeID"] as? String ?? "") >= changeID)
      ? value : nil
  }
}
