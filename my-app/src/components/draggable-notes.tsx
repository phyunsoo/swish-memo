import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, LinearTransition, measure, ReduceMotion, scrollTo, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useAnimatedReaction, useFrameCallback, useSharedValue, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { FolderQuickMenu, type QuickMenuState } from "./folder-quick-menu";
import { menuLayout, menuTargetAt, menuScrollDirection, menuMaxScrollOffset } from "./quick-menu-geometry";
import type { Folder } from "@/lib/local-store";
import type { SearchScrollTarget } from "@/lib/note-search";
import { reorderNoteIds } from "@/lib/note-order";
import { reorderTargetIndex, reorderDestinationOffset, synchronizeNoteLayouts, type ReorderLayout } from "@/lib/note-reorder-geometry";

import { NOTE_TEXT_SIZE } from "@/lib/note-typography";

const SPRING = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const FADE = {
  duration: 150,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.System,
};
const NOTE_REFLOW = LinearTransition.duration(400)
  .easing(Easing.bezier(0.23, 1, 0.32, 1))
  .reduceMotion(ReduceMotion.System);
type Note = { id: number; text: string; state: "draft" | "saved" | "trash" };
type ReorderDrag = {
  active: SharedValue<number>;
  from: SharedValue<number>;
  target: SharedValue<number>;
  deltaY: SharedValue<number>;
  startY: SharedValue<number>;
  holding: SharedValue<boolean>;
  pointerY: SharedValue<number>;
  startScroll: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  viewportTop: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  layouts: SharedValue<ReorderLayout[]>;
  initialOrder: SharedValue<number[]>;
};

function resetReorderState(reorder: ReorderDrag) {
  "worklet";
  cancelAnimation(reorder.deltaY);
  reorder.holding.set(false);
  reorder.active.set(-1);
  reorder.from.set(-1);
  reorder.target.set(-1);
  reorder.deltaY.set(0);
  reorder.initialOrder.set([]);
}

function updateReorderPosition(reorder: ReorderDrag) {
  "worklet";
  const delta = reorder.pointerY.get() - reorder.startY.get()
    + reorder.scrollOffset.get() - reorder.startScroll.get();
  reorder.deltaY.set(delta);
  reorder.target.set(reorderTargetIndex(reorder.layouts.get(), reorder.active.get(), reorder.from.get(), delta));
}

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

function ReorderRow({ noteId, index, reordering, reorder, onLayout, children }: {
  noteId: number;
  index: number;
  reordering: boolean;
  reorder: ReorderDrag;
  onLayout: (y: number, height: number) => void;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    // React has already moved this row to its final layout after a drop.
    // Remove the temporary drag offset immediately instead of animating it again.
    if (!reordering || reorder.active.get() === -1 || reorder.initialOrder.get()[index] !== noteId) {
      return { zIndex: 0, transform: [{ translateY: 0 }] };
    }
    if (reorder.active.get() === noteId) {
      return { zIndex: 10, transform: [{ translateY: reorder.deltaY.get() }] };
    }
    const from = reorder.from.get();
    const target = reorder.target.get();
    const draggedHeight = reorder.layouts.get()[from]?.height ?? 0;
    const offset = from < target && index > from && index <= target ? -draggedHeight
      : from > target && index >= target && index < from ? draggedHeight : 0;
    return { zIndex: 0, transform: [{ translateY: withSpring(offset, SPRING) }] };
  });

  return (
    <Animated.View layout={reordering ? undefined : NOTE_REFLOW}
      onLayout={(event) => onLayout(event.nativeEvent.layout.y, event.nativeEvent.layout.height)} style={style}>
      {children}
    </Animated.View>
  );
}

