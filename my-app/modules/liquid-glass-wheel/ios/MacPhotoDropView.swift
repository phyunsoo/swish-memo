import ExpoModulesCore
import UniformTypeIdentifiers
import UIKit

final class MacPhotoDropView: ExpoView, UIDropInteractionDelegate {
  let onDropImages = EventDispatcher()
  private var isEnabled = false
  private var attachmentTargetKey = ""

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    addInteraction(UIDropInteraction(delegate: self))
    Self.removeStaleTemporaryImages()
  }

  func setEnabled(_ enabled: Bool) {
    isEnabled = enabled
  }

  func setTargetKey(_ targetKey: String) {
    attachmentTargetKey = targetKey
  }

  func dropInteraction(_ interaction: UIDropInteraction, canHandle session: UIDropSession) -> Bool {
    guard isEnabled, !attachmentTargetKey.isEmpty else { return false }
    return session.items.contains { item in
      item.itemProvider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier)
        || item.itemProvider.registeredTypeIdentifiers.contains { identifier in
          UTType(identifier)?.conforms(to: .image) == true
        }
    }
  }

  func dropInteraction(_ interaction: UIDropInteraction, sessionDidUpdate session: UIDropSession) -> UIDropProposal {
    UIDropProposal(operation: .copy)
  }

  func dropInteraction(_ interaction: UIDropInteraction, performDrop session: UIDropSession) {
    guard isEnabled, !attachmentTargetKey.isEmpty else { return }

    let targetKeyAtDrop = attachmentTargetKey
    let providers = session.items.map(\.itemProvider)
    let group = DispatchGroup()
    let lock = NSLock()
    var assets = Array<[String: Any]?>(repeating: nil, count: providers.count)

    for (index, provider) in providers.enumerated() {
      if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
        group.enter()
        provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { [weak self] item, _ in
          defer { group.leave() }
          guard let self, let sourceURL = Self.fileURL(from: item),
                let asset = self.copyImage(at: sourceURL) else { return }
          lock.lock()
          assets[index] = asset
          lock.unlock()
        }
        continue
      }

      guard let imageType = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .image) == true }) else {
        continue
      }
      group.enter()
      provider.loadDataRepresentation(forTypeIdentifier: imageType) { [weak self] data, _ in
        defer { group.leave() }
        guard let self, let data, let asset = self.writeImage(data, typeIdentifier: imageType) else { return }
        lock.lock()
        assets[index] = asset
        lock.unlock()
      }
    }

    group.notify(queue: .main) { [weak self] in
      guard let self else { return }
      let completedAssets = assets.compactMap { $0 }
      self.onDropImages([
        "targetKey": targetKeyAtDrop,
        "images": completedAssets,
        "failedCount": providers.count - completedAssets.count
      ])
    }
  }

  private static func fileURL(from item: NSSecureCoding?) -> URL? {
    if let url = item as? URL { return url }
    if let url = item as? NSURL { return url as URL }
    if let data = item as? Data { return URL(dataRepresentation: data, relativeTo: nil) }
    return nil
  }

  private func copyImage(at sourceURL: URL) -> [String: Any]? {
    guard let type = UTType(filenameExtension: sourceURL.pathExtension), type.conforms(to: .image) else { return nil }
    let accessed = sourceURL.startAccessingSecurityScopedResource()
    defer { if accessed { sourceURL.stopAccessingSecurityScopedResource() } }

    let destination = FileManager.default.temporaryDirectory
      .appendingPathComponent("swish-drop-\(UUID().uuidString).\(type.preferredFilenameExtension ?? "img")")
    do {
      try FileManager.default.copyItem(at: sourceURL, to: destination)
      scheduleTemporaryCleanup(for: destination)
      return imageAsset(at: destination)
    } catch {
      return nil
    }
  }

  private func writeImage(_ data: Data, typeIdentifier: String) -> [String: Any]? {
    let type = UTType(typeIdentifier)
    let destination = FileManager.default.temporaryDirectory
      .appendingPathComponent("swish-drop-\(UUID().uuidString).\(type?.preferredFilenameExtension ?? "img")")
    do {
      try data.write(to: destination, options: .atomic)
      scheduleTemporaryCleanup(for: destination)
      return imageAsset(at: destination)
    } catch {
      return nil
    }
  }

  private func imageAsset(at url: URL) -> [String: Any]? {
    guard let image = UIImage(contentsOfFile: url.path), image.size.width > 0, image.size.height > 0 else {
      try? FileManager.default.removeItem(at: url)
      return nil
    }
    return [
      "uri": url.absoluteString,
      "width": Int(image.size.width * image.scale),
      "height": Int(image.size.height * image.scale),
      "temporary": true
    ]
  }

  private func scheduleTemporaryCleanup(for url: URL) {
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 300) {
      try? FileManager.default.removeItem(at: url)
    }
  }

  private static func removeStaleTemporaryImages() {
    let directory = FileManager.default.temporaryDirectory
    guard let urls = try? FileManager.default.contentsOfDirectory(
      at: directory,
      includingPropertiesForKeys: [.contentModificationDateKey]
    ) else { return }
    let cutoff = Date(timeIntervalSinceNow: -3600)
    for url in urls where url.lastPathComponent.hasPrefix("swish-drop-") {
      guard let values = try? url.resourceValues(forKeys: [.contentModificationDateKey]),
            let modified = values.contentModificationDate, modified < cutoff else { continue }
      try? FileManager.default.removeItem(at: url)
    }
  }
}
