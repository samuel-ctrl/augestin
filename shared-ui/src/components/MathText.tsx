import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with inline LaTeX math expressions.
 * Inline math: $...$
 * Block math: $$...$$
 * Plain text passes through unchanged.
 */
export function MathText({ text, className }: MathTextProps) {
  const rendered = useMemo(() => {
    if (!text) return "";

    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      // Check for block math $$...$$
      const blockMatch = remaining.match(/\$\$([\s\S]+?)\$\$/);
      // Check for inline math $...$
      const inlineMatch = remaining.match(/\$([^\$]+?)\$/);

      const match = blockMatch && (!inlineMatch || (blockMatch.index ?? Infinity) <= (inlineMatch.index ?? Infinity))
        ? blockMatch
        : inlineMatch;

      if (!match || match.index === undefined) {
        parts.push(escapeHtml(remaining));
        break;
      }

      // Add text before the match
      if (match.index > 0) {
        parts.push(escapeHtml(remaining.slice(0, match.index)));
      }

      // Render the math
      const isBlock = match[0].startsWith("$$");
      try {
        const html = katex.renderToString(match[1], {
          displayMode: isBlock,
          throwOnError: false,
        });
        parts.push(html);
      } catch {
        // If KaTeX fails, show the raw text
        parts.push(escapeHtml(match[0]));
      }

      remaining = remaining.slice(match.index + match[0].length);
    }

    return parts.join("");
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
