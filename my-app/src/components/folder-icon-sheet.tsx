import { Pressable, StyleSheet } from "react-native";
import { SymbolView } from "expo-symbols";
import type { Folder } from "@/lib/memo-model";
import { FOLDER_ICON_OPTIONS, folderSymbol, type FolderIcon } from "@/lib/folder-icons";
import { folderColorSelectionBackground } from "@/lib/folder-colors";
import { FolderPickerGrid, FolderPickerSheet } from "./folder-picker-sheet";
import { FOLDER_PICKER_CELL_SIZE } from "./folder-picker-layout";

export function FolderIconSheet({ folder, selectedIcon, isDark, symbolColor, onClose, onSave, onSelectIcon }: {
  folder: Folder | null;
  selectedIcon: FolderIcon;
  isDark: boolean;
  symbolColor: string;
  onClose: () => void;
  onSave: () => void;
  onSelectIcon: (icon: FolderIcon) => void;
}) {
  const selectedBackground = folderColorSelectionBackground(folder?.color, isDark);
  return (
    <FolderPickerSheet visible={folder !== null} title="폴더 아이콘 편집" isDark={isDark}
      accentColor={symbolColor} onClose={onClose} onSave={onSave}>
      <FolderPickerGrid items={FOLDER_ICON_OPTIONS} keyForItem={(item) => item.symbol} renderItem={({ symbol, label }) => {
        const selected = selectedIcon === symbol;
        return (
          <Pressable style={[styles.iconButton, selected && { backgroundColor: selectedBackground, borderColor: symbolColor }]}
            onPress={() => onSelectIcon(symbol)} accessibilityRole="button"
            accessibilityLabel={label + (selected ? ", 선택됨" : "")} accessibilityState={{ selected }}>
            <SymbolView name={folderSymbol(symbol)} size={24} tintColor={symbolColor} />
          </Pressable>
        );
      }} />
    </FolderPickerSheet>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: FOLDER_PICKER_CELL_SIZE, height: FOLDER_PICKER_CELL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
});
