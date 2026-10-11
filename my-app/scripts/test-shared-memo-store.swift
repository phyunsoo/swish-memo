import Foundation

@main
struct SharedMemoStoreTests {
  static func main() throws {
    func check(_ value: Bool, _ message: String = "") { assert(value, message) }
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = try SharedMemoStore(url: directory.appendingPathComponent("test.db"))
    let original = """
    {"folders":[{"id":"todo"}],"draftText":"아직 작성 중","notes":[
      {"id":1,"text":"할 일","timestamp":10,"sortOrder":1,"folderId":"todo","state":"saved"},
      {"id":2,"text":"다른 메모","timestamp":20,"folderId":null,"state":"draft"}
    ]}
    """
    _ = try store.initialize(original)
    _ = try store.initialize("{\"notes\":[]}")
    func snapshot() throws -> [String: Any] {
      try JSONSerialization.jsonObject(with: Data(store.load()!.utf8)) as! [String: Any]
    }
    func notes() throws -> [[String: Any]] { try snapshot()["notes"] as! [[String: Any]] }
    check(try notes().count == 2, "Migration must be idempotent")
    check(try store.complete(id: 1, generation: "legacy", now: 1000))
    check(try notes()[0]["state"] as? String == "trash")
    check(try notes()[0]["deletedAt"] as? Double == 1000)
    check(try snapshot()["draftText"] as? String == "아직 작성 중")
    check(try !store.complete(id: 1, generation: "legacy", now: 2000), "Repeated taps must be idempotent")
    // Simulate a stale React save arriving after the extension's completion.
    _ = try store.save(original, now: 2000)
    check(try notes()[0]["state"] as? String == "trash", "A stale app save must not resurrect a completed todo")
    var restored = try snapshot()
    var restoredNotes = try notes()
    restoredNotes[0]["state"] = "saved"
    restoredNotes[0]["todoGeneration"] = "restored"
    restoredNotes[0].removeValue(forKey: "deletedAt")
    restored["notes"] = restoredNotes
    let json = String(decoding: try JSONSerialization.data(withJSONObject: restored), as: UTF8.self)
    _ = try store.save(json, now: 3000)
    check(try notes()[0]["state"] as? String == "saved", "Restoring starts a new incomplete todo generation")
    check(try !store.complete(id: 1, generation: "legacy", now: 4000), "An old widget cannot complete a restored todo")
    check(try store.complete(id: 1, generation: "restored", now: 5000))
    // A second connection models app/extension process isolation.
    let other = try SharedMemoStore(url: directory.appendingPathComponent("test.db"))
    check(try other.load() == store.load())
    _ = try store.save(store.load()!, now: 5000 + 30 * 24 * 60 * 60 * 1000)
    check(try notes().count == 1, "Trash expires after 30 days")
    let orderedStore = try SharedMemoStore(url: directory.appendingPathComponent("ordered.db"))
    let orderedJSON = """
    {"notes":[
      {"id":1,"text":"완료할 일","timestamp":10,"sortOrder":0,"folderId":"todo","state":"saved"},
      {"id":2,"text":"휴지통 기존 메모","timestamp":20,"sortOrder":12,"folderId":null,"state":"trash"}
    ]}
    """
    _ = try orderedStore.initialize(orderedJSON)
    check(try orderedStore.complete(id: 1, generation: "legacy", now: 1000))
    _ = try orderedStore.save(orderedJSON, now: 2000)
    let orderedResult = try JSONSerialization.jsonObject(with: Data(orderedStore.load()!.utf8)) as! [String: Any]
    let orderedNotes = orderedResult["notes"] as! [[String: Any]]
    check(orderedNotes[0]["sortOrder"] as? Double == 13, "Widget completion appends to trash like app completion")
    let concurrentURL = directory.appendingPathComponent("concurrent.db")
    let concurrentStore = try SharedMemoStore(url: concurrentURL)
    let concurrentNotes = (1...12).map { id -> [String: Any] in
      ["id": id, "text": "할 일 \(id)", "timestamp": id, "folderId": "todo", "state": "saved"]
    }
    let concurrentJSON = String(decoding: try JSONSerialization.data(withJSONObject: ["notes": concurrentNotes]), as: UTF8.self)
    _ = try concurrentStore.initialize(concurrentJSON)
    DispatchQueue.concurrentPerform(iterations: 12) { index in
      do {
        let connection = try SharedMemoStore(url: concurrentURL)
        let completed = try connection.complete(id: Int64(index + 1), generation: "legacy")
        assert(completed)
      } catch { fatalError("Concurrent completion failed: \(error)") }
    }
    let concurrentResult = try JSONSerialization.jsonObject(with: Data(concurrentStore.load()!.utf8)) as! [String: Any]
    let completed = concurrentResult["notes"] as! [[String: Any]]
    let ranks = completed.compactMap { $0["sortOrder"] as? Double }
    check(Set(ranks).count == 12, "Concurrent completions receive distinct appended trash positions")
    check(completed.allSatisfy { $0["state"] as? String == "trash" }, "Concurrent taps must not lose another completion")
    print("SharedMemoStore: migration, completion, stale saves, restore, process sharing and 30-day expiry passed")
  }
}
