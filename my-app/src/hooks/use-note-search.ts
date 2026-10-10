import { useCallback, useMemo, useState } from "react";
import type { StoredNote } from "@/lib/local-store";
import { findTextMatches, type SearchScrollTarget, type TextMatch } from "@/lib/note-search";

export function useNoteSearch(notes: StoredNote[], editingNoteId: number | null, editingText: string) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [target, setTarget] = useState<SearchScrollTarget | null>(null);
  const { matchesByNote, matches } = useMemo(() => {
    const matchesByNote = new Map<number, TextMatch[]>();
    const matches: { noteId: number; start: number }[] = [];
    if (visible && query) {
      for (const note of notes) {
        const noteMatches = findTextMatches(note.id === editingNoteId ? editingText : note.text, query);
        matchesByNote.set(note.id, noteMatches);
        matches.push(...noteMatches.map((match) => ({ noteId: note.id, start: match.start })));
      }
    }
    return { matchesByNote, matches };
  }, [notes, editingNoteId, editingText, query, visible]);
  const total = matches.length;
  const activeIndex = Math.min(index, Math.max(0, total - 1));
  const selectedMatch = matches[activeIndex];
  // A new request also scrolls back to a result when there is only one match.
  const key = `${query}:${activeIndex}:${navigationVersion}`;

  const changeQuery = useCallback((query: string) => {
    setQuery(query);
    setIndex(0);
    setNavigationVersion(0);
    setTarget(null);
  }, []);
  const open = useCallback(() => { changeQuery(""); setVisible(true); }, [changeQuery]);
  const close = useCallback(() => { changeQuery(""); setVisible(false); }, [changeQuery]);
  const move = useCallback((direction: -1 | 1) => {
    if (!total) return;
    setTarget(null);
    setIndex((activeIndex + direction + total) % total);
    setNavigationVersion((version) => version + 1);
  }, [activeIndex, total]);
  const previous = useCallback(() => move(-1), [move]);
  const next = useCallback(() => move(1), [move]);
  const selectedNoteId = selectedMatch?.noteId;
  const reportOffset = useCallback((noteId: number, offset: number) => {
    if (noteId !== selectedNoteId) return;
    setTarget((current) => current?.key === key && current.noteId === noteId && current.offset === offset
      ? current : { noteId, offset, key });
  }, [key, selectedNoteId]);

  return { visible, query, total, activeIndex, selectedMatch, matchesByNote, target,
    open, close, changeQuery, previous, next, reportOffset };
}
