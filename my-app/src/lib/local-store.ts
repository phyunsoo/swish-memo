import * as SQLite from "expo-sqlite";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { normalizeNoteFontSize, NOTE_TEXT_SIZE } from "./note-typography";
import { DEFAULT_NOTE_PLACEHOLDER } from "./note-placeholder";

const databasePromise = SQLite.openDatabaseAsync("swish-memo.db");
const nativeStore = Platform.OS === "ios" ? requireOptionalNativeModule<{
  hasSharedMemoStore?: boolean;
  initializeMemoStore(json: string): Promise<string>;
  loadMemoSnapshot(): Promise<string | null>;
  saveMemoSnapshot(json: string): Promise<string>;
}>("MemoStore") : null;
const sharedStore = nativeStore?.hasSharedMemoStore ? nativeStore : null;

export type Folder = {
  id: string;
  name: string;
  kind: "todo" | "custom";
  createdAt: number;
  noteOrder?: "recent" | "manual";
};

export type StoredNote = {
  id: number;
  text: string;
  timestamp: number;
  sortOrder?: number;
  todoGeneration?: string;
  deletedAt?: number;
  folderId: string | null;
  state: "draft" | "saved" | "trash";
};

export type AppSnapshot = {
  folders: Folder[];
  notes: StoredNote[];
  draftText: string;
  noteFontSize: number;
  notePlaceholder: string;
  markdownEnabled: boolean;
  hyperlinksEnabled: boolean;
};

export const INITIAL_SNAPSHOT: AppSnapshot = {
  folders: [
    { id: "todo", name: "투두리스트", kind: "todo", createdAt: 0, noteOrder: "recent" },
  ],
  notes: [],
  draftText: "",
  noteFontSize: NOTE_TEXT_SIZE.default,
  notePlaceholder: DEFAULT_NOTE_PLACEHOLDER,
  markdownEnabled: false,
  hyperlinksEnabled: false,
};

async function loadLegacySnapshot(): Promise<AppSnapshot> {
  const db = await databasePromise;
  const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  if ((version?.user_version ?? 0) < 1) {
    await db.execAsync("DROP TABLE IF EXISTS app_state; PRAGMA user_version = 1;");
  }
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
  );
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_state WHERE id = 1",
  );
  if (!row) return INITIAL_SNAPSHOT;
  try {
    const parsed = JSON.parse(row.value) as Partial<AppSnapshot>;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : INITIAL_SNAPSHOT.folders,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      draftText: typeof parsed.draftText === "string" ? parsed.draftText : "",
      noteFontSize: normalizeNoteFontSize(parsed.noteFontSize),
      markdownEnabled: parsed.markdownEnabled === true,
      hyperlinksEnabled: parsed.hyperlinksEnabled === true,
      notePlaceholder: typeof parsed.notePlaceholder === "string"
        ? parsed.notePlaceholder
        : DEFAULT_NOTE_PLACEHOLDER,
    };
  } catch {
    return INITIAL_SNAPSHOT;
  }
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  if (!sharedStore) return loadLegacySnapshot();
  const existing = await sharedStore.loadMemoSnapshot();
  if (existing) return normalizeSnapshot(existing);
  const legacy = await loadLegacySnapshot();
  return normalizeSnapshot(await sharedStore.initializeMemoStore(JSON.stringify(legacy)));
}

function normalizeSnapshot(json: string): AppSnapshot {
  const parsed = JSON.parse(json) as AppSnapshot;
  return { ...INITIAL_SNAPSHOT, ...parsed, noteFontSize: normalizeNoteFontSize(parsed.noteFontSize) };
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<AppSnapshot> {
  if (sharedStore) return normalizeSnapshot(await sharedStore.saveMemoSnapshot(JSON.stringify(snapshot)));
  const db = await databasePromise;
  await db.runAsync(
    "INSERT INTO app_state (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
    JSON.stringify(snapshot),
  );
  return snapshot;
}
