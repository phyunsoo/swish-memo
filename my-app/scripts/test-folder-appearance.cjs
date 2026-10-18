const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}

const colors = load('lib/folder-colors.ts');
const icons = load('lib/folder-icons.ts');
const layout = load('components/folder-picker-layout.ts');
const validation = load('lib/memo-validation.ts', { './folder-colors': colors });

function luminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

// Readability adjustments must preserve a color's hue, rather than immediately returning black/white.
assert.match(colors.folderColorFor('rgb-ff0000', false), /^#[1-9A-F][0-9A-F]0000$/);
assert.notEqual(colors.folderIconTint('rgb-00ff00', false), '#000000');
assert.notEqual(colors.folderIconTint('rgb-0000ff', true), '#FFFFFF');
for (const option of colors.FOLDER_COLOR_OPTIONS) {
  assert.ok(contrast(colors.folderColorFor(option.id, false), '#FFFFFF') >= 4.5, `${option.id}: light text contrast`);
  assert.ok(contrast(colors.folderColorFor(option.id, true), '#111110') >= 4.5, `${option.id}: dark text contrast`);
}

assert.equal(colors.FOLDER_COLOR_OPTIONS.length, 73);
assert.equal(new Set(colors.FOLDER_COLOR_OPTIONS.map(option => option.id)).size, 73);
assert.equal(colors.FOLDER_COLOR_OPTIONS[0].swatch, '#FFFFFF');
assert.equal(colors.FOLDER_COLOR_OPTIONS.at(-1).swatch, '#000000');
assert.equal(colors.folderColorSwatch(), '#E7A000');

// Saved IDs retain their RGB meaning, including previous palette positions and off-palette colors.
for (const [id, swatch] of Object.entries({ 'gradient-00': '#FFFFFF', 'gradient-09': '#FF0000', 'gradient-42': '#00FFAA', 'gradient-54': '#0000FF', 'gradient-72': '#000000', teal: '#14B8A6' })) {
  assert.ok(colors.isFolderColorId(id));
  assert.equal(colors.folderColorSwatch(id), swatch);
  const selected = colors.canonicalFolderColorId(id);
  assert.equal(colors.folderColorSwatch(selected), swatch, 'Opening/completing an editor must not round a stored color');
  assert.ok(colors.folderColorOptionsFor(id).some(option => option.id === selected && option.swatch === swatch));
}
assert.ok(colors.isFolderColorId('rgb-123456'), 'An RGB color survives future palette changes');
assert.equal(colors.folderColorSwatch('rgb-123456'), '#123456');
assert.equal(colors.FOLDER_COLOR_OPTIONS.length, 73, 'Showing a legacy current color must not mutate the palette');
for (const invalid of ['constructor', 'toString', '__proto__', 'rgb-xyzxyz', 'gradient-999', '', null]) {
  assert.equal(colors.isFolderColorId(invalid), false);
  assert.throws(() => validation.parseMemoSnapshot(JSON.stringify({ notes: [], folders: [{ id: 'a', name: 'a', kind: 'custom', createdAt: 1, color: invalid }] })));
}

const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: 'Fragment' };
const native = {
  StyleSheet: { create: value => value, absoluteFill: {}, hairlineWidth: 1 },
  View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal', ScrollView: 'ScrollView',
  useWindowDimensions: () => ({ height: 844 }),
};
const nativeGrid = Object.assign(props => jsx('Grid', props), { Row: 'GridRow' });
const pickerDependencies = {
  react: { Fragment: 'Fragment' }, 'react/jsx-runtime': runtime,
  'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
  '@expo/ui': {}, '@expo/ui/swift-ui': { Grid: nativeGrid }, '@expo/ui/swift-ui/modifiers': {},
  './folder-picker-layout': layout,
};
function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return descendants(node.type(node.props));
  return [node, ...descendants(node.props?.children)];
}
for (const platform of ['', '.ios']) {
  const { FolderPickerGrid } = load(`components/folder-picker-sheet${platform}.tsx`, pickerDependencies);
  const rendered = FolderPickerGrid({ items: icons.FOLDER_ICON_OPTIONS, keyForItem: item => item.symbol, renderItem: item => jsx('IconChoice', item) });
  const choices = descendants(rendered).filter(node => node.type === 'IconChoice');
  assert.equal(choices.length, 60, `${platform || 'fallback'}: every icon is rendered`);
  assert.equal(choices.at(-1).props.symbol, 'clipboard');
}
assert.equal(layout.folderPickerRows([...icons.FOLDER_ICON_OPTIONS, { symbol: 'extra' }]).flat().length, 61);

// The quick menu must recognize a destructive SF Symbol before platform name conversion.
const rowAppearance = load('components/folder-row-appearance.ts');
const geometry = load('components/quick-menu-geometry.ts', { './folder-row-appearance': rowAppearance });
const { FolderQuickMenu } = load('components/folder-quick-menu.tsx', {
  'react/jsx-runtime': runtime, 'react-native': native,
  'expo-symbols': { SymbolView: 'SymbolView' },
  'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useAnimatedStyle: callback => callback() },
  '@/lib/folder-icons': icons, '@/lib/folder-colors': colors,
  './folder-row-appearance': rowAppearance, './quick-menu-geometry': geometry,
});
const shared = value => ({ get: () => value });
const menu = { opacity: shared(1), selected: shared(-1), scrollOffset: shared(0), layout: shared({ width: 280, height: 200, left: 0, top: 0, listHeight: 100 }) };
for (const isDark of [false, true]) {
  const rendered = FolderQuickMenu({ menu, folders: [], isDark, isTrashView: false });
  const trash = descendants(rendered).find(node => node.type === 'SymbolView' && node.props.name?.ios === 'trash');
  assert.equal(trash.props.tintColor, rowAppearance.FOLDER_ROW.trash);
}

console.log('Folder appearance: hue/contrast, stable IDs, legacy colors, validation, 60 icons on both platforms and trash tint passed');
