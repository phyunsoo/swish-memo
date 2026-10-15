import type { AppSnapshot } from "./memo-model";

function fail(path: string): never { throw new Error(`Invalid memo data: ${path}`); }
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path);
  return value as Record<string, unknown>;
}
function number(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path);
}
function string(value: unknown, path: string) { if (typeof value !== "string") fail(path); }
function optional(value: unknown, path: string, validate: (value: unknown, path: string) => void) {
  if (value !== undefined) validate(value, path);
}
function array(value: unknown, path: string, validate: (value: unknown, path: string) => void) {
  if (!Array.isArray(value)) fail(path);
  value.forEach((item, index) => validate(item, `${path}[${index}]`));
}
function photos(value: unknown, path: string) {
  array(value, path, (item, path) => {
    const photo = object(item, path);
    string(photo.fileName, `${path}.fileName`);
    const name = photo.fileName as string;
    if (!name || name === "." || name === ".." || name.includes("/")) fail(`${path}.fileName`);
    number(photo.width, `${path}.width`);
    number(photo.height, `${path}.height`);
  });
}
function metadata(item: Record<string, unknown>, path: string) {
  optional(item.modifiedAt, `${path}.modifiedAt`, number);
  optional(item.changeID, `${path}.changeID`, string);
}

// Missing legacy settings are filled by the caller. Present malformed fields
// fail before a snapshot can be merged or written back to disk.
export function parseMemoSnapshot(json: string): Partial<AppSnapshot> {
  const value = object(JSON.parse(json), "snapshot");
  array(value.notes, "notes", (item, path) => {
    const note = object(item, path);
    number(note.id, `${path}.id`);
    string(note.text, `${path}.text`);
    number(note.timestamp, `${path}.timestamp`);
    if (!["draft", "saved", "trash"].includes(note.state as string)) fail(`${path}.state`);
    if (note.folderId !== null) string(note.folderId, `${path}.folderId`);
    optional(note.syncID, `${path}.syncID`, string);
    optional(note.photos, `${path}.photos`, photos);
    optional(note.deletedAt, `${path}.deletedAt`, number);
    optional(note.sortOrder, `${path}.sortOrder`, number);
    optional(note.todoGeneration, `${path}.todoGeneration`, string);
    metadata(note, path);
  });
  array(value.folders, "folders", (item, path) => {
    const folder = object(item, path);
    string(folder.id, `${path}.id`);
    string(folder.name, `${path}.name`);
    number(folder.createdAt, `${path}.createdAt`);
    if (!["todo", "custom"].includes(folder.kind as string)) fail(`${path}.kind`);
    if (folder.noteOrder !== undefined && !["recent", "manual"].includes(folder.noteOrder as string)) fail(`${path}.noteOrder`);
    metadata(folder, path);
  });
  optional(value.syncTombstones, "syncTombstones", (items, path) => array(items, path, (item, path) => {
    const tombstone = object(item, path);
    string(tombstone.key, `${path}.key`);
    number(tombstone.modifiedAt, `${path}.modifiedAt`);
    if (!["note", "folder"].includes(tombstone.entity as string)) fail(`${path}.entity`);
  }));
  optional(value.draftPhotos, "draftPhotos", photos);
  optional(value.draftText, "draftText", string);
  optional(value.notePlaceholder, "notePlaceholder", string);
  optional(value.noteFontSize, "noteFontSize", number);
  for (const key of ["markdownEnabled", "hyperlinksEnabled"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") fail(key);
  }
  return value as Partial<AppSnapshot>;
}
