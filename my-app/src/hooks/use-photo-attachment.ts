import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { importNotePhotos, type NotePhoto } from "@/lib/note-photos";
import {
  cleanupTemporaryPhotoAssets,
  pickPhotoAttachmentAssets,
  preparePhotoAttachmentAssets,
  type PhotoAttachmentAsset,
} from "@/lib/photo-attachment-assets";
import type { DroppedImage } from "../../modules/liquid-glass-wheel/src/MacPhotoDropView";
import { isRunningOnMac } from "../../modules/liquid-glass-wheel/src/runtime-platform";
import type { PhotoAttachmentTarget } from "@/lib/photo-attachment-target";

type Options = {
  target: PhotoAttachmentTarget | null;
  targetKey: string;
  enabled: boolean;
  onAttach: (target: PhotoAttachmentTarget, photos: NotePhoto[]) => void;
  onRestoreFocus: (target: PhotoAttachmentTarget) => void;
};

export function usePhotoAttachment(options: Options) {
  const [phase, setPhase] = useState<"idle" | "picking" | "importing">("idle");
  const busy = useRef(false);
  const mounted = useRef(false);
  const latest = useRef(options);
  const operationVersion = useRef(0);
  useLayoutEffect(() => {
    if (latest.current.targetKey !== options.targetKey || latest.current.enabled !== options.enabled) {
      operationVersion.current += 1;
    }
    latest.current = options;
  });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const attachAssets = useCallback(async (operation: "picker" | "drop", getAssets: () => Promise<PhotoAttachmentAsset[] | null>) => {
    const { enabled, target } = latest.current;
    if (busy.current || !enabled || target === null) return;
    const version = operationVersion.current;
    const isCurrent = () => mounted.current && operationVersion.current === version;
    busy.current = true;
    setPhase(operation === "picker" ? "picking" : "importing");
    let failed = false;
    let assets: PhotoAttachmentAsset[] = [];
    try {
      assets = await getAssets() ?? [];
      // Never attach to another editor if the original editor was left while the picker was open.
      if (!isCurrent() || assets.length === 0) return;
      setPhase("importing");
      const sizedAssets = await preparePhotoAttachmentAssets(assets);
      if (!isCurrent()) return;
      const photos = importNotePhotos(sizedAssets);
      latest.current.onAttach(target, photos);
    } catch (error) {
      failed = true;
      console.warn("사진 첨부에 실패했습니다.", { operation, target, error });
      if (isCurrent()) Alert.alert("사진을 추가하지 못했어요", "다시 시도해 주세요. 작성 중인 메모는 그대로 유지됩니다.");
    } finally {
      cleanupTemporaryPhotoAssets(assets);
      busy.current = false;
      if (mounted.current) {
        setPhase("idle");
        if (!failed) requestAnimationFrame(() => {
          if (isCurrent()) latest.current.onRestoreFocus(target);
        });
      }
    }
  }, []);

  const attachPhotos = useCallback(() => attachAssets("picker", () => pickPhotoAttachmentAssets(isRunningOnMac)), [attachAssets]);

  const attachDroppedPhotos = useCallback((images: DroppedImage[], targetKey: string, failedCount = 0) => {
    const { enabled, target } = latest.current;
    if (busy.current || !enabled || target === null || latest.current.targetKey !== targetKey) {
      cleanupTemporaryPhotoAssets(images);
      return;
    }
    if (failedCount > 0) {
      Alert.alert("일부 사진을 추가하지 못했어요", `${failedCount}개 파일을 읽지 못했습니다. 이미지 파일인지 확인한 뒤 다시 시도해 주세요.`);
    }
    if (images.length === 0) return;
    return attachAssets("drop", async () => images);
  }, [attachAssets]);

  return { attachPhotos, attachDroppedPhotos, phase, isPickingPhotos: phase !== "idle" };
}
