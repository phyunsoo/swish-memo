import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";

export function MoveSuccessHud({ destination, isDark, onDismiss }: {
  destination: string;
  isDark: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${destination}로 이동했어요`);
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [destination, onDismiss]);
  const color = isDark ? "#FFFFFF" : "#222222";
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
        accessible accessibilityLabel={`이동 완료, ${destination}`} style={styles.hud}>
        <GlassView pointerEvents="none" glassEffectStyle="regular" tintColor={isDark ? "#444444BB" : "#EEEEEECC"}
          colorScheme={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <SymbolView name="checkmark" size={52} tintColor={color} />
        <Text style={[styles.title, { color }]}>이동 완료</Text>
        <Text numberOfLines={2} style={[styles.destination, { color }]}>{destination}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", zIndex: 100 },
  hud: { width: 180, minHeight: 180, borderRadius: 24, borderCurve: "continuous", overflow: "hidden", alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
  title: { fontSize: 19, fontWeight: "600" },
  destination: { fontSize: 14, textAlign: "center" },
});
