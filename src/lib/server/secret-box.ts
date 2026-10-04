import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { getSetting } from "./app-settings";

/**
 * Authenticated encryption for third-party desk API keys at rest (server-only).
 *
 * These are the user's own paid credentials for JustTCG, PriceCharting and
 * pokemontcg.io. Better Auth already encrypts its OAuth tokens
 * (`account.encryptOAuthTokens`), but `desk_keys` stored three bare `text`
 * columns, so a database dump handed over every subscriber's paid API keys in
 * the clear.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>`, all base64url. Anything that does not
 * carry the `v1.` prefix is treated as a legacy plaintext row and returned
 * as-is, so no data migration is needed — rows re-encrypt the next time the
 * owner saves.
 */
const PREFIX = "v1.";

const globalRef = globalThis as typeof globalThis & { __deskKeySecret__?: string };

function rootSecret(): string {
  const configured = getSetting("BETTER_AUTH_SECRET");
  if (configured) return configured;
  // Preview / local with no configured secret: a process-stable random key.
  // PGLite is in-memory and dies with the process too, so the two stay in step.
  globalRef.__deskKeySecret__ ??= randomBytes(32).toString("hex");
  return globalRef.__deskKeySecret__;
}

/** Separate key material from the session-signing secret. */
function aesKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", rootSecret(), "dealdex.desk-keys", "aes-256-gcm", 32));
}

const b64 = (buf: Buffer) => buf.toString("base64url");

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(ct)}`;
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  // Legacy plaintext written before this landed.
  if (!stored.startsWith(PREFIX)) return stored;
  const [, ivB64, tagB64, ctB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !ctB64) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key (rotated secret) or tampered row. Returning "" degrades to
    // "no key saved", which the UI already handles, rather than throwing.
    return "";
  }
}
