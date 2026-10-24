import { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import type { ScrollView, TextInput, View } from "react-native";
import { revealCaretOffset, type CaretRect } from "@/lib/editor-viewport";

type CaretTarget = { input: TextInput; rect: CaretRect };
export const EditorViewportContext = createContext<{ reportCaret: (target: CaretTarget | null) => void } | null>(null);

export function useEditorViewport(options: {
  viewportRef: RefObject<View | null>;
  scrollRef: RefObject<ScrollView | null>;
  readOffset: () => number;
  keyboardHeight: number;
  topInset: number;
  bottomInset: number;
}) {
  const latest = useRef(options);
  const caret = useRef<CaretTarget | null>(null);
  const frame = useRef<number | null>(null);
  const version = useRef(0);
  useLayoutEffect(() => { latest.current = options; });
  const reveal = useCallback(() => {
    const token = ++version.current;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const target = caret.current;
      const settings = latest.current;
      if (!target || settings.keyboardHeight <= 0 || !target.input.isFocused()) return;
      const isCurrent = () => version.current === token && caret.current === target && target.input.isFocused();
      settings.viewportRef.current?.measureInWindow((_x, top, _width, height) => {
        if (!isCurrent() || height <= 0) return;
        target.input.measureInWindow((_inputX, inputTop) => {
          if (!isCurrent()) return;
          const offset = settings.readOffset();
          const next = revealCaretOffset(offset, inputTop + target.rect.top, target.rect.height,
            top + settings.topInset + 12, top + height - settings.bottomInset - 12);
          if (Math.abs(next - offset) > 1) settings.scrollRef.current?.scrollTo({ y: next, animated: false });
        });
      });
    });
  }, []);
  const reportCaret = useCallback((target: CaretTarget | null) => { caret.current = target; reveal(); }, [reveal]);
  useEffect(reveal, [reveal, options.keyboardHeight, options.topInset, options.bottomInset]);
  useEffect(() => () => {
    version.current += 1;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  return { context: useMemo(() => ({ reportCaret }), [reportCaret]), reveal };
}
