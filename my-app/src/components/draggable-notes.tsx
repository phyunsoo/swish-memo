import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, LinearTransition, measure, ReduceMotion, useAnimatedRef,
  useAnimatedStyle, withSpring, withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { notePhotoUri, type NotePhoto } from "@/lib/note-photos";
import { FolderQuickMenu } from "./folder-quick-menu";
import { menuLayout, menuTargetAt } from "./quick-menu-geometry";
import type { Folder } from "@/lib/local-store";
import type { SearchScrollTarget } from "@/lib/note-search";
import { reorderTargetIndex, reorderDestinationOffset } from "@/lib/note-reorder-geometry";

import { useNoteDrag, resetDragState, updateMenuSelection, selectionFeedback, type DragOverlayState } from "@/hooks/use-note-drag";
import { useNoteReorder, resetReorderState, updateReorderPosition, type ReorderDrag } from "@/hooks/use-note-reorder";
import { NOTE_TEXT_SIZE } from "@/lib/note-typography";
import { EditorViewportContext, useEditorViewport } from "@/hooks/use-editor-viewport";
import { useNoteListResume } from "@/hooks/use-note-list-resume";

export type { DragOverlayState } from "@/hooks/use-note-drag";
type DragState = DragOverlayState;

const SPRING = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const FADE = {
  duration: 150,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.System,
};
const NOTE_REFLOW = LinearTransition.duration(400)
  .easing(Easing.bezier(0.23, 1, 0.32, 1))
  .reduceMotion(ReduceMotion.System);
