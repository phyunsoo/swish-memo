import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, TextInput } from "react-native";
import { useMemoStorage } from "./use-memo-storage";
import { hasNoteContent } from "@/lib/note-draft";
import { isValidTodoText, updateNoteContent } from "@/lib/memo-rules";
import { nextNoteOrder } from "@/lib/note-order";
import type { StoredNote } from "@/lib/local-store";

export function useNoteEditor() {
  const { notes, setNotes, draft, clearDraft, allocateNoteId } = useMemoStorage();
  const inputRef = useRef<TextInput>(null);
  const editInputRef = useRef<TextInput>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingTimestamp, setEditingTimestamp] = useState(0);
  const [focusedNoteId, setFocusedNoteId] = useState<number | null>(null);
  const [activeEditor, setActiveEditor] = useState<"new" | number | null>(null);
  const [draftFocusRequest, setDraftFocusRequest] = useState(0);
  useEffect(() => {
    if (draftFocusRequest > 0) inputRef.current?.focus();
  }, [draftFocusRequest]);

  function saveEditingNote() {
    if (editingNoteId === null) return;
    setNotes((current) => updateNoteContent(current, editingNoteId, editingText, editingTimestamp));
  }

  function finishEditing() {
    if (editingNoteId !== null) {
      const note = notes.find((item) => item.id === editingNoteId);
      if (note?.folderId === "todo" && !isValidTodoText(editingText)) {
        Alert.alert("투두 형식을 확인해 주세요", "투두는 줄바꿈 없이 30자 이내로 작성해야 합니다.");
        return false;
      }
      saveEditingNote();
      setEditingNoteId(null);
    }
    inputRef.current?.blur();
    editInputRef.current?.blur();
    setActiveEditor(null);
    Keyboard.dismiss();
    return true;
  }

  function createNote() {
    if (hasNoteContent(draft)) {
      const note: StoredNote = {
        id: allocateNoteId(), ...draft, timestamp: draft.timestamp ?? Date.now(),
        folderId: null, state: "draft",
      };
      setNotes((current) => [...current, {
        ...note, sortOrder: nextNoteOrder(current.filter((item) => item.state === "draft")),
      }]);
    }
    // A fresh draft also invalidates attachments still processing for the previous one.
    clearDraft();
    inputRef.current?.blur();
    Keyboard.dismiss();
  }

  function resumeEditing(note: StoredNote) {
    if (!finishEditing()) return;
    setSelectedNoteId(note.id);
    setEditingNoteId(note.id);
    setEditingText(note.text);
    setEditingTimestamp(note.timestamp);
    setFocusedNoteId(note.id);
  }

  function changeEditingText(text: string) {
    setEditingText(text);
    setEditingTimestamp(Date.now());
  }

  function focusDraft() {
    setDraftFocusRequest((request) => request + 1);
  }

  return {
    inputRef, editInputRef, selectedNoteId, setSelectedNoteId,
    editingNoteId, setEditingNoteId, editingText, editingTimestamp, setEditingTimestamp,
    focusedNoteId, setFocusedNoteId, activeEditor, setActiveEditor,
    saveEditingNote, finishEditing, createNote, resumeEditing, changeEditingText, focusDraft,
  };
}
