import { NoteCard } from "@/components/note-card";
import { NotePhotos } from "@/components/note-photos";
import { EditorKeyboardToolbar, EDITOR_KEYBOARD_TOOLBAR_INSET } from "@/components/editor-keyboard-toolbar";
import type { NotePhoto } from "@/lib/note-photos";
import { hasNoteContent } from "@/lib/note-draft";
import { resolvePhotoAttachmentTarget, usePhotoAttachment } from "@/hooks/use-photo-attachment";
import { NativeCheckButton } from "@/components/native-check-button";
import { useNoteActions } from "@/hooks/use-note-actions";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { GestureDetector } from "react-native-gesture-handler";
import { NoteSearch } from "@/components/note-search";
import { useNoteSearch } from "@/hooks/use-note-search";
import { DraggableNotes } from "@/components/draggable-notes";
import type { Folder, StoredNote } from "@/lib/local-store";
import { useMemoStorage } from "@/hooks/use-memo-storage";
import { FolderDrawer } from "@/components/folder-drawer";
import { hasFolderName, isValidTodoText, updateNoteContent } from "@/lib/memo-rules";
import { compareNoteOrder, moveNotesToDestination, nextNoteOrder } from "@/lib/note-order";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useFolderDrawer } from "@/hooks/use-folder-drawer";
import { GlassButton, GLASS_BUTTON_SIZE } from "@/components/glass-button";
import { HomeKebabMenu } from "@/components/home-kebab-menu";
import { FolderKebabMenu } from "@/components/folder-kebab-menu";
import { getNoteTextStyle, NOTE_TEXT_SIZE, NOTE_LINE_HEIGHT } from "@/lib/note-typography";
import { useAppearance } from "@/lib/appearance";
import { EmptyNoteDetail, NoteDetailPane, NoteListRow } from "@/components/wide-note-workspace";
import { FolderIconSheet } from "@/components/folder-icon-sheet";
import { FolderColorSheet } from "@/components/folder-color-sheet";
import type { FolderIcon } from "@/lib/folder-icons";
import type { SFSymbol } from "expo-symbols";
import { DEFAULT_FOLDER_COLOR, folderColorFor, folderColorSwatch, folderIconTint, type FolderColorId } from "@/lib/folder-colors";
const ACCENT = "#E7A000";
const BUTTON_HEIGHT = GLASS_BUTTON_SIZE;

type Note = StoredNote;

