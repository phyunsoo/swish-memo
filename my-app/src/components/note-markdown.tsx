import { memo, useMemo } from "react";
import { Linking, Platform, Text, type TextProps, View } from "react-native";
import Markdown, {
  createMarkdownIt,
  type MarkdownStyleMap,
  type RenderRules,
} from "@ronradtke/react-native-markdown-display";
import { getNoteColors } from "@/theme/note-colors";
import { getNoteTextStyle } from "@/lib/note-typography";

// Keep memo line breaks and punctuation as written. HTML stays disabled.
const parser = createMarkdownIt({ typographer: false }).set({ breaks: true });

function SelectableText(props: TextProps) {
  return <Text {...props} selectable />;
}

const rules: RenderRules = {
  // A simple, wrapping code block fits the narrow memo cards.
  fence: (node, _children, _parents, styles) => (
    <Text key={node.key} selectable style={styles.code_block}>
      {node.content.replace(/\n$/, "")}
    </Text>
  ),
};

function openLink(url: string) {
  if (/^(https?:|mailto:|tel:)/i.test(url)) {
    void Linking.openURL(url).catch(() => undefined);
  }
  return false;
}

export const NoteMarkdown = memo(function NoteMarkdown({
  text,
  fontSize,
  isDark = false,
}: {
  text: string;
  fontSize: number;
  isDark?: boolean;
}) {
  const styles = useMemo<MarkdownStyleMap>(() => {
    const typography = getNoteTextStyle(fontSize);
    const colors = getNoteColors(isDark);
    const heading = (scale: number) => ({
      fontSize: fontSize * scale,
      lineHeight: fontSize * scale * 1.4,
      fontWeight: "700" as const,
      marginTop: 8,
      marginBottom: 4,
    });
    const code = {
      ...getNoteTextStyle(fontSize * 0.85),
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: colors.text,
      backgroundColor: colors.inset,
      borderColor: colors.codeBorder,
      borderRadius: 6,
    };
    return {
      body: { ...typography, color: colors.text },
      paragraph: { marginTop: 0, marginBottom: 8 },
      heading1: heading(1.5),
      heading2: heading(1.3),
      heading3: heading(1.15),
      heading4: heading(1.05),
      heading5: heading(1),
      heading6: heading(1),
      bullet_list_icon: typography,
      ordered_list_icon: typography,
      blockquote: {
        backgroundColor: colors.inset,
        borderColor: colors.quoteBorder,
        borderLeftWidth: 3,
        marginLeft: 0,
        paddingHorizontal: 10,
        paddingTop: 6,
      },
      code_inline: { ...code, padding: 2 },
      code_block: { ...code, padding: 10, marginVertical: 6 },
      link: { color: colors.link, textDecorationLine: "underline" },
      hr: { backgroundColor: colors.border, marginVertical: 10 },
      table: { borderColor: colors.border },
      tr: { borderColor: colors.border },
    };
  }, [fontSize, isDark]);

  return (
    <View style={{ width: "100%" }}>
      <Markdown
        markdownit={parser}
        style={styles}
        rules={rules}
        textcomponent={SelectableText}
        colorScheme={isDark ? "dark" : "light"}
        onLinkPress={openLink}
      >
        {text}
      </Markdown>
    </View>
  );
});