function ReorderHandle({ noteId, nativeScroll, scrollRef, reorder, onDrop }: {
  noteId: number;
  nativeScroll: NativeGesture;
  scrollRef: ReturnType<typeof useAnimatedRef<ScrollView>>;
  reorder: ReorderDrag;
  onDrop: (noteId: number, targetIndex: number) => void;
}) {
  const gesture = Gesture.Pan().minDistance(1).maxPointers(1).blocksExternalGesture(nativeScroll)
    .onBegin((event) => {
      reorder.startY.set(event.absoluteY);
      reorder.startScroll.set(reorder.scrollOffset.get());
    })
    .onStart((event) => {
      if (reorder.active.get() !== -1) return;
      const from = reorder.layouts.get().findIndex((item) => item.id === noteId);
      if (from < 0) return;
      const viewport = measure(scrollRef);
      if (!viewport) return;
      reorder.viewportTop.set(viewport.pageY);
      reorder.viewportHeight.set(viewport.height);
      // Avoid a callback that React Compiler can hoist outside this worklet.
      const initialOrder: number[] = [];
      for (const item of reorder.layouts.get()) initialOrder.push(item.id);
      reorder.initialOrder.set(initialOrder);
      reorder.from.set(from);
      reorder.pointerY.set(event.absoluteY);
      reorder.active.set(noteId);
      reorder.holding.set(true);
      updateReorderPosition(reorder);
    })
    .onUpdate((event) => {
      if (reorder.active.get() !== noteId) return;
      reorder.pointerY.set(event.absoluteY);
      updateReorderPosition(reorder);
    })
    .onEnd((event) => {
      if (reorder.active.get() !== noteId) return;
      reorder.pointerY.set(event.absoluteY);
      updateReorderPosition(reorder);
      reorder.holding.set(false);
      const from = reorder.from.get();
      const layouts = reorder.layouts.get();
      const delta = reorder.deltaY.get();
      const target = reorderTargetIndex(layouts, noteId, from, delta);
      reorder.target.set(target);
      const destination = reorderDestinationOffset(layouts, from, target);
      reorder.deltaY.set(withSpring(destination, SPRING, (finished) => {
        if (!finished || reorder.active.get() !== noteId) return;
        if (target === from) {
          resetReorderState(reorder);
        } else {
          scheduleOnRN(onDrop, noteId, target);
        }
      }));
      scheduleOnRN(selectionFeedback);
    })
    .onFinalize((_event, success) => {
      if (!success && reorder.active.get() === noteId) {
        resetReorderState(reorder);
      }
    });

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} accessible accessibilityRole="button" accessibilityLabel="드래그하여 메모 순서 변경" style={styles.reorderHandle}>
        <Text style={styles.reorderGlyph}>≡</Text>
      </View>
    </GestureDetector>
  );
}

