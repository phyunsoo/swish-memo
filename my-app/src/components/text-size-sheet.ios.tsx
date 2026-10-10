import { NOTE_TEXT_SIZE } from "@/lib/note-typography";
import { Host } from "@expo/ui";
import { BottomSheet, NavigationStack, Slider, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { accessibilityLabel, background, font, frame, lineLimit, padding, preferredColorScheme, presentationDetents, presentationDragIndicator, shapes } from "@expo/ui/swift-ui/modifiers";
import type { TextSizeSheetProps } from "./text-size-sheet";

export function TextSizeSheet({ visible, onClose, value, onValueChange, preview, isDark }: TextSizeSheetProps) {
  return (
    <Host style={{ position: "absolute" }} colorScheme={isDark ? "dark" : "light"}>
      <BottomSheet isPresented={visible} onIsPresentedChange={(presented) => { if (!presented) onClose(); }}>
        <NavigationStack modifiers={[presentationDetents(["medium"]), presentationDragIndicator("visible"), preferredColorScheme(isDark ? "dark" : "light")]}>
          <VStack spacing={28} modifiers={[
              frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
              padding({ horizontal: 24, top: 12 }),
            ]}>
              <ZStack alignment="center" modifiers={[frame({ maxWidth: Infinity, height: 60 })]}>
                <Text modifiers={[font({ size: 20, weight: "semibold" })]}>텍스트 크기</Text>
              </ZStack>
              <VStack spacing={8} modifiers={[
                padding({ all: 24 }),
                frame({ maxWidth: Infinity, minHeight: 110 }),
                background(isDark ? "#2C2C2E" : "#F2F2F7", shapes.roundedRectangle({ cornerRadius: 24 })),
              ]}>
                <Text modifiers={[font({ size: value }), lineLimit(1)]}>{preview}</Text>
              </VStack>
              <Slider value={value} min={NOTE_TEXT_SIZE.min} max={NOTE_TEXT_SIZE.max} step={NOTE_TEXT_SIZE.step} onValueChange={onValueChange}
                modifiers={[accessibilityLabel("메모 텍스트 크기")]}
                minimumValueLabel={<Text modifiers={[font({ size: 16 })]}>A</Text>}
                maximumValueLabel={<Text modifiers={[font({ size: 30 })]}>A</Text>}
              />
          </VStack>
        </NavigationStack>
      </BottomSheet>
    </Host>
  );
}
