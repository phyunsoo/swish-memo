import type { NotePhoto } from "./note-photos";

export type NoteDraft = { text: string; photos: NotePhoto[]; timestamp?: number };

export function emptyNoteDraft(): NoteDraft {
  return { text: "", photos: [] };
}

export function hasNoteContent(content: { text: string; photos?: NotePhoto[] }) {
  return content.text.trim().length > 0 || (content.photos?.length ?? 0) > 0;
}

export function updateNoteDraft(draft: NoteDraft, patch: Partial<Pick<NoteDraft, "text" | "photos">>, now = Date.now()): NoteDraft {
  const next = { ...draft, ...patch };
  return { ...next, timestamp: hasNoteContent(next) ? now : undefined };
}
