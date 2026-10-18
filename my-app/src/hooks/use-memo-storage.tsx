import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { INITIAL_SNAPSHOT, loadSnapshot, saveSnapshot, subscribeToSyncedSnapshot, type AppSnapshot, type Folder, type StoredNote } from "@/lib/local-store";
import { NOTE_TEXT_SIZE } from "@/lib/note-typography";
import { Alert, AppState } from "react-native";
import { createMemoPersistence } from "@/lib/memo-persistence";
import type { NotePhoto } from "@/lib/note-photos";
import { mergeCloudSnapshots, normalizeSyncMetadata, updateNotes, updateFolders, type MemoEntities } from "@/lib/memo-sync";
import { emptyNoteDraft, updateNoteDraft } from "@/lib/note-draft";

type StorageStatus = "loading" | "ready" | "error";

function useMemoStorageState() {
  const nextNoteId = useRef(0);
  const [entities, setEntities] = useState<MemoEntities>(() => normalizeSyncMetadata({ notes: [], folders: INITIAL_SNAPSHOT.folders, syncTombstones: [] }));
  const { notes, folders, syncTombstones } = entities;
  const setNotes = useCallback((action: SetStateAction<StoredNote[]>) => {
    const now = Date.now();
    const creationToken = Math.random().toString(36).slice(2);
    setEntities((current) => updateNotes(current,
      typeof action === "function" ? action(current.notes) : action, now, creationToken));
  }, []);
  const setFolders = useCallback((action: SetStateAction<Folder[]>) => {
    const now = Date.now();
    const changeID = Math.random().toString(36).slice(2);
    setEntities((current) => updateFolders(current,
      typeof action === "function" ? action(current.folders) : action, now, changeID));
  }, []);
  const applySnapshot = useCallback((snapshot: AppSnapshot) => {
    setEntities((current) => {
      const next = mergeCloudSnapshots(current, snapshot);
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, []);
  const [draft, setDraft] = useState(emptyNoteDraft);
  const [draftSession, setDraftSession] = useState(0);
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
  const clearDraft = useCallback(() => {
    setDraft(emptyNoteDraft());
    setDraftSession((session) => session + 1);
  }, []);
  const [noteFontSize, setNoteFontSize] = useState<number>(NOTE_TEXT_SIZE.default);
  const [notePlaceholder, setNotePlaceholder] = useState(INITIAL_SNAPSHOT.notePlaceholder);
  const [markdownEnabled, setMarkdownEnabled] = useState(INITIAL_SNAPSHOT.markdownEnabled);
  const [hyperlinksEnabled, setHyperlinksEnabled] = useState(INITIAL_SNAPSHOT.hyperlinksEnabled);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("loading");
  const storageReady = storageStatus === "ready";
  const [persistence] = useState(() => createMemoPersistence<AppSnapshot>({
    save: saveSnapshot,
    load: loadSnapshot,
    onSnapshot: applySnapshot,
    onError: (error, operation) => console.warn(operation === "save"
      ? "메모 저장에 실패했습니다." : "위젯 완료 상태를 불러오지 못했습니다.", error),
  }));

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToSyncedSnapshot(applySnapshot);
    void loadSnapshot().then((snapshot) => {
      if (!active) return;
      setEntities({ notes: snapshot.notes, folders: snapshot.folders, syncTombstones: snapshot.syncTombstones });
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
    return () => { active = false; unsubscribe(); };
  }, [applySnapshot]);

  useEffect(() => {
    if (!storageReady) return;
    const snapshot: AppSnapshot = { folders, notes, draftText: draft.text, draftPhotos: draft.photos, noteFontSize, notePlaceholder, markdownEnabled, hyperlinksEnabled, syncTombstones };
    void persistence.save(snapshot);
  }, [folders, notes, syncTombstones, draft, noteFontSize, notePlaceholder, markdownEnabled, hyperlinksEnabled, storageReady, persistence]);

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

  return { notes, setNotes, folders, setFolders, draft, draftSession, changeDraftText, appendDraftPhotos, removeDraftPhoto, clearDraft, noteFontSize, setNoteFontSize, notePlaceholder, setNotePlaceholder, markdownEnabled, setMarkdownEnabled, hyperlinksEnabled, setHyperlinksEnabled, allocateNoteId, storageStatus };
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
