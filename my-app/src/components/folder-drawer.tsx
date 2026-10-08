import type { ComponentProps } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from "react-native";
import Animated from "react-native-reanimated";
import { Host } from "@expo/ui";
import { Button as SwiftUIButton, HStack as SwiftHStack, Image as SwiftUIImage, Spacer as SwiftSpacer, Text as SwiftUIText } from "@expo/ui/swift-ui";
import { background, buttonStyle, font, foregroundStyle, frame, padding, shapes } from "@expo/ui/swift-ui/modifiers";
import type { Folder, StoredNote } from "@/lib/local-store";

const ACCENT = "#E7A000";

function DrawerRow({ title, symbol, count, selected, dark, width, onPress }: {
  title: string;
  symbol: "square.and.pencil" | "checklist" | "trash" | "folder";
  count: number;
  selected: boolean;
  dark: boolean;
  width: number;
  onPress: () => void;
}) {
  const iconColor = symbol === "trash" ? "#FF453A" : ACCENT;
  const labelColor = dark ? "#F5F5F2" : "#171717";
  const selectionColor = selected ? (dark ? "#343438" : "#E9E9ED") : "clear";
  if (Platform.OS !== "ios") {
    return (
      <Pressable onPress={onPress} style={[styles.drawerRow, { width }, selected && { backgroundColor: dark ? "#343438" : "#E9E9ED" }]}>
        <NativeText style={[styles.drawerRowTitle, { color: labelColor }]}>{title}</NativeText>
        {count > 0 && <NativeText style={styles.drawerCount}>{count}</NativeText>}
      </Pressable>
    );
  }
  return (
    <Host style={{ width, height: 48 }}>
      <SwiftUIButton onPress={onPress} modifiers={[buttonStyle("plain"), frame({ width, height: 48 })]}>
        <SwiftHStack spacing={12} modifiers={[
          padding({ horizontal: 12 }),
          frame({ width, height: 48 }),
          background(selectionColor, shapes.roundedRectangle({ cornerRadius: 12 })),
        ]}>
          <SwiftUIImage systemName={symbol} size={20} color={iconColor} />
          <SwiftUIText modifiers={[font({ size: 16, weight: "medium" }), foregroundStyle(labelColor)]}>{title}</SwiftUIText>
          <SwiftSpacer />
          {count > 0 && <SwiftUIText modifiers={[font({ size: 13 }), foregroundStyle("#929299")]}>{count}</SwiftUIText>}
        </SwiftHStack>
      </SwiftUIButton>
    </Host>
  );
}

type FolderDrawerProps = {
  visible: boolean;
  width: number;
  isDark: boolean;
  topInset: number;
  bottomInset: number;
  notes: StoredNote[];
  folders: Folder[];
  activeView: string;
  panelStyle: ComponentProps<typeof Animated.View>["style"];
  scrimStyle: ComponentProps<typeof Animated.View>["style"];
  onClose: () => void;
  onSelectView: (view: string) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: Folder) => void;
  onRemoveFolder: (folder: Folder) => void;
};

export function FolderDrawer({
  visible,
  width: drawerWidth,
  isDark,
  topInset,
  bottomInset,
  notes,
  folders,
  activeView,
  panelStyle: drawerPanelStyle,
  scrimStyle,
  onClose: closeDrawer,
  onSelectView: selectView,
  onCreateFolder: createFolder,
  onRenameFolder: renameFolder,
  onRemoveFolder: removeFolder,
}: FolderDrawerProps) {
  if (!visible) return null;
  return (
    <View style={styles.drawerRoot} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.drawerScrim, scrimStyle]} />
      <Pressable style={[styles.drawerDismissArea, { left: drawerWidth }]} onPress={closeDrawer} accessibilityLabel="서랍 닫기" />
      <Animated.View style={[styles.drawer, { width: drawerWidth, backgroundColor: isDark ? "#1C1C1E" : "#F8F8FA", paddingTop: topInset + 16, paddingBottom: bottomInset + 16 }, drawerPanelStyle]}>
        <View style={styles.drawerHeader}>
          <NativeText style={[styles.drawerTitle, { color: isDark ? "#F5F5F2" : "#171717" }]}>폴더</NativeText>
        </View>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.drawerRows}>
          <DrawerRow title="작성 화면" symbol="square.and.pencil" count={notes.filter((n) => n.state === "draft").length} selected={activeView === "home"} dark={isDark} width={drawerWidth - 36} onPress={() => selectView("home")} />
          <DrawerRow title="투두리스트" symbol="checklist" count={notes.filter((n) => n.state === "saved" && n.folderId === "todo").length} selected={activeView === "todo"} dark={isDark} width={drawerWidth - 36} onPress={() => selectView("todo")} />
          <DrawerRow title="휴지통" symbol="trash" count={notes.filter((n) => n.state === "trash").length} selected={activeView === "trash"} dark={isDark} width={drawerWidth - 36} onPress={() => selectView("trash")} />
          <View style={styles.drawerDivider} />
          {folders.filter((folder) => folder.kind === "custom").map((folder) => (
            <View key={folder.id} style={styles.folderRow}>
              <DrawerRow title={folder.name} symbol="folder" count={notes.filter((n) => n.state === "saved" && n.folderId === folder.id).length} selected={activeView === folder.id} dark={isDark} width={drawerWidth - 132} onPress={() => selectView(folder.id)} />
              <Pressable onPress={() => renameFolder(folder)} hitSlop={8}><NativeText style={styles.folderAction}>이름</NativeText></Pressable>
              <Pressable onPress={() => removeFolder(folder)} hitSlop={8}><NativeText style={styles.folderAction}>삭제</NativeText></Pressable>
            </View>
          ))}
          <Pressable style={styles.addFolderButton} onPress={createFolder}>
            <NativeText style={{ color: ACCENT, fontSize: 16, fontWeight: "600" }}>＋  폴더 추가</NativeText>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerRoot: { ...StyleSheet.absoluteFill, overflow: "hidden", zIndex: 10 },
  drawerScrim: { ...StyleSheet.absoluteFill, backgroundColor: "#000000" },
  drawerDismissArea: { ...StyleSheet.absoluteFill },
  drawer: { width: "84%", maxWidth: 360, height: "100%", paddingHorizontal: 18, boxShadow: "5px 0px 18px rgba(0,0,0,0.06)" },
  drawerHeader: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, marginBottom: 10 },
  drawerTitle: { fontSize: 27, fontWeight: "700" },
  drawerRows: { gap: 4, paddingBottom: 16 },
  drawerRow: { minHeight: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 12 },
  drawerRowTitle: { flex: 1, fontSize: 16, fontWeight: "500" },
  drawerCount: { color: "#8E8E93", fontSize: 13, fontVariant: ["tabular-nums"] },
  drawerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#8E8E93", opacity: 0.35, marginVertical: 12 },
  folderRow: { flexDirection: "row", alignItems: "center" },
  folderAction: { color: "#8E8E93", fontSize: 12, paddingHorizontal: 5 },
  addFolderButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12, marginTop: 8 },
});
