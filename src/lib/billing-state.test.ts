import assert from "node:assert/strict";
import { test } from "node:test";
import { isPaidClient, servicePeriod } from "./billing-state";

test("abandoned checkout with a Stripe Customer ID is unpaid", () => {
  assert.equal(isPaidClient({ status: "lead", stripeCustomerId: "cus_fixture_unpaid" }), false);
});

test("paye without a Stripe Customer ID is paid", () => {
  assert.equal(isPaidClient({ status: "paye", stripeCustomerId: null }), true);
});

test("essai and actif are entitled; lead is not", () => {
  assert.equal(isPaidClient({ status: "essai" }), true);
  assert.equal(isPaidClient({ status: "actif" }), true);
  assert.equal(isPaidClient({ status: "lead" }), false);
  assert.equal(isPaidClient(null), false);
});

test("annual service period is a year", () => {
  const from = new Date("2026-09-05T00:00:00Z");
  const p = servicePeriod({ plan: "year", from });
  assert.equal(p.interval, "year");
  assert.equal(p.end.getUTCFullYear(), 2027);
});
