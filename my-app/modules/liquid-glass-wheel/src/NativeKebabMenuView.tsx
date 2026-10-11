import { requireNativeView, requireOptionalNativeModule } from "expo";
import { Platform, type ViewProps } from "react-native";

type NativeKebabMenuProps = ViewProps & {
  isDark: boolean;
  showsDeleteAction?: boolean;
  showsEmptyTrashAction?: boolean;
  showsFolderActions?: boolean;
  folderName?: string;
  onDelete?: () => void;
  onEmptyTrash?: () => void;
  onRenameFolder?: (event: { nativeEvent: { name: string } }) => void;
  onDeleteFolder?: () => void;
  onSearch: () => void;
  onReorder: () => void;
  onSettings: () => void;
};

// Older development builds use the SwiftUI fallback so search works before a native rebuild.
const nativeModule = Platform.OS === "ios"
  ? requireOptionalNativeModule<{ hasNativeKebabMenu?: boolean; hasNativeKebabSearch?: boolean }>("LiquidGlassWheel")
  : null;

export default nativeModule?.hasNativeKebabMenu && nativeModule.hasNativeKebabSearch
  ? requireNativeView<NativeKebabMenuProps>("LiquidGlassWheel", "NativeKebabMenuView")
  : null;
