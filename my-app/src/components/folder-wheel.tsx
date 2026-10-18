import NativeWheelRing, { hasNativeWheelRing } from "../../modules/liquid-glass-wheel/src/LiquidGlassWheelView";
import type { WheelRingViewProps } from "../../modules/liquid-glass-wheel/src/LiquidGlassWheel.types";
import { StyleSheet, View } from "react-native";
import type { Folder } from "@/lib/local-store";
import { folderSymbol } from "@/lib/folder-icons";
import { folderColorFor, folderIconTint } from "@/lib/folder-colors";
import { FOLDER_ROW } from "./folder-row-appearance";
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
  kind: "folder" | "trash";
  color?: string;
  titleColor?: string;
  iconColor?: string;
};

const TRASH_TITLE = "삭제";

function folderSector(index: number, folderCount: number) {
  const slotCount = folderCount + 1;
  const sectorSize = 360 / slotCount;
  const start = sectorSize / 2;
  return {
    start: start + index * sectorSize,
    end: start + (index + 1) * sectorSize,
  };
}

function targetsFor(folders: Folder[], isDark: boolean): Target[] {
  const slotSize = 360 / (folders.length + 1);
  const targets: Target[] = folders.map((folder, index): Target => ({
      id: index,
      title: folder.name,
      symbol: folderSymbol(folder.kind === "todo" ? "checklist" : folder.icon ?? "folder"),
      ...folderSector(index, folders.length),
      kind: "folder",
      color: folder.kind === "custom" ? folderIconTint(folder.color, isDark) : undefined,
      titleColor: folder.kind === "custom" ? folderColorFor(folder.color, isDark) : undefined,
      iconColor: folder.kind === "todo" ? FOLDER_ROW.todoIcon[isDark ? "dark" : "light"] : undefined,
    }));
  return [
    { id: folders.length, title: TRASH_TITLE, symbol: folderSymbol("trash"), start: 360 - slotSize / 2, end: 360 + slotSize / 2, kind: "trash" },
    ...targets,
  ];
}

export function wheelTargetAt(x: number, y: number, centerX: number, centerY: number, size: number, folderCount: number) {
  "worklet";
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < size * 0.29 || distance > size / 2 + 16) return -1;
  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  const slotSize = 360 / (folderCount + 1);
  if (angle < slotSize / 2 || angle >= 360 - slotSize / 2) return folderCount;
  return Math.floor((angle - slotSize / 2) / slotSize);
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

function selectionColor(target: Target) {
  return target.color ?? (target.kind === "trash" ? DELETE_COLOR : ACCENT);
}

function WheelSector({ target, wheel }: {
  target: Target;
  wheel: WheelState;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(wheel.selected.get() === target.id ? 1 : 0, FEEDBACK),
  }));
  const source = sectorSource(target.start, target.end, "#FFFFFF");

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image source={source} contentFit="fill" tintColor={selectionColor(target)}
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
  const isTrash = target.kind === "trash";
  const baseColor = target.color ?? (isTrash ? DELETE_TEXT : isDark ? TEXT_DARK : TEXT_LIGHT);
  const radians = (target.start + target.end) / 2 * Math.PI / 180;
  const radius = size * 0.39;
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: withTiming(wheel.selected.get() === target.id ? 1 : 0, FEEDBACK),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: wheel.selected.get() === target.id ? target.titleColor ?? selectedColor : target.titleColor ?? baseColor,
    opacity: 1,
  }));

  return (
      <Animated.View style={[styles.target, {
        left: size / 2 + radius * Math.sin(radians) - 44,
        top: size / 2 - radius * Math.cos(radians) - 32,
      }]}>
        <View style={styles.symbol}>
          <SymbolView name={target.symbol} tintColor={target.iconColor ?? baseColor} size={30} weight="regular" style={styles.symbol} />
          <Animated.View style={[StyleSheet.absoluteFill, highlightStyle]}>
            <SymbolView name={target.symbol} tintColor={target.iconColor ?? selectedColor} size={30} weight="regular" style={styles.symbol} />
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

function WheelContents({ wheel, size, isDark, folders }: { wheel: WheelState; size: number; isDark: boolean; folders: Folder[] }) {
  const opacityStyle = useAnimatedStyle(() => ({ opacity: wheel.opacity.get() }));
  const targets = targetsFor(folders, isDark);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, opacityStyle]}>
      {targets.map((target) => (
        <View key={`${target.kind}-${target.id}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <WheelSector target={target} wheel={wheel} />
          <WheelTarget target={target} wheel={wheel} size={size} isDark={isDark} />
        </View>
      ))}
    </Animated.View>
  );
}

export function FolderWheel({ wheel, size, isDark, folders }: { wheel: WheelState; size: number; isDark: boolean; folders: Folder[] }) {
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
          <WheelContents wheel={wheel} size={size} isDark={isDark} folders={folders} />
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