export function DraggableNotes<T extends Note>({ notes, folders, renderNote, children, header, paddingTop, paddingBottom, isDark, isTrashView, editing, reordering = false, onDrop, onReorder, searchTarget, noteFontSize = NOTE_TEXT_SIZE.default }: {
  notes: T[];
  folders: Folder[];
  renderNote: (note: T, reorderHandle?: ReactNode) => ReactNode;
  children: ReactNode;
  header?: ReactNode;
  paddingTop: number;
  paddingBottom: number;
  isDark: boolean;
  isTrashView: boolean;
  editing: boolean;
  reordering?: boolean;
  onDrop: (noteId: number, targetId: number) => void;
  onReorder?: (ids: number[]) => void;
  noteFontSize?: number;
  searchTarget?: SearchScrollTarget | null;
}) {
  const dimensions = useWindowDimensions();
  const scrollRef = useAnimatedRef<ScrollView>();
  const rowPositions = useRef(new Map<number, number>());
  const rowLayouts = useRef(new Map<number, ReorderLayout>());
  const visibleIds = useMemo(() => notes.map((note) => note.id), [notes]);
  const reorderActive = useSharedValue(-1);
  const reorderFrom = useSharedValue(-1);
  const reorderTarget = useSharedValue(-1);
  const reorderDeltaY = useSharedValue(0);
  const reorderStartY = useSharedValue(0);
  const reorderHolding = useSharedValue(false);
  const reorderPointerY = useSharedValue(0);
  const reorderStartScroll = useSharedValue(0);
  const listScrollOffset = useSharedValue(0);
  const viewportTop = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const reorderLayouts = useSharedValue<ReorderLayout[]>([]);
  const reorderInitialOrder = useSharedValue<number[]>([]);
  const reorder = useMemo<ReorderDrag>(() => ({
    active: reorderActive, from: reorderFrom, target: reorderTarget,
    deltaY: reorderDeltaY, startY: reorderStartY, layouts: reorderLayouts,
    holding: reorderHolding, pointerY: reorderPointerY, startScroll: reorderStartScroll,
    scrollOffset: listScrollOffset, viewportTop, viewportHeight,
    initialOrder: reorderInitialOrder,
  }), [reorderActive, reorderFrom, reorderTarget, reorderDeltaY, reorderStartY, reorderLayouts,
    reorderHolding, reorderPointerY, reorderStartScroll, listScrollOffset, viewportTop, viewportHeight, reorderInitialOrder]);
  const onScroll = useAnimatedScrollHandler((event) => {
    listScrollOffset.set(event.contentOffset.y);
    if (reorder.holding.get()) updateReorderPosition(reorder);
  });
  const finishReorder = useCallback((noteId: number, targetIndex: number) => {
    const ids = reorderNoteIds(visibleIds, noteId, targetIndex);
    if (onReorder && ids !== visibleIds) onReorder(ids);
    else resetReorderState(reorder);
  }, [visibleIds, onReorder, reorder]);
  const publishLayouts = useCallback(() => {
    reorder.layouts.set(synchronizeNoteLayouts(rowLayouts.current, visibleIds));
  }, [visibleIds, reorder]);
  const scrollToSearchTarget = useCallback(() => {
    if (!searchTarget) return;
    const y = rowPositions.current.get(searchTarget.noteId);
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y + searchTarget.offset - paddingTop - 16), animated: true });
  }, [searchTarget, paddingTop, scrollRef]);
  useEffect(() => { scrollToSearchTarget(); }, [scrollToSearchTarget]);
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

  useLayoutEffect(() => {
    resetReorderState(reorder);
    publishLayouts();
    const visible = new Set(visibleIds);
    for (const id of rowPositions.current.keys()) {
      if (!visible.has(id)) rowPositions.current.delete(id);
    }
  }, [visibleIds, reordering, reorder, publishLayouts]);

  useFrameCallback((frame) => {
    if (!reorder.holding.get()) return;
    const height = viewportHeight.get();
    if (height <= 0) return;
    const localY = reorder.pointerY.get() - viewportTop.get();
    const edge = Math.min(80, height / 4);
    const speed = localY < edge ? -Math.min(1, (edge - localY) / edge)
      : localY > height - edge ? Math.min(1, (localY - height + edge) / edge) : 0;
    if (speed === 0) return;
    const offset = Math.max(0, Math.min(Math.max(0, contentHeight.get() - height),
      listScrollOffset.get() + speed * 260 * Math.min(frame.timeSincePreviousFrame ?? 16, 32) / 1000));
    if (offset !== listScrollOffset.get()) scrollTo(scrollRef, 0, offset, false);
  });

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
        <Animated.ScrollView ref={scrollRef} style={styles.container}
          contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onScroll={onScroll} scrollEventThrottle={16}
          onLayout={(event) => viewportHeight.set(event.nativeEvent.layout.height)}
          onContentSizeChange={(_width, height) => {
            contentHeight.set(height);
            scrollToSearchTarget();
          }}
          removeClippedSubviews={false}
          contentContainerStyle={{ flexGrow: 1, paddingTop, paddingBottom }}>
          {header}
          {notes.map((note, index) => (
            <ReorderRow key={note.id} noteId={note.id} index={index} reordering={reordering} reorder={reorder}
              onLayout={(y, height) => {
                rowPositions.current.set(note.id, y);
                rowLayouts.current.set(note.id, { id: note.id, y, height });
                publishLayouts();
                if (searchTarget?.noteId === note.id) scrollToSearchTarget();
              }}>
            {reordering ? renderNote(note, <ReorderHandle noteId={note.id} nativeScroll={nativeScroll}
              scrollRef={scrollRef} reorder={reorder} onDrop={finishReorder} />) : <DraggableRow note={note} drag={drag} nativeScroll={nativeScroll}
              rootRef={rootRef} paddingTop={paddingTop} paddingBottom={paddingBottom} folderCount={folders.length} disabled={editing} onDrop={onDrop}>
              {renderNote(note)}
            </DraggableRow>}
            </ReorderRow>
          ))}
          <Animated.View layout={reordering ? undefined : NOTE_REFLOW}>
            {children}
          </Animated.View>
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
  reorderHandle: { width: 120, height: 120, margin: -30, alignItems: "center", justifyContent: "center" },
  reorderGlyph: { fontSize: 24, lineHeight: 28, color: "#8E8E93" },
});
