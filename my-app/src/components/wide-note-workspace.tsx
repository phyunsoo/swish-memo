import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StoredNote } from "@/lib/local-store";
import type { SearchScrollTarget } from "@/lib/note-search";

/** Compact previews keep the original long-press move and reorder gestures. */
export function NoteListRow({ note, text = note.text, selected, isDark, onSelect, reorderHandle }: {
  note: StoredNote;
  text?: string;
  selected: boolean;
  isDark: boolean;
  onSelect: () => void;
  reorderHandle?: ReactNode;
}) {
  const title = text.trim().split(/\r?\n/)[0] || (note.photos?.length ? "사진 메모" : "빈 메모");
  const preview = text.trim().split(/\r?\n/).slice(1).join(" ").trim();
  return (
    <View style={[styles.row, {
      backgroundColor: selected ? isDark ? "#493A19" : "#FFF0C9" : "transparent",
      borderColor: selected ? isDark ? "#826323" : "#ECCC83" : "transparent",
    }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={title}
        accessibilityState={{ selected }} onPress={onSelect}
        style={({ pressed }) => [styles.rowButton, pressed && { opacity: 0.6 }]}>
        <Text numberOfLines={1} style={[styles.title, { color: isDark ? "#F5F5F2" : "#171717" }]}>{title}</Text>
        {!!preview && <Text numberOfLines={2} style={[styles.preview, { color: isDark ? "#A1A1A6" : "#747478" }]}>{preview}</Text>}
        <Text numberOfLines={1} style={[styles.date, { color: isDark ? "#A1A1A6" : "#747478" }]}>
          {new Date(note.timestamp).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
          {!!note.photos?.length && ` · 사진 ${note.photos.length}장`}
        </Text>
      </Pressable>
      {reorderHandle && <View style={styles.reorder}>{reorderHandle}</View>}
    </View>
  );
}

export function NoteDetailPane({ children, isDark, topInset, bottomInset, keyboardInset, searchTarget }: {
  children: ReactNode;
  isDark: boolean;
  topInset: number;
  bottomInset: number;
  keyboardInset: number;
  searchTarget: SearchScrollTarget | null;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollToMatch = useCallback(() => {
    if (searchTarget) scrollRef.current?.scrollTo({ y: Math.max(0, searchTarget.offset - 24), animated: true });
  }, [searchTarget]);
  useEffect(scrollToMatch, [scrollToMatch]);
  return (
    <ScrollView ref={scrollRef} style={[styles.detail, { marginBottom: keyboardInset }]}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false}
      contentInsetAdjustmentBehavior="never" onContentSizeChange={scrollToMatch}
      contentContainerStyle={{ flexGrow: 1, paddingTop: topInset, paddingBottom: bottomInset }}>
      <View style={[styles.page, { backgroundColor: isDark ? "#111110" : "#FFFFFF" }]}>{children}</View>
    </ScrollView>
  );
}

export function EmptyNoteDetail({ isDark }: { isDark: boolean }) {
  return <View style={styles.empty}>
    <Text style={[styles.emptyTitle, { color: isDark ? "#C3C3C7" : "#636366" }]}>메모가 없습니다</Text>
    <Text style={[styles.emptyMessage, { color: isDark ? "#929299" : "#8E8E93" }]}>작성 화면에서 새로운 생각을 남겨 보세요.</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  rowButton: { flex: 1, minWidth: 0, minHeight: 88, paddingHorizontal: 14, paddingVertical: 14, gap: 6 },
  title: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  preview: { fontSize: 14, lineHeight: 20 },
  date: { fontSize: 12, lineHeight: 18, fontVariant: ["tabular-nums"] },
  reorder: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  detail: { flex: 1, minWidth: 0 },
  page: { width: "100%", maxWidth: 820, alignSelf: "center", flex: 1, paddingHorizontal: 12 },
  empty: { flex: 1, minHeight: 260, justifyContent: "center", alignItems: "center", padding: 32, gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: "600" },
  emptyMessage: { fontSize: 15, textAlign: "center", lineHeight: 23 },
});
