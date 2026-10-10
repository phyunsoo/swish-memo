import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { NOTE_TEXT_SIZE } from "@/lib/note-typography";
import type { SettingsScreenProps } from "./settings-screen.types";

export default function SettingsScreen({ mode, onModeChange, noteFontSize, onNoteFontSizeChange, notePlaceholder, onNotePlaceholderChange }: SettingsScreenProps) {
  const [placeholderVisible, setPlaceholderVisible] = useState(false);
  const [draftPlaceholder, setDraftPlaceholder] = useState(notePlaceholder);
  return <><ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
    <Text style={{ fontSize: 21, fontWeight: "600" }}>화면</Text>
    <View style={{ flexDirection: "row", gap: 12 }}>
      {([["light", "라이트"], ["dark", "다크"]] as const).map(([value, label]) => (
        <Text key={value} onPress={() => onModeChange(value)} style={{ padding: 10, fontWeight: mode === value ? "700" : "400" }}>{label}</Text>
      ))}
    </View>
    <Text onPress={() => { setDraftPlaceholder(notePlaceholder); setPlaceholderVisible(true); }}>플레이스홀더 텍스트　편집</Text>
    <Text>텍스트 크기 · {Math.round(noteFontSize)} pt</Text>
    <Text style={{ fontSize: noteFontSize }}>예시 텍스트입니다.</Text>
    <View style={{ height: 44, justifyContent: "center" }}>
      <Text onPress={() => onNoteFontSizeChange(Math.min(NOTE_TEXT_SIZE.max, noteFontSize + NOTE_TEXT_SIZE.step))}>텍스트 크기 키우기 ＋</Text>
    </View>
    <Text style={{ fontSize: 21, fontWeight: "600" }}>정보</Text>
    <Text>iCloud　준비 중</Text>
    <Text>버전</Text>
    <Text>개인정보 처리방침　준비 중</Text>
  </ScrollView>
  <Modal visible={placeholderVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPlaceholderVisible(false)}>
    <View style={{ flex: 1, padding: 24, gap: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "600", textAlign: "center" }}>플레이스홀더 텍스트</Text>
      <TextInput multiline value={draftPlaceholder} onChangeText={setDraftPlaceholder} placeholder="메모 입력창에 표시할 안내 문구" textAlignVertical="top" style={{ minHeight: 180, padding: 16, borderRadius: 16, backgroundColor: "#F2F2F7", fontSize: 17 }} />
      <Pressable onPress={() => { onNotePlaceholderChange(draftPlaceholder); setPlaceholderVisible(false); }}><Text style={{ color: "#007AFF", fontSize: 17, textAlign: "right" }}>저장</Text></Pressable>
    </View>
  </Modal></>;
}
