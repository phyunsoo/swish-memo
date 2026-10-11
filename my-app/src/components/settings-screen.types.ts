import type { AppearanceMode } from "@/lib/appearance";

export type SettingsScreenProps = {
  mode: AppearanceMode;
  onModeChange: (mode: AppearanceMode) => void;
  noteFontSize: number;
  notePlaceholder: string;
  onNoteFontSizeChange: (size: number) => void;
  onNotePlaceholderChange: (value: string) => void;
  markdownEnabled: boolean;
  onMarkdownEnabledChange: (value: boolean) => void;
  onClose: () => void;
};
