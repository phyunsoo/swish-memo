import ExpoModulesCore

public class LiquidGlassWheelModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidGlassWheel")

    Constant("hasNativeKebabMenu") { true }
    Constant("hasNativeKebabSearch") { true }

    View(LiquidGlassWheelView.self) {
      Prop("visible") { (view: LiquidGlassWheelView, visible: Bool) in
        view.setVisible(visible)
      }
    }

    View(NativeKebabMenuView.self) {
      Events("onSearch", "onDelete", "onSettings", "onEmptyTrash", "onRenameFolder", "onDeleteFolder")

      Prop("isDark") { (view: NativeKebabMenuView, isDark: Bool) in
        view.setDarkAppearance(isDark)
      }

      Prop("showsDeleteAction") { (view: NativeKebabMenuView, showsDeleteAction: Bool) in
        view.setShowsDeleteAction(showsDeleteAction)
      }

      Prop("showsEmptyTrashAction") { (view: NativeKebabMenuView, showsEmptyTrashAction: Bool) in
        view.setShowsEmptyTrashAction(showsEmptyTrashAction)
      }

      Prop("showsFolderActions") { (view: NativeKebabMenuView, showsFolderActions: Bool) in
        view.setShowsFolderActions(showsFolderActions)
      }

      Prop("folderName") { (view: NativeKebabMenuView, folderName: String) in
        view.setFolderName(folderName)
      }
    }
  }
}
