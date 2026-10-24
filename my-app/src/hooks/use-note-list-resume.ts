import { useEffect } from "react";
import { AppState, type ScrollView } from "react-native";
import type { RefObject } from "react";
import type { DragOverlayState } from "./use-note-drag";
import { resetDragState } from "./use-note-drag";
import { resetReorderState, type ReorderDrag } from "./use-note-reorder";
import type { SharedValue } from "react-native-reanimated";

/** Recover transient gestures and native offset while preserving mounted inputs. */
export function useNoteListResume({ drag, reorder, scrollRef, contentHeight, viewportHeight, reveal }: {
  drag: DragOverlayState;
  reorder: ReorderDrag;
  scrollRef: RefObject<ScrollView | null>;
  contentHeight: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  reveal: () => void;
}) {
  useEffect(() => {
    let previous = AppState.currentState;
    let frame: number | null = null;
    const subscription = AppState.addEventListener("change", (state) => {
      const resumed = previous !== "active" && state === "active";
      previous = state;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (!resumed) return;
      resetDragState(drag);
      resetReorderState(reorder);
      const offset = reorder.scrollOffset.get();
      frame = requestAnimationFrame(() => {
        frame = null;
        scrollRef.current?.scrollTo({ y: Math.max(0, Math.min(offset, contentHeight.get() - viewportHeight.get())), animated: false });
        reveal();
      });
    });
    return () => {
      subscription.remove();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [drag, reorder, scrollRef, contentHeight, viewportHeight, reveal]);
}
