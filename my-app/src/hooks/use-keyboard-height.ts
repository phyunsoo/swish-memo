import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent } from "react-native";

export function useKeyboardHeight() {
  const { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(() => {
    const metrics = Keyboard.metrics();
    return metrics ? Math.max(0, height - metrics.screenY) : 0;
  });
  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      if (Platform.OS === "ios") Keyboard.scheduleLayoutAnimation(event);
      setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY));
    };
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", update);
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", (event) => {
      if (Platform.OS === "ios") Keyboard.scheduleLayoutAnimation(event);
      setKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [height]);
  return keyboardHeight;
}
