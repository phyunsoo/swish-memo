import WidgetKit
import SwiftUI
import AppIntents

private struct TodoItem: Identifiable {
  let id: Int64
  let text: String
  let generation: String
  let order: Double
}

private struct TodoEntry: TimelineEntry {
  let date: Date
  let items: [TodoItem]
  var unavailable = false
}

private struct TodoProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodoEntry {
    TodoEntry(date: Date(), items: [
      TodoItem(id: 0, text: "오늘 할 일을 적어보세요", generation: "preview", order: 0),
      TodoItem(id: 1, text: "잠깐 산책하기", generation: "preview", order: 1),
    ])
  }

  private func entry() -> TodoEntry {
    do {
      let store = try SharedMemoStore.shared()
      guard let json = try store.load(),
            let snapshot = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else {
        return TodoEntry(date: Date(), items: [])
      }
      let items = (snapshot["notes"] as? [[String: Any]] ?? []).compactMap { note -> TodoItem? in
        guard note["state"] as? String == "saved", note["folderId"] as? String == "todo",
              let id = note["id"] as? NSNumber, let text = note["text"] as? String else { return nil }
        let recent = (snapshot["folders"] as? [[String: Any]])?.first(where: { $0["id"] as? String == "todo" })?["noteOrder"] as? String == "recent"
        return TodoItem(id: id.int64Value, text: text, generation: note["todoGeneration"] as? String ?? "legacy",
                        order: recent ? -(note["timestamp"] as? Double ?? 0) : (note["sortOrder"] as? Double ?? (note["timestamp"] as? Double ?? 0)))
      }.sorted { $0.order == $1.order ? $0.id < $1.id : $0.order < $1.order }
      return TodoEntry(date: Date(), items: items)
    } catch { return TodoEntry(date: Date(), items: [], unavailable: true) }
  }

  func getSnapshot(in context: Context, completion: @escaping (TodoEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodoEntry>) -> Void) {
    completion(Timeline(entries: [entry()], policy: .after(Date().addingTimeInterval(900))))
  }
}

struct CompleteTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "투두 완료"
  static var openAppWhenRun = false

  @Parameter(title: "메모") var noteID: String
  @Parameter(title: "투두 상태") var generation: String

  init() {}
  init(id: Int64, generation: String) {
    noteID = String(id)
    self.generation = generation
  }

  func perform() async throws -> some IntentResult {
    if let id = Int64(noteID) {
      _ = try SharedMemoStore.shared().complete(id: id, generation: generation)
      WidgetCenter.shared.reloadTimelines(ofKind: "SwishTodoWidget")
    }
    return .result()
  }
}

private struct TodoWidgetView: View {
  @ScaledMetric(relativeTo: .body) private var rowHeight: CGFloat = 32
  @ScaledMetric(relativeTo: .headline) private var headerHeight: CGFloat = 24
  let entry: TodoEntry
  private let destination = URL(string: "myapp:///?view=todo")!
  var body: some View {
    GeometryReader { geometry in
      let limit = max(1, Int((geometry.size.height - headerHeight - 22) / (rowHeight + 6)))
      content(limit: limit)
    }
    .tint(.blue)
    .widgetURL(destination)
    .containerBackground(.background, for: .widget)
  }

  private func content(limit: Int) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Link(destination: destination) {
        HStack {
          Label("투두리스트", systemImage: "checklist")
            .font(.headline).lineLimit(1)
          Spacer(minLength: 4)
          Text("\(entry.items.count)").font(.subheadline.monospacedDigit())
        }
      }
      .tint(.primary)
      if entry.items.isEmpty {
        Link(destination: destination) {
          Text(entry.unavailable ? "앱을 열어 저장소를 확인해 주세요" : "할 일이 없어요")
            .font(.subheadline).foregroundStyle(.secondary)
        }
      } else {
        ForEach(entry.items.prefix(limit)) { item in
          HStack(spacing: 8) {
            Button(intent: CompleteTodoIntent(id: item.id, generation: item.generation)) {
              Image(systemName: "circle")
                .font(.title3).foregroundStyle(.tint)
                .frame(width: 32, height: rowHeight)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(item.text) 완료")
            .accessibilityHint("휴지통으로 이동하며 30일 안에 복구할 수 있습니다")
            Link(destination: destination) {
              Text(item.text).font(.subheadline)
                .foregroundStyle(.primary).lineLimit(1).truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
        }
        Spacer(minLength: 0)
        if entry.items.count > limit {
          Link("\(entry.items.count - limit)개 더 보기", destination: destination)
            .font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }
      }
    }
  }
}

@main
struct SwishTodoWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SwishTodoWidget", provider: TodoProvider()) { entry in
      TodoWidgetView(entry: entry)
    }
    .configurationDisplayName("투두리스트")
    .description("할 일을 확인하고 앱을 열지 않고 완료하세요.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
