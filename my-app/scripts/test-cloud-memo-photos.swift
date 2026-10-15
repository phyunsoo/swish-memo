import CloudKit
import Foundation

@main
struct CloudMemoPhotoTests {
  static func main() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let source = root.appendingPathComponent("source")
    let destination = root.appendingPathComponent("destination")
    try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = CloudMemoPhotoStore(directory: source)
    let record = CKRecord(recordType: "SwishMemoNote")
    let photos: [[String: Any]] = [
      ["fileName": "first.jpg", "width": 100, "height": 200],
      ["fileName": "second.jpg", "width": 200, "height": 100],
    ]
    try Data("first bytes".utf8).write(to: source.appendingPathComponent("first.jpg"))
    try Data("second bytes".utf8).write(to: source.appendingPathComponent("second.jpg"))
    let note: [String: Any] = ["photos": photos]
    try store.attach(from: note, to: record)
    assert((record["photoAssets"] as? [CKAsset])?.count == 2)
    assert(!record.allKeys().contains(where: { $0.hasPrefix("photo_") }))
    record["payload"] = String(decoding: try JSONSerialization.data(withJSONObject: note), as: UTF8.self)
    let reader = CloudMemoPhotoStore(directory: destination)
    _ = try reader.restore(in: note, from: record)
    let restored = try String(contentsOf: destination.appendingPathComponent("first.jpg"), encoding: .utf8)
    assert(restored == "first bytes")
    // Existing immutable assets remain reusable when a local file is absent.
    try FileManager.default.removeItem(at: source.appendingPathComponent("second.jpg"))
    try store.attach(from: ["photos": photos.reversed().map { $0 }], to: record)
    assert((record["photoAssets"] as? [CKAsset])?.first?.fileURL?.lastPathComponent == "second.jpg")
    record["payload"] = String(decoding: try JSONSerialization.data(withJSONObject: ["photos": photos.reversed().map { $0 }]), as: UTF8.self)
    try store.attach(from: ["photos": [photos[0]]], to: record)
    assert((record["photoAssets"] as? [CKAsset])?.count == 1)
    assert((record["photoAssets"] as? [CKAsset])?.first?.fileURL?.lastPathComponent == "first.jpg")
    try store.attach(from: ["photos": []], to: record)
    assert(record["photoAssets"] == nil)
    do {
      try store.attach(from: ["photos": [["fileName": "missing.jpg"]]], to: CKRecord(recordType: "SwishMemoNote"))
      assertionFailure("Missing attachments must fail rather than upload incomplete data")
    } catch { assert((error as NSError).code == 1) }
    do {
      _ = try reader.restore(in: ["photos": [["fileName": "../outside.jpg"]]], from: record)
      assertionFailure("Photo paths must stay inside the photo directory")
    } catch { assert((error as NSError).code == 2) }
    print("Cloud memo photos: fixed schema, download, reorder, remove, retained assets and missing-file errors passed")
  }
}
