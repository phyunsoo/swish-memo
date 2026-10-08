import NativeWheelRing, { hasNativeWheelRing } from "../../modules/liquid-glass-wheel/src/LiquidGlassWheelView";
import type { WheelRingViewProps } from "../../modules/liquid-glass-wheel/src/LiquidGlassWheel.types";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { MaskedView } from "@expo/ui/community/masked-view";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const ACCENT = "#E7A000";
const DELETE_COLOR = "#FF3B30";
const RING_COLOR = "rgba(255,255,255,0.60)";
const BACKDROP_LIGHT = "rgba(28,28,30,0.60)";
const BACKDROP_DARK = "rgba(0,0,0,0.60)";
const SELECTION_OPACITY = 0.30;
const TEXT_LIGHT = "#29292E";
const TEXT_DARK = "#F5F5F7";
const DELETE_TEXT = "#000000";
const AnimatedNativeWheelRing = NativeWheelRing ? Animated.createAnimatedComponent(NativeWheelRing) : null;
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

// Visuals and hit testing share the four sector boundaries.
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

// SVG geometry is fixed, so create each source once instead of on every render.
const SECTOR_SOURCES = Object.fromEntries(
  TARGETS.map((target) => [target.id, sectorSource(target.start, target.end, "#FFFFFF")]),
);

function selectionColor(target: Target) {
  return target.id === 1 ? DELETE_COLOR : ACCENT;
}

function WheelSector({ target, wheel }: {
  target: Target;
  wheel: WheelState;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(wheel.selected.get() === target.id ? 1 : 0, FEEDBACK),
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image source={SECTOR_SOURCES[target.id]} contentFit="fill" tintColor={selectionColor(target)}
        style={[StyleSheet.absoluteFill, { opacity: SELECTION_OPACITY }]} />
    </Animated.View>
  );
}

function WheelTarget({ target, wheel, size, isDark }: {
  target: Target;
  wheel: WheelState;
  size: number;
  isDark: boolean;
}) {
  const selectedColor = selectionColor(target);
  const baseColor = target.id === 1 ? DELETE_TEXT : isDark ? TEXT_DARK : TEXT_LIGHT;
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

function WheelRing({ size }: { size: number }) {
  const ringShape = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: size * 0.21,
  };

  return (
    <View style={{ width: size, height: size }}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={<View style={[ringShape, { borderColor: "#FFFFFF" }]} />}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: RING_COLOR }]} />
      </MaskedView>
    </View>
  );
}

function WheelContents({ wheel, size, isDark }: { wheel: WheelState; size: number; isDark: boolean }) {
  const opacityStyle = useAnimatedStyle(() => ({ opacity: wheel.opacity.get() }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, opacityStyle]}>
      {TARGETS.map((target) => <WheelSector key={target.id} target={target} wheel={wheel} />)}
      {TARGETS.map((target) => <WheelTarget key={target.id} target={target} wheel={wheel} size={size} isDark={isDark} />)}
    </Animated.View>
  );
}

export function FolderWheel({ wheel, size, isDark }: { wheel: WheelState; size: number; isDark: boolean }) {
  const opacityStyle = useAnimatedStyle(() => ({ opacity: wheel.opacity.get() }));
  const nativeProps = useAnimatedProps<WheelRingViewProps>(() => ({
    visible: wheel.opacity.get() > 0.01,
  }));
  const backdropVisible = useDerivedValue(() => wheel.opacity.get() > 0.01);
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(backdropVisible.get() ? 1 : 0, {
      duration: backdropVisible.get() ? 250 : 0,
      easing: FEEDBACK.easing,
      reduceMotion: ReduceMotion.System,
    }),
  }));
  const positionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: wheel.centerX.get() - size / 2 },
      { translateY: wheel.centerY.get() - size / 2 },
    ],
  }));
  return (
    <>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[styles.overlay, backdropStyle, {
          backgroundColor: isDark ? BACKDROP_DARK : BACKDROP_LIGHT,
        }]} />
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        collapsable={false} style={styles.overlay}>
        <Animated.View collapsable={false} style={[styles.wheel, { width: size, height: size }, positionStyle]}>
          {hasNativeWheelRing && AnimatedNativeWheelRing ? (
            <AnimatedNativeWheelRing animatedProps={nativeProps} visible={false}
              pointerEvents="none" style={{ width: size, height: size }} />
          ) : (
            <Animated.View style={[StyleSheet.absoluteFill, opacityStyle]}>
              <WheelRing size={size} />
            </Animated.View>
          )}
          <WheelContents wheel={wheel} size={size} isDark={isDark} />
        </Animated.View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 5 },
  wheel: { position: "absolute", top: 0, left: 0 },
  target: { position: "absolute", width: 88, height: 64, alignItems: "center", justifyContent: "center", gap: 6 },
  symbol: { width: 32, height: 32 },
  label: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});
