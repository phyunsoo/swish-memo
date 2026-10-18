import type { ReactNode } from "react";

export const FOLDER_PICKER_COLUMNS = 5;
export const FOLDER_PICKER_CELL_SIZE = 48;
export const FOLDER_PICKER_GAP = 8;

export function folderPickerRows<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += FOLDER_PICKER_COLUMNS) {
    rows.push(items.slice(index, index + FOLDER_PICKER_COLUMNS));
  }
  return rows;
}

export type FolderPickerSheetProps = {
  visible: boolean;
  title: string;
  isDark: boolean;
  accentColor: string;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

export type FolderPickerGridProps<T> = {
  items: readonly T[];
  keyForItem: (item: T) => string;
  renderItem: (item: T) => ReactNode;
};
