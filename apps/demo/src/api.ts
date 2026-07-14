// Nothing under /api exists anywhere. That's deliberate: Fernwood is the
// demo stage for Hindcast, and a believable shop needs believable
// failures. These calls produce the failed requests, console errors and
// unhandled rejections that session replay is built to explain.

export async function checkStock(slug: string): Promise<number> {
  const response = await fetch("/api/stock-check", {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
  if (!response.ok) {
    console.error(`stock check failed for ${slug}: HTTP ${response.status}`);
    throw new Error(`stock service returned ${response.status}`);
  }
  const body = (await response.json()) as { available: number };
  return body.available;
}

export function subscribeToNewsletter(email: string): Promise<void> {
  // planted: no caller catches this promise, so the failure lands on
  // window's unhandledrejection.
  return fetch("/api/newsletter", {
    method: "POST",
    body: JSON.stringify({ email }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`newsletter signup failed: HTTP ${response.status}`);
    }
  });
}
