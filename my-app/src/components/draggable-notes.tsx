import { useLayoutEffect, useMemo, type ReactNode } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, measure, ReduceMotion, useAnimatedRef,
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

const PREVIEW_SIZE = 148;
const FINGER_GAP = 24;
const SPRING = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const FADE = {
  duration: 150,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.System,
};
type Note = { id: number; text: string };
type DragState = {
  active: SharedValue<number>;
  settling: SharedValue<boolean>;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  rootX: SharedValue<number>;
  rootY: SharedValue<number>;
  viewportWidth: SharedValue<number>;
  cardOpacity: SharedValue<number>;
  previewOpacity: SharedValue<number>;
  previewScaleX: SharedValue<number>;
  previewScaleY: SharedValue<number>;
};

function startFeedback() {
  Keyboard.dismiss();
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function DraggableRow({ note, drag, nativeScroll, rootRef, disabled, children }: {
  note: Note;
  drag: DragState;
  nativeScroll: NativeGesture;
  rootRef: ReturnType<typeof useAnimatedRef<View>>;
  disabled: boolean;
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
      drag.viewportWidth.set(root.width);
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
    })
    .onEnd(() => {
      if (drag.active.get() !== note.id) return;
      drag.settling.set(true);
      // Freeze the preview at the release point and crossfade the original card in place.
      cancelAnimation(drag.previewScaleX);
      cancelAnimation(drag.previewScaleY);
      drag.previewOpacity.set(withTiming(0, FADE));
      drag.cardOpacity.set(withTiming(1, FADE, (finished) => {
        if (finished) {
          drag.active.set(-1);
          drag.settling.set(false);
        }
      }));
    })
    .onFinalize((_event, success) => {
      if (!success && drag.active.get() === note.id) {
        drag.active.set(-1);
        drag.settling.set(false);
        drag.previewOpacity.set(0);
        drag.cardOpacity.set(1);
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
        accessibilityHint="길게 누르면 메모 미리보기를 끌 수 있습니다"
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function DragPreview({ note, drag, isDark }: { note: Note; drag: DragState; isDark: boolean }) {
  const style = useAnimatedStyle(() => ({
    opacity: drag.active.get() === note.id ? drag.previewOpacity.get() : 0,
    transform: [
      { translateX: Math.max(PREVIEW_SIZE / 2 + 8, Math.min(drag.viewportWidth.get() - PREVIEW_SIZE / 2 - 8, drag.fingerX.get())) - PREVIEW_SIZE / 2 },
      { translateY: Math.max(8, drag.fingerY.get() - PREVIEW_SIZE - FINGER_GAP) },
      { scaleX: drag.previewScaleX.get() },
      { scaleY: drag.previewScaleY.get() },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.preview, { backgroundColor: isDark ? "#242423" : "#FFFFFF", borderColor: isDark ? "#4A4A4D" : "#CED1D6" }, style]}>
      <Text numberOfLines={4} style={[styles.previewText, { color: isDark ? "#F5F5F2" : "#171717" }]}>
        {note.text.trim().slice(0, 100)}
      </Text>
      <Text style={[styles.ellipsis, { color: isDark ? "#A1A1A6" : "#77777C" }]}>…</Text>
    </Animated.View>
  );
}

export function DraggableNotes<T extends Note>({ notes, renderNote, children, paddingTop, paddingBottom, isDark, editing }: {
  notes: T[];
  renderNote: (note: T) => ReactNode;
  children: ReactNode;
  paddingTop: number;
  paddingBottom: number;
  isDark: boolean;
  editing: boolean;
}) {
  const rootRef = useAnimatedRef<View>();
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const active = useSharedValue(-1);
  const settling = useSharedValue(false);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const previewOpacity = useSharedValue(0);
  const previewScaleX = useSharedValue(1);
  const previewScaleY = useSharedValue(1);
  const drag: DragState = { active, settling, fingerX, fingerY, rootX, rootY,
    viewportWidth, cardOpacity, previewOpacity, previewScaleX, previewScaleY };

  useLayoutEffect(() => {
    cancelAnimation(cardOpacity);
    cancelAnimation(previewOpacity);
    active.set(-1);
    settling.set(false);
    cardOpacity.set(1);
    previewOpacity.set(0);
  }, [notes, active, settling, cardOpacity, previewOpacity]);

  return (
    <Animated.View ref={rootRef} collapsable={false} style={styles.container}>
      <GestureDetector gesture={nativeScroll}>
        <Animated.ScrollView style={styles.container}
          contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          removeClippedSubviews={false}
          contentContainerStyle={{ flexGrow: 1, paddingTop, paddingBottom }}>
          {notes.map((note) => (
            <DraggableRow key={note.id} note={note} drag={drag} nativeScroll={nativeScroll}
              rootRef={rootRef} disabled={editing}>
              {renderNote(note)}
            </DraggableRow>
          ))}
          {children}
        </Animated.ScrollView>
      </GestureDetector>
      {notes.map((note) => <DragPreview key={note.id} note={note} drag={drag} isDark={isDark} />)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  preview: { position: "absolute", left: 0, top: 0, width: PREVIEW_SIZE, height: PREVIEW_SIZE,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, zIndex: 10,
    shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  previewText: { fontSize: 16, lineHeight: 23, flexShrink: 1 },
  ellipsis: { fontSize: 22, lineHeight: 24, marginTop: "auto" },
});
