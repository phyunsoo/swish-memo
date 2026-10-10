export type TextMatch = { start: number; end: number };
export type SearchScrollTarget = { noteId: number; offset: number; key: string };
export const EMPTY_TEXT_MATCHES: TextMatch[] = [];

/** Literal, case-sensitive matches; user input is never treated as a regular expression. */
export function findTextMatches(text: string, query: string): TextMatch[] {
  if (!query) return [];
  const matches: TextMatch[] = [];
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf(query, from);
    if (start === -1) break;
    matches.push({ start, end: start + query.length });
    from = start + query.length;
  }
  return matches;
}

/** Native line text includes wrapping; locate each line in the original UTF-16 string. */
export function matchLineOffsets(text: string, matches: TextMatch[], lines: { text: string; y: number }[]): number[] {
  let cursor = 0;
  const ranges = lines.map((line) => {
    const found = text.indexOf(line.text, cursor);
    const start = found === -1 ? cursor : found;
    cursor = start + line.text.length;
    return { start, end: cursor, y: line.y };
  });
  return matches.map((match) => (
    ranges.find((line) => match.start >= line.start && match.start < line.end)
      ?? ranges.find((line) => line.start > match.start)
      ?? ranges[ranges.length - 1]
  )?.y ?? 0);
}
