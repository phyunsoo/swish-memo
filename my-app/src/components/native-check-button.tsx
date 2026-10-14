import { Button, Host, Icon, Text } from "@expo/ui";
import { buttonBorderShape, buttonStyle, controlSize, frame, tint } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, View } from "react-native";
import { GLASS_BUTTON_SIZE } from "./glass-button";

const BLUE = "#007AFF";

export function NativeCheckButton({ onPress }: { onPress: () => void }) {
  const isIOS = Platform.OS === "ios";

  return (
    <View style={{ width: GLASS_BUTTON_SIZE, height: GLASS_BUTTON_SIZE, alignItems: "center", justifyContent: "center" }}>
      <Host
        matchContents
        ignoreSafeArea="all"
        seedColor={BLUE}
        accessible
        accessibilityRole="button"
        accessibilityLabel="완료"
      >
        <Button
          onPress={onPress}
          variant="filled"
          modifiers={isIOS ? [
            buttonStyle(isLiquidGlassAvailable() ? "glassProminent" : "borderedProminent"),
            buttonBorderShape("circle"),
            controlSize("large"),
            tint(BLUE),
            frame({ width: GLASS_BUTTON_SIZE, height: GLASS_BUTTON_SIZE }),
          ] : undefined}
          style={{ width: GLASS_BUTTON_SIZE, height: GLASS_BUTTON_SIZE, paddingHorizontal: 0, paddingVertical: 0 }}
        >
          {isIOS ? (
            <Icon name="checkmark" size={24} color="#FFFFFF" />
          ) : (
            <Text textStyle={{ fontSize: 24, fontWeight: "600", color: "#FFFFFF" }}>✓</Text>
          )}
        </Button>
      </Host>
    </View>
  );
}
