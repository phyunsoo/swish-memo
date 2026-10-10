import { Alert } from "react-native";
import { GlassButton } from "./glass-button";

export type FolderKebabMenuProps = {
  onSettings: () => void;
  isDark: boolean;
};

export function FolderKebabMenu({ onSettings, isDark }: FolderKebabMenuProps) {
  return (
    <GlassButton
      label="더 보기"
      symbol="ellipsis"
      tint={isDark ? "#F5F5F2" : "#171717"}
      glassTint={isDark ? "#343438" : "#F2F2F5"}
      onPress={() => Alert.alert("더 보기", undefined, [
        { text: "설정", onPress: onSettings },
        { text: "닫기", style: "cancel" },
      ])}
    />
  );
}
