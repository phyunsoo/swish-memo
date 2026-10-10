import { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { DraggableNotes } from "@/components/draggable-notes";
import type { StoredNote } from "@/lib/local-store";
import { useMemoStorage } from "@/hooks/use-memo-storage";
import { FolderDrawer } from "@/components/folder-drawer";
import { hasFolderName, isValidTodoText, updateNoteContent } from "@/lib/memo-rules";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Button, Host, Text } from "@expo/ui";
import { GlassButton, GLASS_BUTTON_SIZE } from "@/components/glass-button";
import { HomeKebabMenu } from "@/components/home-kebab-menu";
import { FolderKebabMenu } from "@/components/folder-kebab-menu";
import { getNoteTextStyle, NOTE_TEXT_SIZE, NOTE_LINE_HEIGHT } from "@/lib/note-typography";
import { useAppearance } from "@/lib/appearance";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  frame,
} from "@expo/ui/swift-ui/modifiers";

const ACCENT = "#E7A000";
const BUTTON_HEIGHT = GLASS_BUTTON_SIZE;
const TEXT_BUTTON_WIDTH = 72;
const DRAWER_SPRING = { duration: 500, dampingRatio: 0.8, reduceMotion: ReduceMotion.System };

type Note = StoredNote;

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(windowWidth * 0.84, 360);
  const router = useRouter();
  const { isDark } = useAppearance();
  const inputRef = useRef<InstanceType<typeof NativeTextInput>>(null);
  const editInputRef = useRef<InstanceType<typeof NativeTextInput>>(null);
  const { notes, setNotes, folders, setFolders, noteText, setNoteText, noteFontSize, notePlaceholder, allocateNoteId } = useMemoStorage();
  const noteTextStyle = getNoteTextStyle(noteFontSize);
  const [noteTimestamp, setNoteTimestamp] = useState<number | undefined>();
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingTimestamp, setEditingTimestamp] = useState<number>(0);
  const [focusedNoteId, setFocusedNoteId] = useState<number | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerProgress = useSharedValue(0);
  const drawerGestureStart = useSharedValue(0);
  const drawerGestureAllowed = useSharedValue(false);
  const [activeView, setActiveView] = useState("home");
  const isEditingCard = editingNoteId !== null;
  const hasContent = noteText.trim().length > 0;
  const appShiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerProgress.get() * drawerWidth }],
  }));
  const drawerPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (drawerProgress.get() - 1) * drawerWidth }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: drawerProgress.get() * 0.18 }));

  const openDrawer = () => {
    setDrawerVisible(true);
    drawerProgress.set(withSpring(1, DRAWER_SPRING));
  };

  const closeDrawer = () => {
    drawerProgress.set(withSpring(0, DRAWER_SPRING, (finished) => {
      if (finished) scheduleOnRN(setDrawerVisible, false);
    }));
  };

  const drawerPanGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      const isOpen = drawerProgress.get() > 0.01;
      drawerGestureStart.set(drawerProgress.get());
      drawerGestureAllowed.set(isOpen);
    })
    .onUpdate((event) => {
      if (!drawerGestureAllowed.get()) return;
      const progress = drawerGestureStart.get() + event.translationX / drawerWidth;
      drawerProgress.set(Math.max(0, Math.min(1, progress)));
    })
    .onEnd((event) => {
      if (!drawerGestureAllowed.get()) return;
      const progress = drawerGestureStart.get() + event.translationX / drawerWidth;
      const shouldOpen = event.velocityX > 450
        ? true
        : event.velocityX < -450
          ? false
          : progress >= 0.5;
      drawerProgress.set(withSpring(shouldOpen ? 1 : 0, DRAWER_SPRING, (finished) => {
        if (finished && !shouldOpen) scheduleOnRN(setDrawerVisible, false);
      }));
    })
    .onFinalize((_event, success) => {
      if (!success && drawerGestureAllowed.get()) {
        const restoreOpen = drawerGestureStart.get() >= 0.5;
        drawerProgress.set(withSpring(restoreOpen ? 1 : 0, DRAWER_SPRING, (finished) => {
          if (finished && !restoreOpen) scheduleOnRN(setDrawerVisible, false);
        }));
      }
      drawerGestureAllowed.set(false);
    });

  const handleTextChange = (text: string) => {
    setNoteText(text);
    setNoteTimestamp(text.trim().length > 0 ? Date.now() : undefined);
  };

  const createFolder = () => {
    if (folders.length >= 12) {
      Alert.alert("폴더 한도", "기본 폴더를 포함해 최대 12개까지 만들 수 있습니다.");
      return;
    }
    if (Platform.OS !== "ios") {
      Alert.alert("폴더 추가", "사용자 폴더 관리는 iPhone에서 사용할 수 있습니다.");
      return;
    }
    Alert.prompt("새 폴더", "폴더 이름을 입력하세요.", (rawName) => {
      const name = rawName.trim();
      if (!name) return;
      if (hasFolderName(folders, name)) {
        Alert.alert("이미 있는 폴더", "같은 이름의 폴더가 있습니다.");
        return;
      }
      const folder = { id: `folder-${Date.now()}`, name, kind: "custom" as const, createdAt: Date.now() };
      setFolders((current) => [...current, folder]);
    }, "plain-text");
  };

  const onDrop = (noteId: number, targetId: number) => {
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;
    const trashTarget = targetId === folders.length;
    const targetFolder = targetId < folders.length ? folders[targetId] : undefined;
    if (targetFolder?.id === "todo" && !isValidTodoText(note.text)) {
      Alert.alert("투두로 저장할 수 없어요", "투두는 줄바꿈 없이 30자 이내로 작성해야 합니다.");
      return;
    }
    const folderId = targetFolder?.id ?? null;
    const state = trashTarget ? "trash" : "saved";
    if (trashTarget && activeView === "trash" && note.state === "trash") {
      setNotes((current) => current.filter((item) => item.id !== noteId));
    } else {
      setNotes((current) => current.map((item) => item.id === noteId
        ? { ...item, folderId, state, timestamp: Date.now() }
        : item));
    }
    setNoteText("");
    setNoteTimestamp(undefined);
    setEditingNoteId(null);
    setFocusedNoteId(null);
    Keyboard.dismiss();
  };

  const confirmMoveAllDraftsToTrash = () => {
    Alert.alert("모두 삭제", "작성 화면의 모든 메모를 휴지통으로 이동할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "확인",
        style: "destructive",
        onPress: () => {
          const now = Date.now();
          const unsavedNote: StoredNote | null = noteText.trim() ? {
            id: allocateNoteId(),
            text: noteText,
            timestamp: noteTimestamp ?? now,
            folderId: null,
            state: "trash",
          } : null;
          setNotes((current) => {
            const updated = current.map((note) => {
              if (note.state !== "draft" && note.id !== focusedNoteId && note.id !== editingNoteId) return note;
              const text = note.id === editingNoteId ? editingText : note.text;
              return { ...note, text, folderId: null, state: "trash" as const, timestamp: now };
            });
            return unsavedNote ? [...updated, unsavedNote] : updated;
          });
          setNoteText("");
          setNoteTimestamp(undefined);
          setEditingNoteId(null);
          setFocusedNoteId(null);
          Keyboard.dismiss();
        },
      },
    ]);
  };

  const openSettings = () => { Keyboard.dismiss(); router.push("/settings"); };

  const saveEditingNote = () => {
    if (editingNoteId === null) return;
    setNotes((current) => updateNoteContent(current, editingNoteId, editingText, editingTimestamp));
  };

  const finishEditing = () => {
    if (editingNoteId !== null) {
      const currentNote = notes.find((note) => note.id === editingNoteId);
      if (currentNote?.folderId === "todo" && !isValidTodoText(editingText)) {
        Alert.alert("투두 형식을 확인해 주세요", "투두는 줄바꿈 없이 30자 이내로 작성해야 합니다.");
        return;
      }
      saveEditingNote();
      setEditingNoteId(null);
    } else {
      if (!hasContent) return;
      const note: Note = {
        id: allocateNoteId(),
        text: noteText,
        timestamp: noteTimestamp ?? Date.now(),
        folderId: null,
        state: "draft",
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
      saveEditingNote();
    }
    setEditingNoteId(note.id);
    setEditingText(note.text);
    setEditingTimestamp(note.timestamp);
    setFocusedNoteId(note.id);
  };

  const visibleNotes = notes.filter((note) => {
    if (activeView === "home") return note.state === "draft" || note.id === focusedNoteId;
    if (activeView === "trash") return note.state === "trash";
    return note.state === "saved" && note.folderId === activeView;
  }).sort((first, second) => first.timestamp - second.timestamp);
  const activeFolder = folders.find((folder) => folder.id === activeView);
  const viewTitle = activeView === "home" ? "작성 화면"
    : activeView === "trash" ? "휴지통"
      : activeFolder?.name ?? "폴더";

  const selectView = (view: string) => {
    if (editingNoteId !== null) {
      saveEditingNote();
      setEditingNoteId(null);
    }
    setActiveView(view);
    setFocusedNoteId(null);
    closeDrawer();
    Keyboard.dismiss();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <GestureDetector gesture={drawerPanGesture}>
      <View style={[styles.screen, { backgroundColor: isDark ? "#111110" : "#FFFFFF" }]}>
        <Animated.View style={[styles.appContent, appShiftStyle]}>
        <View
          pointerEvents="box-none"
          style={[
            styles.toolbarOverlay,
            activeView === "home"
              ? { top: insets.top + 12 }
              : {
                  top: 0,
                  height: insets.top + BUTTON_HEIGHT + 24,
                  paddingTop: insets.top + 12,
                  paddingBottom: 12,
                  backgroundColor: isDark ? "#111110" : "#FFFFFF",
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: isDark ? "#3A3A3C" : "#D8D8DC",
                },
          ]}
        >
          <View pointerEvents="box-none" style={styles.toolbar}>
            <GlassButton
              label="폴더 메뉴"
              symbol="folder"
              tint={isDark ? "#F5F5F2" : "#171717"}
              glassTint={isDark ? "#343438" : "#F2F2F5"}
              onPress={openDrawer}
            />
            {activeView !== "home" && (
              <View pointerEvents="none" style={styles.toolbarTitleWrap}>
                <NativeText numberOfLines={1} style={[styles.toolbarTitle, { color: isDark ? "#F5F5F2" : "#171717" }]}>
                  {viewTitle}
                </NativeText>
              </View>
            )}
            <View pointerEvents="box-none" style={styles.toolbarActions}>
              {hasContent && !isEditingCard && (
                <GlassTextButton
                  title="완료"
                  glassTint={isDark ? "#343438" : "#F2F2F5"}
                  onPress={finishEditing}
                />
              )}
              {activeView === "home" ? (
                <HomeKebabMenu isDark={isDark} onDelete={confirmMoveAllDraftsToTrash} onSettings={() => { Keyboard.dismiss(); router.push("/settings"); }} />
              ) : (
                <FolderKebabMenu isDark={isDark} onSettings={openSettings} />
              )}
            </View>
          </View>
        </View>

        <DraggableNotes
          notes={visibleNotes}
          folders={folders}
          isDark={isDark}
          noteFontSize={noteFontSize}
          isTrashView={activeView === "trash"}
          editing={isEditingCard}
          onDrop={onDrop}
          paddingTop={activeView === "home"
            ? insets.top + 12 + BUTTON_HEIGHT
            : insets.top + BUTTON_HEIGHT}
          paddingBottom={Math.max(insets.bottom, 18)}
          header={activeView !== "home" ? (
            <View style={[styles.viewHeading, visibleNotes.length === 0 && styles.emptyViewHeading]}>
              {visibleNotes.length === 0 && <NativeText style={{ color: isDark ? "#A1A1A6" : "#77777C" }}>메모가 없습니다.</NativeText>}
            </View>
          ) : null}
          renderNote={(note) => (
            <View
              key={note.id}
              style={[
                styles.editorCard,
                styles.organizingCard,
                isDark && styles.darkOrganizingCard,
                editingNoteId === note.id && { backgroundColor: "#FFFFFF" },
              ]}
            >
              <View style={styles.cardHeader}>
                <NativeText
                  accessibilityLabel="메모 작성 또는 수정 시간"
                  style={[
                    styles.noteTimestamp,
                    { color: "#77777C" },
                  ]}
                >
                  {formatTimestamp(note.timestamp)}
                </NativeText>
                <GlassTextButton
                  title={editingNoteId === note.id ? "완료" : "편집"}
                  width={68}
                  height={52}
                  glassTint="#F2F2F5"
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
                    noteTextStyle,
                    { color: "#171717" },
                  ]}
                />
              ) : (
                <NativeText
                  style={[
                    styles.editorInput,
                    noteTextStyle,
                    { color: "#171717" },
                  ]}
                >
                  {note.text}
                </NativeText>
              )}
            </View>
          )}
        >
          {activeView === "home" ? (
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
                scrollEnabled={false}
                selectionColor={ACCENT}
                style={[styles.editorInput, styles.newNoteInput, noteTextStyle, { color: isDark ? "#F5F5F2" : "#171717" }]}
              />
              {noteText.length === 0 && (
                <View pointerEvents="none" style={styles.newNotePlaceholderWrap}>
                  <NativeText style={[styles.editorInput, noteTextStyle, { color: isDark ? "#747474" : "#A0A0A0" }]}>
                    {notePlaceholder}
                  </NativeText>
                </View>
              )}
            </View>
          ) : null}
        </DraggableNotes>
        </Animated.View>

        <FolderDrawer
          visible={drawerVisible}
          width={drawerWidth}
          isDark={isDark}
          topInset={insets.top}
          notes={notes}
          folders={folders}
          activeView={activeView}
          panelStyle={drawerPanelStyle}
          scrimStyle={scrimStyle}
          onClose={closeDrawer}
          onSelectView={selectView}
          onCreateFolder={createFolder}
          onReorderFolders={(ids) => setFolders((current) => {
            const custom = new Map(current.filter((folder) => folder.kind === "custom").map((folder) => [folder.id, folder]));
            const ordered = ids.flatMap((id) => {
              const folder = custom.get(id);
              custom.delete(id);
              return folder ? [folder] : [];
            });
            ordered.push(...custom.values());
            let index = 0;
            return current.map((folder) => folder.kind === "custom" ? ordered[index++] : folder);
          })}
        />
      </View>
      </GestureDetector>
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
    justifyContent: "flex-end",
  },
  toolbar: {
    position: "relative",
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
  toolbarTitleWrap: {
    position: "absolute",
    left: 76,
    right: 76,
    height: BUTTON_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarTitle: { fontSize: 18, fontWeight: "600", textAlign: "center" },
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
    fontSize: NOTE_TEXT_SIZE.default,
    lineHeight: NOTE_LINE_HEIGHT,
    textAlignVertical: "top",
  },
  newNoteInput: {
    minHeight: 280,
  },
  newNotePlaceholderWrap: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
  },
  organizingCard: {
    marginTop: 24,
    marginHorizontal: 26,
    paddingHorizontal: 15,
    paddingVertical: 6,
    backgroundColor: "#FAFAFA",
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
  viewHeading: { marginTop: 26, marginHorizontal: 26, gap: 12 },
  emptyViewHeading: { marginTop: 42 },
  appContent: { flex: 1 },
});
