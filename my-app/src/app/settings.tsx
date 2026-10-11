import { Stack, useRouter } from "expo-router";
import { StatusBar, View } from "react-native";
import { useMemoStorage } from "@/hooks/use-memo-storage";
import { useAppearance } from "@/lib/appearance";
import SettingsScreen from "@/components/settings-screen";

export default function SettingsRoute() {
  const router = useRouter();
  const { mode, setMode, isDark } = useAppearance();
  const { noteFontSize, setNoteFontSize, notePlaceholder, setNotePlaceholder, markdownEnabled, setMarkdownEnabled } = useMemoStorage();
  const backgroundColor = isDark ? "#000000" : "#F2F2F7";
  return <View style={{ flex: 1, backgroundColor }}>
    <Stack.Screen options={{ title: "설정", headerShown: false, contentStyle: { backgroundColor } }} />
    <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
    <SettingsScreen mode={mode} onModeChange={setMode} noteFontSize={noteFontSize} onNoteFontSizeChange={setNoteFontSize} notePlaceholder={notePlaceholder} onNotePlaceholderChange={setNotePlaceholder} markdownEnabled={markdownEnabled} onMarkdownEnabledChange={setMarkdownEnabled} onClose={() => router.back()} />
  </View>;
}
