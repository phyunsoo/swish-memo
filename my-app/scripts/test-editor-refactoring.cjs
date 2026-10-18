/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', js)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}

// Preserve state between renders and commit effect dependency changes.
function hookRuntime() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const effect = (callback, deps) => {
    const index = cursor++;
    const previous = slots[index];
    if (!deps || !previous || deps.some((value, i) => value !== previous.deps[i])) {
      effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { deps, cleanup: callback() };
      });
    }
  };
  return {
    react: {
      useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
      },
      useCallback: callback => callback,
      useMemo: callback => callback(),
      useEffect: effect,
      useLayoutEffect: effect,
    },
    render(callback) {
      cursor = 0;
      effects = [];
      const result = callback();
      effects.forEach(commit => commit());
      return result;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const { photoAttachmentTargetKey } = load('lib/photo-attachment-target.ts');
assert.notEqual(photoAttachmentTargetKey('new', 1), photoAttachmentTargetKey('new', 2));
assert.equal(photoAttachmentTargetKey(42, 1), photoAttachmentTargetKey(42, 2));

function attachmentSetup() {
  const runtime = hookRuntime();
  const prepared = deferred();
  const attached = [], cleaned = [], alerts = [], frames = [];
  let restored = 0;
  let imports = 0;
  const options = {
    target: 'new', targetKey: photoAttachmentTargetKey('new', 1), enabled: true,
    onAttach: (target, photos) => attached.push({ target, photos }),
    onRestoreFocus: () => { restored++; },
  };
  const { usePhotoAttachment } = load('hooks/use-photo-attachment.ts', {
    react: runtime.react,
    'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    '@/lib/note-photos': { importNotePhotos: assets => { imports++; return assets; } },
    '@/lib/photo-attachment-assets': {
      cleanupTemporaryPhotoAssets: assets => cleaned.push(...assets),
      preparePhotoAttachmentAssets: () => prepared.promise,
      pickPhotoAttachmentAssets: async () => [photo],
    },
    '../../modules/liquid-glass-wheel/src/runtime-platform': { isRunningOnMac: true },
  });
  global.requestAnimationFrame = callback => frames.push(callback);
  const render = () => runtime.render(() => usePhotoAttachment({ ...options }));
  return { runtime, prepared, attached, cleaned, alerts, frames, options, render,
    get restored() { return restored; }, get imports() { return imports; } };
}

const photo = { uri: 'mock://photo', width: 100, height: 80, temporary: true };

async function testAttachments() {
  for (const transition of ['save-draft', 'leave-and-return', 'disable-and-enable', 'unmount']) {
    const env = attachmentSetup();
    const hook = env.render();
    const pending = hook.attachDroppedPhotos([photo], env.options.targetKey);
    await Promise.resolve(); // Image sizing is now pending.
    if (transition === 'save-draft') {
      env.options.targetKey = photoAttachmentTargetKey('new', 2);
      env.render();
    } else if (transition === 'leave-and-return') {
      const originalKey = env.options.targetKey;
      env.options.targetKey = 'note:99'; env.options.target = 99; env.render();
      env.options.targetKey = originalKey; env.options.target = 'new'; env.render();
    } else if (transition === 'disable-and-enable') {
      env.options.enabled = false; env.render();
      env.options.enabled = true; env.render();
    } else {
      env.runtime.unmount();
    }
    env.prepared.resolve([photo]);
    await pending;
    env.frames.forEach(frame => frame());
    assert.equal(env.imports, 0, `${transition}: stale photos must not be copied`);
    assert.equal(env.attached.length, 0, `${transition}: stale photos must not be attached`);
    assert.equal(env.restored, 0, `${transition}: stale focus must not be restored`);
    assert.deepEqual(env.cleaned, [photo], `${transition}: temporary files must be cleaned`);
  }
  const env = attachmentSetup();
  const hook = env.render();
  await hook.attachDroppedPhotos([photo], 'draft:old');
  assert.deepEqual(env.cleaned, [photo], 'Late native drops are rejected and cleaned');
  const pending = hook.attachDroppedPhotos([photo], env.options.targetKey, 2);
  assert.equal(env.alerts.length, 1, 'Partial native failures are reported');
  await hook.attachDroppedPhotos([photo], env.options.targetKey);
  env.prepared.resolve([photo]);
  await pending;
  env.frames.forEach(frame => frame());
  assert.equal(env.attached.length, 1, 'A concurrent drop cannot attach twice');
  assert.equal(env.restored, 1, 'An unchanged editor restores focus after attachment');
  await env.render().attachDroppedPhotos([], env.options.targetKey, 1);
  assert.equal(env.alerts.length, 2, 'A completely failed native drop is reported');
}

function testEditor() {
  const runtime = hookRuntime();
  const draftRules = load('lib/note-draft.ts');
  const rules = load('lib/memo-rules.ts', { expo: { requireOptionalNativeModule: () => null } });
  const order = load('lib/note-order.ts', { './memo-rules': rules });
  const store = {
    notes: [{ id: 1, text: '기존', timestamp: 1, sortOrder: 9, folderId: null, state: 'draft' }],
    draft: { text: '새 내용', photos: [photo], timestamp: 5 }, draftSession: 1,
    setNotes(action) { store.notes = action(store.notes); },
    clearDraft() { store.draft = draftRules.emptyNoteDraft(); store.draftSession++; },
    allocateNoteId: () => 2,
  };
  const alerts = [];
  const { useNoteEditor } = load('hooks/use-note-editor.ts', {
    react: runtime.react, 'react-native': { Keyboard: { dismiss() {} }, Alert: { alert: (...args) => alerts.push(args) } },
    './use-memo-storage': { useMemoStorage: () => store },
    '@/lib/note-draft': draftRules, '@/lib/memo-rules': rules, '@/lib/note-order': order,
  });
  const render = () => runtime.render(useNoteEditor);
  render().createNote();
  assert.equal(store.notes[1].text, '새 내용');
  assert.deepEqual(store.notes[1].photos, [photo]);
  assert.equal(store.notes[1].sortOrder, 10);
  assert.equal(store.draftSession, 2);
  render().createNote();
  assert.equal(store.notes.length, 2, 'An empty draft is never saved as a note');
  assert.equal(store.draftSession, 3, 'Starting an empty draft still invalidates old attachments');
  const todo = { id: 3, text: '할 일', timestamp: 1, folderId: 'todo', state: 'saved' };
  store.notes.push(todo);
  render().resumeEditing(todo);
  render().changeEditingText('줄바꿈\n불가');
  assert.equal(render().finishEditing(), false);
  render().resumeEditing(store.notes[0]);
  assert.equal(render().editingNoteId, 3, 'Invalid todo edits cannot be bypassed by switching editors');
  assert.equal(store.notes[2].text, '할 일');
  render().changeEditingText('완료할 일');
  assert.equal(render().finishEditing(), true);
  assert.equal(store.notes[2].text, '완료할 일');
  assert.equal(render().editingNoteId, null);
}

function testReorder() {
  const runtime = hookRuntime();
  const frames = [], scrolls = [], orders = [];
  const geometry = load('lib/note-reorder-geometry.ts');
  const order = load('lib/note-order.ts', { './memo-rules': {} });
  const { useNoteReorder, updateReorderPosition } = load('hooks/use-note-reorder.ts', {
    react: runtime.react, 'react-native': {},
    'react-native-reanimated': {
      cancelAnimation() {},
      useAnimatedRef: () => runtime.react.useRef({ scrollTo() {} }),
      useSharedValue: initial => {
        let value = initial;
        return runtime.react.useRef({ get: () => value, set: next => { value = next; } }).current;
      },
      useAnimatedScrollHandler: callback => callback,
      useFrameCallback: callback => frames.push(callback),
      scrollTo: (_ref, _x, y) => scrolls.push(y),
    },
    '@/lib/note-order': order, '@/lib/note-reorder-geometry': geometry,
  });
  const controller = runtime.render(() => useNoteReorder({
    notes: [{ id: 1 }, { id: 2 }, { id: 3 }], reordering: true,
    paddingTop: 0, onReorder: ids => orders.push(ids),
  }));
  controller.registerLayout(1, 0, 100);
  controller.registerLayout(2, 100, 100);
  controller.registerLayout(3, 200, 100);
  const drag = controller.reorder;
  drag.active.set(1); drag.from.set(0); drag.startY.set(50);
  drag.pointerY.set(240); drag.holding.set(true);
  controller.viewportHeight.set(250); controller.contentHeight.set(600);
  updateReorderPosition(drag);
  assert.equal(drag.target.get(), 1);
  frames[0]({ timeSincePreviousFrame: 16 });
  assert.ok(scrolls[0] > 0, 'Holding at the bottom edge scrolls the list');
  controller.onScroll({ contentOffset: { y: 100 } });
  assert.equal(drag.target.get(), 2, 'Scroll movement participates in reorder targeting');
  controller.finishReorder(1, drag.target.get());
  assert.deepEqual(orders, [[2, 3, 1]], 'The visible order is committed after a drop');
  controller.finishReorder(1, 0);
  assert.equal(drag.active.get(), -1, 'Dropping in the original position resets the gesture');
}

(async () => {
  await testAttachments();
  testEditor();
  testReorder();
  console.log('Editor refactoring: attachment sessions, cleanup, partial failures, draft saves, todo validation and reorder auto-scroll passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
