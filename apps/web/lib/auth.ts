// Single-admin auth: the dashboard is opened by one env secret. Login
// mints an HMAC-signed, expiring token; middleware verifies it on every
// request. Web Crypto only, so the same code runs in the edge runtime
// and in server actions.

export const SESSION_COOKIE = "hc_admin";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  return `${expires}.${await hmacHex(secret, `hindcast-admin:${expires}`)}`;
}

export async function verifySessionToken(
  secret: string,
  token: string,
): Promise<boolean> {
  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!signature || !Number.isFinite(expires) || expires < Date.now()) {
    return false;
  }
  const expected = await hmacHex(secret, `hindcast-admin:${expires}`);
  return constantTimeEqual(signature, expected);
}

/** Compares the submitted secret against the configured one. */
export async function verifyAdminSecret(
  secret: string,
  submitted: string,
): Promise<boolean> {
  // Compare digests, not the strings: it keeps the comparison constant
  // time without leaking length either.
  const [a, b] = await Promise.all([
    hmacHex(secret, "login"),
    hmacHex(submitted, "login"),
  ]);
  return constantTimeEqual(a, b);
}
