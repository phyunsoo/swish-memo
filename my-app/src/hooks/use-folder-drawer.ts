import { useCallback, useEffect, useState } from "react";
import { AppState, Keyboard, useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const DRAWER_SPRING = { duration: 500, dampingRatio: 0.8, reduceMotion: ReduceMotion.System };

export function useFolderDrawer(enabled: boolean) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth * 0.84, 360);
  const [visible, setVisible] = useState(false);
  const progress = useSharedValue(0);
  const gestureStart = useSharedValue(0);
  const gestureAllowed = useSharedValue(false);
  const transition = useSharedValue(0);

  const reset = useCallback(() => {
    transition.set(transition.get() + 1);
    cancelAnimation(progress);
    progress.set(0);
    gestureStart.set(0);
    gestureAllowed.set(false);
    setVisible(false);
  }, [transition, progress, gestureStart, gestureAllowed]);
  useEffect(() => {
    if (!enabled) {
      const frame = requestAnimationFrame(reset);
      return () => cancelAnimationFrame(frame);
    }
  }, [enabled, reset]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", reset);
    return () => subscription.remove();
  }, [reset]);

  const prepare = useCallback(() => {
    Keyboard.dismiss();
    setVisible(true);
  }, []);

  const settle = useCallback((open: boolean) => {
    "worklet";
    const token = transition.get() + 1;
    transition.set(token);
    progress.set(withSpring(open ? 1 : 0, DRAWER_SPRING, (finished) => {
      if (finished && !open && transition.get() === token) scheduleOnRN(setVisible, false);
    }));
  }, [progress, transition]);

  const open = useCallback(() => {
    prepare();
    settle(true);
  }, [prepare, settle]);
  const close = useCallback(() => settle(false), [settle]);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      // Only activated drags may restore position; an ordinary tap must not
      // override the dismiss button's closing animation.
      const isOpen = progress.get() > 0.01;
      gestureStart.set(progress.get());
      gestureAllowed.set(isOpen);
      if (isOpen) scheduleOnRN(prepare);
    })
    .onUpdate((event) => {
      if (!gestureAllowed.get() && event.translationX > 0) {
        gestureAllowed.set(true);
        scheduleOnRN(prepare);
      }
      if (!gestureAllowed.get()) return;
      const next = gestureStart.get() + event.translationX / width;
      progress.set(Math.max(0, Math.min(1, next)));
    })
    .onEnd((event) => {
      if (!gestureAllowed.get()) return;
      const next = gestureStart.get() + event.translationX / width;
      const shouldOpen = event.velocityX > 450 ? true
        : event.velocityX < -450 ? false : next >= 0.5;
      settle(shouldOpen);
    })
    .onFinalize((_event, success) => {
      if (!success && gestureAllowed.get()) settle(gestureStart.get() >= 0.5);
      gestureAllowed.set(false);
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * width }],
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.get() - 1) * width }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() * 0.18 }));

  return { visible, width, open, close, panGesture, contentStyle, panelStyle, scrimStyle };
}
