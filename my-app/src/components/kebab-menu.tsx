import { Alert } from "react-native";
import { GlassButton } from "./glass-button";
import type { KebabMenuAction } from "@/lib/kebab-menu-actions";

export type KebabMenuProps = { actions: KebabMenuAction[]; isDark: boolean };

export function KebabMenu({ actions, isDark }: KebabMenuProps) {
  return <GlassButton label="더 보기" symbol="ellipsis"
    tint={isDark ? "#F5F5F2" : "#171717"} glassTint={isDark ? "#343438" : "#F2F2F5"}
    onPress={() => Alert.alert("더 보기", undefined, [
      ...actions.filter((action) => !action.disabled).map((action) => ({
        text: action.title, style: action.destructive ? "destructive" as const : "default" as const, onPress: action.onPress,
      })),
      { text: "닫기", style: "cancel" },
    ])} />;
}
