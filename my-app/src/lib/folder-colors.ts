export type CanonicalFolderColorId = "gold" | `rgb-${string}`;

export type FolderColorOption = {
  readonly id: CanonicalFolderColorId;
  readonly label: string;
  readonly swatch: string;
  readonly light: string;
  readonly dark: string;
  readonly check: string;
};

const LEGACY_NAMED_SWATCHES = {
  red: "#EF5350", orange: "#F27A28", yellow: "#E6C547", green: "#42A85A", mint: "#39BDB0",
  blue: "#438DE0", indigo: "#6673D8", purple: "#A06CC7", gray: "#929299", rose: "#F43F5E",
  coral: "#FF6B6B", salmon: "#FA8072", burgundy: "#8B1E3F", brick: "#B23A48", tangerine: "#F97316",
  amber: "#F59E0B", peach: "#FB923C", lemon: "#FDE047", lime: "#A3E635", forest: "#166534",
  emerald: "#10B981", seafoam: "#6EE7B7", teal: "#14B8A6", cyan: "#06B6D4", sky: "#0EA5E9",
  ocean: "#2563EB", royalblue: "#1D4ED8", lavender: "#8B5CF6", violet: "#7C3AED", magenta: "#D946EF",
  pink: "#EC4899", lilac: "#C084FC", rosegold: "#B76E79", cocoa: "#8D6E63", tan: "#C4A484",
  brown: "#8B5E3C", slate: "#64748B", charcoal: "#4B5563", silver: "#BFC5CC",
} as const;

export type FolderColorId = CanonicalFolderColorId | keyof typeof LEGACY_NAMED_SWATCHES | `gradient-${number}`;

// Persisted v1 positions must retain their original colors when the palette changes.
const LEGACY_GRADIENT_SWATCHES = `
  ffffff ffe3e3 ffc6c6 ffaaaa ff8e8e ff7171 ff5555 ff3939 ff1c1c ff0000
  fc1200 fa2400 f73500 f44700 f25900 ef6b00 ec7c00 ea8e00 e7a000 eaab00
  ecb500 efc000 f2ca00 f4d500 f7df00 faea00 fcf400 ffff00 e3ff00 c6ff00
  aaff00 8eff00 71ff00 55ff00 39ff00 1cff00 00ff00 00ff1c 00ff39 00ff55
  00ff71 00ff8e 00ffaa 00ffc6 00ffe3 00ffff 00e3ff 00c6ff 00aaff 008eff
  0071ff 0055ff 0039ff 001cff 0000ff 1c00ff 3900ff 5500ff 7100ff 8e00ff
  aa00ff c600ff e300ff ff00ff e300e3 c600c6 aa00aa 8e008e 710071 550055
  390039 1c001c 000000
`.trim().split(/\s+/);

const legacySwatches = new Map<string, string>(Object.entries(LEGACY_NAMED_SWATCHES));
LEGACY_GRADIENT_SWATCHES.forEach((hex, index) => {
  if (index !== 18) legacySwatches.set(`gradient-${index.toString().padStart(2, "0")}`, `#${hex.toUpperCase()}`);
});

const DEFAULT_SWATCH = "#E7A000";
export const DEFAULT_FOLDER_COLOR: CanonicalFolderColorId = "gold";

const COLOR_STOPS = [
  { label: "흰색", color: "#FFFFFF" },
  { label: "빨강", color: "#FF0000" },
  { label: "주황", color: DEFAULT_SWATCH },
  { label: "노랑", color: "#FFFF00" },
  { label: "초록", color: "#00FF00" },
  { label: "청록", color: "#00FFFF" },
  { label: "파랑", color: "#0000FF" },
  { label: "자주", color: "#FF00FF" },
  { label: "검정", color: "#000000" },
] as const;

function rgb(hex: string) {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
}

