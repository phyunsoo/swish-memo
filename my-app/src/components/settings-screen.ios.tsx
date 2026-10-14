import { useState } from "react";
import { Host, Switch } from "@expo/ui";
import { Button, Form, HStack, Image, Section, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel, alignmentGuide, buttonStyle, font, foregroundStyle, frame, padding,
} from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import { useAppearance } from "@/lib/appearance";
import { TextSizeSheet } from "./text-size-sheet";
import { ThemeSheet } from "./theme-sheet.ios";
import { PlaceholderTextSheet } from "./placeholder-text-sheet.ios";
import type { SettingsScreenProps } from "./settings-screen.types";

const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" });
const rowModifiers = [
  frame({ maxWidth: Infinity, minHeight: 44, alignment: "leading" }),
  alignmentGuide("listRowSeparatorLeading", 0),
];

type SettingsSheet = "theme" | "placeholder" | "textSize";

function InformationRow({ title, value }: { title: string; value: string }) {
  return (
    <HStack spacing={16} modifiers={rowModifiers}>
      <Text>{title}</Text>
      <Spacer />
      <Text modifiers={[secondary]}>{value}</Text>
    </HStack>
  );
}

function SettingsActionRow({ title, value, onPress }: { title: string; value: string; onPress: () => void }) {
  return (
    <Button onPress={onPress} modifiers={[buttonStyle("plain"), ...rowModifiers]}>
      <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
        <Text>{title}</Text>
        <Spacer />
        <Text modifiers={[secondary]}>{value}</Text>
        <Image systemName="chevron.right" modifiers={[font({ size: 13, weight: "semibold" }), secondary]} />
      </HStack>
    </Button>
  );
}

export default function SettingsScreen({ mode, onModeChange, noteFontSize, onNoteFontSizeChange, notePlaceholder, onNotePlaceholderChange, markdownEnabled, onMarkdownEnabledChange, onClose }: SettingsScreenProps) {
  const { isDark } = useAppearance();
  const [activeSheet, setActiveSheet] = useState<SettingsSheet | null>(null);
  const backgroundColor = isDark ? "#000000" : "#F2F2F7";
  const closeSheet = (sheet: SettingsSheet) => {
    setActiveSheet((current) => current === sheet ? null : current);
  };

  return (
    <>
      <Host style={{ flex: 1, backgroundColor }} colorScheme={isDark ? "dark" : "light"}>
        <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <HStack spacing={0} modifiers={[padding({ horizontal: 18, vertical: 12 }), frame({ maxWidth: Infinity })]}>
            <Text modifiers={[font({ size: 22, weight: "bold" })]}>설정</Text>
            <Spacer />
            <Button onPress={onClose} modifiers={[
              accessibilityLabel("설정 닫기"),
              buttonStyle("plain"),
              frame({ minWidth: 72, minHeight: 44 }),
            ]}>
              <Text modifiers={[foregroundStyle("#007AFF")]}>닫기</Text>
            </Button>
          </HStack>
          <Form>
            <Section title="화면">
              <SettingsActionRow
                title="화면 모드"
                value={mode === "light" ? "라이트" : "다크"}
                onPress={() => setActiveSheet("theme")}
              />
              <SettingsActionRow
                title="플레이스홀더 텍스트"
                value="편집"
                onPress={() => setActiveSheet("placeholder")}
              />
              <SettingsActionRow
                title="텍스트 크기"
                value={`${Math.round(noteFontSize)} pt`}
                onPress={() => setActiveSheet("textSize")}
              />
              <Switch
                label="마크다운 문법"
                value={markdownEnabled}
                onValueChange={onMarkdownEnabledChange}
                modifiers={rowModifiers}
              />
            </Section>
            <Section title="정보">
              <InformationRow title="iCloud" value="준비 중" />
              <InformationRow title="버전" value={Constants.expoConfig?.version ?? "—"} />
              <InformationRow title="개인정보 처리방침" value="준비 중" />
            </Section>
          </Form>
        </VStack>
      </Host>
      {activeSheet === "placeholder" ? <PlaceholderTextSheet
        value={notePlaceholder}
        isDark={isDark}
        onSave={onNotePlaceholderChange}
        onClose={() => closeSheet("placeholder")}
      /> : null}
      <TextSizeSheet
        visible={activeSheet === "textSize"}
        onClose={() => closeSheet("textSize")}
        value={noteFontSize}
        onValueChange={onNoteFontSizeChange}
        preview="예시 텍스트입니다."
        isDark={isDark}
      />
      <ThemeSheet
        visible={activeSheet === "theme"}
        mode={mode}
        isDark={isDark}
        onModeChange={(nextMode) => {
          onModeChange(nextMode);
          closeSheet("theme");
        }}
        onClose={() => closeSheet("theme")}
      />
    </>
  );
}
