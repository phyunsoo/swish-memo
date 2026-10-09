import { requireNativeView, requireOptionalNativeModule } from "expo";
import { Platform, type ViewProps } from "react-native";

type NativeKebabMenuProps = ViewProps & {
  isDark: boolean;
  onDelete: () => void;
  onTextSize: () => void;
};

// Older development builds keep using the existing menu until the app is rebuilt.
const nativeModule = Platform.OS === "ios"
  ? requireOptionalNativeModule<{ hasNativeKebabMenu?: boolean }>("LiquidGlassWheel")
  : null;

export default nativeModule?.hasNativeKebabMenu
  ? requireNativeView<NativeKebabMenuProps>("LiquidGlassWheel", "NativeKebabMenuView")
  : null;
