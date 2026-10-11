import { useMemoStorage } from "./use-memo-storage";
import { applyNoteOrder, moveNotesToDestination } from "@/lib/note-order";

export function useNoteActions() {
  const { setNotes, setFolders } = useMemoStorage();

  function completeTodo(noteId: number) {
    setNotes((current) => {
      const note = current.find((item) => item.id === noteId);
      if (!note || note.state !== "saved" || note.folderId !== "todo") return current;
      return moveNotesToDestination(current, [note], { folderId: "todo", state: "trash" });
    });
  }

  function reorderNotes(ids: number[], folderId: string) {
    setNotes((current) => applyNoteOrder(current, ids));
    if (folderId === "todo") setFolders((current) => current.map((folder) =>
      folder.id === "todo" ? { ...folder, noteOrder: "manual" } : folder));
  }

  return { completeTodo, reorderNotes };
}
