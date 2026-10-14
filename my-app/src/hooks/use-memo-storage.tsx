import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { INITIAL_SNAPSHOT, loadSnapshot, saveSnapshot, type AppSnapshot, type Folder, type StoredNote } from "@/lib/local-store";
import { NOTE_TEXT_SIZE } from "@/lib/note-typography";
import { Alert, AppState } from "react-native";
import { createMemoPersistence, mergeWidgetCompletions } from "@/lib/memo-persistence";
import type { NotePhoto } from "@/lib/note-photos";
import { emptyNoteDraft, updateNoteDraft } from "@/lib/note-draft";

type StorageStatus = "loading" | "ready" | "error";

function useMemoStorageState() {
  const nextNoteId = useRef(0);
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [folders, setFolders] = useState<Folder[]>(INITIAL_SNAPSHOT.folders);
  const [draft, setDraft] = useState(emptyNoteDraft);
  const changeDraftText = useCallback((text: string) => {
    setDraft((current) => updateNoteDraft(current, { text }));
  }, []);
  const appendDraftPhotos = useCallback((photos: NotePhoto[]) => {
    setDraft((current) => updateNoteDraft(current, { photos: [...current.photos, ...photos] }));
  }, []);
  const removeDraftPhoto = useCallback((photo: NotePhoto) => {
    setDraft((current) => updateNoteDraft(current, {
      photos: current.photos.filter((item) => item.fileName !== photo.fileName),
    }));
  }, []);
  const clearDraft = useCallback(() => setDraft(emptyNoteDraft()), []);
  const [noteFontSize, setNoteFontSize] = useState<number>(NOTE_TEXT_SIZE.default);
  const [notePlaceholder, setNotePlaceholder] = useState(INITIAL_SNAPSHOT.notePlaceholder);
  const [markdownEnabled, setMarkdownEnabled] = useState(INITIAL_SNAPSHOT.markdownEnabled);
  const [hyperlinksEnabled, setHyperlinksEnabled] = useState(INITIAL_SNAPSHOT.hyperlinksEnabled);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("loading");
  const storageReady = storageStatus === "ready";
  const [persistence] = useState(() => createMemoPersistence<AppSnapshot>({
    save: saveSnapshot,
    load: loadSnapshot,
    onSnapshot: (snapshot) => setNotes((current) => mergeWidgetCompletions(current, snapshot.notes)),
    onError: (error, operation) => console.warn(operation === "save"
      ? "메모 저장에 실패했습니다." : "위젯 완료 상태를 불러오지 못했습니다.", error),
  }));

  useEffect(() => {
    let active = true;
    void loadSnapshot().then((snapshot) => {
      if (!active) return;
      setFolders(snapshot.folders);
      setNotes(snapshot.notes);
      setDraft({ text: snapshot.draftText, photos: snapshot.draftPhotos });
      setNoteFontSize(snapshot.noteFontSize);
      setNotePlaceholder(snapshot.notePlaceholder);
      setMarkdownEnabled(snapshot.markdownEnabled);
      setHyperlinksEnabled(snapshot.hyperlinksEnabled);
      nextNoteId.current = Math.max(0, ...snapshot.notes.map((note) => note.id + 1));
      setStorageStatus("ready");
    }).catch((error) => {
      if (!active) return;
      setStorageStatus("error");
      console.warn("메모 저장소를 불러오지 못했습니다.", error);
      Alert.alert("메모를 불러오지 못했어요", "앱을 다시 실행해 주세요. 기존 데이터를 보호하기 위해 저장을 중지했습니다.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const snapshot: AppSnapshot = { folders, notes, draftText: draft.text, draftPhotos: draft.photos, noteFontSize, notePlaceholder, markdownEnabled, hyperlinksEnabled };
    void persistence.save(snapshot);
  }, [folders, notes, draft, noteFontSize, notePlaceholder, markdownEnabled, hyperlinksEnabled, storageReady, persistence]);

  useEffect(() => {
    if (!storageReady) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void persistence.refresh();
    });
    return () => subscription.remove();
  }, [storageReady, persistence]);

  const allocateNoteId = () => {
    nextNoteId.current = Math.max(Date.now(), nextNoteId.current + 1);
    return nextNoteId.current;
  };

  return { notes, setNotes, folders, setFolders, draft, changeDraftText, appendDraftPhotos, removeDraftPhoto, clearDraft, noteFontSize, setNoteFontSize, notePlaceholder, setNotePlaceholder, markdownEnabled, setMarkdownEnabled, hyperlinksEnabled, setHyperlinksEnabled, allocateNoteId, storageStatus };
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
