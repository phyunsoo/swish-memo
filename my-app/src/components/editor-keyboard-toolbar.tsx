import { Keyboard, StyleSheet, View } from "react-native";
import { GlassButton, GLASS_BUTTON_SIZE } from "./glass-button";

export const EDITOR_KEYBOARD_TOOLBAR_INSET = GLASS_BUTTON_SIZE + 24;

export function EditorKeyboardToolbar({ visible, canAttachPhotos, keyboardHeight, isDark, onAttachPhotos }: {
  visible: boolean;
  canAttachPhotos: boolean;
  keyboardHeight: number;
  isDark: boolean;
  onAttachPhotos: () => void;
}) {
  if (!visible || keyboardHeight <= 0) return null;
  const colors = {
    tint: isDark ? "#F5F5F2" : "#171717",
    glassTint: isDark ? "#343438" : "#F2F2F5",
  };
  return (
    <View pointerEvents="box-none" style={[styles.toolbar, { bottom: keyboardHeight }]}>
      <View>{canAttachPhotos && <GlassButton label="사진 첨부" symbol="paperclip" {...colors} onPress={onAttachPhotos} />}</View>
      <GlassButton label="키보드 닫기" symbol="keyboard.chevron.compact.down" {...colors} onPress={Keyboard.dismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { position: "absolute", left: 6, right: 6, flexDirection: "row", justifyContent: "space-between" },
});
