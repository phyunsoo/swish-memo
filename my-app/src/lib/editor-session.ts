import type { StoredNote } from "./memo-model";
import { hasNoteContent } from "./note-draft";
import { isValidTodoText } from "./memo-rules";

export type EditorSession =
  | { kind: "idle" }
  | { kind: "draft" }
  | { kind: "note"; note: StoredNote; isNew: boolean };

/** Empty new cards are temporary; invalid todo edits stay in the editor. */
export function persistEditorNote(notes: StoredNote[], session: EditorSession): StoredNote[] {
  if (session.kind !== "note") return notes;
  const { note, isNew } = session;
  if (isNew && !hasNoteContent(note)) {
    return notes.some((item) => item.id === note.id) ? notes.filter((item) => item.id !== note.id) : notes;
  }
  if (note.folderId === "todo" && !isValidTodoText(note.text)) return notes;
  const existing = notes.find((item) => item.id === note.id);
  if (!existing) return isNew ? [...notes, note] : notes;
  if (existing.text === note.text && existing.timestamp === note.timestamp && existing.photos === note.photos) return notes;
  return notes.map((item) => item.id === note.id
    ? { ...item, text: note.text, photos: note.photos, timestamp: note.timestamp } : item);
}
