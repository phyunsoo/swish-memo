import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { INITIAL_SNAPSHOT, loadSnapshot, saveSnapshot, type AppSnapshot, type Folder, type StoredNote } from "@/lib/local-store";
import { NOTE_TEXT_SIZE } from "@/lib/note-typography";

function useMemoStorageState() {
  const nextNoteId = useRef(0);
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [folders, setFolders] = useState<Folder[]>(INITIAL_SNAPSHOT.folders);
  const [noteText, setNoteText] = useState("");
  const [noteFontSize, setNoteFontSize] = useState<number>(NOTE_TEXT_SIZE.default);
  const [notePlaceholder, setNotePlaceholder] = useState(INITIAL_SNAPSHOT.notePlaceholder);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSnapshot().then((snapshot) => {
      if (!active) return;
      setFolders(snapshot.folders);
      setNotes(snapshot.notes);
      setNoteText(snapshot.draftText);
      setNoteFontSize(snapshot.noteFontSize);
      setNotePlaceholder(snapshot.notePlaceholder);
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
    const snapshot: AppSnapshot = { folders, notes, draftText: noteText, noteFontSize, notePlaceholder };
    void saveSnapshot(snapshot).catch((error) => console.warn("메모 저장에 실패했습니다.", error));
  }, [folders, notes, noteText, noteFontSize, notePlaceholder, storageReady]);

  const allocateNoteId = () => nextNoteId.current++;

  return { notes, setNotes, folders, setFolders, noteText, setNoteText, noteFontSize, setNoteFontSize, notePlaceholder, setNotePlaceholder, allocateNoteId };
}

const MemoStorageContext = createContext<ReturnType<typeof useMemoStorageState> | null>(null);

export function MemoStorageProvider({ children }: { children: ReactNode }) {
  const storage = useMemoStorageState();
  return <MemoStorageContext.Provider value={storage}>{children}</MemoStorageContext.Provider>;
}

export function useMemoStorage() {
  const storage = useContext(MemoStorageContext);
  if (!storage) throw new Error("useMemoStorage must be used inside MemoStorageProvider");
  return storage;
}
