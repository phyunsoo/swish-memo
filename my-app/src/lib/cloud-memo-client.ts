import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { parseMemoSnapshot } from "./memo-validation";

type NativeCloudMemo = {
  getStatus(): Promise<{ status: string; syncStatus: string }>;
  syncSnapshot(json: string): Promise<string>;
};

export function cloudStatusLabel(status: string, syncStatus: string): string {
  if (status === "available") {
    if (syncStatus === "syncing") return "동기화 중…";
    if (syncStatus === "synced") return "동기화됨";
    if (syncStatus === "error") return "동기화 오류";
    return "계정 사용 가능";
  }
  if (status === "noAccount") return "iCloud 로그인 필요";
  if (status === "restricted") return "계정 제한됨";
  return "확인할 수 없음";
}

export function createCloudMemoClient(native: NativeCloudMemo | null) {
  let label = native ? "확인 중…" : "앱 업데이트 필요";
  let revision = 0;
  let syncing = false;
  let failed = false;
  const listeners = new Set<(value: string) => void>();
  function publish(value: string) {
    if (label === value) return;
    label = value;
    for (const listener of listeners) listener(value);
  }
  async function refreshStatus() {
    if (!native || syncing) return;
    const request = ++revision;
    try {
      const { status, syncStatus } = await native.getStatus();
      if (request === revision) publish(cloudStatusLabel(status, failed ? "error" : syncStatus));
    } catch {
      if (request === revision) publish("확인할 수 없음");
    }
  }
  return {
    available: native !== null,
    getStatusLabel: () => label,
    subscribe(listener: (value: string) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    refreshStatus,
    async syncSnapshot(json: string) {
      if (!native) throw new Error("CloudMemoSync is unavailable");
      ++revision; // An older account-status request must not overwrite this flight.
      syncing = true;
      publish("동기화 중…");
      try {
        const result = await native.syncSnapshot(json);
        parseMemoSnapshot(result);
        failed = false;
        publish("동기화됨");
        return result;
      } catch (error) {
        failed = true;
        publish("동기화 오류");
        throw error;
      } finally {
        syncing = false;
        void refreshStatus();
      }
    },
  };
}

export const cloudMemoClient = createCloudMemoClient(Platform.OS === "ios"
  ? requireOptionalNativeModule<NativeCloudMemo>("CloudMemoSync") : null);
