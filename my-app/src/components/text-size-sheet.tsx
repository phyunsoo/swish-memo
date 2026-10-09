import { NOTE_TEXT_SIZE } from "@/lib/note-typography";
import { BottomSheet, Button, Column, Host, Slider, Text } from "@expo/ui";

export type TextSizeSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: number;
  onValueChange: (value: number) => void;
  preview: string;
  isDark: boolean;
};

export function TextSizeSheet({ visible, onClose, value, onValueChange, preview }: TextSizeSheetProps) {
  return (
    <BottomSheet isPresented={visible} onDismiss={onClose} snapPoints={["half"]}>
      <Host style={{ height: 280 }}>
        <Column>
          <Text>텍스트 크기</Text>
          <Text textStyle={{ fontSize: value }}>{preview}</Text>
          <Slider value={value} min={NOTE_TEXT_SIZE.min} max={NOTE_TEXT_SIZE.max} step={NOTE_TEXT_SIZE.step} onValueChange={onValueChange} />
          <Button onPress={onClose}>닫기</Button>
        </Column>
      </Host>
    </BottomSheet>
  );
}
