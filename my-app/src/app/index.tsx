import { useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  useColorScheme,
} from "react-native";
import { Stack } from "expo-router";
import { DraggableNotes } from "@/components/draggable-notes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Button, Host, Icon, Text } from "@expo/ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  frame,
} from "@expo/ui/swift-ui/modifiers";

const ACCENT = "#E7A000";
const BUTTON_HEIGHT = 60;
const ICON_BUTTON_WIDTH = 60;
const ICON_SIZE = 22;
const ICON_LABEL_SIZE = 20;
const TEXT_BUTTON_WIDTH = 72;
const NOTE_FONT_SIZE = 22;
const NOTE_LINE_HEIGHT = 35;
const PLACEHOLDER =
  "떠오른 생각\n\n기록은 가볍게,\n정리는 나중에.\n\n지금 생각난 것을 먼저 적어두기.";

type Note = {
  id: number;
  text: string;
  timestamp: number;
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function GlassButton({
  label,
  symbol,
  width = ICON_BUTTON_WIDTH,
  tint = "#171717",
  glassTint = "#F2F2F5",
  onPress,
}: {
  label: string;
  symbol: "line.3.horizontal" | "ellipsis";
  width?: number;
  tint?: string;
  glassTint?: string;
  onPress?: () => void;
}) {
  const usesNativeGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

  return (
    <View style={[styles.glassButton, { width, height: BUTTON_HEIGHT }]}>
      {!usesNativeGlass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          isInteractive
          tintColor={glassTint}
          style={styles.glassSurface}
        />
      )}
      <Host
        matchContents
        ignoreSafeArea="all"
        seedColor={ACCENT}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Button
          onPress={onPress}
          variant="text"
          modifiers={[
            buttonStyle(usesNativeGlass ? "glass" : "plain"),
            buttonBorderShape("circle"),
            controlSize("large"),
            frame({ width, height: BUTTON_HEIGHT }),
          ]}
          style={{
            width,
            height: BUTTON_HEIGHT,
            paddingHorizontal: 0,
            paddingVertical: 0,
          }}
        >
          {Platform.OS === "ios" ? (
            <Icon
              name={symbol}
              size={ICON_SIZE}
              color={tint}
              modifiers={[
                frame({ width: ICON_LABEL_SIZE, height: ICON_LABEL_SIZE }),
              ]}
            />
          ) : (
            <Text textStyle={{ fontSize: ICON_SIZE, color: tint }}>
              {symbol === "ellipsis" ? "⋮" : "☰"}
            </Text>
          )}
        </Button>
      </Host>
    </View>
  );
}

