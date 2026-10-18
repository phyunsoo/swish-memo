import { KebabMenu } from "./kebab-menu";
import { folderMenuActions } from "@/lib/kebab-menu-actions";

export type FolderKebabMenuProps = {
  onSearch: () => void;
  onSettings: () => void;
  onReorder: () => void;
  onEmptyTrash: () => void;
  showEmptyTrash: boolean;
  onRequestRenameFolder: () => void;
  onRequestEditFolderColor: () => void;
  onRequestEditFolderIcon: () => void;
  onDeleteFolder: () => void;
  showFolderActions: boolean;
  isDark: boolean;
};

export function FolderKebabMenu(props: FolderKebabMenuProps) {
  return <KebabMenu actions={folderMenuActions(props)} isDark={props.isDark} />;
}
