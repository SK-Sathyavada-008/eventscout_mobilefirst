"use client";

import React from "react";
import { parseDescriptionTokens, DescriptionToken } from "@/utils/descriptionUtils";

export { parseDescriptionTokens };
export type { DescriptionToken };

interface EventDescriptionProps {
  description?: string | null;
  className?: string;
  fallbackText?: string;
}

export default function EventDescription({
  description,
  className = "whitespace-pre-line text-slate-300 leading-relaxed",
  fallbackText = "A flagship technical event bringing together passionate developers, students, and tech leaders to innovate and build real-world solutions.",
}: EventDescriptionProps) {
  if (!description) {
    return <p className={className}>{fallbackText}</p>;
  }

  const tokens = parseDescriptionTokens(description);

  return (
    <p className={className}>
      {tokens.map((token, index) => {
        if (token.type === "link" && token.url) {
          // Validate protocol for safety: only allow http and https
          const isSafe = token.url.startsWith("http://") || token.url.startsWith("https://");
          if (!isSafe) {
            return <React.Fragment key={index}>{token.text || token.url}</React.Fragment>;
          }

          return (
            <a
              key={index}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                // Prevent bubbling to parent card or container click/navigation
                e.stopPropagation();
              }}
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors break-words font-medium"
            >
              {token.text || token.url}
            </a>
          );
        }
        return <React.Fragment key={index}>{token.content}</React.Fragment>;
      })}
    </p>
  );
}
