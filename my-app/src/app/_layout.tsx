import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MemoStorageProvider } from "@/hooks/use-memo-storage";
import { AppearanceProvider } from "@/lib/appearance";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppearanceProvider>
        <MemoStorageProvider>
          <Stack />
        </MemoStorageProvider>
      </AppearanceProvider>
    </GestureHandlerRootView>
  );
}
