const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(name, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', compiled)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}

const sync = load('memo-sync.ts');
const validation = load('memo-validation.ts');
const { createCloudSyncCoordinator } = load('memo-sync-coordinator.ts');
const note = { id: 1, text: 'original', timestamp: 10, state: 'saved', folderId: null };
const empty = { notes: [], folders: [], syncTombstones: [] };
const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
async function until(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for sync');
    await tick();
  }
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function main() {
  const migrated = sync.normalizeSyncMetadata({ ...empty, notes: [note] });
  assert.equal(migrated.notes[0].syncID, 'legacy-1');
  assert.deepEqual(sync.normalizeSyncMetadata(migrated), migrated);
  assert.equal(sync.mergeCloudSnapshots(migrated, migrated).notes.length, 1, 'Migration does not duplicate notes');
  const saved = sync.updateNotes(migrated, [{ ...note, text: 'saved' }], 20, 'device-a');
  const editing = sync.updateNotes(saved, [{ ...saved.notes[0], text: 'still typing' }], 20, 'device-a');
  assert.equal(editing.notes[0].modifiedAt, 21, 'Same-millisecond edits advance the revision');
  assert.equal(sync.mergeCloudSnapshots(editing, saved).notes[0].text, 'still typing', 'Old save completion preserves newer typing');
  const concurrentA = sync.updateNotes(migrated, [{ ...note, text: 'A' }], 20, 'a');
  const concurrentB = sync.updateNotes(migrated, [{ ...note, text: 'B' }], 20, 'b');
  assert.deepEqual(sync.mergeCloudSnapshots(concurrentA, concurrentB), sync.mergeCloudSnapshots(concurrentB, concurrentA), 'Equal-timestamp edits converge on both devices');
  const deleted = sync.updateNotes(editing, [], 22, 'device-a');
  assert.equal(sync.mergeCloudSnapshots(deleted, saved).notes.length, 0, 'Old save completion cannot resurrect a deletion');
  assert.equal(sync.mergeCloudSnapshots(saved, deleted).notes.length, 0, 'Deletion propagates to another device');
  const newer = { ...empty, notes: [{ ...editing.notes[0], modifiedAt: 23 }] };
  assert.equal(sync.mergeCloudSnapshots(deleted, newer).notes.length, 1, 'A newer edit beats an older deletion');
  const createdA = sync.updateNotes(empty, [note], 30, 'device-a');
  const createdB = sync.updateNotes(empty, [note], 30, 'device-b');
  assert.notEqual(createdA.notes[0].syncID, createdB.notes[0].syncID, 'New identities differ across devices');
  const folder = { id: 'custom', name: 'old', createdAt: 1, kind: 'custom' };
  const folderState = sync.normalizeSyncMetadata({ ...empty, folders: [folder] });
  const renamed = sync.updateFolders(folderState, [{ ...folder, name: 'new' }], 40, 'folder-edit');
  assert.equal(sync.mergeCloudSnapshots(renamed, folderState).folders[0].name, 'new');

  let active = 0, maximum = 0, calls = 0, commits = 0;
  let latest = 1;
  const blocked = deferred();
  const queue = createCloudSyncCoordinator({
    debounceMs: 0,
    read: async () => latest,
    async sync(value) {
      maximum = Math.max(maximum, ++active);
      calls++;
      if (calls === 1) await blocked.promise;
      active--;
      return value;
    },
    async commit(value) { commits++; assert.equal(value, commits === 1 ? 1 : 3); },
    onError: (error) => { throw error; },
  });
  queue.request();
  await until(() => calls === 1);
  latest = 2; queue.request(); latest = 3; queue.request();
  await tick();
  assert.equal(calls, 1, 'Pending requests cannot overlap the current flight');
  blocked.resolve();
  await until(() => commits === 2);
  assert.equal(maximum, 1);
  queue.stop();

  let attempts = 0, retries = 0, recovered = false;
  const retry = createCloudSyncCoordinator({
    debounceMs: 0, retryMs: 1, read: async () => 1,
    sync: async () => { if (++attempts === 1) throw new Error('offline'); return 1; },
    commit: async () => { recovered = true; }, onError: () => { retries++; },
  });
  retry.request();
  await until(() => recovered);
  assert.equal(retries, 1);
  retry.stop();

  // Exercise the real repository with an offline/slow native bridge.
  let disk = JSON.stringify({ ...migrated, draftText: 'device draft', draftPhotos: [] });
  const remote = deferred();
  const coordinators = [];
  let cloudStarted = false;
  const store = load('local-store.ts', {
    './memo-validation': validation,
    './cloud-memo-client': { cloudMemoClient: { available: true, syncSnapshot: async (json) => {
      cloudStarted = true; await remote.promise;
      return JSON.stringify(sync.mergeCloudSnapshots(JSON.parse(json), {
        ...empty, notes: [{ ...note, id: 2, syncID: 'other-device', modifiedAt: 50 }],
      }));
    } } },
    'expo-sqlite': { openDatabaseAsync: async () => ({}) },
    expo: { requireOptionalNativeModule: (name) => name === 'MemoStore' ? {
      hasSharedMemoStore: true, loadMemoSnapshot: async () => disk,
      saveMemoSnapshot: async (json) => { disk = json; return json; },
    } : null },
    'react-native': { Platform: { OS: 'ios' } },
    './note-typography': { normalizeNoteFontSize: (size) => size ?? 17, NOTE_TEXT_SIZE: { default: 17 } },
    './note-placeholder': { DEFAULT_NOTE_PLACEHOLDER: '' },
    './note-photos': { deleteRemovedPhotos() {} }, './memo-sync': sync,
    './memo-sync-coordinator': { createCloudSyncCoordinator: (options) => {
      const coordinator = createCloudSyncCoordinator({ ...options, debounceMs: 0 });
      coordinators.push(coordinator); return coordinator;
    } },
  });
  let delivered;
  const unsubscribe = store.subscribeToSyncedSnapshot((value) => { delivered = value; });
  const first = await store.loadSnapshot();
  await until(() => cloudStarted);
  const edited = sync.updateNotes(first, [{ ...first.notes[0], text: 'offline edit' }], 100, 'device-a');
  await store.saveSnapshot(edited);
  assert.equal(JSON.parse(disk).notes[0].text, 'offline edit', 'Local save completes before the blocked network call');
  remote.resolve();
  await until(() => delivered);
  assert.equal(delivered.notes.find((item) => item.id === 2)?.syncID, 'other-device', 'Cloud-created notes are delivered to the UI');
  assert.equal(delivered.notes[0].text, 'offline edit', 'Cloud completion preserves newer local data and notifies the UI');
  const removed = sync.updateNotes(edited, [], 101, 'device-a');
  await store.saveSnapshot(removed);
  await store.saveSnapshot(edited);
  assert.equal(JSON.parse(disk).notes.some((item) => item.id === 1), false, 'Queued stale save cannot resurrect a permanently deleted note');
  assert.equal(JSON.parse(disk).notes.some((item) => item.id === 2), true, 'Queued stale save preserves a newly downloaded note');
  unsubscribe(); coordinators.forEach((coordinator) => coordinator.stop());
  const beforeInvalidSave = disk;
  const current = JSON.parse(disk);
  await assert.rejects(store.saveSnapshot({ ...current, notes: [{ ...current.notes[0], text: 42, modifiedAt: 1000 }] }), /Invalid memo data/);
  assert.equal(disk, beforeInvalidSave, 'Invalid data must be rejected before disk writes');
  disk = '{"notes":null,"folders":[]}';
  await assert.rejects(store.loadSnapshot(), /Invalid memo data/);
  assert.equal(disk, '{"notes":null,"folders":[]}', 'Invalid disk data is not replaced by an empty snapshot');
  console.log('Memo sync: stable migration, stale edits/deletions, latest changes, single-flight, retry, offline saves and UI delivery passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
