const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const ts = require('typescript');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swish-photo-test-'));
class File {
  constructor(...parts) {
    this.path = path.join(...parts.map((part) => part.path ?? (part.startsWith('file:') ? fileURLToPath(part) : part)));
    this.uri = pathToFileURL(this.path).href;
  }
  get extension() { return path.extname(this.path); }
  get exists() { return fs.existsSync(this.path); }
  copy(to) { fs.copyFileSync(this.path, to.path); }
  delete() { fs.unlinkSync(this.path); }
}
class Directory extends File { create() { fs.mkdirSync(this.path, { recursive: true }); } }
function load(relative, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', js)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}
async function main() {
  const photos = load('lib/note-photos.ts', { 'expo-file-system': { File, Directory, Paths: { document: root } } });
  const original = path.join(root, 'original.heic');
  fs.writeFileSync(original, 'photo bytes');
  const asset = { uri: pathToFileURL(original).href, width: 1200, height: 800 };
  const [photo] = photos.importNotePhotos([asset]);
  assert.equal(photo.width, 1200);
  assert.match(photo.fileName, /\.heic$/);
  const stored = fileURLToPath(photos.notePhotoUri(photo));
  fs.unlinkSync(original);
  assert.equal(fs.readFileSync(stored, 'utf8'), 'photo bytes', 'Deleting the source must not break the memo');
  const before = fs.readdirSync(path.join(root, 'memo-photos'));
  assert.throws(() => photos.importNotePhotos([{ ...asset, uri: photos.notePhotoUri(photo) }, asset]));
  assert.deepEqual(fs.readdirSync(path.join(root, 'memo-photos')), before, 'Roll back a partial import');
  let disk = JSON.stringify({ notes: [], folders: [], draftText: 'legacy draft' });
  let failSave = false;
  const native = {
    hasSharedMemoStore: true,
    async loadMemoSnapshot() { return disk; },
    async saveMemoSnapshot(json) {
      if (failSave) throw new Error('disk unavailable');
      const snapshot = JSON.parse(json);
      snapshot.notes = snapshot.notes.filter((note) => !note.expired);
      disk = JSON.stringify(snapshot);
      return disk;
    },
  };
  const sync = load('lib/memo-sync.ts', {});
  const coordinator = load('lib/memo-sync-coordinator.ts', {});
  const store = load('lib/local-store.ts', {
    './memo-sync': sync, './memo-sync-coordinator': coordinator,
    './memo-validation': load('lib/memo-validation.ts', {}),
    './cloud-memo-client': { cloudMemoClient: { available: false } },
    'expo-sqlite': { openDatabaseAsync: async () => ({}) },
    expo: { requireOptionalNativeModule: (name) => name === 'MemoStore' ? native : null },
    'react-native': { Platform: { OS: 'ios' } },
    './note-typography': { normalizeNoteFontSize: (size) => size ?? 17, NOTE_TEXT_SIZE: { default: 17 } },
    './note-placeholder': { DEFAULT_NOTE_PLACEHOLDER: '' }, './note-photos': photos,
  });
  let revision = Date.now();
  async function persist(snapshot) {
    const previous = await store.loadSnapshot();
    const { notes, folders, syncTombstones } = previous;
    let entities = sync.updateNotes({ notes, folders, syncTombstones }, snapshot.notes, ++revision, 'photos');
    entities = sync.updateFolders(entities, snapshot.folders, revision, 'photos');
    return store.saveSnapshot({ ...snapshot, ...entities });
  }
  const legacy = await store.loadSnapshot();
  assert.deepEqual(legacy.draftPhotos, [], 'Old text-only snapshots stay compatible');
  const draft = { ...legacy, draftPhotos: [photo] };
  await persist(draft);
  assert.deepEqual((await store.loadSnapshot()).draftPhotos, [photo], 'Unfinished photos survive reload');
  const note = { id: 1, text: '', photos: [photo], state: 'draft', folderId: null, timestamp: 10 };
  const completed = { ...draft, draftText: '', draftPhotos: [], notes: [note] };
  await persist(completed);
  assert.ok(fs.existsSync(stored), 'Completing a photo-only memo keeps its file');
  const order = load('lib/note-order.ts', { './memo-rules': { newTodoGeneration: () => 'test' } });
  const saved = { ...completed, notes: order.moveNotesToDestination(completed.notes, [note], { state: 'saved', folderId: 'folder-1' }) };
  await persist(saved);
  assert.deepEqual(saved.notes[0].photos, [photo], 'Folder moves retain photos');
  const trash = { ...saved, notes: order.moveNotesToDestination(saved.notes, saved.notes, { state: 'trash', folderId: 'folder-1' }) };
  await persist(trash);
  assert.ok(fs.existsSync(stored), 'Trash keeps the photo file');
  const restored = { ...trash, notes: order.moveNotesToDestination(trash.notes, trash.notes, { state: 'saved', folderId: 'folder-1' }) };
  await persist(restored);
  assert.deepEqual((await store.loadSnapshot()).notes[0].photos, [photo], 'Restored photos survive reload');
  failSave = true;
  await assert.rejects(persist({ ...restored, notes: [] }));
  assert.ok(fs.existsSync(stored), 'Failed saves must not delete referenced files');
  failSave = false;
  await persist({ ...restored, notes: [] });
  assert.ok(!fs.existsSync(stored), 'Permanent deletion removes its photo');
  fs.writeFileSync(original, 'expiry photo');
  const [expiredPhoto] = photos.importNotePhotos([asset]);
  await persist({ ...legacy, notes: [{ ...note, photos: [expiredPhoto], state: 'trash', expired: true }] });
  assert.ok(!fs.existsSync(fileURLToPath(photos.notePhotoUri(expiredPhoto))), 'Native expiry removes the photo');
  console.log('Note photos: import, rollback, migration, draft reload, moves, trash, restore, failed saves and deletion passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => fs.rmSync(root, { recursive: true, force: true }));
