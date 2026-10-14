import type { SFSymbol } from "expo-symbols";

export type KebabMenuAction = {
  id: string;
  title: string;
  systemImage: SFSymbol;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

type CommonActions = { onSettings: () => void; onSearch: () => void; onReorder: () => void };

function commonActions(props: CommonActions): KebabMenuAction[] {
  return [
    { id: "settings", title: "설정", systemImage: "gearshape", onPress: props.onSettings },
    { id: "search", title: "검색", systemImage: "magnifyingglass", onPress: props.onSearch },
    { id: "reorder", title: "순서 바꾸기", systemImage: "arrow.up.arrow.down", onPress: props.onReorder },
  ];
}

export function homeMenuActions(props: CommonActions & {
  onAttachPhotos: () => void; canAttachPhotos: boolean; onDelete: () => void;
}): KebabMenuAction[] {
  return [
    ...commonActions(props),
    { id: "attachPhotos", title: "사진 첨부", systemImage: "paperclip", disabled: !props.canAttachPhotos, onPress: props.onAttachPhotos },
    { id: "delete", title: "모두 삭제", systemImage: "trash", destructive: true, onPress: props.onDelete },
  ];
}

export function folderMenuActions(props: CommonActions & {
  showEmptyTrash: boolean; onEmptyTrash: () => void;
  showFolderActions: boolean; onRequestRenameFolder: () => void; onDeleteFolder: () => void;
}): KebabMenuAction[] {
  const actions = commonActions(props);
  if (props.showEmptyTrash) actions.push({ id: "emptyTrash", title: "휴지통 비우기", systemImage: "trash", destructive: true, onPress: props.onEmptyTrash });
  if (props.showFolderActions) actions.push(
    { id: "renameFolder", title: "폴더 이름 변경", systemImage: "pencil", onPress: props.onRequestRenameFolder },
    { id: "deleteFolder", title: "폴더 삭제", systemImage: "trash", destructive: true, onPress: props.onDeleteFolder },
  );
  return actions;
}
