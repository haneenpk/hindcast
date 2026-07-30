// The Hindcast mark: two rounded chevrons — code brackets — flanking a
// centre dot, the record/replay point. Single-colour via currentColor, so
// callers set the tone (amber on the brand surfaces, mono for tiles).
export function HindcastMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12 8 24l11 12" />
      <path d="M29 12l11 12-11 12" />
      <circle cx="24" cy="24" r="3.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
