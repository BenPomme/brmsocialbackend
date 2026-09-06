/** Client.status values that mean the shop is entitled to Social. Not a Stripe Customer ID. */
export const BILLING_ACTIVE = new Set(["paye", "essai", "actif"]);

export function isPaidClient(client: { status: string; stripeCustomerId?: string | null } | null) {
  if (!client) return false;
  return BILLING_ACTIVE.has(client.status);
}

export function servicePeriod(opts: { plan: string; from: Date; trialEndsAt?: Date | null }) {
  const start = opts.from;
  if (opts.plan === "year") {
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return { start, end, interval: "year" as const };
  }
  if (opts.plan === "trial_santcugat" || opts.trialEndsAt) {
    return { start, end: opts.trialEndsAt ?? start, interval: "trial" as const };
  }
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end, interval: "month" as const };
}
