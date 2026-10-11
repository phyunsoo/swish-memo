import type { Folder, StoredNote } from "./local-store";
import { requireOptionalNativeModule } from "expo";

const native = requireOptionalNativeModule<{ memoCharacterCount?: (text: string) => number }>("MemoStore");

export function isValidTodoText(text: string): boolean {
  const count = native?.memoCharacterCount?.(text) ?? (typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text)).length
    : Array.from(text).length);
  return text.trim().length > 0 && !/[\r\n\u2028\u2029]/u.test(text)
    && count <= 30;
}

export function newTodoGeneration(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