function interpolate(first: string, second: string, amount: number) {
  const start = rgb(first);
  const end = rgb(second);
  const channels = start.map((value, index) => Math.round(value + (end[index] - value) * amount));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function relativeLuminance(hex: string) {
  const channels = rgb(hex).map((value) => value / 255).map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function readableTint(swatch: string, darkTheme: boolean) {
  const background = darkTheme ? "#111110" : "#FFFFFF";
  const target = darkTheme ? "#FFFFFF" : "#000000";
  for (let step = 0; step <= 40; step += 1) {
    const candidate = interpolate(swatch, target, step / 40);
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return target;
}

function idForSwatch(swatch: string): CanonicalFolderColorId {
  return swatch === DEFAULT_SWATCH ? "gold" : `rgb-${swatch.slice(1).toLowerCase()}`;
}

const colorCache = new Map<CanonicalFolderColorId, FolderColorOption>();

function colorOption(swatch: string, label: string): FolderColorOption {
  const id = idForSwatch(swatch);
  const cached = colorCache.get(id);
  if (cached) return cached;
  const option: FolderColorOption = {
    id,
    label,
    swatch,
    light: readableTint(swatch, false),
    dark: readableTint(swatch, true),
    check: contrast(swatch, "#171717") >= contrast(swatch, "#FFFFFF") ? "#171717" : "#FFFFFF",
  };
  colorCache.set(id, option);
  return option;
}

function buildFolderColorOptions() {
  const options: FolderColorOption[] = [];
  for (let segment = 0; segment < COLOR_STOPS.length - 1; segment += 1) {
    const start = COLOR_STOPS[segment];
    const end = COLOR_STOPS[segment + 1];
    for (let step = 0; step < 9; step += 1) {
      options.push(colorOption(interpolate(start.color, end.color, step / 9), step === 0 ? start.label : `${end.label} ${step}`));
    }
  }
  options.push(colorOption("#000000", "검정"));
  return options;
}

export const FOLDER_COLOR_OPTIONS: readonly FolderColorOption[] = buildFolderColorOptions();

export function isFolderColorId(value: unknown): value is FolderColorId {
  return typeof value === "string"
    && (value === DEFAULT_FOLDER_COLOR || /^rgb-[0-9a-f]{6}$/.test(value) || legacySwatches.has(value));
}

export function folderColorSwatch(color: FolderColorId | undefined) {
  if (color && /^rgb-[0-9a-f]{6}$/.test(color)) return `#${color.slice(4).toUpperCase()}`;
  return (color ? legacySwatches.get(color) : undefined) ?? DEFAULT_SWATCH;
}

export function canonicalFolderColorId(color: FolderColorId | undefined): CanonicalFolderColorId {
  return idForSwatch(folderColorSwatch(color));
}

export function folderColorFor(color: FolderColorId | undefined, isDark: boolean) {
  const option = colorOption(folderColorSwatch(color), "현재 색상");
  return isDark ? option.dark : option.light;
}

export function folderIconTint(color: FolderColorId | undefined, isDark: boolean) {
  const swatch = folderColorSwatch(color);
  const background = isDark ? "#111110" : "#FFFFFF";
  return contrast(swatch, background) < 2.7 ? folderColorFor(color, isDark) : swatch;
}

export function folderColorSelectionBackground(color: FolderColorId | undefined, isDark: boolean) {
  return interpolate(isDark ? "#343438" : "#FFFFFF", folderColorSwatch(color), isDark ? 0.22 : 0.12);
}

// Keep a legacy/custom color selectable without rounding it to a different RGB value.
export function folderColorOptionsFor(color: FolderColorId | undefined): readonly FolderColorOption[] {
  const swatch = folderColorSwatch(color);
  const current = colorOption(swatch, "현재 색상");
  if (FOLDER_COLOR_OPTIONS.some((option) => option.id === current.id)) return FOLDER_COLOR_OPTIONS;
  const currentRgb = rgb(swatch);
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  FOLDER_COLOR_OPTIONS.forEach((option, index) => {
    const distance = rgb(option.swatch).reduce((total, value, channel) => total + (value - currentRgb[channel]) ** 2, 0);
    if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
  });
  return [...FOLDER_COLOR_OPTIONS.slice(0, nearestIndex), current, ...FOLDER_COLOR_OPTIONS.slice(nearestIndex)];
}
