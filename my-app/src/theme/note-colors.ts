// Follow the app's explicit appearance setting, independently of the OS theme.
export const NOTE_COLORS = {
  light: {
    text: "#171717",
    secondaryText: "#77777C",
    card: "#FAFAFA",
    editingCard: "#FFFFFF",
    border: "#CED1D6",
    control: "#F2F2F5",
    todo: "#007AFF",
    inset: "#EFEFF2",
    codeBorder: "#D8D8DC",
    quoteBorder: "#C7C7CC",
    link: "#007AFF",
  },
  dark: {
    text: "#F5F5F2",
    secondaryText: "#A1A1A6",
    card: "#242423",
    editingCard: "#242423",
    border: "#4A4A4D",
    control: "#343438",
    todo: "#0A84FF",
    inset: "#343438",
    codeBorder: "#4A4A4D",
    quoteBorder: "#4A4A4D",
    link: "#0A84FF",
  },
} as const;

export function getNoteColors(isDark: boolean) {
  return NOTE_COLORS[isDark ? "dark" : "light"];
}
