"use client";

import { useEffect, useState } from "react";
import { applyPreference, readPreference, type ThemePreference } from "@/lib/theme";

const ICON = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System",
    icon: (
      <svg {...ICON}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg {...ICON}>
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
      </svg>
    ),
  },
];

export function ThemeToggle({ bare = false }: { bare?: boolean }) {
  // null until mounted: the server can't know the stored choice, so no
  // option claims to be active on the first render.
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => setPreference(readPreference()), []);

  const control = (
      <div
        role="radiogroup"
        aria-label="Theme"
        className="border-edge flex items-center gap-0.5 rounded-md border p-0.5"
      >
        {OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={option.label}
              onClick={() => {
                applyPreference(option.value);
                setPreference(option.value);
              }}
              className={
                active
                  ? "bg-raised text-fg flex h-6 w-6 items-center justify-center rounded transition-colors"
                  : "text-faint hover:text-fg flex h-6 w-6 items-center justify-center rounded transition-colors"
              }
            >
              {option.icon}
            </button>
          );
        })}
      </div>
  );

  // bare: just the control, for headers that have no room for a label
  if (bare) return control;

  return (
    <div className="flex items-center justify-between px-2.5 py-1.5">
      <span className="text-muted text-[13px]">Theme</span>
      {control}
    </div>
  );
}
