export type CaretRect = { top: number; height: number };
export type TextLine = { text: string; y: number; height: number };

/** Selection offsets and native line text both use UTF-16, including emoji. */
export function caretLineRect(text: string, offset: number, lines: TextLine[], lineHeight: number): CaretRect {
  const renderedText = text + "\u200b";
  const target = Math.max(0, Math.min(text.length, offset));
  let cursor = 0;
  for (const [index, line] of lines.entries()) {
    const found = renderedText.indexOf(line.text, cursor);
    const start = found === -1 ? cursor : found;
    cursor = start + line.text.length;
    // Some native layouts omit the newline from their line text.
    if (!line.text.endsWith("\n") && renderedText[cursor] === "\n") cursor += 1;
    if (target < cursor || index === lines.length - 1) return { top: line.y, height: Math.max(line.height, lineHeight) };
  }
  return { top: 0, height: lineHeight };
}

export function revealCaretOffset(offset: number, caretTop: number, caretHeight: number, visibleTop: number, visibleBottom: number) {
  const delta = caretTop < visibleTop ? caretTop - visibleTop
    : caretTop + caretHeight > visibleBottom ? caretTop + caretHeight - visibleBottom : 0;
  return Math.max(0, offset + delta);
}
