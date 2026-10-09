import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import Animated, {
  measure, ReduceMotion, scrollTo, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue,
  withSpring, type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import type { Folder } from "@/lib/local-store";
import { FOLDER_ROW } from "./folder-row-appearance";

const STEP = FOLDER_ROW.height + FOLDER_ROW.gap;
const SPRING = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } as const;
const SLOT_SPRING = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;

type DragState = {
  order: SharedValue<string[]>;
  initialOrder: SharedValue<string[]>;
  active: SharedValue<string | null>;
  settling: SharedValue<boolean>;
  y: SharedValue<number>;
  startY: SharedValue<number>;
  startScroll: SharedValue<number>;
  startTranslationY: SharedValue<number>;
  pointerY: SharedValue<number>;
  viewportTop: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  maxScroll: SharedValue<number>;
  sectionTop: SharedValue<number>;
};

function updateSlots(drag: DragState) {
  "worklet";
  const order = drag.order.get();
  const from = order.indexOf(drag.active.get() ?? "");
  const to = Math.max(0, Math.min(order.length - 1, Math.round(drag.y.get() / STEP)));
  if (from < 0 || from === to) return;
  const next = [...order];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  drag.order.set(next);
}

function liftFeedback() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function SortableRow({ folder, drag, nativeScroll, scrollRef, dark, width, onSelect, onReorder, onFloatingChange, children }: {
  folder: Folder;
  drag: DragState;
  nativeScroll: NativeGesture;
  scrollRef: ReturnType<typeof useAnimatedRef<ScrollView>>;
  dark: boolean;
  width: number;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onFloatingChange: (id: string | null) => void;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const pan = Gesture.Pan().activateAfterLongPress(1500).maxPointers(1)
    .blocksExternalGesture(nativeScroll)
    .onStart((event) => {
      if (drag.active.get() !== null) return;
      const viewport = measure(scrollRef);
      if (!viewport) return;
      drag.viewportTop.set(viewport.pageY);
      drag.viewportHeight.set(viewport.height);
      drag.initialOrder.set([...drag.order.get()]);
      drag.startY.set(drag.order.get().indexOf(folder.id) * STEP);
      drag.startScroll.set(drag.scrollOffset.get());
      drag.startTranslationY.set(event.translationY);
      drag.pointerY.set(event.absoluteY);
      drag.y.set(drag.startY.get());
      drag.settling.set(false);
      drag.active.set(folder.id);
      scheduleOnRN(onFloatingChange, folder.id);
      scrollTo(scrollRef, 0, drag.scrollOffset.get(), false);
      scheduleOnRN(liftFeedback);
    })
    .onUpdate((event) => {
      if (drag.active.get() !== folder.id || drag.settling.get()) return;
      drag.pointerY.set(event.absoluteY);
      drag.y.set(drag.startY.get() + event.translationY - drag.startTranslationY.get()
        + drag.scrollOffset.get() - drag.startScroll.get());
      updateSlots(drag);
    })
    .onEnd((event) => {
      if (drag.active.get() !== folder.id || drag.settling.get()) return;
      drag.settling.set(true);
      const ids = [...drag.order.get()];
      drag.y.set(withSpring(ids.indexOf(folder.id) * STEP, { ...SPRING, velocity: event.velocityY }, (finished) => {
        if (finished) {
          drag.active.set(null);
          drag.settling.set(false);
          scheduleOnRN(onFloatingChange, null);
        }
      }));
      if (ids.some((id, index) => id !== drag.initialOrder.get()[index])) {
        scheduleOnRN(onReorder, ids);
      }
    })
    .onFinalize((_event, success) => {
      if (success || drag.active.get() !== folder.id || drag.settling.get()) return;
      drag.settling.set(true);
      drag.order.set([...drag.initialOrder.get()]);
      drag.y.set(withSpring(drag.order.get().indexOf(folder.id) * STEP, SPRING, (finished) => {
        if (finished) {
          drag.active.set(null);
          drag.settling.set(false);
          scheduleOnRN(onFloatingChange, null);
        }
      }));
    });
  const tap = Gesture.Tap().onEnd((_event, success) => {
    if (success && drag.active.get() === null) scheduleOnRN(onSelect, folder.id);
  });
  const animatedStyle = useAnimatedStyle(() => {
    const active = drag.active.get() === folder.id;
    return {
      opacity: active ? 0 : 1,
      zIndex: 0,
      transform: [
        { translateY: active ? drag.y.get() : withSpring(drag.order.get().indexOf(folder.id) * STEP, SLOT_SPRING) },
        { scale: withSpring(active && !drag.settling.get() && !reducedMotion ? 1.035 : 1, SLOT_SPRING) },
      ],
    };
  });

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View collapsable={false} style={[styles.row, { width, backgroundColor: FOLDER_ROW.panel[dark ? "dark" : "light"] }, animatedStyle]}
        accessible accessibilityRole="button" accessibilityLabel={folder.name}
        accessibilityHint="길게 누른 뒤 끌어서 폴더 순서를 변경합니다"
        accessibilityActions={[{ name: "activate", label: "폴더 열기" }, { name: "moveUp", label: "위로 이동" }, { name: "moveDown", label: "아래로 이동" }]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action === "activate") { onSelect(folder.id); return; }
          const ids = [...drag.order.get()];
          const from = ids.indexOf(folder.id);
          const to = from + (action === "moveUp" ? -1 : 1);
          if (from < 0 || to < 0 || to >= ids.length) return;
          ids.splice(from, 1);
          ids.splice(to, 0, folder.id);
          onReorder(ids);
        }}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SortableFolders({ folders, width, dark, onSelect, onReorder, renderFolder, children }: {
  folders: Folder[];
  width: number;
  dark: boolean;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  renderFolder: (folder: Folder) => ReactNode;
  children: ReactNode;
}) {
  const scrollRef = useAnimatedRef<ScrollView>();
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const order = useSharedValue(folders.map((folder) => folder.id));
  const initialOrder = useSharedValue<string[]>([]);
  const active = useSharedValue<string | null>(null);
  const settling = useSharedValue(false);
  const y = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const startTranslationY = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const viewportTop = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const maxScroll = useSharedValue(0);
  const sectionTop = useSharedValue(0);
  const [floatingFolderId, setFloatingFolderId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const drag = useMemo<DragState>(() => ({ order, initialOrder, active, settling, y, startY, startScroll,
    startTranslationY, pointerY, viewportTop, viewportHeight, scrollOffset, maxScroll, sectionTop }),
  [order, initialOrder, active, settling, y, startY, startScroll, startTranslationY,
    pointerY, viewportTop, viewportHeight, scrollOffset, maxScroll, sectionTop]);
  const contentHeight = useSharedValue(0);

  useLayoutEffect(() => { order.set(folders.map((folder) => folder.id)); }, [folders, order]);

  const onScroll = useAnimatedScrollHandler((event) => { scrollOffset.set(event.contentOffset.y); });
  useFrameCallback((frame) => {
    if (active.get() === null || settling.get()) return;
    const localY = pointerY.get() - viewportTop.get();
    const edge = Math.min(56, viewportHeight.get() / 4);
    const speed = localY < edge ? -Math.min(1, (edge - localY) / edge)
      : localY > viewportHeight.get() - edge ? Math.min(1, (localY - viewportHeight.get() + edge) / edge) : 0;
    const offset = Math.max(0, Math.min(maxScroll.get(), scrollOffset.get()
      + speed * 260 * Math.min(frame.timeSincePreviousFrame ?? 16, 32) / 1000));
    const delta = offset - scrollOffset.get();
    if (!delta) return;
    scrollOffset.set(offset);
    drag.y.set(drag.y.get() + delta);
    scrollTo(scrollRef, 0, offset, false);
    updateSlots(drag);
  });

  const floatingFolder = folders.find((folder) => folder.id === floatingFolderId);
  const floatingStyle = useAnimatedStyle(() => {
    const activeNow = drag.active.get() === floatingFolderId;
    return {
      top: drag.sectionTop.get() + drag.y.get() - drag.scrollOffset.get(),
      opacity: activeNow ? 1 : 0,
      zIndex: 5,
      shadowOpacity: activeNow ? 0.2 : 0,
      transform: [{ scale: withSpring(activeNow && !drag.settling.get() && !reducedMotion ? 1.035 : 1, SLOT_SPRING) }],
    };
  });

  return (
    <View style={styles.root}>
      <GestureDetector gesture={nativeScroll}>
        <Animated.ScrollView ref={scrollRef} style={styles.scroll} contentInsetAdjustmentBehavior="never"
          removeClippedSubviews={false} onScroll={onScroll} scrollEventThrottle={16}
          onLayout={(event) => {
            viewportHeight.set(event.nativeEvent.layout.height);
            maxScroll.set(Math.max(0, contentHeight.get() - event.nativeEvent.layout.height));
          }}
          onContentSizeChange={(_width, height) => {
            contentHeight.set(height);
            maxScroll.set(Math.max(0, height - viewportHeight.get()));
          }} contentContainerStyle={styles.content}>
          {children}
          <View onLayout={(event) => sectionTop.set(event.nativeEvent.layout.y)}
            style={{ height: Math.max(0, folders.length * STEP - FOLDER_ROW.gap), width }}>
            {folders.map((folder) => (
              <SortableRow key={folder.id} folder={folder} drag={drag} nativeScroll={nativeScroll} scrollRef={scrollRef}
                dark={dark} width={width} onSelect={onSelect} onReorder={onReorder} onFloatingChange={setFloatingFolderId}>
                {renderFolder(folder)}
              </SortableRow>
            ))}
          </View>
        </Animated.ScrollView>
      </GestureDetector>
      {floatingFolder && (
        <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[styles.floatingRow, { width, backgroundColor: FOLDER_ROW.panel[dark ? "dark" : "light"] }, floatingStyle]}>
          <View pointerEvents="none">{renderFolder(floatingFolder)}</View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "visible" },
  scroll: { flex: 1, marginRight: -12 },
  content: { gap: FOLDER_ROW.gap, paddingBottom: 16 },
  row: { position: "absolute", top: 0, left: 0, height: FOLDER_ROW.height, borderRadius: FOLDER_ROW.radius,
    shadowColor: "#000000", shadowOffset: { width: 0, height: 5 }, shadowRadius: 9 },
  floatingRow: { position: "absolute", top: 0, left: 0, height: FOLDER_ROW.height, borderRadius: FOLDER_ROW.radius,
    shadowColor: "#000000", shadowOffset: { width: 0, height: 5 }, shadowRadius: 9 },
});
