import ExpoModulesCore

public class LiquidGlassWheelModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidGlassWheel")

    Constant("hasNativeKebabMenu") { true }

    View(LiquidGlassWheelView.self) {
      Prop("visible") { (view: LiquidGlassWheelView, visible: Bool) in
        view.setVisible(visible)
      }
    }

    View(NativeKebabMenuView.self) {
      Events("onDelete", "onSettings")

      Prop("isDark") { (view: NativeKebabMenuView, isDark: Bool) in
        view.setDarkAppearance(isDark)
      }

      Prop("showsDeleteAction") { (view: NativeKebabMenuView, showsDeleteAction: Bool) in
        view.setShowsDeleteAction(showsDeleteAction)
      }
    }
  }
}
