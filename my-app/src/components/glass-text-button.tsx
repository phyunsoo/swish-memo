import { Platform, StyleSheet, View } from "react-native";
import { Button, Host, Text } from "@expo/ui";
import { buttonBorderShape, buttonStyle, controlSize, frame } from "@expo/ui/swift-ui/modifiers";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useGlassResumeKey } from "@/hooks/use-glass-resume-key";
import { useAppearance } from "@/lib/appearance";
import { GLASS_BUTTON_SIZE } from "./glass-button";

const ACCENT = "#E7A000";
const BUTTON_HEIGHT = GLASS_BUTTON_SIZE;
export const TEXT_BUTTON_WIDTH = 72;

export function GlassTextButton({
  title,
  textColor = ACCENT,
  glassTint,
  onPress,
  width = TEXT_BUTTON_WIDTH,
  height = BUTTON_HEIGHT,
}: {
  title: string;
  textColor?: string;
  glassTint: string;
  onPress: () => void;
  width?: number;
  height?: number;
}) {
  const usesNativeGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  const resumeKey = useGlassResumeKey();
  const { mode } = useAppearance();

  return (
    <View style={[styles.glassButton, styles.doneButton, { width, height }]}>
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
        accessibilityLabel={title}
      >
        <Button
          onPress={onPress}
          variant="text"
          modifiers={[
            buttonStyle(usesNativeGlass ? "glass" : "plain"),
            buttonBorderShape("capsule"),
            frame({ width, height }),
            controlSize(height < BUTTON_HEIGHT ? "regular" : "large"),
          ]}
          style={{ ...styles.doneNativeButton, width, height }}
        >
          <Text textStyle={{ fontSize: 17, fontWeight: "600", color: textColor }}>
            {title}
          </Text>
        </Button>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  glassButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BUTTON_HEIGHT / 2,
  },
  glassSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: BUTTON_HEIGHT / 2,
  },
  doneButton: {
    width: TEXT_BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
  },
  doneNativeButton: {
    width: TEXT_BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
