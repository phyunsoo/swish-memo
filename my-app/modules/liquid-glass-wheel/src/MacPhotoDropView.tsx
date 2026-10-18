import { requireNativeView } from "expo";
import { type ViewProps } from "react-native";
import type { PropsWithChildren } from "react";
import { isRunningOnMac } from "./runtime-platform";

export type DroppedImage = {
  uri: string;
  width: number;
  height: number;
  temporary: true;
};

type NativePhotoDropViewProps = ViewProps & {
  enabled: boolean;
  targetKey: string;
  onDropImages: (event: { nativeEvent: { targetKey: string; images: DroppedImage[]; failedCount: number } }) => void;
};

export const MacPhotoDropView = isRunningOnMac
  ? requireNativeView<NativePhotoDropViewProps>("LiquidGlassWheel", "MacPhotoDropView")
  : null;

export function MacPhotoDropContainer({ enabled, targetKey, onDropImages, children }: PropsWithChildren<{
  enabled: boolean;
  targetKey: string;
  onDropImages: NativePhotoDropViewProps["onDropImages"];
}>) {
  if (!MacPhotoDropView || !isRunningOnMac) return children;
  return <MacPhotoDropView style={{ flex: 1 }} enabled={enabled} targetKey={targetKey}
    onDropImages={onDropImages}>{children}</MacPhotoDropView>;
}
