const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/hooks/use-folder-drawer.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(enabled = true) {
  const state = { visible: false, keyboardDismissals: 0, animations: [], values: [] };
  const handlers = {};
  const gesture = {};
  for (const method of ['enabled', 'maxPointers', 'activeOffsetX', 'failOffsetY']) {
    gesture[method] = () => gesture;
  }
  for (const method of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
    gesture[method] = (callback) => { handlers[method] = callback; return gesture; };
  }
  const mocks = {
    react: {
      useCallback: (callback) => callback,
      useEffect: (callback) => { callback(); },
      useState: (initial) => [initial, (next) => { state.visible = next; }],
    },
    'react-native': {
      Keyboard: { dismiss: () => { state.keyboardDismissals++; } },
      AppState: { addEventListener: (_name, callback) => { state.onAppState = callback; return { remove() {} }; } },
      useWindowDimensions: () => ({ width: 400 }),
    },
    'react-native-gesture-handler': { Gesture: { Pan: () => gesture } },
    'react-native-reanimated': {
      ReduceMotion: { System: 'system' },
      cancelAnimation() {},
      useAnimatedStyle: (callback) => callback,
      useSharedValue: (initial) => {
        let value = initial;
        const shared = { get: () => value, set: (next) => { value = next; } };
        state.values.push(shared);
        return shared;
      },
      withSpring: (target, _config, finish) => {
        state.animations.push({ target, finish });
        return target;
      },
    },
    'react-native-worklets': { scheduleOnRN: (callback, ...args) => callback(...args) },
  };
  const loaded = { exports: {} };
  new Function('require', 'exports', 'module', compiled)((name) => {
    assert.ok(mocks[name], `Unexpected dependency: ${name}`);
    return mocks[name];
  }, loaded.exports, loaded);
  const drawer = loaded.exports.useFolderDrawer(enabled);
  return { drawer, handlers, state };
}

// Failed recognition of a short tap must not undo the dismiss animation.
{
  const { drawer, handlers, state } = setup();
  drawer.open();
  drawer.close();
  handlers.onFinalize({}, false);
  assert.deepEqual(state.animations.map((animation) => animation.target), [1, 0]);
  state.animations.at(-1).finish(true);
  assert.equal(state.visible, false);
}

// Opening is possible by distance or by a fast, short flick. Dismiss the
// keyboard once when the rightward drag becomes eligible, not on every frame.
for (const [distance, velocity] of [[220, 0], [25, 600]]) {
  const { handlers, state } = setup();
  handlers.onStart({});
  handlers.onUpdate({ translationX: 20 });
  handlers.onUpdate({ translationX: distance });
  handlers.onEnd({ translationX: distance, velocityX: velocity });
  handlers.onFinalize({}, true);
  assert.equal(state.visible, true);
  assert.equal(state.keyboardDismissals, 1);
  assert.equal(state.animations.at(-1).target, 1);
}

// A leftward closing drag and an interrupted drag retain their original rules.
{
  const { drawer, handlers, state } = setup();
  drawer.open();
  handlers.onStart({});
  handlers.onUpdate({ translationX: -220 });
  handlers.onFinalize({}, false);
  assert.equal(state.animations.at(-1).target, 1);
  handlers.onStart({});
  handlers.onUpdate({ translationX: -220 });
  handlers.onEnd({ translationX: -220, velocityX: 0 });
  handlers.onFinalize({}, true);
  const closing = state.animations.at(-1);
  assert.equal(closing.target, 0);
  closing.finish(false);
  assert.equal(state.visible, true);
  closing.finish(true);
  assert.equal(state.visible, false);
}

// A cancelled opening drag returns to closed; left swipes on a closed drawer
// must neither expose the panel nor dismiss the keyboard.
{
  const { handlers, state } = setup();
  handlers.onStart({});
  handlers.onUpdate({ translationX: -100 });
  handlers.onEnd({ translationX: -100, velocityX: -600 });
  handlers.onFinalize({}, true);
  assert.equal(state.keyboardDismissals, 0);
  assert.equal(state.animations.length, 0);
  handlers.onStart({});
  handlers.onUpdate({ translationX: 80 });
  handlers.onFinalize({}, false);
  assert.equal(state.animations.at(-1).target, 0);
  state.animations.at(-1).finish(true);
  assert.equal(state.visible, false);
}

// A stale close callback cannot hide a newly opened panel.
{
  const { drawer, state } = setup();
  drawer.open();
  drawer.close();
  const oldClose = state.animations.at(-1);
  drawer.open();
  oldClose.finish(true);
  assert.equal(state.visible, true);
}
// Backgrounding must reset both the panel and content translation, even mid-drag.
{
  const { handlers, state, drawer } = setup();
  handlers.onStart({});
  handlers.onUpdate({ translationX: 200 });
  state.onAppState('background');
  assert.equal(state.visible, false);
  assert.deepEqual(drawer.contentStyle().transform, [{ translateX: 0 }]);
  state.onAppState('active');
  assert.deepEqual(drawer.contentStyle().transform, [{ translateX: 0 }]);
}
console.log('Folder drawer: dismissal, swipes, cancellation, stale callbacks and foreground recovery passed');
