import { Directory, File, Paths } from "expo-file-system";

export type NotePhotoAsset = {
  uri: string;
  width: number;
  height: number;
};

export type NotePhoto = {
  fileName: string;
  width: number;
  height: number;
};

type PhotoContent = { draftPhotos?: NotePhoto[]; notes: { photos?: NotePhoto[] }[] };

export function notePhotoUri(photo: NotePhoto): string {
  return new File(Paths.document, "memo-photos", photo.fileName).uri;
}

export function importNotePhotos(assets: NotePhotoAsset[]): NotePhoto[] {
  const directory = new Directory(Paths.document, "memo-photos");
  directory.create({ intermediates: true, idempotent: true });
  const copied: File[] = [];
  try {
    return assets.map((asset) => {
      const source = new File(asset.uri);
      const extension = source.extension || ".jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
      const destination = new File(directory, fileName);
      copied.push(destination);
      source.copy(destination);
      return { fileName, width: asset.width, height: asset.height };
    });
  } catch (error) {
    for (const file of copied) {
      try { if (file.exists) file.delete(); } catch { /* Preserve the import error. */ }
    }
    throw error;
  }
}

function referencedPhotos(content?: PhotoContent): NotePhoto[] {
  return [...(content?.draftPhotos ?? []), ...(content?.notes.flatMap((note) => note.photos ?? []) ?? [])];
}

export function deleteRemovedPhotos(previous: PhotoContent | undefined, requested: PhotoContent, saved: PhotoContent) {
  const retained = new Set(referencedPhotos(saved).map((photo) => photo.fileName));
  const candidates = new Map([...referencedPhotos(previous), ...referencedPhotos(requested)]
    .map((photo) => [photo.fileName, photo]));
  for (const [fileName, photo] of candidates) {
    if (retained.has(fileName)) continue;
    try {
      const file = new File(notePhotoUri(photo));
      if (file.exists) file.delete();
    } catch (error) {
      console.warn("삭제된 메모의 사진 파일을 정리하지 못했습니다.", error);
    }
  }
}
