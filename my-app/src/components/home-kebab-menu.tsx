import { KebabMenu } from "./kebab-menu";
import { homeMenuActions } from "@/lib/kebab-menu-actions";

export type HomeKebabMenuProps = {
  onAttachPhotos: () => void;
  canAttachPhotos: boolean;
  onDelete: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onReorder: () => void;
  isDark: boolean;
};

export function HomeKebabMenu(props: HomeKebabMenuProps) {
  return <KebabMenu actions={homeMenuActions(props)} isDark={props.isDark} />;
}
