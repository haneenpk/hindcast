"use client";

import { useEffect, useRef, useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className={`rounded-md border border-edge bg-raised px-2 py-1 text-xs transition-colors ${
        copied ? "text-green" : "text-muted hover:text-fg"
      }`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
