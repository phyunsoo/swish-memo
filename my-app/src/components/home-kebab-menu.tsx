import { Alert } from "react-native";
import { GlassButton } from "./glass-button";

export type HomeKebabMenuProps = {
  onDelete: () => void;
  onTextSize: () => void;
  isDark: boolean;
};

export function HomeKebabMenu({ onDelete, onTextSize, isDark }: HomeKebabMenuProps) {
  return (
    <GlassButton
      label="더 보기"
      symbol="ellipsis"
      tint={isDark ? "#F5F5F2" : "#171717"}
      glassTint={isDark ? "#343438" : "#F2F2F5"}
      onPress={() => Alert.alert("더 보기", undefined, [
        { text: "텍스트 크기", onPress: onTextSize },
        { text: "설정", onPress: () => {} },
        { text: "모두 삭제", style: "destructive", onPress: onDelete },
        { text: "닫기", style: "cancel" },
      ])}
    />
  );
}
