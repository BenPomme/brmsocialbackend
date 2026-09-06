import { createHash, randomBytes, timingSafeEqual } from "crypto";

const TTL_MS = 24 * 60 * 60 * 1000;

export function hashCapability(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueCapability(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashCapability(token), expiresAt: new Date(now.getTime() + TTL_MS) };
}

export function capabilityMatches(token: string, hash: string) {
  const got = Buffer.from(hashCapability(token), "hex");
  const want = Buffer.from(hash, "hex");
  if (got.length !== want.length || got.length === 0) return false;
  return timingSafeEqual(got, want);
}
