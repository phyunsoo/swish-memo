import type { AppSnapshot, Folder, StoredNote } from "./memo-model";

export type MemoEntities = Pick<AppSnapshot, "notes" | "folders" | "syncTombstones">;
type Tombstone = AppSnapshot["syncTombstones"][number];

export const noteSyncKey = (note: StoredNote) => note.syncID ?? `legacy-${note.id}`;

// Existing notes get a deterministic identity before crossing the native bridge.
// New notes receive a separate identity at creation, in updateNotes().
export function normalizeSyncMetadata<T extends MemoEntities>(snapshot: T): T {
  return {
    ...snapshot,
    notes: snapshot.notes.map((note) => ({
      ...note,
      syncID: noteSyncKey(note),
      modifiedAt: note.modifiedAt ?? note.timestamp,
    })),
    folders: snapshot.folders.map((folder) => ({ ...folder, modifiedAt: folder.modifiedAt ?? folder.createdAt })),
    syncTombstones: mergeTombstones(snapshot.syncTombstones ?? []),
  };
}

function mergeTombstones(...groups: Tombstone[][]): Tombstone[] {
  const merged = new Map<string, Tombstone>();
  for (const item of groups.flat()) {
    const key = `${item.entity}:${item.key}`;
    if (!merged.has(key) || item.modifiedAt > merged.get(key)!.modifiedAt) merged.set(key, item);
  }
  return [...merged.values()];
}

function mergeItems<T extends { modifiedAt?: number; changeID?: string }>(
  local: T[], remote: T[], key: (item: T) => string, entity: Tombstone["entity"], tombstones: Tombstone[],
): T[] {
  const deleted = new Map(tombstones.filter((item) => item.entity === entity).map((item) => [item.key, item.modifiedAt]));
  const merged = new Map(local.map((item) => [key(item), item]));
  for (const item of remote) {
    const current = merged.get(key(item));
    if (!current || (item.modifiedAt ?? 0) > (current.modifiedAt ?? 0)
      || ((item.modifiedAt ?? 0) === (current.modifiedAt ?? 0)
        && (item.changeID ?? "") >= (current.changeID ?? ""))) merged.set(key(item), item);
  }
  return [...merged.values()].filter((item) => !deleted.has(key(item))
    || (item.modifiedAt ?? 0) > deleted.get(key(item))!);
}

export function mergeCloudSnapshots<T extends MemoEntities>(local: T, remote: MemoEntities): T {
  const syncTombstones = mergeTombstones(local.syncTombstones, remote.syncTombstones);
  return {
    ...local,
    notes: mergeItems(local.notes, remote.notes, noteSyncKey, "note", syncTombstones),
    folders: mergeItems(local.folders, remote.folders, (folder) => folder.id, "folder", syncTombstones),
    syncTombstones,
  };
}

export function recordRemovals(previous: MemoEntities, next: MemoEntities, now: number): Tombstone[] {
  const notes = new Set(next.notes.map(noteSyncKey));
  const folders = new Set(next.folders.map((folder) => folder.id));
  const removed: Tombstone[] = [
    ...previous.notes.filter((note) => !notes.has(noteSyncKey(note)))
      .map((note) => ({ key: noteSyncKey(note), entity: "note" as const, modifiedAt: Math.max(now, (note.modifiedAt ?? 0) + 1) })),
    ...previous.folders.filter((folder) => !folders.has(folder.id))
      .map((folder) => ({ key: folder.id, entity: "folder" as const, modifiedAt: Math.max(now, (folder.modifiedAt ?? 0) + 1) })),
  ];
  return removed.length ? mergeTombstones(previous.syncTombstones, next.syncTombstones, removed) : next.syncTombstones;
}

function content(value: StoredNote | Folder) {
  const { modifiedAt: _modifiedAt, changeID: _changeID, ...rest } = value;
  if ("text" in rest) {
    const { syncID: _syncID, ...note } = rest;
    return JSON.stringify(note);
  }
  return JSON.stringify(rest);
}

// Stamp edits synchronously with the React state update, never on save completion.
export function updateNotes(state: MemoEntities, requested: StoredNote[], now: number, creationToken: string): MemoEntities {
  const previous = new Map(state.notes.map((note) => [note.id, note]));
  const notes = requested.map((note) => {
    const old = previous.get(note.id);
    if (old && content(old) === content(note)) return old;
    return {
      ...note,
      syncID: old ? noteSyncKey(old) : note.syncID ?? `memo-${note.id}-${creationToken}`,
      modifiedAt: Math.max(now, (old?.modifiedAt ?? 0) + 1),
      changeID: creationToken,
    };
  });
  const next = { ...state, notes };
  return { ...next, syncTombstones: recordRemovals(state, next, now) };
}

export function updateFolders(state: MemoEntities, requested: Folder[], now: number, changeID: string): MemoEntities {
  const previous = new Map(state.folders.map((folder) => [folder.id, folder]));
  const folders = requested.map((folder) => {
    const old = previous.get(folder.id);
    if (old && content(old) === content(folder)) return old;
    return { ...folder, modifiedAt: Math.max(now, (old?.modifiedAt ?? 0) + 1), changeID };
  });
  const next = { ...state, folders };
  return { ...next, syncTombstones: recordRemovals(state, next, now) };
}
