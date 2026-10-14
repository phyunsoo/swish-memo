import { requireNativeView, requireOptionalNativeModule } from "expo";
import { Platform, type ViewProps } from "react-native";

export type NativeKebabMenuAction = {
  id: string;
  title: string;
  systemImage: string;
  destructive: boolean;
  disabled: boolean;
};

type NativeKebabMenuProps = ViewProps & {
  isDark: boolean;
  actions: NativeKebabMenuAction[];
  onAction: (event: { nativeEvent: { id: string } }) => void;
};

// Older development builds keep working through the SwiftUI renderer until rebuilt.
const nativeModule = Platform.OS === "ios"
  ? requireOptionalNativeModule<{ hasConfigurableKebabMenu?: boolean }>("LiquidGlassWheel")
  : null;

export default nativeModule?.hasConfigurableKebabMenu
  ? requireNativeView<NativeKebabMenuProps>("LiquidGlassWheel", "NativeKebabMenuView")
  : null;
