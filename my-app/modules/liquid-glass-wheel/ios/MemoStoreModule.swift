import ExpoModulesCore
import WidgetKit

public class MemoStoreModule: Module {
  private let memoQueue = DispatchQueue(label: "swish.memo.storage")
  public func definition() -> ModuleDefinition {
    Name("MemoStore")

    Constant("hasSharedMemoStore") { true }
    Function("memoCharacterCount") { (text: String) -> Int in text.count }
    AsyncFunction("initializeMemoStore") { (legacyJSON: String) -> String in
      let result = try SharedMemoStore.shared().initialize(legacyJSON)
      WidgetCenter.shared.reloadTimelines(ofKind: "SwishTodoWidget")
      return result
    }.runOnQueue(memoQueue)
    AsyncFunction("loadMemoSnapshot") { () -> String? in
      let result = try SharedMemoStore.shared().load()
      WidgetCenter.shared.reloadTimelines(ofKind: "SwishTodoWidget")
      return result
    }.runOnQueue(memoQueue)
    AsyncFunction("saveMemoSnapshot") { (json: String) -> String in
      let store = try SharedMemoStore.shared()
      let previous = try store.load()
      let result = try store.save(json)
      if self.todoSignature(previous) != self.todoSignature(result) {
        WidgetCenter.shared.reloadTimelines(ofKind: "SwishTodoWidget")
      }
      return result
    }.runOnQueue(memoQueue)
  }

  private func todoSignature(_ json: String?) -> Data? {
    guard let json, let snapshot = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else { return nil }
    let notes = (snapshot["notes"] as? [[String: Any]] ?? []).filter {
      $0["state"] as? String == "saved" && $0["folderId"] as? String == "todo"
    }
    let folder = (snapshot["folders"] as? [[String: Any]] ?? []).first { $0["id"] as? String == "todo" } ?? [:]
    return try? JSONSerialization.data(withJSONObject: ["notes": notes, "folder": folder], options: [.sortedKeys])
  }
}
