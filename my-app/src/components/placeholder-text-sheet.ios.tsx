import { useState } from "react";
import { Host } from "@expo/ui";
import { BottomSheet, Button, HStack, NavigationStack, Spacer, Text, TextField, VStack, ZStack, useNativeState } from "@expo/ui/swift-ui";
import {
  accessibilityLabel, background, buttonStyle, font, frame, foregroundStyle,
  padding, preferredColorScheme, presentationDetents, presentationDragIndicator, shapes,
} from "@expo/ui/swift-ui/modifiers";

type PlaceholderTextSheetProps = {
  value: string;
  isDark: boolean;
  onSave: (value: string) => void;
  onClose: () => void;
};

export function PlaceholderTextSheet({ value, isDark, onSave, onClose }: PlaceholderTextSheetProps) {
  const [draft, setDraft] = useState(value);
  const [isPresented, setIsPresented] = useState(true);
  const nativeDraft = useNativeState(value);

  return (
    <Host style={{ position: "absolute" }} colorScheme={isDark ? "dark" : "light"}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={setIsPresented}
        onDismiss={onClose}
      >
        <NavigationStack modifiers={[
          presentationDetents(["medium"]),
          presentationDragIndicator("visible"),
          preferredColorScheme(isDark ? "dark" : "light"),
        ]}>
          <VStack spacing={16} modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
            padding({ horizontal: 24, top: 8, bottom: 30 }),
          ]}>
            <ZStack alignment="center" modifiers={[frame({ maxWidth: Infinity, height: 56 })]}>
              <Text modifiers={[font({ size: 20, weight: "semibold" })]}>플레이스홀더 텍스트</Text>
              <HStack modifiers={[frame({ maxWidth: Infinity })]}>
                <Spacer />
                <Button
                  onPress={() => { onSave(draft); setIsPresented(false); }}
                  modifiers={[buttonStyle("plain"), accessibilityLabel("플레이스홀더 텍스트 저장")]}
                >
                  <Text modifiers={[foregroundStyle("#007AFF")]}>저장</Text>
                </Button>
              </HStack>
            </ZStack>
            <ZStack alignment="topLeading" modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
              <TextField
                text={nativeDraft}
                autoFocus
                onTextChange={setDraft}
                axis="vertical"
                placeholder="메모 입력창에 표시할 안내 문구"
                modifiers={[
                  accessibilityLabel("플레이스홀더 텍스트 입력"),
                  padding({ all: 16 }),
                  frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
                  background(isDark ? "#2C2C2E" : "#F2F2F7", shapes.roundedRectangle({ cornerRadius: 16 })),
                ]}
              />
            </ZStack>
          </VStack>
        </NavigationStack>
      </BottomSheet>
    </Host>
  );
}
