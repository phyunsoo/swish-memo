import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

const nativeModule = Platform.OS === "ios"
  ? requireOptionalNativeModule<{ isRunningOnMac?: boolean }>("LiquidGlassWheel")
  : null;

export const isRunningOnMac = Platform.OS === "ios"
  && (Platform.isMacCatalyst === true || nativeModule?.isRunningOnMac === true);
