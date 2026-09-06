import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyInbound } from "../classify-inbound";
import { isPaidClient } from "../billing-state";
import { claimsNeedEvidence, stripUngroundedClaims } from "./claims";
import { evalCases } from "./eval";
import { guessLocale } from "./lang";
import { catalogQuoteResult, validatedQuoteCity } from "./tools";
import { parseStructuredTurn } from "./turn";
import { decisionFromScript } from "./decide";

test("eval set has 240 labelled cases, 40 per launch language", () => {
  const all = evalCases();
  assert.equal(all.length, 240);
  for (const lang of ["es", "ca", "en", "fr"]) {
    assert.equal(all.filter((c) => c.lang === lang).length, 40);
  }
});

test("price and annual quotes match the catalogue; Sant Cugat is not granted from a model-only city", () => {
  const q = catalogQuoteResult(null);
  assert.equal(q.monthTtc, 9900);
  assert.equal(q.yearTtc, 79900);
  assert.equal(q.offer, null);
  const sc = catalogQuoteResult("Sant Cugat del Vallès");
  assert.ok(sc.offer);
  assert.equal(
    validatedQuoteCity({ claimed: "Sant Cugat del Vallès", knownCity: "Rubí", inbound: "hola cuanto cuesta" }),
    "Rubí",
  );
});

test("unpaid Stripe customer id is not payment; STOP is stop", () => {
  assert.equal(isPaidClient({ status: "lead", stripeCustomerId: "cus_x" }), false);
  assert.equal(classifyInbound("STOP don't write again"), "stop");
});

test("in_business without Google stays not active", () => {
  const d = decisionFromScript("in_business", {
    event: { type: "inbound_text", text: "done" },
    outboundBodies: [],
    preferredLang: "en",
    phase: "onboarding",
    onboardingStep: "wait_google",
    clientStatus: "paye",
    managerInviteStatus: "pending",
    city: null,
    lastInboundAt: new Date(),
    payUrl: "https://pay.babyrock.ai/pay",
  });
  assert.notEqual(d.phase, "active");
});

test("ungrounded payment and publish claims are stripped", () => {
  const paid = stripUngroundedClaims("we have received your payment", { paid: false, published: false, googleConnected: false });
  assert.equal(claimsNeedEvidence("we have received your payment").payment, true);
  assert.match(paid, /don’t see a confirmed payment|pay link/i);
  const pub = stripUngroundedClaims("we've published on google", { paid: false, published: false, googleConnected: false });
  assert.match(pub, /nothing has been published/i);
});

test("German Arabic Japanese eval cases are not Spanish", () => {
  for (const id of ["de-price", "ar-price", "ja-price"]) {
    const c = evalCases().find((x) => x.id === id)!;
    assert.equal(guessLocale(c.inbound), c.expect.locale);
    assert.notEqual(guessLocale(c.inbound), "es");
  }
});

test("structured turn parses tool and locale", () => {
  const t = parseStructuredTurn(
    '{"route":"hello","reply":"99 € / month","locale":"en","intent":"price","tool":"get_catalog_quote","args":{}}',
  );
  assert.equal(t?.tool, "get_catalog_quote");
  assert.equal(t?.locale, "en");
});
