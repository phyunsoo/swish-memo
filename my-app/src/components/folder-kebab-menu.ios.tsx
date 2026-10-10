import { StyleSheet, View } from "react-native";
import { Host } from "@expo/ui";
import { Button as SwiftUIButton, Image as SwiftUIImage, Menu as SwiftUIMenu } from "@expo/ui/swift-ui";
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, frame } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import NativeKebabMenuView from "../../modules/liquid-glass-wheel/src/NativeKebabMenuView";
import { GLASS_BUTTON_SIZE } from "./glass-button";
import type { FolderKebabMenuProps } from "./folder-kebab-menu";

export function FolderKebabMenu({ onSettings, isDark }: FolderKebabMenuProps) {
  const usesNativeGlass = isLiquidGlassAvailable();

  if (NativeKebabMenuView) {
    return <NativeKebabMenuView style={styles.menuButton} isDark={isDark} showsDeleteAction={false} onSettings={onSettings} />;
  }

  return (
    <View style={styles.menuButton}>
      <Host matchContents ignoreSafeArea="all" seedColor={isDark ? "#F5F5F2" : "#171717"}>
        <SwiftUIMenu
          label={<SwiftUIImage systemName="ellipsis" modifiers={[frame({ width: 20, height: 20 })]} />}
          modifiers={[
            accessibilityLabel("더 보기"),
            buttonStyle(usesNativeGlass ? "glass" : "plain"),
            buttonBorderShape("circle"),
            controlSize("large"),
            frame({ width: GLASS_BUTTON_SIZE, height: GLASS_BUTTON_SIZE }),
          ]}
        >
          <SwiftUIButton label="설정" systemImage="gearshape" onPress={onSettings} />
        </SwiftUIMenu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: GLASS_BUTTON_SIZE,
    height: GLASS_BUTTON_SIZE,
    borderRadius: GLASS_BUTTON_SIZE / 2,
  },
});
