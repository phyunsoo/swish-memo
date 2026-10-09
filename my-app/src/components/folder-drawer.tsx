import { useMemo, type ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, Text as NativeText, View } from "react-native";
import Animated from "react-native-reanimated";
import { Host } from "@expo/ui";
import { Button as SwiftUIButton, HStack as SwiftHStack, Image as SwiftUIImage, Spacer as SwiftSpacer, Text as SwiftUIText } from "@expo/ui/swift-ui";
import { background, buttonStyle, contentShape, font, foregroundStyle, frame, padding, shapes } from "@expo/ui/swift-ui/modifiers";
import type { Folder, StoredNote } from "@/lib/local-store";

import { FOLDER_ROW } from "./folder-row-appearance";
import { SortableFolders } from "./sortable-folders";

const ACCENT = FOLDER_ROW.accent;

function DrawerRow({ title, symbol, count, selected, dark, width, onPress, interactive = true }: {
  title: string;
  symbol: "square.and.pencil" | "checklist" | "trash" | "folder";
  count: number;
  selected: boolean;
  dark: boolean;
  width: number;
  onPress: () => void;
  interactive?: boolean;
}) {
  const iconColor = symbol === "trash" ? FOLDER_ROW.trash : ACCENT;
  const labelColor = FOLDER_ROW.text[dark ? "dark" : "light"];
  const selectionColor = selected ? FOLDER_ROW.selection[dark ? "dark" : "light"] : "clear";
  if (Platform.OS !== "ios") {
    return (
      <Pressable onPress={interactive ? onPress : undefined} style={[styles.drawerRow, { width }, selected && { backgroundColor: FOLDER_ROW.selection[dark ? "dark" : "light"] }]}>
        <NativeText style={[styles.drawerRowTitle, { color: labelColor }]}>{title}</NativeText>
        {count > 0 && <NativeText style={styles.drawerCount}>{count}</NativeText>}
      </Pressable>
    );
  }
  const content = (
        <SwiftHStack spacing={FOLDER_ROW.iconGap} modifiers={[
          padding({ horizontal: FOLDER_ROW.horizontalPadding }),
          frame({ width, height: 48 }),
          contentShape(shapes.rectangle()),
          background(selectionColor, shapes.roundedRectangle({ cornerRadius: FOLDER_ROW.radius })),
        ]}>
          <SwiftUIImage systemName={symbol} size={FOLDER_ROW.iconSize} color={iconColor} />
          <SwiftUIText modifiers={[font({ size: FOLDER_ROW.fontSize, weight: "medium" }), foregroundStyle(labelColor)]}>{title}</SwiftUIText>
          <SwiftSpacer />
          {count > 0 && <SwiftUIText modifiers={[font({ size: 13 }), foregroundStyle("#929299")]}>{count}</SwiftUIText>}
        </SwiftHStack>
  );
  return (
    <Host style={{ width, height: 48 }}>
      {interactive ? (
        <SwiftUIButton onPress={onPress} modifiers={[buttonStyle("plain"), frame({ width, height: 48 })]}>{content}</SwiftUIButton>
      ) : content}
    </Host>
  );
}

type FolderDrawerProps = {
  visible: boolean;
  width: number;
  isDark: boolean;
  topInset: number;
  notes: StoredNote[];
  folders: Folder[];
  activeView: string;
  panelStyle: ComponentProps<typeof Animated.View>["style"];
  scrimStyle: ComponentProps<typeof Animated.View>["style"];
  onClose: () => void;
  onSelectView: (view: string) => void;
  onCreateFolder: () => void;
  onReorderFolders: (ids: string[]) => void;
};

export function FolderDrawer({
  visible,
  width: drawerWidth,
  isDark,
  topInset,
  notes,
  folders,
  activeView,
  panelStyle: drawerPanelStyle,
  scrimStyle,
  onClose: closeDrawer,
  onSelectView: selectView,
  onCreateFolder: createFolder,
  onReorderFolders: reorderFolders,
}: FolderDrawerProps) {
  const customFolders = useMemo(() => folders.filter((folder) => folder.kind === "custom"), [folders]);
  if (!visible) return null;
  return (
    <View style={styles.drawerRoot} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.drawerScrim, scrimStyle]} />
      <Pressable style={[styles.drawerDismissArea, { left: drawerWidth }]} onPress={closeDrawer} accessibilityLabel="서랍 닫기" />
      <Animated.View style={[styles.drawer, { width: drawerWidth, backgroundColor: FOLDER_ROW.panel[isDark ? "dark" : "light"], paddingTop: topInset + 16, paddingBottom: 0 }, drawerPanelStyle]}>
        <View style={styles.drawerHeader}>
          <NativeText style={[styles.drawerTitle, { color: isDark ? "#F5F5F2" : "#171717" }]}>폴더</NativeText>
          <Pressable style={styles.addFolderButton} onPress={createFolder} accessibilityRole="button">
            <NativeText style={{ color: ACCENT, fontSize: 15, fontWeight: "600" }}>＋ 폴더 추가</NativeText>
          </Pressable>
        </View>
        <SortableFolders folders={customFolders} width={drawerWidth - 36} dark={isDark}
          onSelect={selectView} onReorder={reorderFolders}
          renderFolder={(folder) => (
            <DrawerRow title={folder.name} symbol="folder" count={notes.filter((n) => n.state === "saved" && n.folderId === folder.id).length} selected={activeView === folder.id} dark={isDark} width={drawerWidth - 36} interactive={false} onPress={() => selectView(folder.id)} />
          )}>
          <DrawerRow title="작성 화면" symbol="square.and.pencil" count={notes.filter((n) => n.state === "draft").length} selected={activeView === "home"} dark={isDark} width={drawerWidth - 36} onPress={() => selectView("home")} />
          <DrawerRow title="투두리스트" symbol="checklist" count={notes.filter((n) => n.state === "saved" && n.folderId === "todo").length} selected={activeView === "todo"} dark={isDark} width={drawerWidth - 36} onPress={() => selectView("todo")} />
          <DrawerRow title="휴지통" symbol="trash" count={notes.filter((n) => n.state === "trash").length} selected={activeView === "trash"} dark={isDark} width={drawerWidth - 36} onPress={() => selectView("trash")} />
          <View style={styles.drawerDivider} />
        </SortableFolders>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerRoot: { ...StyleSheet.absoluteFill, overflow: "hidden", zIndex: 10 },
  drawerScrim: { ...StyleSheet.absoluteFill, backgroundColor: "#000000" },
  drawerDismissArea: { ...StyleSheet.absoluteFill },
  drawer: { width: "84%", maxWidth: 360, height: "100%", paddingHorizontal: 18 },
  drawerHeader: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, marginBottom: 10, gap: 8 },
  drawerTitle: { fontSize: 27, fontWeight: "700" },
  drawerRow: { minHeight: FOLDER_ROW.height, borderRadius: FOLDER_ROW.radius, flexDirection: "row", alignItems: "center", paddingHorizontal: FOLDER_ROW.horizontalPadding, gap: FOLDER_ROW.iconGap },
  drawerRowTitle: { flex: 1, fontSize: FOLDER_ROW.fontSize, fontWeight: "500" },
  drawerCount: { color: "#8E8E93", fontSize: 13, fontVariant: ["tabular-nums"] },
  drawerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#8E8E93", opacity: 0.35, marginVertical: 12, marginRight: 12 },
  addFolderButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 },
});
