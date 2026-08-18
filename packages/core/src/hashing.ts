import { canonicalJson } from "./internal.js";

export { canonicalJson };

/**
 * A stable content identifier for any JSON-safe value.
 *
 * Object key order never changes the result, so two hosts that serialize the
 * same state differently still produce the same identifier. Web Crypto is used
 * rather than `node:crypto` so the kernel stays host-neutral.
 */
export async function hashJson(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
