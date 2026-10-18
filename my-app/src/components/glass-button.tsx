import { Platform, StyleSheet, View } from "react-native";
import { Button, Host, Icon, Text } from "@expo/ui";
import { buttonBorderShape, buttonStyle, controlSize, frame } from "@expo/ui/swift-ui/modifiers";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useGlassResumeKey } from "@/hooks/use-glass-resume-key";
import { useAppearance } from "@/lib/appearance";

export const GLASS_BUTTON_SIZE = 60;
const ACCENT = "#E7A000";
const ICON_SIZE = 22;
const ICON_LABEL_SIZE = 20;

export function GlassButton({
  label,
  symbol,
  width = GLASS_BUTTON_SIZE,
  tint = "#171717",
  glassTint = "#F2F2F5",
  onPress,
}: {
  label: string;
  symbol: "square.and.pencil" | "folder" | "ellipsis" | "circle" | "paperclip" | "keyboard.chevron.compact.down";
  width?: number;
  tint?: string;
  glassTint?: string;
  onPress?: () => void;
}) {
  const usesNativeGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  const resumeKey = useGlassResumeKey();
  const { mode } = useAppearance();

  return (
    <View style={[styles.glassButton, styles.iconButtonShadow, { width, height: GLASS_BUTTON_SIZE }]}>
      {!usesNativeGlass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          isInteractive
          tintColor={glassTint}
          colorScheme={mode}
          style={styles.glassSurface}
        />
      )}
      <Host
        key={usesNativeGlass ? resumeKey : "fallback"}
        colorScheme={mode}
        matchContents
        ignoreSafeArea="all"
        seedColor={ACCENT}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Button
          onPress={onPress}
          variant="text"
          modifiers={[
            buttonStyle(usesNativeGlass ? "glass" : "plain"),
            buttonBorderShape("circle"),
            controlSize("large"),
            frame({ width, height: GLASS_BUTTON_SIZE }),
          ]}
          style={{
            width,
            height: GLASS_BUTTON_SIZE,
            paddingHorizontal: 0,
            paddingVertical: 0,
          }}
        >
          {Platform.OS === "ios" ? (
            <Icon
              name={symbol}
              size={ICON_SIZE}
              color={tint}
              modifiers={[
                frame({ width: ICON_LABEL_SIZE, height: ICON_LABEL_SIZE }),
              ]}
            />
          ) : (
            <Text textStyle={{ fontSize: ICON_SIZE, color: tint }}>
              {symbol === "square.and.pencil" ? "✎" : symbol === "ellipsis" ? "⋮" : symbol === "circle" ? "○" : symbol === "paperclip" ? "📎"
                : symbol === "keyboard.chevron.compact.down" ? "⌨⌄" : "📁"}
            </Text>
          )}
        </Button>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  glassButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: GLASS_BUTTON_SIZE / 2,
  },
  glassSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: GLASS_BUTTON_SIZE / 2,
  },
  iconButtonShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.025,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
