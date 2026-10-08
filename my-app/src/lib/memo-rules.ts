import type { Folder, StoredNote } from "./local-store";

export function isValidTodoText(text: string): boolean {
  return !text.includes("\n") && Array.from(text).length <= 30;
}

export function hasFolderName(folders: Folder[], name: string, excludedId?: string): boolean {
  const normalizedName = name.toLocaleLowerCase();
  return folders.some((folder) =>
    folder.id !== excludedId && folder.name.toLocaleLowerCase() === normalizedName,
  );
}

export function updateNoteContent(notes: StoredNote[], noteId: number, text: string, timestamp: number): StoredNote[] {
  return notes.map((note) => note.id === noteId ? { ...note, text, timestamp } : note);
}
