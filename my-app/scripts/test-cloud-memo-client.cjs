const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', js)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}
const validation = load('memo-validation.ts', { './folder-colors': load('folder-colors.ts') });
const { createCloudMemoClient } = load('cloud-memo-client.ts', {
  expo: { requireOptionalNativeModule: () => null },
  'react-native': { Platform: { OS: 'ios' } },
  './memo-validation': validation,
});
const note = { id: 1, text: 'memo', timestamp: 1, state: 'saved', folderId: null };
const snapshot = { notes: [note], folders: [] };
const json = JSON.stringify(snapshot);
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
async function main() {
  assert.deepEqual(validation.parseMemoSnapshot(json), snapshot, 'Legacy snapshots without sync fields remain valid');
  for (const [value, field] of [
    [{ ...snapshot, notes: null }, 'notes'],
    [{ ...snapshot, notes: [{ ...note, timestamp: 'bad' }] }, 'timestamp'],
    [{ ...snapshot, notes: [{ ...note, photos: [{ fileName: '../outside', width: 1, height: 1 }] }] }, 'fileName'],
    [{ ...snapshot, syncTombstones: [{ key: 'a', entity: 'unknown', modifiedAt: 1 }] }, 'entity'],
  ]) assert.throws(() => validation.parseMemoSnapshot(JSON.stringify(value)), new RegExp(field));
  assert.equal(createCloudMemoClient(null).getStatusLabel(), '앱 업데이트 필요');
  let mode = 'offline';
  let account = 'available';
  const oldStatus = deferred();
  let checks = 0;
  const client = createCloudMemoClient({
    getStatus: async () => ++checks === 1 ? oldStatus.promise : { status: account, syncStatus: 'synced' },
    syncSnapshot: async () => {
      if (mode === 'offline') throw new Error('offline');
      return mode === 'malformed' ? '{"notes":null,"folders":[]}' : json;
    },
  });
  const labels = [];
  const unsubscribe = client.subscribe((value) => labels.push(value));
  const stale = client.refreshStatus();
  await assert.rejects(client.syncSnapshot(json), /offline/);
  oldStatus.resolve({ status: 'available', syncStatus: 'synced' });
  await stale;
  assert.equal(client.getStatusLabel(), '동기화 오류', 'Late status responses cannot erase a sync error');
  mode = 'online';
  await client.syncSnapshot(json);
  assert.equal(client.getStatusLabel(), '동기화됨', 'Retry success updates an already-open settings screen');
  assert.ok(labels.includes('동기화 중…'));
  mode = 'malformed';
  await assert.rejects(client.syncSnapshot(json), /Invalid memo data/);
  await client.refreshStatus();
  assert.equal(client.getStatusLabel(), '동기화 오류', 'Native success cannot hide invalid returned data');
  account = 'noAccount';
  await client.refreshStatus();
  assert.equal(client.getStatusLabel(), 'iCloud 로그인 필요');
  unsubscribe();
  const count = labels.length;
  account = 'restricted';
  await client.refreshStatus();
  assert.equal(labels.length, count, 'Unmounted subscribers receive no updates');
  console.log('Cloud client: retry recovery, stale status, invalid payloads, legacy data and unsubscribe passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
