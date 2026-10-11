import type { StoredNote } from "./local-store";

// Only widget completions may overwrite running app state. Text edits, moves,
// restores (new generation), and manual trash ordering stay local.
export function mergeWidgetCompletions(current: StoredNote[], persisted: StoredNote[], now = Date.now()) {
  const disk = new Map(persisted.map((note) => [note.id, note]));
  const retained = current.filter((note) => note.state !== "trash" || note.deletedAt === undefined
    || now - note.deletedAt < 30 * 24 * 60 * 60 * 1000);
  let changed = retained.length !== current.length;
  const merged = retained.map((note) => {
    const saved = disk.get(note.id);
    if (note.state === "saved" && note.folderId === "todo" && saved?.state === "trash"
      && (note.todoGeneration ?? "legacy") === (saved.todoGeneration ?? "legacy")) {
      changed = true;
      return { ...note, state: "trash" as const, deletedAt: saved.deletedAt, sortOrder: saved.sortOrder };
    }
    return note;
  });
  return changed ? merged : current;
}

// At most one write is running. Replace adjacent pending saves with the latest
// snapshot; reads are barriers so foreground refreshes cannot overtake writes.
export function createMemoPersistence<T>(options: {
  save: (snapshot: T) => Promise<T>;
  load: () => Promise<T>;
  onSnapshot: (snapshot: T) => void;
  onError: (error: unknown, operation: "save" | "load") => void;
}) {
  type Task = { operation: "save"; snapshot: T } | { operation: "load" };
  const pending: Task[] = [];
  let running: Promise<void> | undefined;

  async function drain() {
    while (pending.length) {
      const task = pending.shift()!;
      try {
        const snapshot = task.operation === "save"
          ? await options.save(task.snapshot) : await options.load();
        options.onSnapshot(snapshot);
      } catch (error) {
        options.onError(error, task.operation);
      }
    }
  }

  function enqueue(task: Task) {
    const last = pending[pending.length - 1];
    if (task.operation === "save" && last?.operation === "save") pending[pending.length - 1] = task;
    else pending.push(task);
    return start();
  }

  function start(): Promise<void> {
    if (!running) {
      running = Promise.resolve().then(drain).finally(() => {
        running = undefined;
        if (pending.length) return start();
      });
    }
    return running;
  }

  return {
    save: (snapshot: T) => enqueue({ operation: "save", snapshot }),
    refresh: () => enqueue({ operation: "load" }),
  };
}
