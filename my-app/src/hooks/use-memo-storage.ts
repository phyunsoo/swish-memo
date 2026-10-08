import { useEffect, useRef, useState } from "react";
import { INITIAL_SNAPSHOT, loadSnapshot, saveSnapshot, type AppSnapshot, type Folder, type StoredNote } from "@/lib/local-store";

export function useMemoStorage() {
  const nextNoteId = useRef(0);
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [folders, setFolders] = useState<Folder[]>(INITIAL_SNAPSHOT.folders);
  const [noteText, setNoteText] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSnapshot().then((snapshot) => {
      if (!active) return;
      setFolders(snapshot.folders);
      setNotes(snapshot.notes);
      setNoteText(snapshot.draftText);
      nextNoteId.current = Math.max(0, ...snapshot.notes.map((note) => note.id + 1));
      setStorageReady(true);
    }).catch((error) => {
      console.warn("메모 저장소를 불러오지 못했습니다.", error);
      setStorageReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const snapshot: AppSnapshot = { folders, notes, draftText: noteText };
    void saveSnapshot(snapshot).catch((error) => console.warn("메모 저장에 실패했습니다.", error));
  }, [folders, notes, noteText, storageReady]);

  const allocateNoteId = () => nextNoteId.current++;

  return { notes, setNotes, folders, setFolders, noteText, setNoteText, allocateNoteId };
}
