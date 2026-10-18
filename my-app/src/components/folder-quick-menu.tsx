import { StyleSheet, Text, View } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { Folder } from "@/lib/local-store";
import { folderSymbol } from "@/lib/folder-icons";
import { folderColorFor, folderIconTint } from "@/lib/folder-colors";
import { FOLDER_ROW } from "./folder-row-appearance";
import { MENU_PADDING, MENU_DIVIDER, MENU_HINT_HEIGHT, menuContentHeight, menuMaxScrollOffset, type MenuLayout } from "./quick-menu-geometry";

export type QuickMenuState = {
  opacity: SharedValue<number>;
  selected: SharedValue<number>;
  layout: SharedValue<MenuLayout>;
  scrollOffset: SharedValue<number>;
};

function MenuRow({ title, symbol, index, menu, isDark, color, titleColor }: {
  title: string;
  symbol: SFSymbol;
  index: number;
  menu: QuickMenuState;
  isDark: boolean;
  color?: string;
  titleColor?: string;
}) {
  const tint = color ?? (symbol === "trash" ? FOLDER_ROW.trash : FOLDER_ROW.accent);
  const labelColor = titleColor ?? FOLDER_ROW.text[isDark ? "dark" : "light"];
  const selectionStyle = useAnimatedStyle(() => ({
    backgroundColor: menu.selected.get() === index
      ? FOLDER_ROW.selection[isDark ? "dark" : "light"] : "transparent",
  }));
  return (
    <Animated.View style={[styles.row, selectionStyle]}>
      <SymbolView name={folderSymbol(symbol)} size={FOLDER_ROW.iconSize}
        tintColor={tint} />
      <Text numberOfLines={1} style={[styles.title, { color: labelColor }]}>{title}</Text>
    </Animated.View>
  );
}

export function FolderQuickMenu({ menu, originX, originY, folders, isDark, isTrashView }: {
  menu: QuickMenuState;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  folders: Folder[];
  isDark: boolean;
  isTrashView: boolean;
}) {
  const appearance = isDark ? "dark" : "light";
  const overlayStyle = useAnimatedStyle(() => ({ opacity: menu.opacity.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    width: menu.layout.get().width,
    height: menu.layout.get().height,
    transform: [
      { translateX: originX.get() + menu.layout.get().left },
      { translateY: originY.get() + menu.layout.get().top },
    ],
  }), [originX, originY, menu]);
  const viewportStyle = useAnimatedStyle(() => ({ height: menu.layout.get().listHeight + MENU_HINT_HEIGHT * 2 }));
  const rowsStyle = useAnimatedStyle(() => ({ top: MENU_HINT_HEIGHT, height: menu.layout.get().listHeight }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -menu.scrollOffset.get() }] }));
  const topHint = useAnimatedStyle(() => ({ opacity: menu.scrollOffset.get() > 0 ? 1 : 0 }));
  const bottomHint = useAnimatedStyle(() => ({ opacity:
    menu.scrollOffset.get() < menuMaxScrollOffset(folders.length, menu.layout.get().listHeight) ? 1 : 0,
  }));
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, overlayStyle]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.18)" }]} />
      <Animated.View style={[styles.panel, { backgroundColor: FOLDER_ROW.panel[appearance] }, panelStyle]}>
        <Animated.View style={[styles.viewport, viewportStyle]}>
          <Animated.View style={[styles.rowViewport, rowsStyle]}>
            <Animated.View style={[styles.rows, { height: menuContentHeight(folders.length) }, contentStyle]}>
              {folders.map((folder, index) => <MenuRow key={folder.id} title={folder.name}
                symbol={folder.kind === "todo" ? "checklist" : folder.icon ?? "folder"} index={index} menu={menu} isDark={isDark}
                color={folder.kind === "todo" ? FOLDER_ROW.todoIcon[appearance] : folderIconTint(folder.color, isDark)}
                titleColor={folder.kind === "custom" ? folderColorFor(folder.color, isDark) : undefined} />)}
            </Animated.View>
          </Animated.View>
          <Animated.View style={[styles.hint, { top: 0, backgroundColor: FOLDER_ROW.panel[appearance] }, topHint]}>
            <SymbolView name="chevron.up" size={18} tintColor="#8E8E93" />
          </Animated.View>
          <Animated.View style={[styles.hint, { bottom: 0, backgroundColor: FOLDER_ROW.panel[appearance] }, bottomHint]}>
            <SymbolView name="chevron.down" size={18} tintColor="#8E8E93" />
          </Animated.View>
        </Animated.View>
        <View style={styles.dividerSpace}><View style={styles.divider} /></View>
        <MenuRow title={isTrashView ? "영구삭제" : "휴지통"} symbol="trash" index={folders.length} menu={menu} isDark={isDark} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", left: 0, top: 0, padding: MENU_PADDING, borderRadius: 20,
    shadowColor: "#000000", shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  viewport: { overflow: "hidden" },
  rowViewport: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  rows: { flexShrink: 0, gap: FOLDER_ROW.gap },
  row: { height: FOLDER_ROW.height, borderRadius: FOLDER_ROW.radius, flexDirection: "row", alignItems: "center",
    paddingHorizontal: FOLDER_ROW.horizontalPadding, gap: FOLDER_ROW.iconGap },
  title: { flex: 1, fontSize: FOLDER_ROW.fontSize, fontWeight: "500" },
  dividerSpace: { height: MENU_DIVIDER, justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#8E8E93", opacity: 0.35 },
  hint: { position: "absolute", left: 0, right: 0, height: MENU_HINT_HEIGHT, alignItems: "center", justifyContent: "center" },
});
