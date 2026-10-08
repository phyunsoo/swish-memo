import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { WheelRingViewProps } from './LiquidGlassWheel.types';

// Keep an older development build usable until the native module has been rebuilt.
export const hasNativeWheelRing = Platform.OS === 'ios' &&
  requireOptionalNativeModule('LiquidGlassWheel') !== null;

// Keep the native module identifier compatible with existing development builds.
export default hasNativeWheelRing
  ? requireNativeView<WheelRingViewProps>('LiquidGlassWheel')
  : null;
