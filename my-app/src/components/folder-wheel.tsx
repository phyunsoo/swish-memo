import { Platform, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { MaskedView } from "@expo/ui/community/masked-view";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable, type GlassViewProps } from "expo-glass-effect";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const ACCENT = "#E7A000";
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);
const FEEDBACK = {
  duration: 120,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.System,
};

export type WheelState = {
  opacity: SharedValue<number>;
  selected: SharedValue<number>;
  centerX: SharedValue<number>;
  centerY: SharedValue<number>;
};

type Target = {
  id: number;
  title: string;
  symbol: SymbolViewProps["name"];
  start: number;
  end: number;
};

// Four equal mockup sectors; visuals and hit testing share these boundaries.
const TARGETS: Target[] = [
  { id: 0, title: "임시저장", symbol: "doc.badge.clock", start: 270, end: 360 },
  { id: 1, title: "삭제", symbol: "trash", start: 0, end: 90 },
  { id: 2, title: "인사이트", symbol: "folder", start: 90, end: 180 },
  { id: 3, title: "투두리스트", symbol: "checklist", start: 180, end: 270 },
];

// The finger, rather than the offset preview card, determines the selected direction.
export function wheelTargetAt(x: number, y: number, centerX: number, centerY: number, size: number) {
  "worklet";
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < size * 0.29 || distance > size / 2 + 16) return -1;
  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  for (const target of TARGETS) {
    if (angle >= target.start && angle < target.end) return target.id;
  }
  return -1;
}

function point(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return [50 + radius * Math.sin(radians), 50 - radius * Math.cos(radians)];
}

function sectorSource(start: number, end: number, fill: string) {
  const outerStart = point(50, start);
  const outerEnd = point(50, end);
  const innerStart = point(29, start);
  const innerEnd = point(29, end);
  const largeArc = end - start > 180 ? 1 : 0;
  const path = `M ${outerStart.join(" ")} A 50 50 0 ${largeArc} 1 ${outerEnd.join(" ")} L ${innerEnd.join(" ")} A 29 29 0 ${largeArc} 0 ${innerStart.join(" ")} Z`;
  // Each arc has its own command and spaced flags for the iOS SVG decoder.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100"><path d="${path}" fill="${fill}"/></svg>`;
  return { uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}

function WheelSector({ target, wheel, isDark }: {
  target: Target;
  wheel: WheelState;
  isDark: boolean;
}) {
  const supported = Platform.OS === "ios" && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const mask = sectorSource(target.start, target.end, "#FFFFFF");
  const animatedProps = useAnimatedProps<GlassViewProps>(() => ({
    glassEffectStyle: wheel.selected.get() === target.id
      ? { style: "regular", animate: true, animationDuration: 0.12 }
      : "none",
  }));
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(wheel.selected.get() === target.id ? 1 : 0, FEEDBACK),
  }));
  const tintStyle = useAnimatedStyle(() => ({
    opacity: withTiming(wheel.selected.get() === target.id ? 0.22 : 0, FEEDBACK),
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={<Image source={mask} style={StyleSheet.absoluteFill} contentFit="fill" />}
      >
      {supported ? (
        <AnimatedGlassView
          animatedProps={animatedProps}
          colorScheme={isDark ? "dark" : "light"}
          style={{ width: "100%", height: "100%", borderRadius: 1000 }}
        />
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, tintStyle, {
        backgroundColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.30)",
      }]} />
      </MaskedView>
    </Animated.View>
  );
}

function WheelTarget({ target, wheel, size, isDark }: {
  target: Target;
  wheel: WheelState;
  size: number;
  isDark: boolean;
}) {
  const selectedColor = target.id === 1 ? "#FF3B30" : ACCENT;
  const baseColor = target.id === 1 ? "#FF3B30" : isDark ? "#F5F5F7" : "#29292E";
  const radians = (target.start + target.end) / 2 * Math.PI / 180;
  const radius = size * 0.39;
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: withTiming(wheel.selected.get() === target.id ? 1 : 0, FEEDBACK),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: wheel.selected.get() === target.id ? selectedColor : baseColor,
  }));

  return (
      <Animated.View style={[styles.target, {
        left: size / 2 + radius * Math.sin(radians) - 44,
        top: size / 2 - radius * Math.cos(radians) - 32,
      }]}>
        <View style={styles.symbol}>
          <SymbolView name={target.symbol} tintColor={baseColor} size={30} weight="regular" style={styles.symbol} />
          <Animated.View style={[StyleSheet.absoluteFill, highlightStyle]}>
            <SymbolView name={target.symbol} tintColor={selectedColor} size={30} weight="regular" style={styles.symbol} />
          </Animated.View>
        </View>
        <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>{target.title}</Animated.Text>
      </Animated.View>
  );
}

function GlassRing({ wheel, size, isDark }: { wheel: WheelState; size: number; isDark: boolean }) {
  const supported = Platform.OS === "ios" && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const glassProps = useAnimatedProps<GlassViewProps>(() => ({
    // Toggle the native effect as well as parent opacity so repeated openings render correctly.
    glassEffectStyle: wheel.opacity.get() > 0.01 ? "clear" as const : "none" as const,
  }));
  const ringShape = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: size * 0.21,
  };

  return (
    <View style={{ width: size, height: size }}>
      {supported ? (
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={<View style={[ringShape, { borderColor: "#000000" }]} />}
        >
          <AnimatedGlassView
            animatedProps={glassProps}
            colorScheme={isDark ? "dark" : "light"}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        </MaskedView>
      ) : (
        <View style={[ringShape, {
          borderColor: isDark ? "rgba(70,70,78,0.28)" : "rgba(244,244,248,0.20)",
        }]} />
      )}
      <MaskedView
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        maskElement={<View style={[ringShape, { borderColor: "#000000" }]} />}
      >
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.13)",
        }]} />
      </MaskedView>
      <View style={[StyleSheet.absoluteFill, {
        borderRadius: size / 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.48)",
      }]} />
      <View style={{
        position: "absolute",
        top: size * 0.21,
        left: size * 0.21,
        width: size * 0.58,
        height: size * 0.58,
        borderRadius: size * 0.29,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.28)",
      }} />
    </View>
  );
}

export function FolderWheel({ wheel, size, isDark }: { wheel: WheelState; size: number; isDark: boolean }) {
  const opacityStyle = useAnimatedStyle(() => ({ opacity: wheel.opacity.get() }));
  const positionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: wheel.centerX.get() - size / 2 },
      { translateY: wheel.centerY.get() - size / 2 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, opacityStyle]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(28,28,30,0.48)" }]} />
      <Animated.View style={[styles.wheel, { width: size, height: size }, positionStyle]}>
        <GlassRing wheel={wheel} size={size} isDark={isDark} />
        {TARGETS.map((target) => (
          <WheelSector key={target.id} target={target} wheel={wheel} isDark={isDark} />
        ))}
        {TARGETS.map((target) => (
          <WheelTarget key={target.id} target={target} wheel={wheel} size={size} isDark={isDark} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 5 },
  wheel: { position: "absolute", top: 0, left: 0 },
  target: { position: "absolute", width: 88, height: 64, alignItems: "center", justifyContent: "center", gap: 6 },
  symbol: { width: 32, height: 32 },
  label: { fontSize: 15, fontWeight: "500", textAlign: "center" },
});
