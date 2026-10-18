import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ScrollView } from "react-native";
import { cancelAnimation, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { reorderNoteIds } from "@/lib/note-order";
import { reorderTargetIndex, synchronizeNoteLayouts, type ReorderLayout } from "@/lib/note-reorder-geometry";
import type { SearchScrollTarget } from "@/lib/note-search";

export type ReorderDrag = {
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

export function resetReorderState(reorder: ReorderDrag) {
  "worklet";
  cancelAnimation(reorder.deltaY);
  reorder.holding.set(false);
  reorder.active.set(-1);
  reorder.from.set(-1);
  reorder.target.set(-1);
  reorder.deltaY.set(0);
  reorder.initialOrder.set([]);
}

export function updateReorderPosition(reorder: ReorderDrag) {
  "worklet";
  const delta = reorder.pointerY.get() - reorder.startY.get()
    + reorder.scrollOffset.get() - reorder.startScroll.get();
  reorder.deltaY.set(delta);
  reorder.target.set(reorderTargetIndex(reorder.layouts.get(), reorder.active.get(), reorder.from.get(), delta));
}

export function useNoteReorder({ notes, reordering, onReorder, searchTarget, paddingTop }: {
  notes: { id: number }[];
  reordering: boolean;
  onReorder?: (ids: number[]) => void;
  searchTarget?: SearchScrollTarget | null;
  paddingTop: number;
}) {
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
  useLayoutEffect(() => {
    resetReorderState(reorder);
    publishLayouts();
    const visible = new Set(visibleIds);
    for (const id of rowPositions.current.keys()) {
      if (!visible.has(id)) {
        rowPositions.current.delete(id);
        rowLayouts.current.delete(id);
      }
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

  const registerLayout = (noteId: number, y: number, height: number) => {
    rowPositions.current.set(noteId, y);
    rowLayouts.current.set(noteId, { id: noteId, y, height });
    publishLayouts();
    if (searchTarget?.noteId === noteId) scrollToSearchTarget();
  };

  return { scrollRef, onScroll, scrollToSearchTarget, viewportHeight, contentHeight, registerLayout, reorder, finishReorder };
}
