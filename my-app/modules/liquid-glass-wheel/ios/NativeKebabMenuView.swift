import ExpoModulesCore
import UIKit

/// UIKit owns the glass, its shadow, and the menu transition. No extra shadow layer is used.
final class NativeKebabMenuView: ExpoView {
  let onSearch = EventDispatcher()
  let onReorder = EventDispatcher()
  let onDelete = EventDispatcher()
  let onSettings = EventDispatcher()
  let onEmptyTrash = EventDispatcher()
  let onRenameFolder = EventDispatcher()
  let onDeleteFolder = EventDispatcher()

  private var menuButton: RestoringGlassMenuButton!
  private var isMenuPresented = false
  private var isDark = false
  private var showsDeleteAction = true
  private var showsEmptyTrashAction = false
  private var showsFolderActions = false
  private var folderName = ""

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

  func setShowsDeleteAction(_ value: Bool) {
    showsDeleteAction = value
    menuButton.menu = makeMenu()
  }

  func setShowsEmptyTrashAction(_ value: Bool) {
    showsEmptyTrashAction = value
    menuButton.menu = makeMenu()
  }

  func setShowsFolderActions(_ value: Bool) {
    showsFolderActions = value
    menuButton.menu = makeMenu()
  }

  func setFolderName(_ value: String) {
    folderName = value
  }

  private func makeMenu() -> UIMenu {
    var actions = [
      UIAction(title: "설정", image: UIImage(systemName: "gearshape")) { [weak self] _ in self?.onSettings() },
      UIAction(title: "검색", image: UIImage(systemName: "magnifyingglass")) { [weak self] _ in self?.onSearch() },
      UIAction(title: "메모 순서 바꾸기", image: UIImage(systemName: "arrow.up.arrow.down")) { [weak self] _ in self?.onReorder() }
    ]
    if showsDeleteAction {
      actions.append(UIAction(title: "모두 삭제", image: UIImage(systemName: "trash"), attributes: .destructive) { [weak self] _ in
        self?.onDelete()
      })
    }
    if showsEmptyTrashAction {
      actions.append(UIAction(title: "휴지통 비우기", image: UIImage(systemName: "trash"), attributes: .destructive) { [weak self] _ in
        self?.onEmptyTrash()
      })
    }
    if showsFolderActions {
      actions.append(UIAction(title: "폴더 이름 변경", image: UIImage(systemName: "pencil")) { [weak self] _ in
        self?.presentFolderNameAlert()
      })
      actions.append(UIAction(title: "폴더 삭제", image: UIImage(systemName: "trash"), attributes: .destructive) { [weak self] _ in
        self?.onDeleteFolder()
      })
    }
    return UIMenu(children: actions)
  }

  private func presentFolderNameAlert() {
    guard let window = window, var presenter = window.rootViewController else { return }
    while let presented = presenter.presentedViewController {
      presenter = presented
    }

    let alert = UIAlertController(title: "폴더 이름 변경", message: "폴더 이름을 입력하세요.", preferredStyle: .alert)
    alert.addTextField { [weak self] field in
      field.text = self?.folderName

      field.clearButtonMode = .whileEditing
    }
    alert.addAction(UIAlertAction(title: "취소", style: .cancel))
    alert.addAction(UIAlertAction(title: "확인", style: .default) { [weak self, weak alert] _ in
      guard let name = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else { return }
      self?.onRenameFolder(["name": name])
    })
    presenter.present(alert, animated: true)
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
    button.menu = makeMenu()
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
