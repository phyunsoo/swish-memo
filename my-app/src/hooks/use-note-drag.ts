import { useLayoutEffect, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { cancelAnimation, useAnimatedReaction, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import type { QuickMenuState } from "@/components/folder-quick-menu";
import { menuLayout, menuTargetAt, menuScrollDirection, menuMaxScrollOffset } from "@/components/quick-menu-geometry";
import type { Folder } from "@/lib/local-store";

export type DragOverlayState = {
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
type DragState = DragOverlayState;

export function selectionFeedback() {
  void Haptics.selectionAsync().catch(() => {});
}

export function updateMenuSelection(drag: DragState, folderCount: number) {
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

export function resetDragState(drag: DragState) {
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

export function useNoteDrag({ notes, folders, detailNote, paddingTop, paddingBottom }: {
  notes: { id: number }[];
  folders: Folder[];
  detailNote?: { id: number } | null;
  paddingTop: number;
  paddingBottom: number;
}) {
  const dimensions = useWindowDimensions();
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
  }, [notes, folders, detailNote, dimensions.width, dimensions.height, paddingTop, paddingBottom, drag]);

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

  return drag;
}
