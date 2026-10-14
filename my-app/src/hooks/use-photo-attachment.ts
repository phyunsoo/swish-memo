import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { importNotePhotos, type NotePhoto } from "@/lib/note-photos";
import type { StoredNote } from "@/lib/local-store";

export type PhotoAttachmentTarget = "new" | number;

export function resolvePhotoAttachmentTarget(editingNoteId: number | null, activeView: string, notes: StoredNote[]): PhotoAttachmentTarget | null {
  if (editingNoteId === null) return activeView === "home" ? "new" : null;
  const note = notes.find((item) => item.id === editingNoteId);
  return note && note.folderId !== "todo" ? note.id : null;
}

type Options = {
  target: PhotoAttachmentTarget | null;
  enabled: boolean;
  onAttach: (target: PhotoAttachmentTarget, photos: NotePhoto[]) => void;
  onRestoreFocus: (target: PhotoAttachmentTarget) => void;
};

export function usePhotoAttachment(options: Options) {
  const [phase, setPhase] = useState<"idle" | "picking" | "importing">("idle");
  const busy = useRef(false);
  const mounted = useRef(false);
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const attachPhotos = useCallback(async () => {
    const { enabled, target } = latest.current;
    if (busy.current || !enabled || target === null) return;
    busy.current = true;
    setPhase("picking");
    let operation = "picker";
    let failed = false;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsMultipleSelection: true, orderedSelection: true, quality: 1,
      });
      // Never attach to another editor if the original editor was left while the picker was open.
      if (!mounted.current || latest.current.target !== target || result.canceled) return;
      operation = "import";
      setPhase("importing");
      const photos = importNotePhotos(result.assets);
      latest.current.onAttach(target, photos);
    } catch (error) {
      failed = true;
      console.warn("사진 첨부에 실패했습니다.", { operation, target, error });
      if (mounted.current) Alert.alert("사진을 추가하지 못했어요", "다시 시도해 주세요. 작성 중인 메모는 그대로 유지됩니다.");
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPhase("idle");
        if (!failed) requestAnimationFrame(() => {
          if (mounted.current && latest.current.target === target) latest.current.onRestoreFocus(target);
        });
      }
    }
  }, []);

  return { attachPhotos, phase, isPickingPhotos: phase !== "idle" };
}
