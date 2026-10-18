import { Button, Image, Text, ZStack } from "@expo/ui/swift-ui";
import { accessibilityAddTraits, accessibilityLabel, background, buttonStyle, frame, shapes, strokeBorder } from "@expo/ui/swift-ui/modifiers";
import type { Folder } from "@/lib/memo-model";
import { canonicalFolderColorId, folderColorFor, folderColorOptionsFor, folderColorSelectionBackground, type FolderColorId, type FolderColorOption } from "@/lib/folder-colors";
import { FolderPickerGrid, FolderPickerSheet } from "./folder-picker-sheet";
import { FOLDER_PICKER_CELL_SIZE } from "./folder-picker-layout";

function ColorChoice({ color, selected, isDark, onPress }: {
  color: FolderColorOption;
  selected: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Button onPress={onPress} modifiers={[
      buttonStyle("plain"),
      frame({ width: FOLDER_PICKER_CELL_SIZE, height: FOLDER_PICKER_CELL_SIZE }),
      background(selected ? folderColorSelectionBackground(color.id, isDark) : "clear", shapes.circle()),
      strokeBorder({ content: selected ? folderColorFor(color.id, isDark) : "clear", style: { lineWidth: 2 }, shape: "circle" }),
      accessibilityLabel(color.label + (selected ? ", 선택됨" : "")),
      accessibilityAddTraits(selected ? ["isButton", "isSelected"] : ["isButton"]),
    ]}>
      <ZStack alignment="center">
        <Text modifiers={[
          frame({ width: 29, height: 29 }), background(color.swatch, shapes.circle()),
          strokeBorder({ content: isDark ? "#5A5A5E" : "#C7C7CC", style: { lineWidth: 1 }, shape: "circle" }),
        ]}> </Text>
        {selected && <Image systemName="checkmark" size={13} color={color.check} />}
      </ZStack>
    </Button>
  );
}

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
      <FolderPickerGrid items={options} keyForItem={(item) => item.id} renderItem={(color) => (
        <ColorChoice color={color} selected={selectedId === color.id} isDark={isDark} onPress={() => onSelectColor(color.id)} />
      )} />
    </FolderPickerSheet>
  );
}
