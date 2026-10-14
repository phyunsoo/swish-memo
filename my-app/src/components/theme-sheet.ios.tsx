import { Host } from "@expo/ui";
import { BottomSheet, HStack, Image, NavigationStack, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits, accessibilityElement, accessibilityLabel, background, contentShape, font, frame,
  accessibilityHidden, foregroundStyle, opacity, padding, preferredColorScheme,
  onTapGesture, presentationDetents, presentationDragIndicator, shapes, strokeBorder,
} from "@expo/ui/swift-ui/modifiers";
import type { AppearanceMode } from "@/lib/appearance";

type ThemeSheetProps = {
  visible: boolean;
  mode: AppearanceMode;
  isDark: boolean;
  onModeChange: (mode: AppearanceMode) => void;
  onClose: () => void;
};

function ThemeOption({
  mode,
  selected,
  title,
  swatchColor,
  isDark,
  onPress,
}: {
  mode: AppearanceMode;
  selected: boolean;
  title: string;
  swatchColor: string;
  isDark: boolean;
  onPress: (mode: AppearanceMode) => void;
}) {
  return (
    <HStack
      spacing={18}
      modifiers={[
        frame({ maxWidth: Infinity, minHeight: 76 }),
        contentShape(shapes.rectangle()),
        onTapGesture(() => onPress(mode)),
        accessibilityElement("ignore"),
        accessibilityLabel(`${title}${selected ? ", 선택됨" : ", 선택 안 됨"}`),
        accessibilityAddTraits(["isButton"]),
      ]}
    >
      <Text modifiers={[
        frame({ width: 54, height: 54 }),
        background(swatchColor, shapes.circle()),
        strokeBorder({ content: isDark ? "#5A5A5E" : "#C7C7CC", style: { lineWidth: 1 }, shape: "circle" }),
        accessibilityHidden(true),
      ]}> </Text>
      <Text modifiers={[font({ size: 20, weight: "regular" })]}>{title}</Text>
      <Spacer />
      <Image systemName="checkmark" modifiers={[
        font({ size: 20, weight: "semibold" }),
        foregroundStyle("#007AFF"),
        frame({ width: 24, height: 24 }),
        opacity(selected ? 1 : 0),
        accessibilityLabel(selected ? "선택됨" : "선택 안 됨"),
      ]} />
    </HStack>
  );
}

export function ThemeSheet({ visible, mode, isDark, onModeChange, onClose }: ThemeSheetProps) {
  return (
    <Host style={{ position: "absolute" }} colorScheme={isDark ? "dark" : "light"}>
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={(presented) => { if (!presented) onClose(); }}
        onDismiss={onClose}
      >
        <NavigationStack modifiers={[
          presentationDetents(["medium", "large"]),
          presentationDragIndicator("visible"),
          preferredColorScheme(isDark ? "dark" : "light"),
        ]}>
          <VStack spacing={16} modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
            padding({ horizontal: 24, top: 8, bottom: 24 }),
          ]}>
            <ZStack alignment="center" modifiers={[frame({ maxWidth: Infinity, height: 56 })]}>
              <Text modifiers={[font({ size: 20, weight: "semibold" })]}>테마</Text>
            </ZStack>
            <VStack spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
              <ThemeOption mode="light" title="라이트" swatchColor="#E5E5EA" isDark={isDark} selected={mode === "light"} onPress={onModeChange} />
              <ThemeOption mode="dark" title="다크" swatchColor="#343438" isDark={isDark} selected={mode === "dark"} onPress={onModeChange} />
            </VStack>
          </VStack>
        </NavigationStack>
      </BottomSheet>
    </Host>
  );
}
