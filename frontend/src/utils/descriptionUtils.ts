export interface DescriptionToken {
  type: "text" | "link";
  content?: string;
  url?: string;
  text?: string;
}

/**
 * Parses description text into tokens, safely extracting markdown links [text](url)
 * and bare URLs (http:// or https://) while keeping surrounding text and punctuation intact.
 */
export function parseDescriptionTokens(text?: string | null): DescriptionToken[] {
  if (!text) return [];

  // 1. Clean markdown formatting markers while strictly preserving link syntax [text](url)
  const cleaned = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "");

  // 2. Tokenize markdown links [text](url) and raw URLs (http:// or https://)
  const combinedRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\))|(https?:\/\/[^\s<>'"`]+)/gi;

  const tokens: DescriptionToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: cleaned.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Markdown link: match[2] is anchor text, match[3] is url
      const linkText = match[2];
      const url = match[3];
      tokens.push({ type: "link", url, text: linkText });
    } else if (match[4]) {
      // Bare URL
      let url = match[4];
      let trailingPunct = "";
      while (/[.,!?:;\"'\]\)]$/.test(url)) {
        if (url.endsWith(")")) {
          const openCount = (url.match(/\(/g) || []).length;
          const closeCount = (url.match(/\)/g) || []).length;
          if (closeCount > openCount) {
            trailingPunct = ")" + trailingPunct;
            url = url.slice(0, -1);
            continue;
          }
        }
        if (/[.,!?:;\"'\]]/.test(url[url.length - 1])) {
          trailingPunct = url[url.length - 1] + trailingPunct;
          url = url.slice(0, -1);
          continue;
        }
        break;
      }
      tokens.push({ type: "link", url, text: url });
      if (trailingPunct) {
        tokens.push({ type: "text", content: trailingPunct });
      }
    }
    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    tokens.push({ type: "text", content: cleaned.slice(lastIndex) });
  }

  return tokens;
}
