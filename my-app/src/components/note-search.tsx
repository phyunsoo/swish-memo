import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard, Platform, StyleSheet, Text, TextInput, View, useWindowDimensions, type KeyboardEvent, type TextProps } from "react-native";
import { Button, Host, Icon } from "@expo/ui";
import { buttonBorderShape, buttonStyle, controlSize, frame } from "@expo/ui/swift-ui/modifiers";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { matchLineOffsets, type TextMatch } from "@/lib/note-search";

function SearchButton({ symbol, label, isDark, disabled = false, onPress }: {
  symbol: "xmark" | "chevron.up" | "chevron.down";
  label: string;
  isDark: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const nativeGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  return (
    <Host matchContents colorScheme={isDark ? "dark" : "light"} ignoreSafeArea="all"
      accessible accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <Button onPress={onPress} disabled={disabled} variant="text"
        modifiers={[buttonStyle(nativeGlass ? "glass" : "plain"), buttonBorderShape("circle"), controlSize("large"), frame({ width: 52, height: 52 })]}
        style={{ width: 52, height: 52, paddingHorizontal: 0, paddingVertical: 0 }}>
        <Icon name={symbol} size={22} color={disabled ? "#8E8E93" : isDark ? "#FFFFFF" : "#171717"} />
      </Button>
    </Host>
  );
}

/** Highlights the original note and reports the selected line's position within its card. */
export function SearchNoteText({ noteId, text, matches, selectedStart, contentOffset, onSelectedOffset, style }: {
  noteId: number;
  text: string;
  matches: TextMatch[];
  selectedStart: number | null;
  contentOffset: number;
  onSelectedOffset: (noteId: number, offset: number) => void;
  style: TextProps["style"];
}) {
  const textY = useRef(0);
  const lines = useRef<{ text: string; y: number }[]>([]);
  const report = useCallback(() => {
    const index = matches.findIndex((match) => match.start === selectedStart);
    if (index >= 0 && lines.current.length) {
      onSelectedOffset(noteId, contentOffset + textY.current + matchLineOffsets(text, matches, lines.current)[index]);
    }
  }, [noteId, text, matches, selectedStart, contentOffset, onSelectedOffset]);
  useEffect(report, [report]);
  const parts = matches.flatMap((match, index) => {
    const before = text.slice(index ? matches[index - 1].end : 0, match.start);
    return [before, <Text key={match.start} style={{
      backgroundColor: match.start === selectedStart ? "#E7A000" : "#FFE79A",
      color: "#171717",
    }}>{text.slice(match.start, match.end)}</Text>];
  });
  parts.push(text.slice(matches.at(-1)?.end ?? 0));
  return <Text style={style}
    onLayout={(event) => { textY.current = event.nativeEvent.layout.y; report(); }}
    onTextLayout={(event) => {
      lines.current = event.nativeEvent.lines;
      report();
    }}>{parts}</Text>;
}

/** Transparent controls layered above the existing memo list. */
export function NoteSearch({ folderName, isDark, topInset, bottomInset, query, total, activeIndex, onQueryChange, onPrevious, onNext, onClose }: {
  folderName: string;
  isDark: boolean;
  topInset: number;
  bottomInset: number;
  query: string;
  total: number;
  activeIndex: number;
  onQueryChange: (query: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(() => {
    const metrics = Keyboard.metrics();
    return metrics ? Math.max(0, height - metrics.screenY) : 0;
  });
  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      if (Platform.OS === "ios") Keyboard.scheduleLayoutAnimation(event);
      setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY));
    };
    const frame = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", update);
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", (event) => {
      if (Platform.OS === "ios") Keyboard.scheduleLayoutAnimation(event);
      setKeyboardHeight(0);
    });
    return () => { frame.remove(); hide.remove(); };
  }, [height]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const foreground = isDark ? "#FFFFFF" : "#171717";
  const scheme = isDark ? "dark" : "light";
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.searchRow, { top: topInset + 12 }]}>
        <GlassView glassEffectStyle="regular" colorScheme={scheme} isInteractive style={styles.inputSurface}>
          <SymbolView name="magnifyingglass" size={22} tintColor={isDark ? "#A1A1A6" : "#636366"} />
          <TextInput autoFocus accessibilityLabel={`${folderName} 메모 검색`} placeholder="메모 검색"
            placeholderTextColor={isDark ? "#A1A1A6" : "#636366"}
            keyboardAppearance={scheme} value={query} onChangeText={onQueryChange}
            clearButtonMode="while-editing" returnKeyType="search" autoCorrect={false} autoCapitalize="none"
            onSubmitEditing={() => { if (total) onNext(); }}
            style={[styles.input, { color: foreground }]} />
        </GlassView>
        <SearchButton symbol="xmark" label="검색 닫기" isDark={isDark} onPress={onClose} />
      </View>
      <View pointerEvents="box-none" style={[styles.bottomControls, { bottom: (keyboardHeight || bottomInset) + 12 }]}>
        <GlassView glassEffectStyle="regular" colorScheme={scheme} style={styles.counter}>
          <SymbolView name="text.magnifyingglass" size={21} tintColor={foreground} />
          <Text accessibilityLiveRegion="polite" style={[styles.countText, { color: foreground }]}>
            {query ? total ? `${total} 중 ${activeIndex + 1}` : "검색 결과 없음" : "검색어 입력"}
          </Text>
        </GlassView>
        <View style={styles.arrows}>
          <SearchButton symbol="chevron.up" label="이전 검색 결과" isDark={isDark} disabled={!total} onPress={onPrevious} />
          <SearchButton symbol="chevron.down" label="다음 검색 결과" isDark={isDark} disabled={!total} onPress={onNext} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 4 },
  searchRow: { position: "absolute", left: 18, right: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  inputSurface: { flex: 1, height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingRight: 14 },
  input: { flex: 1, height: 52, padding: 0, fontSize: 17 },
  bottomControls: { position: "absolute", left: 18, right: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 16 },
  counter: { minHeight: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingVertical: 12, flexShrink: 1 },
  countText: { fontSize: 15, fontVariant: ["tabular-nums"], flexShrink: 1 },
  arrows: { gap: 10 },
});
