import Foundation
import SQLite3

// Compiled into both the app module and WidgetKit extension. Every write holds
// an SQLite transaction, including completion-vs-app-save conflict resolution.
final class SharedMemoStore {
  private var db: OpaquePointer?
  private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

  static func shared() throws -> SharedMemoStore {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "SwishMemoAppGroup") as? String,
          let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw NSError(domain: "SwishMemo", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "공유 메모 저장소에 접근할 수 없습니다. App Group 서명을 확인하세요."])
    }
    return try SharedMemoStore(url: container.appendingPathComponent("swish-memo.db"))
  }

  init(url: URL) throws {
    guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
      throw NSError(domain: "SwishMemo", code: 2)
    }
    sqlite3_busy_timeout(db, 5000)
    try execute("PRAGMA journal_mode=WAL")
    try execute("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, value TEXT NOT NULL)")
    try execute("CREATE TABLE IF NOT EXISTS todo_completions (id INTEGER NOT NULL, generation TEXT NOT NULL, deleted_at REAL NOT NULL, PRIMARY KEY(id, generation))")
    try execute("BEGIN IMMEDIATE")
    do {
      // Existing widget installations predate the completion order column.
      let columns = try statement("PRAGMA table_info(todo_completions)")
      defer { sqlite3_finalize(columns) }
      var hasOrder = false
      while sqlite3_step(columns) == SQLITE_ROW {
        if let name = sqlite3_column_text(columns, 1), String(cString: name) == "sort_order" { hasOrder = true }
      }
      if !hasOrder { try execute("ALTER TABLE todo_completions ADD COLUMN sort_order REAL") }
      try execute("COMMIT")
    } catch { try? execute("ROLLBACK"); throw error }
  }

  deinit { sqlite3_close(db) }

  private func error() -> NSError {
    NSError(domain: "SwishMemo.SQLite", code: Int(sqlite3_errcode(db)),
            userInfo: [NSLocalizedDescriptionKey: String(cString: sqlite3_errmsg(db))])
  }

  private func execute(_ sql: String) throws {
    guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw error() }
  }

  private func statement(_ sql: String) throws -> OpaquePointer {
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK, let stmt else { throw error() }
    return stmt
  }

  func load() throws -> String? {
    let stmt = try statement("SELECT value FROM app_state WHERE id = 1")
    defer { sqlite3_finalize(stmt) }
    let result = sqlite3_step(stmt)
    if result == SQLITE_DONE { return nil }
    guard result == SQLITE_ROW, let value = sqlite3_column_text(stmt, 0) else { throw error() }
    return String(cString: value)
  }

  private func write(_ snapshot: [String: Any]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys])
    let json = String(decoding: data, as: UTF8.self)
    let stmt = try statement("INSERT INTO app_state (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value")
    defer { sqlite3_finalize(stmt) }
    sqlite3_bind_text(stmt, 1, json, -1, transient)
    guard sqlite3_step(stmt) == SQLITE_DONE else { throw error() }
    return json
  }

  private func parse(_ json: String) throws -> [String: Any] {
    guard let snapshot = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else {
      throw NSError(domain: "SwishMemo", code: 3)
    }
    return snapshot
  }

  // Only used once. A retry never overwrites an already migrated shared store.
  func initialize(_ legacyJSON: String) throws -> String {
    try execute("BEGIN IMMEDIATE")
    do {
      let result: String
      if let existing = try load() { result = existing }
      else { result = try write(parse(legacyJSON)) }
      try execute("COMMIT")
      return result
    } catch { try? execute("ROLLBACK"); throw error }
  }

  func save(_ json: String, now: Double = Date().timeIntervalSince1970 * 1000) throws -> String {
    try execute("BEGIN IMMEDIATE")
    do {
      var snapshot = try parse(json)
      var notes = snapshot["notes"] as? [[String: Any]] ?? []
      let stmt = try statement("SELECT deleted_at, sort_order FROM todo_completions WHERE id = ? AND generation = ?")
      defer { sqlite3_finalize(stmt) }
      for index in notes.indices where notes[index]["state"] as? String == "saved" && notes[index]["folderId"] as? String == "todo" {
        sqlite3_reset(stmt)
        sqlite3_bind_int64(stmt, 1, (notes[index]["id"] as? NSNumber)?.int64Value ?? -1)
        sqlite3_bind_text(stmt, 2, notes[index]["todoGeneration"] as? String ?? "legacy", -1, transient)
        let status = sqlite3_step(stmt)
        if status == SQLITE_ROW {
          notes[index]["state"] = "trash"
          notes[index]["deletedAt"] = sqlite3_column_double(stmt, 0)
          if sqlite3_column_type(stmt, 1) != SQLITE_NULL {
            notes[index]["sortOrder"] = sqlite3_column_double(stmt, 1)
          }
        } else if status != SQLITE_DONE { throw error() }
      }
      snapshot["notes"] = notes.filter { note in
        guard note["state"] as? String == "trash", let deletedAt = note["deletedAt"] as? Double else { return true }
        return now - deletedAt < 30 * 24 * 60 * 60 * 1000
      }
      let result = try write(snapshot)
      try execute("COMMIT")
      return result
    } catch { try? execute("ROLLBACK"); throw error }
  }

  @discardableResult
  func complete(id: Int64, generation: String, now: Double = Date().timeIntervalSince1970 * 1000) throws -> Bool {
    try execute("BEGIN IMMEDIATE")
    do {
      guard let json = try load() else { try execute("COMMIT"); return false }
      var snapshot = try parse(json)
      var notes = snapshot["notes"] as? [[String: Any]] ?? []
      guard let index = notes.firstIndex(where: {
        ($0["id"] as? NSNumber)?.int64Value == id && $0["state"] as? String == "saved"
          && $0["folderId"] as? String == "todo" && ($0["todoGeneration"] as? String ?? "legacy") == generation
      }) else { try execute("COMMIT"); return false }
      // Match moveNotesToDestination: append a completed todo to the trash.
      let order = notes.filter { $0["state"] as? String == "trash" }.reduce(-1.0) {
        max($0, ($1["sortOrder"] as? Double) ?? ($1["timestamp"] as? Double) ?? 0)
      } + 1
      let stmt = try statement("INSERT OR IGNORE INTO todo_completions (id, generation, deleted_at, sort_order) VALUES (?, ?, ?, ?)")
      defer { sqlite3_finalize(stmt) }
      sqlite3_bind_int64(stmt, 1, id)
      sqlite3_bind_text(stmt, 2, generation, -1, transient)
      sqlite3_bind_double(stmt, 3, now)
      sqlite3_bind_double(stmt, 4, order)
      guard sqlite3_step(stmt) == SQLITE_DONE else { throw error() }
      notes[index]["state"] = "trash"
      notes[index]["deletedAt"] = now
      notes[index]["sortOrder"] = order
      snapshot["notes"] = notes
      _ = try write(snapshot)
      try execute("COMMIT")
      return true
    } catch { try? execute("ROLLBACK"); throw error }
  }
}
