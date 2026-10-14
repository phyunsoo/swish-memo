import ExpoModulesCore

public class LiquidGlassWheelModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidGlassWheel")

    Constant("hasConfigurableKebabMenu") { true }

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
  }
}
