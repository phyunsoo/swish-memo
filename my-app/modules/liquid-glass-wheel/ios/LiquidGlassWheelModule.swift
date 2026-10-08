import ExpoModulesCore

public class LiquidGlassWheelModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidGlassWheel")

    View(LiquidGlassWheelView.self) {
      Prop("visible") { (view: LiquidGlassWheelView, visible: Bool) in
        view.setVisible(visible)
      }
    }
  }
}
