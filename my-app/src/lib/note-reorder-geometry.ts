export type ReorderLayout = { id: number; y: number; height: number };

export function reorderTargetIndex(layouts: ReorderLayout[], noteId: number, from: number, delta: number) {
  "worklet";
  const dragged = layouts[from];
  if (!dragged) return from;
  const center = dragged.y + dragged.height / 2 + delta;
  let target = 0;
  for (const item of layouts) {
    if (item.id !== noteId && center > item.y + item.height / 2) target++;
  }
  return target;
}

export function reorderDestinationOffset(layouts: ReorderLayout[], from: number, target: number) {
  "worklet";
  let offset = 0;
  if (target > from) {
    for (let index = from + 1; index <= target; index++) offset += layouts[index]?.height ?? 0;
  } else if (target < from) {
    for (let index = target; index < from; index++) offset -= layouts[index]?.height ?? 0;
  }
  return offset;
}

export function synchronizeNoteLayouts(cache: Map<number, ReorderLayout>, ids: number[]) {
  const visible = new Set(ids);
  for (const id of cache.keys()) {
    if (!visible.has(id)) cache.delete(id);
  }
  const layouts: ReorderLayout[] = [];
  for (const id of ids) {
    const layout = cache.get(id);
    if (layout) layouts.push(layout);
  }
  return layouts;
}
