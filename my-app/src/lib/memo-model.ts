import type { NotePhoto } from "./note-photos";

export type Folder = {
  id: string;
  name: string;
  kind: "todo" | "custom";
  createdAt: number;
  noteOrder?: "recent" | "manual";
  modifiedAt?: number;
  changeID?: string;
};

export type StoredNote = {
  id: number;
  text: string;
  photos?: NotePhoto[];
  timestamp: number;
  sortOrder?: number;
  todoGeneration?: string;
  deletedAt?: number;
  folderId: string | null;
  state: "draft" | "saved" | "trash";
  syncID?: string;
  modifiedAt?: number;
  changeID?: string;
};

export type AppSnapshot = {
  folders: Folder[];
  notes: StoredNote[];
  draftText: string;
  draftPhotos: NotePhoto[];
  noteFontSize: number;
  notePlaceholder: string;
  markdownEnabled: boolean;
  hyperlinksEnabled: boolean;
  syncTombstones: { key: string; entity: "note" | "folder"; modifiedAt: number }[];
};
