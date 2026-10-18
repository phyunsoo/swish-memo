import { Button, Image } from "@expo/ui/swift-ui";
import { accessibilityAddTraits, accessibilityLabel, background, buttonStyle, frame, shapes, strokeBorder } from "@expo/ui/swift-ui/modifiers";
import type { SFSymbol } from "expo-symbols";
import type { Folder } from "@/lib/memo-model";
import { FOLDER_ICON_OPTIONS, type FolderIcon } from "@/lib/folder-icons";
import { folderColorSelectionBackground } from "@/lib/folder-colors";
import { FolderPickerGrid, FolderPickerSheet } from "./folder-picker-sheet";
import { FOLDER_PICKER_CELL_SIZE } from "./folder-picker-layout";

function IconChoice({ symbol, label, selected, symbolColor, selectedBackground, onPress }: {
  symbol: SFSymbol;
  label: string;
  selected: boolean;
  symbolColor: string;
  selectedBackground: string;
  onPress: () => void;
}) {
  return (
    <Button onPress={onPress} modifiers={[
      buttonStyle("plain"),
      frame({ width: FOLDER_PICKER_CELL_SIZE, height: FOLDER_PICKER_CELL_SIZE }),
      background(selected ? selectedBackground : "clear", shapes.roundedRectangle({ cornerRadius: 12 })),
      strokeBorder({ content: selected ? symbolColor : "clear", style: { lineWidth: 2 }, shape: "roundedRectangle", cornerRadius: 12 }),
      accessibilityLabel(label + (selected ? ", 선택됨" : "")),
      accessibilityAddTraits(selected ? ["isButton", "isSelected"] : ["isButton"]),
    ]}>
      <Image systemName={symbol} size={24} color={symbolColor} />
    </Button>
  );
}

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
      <FolderPickerGrid items={FOLDER_ICON_OPTIONS} keyForItem={(item) => item.symbol} renderItem={({ symbol, label }) => (
        <IconChoice symbol={symbol} label={label} selected={selectedIcon === symbol}
          symbolColor={symbolColor} selectedBackground={selectedBackground} onPress={() => onSelectIcon(symbol)} />
      )} />
    </FolderPickerSheet>
  );
}
