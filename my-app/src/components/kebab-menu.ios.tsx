import { StyleSheet, View } from "react-native";
import { Host } from "@expo/ui";
import { Button, Image, Menu } from "@expo/ui/swift-ui";
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, disabled, frame } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import NativeKebabMenuView from "../../modules/liquid-glass-wheel/src/NativeKebabMenuView";
import { GLASS_BUTTON_SIZE } from "./glass-button";
import type { KebabMenuProps } from "./kebab-menu";

export function KebabMenu({ actions, isDark }: KebabMenuProps) {
  if (NativeKebabMenuView) return <NativeKebabMenuView style={styles.button} isDark={isDark}
    actions={actions.map(({ id, title, systemImage, destructive, disabled: isDisabled }) => ({
      id, title, systemImage, destructive: !!destructive, disabled: !!isDisabled,
    }))}
    onAction={(event) => {
      const action = actions.find((item) => item.id === event.nativeEvent.id);
      if (action && !action.disabled) action.onPress();
    }} />;

  return <View style={styles.button}>
    <Host matchContents ignoreSafeArea="all" seedColor={isDark ? "#F5F5F2" : "#171717"}>
      <Menu label={<Image systemName="ellipsis" modifiers={[frame({ width: 20, height: 20 })]} />}
        modifiers={[accessibilityLabel("더 보기"), buttonStyle(isLiquidGlassAvailable() ? "glass" : "plain"),
          buttonBorderShape("circle"), controlSize("large"), frame({ width: GLASS_BUTTON_SIZE, height: GLASS_BUTTON_SIZE })]}>
        {actions.map((action) => <Button key={action.id} label={action.title} systemImage={action.systemImage}
          role={action.destructive ? "destructive" : undefined} modifiers={[disabled(!!action.disabled)]} onPress={action.onPress} />)}
      </Menu>
    </Host>
  </View>;
}

const styles = StyleSheet.create({
  button: { width: GLASS_BUTTON_SIZE, height: GLASS_BUTTON_SIZE, borderRadius: GLASS_BUTTON_SIZE / 2 },
});
