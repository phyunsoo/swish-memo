import * as SQLite from "expo-sqlite";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { normalizeNoteFontSize, NOTE_TEXT_SIZE } from "./note-typography";
import { DEFAULT_NOTE_PLACEHOLDER } from "./note-placeholder";
import { deleteRemovedPhotos } from "./note-photos";
import type { AppSnapshot } from "./memo-model";
import { mergeCloudSnapshots, normalizeSyncMetadata, recordRemovals } from "./memo-sync";
import { createCloudSyncCoordinator } from "./memo-sync-coordinator";
import { cloudMemoClient } from "./cloud-memo-client";
import { parseMemoSnapshot } from "./memo-validation";

const databasePromise = SQLite.openDatabaseAsync("swish-memo.db");
const nativeStore = Platform.OS === "ios" ? requireOptionalNativeModule<{
  hasSharedMemoStore?: boolean;
  initializeMemoStore(json: string): Promise<string>;
  loadMemoSnapshot(): Promise<string | null>;
  saveMemoSnapshot(json: string): Promise<string>;
}>("MemoStore") : null;
const sharedStore = nativeStore?.hasSharedMemoStore ? nativeStore : null;

export type { AppSnapshot, Folder, StoredNote } from "./memo-model";

export const INITIAL_SNAPSHOT: AppSnapshot = {
  folders: [
    { id: "todo", name: "투두리스트", kind: "todo", createdAt: 0, noteOrder: "recent" },
  ],
  notes: [],
  draftText: "",
  draftPhotos: [],
  noteFontSize: NOTE_TEXT_SIZE.default,
  notePlaceholder: DEFAULT_NOTE_PLACEHOLDER,
  markdownEnabled: false,
  hyperlinksEnabled: false,
  syncTombstones: [],
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
      draftPhotos: Array.isArray(parsed.draftPhotos) ? parsed.draftPhotos : [],
      noteFontSize: normalizeNoteFontSize(parsed.noteFontSize),
      markdownEnabled: parsed.markdownEnabled === true,
      hyperlinksEnabled: parsed.hyperlinksEnabled === true,
      syncTombstones: Array.isArray(parsed.syncTombstones) ? parsed.syncTombstones : [],
      notePlaceholder: typeof parsed.notePlaceholder === "string"
        ? parsed.notePlaceholder
        : DEFAULT_NOTE_PLACEHOLDER,
    };
  } catch {
    return INITIAL_SNAPSHOT;
  }
}

// All disk reads and writes, including cloud commits, share this queue.
let localOperation: Promise<unknown> = Promise.resolve();
function withLocalStore<T>(operation: () => Promise<T>): Promise<T> {
  const result = localOperation.then(operation);
  localOperation = result.catch(() => undefined);
  return result;
}

async function readLocalSnapshot(): Promise<AppSnapshot> {
  if (!sharedStore) return normalizeSyncMetadata(await loadLegacySnapshot());
  const existing = await sharedStore.loadMemoSnapshot();
  if (existing) return normalizeSnapshot(existing);
  const legacy = normalizeSyncMetadata(await loadLegacySnapshot());
  return normalizeSnapshot(await sharedStore.initializeMemoStore(JSON.stringify(legacy)));
}

async function writeLocalSnapshot(snapshot: AppSnapshot): Promise<AppSnapshot> {
  const json = JSON.stringify(snapshot);
  parseMemoSnapshot(json);
  if (sharedStore) return normalizeSnapshot(await sharedStore.saveMemoSnapshot(json));
  const db = await databasePromise;
  await db.runAsync(
    "INSERT INTO app_state (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
    json,
  );
  return snapshot;
}

const listeners = new Set<(snapshot: AppSnapshot) => void>();
export function subscribeToSyncedSnapshot(listener: (snapshot: AppSnapshot) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function commitSnapshot(previous: AppSnapshot, snapshot: AppSnapshot) {
  const saved = await writeLocalSnapshot(snapshot);
  // The native store can expire old trash while committing it.
  const removals = recordRemovals(snapshot, saved, Date.now());
  const committed = removals === saved.syncTombstones ? saved
    : await writeLocalSnapshot({ ...saved, syncTombstones: removals });
  deleteRemovedPhotos(previous, snapshot, committed);
  return committed;
}

const syncCoordinator = cloudMemoClient.available ? createCloudSyncCoordinator<AppSnapshot>({
  read: () => withLocalStore(readLocalSnapshot),
  sync: async (snapshot) => normalizeSnapshot(await cloudMemoClient.syncSnapshot(JSON.stringify(snapshot))),
  commit: (remote) => withLocalStore(async () => {
    const local = await readLocalSnapshot();
    const committed = await commitSnapshot(local, mergeCloudSnapshots(local, remote));
    for (const listener of listeners) listener(committed);
  }),
  onError: (error) => console.warn("iCloud 동기화를 재시도합니다. 메모는 기기에 저장되어 있습니다.", error),
}) : null;

export async function loadSnapshot(): Promise<AppSnapshot> {
  const snapshot = await withLocalStore(readLocalSnapshot);
  // Local data is usable immediately, even when CloudKit is slow or offline.
  syncCoordinator?.request();
  return snapshot;
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<AppSnapshot> {
  const saved = await withLocalStore(async () => {
    const previous = await readLocalSnapshot();
    return commitSnapshot(previous, mergeCloudSnapshots(normalizeSyncMetadata(snapshot), previous));
  });
  syncCoordinator?.request();
  return saved;
}

function normalizeSnapshot(json: string): AppSnapshot {
  const parsed = parseMemoSnapshot(json);
  return normalizeSyncMetadata({ ...INITIAL_SNAPSHOT, ...parsed, noteFontSize: normalizeNoteFontSize(parsed.noteFontSize) });
}
