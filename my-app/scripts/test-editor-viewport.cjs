/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', js)(name => dependencies[name], module.exports, module);
  return module.exports;
}
const geometry = load('lib/editor-viewport.ts');
const { caretLineRect, revealCaretOffset } = geometry;
const lines = [
  { text: '첫 줄\n', y: 0, height: 30 },
  { text: '가나다', y: 35, height: 30 },
  { text: '😀끝\n', y: 70, height: 30 },
  { text: '\u200b', y: 105, height: 30 },
];
const text = '첫 줄\n가나다😀끝\n';
assert.deepEqual(caretLineRect(text, 1, lines, 35), { top: 0, height: 35 });
assert.equal(caretLineRect(text, 4, lines, 35).top, 35);
assert.equal(caretLineRect(text, 7, lines, 35).top, 70);
assert.equal(caretLineRect(text, text.length, lines, 35).top, 105, 'A trailing empty line is measurable');
assert.equal(caretLineRect('', 0, [{ text: '\u200b', y: 0, height: 24 }], 35).top, 0);
assert.equal(caretLineRect('a\n\nb', 2, [
  { text: 'a', y: 0, height: 30 }, { text: '', y: 35, height: 30 }, { text: 'b\u200b', y: 70, height: 30 },
], 35).top, 35, 'A blank line works when native line text omits newline characters');
assert.equal(revealCaretOffset(300, 250, 35, 100, 500), 300, 'Visible middle cursor does not scroll to the text end');
assert.equal(revealCaretOffset(300, 50, 35, 100, 500), 250, 'Reveal a cursor above the toolbar');
assert.equal(revealCaretOffset(300, 490, 35, 100, 500), 325, 'Reveal a cursor obscured by bottom controls');
assert.equal(revealCaretOffset(0, -50, 35, 100, 500), 0);

const frames = new Map();
let nextFrame = 0;
const oldRequest = global.requestAnimationFrame, oldCancel = global.cancelAnimationFrame;
global.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
global.cancelAnimationFrame = id => frames.delete(id);
const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
try {
  const cleanups = [], listeners = [];
  let dragResets = 0, reorderResets = 0, reveals = 0;
  const scrolls = [];
  const { useNoteListResume } = load('hooks/use-note-list-resume.ts', {
    react: { useEffect: callback => cleanups.push(callback()) },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event, callback) => {
      listeners.push(callback); return { remove() { listeners.splice(listeners.indexOf(callback), 1); } };
    } } },
    './use-note-drag': { resetDragState() { dragResets++; } },
    './use-note-reorder': { resetReorderState() { reorderResets++; } },
  });
  useNoteListResume({ drag: {}, reorder: { scrollOffset: { get: () => 700 } },
    scrollRef: { current: { scrollTo: request => scrolls.push(request) } },
    contentHeight: { get: () => 900 }, viewportHeight: { get: () => 500 }, reveal: () => reveals++ });
  listeners[0]('active'); flush();
  assert.equal(scrolls.length, 0, 'Repeated active events do not disturb the editor');
  listeners[0]('background'); listeners[0]('active'); flush();
  assert.deepEqual(scrolls, [{ y: 400, animated: false }], 'Resume clamps a stale offset without replacing any input');
  assert.equal(dragResets, 1); assert.equal(reorderResets, 1); assert.equal(reveals, 1);
  listeners[0]('inactive'); listeners[0]('active');
  cleanups.forEach(cleanup => cleanup()); flush();
  assert.equal(scrolls.length, 1, 'Unmount cancels pending native scrolling');
  assert.equal(listeners.length, 0);
} finally {
  global.requestAnimationFrame = oldRequest;
  global.cancelAnimationFrame = oldCancel;
}
console.log('Editor viewport: wrapped cursor lines, emoji, trailing newline, bidirectional reveal and resume cleanup passed');