function GlassTextButton({
  title,
  glassTint,
  onPress,
  width = TEXT_BUTTON_WIDTH,
  height = BUTTON_HEIGHT,
}: {
  title: string;
  glassTint: string;
  onPress: () => void;
  width?: number;
  height?: number;
}) {
  const usesNativeGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

  return (
    <View style={[styles.glassButton, styles.doneButton, { width, height }]}>
      {!usesNativeGlass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          isInteractive
          tintColor={glassTint}
          style={styles.glassSurface}
        />
      )}
      <Host
        matchContents
        ignoreSafeArea="all"
        seedColor={ACCENT}
        accessible
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Button
          onPress={onPress}
          variant="text"
          modifiers={[
            buttonStyle(usesNativeGlass ? "glass" : "plain"),
            buttonBorderShape("capsule"),
            frame({ width, height }),
            controlSize(height < BUTTON_HEIGHT ? "regular" : "large"),
          ]}
          style={{ ...styles.doneNativeButton, width, height }}
        >
          <Text textStyle={{ fontSize: 17, fontWeight: "600", color: ACCENT }}>
            {title}
          </Text>
        </Button>
      </Host>
    </View>
  );
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const inputRef = useRef<InstanceType<typeof NativeTextInput>>(null);
  const editInputRef = useRef<InstanceType<typeof NativeTextInput>>(null);
  const nextNoteId = useRef(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteTimestamp, setNoteTimestamp] = useState<number | undefined>();
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingTimestamp, setEditingTimestamp] = useState<number>(0);
  const isEditingCard = editingNoteId !== null;
  const hasContent = noteText.trim().length > 0;

  const handleTextChange = (text: string) => {
    setNoteText(text);
    setNoteTimestamp(text.trim().length > 0 ? Date.now() : undefined);
  };

  const finishEditing = () => {
    if (editingNoteId !== null) {
      setNotes((current) => current.map((note) =>
        note.id === editingNoteId
          ? { ...note, text: editingText, timestamp: editingTimestamp }
          : note,
      ));
      setEditingNoteId(null);
    } else {
      if (!hasContent) return;
      const note: Note = {
        id: nextNoteId.current++,
        text: noteText,
        timestamp: noteTimestamp ?? Date.now(),
      };
      setNotes((current) => [...current, note]);
      setNoteText("");
      setNoteTimestamp(undefined);
    }
    inputRef.current?.blur();
    editInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const resumeEditing = (note: Note) => {
    inputRef.current?.blur();
    if (editingNoteId !== null) {
      setNotes((current) => current.map((item) =>
        item.id === editingNoteId
          ? { ...item, text: editingText, timestamp: editingTimestamp }
          : item,
      ));
    }
    setEditingNoteId(note.id);
    setEditingText(note.text);
    setEditingTimestamp(note.timestamp);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View
        style={[
          styles.screen,
          { backgroundColor: isDark ? "#111110" : "#FFFFFF" },
        ]}
      >
        <View
          pointerEvents="box-none"
          style={[styles.toolbarOverlay, { top: insets.top + 12 }]}
        >
          <View pointerEvents="box-none" style={styles.toolbar}>
            <GlassButton
              label="서랍 메뉴"
              symbol="line.3.horizontal"
              tint={isDark ? "#F5F5F2" : "#171717"}
              glassTint={isDark ? "#343438" : "#F2F2F5"}
            />
            <View pointerEvents="box-none" style={styles.toolbarActions}>
              {hasContent && !isEditingCard && (
                <GlassTextButton
                  title="완료"
                  glassTint={isDark ? "#343438" : "#F2F2F5"}
                  onPress={finishEditing}
                />
              )}
              <GlassButton
                label="더 보기"
                symbol="ellipsis"
                tint={isDark ? "#F5F5F2" : "#171717"}
                glassTint={isDark ? "#343438" : "#F2F2F5"}
              />
            </View>
          </View>
        </View>

        <DraggableNotes
          notes={notes}
          isDark={isDark}
          editing={isEditingCard}
          paddingTop={insets.top + 12 + BUTTON_HEIGHT}
          paddingBottom={Math.max(insets.bottom, 18)}
          renderNote={(note) => (
            <View
              key={note.id}
              style={[
                styles.editorCard,
                styles.organizingCard,
                isDark && styles.darkOrganizingCard,
              ]}
            >
              <View style={styles.cardHeader}>
                <NativeText
                  accessibilityLabel="메모 작성 또는 수정 시간"
                  style={[
                    styles.noteTimestamp,
                    { color: isDark ? "#A1A1A6" : "#77777C" },
                  ]}
                >
                  {formatTimestamp(note.timestamp)}
                </NativeText>
                <GlassTextButton
                  title={editingNoteId === note.id ? "완료" : "편집"}
                  width={68}
                  height={52}
                  glassTint={isDark ? "#343438" : "#F2F2F5"}
                  onPress={() => {
                    if (editingNoteId === note.id) finishEditing();
                    else resumeEditing(note);
                  }}
                />
              </View>
              {editingNoteId === note.id ? (
                <NativeTextInput
                  ref={editInputRef}
                  accessibilityLabel="메모 내용 편집"
                  autoFocus
                  multiline
                  value={editingText}
                  onChangeText={(text) => {
                    setEditingText(text);
                    setEditingTimestamp(Date.now());
                  }}
                  scrollEnabled={false}
                  selectionColor={ACCENT}
                  style={[
                    styles.editorInput,
                    { color: isDark ? "#F5F5F2" : "#171717" },
                  ]}
                />
              ) : (
                <NativeText
                  style={[
                    styles.editorInput,
                    { color: isDark ? "#F5F5F2" : "#171717" },
                  ]}
                >
                  {note.text}
                </NativeText>
              )}
            </View>
          )}
        >
          <View style={[styles.editorCard, styles.editingCard]}>
            <NativeTextInput
              ref={inputRef}
              accessibilityLabel="새 메모 내용"
              accessibilityHint="떠오른 생각을 자유롭게 입력하세요"
              autoFocus
              editable={!isEditingCard}
              multiline
              onChangeText={handleTextChange}
              value={noteText}
              placeholder={PLACEHOLDER}
              placeholderTextColor={isDark ? "#747474" : "#A0A0A0"}
              scrollEnabled={false}
              selectionColor={ACCENT}
              style={[
                styles.editorInput,
                styles.newNoteInput,
                { color: isDark ? "#F5F5F2" : "#171717" },
              ]}
            />
          </View>
        </DraggableNotes>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  toolbarOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: "transparent",
  },
  toolbar: {
    minHeight: BUTTON_HEIGHT,
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  glassButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BUTTON_HEIGHT / 2,
  },
  glassSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: BUTTON_HEIGHT / 2,
  },
  doneButton: {
    width: TEXT_BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
  },
  doneNativeButton: {
    width: TEXT_BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  editorCard: {
    marginTop: 24,
    marginHorizontal: 26,
    paddingHorizontal: 0,
  },
  editingCard: {
    minHeight: 300,
    paddingTop: 10,
    paddingBottom: 10,
  },
  editorInput: {
    width: "100%",
    padding: 0,
    fontSize: NOTE_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    textAlignVertical: "top",
  },
  newNoteInput: {
    minHeight: 280,
  },
  organizingCard: {
    marginTop: 24,
    marginHorizontal: 26,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#CED1D6",
    borderRadius: 18,
  },
  darkOrganizingCard: {
    borderColor: "#4A4A4D",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  noteTimestamp: {
    flexShrink: 1,
    fontSize: 13,
    marginRight: 8,
  },
});
