import CloudKit
import Foundation

// A fixed asset-list field works with a deployed CloudKit schema at any photo
// count. The JSON payload keeps the matching file names, sizes and ordering.
struct CloudMemoPhotoStore {
  private let directory: URL

  init(directory: URL? = nil) {
    self.directory = directory ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("memo-photos", isDirectory: true)
  }

  func attach(from note: [String: Any], to record: CKRecord) throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let photos = note["photos"] as? [[String: Any]] ?? []
    let oldPhotos = (record["payload"] as? String).flatMap { $0.data(using: .utf8) }
      .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }?["photos"] as? [[String: Any]] ?? []
    let oldAssets = record["photoAssets"] as? [CKAsset] ?? []
    var assetsByName: [String: CKAsset] = [:]
    for (index, photo) in oldPhotos.enumerated() where index < oldAssets.count {
      if let name = photo["fileName"] as? String { assetsByName[name] = oldAssets[index] }
    }
    let assets = try photos.map { photo -> CKAsset in
      let url = try fileURL(for: photo)
      if let asset = assetsByName[url.lastPathComponent] { return asset }
      guard FileManager.default.fileExists(atPath: url.path) else { throw missingPhoto(url.lastPathComponent) }
      return CKAsset(fileURL: url)
    }
    let names = photos.compactMap { $0["fileName"] as? String }
    let oldNames = oldPhotos.compactMap { $0["fileName"] as? String }
    if names != oldNames || assets.count != oldAssets.count {
      record["photoAssets"] = assets.isEmpty ? nil : assets as CKRecordValue
    }
  }

  func restore(in note: [String: Any], from record: CKRecord) throws -> [String: Any] {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let photos = note["photos"] as? [[String: Any]] ?? []
    let assets = record["photoAssets"] as? [CKAsset] ?? []
    for (index, photo) in photos.enumerated() {
      let destination = try fileURL(for: photo)
      if FileManager.default.fileExists(atPath: destination.path) { continue }
      guard index < assets.count, let source = assets[index].fileURL else {
        throw missingPhoto(destination.lastPathComponent)
      }
      try FileManager.default.copyItem(at: source, to: destination)
    }
    return note
  }

  private func fileURL(for photo: [String: Any]) throws -> URL {
    guard let name = photo["fileName"] as? String, !name.isEmpty,
          name != ".", name != "..", name == (name as NSString).lastPathComponent else {
      throw NSError(domain: "SwishMemoSync", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Invalid photo filename"])
    }
    return directory.appendingPathComponent(name)
  }

  private func missingPhoto(_ name: String) -> NSError {
    NSError(domain: "SwishMemoSync", code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Photo file is unavailable: \(name)"])
  }
}
