import ExpoModulesCore
import Foundation

public class LiquidGlassWheelModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidGlassWheel")

    Constant("hasConfigurableKebabMenu") { true }
    Constant("isRunningOnMac") {
#if targetEnvironment(macCatalyst)
      true
#else
      ProcessInfo.processInfo.isiOSAppOnMac
#endif
    }

    View(LiquidGlassWheelView.self) {
      Prop("visible") { (view: LiquidGlassWheelView, visible: Bool) in
        view.setVisible(visible)
      }
    }

    View(NativeKebabMenuView.self) {
      Events("onAction")

      Prop("actions") { (view: NativeKebabMenuView, actions: [KebabMenuActionRecord]) in
        view.setActions(actions)
      }
      Prop("isDark") { (view: NativeKebabMenuView, isDark: Bool) in
        view.setDarkAppearance(isDark)
      }
    }

    View(MacPhotoDropView.self) {
      Events("onDropImages")

      Prop("enabled") { (view: MacPhotoDropView, enabled: Bool) in
        view.setEnabled(enabled)
      }
      Prop("targetKey") { (view: MacPhotoDropView, targetKey: String) in
        view.setTargetKey(targetKey)
      }
    }
  }
}
