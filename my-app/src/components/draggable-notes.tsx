import { useLayoutEffect, useMemo, type ReactNode } from "react";
import { Keyboard, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, measure, ReduceMotion, useAnimatedRef,
  useAnimatedStyle, useAnimatedReaction, useFrameCallback, useSharedValue, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { FolderQuickMenu, type QuickMenuState } from "./folder-quick-menu";
import { menuLayout, menuTargetAt, menuScrollDirection, menuMaxScrollOffset } from "./quick-menu-geometry";
import type { Folder } from "@/lib/local-store";

import { NOTE_TEXT_SIZE } from "@/lib/note-typography";

const SPRING = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const FADE = {
  duration: 150,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.System,
};
type Note = { id: number; text: string; state: "draft" | "saved" | "trash" };
type DragState = {
  active: SharedValue<number>;
  settling: SharedValue<boolean>;
  menu: QuickMenuState;
  scrollDirection: SharedValue<number>;
  edgeElapsed: SharedValue<number>;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  rootX: SharedValue<number>;
  rootY: SharedValue<number>;
  cardOpacity: SharedValue<number>;
  previewOpacity: SharedValue<number>;
  previewScaleX: SharedValue<number>;
  previewScaleY: SharedValue<number>;
};

function selectionFeedback() {
  void Haptics.selectionAsync().catch(() => {});
}

function startFeedback() {
  Keyboard.dismiss();
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function updateMenuSelection(drag: DragState, folderCount: number) {
  "worklet";
  const x = drag.fingerX.get();
  const y = drag.fingerY.get();
  const layout = drag.menu.layout.get();
  const offset = drag.menu.scrollOffset.get();
  const previousDirection = drag.scrollDirection.get();
  const direction = menuScrollDirection(x, y, layout, offset, folderCount, previousDirection);
  if (direction !== previousDirection) drag.edgeElapsed.set(0);
  drag.scrollDirection.set(direction);
  drag.menu.selected.set(direction !== 0 ? -1 : menuTargetAt(x, y, layout, offset, folderCount));
}

function resetDragState(drag: DragState) {
  "worklet";
  cancelAnimation(drag.cardOpacity);
  cancelAnimation(drag.previewOpacity);
  cancelAnimation(drag.menu.opacity);
  drag.active.set(-1);
  drag.settling.set(false);
  drag.cardOpacity.set(1);
  drag.previewOpacity.set(0);
  drag.menu.opacity.set(0);
  drag.menu.selected.set(-1);
  drag.scrollDirection.set(0);
  drag.edgeElapsed.set(0);
  drag.menu.scrollOffset.set(0);
}

function DraggableRow({ note, drag, nativeScroll, rootRef, paddingTop, paddingBottom, folderCount, disabled, onDrop, children }: {
  note: Note;
  drag: DragState;
  nativeScroll: NativeGesture;
  rootRef: ReturnType<typeof useAnimatedRef<View>>;
  paddingTop: number;
  paddingBottom: number;
  folderCount: number;
  disabled: boolean;
  onDrop: (noteId: number, targetId: number) => void;
  children: ReactNode;
}) {
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(400)
    .maxPointers(1)
    .blocksExternalGesture(nativeScroll)
    .onStart((event) => {
      if (drag.active.get() !== -1) return;
      const root = measure(rootRef);
      if (!root) return;
      drag.rootX.set(root.pageX);
      drag.rootY.set(root.pageY);
      drag.menu.layout.set(menuLayout(event.absoluteX - root.pageX, event.absoluteY - root.pageY,
        root.width, root.height, paddingTop, paddingBottom, folderCount));
      drag.menu.scrollOffset.set(0);
      drag.scrollDirection.set(0);
      drag.edgeElapsed.set(0);
      drag.menu.selected.set(-1);
      drag.menu.opacity.set(withTiming(1, FADE));
      drag.fingerX.set(event.absoluteX - root.pageX);
      drag.fingerY.set(event.absoluteY - root.pageY);
      drag.previewScaleX.set(0.97);
      drag.previewScaleY.set(0.97);
      drag.cardOpacity.set(0);
      drag.previewOpacity.set(1);
      drag.previewScaleX.set(withSpring(1, SPRING));
      drag.previewScaleY.set(withSpring(1, SPRING));
      drag.active.set(note.id);
      scheduleOnRN(startFeedback);
    })
    .onUpdate((event) => {
      if (drag.active.get() !== note.id || drag.settling.get()) return;
      drag.fingerX.set(event.absoluteX - drag.rootX.get());
      drag.fingerY.set(event.absoluteY - drag.rootY.get());
      updateMenuSelection(drag, folderCount);
    })
    .onEnd((event) => {
      if (drag.active.get() !== note.id) return;
      const target = drag.scrollDirection.get() !== 0 ? -1 : menuTargetAt(event.absoluteX - drag.rootX.get(), event.absoluteY - drag.rootY.get(),
        drag.menu.layout.get(), drag.menu.scrollOffset.get(), folderCount);
      drag.scrollDirection.set(0);
      drag.edgeElapsed.set(0);
      if (target !== -1) scheduleOnRN(onDrop, note.id, target);
      drag.settling.set(true);
      // Crossfade the fixed preview back to the original card.
      cancelAnimation(drag.previewScaleX);
      cancelAnimation(drag.previewScaleY);
      drag.previewOpacity.set(withTiming(0, FADE));
      cancelAnimation(drag.menu.opacity);
      drag.menu.opacity.set(0);
      drag.cardOpacity.set(withTiming(1, FADE, (finished) => {
        if (finished) {
          drag.active.set(-1);
          drag.settling.set(false);
          drag.menu.selected.set(-1);
        }
      }));
    })
    .onFinalize((_event, success) => {
      if (!success && drag.active.get() === note.id) {
        resetDragState(drag);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    opacity: drag.active.get() === note.id ? drag.cardOpacity.get() : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        style={rowStyle}
        accessibilityHint="길게 누른 뒤 폴더 메뉴로 끌고 손을 떼면 이동합니다"
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function DragPreview({ note, drag, isDark, noteFontSize }: { note: Note; drag: DragState; isDark: boolean; noteFontSize: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: drag.active.get() === note.id ? drag.previewOpacity.get() : 0,
    width: drag.menu.layout.get().width,
    height: drag.menu.layout.get().previewHeight,
    transform: [
      { translateX: drag.menu.layout.get().left },
      { translateY: drag.menu.layout.get().previewTop },
      { scaleX: drag.previewScaleX.get() },
      { scaleY: drag.previewScaleY.get() },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.preview, { backgroundColor: isDark ? "#242423" : "#FFFFFF", borderColor: isDark ? "#4A4A4D" : "#CED1D6" }, style]}>
      <Text numberOfLines={2} style={[styles.previewText, { color: isDark ? "#F5F5F2" : "#171717", fontSize: noteFontSize * 16 / NOTE_TEXT_SIZE.default, lineHeight: noteFontSize * 23 / NOTE_TEXT_SIZE.default }]}>
        {note.text.trim().slice(0, 100)}
      </Text>
      <Text style={[styles.ellipsis, { color: isDark ? "#A1A1A6" : "#77777C" }]}>…</Text>
    </Animated.View>
  );
}

export function DraggableNotes<T extends Note>({ notes, folders, renderNote, children, header, paddingTop, paddingBottom, isDark, isTrashView, editing, onDrop, noteFontSize = NOTE_TEXT_SIZE.default }: {
  notes: T[];
  folders: Folder[];
  renderNote: (note: T) => ReactNode;
  children: ReactNode;
  header?: ReactNode;
  paddingTop: number;
  paddingBottom: number;
  isDark: boolean;
  isTrashView: boolean;
  editing: boolean;
  onDrop: (noteId: number, targetId: number) => void;
  noteFontSize?: number;
}) {
  const dimensions = useWindowDimensions();
  const rootRef = useAnimatedRef<View>();
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const menuOpacity = useSharedValue(0);
  const selected = useSharedValue(-1);
  const layout = useSharedValue(menuLayout(dimensions.width / 2, dimensions.height / 2,
    dimensions.width, dimensions.height, paddingTop, paddingBottom, folders.length));
  const scrollOffset = useSharedValue(0);
  const scrollDirection = useSharedValue(0);
  const edgeElapsed = useSharedValue(0);
  const menu = useMemo<QuickMenuState>(
    () => ({ opacity: menuOpacity, selected, layout, scrollOffset }),
    [menuOpacity, selected, layout, scrollOffset],
  );
  const active = useSharedValue(-1);
  const settling = useSharedValue(false);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const previewOpacity = useSharedValue(0);
  const previewScaleX = useSharedValue(1);
  const previewScaleY = useSharedValue(1);
  const drag = useMemo<DragState>(
    () => ({ active, settling, menu, scrollDirection, edgeElapsed, fingerX, fingerY, rootX, rootY,
      cardOpacity, previewOpacity, previewScaleX, previewScaleY }),
    [active, settling, menu, scrollDirection, edgeElapsed, fingerX, fingerY, rootX, rootY,
      cardOpacity, previewOpacity, previewScaleX, previewScaleY],
  );

  useLayoutEffect(() => {
    resetDragState(drag);
  }, [notes, folders, dimensions.width, dimensions.height, paddingTop, paddingBottom, drag]);

  // The UI thread keeps scrolling even when the finger stays still at an edge.
  useFrameCallback((frame) => {
    if (active.get() === -1 || settling.get() || scrollDirection.get() === 0) return;
    const elapsed = Math.min(frame.timeSincePreviousFrame ?? 0, 32);
    edgeElapsed.set(edgeElapsed.get() + elapsed);
    if (edgeElapsed.get() < 300) return;
    const maxOffset = menuMaxScrollOffset(folders.length, layout.get().listHeight);
    scrollOffset.set(Math.max(0, Math.min(maxOffset,
      scrollOffset.get() + scrollDirection.get() * 220 * elapsed / 1000)));
    updateMenuSelection(drag, folders.length);
  });

  useAnimatedReaction(
    () => active.get() !== -1 && !settling.get() ? selected.get() : -1,
    (target, previous) => {
      if (target !== -1 && target !== previous) scheduleOnRN(selectionFeedback);
    },
  );

  return (
    <Animated.View ref={rootRef} collapsable={false} style={styles.container}>
      <GestureDetector gesture={nativeScroll}>
        <Animated.ScrollView style={styles.container}
          contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          removeClippedSubviews={false}
          contentContainerStyle={{ flexGrow: 1, paddingTop, paddingBottom }}>
          {header}
          {notes.map((note) => (
            <DraggableRow key={note.id} note={note} drag={drag} nativeScroll={nativeScroll}
              rootRef={rootRef} paddingTop={paddingTop} paddingBottom={paddingBottom} folderCount={folders.length} disabled={editing} onDrop={onDrop}>
              {renderNote(note)}
            </DraggableRow>
          ))}
          {children}
        </Animated.ScrollView>
      </GestureDetector>
      <FolderQuickMenu menu={menu} isDark={isDark} folders={folders} isTrashView={isTrashView} />
      {notes.map((note) => <DragPreview key={note.id} note={note} drag={drag} isDark={isDark} noteFontSize={noteFontSize} />)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  preview: { position: "absolute", left: 0, top: 0,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, zIndex: 10,
    shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  previewText: { fontSize: 16, lineHeight: 23, flexShrink: 1 },
  ellipsis: { fontSize: 22, lineHeight: 24, marginTop: "auto" },
});
