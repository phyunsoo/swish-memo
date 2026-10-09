import { FOLDER_ROW } from "./folder-row-appearance";

export const MENU_PADDING = 8;
export const MENU_DIVIDER = 16;
export const MENU_HINT_HEIGHT = 28;
export const PREVIEW_HEIGHT = 112;
export const PREVIEW_GAP = 12;
export const EDGE_ZONE = 24;
export const ROW_STEP = FOLDER_ROW.height + FOLDER_ROW.gap;

export type MenuLayout = {
  left: number;
  top: number;
  width: number;
  listHeight: number;
  height: number;
  previewTop: number;
  previewHeight: number;
};

export function menuContentHeight(folderCount: number) {
  "worklet";
  return Math.max(0, folderCount * ROW_STEP - FOLDER_ROW.gap);
}

export function menuMaxScrollOffset(folderCount: number, listHeight: number) {
  "worklet";
  return Math.max(0, menuContentHeight(folderCount) - listHeight);
}

export function menuLayout(x: number, y: number, width: number, height: number,
  topInset: number, bottomInset: number, folderCount: number): MenuLayout {
  "worklet";
  const top = topInset + 8;
  const bottom = height - bottomInset - 8;
  const available = bottom - top;
  const previewHeight = Math.min(PREVIEW_HEIGHT, Math.max(48, available - PREVIEW_GAP - MENU_PADDING * 2 - MENU_DIVIDER - FOLDER_ROW.height - FOLDER_ROW.height));
  const visibleRows = Math.max(1, Math.min(6, folderCount,
    Math.floor((available - previewHeight - PREVIEW_GAP - MENU_PADDING * 2 - MENU_HINT_HEIGHT * 2 - MENU_DIVIDER - FOLDER_ROW.height + FOLDER_ROW.gap) / ROW_STEP)));
  const listHeight = menuContentHeight(folderCount === 0 ? 0 : visibleRows);
  const menuHeight = MENU_PADDING * 2 + MENU_HINT_HEIGHT * 2 + listHeight + MENU_DIVIDER + FOLDER_ROW.height;
  const groupHeight = previewHeight + PREVIEW_GAP + menuHeight;
  const menuWidth = Math.min(280, width - 32);
  // Keep the menu below the finger and shift it only as far as needed to fit.
  const desiredTop = y + 24 - previewHeight - PREVIEW_GAP;
  const groupTop = Math.max(top, Math.min(bottom - groupHeight, desiredTop));
  return {
    left: Math.max(16, Math.min(width - menuWidth - 16, x - menuWidth / 2)),
    top: groupTop + previewHeight + PREVIEW_GAP,
    width: menuWidth,
    listHeight,
    height: menuHeight,
    previewTop: groupTop,
    previewHeight,
  };
}

export function menuScrollDirection(x: number, y: number, layout: MenuLayout,
  offset: number, folderCount: number, previousDirection = 0) {
  "worklet";
  if (x < layout.left || x >= layout.left + layout.width) return 0;
  const localY = y - layout.top - MENU_PADDING;
  const listTop = MENU_HINT_HEIGHT;
  const listBottom = listTop + layout.listHeight;
  if (localY < 0 || localY >= listBottom + MENU_HINT_HEIGHT) return 0;
  const maxOffset = menuMaxScrollOffset(folderCount, layout.listHeight);
  const edgeZone = Math.min(EDGE_ZONE, layout.listHeight / 4);
  if (localY < listTop + edgeZone && (offset > 0 || previousDirection === -1)) return -1;
  if (localY >= listBottom - edgeZone && (offset < maxOffset || previousDirection === 1)) return 1;
  return 0;
}

export function menuTargetAt(x: number, y: number, layout: MenuLayout,
  offset: number, folderCount: number) {
  "worklet";
  if (x < layout.left + MENU_PADDING || x >= layout.left + layout.width - MENU_PADDING) return -1;
  const localY = y - layout.top - MENU_PADDING - MENU_HINT_HEIGHT;
  const trashTop = layout.listHeight + MENU_HINT_HEIGHT + MENU_DIVIDER;
  if (localY >= trashTop && localY < trashTop + FOLDER_ROW.height) return folderCount;
  if (localY < 0 || localY >= layout.listHeight || menuScrollDirection(x, y, layout, offset, folderCount) !== 0) return -1;
  const contentY = localY + offset;
  const index = Math.floor(contentY / ROW_STEP);
  return index < folderCount && contentY % ROW_STEP < FOLDER_ROW.height ? index : -1;
}