export default function Index() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 840;
  const pinnedFolders = windowWidth >= 1180;
  const keyboardHeight = useKeyboardHeight();
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const { isDark } = useAppearance();
  const inputRef = useRef<InstanceType<typeof NativeTextInput>>(null);
  const editInputRef = useRef<InstanceType<typeof NativeTextInput>>(null);
  const { notes, setNotes, folders, setFolders, draft, changeDraftText, appendDraftPhotos, removeDraftPhoto, clearDraft, noteFontSize, notePlaceholder, markdownEnabled, hyperlinksEnabled, allocateNoteId, storageStatus } = useMemoStorage();
  const { completeTodo, reorderNotes } = useNoteActions();
  const noteTextStyle = getNoteTextStyle(noteFontSize);
  const { text: noteText, photos: notePhotos, timestamp: noteTimestamp } = draft;
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingTimestamp, setEditingTimestamp] = useState<number>(0);
  const [focusedNoteId, setFocusedNoteId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState("home");
  const [reordering, setReordering] = useState(false);
  const [iconEditingFolder, setIconEditingFolder] = useState<Folder | null>(null);
  const [selectedFolderIcon, setSelectedFolderIcon] = useState<FolderIcon>("folder");
  const [colorEditingFolder, setColorEditingFolder] = useState<Folder | null>(null);
  const [selectedFolderColor, setSelectedFolderColor] = useState<FolderColorId>(DEFAULT_FOLDER_COLOR);
  const [activeEditor, setActiveEditor] = useState<"new" | number | null>(null);
  useFocusEffect(useCallback(() => {
    if (view !== "todo") return;
    setActiveView("todo");
    setSelectedNoteId(null);
    setFocusedNoteId(null);
    setEditingNoteId(null);
    Keyboard.dismiss();
    router.setParams({ view: undefined });
  }, [view, router, setActiveView, setFocusedNoteId, setEditingNoteId]));
  const visibleNotes = useMemo(() => notes.filter((note) => {
    if (activeView === "home") return note.state === "draft" || note.id === focusedNoteId;
    if (activeView === "trash") return note.state === "trash";
    return note.state === "saved" && note.folderId === activeView;
  }).sort(activeView === "todo" && folders.find((folder) => folder.id === "todo")?.noteOrder === "recent"
    ? (first, second) => second.timestamp - first.timestamp
    : compareNoteOrder), [notes, activeView, focusedNoteId, folders]);
  const search = useNoteSearch(visibleNotes, editingNoteId, editingText);
  const { close: resetSearch } = search;
  const selectedNote = visibleNotes.find((note) => note.id === (search.selectedMatch?.noteId ?? selectedNoteId ?? editingNoteId))
    ?? (activeView === "home" ? undefined : visibleNotes[0]);
  const isEditingCard = editingNoteId !== null;
  const hasContent = hasNoteContent(draft);
  const {
    visible: drawerVisible, width: drawerWidth, open: openDrawer, close: closeDrawer,
    panGesture: drawerPanGesture, contentStyle: appShiftStyle, panelStyle: drawerPanelStyle, scrimStyle,
  } = useFolderDrawer(!search.visible && !wide);
  useEffect(() => { if (wide) closeDrawer(); }, [wide, closeDrawer]);
  const attachmentEnabled = storageStatus === "ready" && !search.visible && !reordering && (!drawerVisible || pinnedFolders)
    && (!wide || !selectedNote || editingNoteId === selectedNote.id);
  const canDismissKeyboard = attachmentEnabled && (activeEditor === "new" ? activeView === "home"
    : activeEditor !== null && editingNoteId === activeEditor);
  const bottomOverlayInset = (search.visible ? 160 : 0)
    + (canDismissKeyboard && keyboardHeight > 0 ? EDITOR_KEYBOARD_TOOLBAR_INSET : 0);
  const attachmentTarget = resolvePhotoAttachmentTarget(editingNoteId, activeView, notes);
  const { attachPhotos, isPickingPhotos } = usePhotoAttachment({
    target: attachmentTarget,
    enabled: attachmentEnabled,
    onAttach: (target, photos) => {
      if (target === "new") appendDraftPhotos(photos);
      else {
        const timestamp = Date.now();
        setNotes((current) => current.map((note) => note.id === target
          ? { ...note, photos: [...(note.photos ?? []), ...photos], timestamp } : note));
        setEditingTimestamp(timestamp);
      }
    },
    onRestoreFocus: (target) => {
      if (target === "new") inputRef.current?.focus();
      else editInputRef.current?.focus();
    },
  });
  const canAttachPhotos = attachmentEnabled && attachmentTarget !== null && !isPickingPhotos;

  const removePhoto = useCallback((target: "new" | number, photo: NotePhoto) => {
    const timestamp = Date.now();
    if (target === "new") {
      removeDraftPhoto(photo);
    } else {
      setNotes((current) => current.map((note) => note.id === target
        ? { ...note, photos: note.photos?.filter((item) => item.fileName !== photo.fileName), timestamp } : note));
      setEditingTimestamp(timestamp);
    }
  }, [removeDraftPhoto, setNotes]);

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
    if (targetFolder?.id === "todo" && (!isValidTodoText(note.text) || (note.photos?.length ?? 0) > 0)) {
      Alert.alert("투두로 저장할 수 없어요", "투두는 사진과 줄바꿈 없이 30자 이내의 글로 작성해야 합니다.");
      return;
    }
    const folderId = targetFolder?.id ?? null;
    const state = trashTarget ? "trash" : "saved";
    if (trashTarget && activeView === "trash" && note.state === "trash") {
      setNotes((current) => current.filter((item) => item.id !== noteId));
    } else {
      setNotes((current) => {
        const moving = current.find((item) => item.id === noteId);
        return moving ? moveNotesToDestination(current, [{ ...moving, timestamp: Date.now() }], { folderId, state }) : current;
      });
    }
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
          const unsavedNote: StoredNote | null = hasContent ? {
            id: allocateNoteId(),
            text: noteText,
            photos: notePhotos,
            timestamp: noteTimestamp ?? now,
            folderId: null,
            state: "trash",
          } : null;
          setNotes((current) => {
            const moving = current.filter((note) => note.state === "draft" || note.id === focusedNoteId || note.id === editingNoteId).sort(compareNoteOrder).map((note) => {
              const text = note.id === editingNoteId ? editingText : note.text;
              return { ...note, text, timestamp: now };
            });
            if (unsavedNote) moving.push(unsavedNote);
            return moveNotesToDestination(current, moving, { folderId: null, state: "trash" });
          });
          clearDraft();
          setEditingNoteId(null);
          setFocusedNoteId(null);
          Keyboard.dismiss();
        },
      },
    ]);
  };

  const openSettings = () => { Keyboard.dismiss(); router.push("/settings"); };

  const confirmEmptyTrash = () => {
    Alert.alert("휴지통 비우기", "휴지통에 있는 모든 메모를 영구 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "비우기",
        style: "destructive",
        onPress: () => setNotes((current) => current.filter((note) => note.state !== "trash")),
      },
    ]);
  };

  const renameFolder = (folder: Folder, rawName: string) => {
    const name = rawName.trim();
    if (!name || name === folder.name) return;
    if (hasFolderName(folders, name, folder.id)) {
      Alert.alert("이미 있는 폴더", "같은 이름의 폴더가 있습니다.");
      return;
    }
    setFolders((current) => current.map((item) => item.id === folder.id ? { ...item, name } : item));
  };

  const requestRenameFolder = (folder: Folder) => {
    Alert.prompt("폴더 이름 변경", "폴더 이름을 입력하세요.", (name) => renameFolder(folder, name), "plain-text", folder.name);
  };

  const saveFolderIcon = (folderId: string, icon: SFSymbol) => {
    setFolders((current) => current.map((folder) => folder.id === folderId && folder.kind === "custom"
      ? { ...folder, icon }
      : folder));
  };

  const saveFolderColor = (folderId: string, color: FolderColorId) => {
    setFolders((current) => current.map((folder) => folder.id === folderId && folder.kind === "custom"
      && folderColorSwatch(folder.color) !== folderColorSwatch(color)
      ? { ...folder, color }
      : folder));
  };

  const confirmDeleteFolder = (folder: Folder) => {
    Alert.alert("폴더 삭제", `‘${folder.name}’ 폴더를 삭제할까요? 폴더 안의 메모는 휴지통으로 이동합니다.`, [
      { text: "취소", style: "cancel" },
      {
        text: "폴더 삭제",
        style: "destructive",
        onPress: () => {
          const now = Date.now();
          setNotes((current) => moveNotesToDestination(current,
            current.filter((note) => note.folderId === folder.id && note.state === "saved").sort(compareNoteOrder)
              .map((note) => ({ ...note, timestamp: now })),
            { folderId: null, state: "trash" }));
          setFolders((current) => current.filter((item) => item.id !== folder.id));
          if (activeView === folder.id) {
            setActiveView("home");
            setFocusedNoteId(null);
          }
        },
      },
    ]);
  };

  const saveEditingNote = () => {
    if (editingNoteId === null) return;
    setNotes((current) => updateNoteContent(current, editingNoteId, editingText, editingTimestamp));
  };

  const createNote = () => {
    if (!hasContent) return;
    const note: Note = {
      id: allocateNoteId(),
      text: noteText,
      photos: notePhotos,
      timestamp: noteTimestamp ?? Date.now(),
      sortOrder: nextNoteOrder(visibleNotes),
      folderId: null,
      state: "draft",
    };
    setNotes((current) => [...current, note]);
    clearDraft();
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  const finishEditing = () => {
    if (editingNoteId !== null) {
      const currentNote = notes.find((note) => note.id === editingNoteId);
      if (currentNote?.folderId === "todo" && !isValidTodoText(editingText)) {
        Alert.alert("투두 형식을 확인해 주세요", "투두는 줄바꿈 없이 30자 이내로 작성해야 합니다.");
        return false;
      }
      saveEditingNote();
      setEditingNoteId(null);
    }
    inputRef.current?.blur();
    editInputRef.current?.blur();
    Keyboard.dismiss();
    return true;
  };

  const resumeEditing = (note: Note) => {
    inputRef.current?.blur();
    if (editingNoteId !== null) {
      saveEditingNote();
    }
    setSelectedNoteId(note.id);
    setEditingNoteId(note.id);
    setEditingText(note.text);
    setEditingTimestamp(note.timestamp);
    setFocusedNoteId(note.id);
  };

  const activeFolder = folders.find((folder) => folder.id === activeView);
  const viewTitle = activeView === "home" ? "작성 화면"
    : activeView === "trash" ? "휴지통"
      : activeFolder?.name ?? "폴더";
  const viewTitleColor = activeFolder?.kind === "custom"
    ? folderColorFor(activeFolder.color, isDark)
    : isDark ? "#F5F5F2" : "#171717";

  const openSearch = () => {
    inputRef.current?.blur();
    editInputRef.current?.blur();
    search.open();
  };
  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    resetSearch();
  }, [resetSearch]);

  const selectView = (view: string) => {
    if (!finishEditing()) return;
    closeSearch();
    setSelectedNoteId(null);
    setActiveView(view);
    setFocusedNoteId(null);
    closeDrawer();
    Keyboard.dismiss();
  };

  const renderNoteCard = (note: Note, reorderHandle?: ReactNode) => (
    <NoteCard
      note={note}
      reorderHandle={reorderHandle}
      isDark={isDark}
      editing={editingNoteId === note.id}
      reordering={reordering}
      editingText={editingText}
      editInputRef={editInputRef}
      noteFontSize={noteFontSize}
      markdownEnabled={markdownEnabled}
      hyperlinksEnabled={hyperlinksEnabled}
      search={search}
      onComplete={() => {
        completeTodo(note.id);
        setFocusedNoteId(null);
      }}
      onEdit={() => editingNoteId === note.id ? finishEditing() : resumeEditing(note)}
      onChangeText={(text) => {
        setEditingText(text);
        setEditingTimestamp(Date.now());
      }}
      onInputFocus={() => setActiveEditor(note.id)}
      onRemovePhoto={(photo) => removePhoto(note.id, photo)}
    />
  );

  const draftEditor = (
    <View style={[styles.editorCard, styles.editingCard]}>
      <NativeTextInput
        ref={inputRef}
        accessibilityLabel="새 메모 내용"
        editable={!search.visible}
        accessibilityHint="떠오른 생각을 자유롭게 입력하세요"
        autoFocus={!wide}
        multiline
        onChangeText={changeDraftText}
        onFocus={() => {
          if (editingNoteId !== null) {
            saveEditingNote();
            setEditingNoteId(null);
          }
          setActiveEditor("new");
        }}
        value={noteText}
        scrollEnabled={false}
        selectionColor={ACCENT}
        style={[styles.editorInput, styles.newNoteInput, notePhotos.length > 0 && { minHeight: 44 },
          noteTextStyle, { color: isDark ? "#F5F5F2" : "#171717" }]}
      />
      {noteText.length === 0 && notePhotos.length === 0 && (
        <View pointerEvents="none" style={styles.newNotePlaceholderWrap}>
          <NativeText style={[styles.editorInput, noteTextStyle, { color: isDark ? "#747474" : "#A0A0A0" }]}>
            {notePlaceholder}
          </NativeText>
        </View>
      )}
      <NotePhotos photos={notePhotos} onRemove={(photo) => removePhoto("new", photo)} />
    </View>
  );

  const folderPanel = (
    <FolderDrawer
      visible={drawerVisible}
      persistent={pinnedFolders}
      bottomInset={insets.bottom}
      width={pinnedFolders ? 260 : drawerWidth}
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
  );

  if (storageStatus === "loading") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: "#000000" }} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <GestureDetector gesture={drawerPanGesture}>
      <View style={[styles.screen, { backgroundColor: isDark ? "#111110" : "#FFFFFF" }]}>
        {pinnedFolders && folderPanel}
        <View style={styles.workspace}>
        <Animated.View style={[styles.appContent, !wide && appShiftStyle]}>
        <View style={styles.appContent}>
        {!search.visible && <View
          pointerEvents="box-none"
          style={[
            styles.toolbarOverlay,
            activeView === "home" && !wide
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
            {!pinnedFolders && <GlassButton
              label="폴더 메뉴"
              symbol="folder"
              tint={isDark ? "#F5F5F2" : "#171717"}
              glassTint={isDark ? "#343438" : "#F2F2F5"}
              onPress={openDrawer}
            />}
            {(activeView !== "home" || wide) && (
              <View pointerEvents="none" style={wide ? styles.wideToolbarTitle : styles.toolbarTitleWrap}>
                <NativeText numberOfLines={1} style={[styles.toolbarTitle, { color: viewTitleColor }]}>
                  {viewTitle}
                </NativeText>
              </View>
            )}
            <View pointerEvents="box-none" style={styles.toolbarActions}>
              {wide && !reordering && <GlassButton label="새 메모" symbol="square.and.pencil"
                tint={ACCENT} onPress={() => selectView("home")} />}
              {wide && canAttachPhotos && <GlassButton label="사진 첨부" symbol="paperclip"
                tint={ACCENT} onPress={() => { void attachPhotos(); }} />}
              {hasContent && (!wide || !selectedNote) && (
                <NativeCheckButton onPress={createNote} />
              )}
              {reordering ? (
                <NativeCheckButton onPress={() => setReordering(false)} />
              ) : activeView === "home" ? (
                <HomeKebabMenu onAttachPhotos={() => { void attachPhotos(); }} canAttachPhotos={canAttachPhotos}
                  onSearch={openSearch} isDark={isDark} onReorder={() => setReordering(true)} onDelete={confirmMoveAllDraftsToTrash} onSettings={openSettings} />
              ) : (
                <FolderKebabMenu
                  onSearch={openSearch}
                  onReorder={() => setReordering(true)}
                  isDark={isDark}
                  onSettings={openSettings}
                  onEmptyTrash={confirmEmptyTrash}
                  showEmptyTrash={activeView === "trash"}
                  onRequestRenameFolder={() => { if (activeFolder) requestRenameFolder(activeFolder); }}
                  onRequestEditFolderColor={() => {
                    if (activeFolder?.kind !== "custom") return;
                    setSelectedFolderColor(activeFolder.color ?? DEFAULT_FOLDER_COLOR);
                    setColorEditingFolder(activeFolder);
                  }}
                  onRequestEditFolderIcon={() => {
                    if (activeFolder?.kind !== "custom") return;
                    setSelectedFolderIcon(activeFolder.icon ?? "folder");
                    setIconEditingFolder(activeFolder);
                  }}
                  onDeleteFolder={() => { if (activeFolder) confirmDeleteFolder(activeFolder); }}
                  showFolderActions={activeFolder?.kind === "custom"}
                />
              )}
            </View>
          </View>
        </View>}

        {storageStatus === "ready" ? <View style={[styles.notesBody, wide && { paddingTop: insets.top + BUTTON_HEIGHT + 24 }]}>
          <View style={wide ? [styles.noteList, { borderRightColor: isDark ? "#343436" : "#E6E6E8", backgroundColor: isDark ? "#191918" : "#FAFAF8" }] : styles.appContent}>
          <DraggableNotes
          notes={visibleNotes}
          folders={folders}
          isDark={isDark}
          noteFontSize={noteFontSize}
          isTrashView={activeView === "trash"}
          editing={isEditingCard || search.visible}
          reordering={reordering}
          keyboardInset={keyboardHeight}
          searchTarget={wide && search.selectedMatch ? { noteId: search.selectedMatch.noteId, offset: 0, key: `${search.query}:${search.activeIndex}` } : search.target}
          onDrop={onDrop}
          onReorder={(ids) => reorderNotes(ids, activeView)}
          paddingTop={wide ? 12 : activeView === "home"
            ? insets.top + 12 + BUTTON_HEIGHT
            : insets.top + BUTTON_HEIGHT}
          paddingBottom={Math.max(insets.bottom, 18) + bottomOverlayInset}
          header={wide ? (
            <View style={styles.listHeading}>
              <NativeText style={{ fontSize: 13, color: isDark ? "#A1A1A6" : "#77777C" }}>{visibleNotes.length}개의 메모</NativeText>
              {visibleNotes.length === 0 && <NativeText style={{ color: isDark ? "#A1A1A6" : "#77777C" }}>아직 메모가 없습니다.</NativeText>}
            </View>
          ) : activeView !== "home" ? (
            <View style={[styles.viewHeading, visibleNotes.length === 0 && styles.emptyViewHeading]}>
              {visibleNotes.length === 0 && <NativeText style={{ color: isDark ? "#A1A1A6" : "#77777C" }}>메모가 없습니다.</NativeText>}
            </View>
          ) : null}
          renderNote={(note, reorderHandle) => wide ? (
            <NoteListRow note={note} text={editingNoteId === note.id ? editingText : note.text}
              selected={selectedNote?.id === note.id} isDark={isDark} reorderHandle={reorderHandle}
              onSelect={() => {
                if (search.visible || reordering || selectedNote?.id === note.id) return;
                if (!finishEditing()) return;
                setSelectedNoteId(note.id);
              }} />
          ) : renderNoteCard(note, reorderHandle)}
        >
          {!wide && activeView === "home" ? draftEditor : null}
        </DraggableNotes>
          </View>
          {wide && <NoteDetailPane key={selectedNote?.id ?? "new"} isDark={isDark} topInset={8}
            bottomInset={Math.max(insets.bottom, 24) + bottomOverlayInset}
            keyboardInset={keyboardHeight}
            searchTarget={search.target?.noteId === selectedNote?.id ? search.target : null}>
            {selectedNote ? renderNoteCard(selectedNote) : activeView === "home" ? draftEditor : <EmptyNoteDetail isDark={isDark} />}
          </NoteDetailPane>}
        </View> : (
          <View style={styles.storageStatus}>
            <NativeText accessibilityRole="text" style={{ color: isDark ? "#A1A1A6" : "#77777C", textAlign: "center" }}>
              메모를 불러오지 못했어요. 앱을 다시 실행해 주세요.
            </NativeText>
          </View>
        )}
        </View>
        </Animated.View>
        <EditorKeyboardToolbar visible={canDismissKeyboard} canAttachPhotos={canAttachPhotos}
          keyboardHeight={keyboardHeight} isDark={isDark} onAttachPhotos={() => { void attachPhotos(); }} />
        {search.visible && <NoteSearch
          folderName={viewTitle} isDark={isDark} topInset={insets.top} bottomInset={insets.bottom}
          query={search.query} total={search.total} activeIndex={search.activeIndex}
          onQueryChange={search.changeQuery}
          onPrevious={search.previous}
          onNext={search.next}
          onClose={closeSearch}
        />}

        {!pinnedFolders && folderPanel}
        </View>
      </View>
      </GestureDetector>
      <FolderIconSheet
        folder={iconEditingFolder}
        selectedIcon={selectedFolderIcon}
        isDark={isDark}
        symbolColor={folderIconTint(iconEditingFolder?.color, isDark)}
        onClose={() => setIconEditingFolder(null)}
        onSave={() => { if (iconEditingFolder) saveFolderIcon(iconEditingFolder.id, selectedFolderIcon); }}
        onSelectIcon={setSelectedFolderIcon}
      />
      <FolderColorSheet
        folder={colorEditingFolder}
        selectedColor={selectedFolderColor}
        isDark={isDark}
        onClose={() => setColorEditingFolder(null)}
        onSave={() => { if (colorEditingFolder) saveFolderColor(colorEditingFolder.id, selectedFolderColor); }}
        onSelectColor={setSelectedFolderColor}
      />
    </>
  );
}

const styles = StyleSheet.create({
  storageStatus: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 26 },
  screen: { flex: 1, flexDirection: "row" },
  workspace: { flex: 1, minWidth: 0 },
  notesBody: { flex: 1, flexDirection: "row" },
  noteList: { width: 300, borderRightWidth: StyleSheet.hairlineWidth },
  listHeading: { paddingHorizontal: 26, paddingVertical: 12, gap: 20 },
  wideToolbarTitle: { flex: 1, minWidth: 0, alignItems: "flex-start", paddingHorizontal: 20 },
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
  viewHeading: { marginTop: 26, marginHorizontal: 26, gap: 12 },
  emptyViewHeading: { marginTop: 42 },
  appContent: { flex: 1 },
});
