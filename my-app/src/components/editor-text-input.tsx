import { useContext, useRef, type RefObject } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { EditorViewportContext } from "@/hooks/use-editor-viewport";
import { caretLineRect, type TextLine } from "@/lib/editor-viewport";

/** Measure the cursor's native wrapped line without changing the editable view. */
export function EditorTextInput({ inputRef, value = "", style, onSelectionChange, onFocus, ...props }: TextInputProps & {
  inputRef: RefObject<TextInput | null>;
}) {
  const viewport = useContext(EditorViewportContext);
  const selection = useRef({ start: value.length, end: value.length });
  const layout = useRef<{ text: string; lines: TextLine[] }>({ text: "", lines: [] });
  const textStyle = StyleSheet.flatten(style);
  const reportCaret = () => {
    const input = inputRef.current;
    if (selection.current.start !== selection.current.end) {
      viewport?.reportCaret(null);
      return;
    }
    if (input && layout.current.text === value) viewport?.reportCaret({ input,
      rect: caretLineRect(value, selection.current.end, layout.current.lines, textStyle?.lineHeight ?? 35) });
  };
  return (
    <View style={{ width: "100%" }}>
      <TextInput {...props} ref={inputRef} value={value} style={style}
        onSelectionChange={(event) => {
          selection.current = event.nativeEvent.selection;
          onSelectionChange?.(event);
          reportCaret();
        }}
        onFocus={(event) => { onFocus?.(event); reportCaret(); }} />
      <Text pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        allowFontScaling={props.allowFontScaling} maxFontSizeMultiplier={props.maxFontSizeMultiplier}
        style={[style, { position: "absolute", top: 0, left: 0, opacity: 0, minHeight: 0 }]}
        onTextLayout={(event) => {
          layout.current = { text: value, lines: event.nativeEvent.lines };
          reportCaret();
        }}>{value + "\u200b"}</Text>
    </View>
  );
}
