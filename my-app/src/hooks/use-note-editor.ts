import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, TextInput } from "react-native";
import { useMemoStorage } from "./use-memo-storage";
import { hasNoteContent } from "@/lib/note-draft";
import { isValidTodoText, newTodoGeneration } from "@/lib/memo-rules";
import { nextNoteOrder } from "@/lib/note-order";
import { persistEditorNote, type EditorSession } from "@/lib/editor-session";
import type { StoredNote } from "@/lib/local-store";
import type { NotePhoto } from "@/lib/note-photos";

export function useNoteEditor() {
  const { notes, setNotes, draft, clearDraft, allocateNoteId } = useMemoStorage();
  const inputRef = useRef<TextInput>(null);
  const editInputRef = useRef<TextInput>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<number | null>(null);
  const [session, setSession] = useState<EditorSession>({ kind: "idle" });
  const [draftFocusRequest, setDraftFocusRequest] = useState(0);
  const editingNoteId = session.kind === "note" ? session.note.id : null;
  const editingText = session.kind === "note" ? session.note.text : "";
  const activeEditor = session.kind === "draft" ? "new" : editingNoteId;
  const editorNotes = useMemo(() => session.kind === "note" && session.isNew
    && !notes.some((note) => note.id === session.note.id) ? [...notes, session.note] : notes, [notes, session]);
  useEffect(() => {
    if (draftFocusRequest > 0) inputRef.current?.focus();
  }, [draftFocusRequest]);

  const stopEditing = useCallback(() => setSession({ kind: "idle" }), []);

  function saveEditingNote() {
    setNotes((current) => persistEditorNote(current, session));
  }

  function commitSession() {
    if (session.kind === "note") {
      const emptyNewNote = session.isNew && !hasNoteContent(session.note);
      if (!emptyNewNote && session.note.folderId === "todo" && !isValidTodoText(session.note.text)) {
        Alert.alert("투두 형식을 확인해 주세요", "투두는 줄바꿈 없이 30자 이내로 작성해야 합니다.");
        return false;
      }
      saveEditingNote();
    }
    return true;
  }

  function finishEditing() {
    if (!commitSession()) return false;
    stopEditing();
    inputRef.current?.blur();
    editInputRef.current?.blur();
    Keyboard.dismiss();
    return true;
  }

  function createNote() {
    if (!finishEditing()) return;
    if (hasNoteContent(draft)) {
      const note: StoredNote = {
        id: allocateNoteId(), ...draft, timestamp: draft.timestamp ?? Date.now(),
        folderId: null, state: "draft",
      };
      setNotes((current) => [...current, {
        ...note, sortOrder: nextNoteOrder(current.filter((item) => item.state === "draft")),
      }]);
    }
    clearDraft();
  }

  function resumeEditing(note: StoredNote) {
    if (!finishEditing()) return;
    setSelectedNoteId(note.id);
    setFocusedNoteId(note.id);
    setSession({ kind: "note", note, isNew: false });
  }

  function createFolderNote(folderId: string) {
    if (!finishEditing()) return;
    const note: StoredNote = {
      id: allocateNoteId(), text: "", photos: [], timestamp: Date.now(), folderId, state: "saved",
      sortOrder: nextNoteOrder(notes.filter((item) => item.state === "saved" && item.folderId === folderId)),
      ...(folderId === "todo" ? { todoGeneration: newTodoGeneration() } : {}),
    };
    setSelectedNoteId(note.id);
    setFocusedNoteId(note.id);
    setSession({ kind: "note", note, isNew: true });
  }

  function changeEditingText(text: string) {
    if (session.kind !== "note") return;
    const next: EditorSession = { ...session, note: { ...session.note, text, timestamp: Date.now() } };
    setSession(next);
    setNotes((current) => persistEditorNote(current, next));
  }

  function changeEditingPhotos(noteId: number, update: (photos: NotePhoto[]) => NotePhoto[]) {
    if (session.kind === "note" && session.note.id === noteId) {
      const next: EditorSession = { ...session, note: { ...session.note, photos: update(session.note.photos ?? []), timestamp: Date.now() } };
      setSession(next);
      setNotes((current) => persistEditorNote(current, next));
    } else {
      setNotes((current) => current.map((note) => note.id === noteId
        ? { ...note, photos: update(note.photos ?? []), timestamp: Date.now() } : note));
    }
  }

  function activateDraft() {
    if (session.kind === "draft") return true;
    if (!commitSession()) return false;
    editInputRef.current?.blur();
    setSession({ kind: "draft" });
    return true;
  }

  function focusDraft() {
    if (activateDraft()) setDraftFocusRequest((request) => request + 1);
  }

  return {
    inputRef, editInputRef, selectedNoteId, setSelectedNoteId,
    editingNoteId, editingText, editorNotes,
    focusedNoteId, setFocusedNoteId, activeEditor, stopEditing, activateDraft,
    finishEditing, createNote, createFolderNote, resumeEditing, changeEditingText, changeEditingPhotos, focusDraft,
  };
}