type Note = { id: number; text: string; photos?: NotePhoto[]; state: "draft" | "saved" | "trash" };
function startFeedback() {
  Keyboard.dismiss();
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function DraggableRow({ note, drag, nativeScroll, externalNativeScroll, rootRef, paddingTop, paddingBottom, folderCount, disabled, onDrop, children }: {
  note: Note;
  drag: DragState;
  nativeScroll: NativeGesture;
  externalNativeScroll?: NativeGesture;
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
    .blocksExternalGesture(...(externalNativeScroll ? [nativeScroll, externalNativeScroll] : [nativeScroll]))
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
      { translateX: drag.rootX.get() + drag.menu.layout.get().left },
      { translateY: drag.rootY.get() + drag.menu.layout.get().previewTop },
      { scaleX: drag.previewScaleX.get() },
      { scaleY: drag.previewScaleY.get() },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.preview, { backgroundColor: isDark ? "#242423" : "#FFFFFF", borderColor: isDark ? "#4A4A4D" : "#CED1D6" }, style]}>
      <View style={styles.previewContent}>
        {note.photos?.[0] && <Image source={notePhotoUri(note.photos[0])} contentFit="cover" style={styles.previewPhoto} />}
        <Text numberOfLines={2} style={[styles.previewText, { color: isDark ? "#F5F5F2" : "#171717", fontSize: noteFontSize * 16 / NOTE_TEXT_SIZE.default, lineHeight: noteFontSize * 23 / NOTE_TEXT_SIZE.default }]}>
          {note.text.trim().slice(0, 100) || `사진 ${note.photos?.length ?? 0}장`}
        </Text>
      </View>
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

export function DragOverlay({ drag, notes, folders, isDark, isTrashView, noteFontSize }: {
  drag: DragOverlayState;
  notes: Note[];
  folders: Folder[];
  isDark: boolean;
  isTrashView: boolean;
  noteFontSize: number;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <FolderQuickMenu menu={drag.menu} originX={drag.rootX} originY={drag.rootY}
        isDark={isDark} folders={folders} isTrashView={isTrashView} />
      {notes.map((note) => <DragPreview key={note.id} note={note} drag={drag} isDark={isDark} noteFontSize={noteFontSize} />)}
    </View>
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

export function DraggableNotes<T extends Note>({ notes, folders, renderNote, children, header, listStyle, detailNote, renderDetail, onDragState, paddingTop, paddingBottom, editing, reordering = false, onDrop, onReorder, searchTarget, keyboardInset = 0, editorOverlayInset = 0 }: {
  notes: T[];
  folders: Folder[];
  renderNote: (note: T, reorderHandle?: ReactNode) => ReactNode;
  children: ReactNode;
  header?: ReactNode;
  listStyle?: StyleProp<ViewStyle>;
  detailNote?: T | null;
  renderDetail?: (nativeScroll: NativeGesture, wrapNote: (content: ReactNode) => ReactNode) => ReactNode;
  onDragState?: (state: DragOverlayState | null) => void;
  paddingTop: number;
  paddingBottom: number;
  editing: boolean;
  reordering?: boolean;
  onDrop: (noteId: number, targetId: number) => void;
  onReorder?: (ids: number[]) => void;
  keyboardInset?: number;
  searchTarget?: SearchScrollTarget | null;
  editorOverlayInset?: number;
}) {
  const {
    scrollRef, onScroll, scrollToSearchTarget, viewportHeight, contentHeight,
    registerLayout, reorder, finishReorder,
  } = useNoteReorder({ notes, reordering, onReorder, searchTarget, paddingTop });
  const rootRef = useAnimatedRef<View>();
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const detailNativeScroll = useMemo(() => Gesture.Native(), []);
  const drag = useNoteDrag({ notes, folders, detailNote, paddingTop, paddingBottom });
  const readOffset = useCallback(() => reorder.scrollOffset.get(), [reorder]);
  const viewport = useEditorViewport({ viewportRef: rootRef, scrollRef, readOffset,
    keyboardHeight: keyboardInset, topInset: paddingTop, bottomInset: editorOverlayInset });
  useNoteListResume({ drag, reorder, scrollRef, contentHeight, viewportHeight, reveal: viewport.reveal });

  useEffect(() => {
    onDragState?.(drag);
    return () => onDragState?.(null);
  }, [drag, onDragState]);

  const wrapDetailNote = (content: ReactNode) => detailNote && !reordering
    ? <DraggableRow note={detailNote} drag={drag} nativeScroll={nativeScroll} externalNativeScroll={detailNativeScroll}
      rootRef={rootRef} paddingTop={paddingTop} paddingBottom={paddingBottom} folderCount={folders.length}
      disabled={editing} onDrop={onDrop}>{content}</DraggableRow>
    : content;

  return (
    <EditorViewportContext.Provider value={viewport.context}>
      <Animated.View ref={rootRef} collapsable={false} style={[styles.container, { marginBottom: keyboardInset }]}>
        <View style={styles.workspace}>
          <View style={[styles.listPane, listStyle]}>
            <GestureDetector gesture={nativeScroll}>
              <Animated.ScrollView ref={scrollRef} style={styles.container}
                contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={false}
                onScroll={onScroll} scrollEventThrottle={16}
                onLayout={(event) => {
                  viewportHeight.set(event.nativeEvent.layout.height);
                  viewport.reveal();
                }}
                onContentSizeChange={(_width, height) => {
                  contentHeight.set(height);
                  scrollToSearchTarget();
                  viewport.reveal();
                }}
                removeClippedSubviews={false}
                contentContainerStyle={{ flexGrow: 1, paddingTop, paddingBottom }}>
                {header}
                {notes.map((note, index) => (
                  <ReorderRow key={note.id} noteId={note.id} index={index} reordering={reordering} reorder={reorder}
                    onLayout={(y, height) => registerLayout(note.id, y, height)}>
                    {reordering ? renderNote(note, <ReorderHandle noteId={note.id} nativeScroll={nativeScroll}
                      scrollRef={scrollRef} reorder={reorder} onDrop={finishReorder} />) : <DraggableRow note={note} drag={drag} nativeScroll={nativeScroll}
                      rootRef={rootRef} paddingTop={paddingTop} paddingBottom={paddingBottom} folderCount={folders.length} disabled={editing} onDrop={onDrop}>
                      {renderNote(note)}
                    </DraggableRow>}
                  </ReorderRow>
                ))}
                <View>{children}</View>
              </Animated.ScrollView>
            </GestureDetector>
          </View>
          {renderDetail?.(detailNativeScroll, wrapDetailNote)}
        </View>
      </Animated.View>
    </EditorViewportContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  workspace: { flex: 1, flexDirection: "row" },
  listPane: { flex: 1, minWidth: 0 },
  preview: { position: "absolute", left: 0, top: 0,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, zIndex: 10,
    shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  previewText: { fontSize: 16, lineHeight: 23, flexShrink: 1 },
  previewContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewPhoto: { width: 48, height: 48, borderRadius: 8 },
  ellipsis: { fontSize: 22, lineHeight: 24, marginTop: "auto" },
  reorderHandle: { width: 120, height: 120, margin: -30, alignItems: "center", justifyContent: "center" },
  reorderGlyph: { fontSize: 24, lineHeight: 28, color: "#8E8E93" },
});
