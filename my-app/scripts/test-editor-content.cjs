const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', js)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}

const { emptyNoteDraft, hasNoteContent, updateNoteDraft } = load('lib/note-draft.ts');
const photo = { fileName: 'sample.jpg', width: 1200, height: 800 };
let draft = updateNoteDraft(emptyNoteDraft(), { text: '메모', photos: [photo] }, 10);
draft = updateNoteDraft(draft, { text: '' }, 20);
assert.ok(hasNoteContent(draft), 'Clearing text must retain a photo-only draft');
assert.equal(draft.timestamp, 20, 'Photo-only drafts retain their edit timestamp');
draft = updateNoteDraft(draft, { photos: [] }, 30);
assert.equal(hasNoteContent(draft), false);
assert.equal(draft.timestamp, undefined, 'Removing all content clears the timestamp');
draft = updateNoteDraft(emptyNoteDraft(), { text: '텍스트', photos: [photo] }, 40);
draft = updateNoteDraft(draft, { photos: [] }, 50);
assert.equal(draft.text, '텍스트');
assert.equal(draft.timestamp, 50, 'Removing a photo retains the text and updates its timestamp');
assert.deepEqual(emptyNoteDraft(), { text: '', photos: [] }, 'Reset clears all draft content');

const { homeMenuActions, folderMenuActions } = load('lib/kebab-menu-actions.ts');
let selected;
const props = Object.fromEntries(['Settings', 'Search', 'Reorder', 'AttachPhotos', 'Delete', 'EmptyTrash', 'RequestRenameFolder', 'DeleteFolder']
  .map((name) => [`on${name}`, () => { selected = name; }]));
const home = homeMenuActions({ ...props, canAttachPhotos: true });
assert.deepEqual(home.map((action) => action.title), ['설정', '검색', '순서 바꾸기', '사진 첨부', '모두 삭제']);
assert.equal(home.at(-1).destructive, true, 'Delete stays last and keeps its destructive style');
home.find((action) => action.id === 'attachPhotos').onPress();
assert.equal(selected, 'AttachPhotos');
assert.equal(homeMenuActions({ ...props, canAttachPhotos: false }).find((action) => action.id === 'attachPhotos').disabled, true);
for (const showEmptyTrash of [false, true]) {
  for (const showFolderActions of [false, true]) {
    const actions = folderMenuActions({ ...props, showEmptyTrash, showFolderActions });
    assert.ok(!actions.some((action) => action.id === 'attachPhotos'), 'Folders never expose photo attachment');
    assert.equal(actions.some((action) => action.id === 'emptyTrash'), showEmptyTrash);
    assert.equal(actions.some((action) => action.id === 'renameFolder'), showFolderActions);
  }
}

const { resolvePhotoAttachmentTarget } = load('hooks/use-photo-attachment.ts', {
  react: {}, 'react-native': {}, 'expo-image-picker': {}, '@/lib/note-photos': {},
});
const notes = [{ id: 1, folderId: null }, { id: 2, folderId: 'todo' }];
assert.equal(resolvePhotoAttachmentTarget(null, 'home', notes), 'new');
assert.equal(resolvePhotoAttachmentTarget(1, 'home', notes), 1, 'Both buttons attach to the edited note');
assert.equal(resolvePhotoAttachmentTarget(null, 'folder-1', notes), null);
assert.equal(resolvePhotoAttachmentTarget(2, 'todo', notes), null);
assert.equal(resolvePhotoAttachmentTarget(99, 'home', notes), null, 'A removed editing target must not become a new draft');
console.log('Editor content: mixed drafts, timestamps, reset, menu order, destructive actions and attachment targets passed');
