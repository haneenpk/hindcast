export interface CartLine {
  slug: string;
  qty: number;
}

const STORAGE_KEY = "fernwood:cart";
const listeners = new Set<() => void>();

let lines: CartLine[] = load();

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

function commit(next: CartLine[]): void {
  lines = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* storage full or blocked — cart lives in memory for the session */
  }
  for (const listener of listeners) listener();
}

export function getCart(): CartLine[] {
  return lines;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addToCart(slug: string, qty = 1): void {
  const existing = lines.find((line) => line.slug === slug);
  commit(
    existing
      ? lines.map((line) =>
          line.slug === slug ? { ...line, qty: line.qty + qty } : line,
        )
      : [...lines, { slug, qty }],
  );
}

export function setQty(slug: string, qty: number): void {
  commit(
    qty <= 0
      ? lines.filter((line) => line.slug !== slug)
      : lines.map((line) => (line.slug === slug ? { ...line, qty } : line)),
  );
}

export function removeFromCart(slug: string): void {
  commit(lines.filter((line) => line.slug !== slug));
}

export function clearCart(): void {
  commit([]);
}
