import { useState } from "react";
import { Image } from "expo-image";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notePhotoUri, type NotePhoto } from "@/lib/note-photos";

export function NotePhotos({ photos = [], onRemove }: {
  photos?: NotePhoto[];
  onRemove?: (photo: NotePhoto) => void;
}) {
  const [selected, setSelected] = useState<NotePhoto | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (photos.length === 0) return null;
  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => (
        <View key={photo.fileName} style={photos.length === 1 ? styles.single : styles.tile}>
          <Pressable accessibilityRole="button" accessibilityLabel={`사진 ${index + 1} 열기`}
            onPress={() => setSelected(photo)}>
            <Image source={notePhotoUri(photo)} contentFit="cover" recyclingKey={photo.fileName}
              style={[styles.image, { aspectRatio: photos.length === 1
                ? Math.max(0.8, Math.min(1.8, photo.width / Math.max(1, photo.height))) : 1 }]} />
          </Pressable>
          {onRemove && <Pressable accessibilityRole="button" accessibilityLabel={`사진 ${index + 1} 제거`}
            style={styles.remove} onPress={() => onRemove(photo)}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>}
        </View>
      ))}
      <Modal visible={selected !== null} animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.viewer}>
          {selected && <ScrollView key={selected.fileName} minimumZoomScale={1} maximumZoomScale={4}
            centerContent contentContainerStyle={styles.viewerContent}>
            <Image source={notePhotoUri(selected)} contentFit="contain" style={{ width, height }} />
          </ScrollView>}
          <Pressable accessibilityRole="button" accessibilityLabel="사진 닫기"
            style={[styles.close, { top: insets.top + 8 }]} onPress={() => setSelected(null)}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 6 },
  single: { width: "100%" },
  tile: { width: "48%", flexGrow: 1, maxWidth: "50%" },
  image: { width: "100%", borderRadius: 12, backgroundColor: "#8E8E9320" },
  remove: { position: "absolute", top: 0, right: 0, width: 44, height: 44,
    alignItems: "center", justifyContent: "center" },
  removeText: { color: "#FFFFFF", backgroundColor: "#00000099", borderRadius: 14,
    overflow: "hidden", textAlign: "center", width: 28, height: 28, fontSize: 24, lineHeight: 27 },
  viewer: { flex: 1, backgroundColor: "#000000" },
  viewerContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  close: { position: "absolute", right: 20, minWidth: 60, height: 44, borderRadius: 22,
    backgroundColor: "#333333CC", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#FFFFFF", fontSize: 17 },
});
