import type { ReactNode, Ref } from "react";
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, View } from "react-native";
import type { StoredNote } from "@/lib/local-store";
import type { useNoteSearch } from "@/hooks/use-note-search";
import { EMPTY_TEXT_MATCHES } from "@/lib/note-search";
import { getNoteTextStyle, NOTE_TEXT_SIZE, NOTE_LINE_HEIGHT } from "@/lib/note-typography";
import { SearchNoteText } from "./note-search";
import { AutoLinkedText, NoteMarkdown } from "./note-markdown";
import { GlassButton, GLASS_BUTTON_SIZE } from "./glass-button";
import { GlassTextButton, TEXT_BUTTON_WIDTH } from "./glass-text-button";

import { getNoteColors } from "@/theme/note-colors";
import { NotePhotos } from "./note-photos";
import type { NotePhoto } from "@/lib/note-photos";

const ACCENT = "#E7A000";
const BUTTON_HEIGHT = GLASS_BUTTON_SIZE;

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Props = {
  note: StoredNote;
  reorderHandle: ReactNode;
  isDark: boolean;
  editing: boolean;
  reordering: boolean;
  editingText: string;
  editInputRef: Ref<NativeTextInput>;
  noteFontSize: number;
  markdownEnabled: boolean;
  hyperlinksEnabled: boolean;
  search: Pick<ReturnType<typeof useNoteSearch>, "visible" | "matchesByNote" | "selectedMatch" | "reportOffset">;
  onComplete: () => void;
  onEdit: () => void;
  onChangeText: (text: string) => void;
  onInputFocus: () => void;
  onRemovePhoto: (photo: NotePhoto) => void;
};

export function NoteCard({ note, reorderHandle, isDark, editing, reordering, editingText,
  editInputRef, noteFontSize, markdownEnabled, hyperlinksEnabled, search, onComplete, onEdit, onChangeText,
  onInputFocus, onRemovePhoto }: Props) {
  const noteTextStyle = getNoteTextStyle(noteFontSize);
  const colors = getNoteColors(isDark);
  return (
    <View
      key={note.id}
      style={[
        styles.organizingCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        editing && { backgroundColor: colors.editingCard },
      ]}
    >
      <View style={[styles.cardHeader, search.visible && { minHeight: BUTTON_HEIGHT }]}>
        <NativeText
          accessibilityLabel="메모 작성 또는 수정 시간"
          style={[
            styles.noteTimestamp,
            { color: colors.secondaryText },
          ]}
        >
          {formatTimestamp(note.timestamp)}
        </NativeText>
        <View style={styles.cardHeaderActions}>
          {!search.visible && !reordering && !editing && note.folderId === "todo" && note.state === "saved" && (
            <GlassButton label={`${note.text} 완료`} symbol="circle" tint={colors.todo}
              glassTint={colors.control}
              onPress={onComplete} />
          )}
          {!search.visible && !reordering && <GlassTextButton
            title={editing ? "완료" : "편집"}
            textColor={isDark ? "#FFFFFF" : "#000000"}
            width={TEXT_BUTTON_WIDTH}
            height={BUTTON_HEIGHT}
            glassTint={colors.control}
            onPress={onEdit}
          />}
          {reorderHandle}
        </View>
      </View>
      {editing && (
        <NativeTextInput
          ref={editInputRef}
          accessibilityLabel="메모 내용 편집"
          autoFocus
          multiline
          editable={!search.visible}
          value={editingText}
          onChangeText={onChangeText}
          onFocus={onInputFocus}
          scrollEnabled={false}
          selectionColor={ACCENT}
          style={[
            styles.editorInput,
            noteTextStyle,
            { color: colors.text },
            search.visible && { display: "none" },
          ]}
        />
      )}
      {search.visible ? (
        <SearchNoteText
          text={editing ? editingText : note.text}
          noteId={note.id}
          matches={search.matchesByNote.get(note.id) ?? EMPTY_TEXT_MATCHES}
          selectedStart={search.selectedMatch?.noteId === note.id ? search.selectedMatch.start : null}
          contentOffset={styles.organizingCard.marginTop}
          style={[styles.editorInput, noteTextStyle, { color: colors.text }]}
          onSelectedOffset={search.reportOffset}
        />
      ) : !editing ? (
        markdownEnabled ? (
          <NoteMarkdown text={note.text} fontSize={noteFontSize} isDark={isDark} hyperlinksEnabled={hyperlinksEnabled} />
        ) : hyperlinksEnabled ? (
          <AutoLinkedText text={note.text} fontSize={noteFontSize} isDark={isDark} />
        ) : (
          <NativeText selectable style={[styles.editorInput, noteTextStyle, { color: colors.text }]}>
            {note.text}
          </NativeText>
        )
      ) : null}
      <NotePhotos photos={note.photos} onRemove={editing && !search.visible ? onRemovePhoto : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  editorInput: {
    width: "100%",
    padding: 0,
    fontSize: NOTE_TEXT_SIZE.default,
    lineHeight: NOTE_LINE_HEIGHT,
    textAlignVertical: "top",
  },
  organizingCard: {
    marginTop: 24,
    marginHorizontal: 26,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noteTimestamp: {
    flexShrink: 1,
    fontSize: 13,
    marginRight: 8,
  },
});
