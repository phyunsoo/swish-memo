import ExpoModulesCore
import SwiftUI

// Reverse the inner winding so the filled path has a real hole.
struct WheelRingShape: Shape {
  func path(in rect: CGRect) -> Path {
    let diameter = min(rect.width, rect.height)
    let outerRect = CGRect(x: rect.midX - diameter / 2, y: rect.midY - diameter / 2,
                           width: diameter, height: diameter)
    let outer = UIBezierPath(ovalIn: outerRect)
    let inner = UIBezierPath(ovalIn: outerRect.insetBy(dx: diameter * 0.21, dy: diameter * 0.21))
    outer.append(inner.reversing())
    return Path(outer.cgPath)
  }
}

final class WheelRingState: ObservableObject {
  @Published var visible = false
}

struct WheelRingContent: SwiftUI.View {
  @ObservedObject var state: WheelRingState
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  // Preserve the existing shadow and entrance behavior on iOS 26+.
  private var usesAnimatedPresentation: Bool {
    if #available(iOS 26.0, *) { return true }
    return false
  }

  var body: some SwiftUI.View {
    GeometryReader { geometry in
      WheelRingShape()
        .fill(Color.white.opacity(0.60))
        .frame(width: geometry.size.width, height: geometry.size.height)
        .opacity(state.visible ? 1 : 0)
        .shadow(color: .black.opacity(usesAnimatedPresentation && state.visible ? 0.12 : 0), radius: 12, x: 0, y: 6)
        .animation(usesAnimatedPresentation && !reduceMotion && state.visible ? .easeOut(duration: 0.15) : nil, value: state.visible)
    }
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }
}

class LiquidGlassWheelView: ExpoView {
  private let state = WheelRingState()
  private var host: UIHostingController<WheelRingContent>!

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    clipsToBounds = false
    host = UIHostingController(rootView: WheelRingContent(state: state))
    // React Native already positions this overlay inside its measured bounds.
    // A hosting controller must not inset the ring again for the screen's safe area.
    host.safeAreaRegions = []
    host.view.backgroundColor = .clear
    host.view.isHidden = true
    host.view.isUserInteractionEnabled = false
    addSubview(host.view)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    host.view.frame = bounds
  }

  func setVisible(_ visible: Bool) {
    if state.visible != visible {
      // Hide the native surface immediately, even while its entrance is animating.
      host.view.isHidden = !visible
      state.visible = visible
    }
  }
}
