export const NOTE_TEXT_SIZE = {
  default: 22,
  min: 16,
  max: 28,
  step: 3,
} as const;

export const NOTE_LINE_HEIGHT = 35;

export function normalizeNoteFontSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return NOTE_TEXT_SIZE.default;
  const clamped = Math.min(NOTE_TEXT_SIZE.max, Math.max(NOTE_TEXT_SIZE.min, value));
  return NOTE_TEXT_SIZE.min + Math.round((clamped - NOTE_TEXT_SIZE.min) / NOTE_TEXT_SIZE.step) * NOTE_TEXT_SIZE.step;
}

export function getNoteTextStyle(fontSize: number) {
  return { fontSize, lineHeight: fontSize * NOTE_LINE_HEIGHT / NOTE_TEXT_SIZE.default };
}
