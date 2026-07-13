const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}
