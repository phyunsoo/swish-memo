import { Fragment } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FOLDER_PICKER_CELL_SIZE, FOLDER_PICKER_COLUMNS, FOLDER_PICKER_GAP, folderPickerRows, type FolderPickerGridProps, type FolderPickerSheetProps } from "./folder-picker-layout";

export function FolderPickerSheet({ visible, title, isDark, accentColor, onClose, onSave, children }: FolderPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const save = () => {
    if (!visible) return;
    onSave();
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: isDark ? "#1C1C1E" : "#F8F8FA", paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="취소">
              <Text style={[styles.action, { color: isDark ? "#F5F5F2" : "#636366" }]}>취소</Text>
            </Pressable>
            <Text style={[styles.title, { color: isDark ? "#F5F5F2" : "#171717" }]}>{title}</Text>
            <Pressable style={styles.headerButton} onPress={save} accessibilityRole="button" accessibilityLabel="완료">
              <Text style={[styles.action, styles.done, { color: accentColor }]}>완료</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Math.min(height * 0.68, 600) }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function FolderPickerGrid<T>({ items, keyForItem, renderItem }: FolderPickerGridProps<T>) {
  return (
    <View style={styles.grid}>
      {folderPickerRows(items).map((row, index) => (
        <View key={index} style={styles.gridRow}>
          {row.map((item) => <Fragment key={keyForItem(item)}>{renderItem(item)}</Fragment>)}
          {Array.from({ length: FOLDER_PICKER_COLUMNS - row.length }, (_, column) => <View key={`empty-${column}`} style={styles.emptyCell} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "transparent" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.36)" },
  sheet: { width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: 20, paddingTop: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8 },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerButton: { width: 60, minHeight: 44, justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600" },
  action: { fontSize: 16 },
  done: { textAlign: "right", fontWeight: "600" },
  grid: { gap: FOLDER_PICKER_GAP, paddingBottom: 8 },
  gridRow: { flexDirection: "row", justifyContent: "space-between" },
  emptyCell: { width: FOLDER_PICKER_CELL_SIZE, height: FOLDER_PICKER_CELL_SIZE },
});
