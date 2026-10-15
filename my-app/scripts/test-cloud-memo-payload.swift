import CloudKit
import Foundation

@main
struct CloudMemoPayloadTests {
  static func main() throws {
    let note: [String: Any] = ["id": 1, "text": "memo", "timestamp": 10,
                               "state": "saved", "folderId": NSNull(), "changeID": "b",
                               "futureField": "preserve"]
    func json(_ value: Any) throws -> String {
      String(decoding: try JSONSerialization.data(withJSONObject: value), as: UTF8.self)
    }
    let snapshot = try CloudMemoPayload.snapshot(json(["notes": [note], "folders": []]))
    assert((snapshot["notes"] as? [[String: Any]])?.first?["futureField"] as? String == "preserve")
    func rejects(_ body: () throws -> Void) {
      do { try body(); assertionFailure("Invalid payload must throw") } catch { }
    }
    rejects { _ = try CloudMemoPayload.snapshot("{\"notes\":null,\"folders\":[]}") }
    var invalid = note
    invalid["timestamp"] = "bad"
    rejects { _ = try CloudMemoPayload.snapshot(json(["notes": [invalid], "folders": []])) }
    invalid = note
    invalid["photos"] = [["fileName": "../outside", "width": 1, "height": 1]]
    rejects { _ = try CloudMemoPayload.snapshot(json(["notes": [invalid], "folders": []])) }
    let record = CKRecord(recordType: "SwishMemoNote", recordID: CKRecord.ID(recordName: "note_test"))
    record["payload"] = try json(note) as CKRecordValue
    rejects { _ = try CloudMemoRecordIndex([record]) }
    record["modifiedAt"] = Date(timeIntervalSince1970: 10)
    let index = try CloudMemoRecordIndex([record])
    assert(index.preferredRemoteValue("note_test", localDate: Date(timeIntervalSince1970: 9), changeID: "z") != nil)
    assert(index.preferredRemoteValue("note_test", localDate: Date(timeIntervalSince1970: 11), changeID: "a") == nil)
    assert(index.preferredRemoteValue("note_test", localDate: Date(timeIntervalSince1970: 10), changeID: "a") != nil)
    assert(index.preferredRemoteValue("note_test", localDate: Date(timeIntervalSince1970: 10), changeID: "c") == nil)
    record["payload"] = "{}"
    rejects { _ = try CloudMemoRecordIndex([record]) }
    print("Cloud payload: legacy snapshots, unknown fields, invalid records, photos and revision ordering passed")
  }
}
