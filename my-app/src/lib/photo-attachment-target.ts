import type { StoredNote } from "./local-store";

export type PhotoAttachmentTarget = "new" | number;

export function resolvePhotoAttachmentTarget(editingNoteId: number | null, activeView: string, notes: StoredNote[]): PhotoAttachmentTarget | null {
  if (editingNoteId === null) return activeView === "home" ? "new" : null;
  const note = notes.find((item) => item.id === editingNoteId);
  return note && note.folderId !== "todo" ? note.id : null;
}

export function photoAttachmentTargetKey(target: PhotoAttachmentTarget | null, draftSession: number): string {
  if (target === null) return "";
  return target === "new" ? `draft:${draftSession}` : `note:${target}`;
}
