import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

let revision = 0;
const listeners = new Set<() => void>();

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let resumeFrame: number | null = null;

function subscribeToResume(listener: () => void) {
  if (Platform.OS !== "ios") return () => {};

  listeners.add(listener);
  if (!appStateSubscription) {
    let previousState = AppState.currentState;
    appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (previousState === nextState) return;
      const resumed = previousState !== "active" && nextState === "active";
      previousState = nextState;
      if (resumeFrame !== null) cancelAnimationFrame(resumeFrame);
      resumeFrame = null;
      if (!resumed) return;

      // Recreate only the glass host once the app can render again.
      resumeFrame = requestAnimationFrame(() => {
        resumeFrame = null;
        revision += 1;
        listeners.forEach((notify) => notify());
      });
    });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    appStateSubscription?.remove();
    appStateSubscription = null;
    if (resumeFrame !== null) cancelAnimationFrame(resumeFrame);
    resumeFrame = null;
  };
}

const getSnapshot = () => revision;

export function useGlassResumeKey() {
  return useSyncExternalStore(subscribeToResume, getSnapshot, getSnapshot);
}
