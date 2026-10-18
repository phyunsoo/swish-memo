import { Fragment } from "react";
import { Host } from "@expo/ui";
import { BottomSheet, Button, Grid, HStack, NavigationStack, ScrollView, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { buttonStyle, font, foregroundStyle, frame, padding, preferredColorScheme, presentationDetents, presentationDragIndicator } from "@expo/ui/swift-ui/modifiers";
import { FOLDER_PICKER_GAP, folderPickerRows, type FolderPickerGridProps, type FolderPickerSheetProps } from "./folder-picker-layout";

export function FolderPickerSheet({ visible, title, isDark, accentColor, onClose, onSave, children }: FolderPickerSheetProps) {
  const save = () => {
    if (!visible) return;
    onSave();
    onClose();
  };
  return (
    <Host style={{ position: "absolute" }} colorScheme={isDark ? "dark" : "light"}>
      <BottomSheet isPresented={visible} onIsPresentedChange={(presented) => { if (!presented) onClose(); }} onDismiss={onClose}>
        <NavigationStack modifiers={[
          presentationDetents([{ height: 460 }, "large"]), presentationDragIndicator("visible"), preferredColorScheme(isDark ? "dark" : "light"),
        ]}>
          <VStack spacing={12} modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }), padding({ horizontal: 20, top: 8, bottom: 20 }),
          ]}>
            <ZStack alignment="center" modifiers={[frame({ maxWidth: Infinity, height: 52 })]}>
              <Text modifiers={[font({ size: 17, weight: "semibold" })]}>{title}</Text>
              <HStack modifiers={[frame({ maxWidth: Infinity })]}>
                <Button label="취소" role="cancel" onPress={onClose} modifiers={[buttonStyle("plain"), foregroundStyle(isDark ? "#F5F5F2" : "#636366")]} />
                <Spacer />
                <Button label="완료" onPress={save} modifiers={[buttonStyle("plain"), foregroundStyle(accentColor)]} />
              </HStack>
            </ZStack>
            <ScrollView showsIndicators={false} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>{children}</ScrollView>
          </VStack>
        </NavigationStack>
      </BottomSheet>
    </Host>
  );
}

export function FolderPickerGrid<T>({ items, keyForItem, renderItem }: FolderPickerGridProps<T>) {
  return (
    <Grid horizontalSpacing={FOLDER_PICKER_GAP} verticalSpacing={FOLDER_PICKER_GAP}>
      {folderPickerRows(items).map((row, index) => (
        <Grid.Row key={index}>
          {row.map((item) => <Fragment key={keyForItem(item)}>{renderItem(item)}</Fragment>)}
        </Grid.Row>
      ))}
    </Grid>
  );
}
