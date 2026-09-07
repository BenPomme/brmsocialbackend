import { gbpConfigured } from "./gbp-auth";
import { pollGbpInvitations } from "./manager-invite";

let started = false;
let ticking = false;

export function startGbpInviteLoop() {
  if (started) return;
  started = true;
  if (!gbpConfigured()) {
    console.log("gbp invite loop: skipped (GOOGLE_GBP_REFRESH_TOKEN missing)");
    return;
  }
  const first = Number(process.env.GBP_INVITE_FIRST_MS ?? 45_000);
  const every = Number(process.env.GBP_INVITE_EVERY_MS ?? 120_000);
  setTimeout(() => {
    void tickGbpInvites();
    setInterval(() => void tickGbpInvites(), every);
  }, first);
  console.log(`gbp invite loop: first in ${first}ms, then every ${every}ms`);
}

export async function tickGbpInvites() {
  if (ticking) return { skipped: true as const, reason: "in_flight" };
  ticking = true;
  try {
    const result = await pollGbpInvitations();
    if (!result.skipped) {
      console.log("gbp invites", result.count, JSON.stringify(result.results).slice(0, 400));
    }
    return result;
  } catch (e) {
    console.warn("gbp invite loop", e);
    return { skipped: false as const, error: e instanceof Error ? e.message : String(e) };
  } finally {
    ticking = false;
  }
}
