import { useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { Stack } from "expo-router";
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

function getMinimumNoteHeight(text: string) {
  return Math.max(1, text.split("\n").length) * NOTE_LINE_HEIGHT;
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
}: {
  title: string;
  glassTint: string;
  onPress: () => void;
}) {
  const usesNativeGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

  return (
    <View style={[styles.glassButton, styles.doneButton]}>
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
            frame({ width: TEXT_BUTTON_WIDTH, height: BUTTON_HEIGHT }),
            controlSize("large"),
          ]}
          style={styles.doneNativeButton}
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const inputRef = useRef<InstanceType<typeof NativeTextInput>>(null);
  const noteTextRef = useRef("");
  const editorHeightRef = useRef<number | undefined>(undefined);
  const [noteText, setNoteText] = useState("");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [editorHeight, setEditorHeight] = useState<number | undefined>(undefined);
  const hasContent = noteText.trim().length > 0;

  const updateEditorHeight = (height: number | undefined) => {
    editorHeightRef.current = height;
    setEditorHeight(height);
  };

  const handleTextChange = (text: string) => {
    const nextHasContent = text.trim().length > 0;
    const wasEmpty = noteTextRef.current.trim().length === 0;
    noteTextRef.current = text;
    setNoteText(text);

    if (!nextHasContent) {
      updateEditorHeight(undefined);
      return;
    }

    const measuredHeight = wasEmpty ? 0 : (editorHeightRef.current ?? 0);
    updateEditorHeight(Math.max(measuredHeight, getMinimumNoteHeight(text)));
  };

  const finishEditing = () => {
    updateEditorHeight(
      Math.max(
        editorHeightRef.current ?? 0,
        getMinimumNoteHeight(noteTextRef.current),
      ),
    );
    inputRef.current?.blur();
    setIsOrganizing(true);
  };

  const resumeEditing = () => {
    setIsOrganizing(false);
    requestAnimationFrame(() => inputRef.current?.focus());
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
              {hasContent && (
                <GlassTextButton
                  title={isOrganizing ? "편집" : "완료"}
                  glassTint={isDark ? "#343438" : "#F2F2F5"}
                  onPress={isOrganizing ? resumeEditing : finishEditing}
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

        <ScrollView
          style={styles.scrollArea}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 12 + BUTTON_HEIGHT,
            paddingBottom: Math.max(insets.bottom, 18),
          }}
        >
          <View
            style={[
              styles.editorCard,
              !isOrganizing && styles.editingCard,
              isOrganizing && hasContent && styles.organizingCard,
              isDark && isOrganizing && hasContent && styles.darkOrganizingCard,
            ]}
          >
            <NativeTextInput
              ref={inputRef}
              accessibilityLabel="메모 내용"
              accessibilityHint="떠오른 생각을 자유롭게 입력하세요"
              autoFocus
              editable={!isOrganizing}
              multiline
              onChangeText={handleTextChange}
              value={noteText}
              placeholder={PLACEHOLDER}
              placeholderTextColor={isDark ? "#747474" : "#A0A0A0"}
              scrollEnabled={false}
              selectionColor={ACCENT}
              style={[
                styles.editorInput,
                {
                  color: isDark ? "#F5F5F2" : "#171717",
                  height: isOrganizing ? editorHeight : undefined,
                },
              ]}
            />
            {hasContent && (
              <NativeText
                accessible={false}
                pointerEvents="none"
                onLayout={(event) => {
                  updateEditorHeight(event.nativeEvent.layout.height);
                }}
                style={[
                  styles.measureText,
                  { width: Math.max(1, windowWidth - 82) },
                ]}
              >
                {noteText}
              </NativeText>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollArea: {
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
  measureText: {
    position: "absolute",
    top: -10000,
    left: 15,
    opacity: 0,
    fontSize: NOTE_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    padding: 0,
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
});
