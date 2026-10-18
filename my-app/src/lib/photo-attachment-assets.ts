import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";
import type { NotePhotoAsset } from "./note-photos";

export type PhotoAttachmentAsset = NotePhotoAsset & { temporary?: boolean };

export async function pickPhotoAttachmentAssets(isRunningOnMac: boolean): Promise<PhotoAttachmentAsset[] | null> {
  if (isRunningOnMac) {
    const result = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ["image/*"] });
    return result.canceled ? null : result.result.map((file) => ({
      uri: file.uri, width: 0, height: 0, temporary: true,
    }));
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], allowsMultipleSelection: true, orderedSelection: true, quality: 1,
  });
  return result.canceled ? null : result.assets;
}

export async function preparePhotoAttachmentAssets(assets: PhotoAttachmentAsset[]): Promise<NotePhotoAsset[]> {
  return Promise.all(assets.map(async (asset) => {
    if (asset.width > 0 && asset.height > 0) return asset;
    try {
      const size = await Image.getSize(asset.uri);
      return { ...asset, ...size };
    } catch {
      throw new Error("선택한 파일에서 이미지 정보를 읽을 수 없습니다.");
    }
  }));
}

export function cleanupTemporaryPhotoAssets(assets: PhotoAttachmentAsset[]) {
  for (const asset of assets) {
    if (!asset.temporary) continue;
    try {
      const file = new File(asset.uri);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn("임시 이미지 파일을 정리하지 못했습니다.", error);
    }
  }
}
