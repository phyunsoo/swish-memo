const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/memo-persistence.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('exports', 'module', compiled)(loaded.exports, loaded);
const { createMemoPersistence, mergeWidgetCompletions } = loaded.exports;

async function main() {
  const calls = [], snapshots = [], errors = [];
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const queue = createMemoPersistence({
    async save(value) {
      calls.push(value);
      if (value === 1) await blocked;
      if (value === 'failed') throw new Error('disk unavailable');
      return value;
    },
    async load() { calls.push('read'); return 'disk'; },
    onSnapshot: (value) => snapshots.push(value),
    onError: (error, operation) => errors.push(operation),
  });
  const finished = queue.save(1);
  await Promise.resolve();
  queue.save(2);
  queue.save(3);
  queue.refresh();
  queue.save(4);
  queue.save(5);
  release();
  await finished;
  assert.deepEqual(calls, [1, 3, 'read', 5]);
  assert.deepEqual(snapshots, [1, 3, 'disk', 5]);
  const failed = queue.save('failed');
  queue.refresh();
  await failed;
  assert.deepEqual(errors, ['save']);
  assert.equal(snapshots.at(-1), 'disk');
  await queue.save(6);
  assert.equal(snapshots.at(-1), 6);
  const todo = { id: 1, text: '수정 중인 내용', timestamp: 42, state: 'saved', folderId: 'todo', todoGeneration: 'a', sortOrder: 1 };
  const completed = { ...todo, text: '이전 내용', state: 'trash', deletedAt: 100, sortOrder: 12 };
  const current = [todo];
  const merged = mergeWidgetCompletions(current, [completed], 200);
  assert.equal(merged[0].text, todo.text);
  assert.equal(merged[0].state, 'trash');
  assert.equal(merged[0].sortOrder, 12);
  assert.equal(mergeWidgetCompletions(current, [{ ...completed, todoGeneration: 'older' }], 200), current);
  const manualTrash = [{ ...completed, sortOrder: 0 }];
  assert.equal(mergeWidgetCompletions(manualTrash, [completed], 200), manualTrash);
  assert.deepEqual(mergeWidgetCompletions([completed], [], 100 + 30 * 24 * 60 * 60 * 1000), []);
  console.log('Memo persistence: coalescing, read barriers, failure recovery, completion order and generations passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
