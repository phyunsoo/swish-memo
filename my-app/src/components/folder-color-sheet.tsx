import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Folder } from "@/lib/memo-model";
import { canonicalFolderColorId, folderColorFor, folderColorOptionsFor, folderColorSelectionBackground, type FolderColorId } from "@/lib/folder-colors";
import { FolderPickerGrid, FolderPickerSheet } from "./folder-picker-sheet";
import { FOLDER_PICKER_CELL_SIZE } from "./folder-picker-layout";

export function FolderColorSheet({ folder, selectedColor, isDark, onClose, onSave, onSelectColor }: {
  folder: Folder | null;
  selectedColor: FolderColorId;
  isDark: boolean;
  onClose: () => void;
  onSave: () => void;
  onSelectColor: (color: FolderColorId) => void;
}) {
  const options = folderColorOptionsFor(folder?.color);
  const selectedId = canonicalFolderColorId(selectedColor);
  return (
    <FolderPickerSheet visible={folder !== null} title="폴더 색상 편집" isDark={isDark}
      accentColor={folderColorFor(selectedColor, isDark)} onClose={onClose} onSave={onSave}>
      <FolderPickerGrid items={options} keyForItem={(item) => item.id} renderItem={(color) => {
        const selected = selectedId === color.id;
        return (
          <Pressable style={[styles.colorButton, selected && {
            backgroundColor: folderColorSelectionBackground(color.id, isDark), borderColor: folderColorFor(color.id, isDark),
          }]}
            onPress={() => onSelectColor(color.id)} accessibilityRole="button"
            accessibilityLabel={color.label + (selected ? ", 선택됨" : "")} accessibilityState={{ selected }}>
            <View style={[styles.swatch, { backgroundColor: color.swatch, borderColor: isDark ? "#5A5A5E" : "#C7C7CC" }]}>
              {selected && <Text style={[styles.checkmark, { color: color.check }]}>✓</Text>}
            </View>
          </Pressable>
        );
      }} />
    </FolderPickerSheet>
  );
}

const styles = StyleSheet.create({
  colorButton: { width: FOLDER_PICKER_CELL_SIZE, height: FOLDER_PICKER_CELL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 2, borderColor: "transparent" },
  swatch: { width: 29, height: 29, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  checkmark: { fontSize: 17, fontWeight: "700", lineHeight: 20 },
});
