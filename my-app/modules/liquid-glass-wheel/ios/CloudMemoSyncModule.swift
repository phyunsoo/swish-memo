import ExpoModulesCore

public final class CloudMemoSyncModule: Module {
  private let engine = CloudMemoSyncEngine()

  public func definition() -> ModuleDefinition {
    Name("CloudMemoSync")

    AsyncFunction("getStatus") { () async -> [String: String] in
      await self.engine.getStatus()
    }

    AsyncFunction("syncSnapshot") { (json: String) async throws -> String in
      try await self.engine.syncSnapshot(json)
    }
  }
}
