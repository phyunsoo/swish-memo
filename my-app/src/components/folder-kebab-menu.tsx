import { Alert } from "react-native";
import { GlassButton } from "./glass-button";

export type FolderKebabMenuProps = {
  onSearch: () => void;
  onSettings: () => void;
  onEmptyTrash: () => void;
  showEmptyTrash: boolean;
  onRenameFolder: (name: string) => void;
  onRequestRenameFolder: () => void;
  folderName?: string;
  onDeleteFolder: () => void;
  showFolderActions: boolean;
  isDark: boolean;
};

export function FolderKebabMenu({ onSearch, onSettings, onEmptyTrash, showEmptyTrash, onRequestRenameFolder, onDeleteFolder, showFolderActions, isDark }: FolderKebabMenuProps) {
  return (
    <GlassButton
      label="더 보기"
      symbol="ellipsis"
      tint={isDark ? "#F5F5F2" : "#171717"}
      glassTint={isDark ? "#343438" : "#F2F2F5"}
      onPress={() => Alert.alert("더 보기", undefined, [
        { text: "설정", onPress: onSettings },
        { text: "검색", onPress: onSearch },
        ...(showEmptyTrash ? [{ text: "휴지통 비우기", style: "destructive" as const, onPress: onEmptyTrash }] : []),
        ...(showFolderActions ? [{ text: "폴더 이름 변경", onPress: onRequestRenameFolder }, { text: "폴더 삭제", style: "destructive" as const, onPress: onDeleteFolder }] : []),
        { text: "닫기", style: "cancel" },
      ])}
    />
  );
}
