import ExpoModulesCore
import UIKit

/// UIKit owns the glass, its shadow, and the menu transition. No extra shadow layer is used.
final class NativeKebabMenuView: ExpoView {
  let onDelete = EventDispatcher()
  let onTextSize = EventDispatcher()

  private var menuButton: RestoringGlassMenuButton!
  private var isMenuPresented = false
  private var pendingDelete = false
  private var isDark = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
    installButton()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Match the 50pt native circle inside the existing 60pt toolbar slot.
    let side = min(50, min(bounds.width, bounds.height))
    menuButton.frame = CGRect(
      x: (bounds.width - side) / 2,
      y: (bounds.height - side) / 2,
      width: side,
      height: side
    )
  }

  func setDarkAppearance(_ value: Bool) {
    isDark = value
    menuButton.overrideUserInterfaceStyle = isDark ? .dark : .light
    menuButton.setNeedsUpdateConfiguration()
  }

  private func installButton() {
    let button = RestoringGlassMenuButton(type: .system)
    var configuration: UIButton.Configuration
    if #available(iOS 26.0, tvOS 26.0, *) {
      configuration = .glass()
    } else {
      configuration = .gray()
    }
    configuration.cornerStyle = .capsule
    configuration.buttonSize = .large
    configuration.image = UIImage(systemName: "ellipsis")
    configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 22)
    configuration.baseForegroundColor = .label
    button.configuration = configuration
    button.overrideUserInterfaceStyle = isDark ? .dark : .light
    button.accessibilityLabel = "더 보기"
    button.showsMenuAsPrimaryAction = true
    button.menu = UIMenu(children: [
      UIAction(title: "설정", image: UIImage(systemName: "gearshape")) { _ in },
      UIAction(title: "텍스트 크기", image: UIImage(systemName: "textformat.size")) { [weak self] _ in
        self?.onTextSize()
      },
      UIAction(title: "모두 삭제", image: UIImage(systemName: "trash"), attributes: .destructive) { [weak self] _ in
        guard let self else { return }
        if self.isMenuPresented {
          self.pendingDelete = true
        } else {
          self.onDelete()
        }
      }
    ])
    button.onMenuWillDisplay = { [weak self] in
      self?.isMenuPresented = true
      self?.window?.endEditing(true)
    }
    button.onMenuDidDismiss = { [weak self, weak button] in
      guard let self, self.menuButton === button else { return }
      self.isMenuPresented = false
      // Recreate the native glass after UIKit finishes removing the menu's preview.
      // Reassigning the old button's shadow/configuration can retain the broken glass state.
      self.installButton()
      if self.pendingDelete {
        self.pendingDelete = false
        self.onDelete()
      }
    }

    let oldButton = menuButton
    menuButton = button
    addSubview(button)
    layoutSubviews()
    oldButton?.removeFromSuperview()
  }
}

private final class RestoringGlassMenuButton: UIButton {
  var onMenuWillDisplay: (() -> Void)?
  var onMenuDidDismiss: (() -> Void)?

  override func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willDisplayMenuFor configuration: UIContextMenuConfiguration,
    animator: (any UIContextMenuInteractionAnimating)?
  ) {
    super.contextMenuInteraction(interaction, willDisplayMenuFor: configuration, animator: animator)
    onMenuWillDisplay?()
    // The system preview animates the glass; hide the original to avoid a second circle behind it.
    if let animator {
      animator.addAnimations { self.alpha = 0 }
    } else {
      alpha = 0
    }
  }

  override func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willEndFor configuration: UIContextMenuConfiguration,
    animator: (any UIContextMenuInteractionAnimating)?
  ) {
    super.contextMenuInteraction(interaction, willEndFor: configuration, animator: animator)
    if let animator {
      animator.addAnimations { self.alpha = 1 }
      animator.addCompletion { [weak self] in self?.onMenuDidDismiss?() }
    } else {
      alpha = 1
      onMenuDidDismiss?()
    }
  }
}
