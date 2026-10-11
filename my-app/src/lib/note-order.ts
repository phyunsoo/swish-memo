import type { StoredNote } from "./local-store";
import { newTodoGeneration } from "./memo-rules";

type OrderedNote = Pick<StoredNote, "sortOrder" | "timestamp">;

export function compareNoteOrder(first: OrderedNote, second: OrderedNote) {
  return (first.sortOrder ?? first.timestamp) - (second.sortOrder ?? second.timestamp);
}

export function nextNoteOrder(notes: OrderedNote[]) {
  let last = -1;
  for (const note of notes) last = Math.max(last, note.sortOrder ?? note.timestamp);
  return last + 1;
}

export function reorderNoteIds(ids: number[], noteId: number, targetIndex: number) {
  const from = ids.indexOf(noteId);
  if (from < 0) return ids;
  const target = Math.max(0, Math.min(ids.length - 1, targetIndex));
  if (target === from) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(target, 0, noteId);
  return next;
}

export function applyNoteOrder(notes: StoredNote[], ids: number[]) {
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return notes.map((note) => ranks.has(note.id) ? { ...note, sortOrder: ranks.get(note.id) } : note);
}

export function moveNotesToDestination(
  notes: StoredNote[],
  moving: StoredNote[],
  destination: Pick<StoredNote, "state" | "folderId">,
) {
  if (moving.length === 0) return notes;
  const movingIds = new Set(moving.map((note) => note.id));
  let order = nextNoteOrder(notes.filter((note) => !movingIds.has(note.id)
    && note.state === destination.state
    && (destination.state !== "saved" || note.folderId === destination.folderId)));
  // The caller supplies the source's display order, including any unsaved draft last.
  const updates = new Map(moving.map((note) => [note.id, {
    ...note, ...destination, sortOrder: order++,
    deletedAt: destination.state === "trash" ? Date.now() : undefined,
    todoGeneration: destination.state === "saved" && destination.folderId === "todo"
      ? (note.state === "saved" && note.folderId === "todo" ? note.todoGeneration : newTodoGeneration())
      : note.todoGeneration,
  }]));
  const result = notes.map((note) => {
    const updated = updates.get(note.id);
    updates.delete(note.id);
    return updated ?? note;
  });
  // Include an unsaved draft when moving all notes to the trash.
  result.push(...updates.values());
  return result;
}
