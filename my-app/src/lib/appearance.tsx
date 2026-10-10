import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SQLite from "expo-sqlite";

export type AppearanceMode = "light" | "dark";

const databasePromise = SQLite.openDatabaseAsync("swish-memo.db");
const AppearanceContext = createContext<{ mode: AppearanceMode; setMode: (mode: AppearanceMode) => void } | null>(null);

async function readMode(): Promise<AppearanceMode> {
  const db = await databasePromise;
  await db.execAsync("CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_preferences WHERE key = 'appearance_mode'");
  return row?.value === "dark" ? "dark" : "light";
}

async function writeMode(mode: AppearanceMode) {
  const db = await databasePromise;
  await db.execAsync("CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
  await db.runAsync("INSERT INTO app_preferences (key, value) VALUES ('appearance_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", mode);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<AppearanceMode>("light");
  useEffect(() => { void readMode().then(updateMode).catch((error) => console.warn("화면 모드를 불러오지 못했습니다.", error)); }, []);
  const value = useMemo(() => ({
    mode,
    setMode: (next: AppearanceMode) => {
      updateMode(next);
      void writeMode(next).catch((error) => console.warn("화면 모드를 저장하지 못했습니다.", error));
    },
  }), [mode]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return { ...context, isDark: context.mode === "dark" };
}
