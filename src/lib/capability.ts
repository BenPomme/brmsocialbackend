import { randomBase64Url, sha256Hex, timingSafeEqualStr } from "./sha";

const TTL_MS = 24 * 60 * 60 * 1000;

export async function hashCapability(token: string) {
  return sha256Hex(token);
}

export async function issueCapability(now = new Date()) {
  const token = randomBase64Url(32);
  return { token, hash: await hashCapability(token), expiresAt: new Date(now.getTime() + TTL_MS) };
}

export async function capabilityMatches(token: string, hash: string) {
  const got = await hashCapability(token);
  return timingSafeEqualStr(got, hash);
}
