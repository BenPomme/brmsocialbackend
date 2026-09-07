import assert from "node:assert/strict";
import { test } from "node:test";
import { decideRosalia, decisionFromScript, shouldSendNow, wantsPayLink } from "./decide";
import { coerceRoute, parseRoute, parseTurn } from "./route";
import type { DecideInput, RosaliaDecision, RosaliaEvent, ThreadPhase, OnboardingStep, ConvoLang } from "./types";

const PAY = "https://app.babyrock.ai/pay";

function seed(over: Partial<DecideInput> = {}): DecideInput {
  return {
    event: { type: "inbound_text", text: "hola" },
    outboundBodies: [],
    firstName: null,
    preferredLang: null,
    phase: "outreach",
    onboardingStep: null,
    clientStatus: "lead",
    managerInviteStatus: "pending",
    city: null,
    lastInboundAt: new Date(),
    payUrl: PAY,
    pendingLowStar: false,
    invoiceUrl: null,
    ...over,
  };
}

function apply(ctx: DecideInput, decision: RosaliaDecision, next: RosaliaEvent): DecideInput {
  return {
    ...ctx,
    event: next,
    outboundBodies: [...ctx.outboundBodies, decision.body],
    preferredLang: decision.lang,
    phase: decision.phase,
    onboardingStep: decision.onboardingStep,
    city: decision.city ?? ctx.city,
    lastInboundAt: next.type === "inbound_text" || next.type === "inbound_media" ? new Date() : ctx.lastInboundAt,
  };
}

function run(start: Partial<DecideInput>, events: RosaliaEvent[]) {
  let ctx = seed(start);
  ctx = { ...ctx, event: events[0] };
  const decisions: RosaliaDecision[] = [];
  for (let i = 0; i < events.length; i++) {
    ctx = { ...ctx, event: events[i] };
    const d = decideRosalia(ctx);
    decisions.push(d);
    if (i < events.length - 1) ctx = apply(ctx, d, events[i + 1]);
    else {
      ctx = { ...ctx, phase: d.phase, onboardingStep: d.onboardingStep, preferredLang: d.lang, city: d.city ?? ctx.city };
    }
  }
  return { decisions, last: decisions.at(-1)!, ctx };
}

function speak(d: RosaliaDecision) {
  return d.body;
}

test("never quotes 89 €", () => {
  const { last } = run({ city: "Barcelona" }, [{ type: "inbound_text", text: "cuánto cuesta" }]);
  assert.equal(last.body.includes("89"), false);
  assert.match(last.body, /99\s*€/);
});

test("nested PAY block interpolates catalogue placeholders", () => {
  const { last } = run({ city: "Sant Cugat del Vallès" }, [
    { type: "inbound_text", text: "no sé qué es un gestor" },
  ]);
  assert.equal(last.body.includes("{{"), false);
  assert.match(last.body, /99\s*€/);
  assert.match(last.body, /0\s*€/);
});

test("1 Núria florist CA: city offer, gestor, screenshot, premature done", () => {
  const { decisions, last, ctx } = run({}, [
    { type: "inbound_text", text: "Hola, tinc una floristeria a Sant Cugat" },
    { type: "inbound_text", text: "no sé què és un gestor" },
    { type: "inbound_text", text: "ok" },
  ]);
  assert.equal(decisions[0].lang, "ca");
  assert.match(speak(decisions[0]), /0\s*€/);
  assert.equal(decisions[1].lang, "ca");
  assert.match(speak(decisions[1]), /gestor/i);
  assert.match(speak(decisions[2]), /\/pay/);
  assert.equal(decisions[2].lang, "ca");

  const paid = decideRosalia({
    ...seed({
      phase: "awaiting_pay",
      preferredLang: "ca",
      city: "Sant Cugat del Vallès",
      clientStatus: "paye",
      outboundBodies: decisions.map((d) => d.body),
      lastInboundAt: new Date(),
    }),
    event: { type: "payment_confirmed", via: "stripe" },
  });
  assert.equal(paid.phase, "onboarding");
  assert.equal(paid.onboardingStep, "maps");
  assert.equal(paid.lang, "ca");
  assert.equal(shouldSendNow(paid, new Date()), true);

  const photo = decideRosalia({
    ...seed({
      phase: "onboarding",
      onboardingStep: "maps",
      preferredLang: "ca",
      city: "Sant Cugat del Vallès",
      clientStatus: "paye",
      outboundBodies: [...decisions.map((d) => d.body), paid.body],
    }),
    event: { type: "inbound_media", media: "image" },
  });
  assert.match(photo.body, /fotos|text/i);
  assert.equal(photo.body.includes("(image)"), false);
  assert.match(photo.body, /Maps|fitxa|llapis/i);

  const premature = decideRosalia({
    ...seed({
      phase: "onboarding",
      onboardingStep: "wait_google",
      preferredLang: "ca",
      city: "Sant Cugat del Vallès",
      clientStatus: "paye",
      managerInviteStatus: "pending",
    }),
    event: { type: "inbound_text", text: "ja està" },
  });
  assert.equal(premature.faqId, "onboard_premature");
  assert.equal(premature.phase, "onboarding");
  assert.equal(ctx.phase, "awaiting_pay");
  assert.equal(last.faqId, "pay");
});

test("2 mixed EN / broken Spanish locks English", () => {
  const { decisions } = run({}, [
    { type: "inbound_text", text: "Hi I have a cafe how much" },
    { type: "inbound_text", text: "es 99 euros?" },
    { type: "inbound_text", text: "I no speak spanish well" },
  ]);
  assert.equal(decisions[0].lang, "en");
  assert.match(speak(decisions[0]), /99\s*€/);
  assert.equal(speak(decisions[0]).includes("89"), false);
  assert.equal(decisions[1].lang, "en");
  assert.equal(decisions[2].lang, "en");
  for (const d of decisions) {
    assert.equal(/primer mes és 0|primer mes es 0/.test(d.body), false);
  }
});

test("3 Marc Sant Cugat: ok does not flip language, pay link same turn, 0 €", () => {
  const { decisions } = run({ city: "Sant Cugat del Vallès", preferredLang: null }, [
    { type: "inbound_text", text: "hola" },
    { type: "inbound_text", text: "ok" },
  ]);
  assert.equal(decisions[0].lang, "es");
  assert.match(speak(decisions[0]), /0\s*€/);
  assert.equal(decisions[1].lang, "es");
  assert.match(speak(decisions[1]), /\/pay/);
  assert.equal(decisions[1].phase, "awaiting_pay");
});

test("4 cold wa.me unknown city is 99 € not free month", () => {
  const { last } = run({ city: null }, [{ type: "inbound_text", text: "cuánto cuesta" }]);
  assert.match(last.body, /99\s*€/);
  assert.equal(/primer mes es 0 € y ponemos/.test(last.body), false);
  assert.match(last.body, /Sant Cugat/);
});

test("5 Instagram / Direct is coming soon, not a SKU", () => {
  const { last } = run({}, [
    { type: "inbound_text", text: "do you do instagram and whatsapp for my customers" },
  ]);
  assert.equal(last.faqId, "off_catalog");
  assert.match(last.body, /coming later|vindrà|viene más adelante|viendra plus tard/i);
  assert.match(last.body, /99\s*€/);
});

test("6 this is a bot — a person publishes", () => {
  const { last } = run({ preferredLang: "es" }, [{ type: "inbound_text", text: "Esto es un bot?" }]);
  assert.equal(last.faqId, "who_writes");
  assert.match(last.body, /persona/i);
});

test("7 paid on /pay then ya pagué starts gestor, no 99 re-pitch", () => {
  const { last } = run(
    {
      phase: "awaiting_pay",
      clientStatus: "paye",
      preferredLang: "es",
      outboundBodies: ["El servicio cuesta 99 €/mes. PAY"],
    },
    [{ type: "inbound_text", text: "ya pagué, and now?" }],
  );
  assert.equal(last.phase, "onboarding");
  assert.equal(last.onboardingStep, "maps");
  assert.equal(last.faqId, "onboard_maps");
  assert.equal(/99\s*€/.test(last.body), false);
});

test("8 ya pagué without Stripe — wait for accounting", () => {
  const { last } = run({ clientStatus: "lead", phase: "awaiting_pay" }, [
    { type: "inbound_text", text: "ya pagué" },
  ]);
  assert.equal(last.faqId, "paid_unconfirmed");
  assert.equal(last.phase, "awaiting_pay");
  assert.match(last.body, /contabilidad|accounting/i);
  assert.equal(last.onboardingStep, null);
});

test("9 ya está but Google invite not accepted", () => {
  const { last } = run(
    {
      phase: "onboarding",
      onboardingStep: "wait_google",
      clientStatus: "paye",
      managerInviteStatus: "pending",
      preferredLang: "es",
    },
    [{ type: "inbound_text", text: "ya está" }],
  );
  assert.equal(last.faqId, "onboard_premature");
  assert.equal(last.phase, "onboarding");
});

test("10 active 2★ then OK", () => {
  const ping = decideRosalia({
    ...seed({ phase: "active", onboardingStep: "done", clientStatus: "actif", preferredLang: "es" }),
    event: {
      type: "low_star",
      avisId: "a1",
      stars: 2,
      author: "Marta",
      lang: "es",
      body: "Tardaron mucho.",
      draft: "Hola Marta. Gracias por escribirnos.",
    },
  });
  assert.equal(ping.faqId, "low_star");
  assert.match(ping.body, /2★/);
  const ok = decideRosalia({
    ...seed({
      phase: "active",
      onboardingStep: "done",
      clientStatus: "actif",
      preferredLang: "es",
      pendingLowStar: true,
      outboundBodies: [ping.body],
    }),
    event: { type: "inbound_text", text: "OK" },
  });
  assert.equal(ok.applyClientReply, "ok");
  assert.equal(ok.faqId, "low_star_ok");
});

test("11 CERRADO is not a 1–3★ OK", () => {
  const { last } = run(
    { phase: "active", onboardingStep: "done", clientStatus: "actif", preferredLang: "es", pendingLowStar: true },
    [{ type: "inbound_text", text: "CERRADO" }],
  );
  assert.equal(last.faqId, "cerrado");
  assert.equal(last.applyClientReply, "cerrado");
});

test("12 BAJA, factura, edit published reply", () => {
  const baja = decideRosalia({
    ...seed({ phase: "active", onboardingStep: "done", clientStatus: "actif", preferredLang: "es" }),
    event: { type: "inbound_text", text: "BAJA" },
  });
  assert.equal(baja.phase, "stopped");
  assert.equal(baja.applyClientReply, "baja");

  const factura = decideRosalia({
    ...seed({
      phase: "active",
      onboardingStep: "done",
      clientStatus: "actif",
      preferredLang: "es",
      invoiceUrl: "https://pay.stripe.com/invoice/test",
    }),
    event: { type: "inbound_text", text: "me falta la factura" },
  });
  assert.equal(factura.faqId, "invoice_link");
  assert.match(factura.body, /pay\.stripe\.com/);

  const edit = decideRosalia({
    ...seed({ phase: "active", onboardingStep: "done", clientStatus: "actif", preferredLang: "es" }),
    event: { type: "inbound_text", text: "cambia la respuesta que ya está en google" },
  });
  assert.equal(edit.faqId, "edit_published");
});

test("Yes but how I don’t know how stays English and explains the gestor", () => {
  const lastOut =
    "Hi BenP. Great! Next, add reviews@babyrock.ai as a manager in your Google Business Profile (no password needed). We'll then set up your 89€/month review replies. Any questions?";
  const { last } = run(
    {
      preferredLang: "en",
      firstName: "Ben",
      outboundBodies: [lastOut],
      phase: "awaiting_pay",
    },
    [{ type: "inbound_text", text: "Yes but how I don’t know how" }],
  );
  assert.equal(last.lang, "en");
  assert.equal(last.faqId, "onboard_maps");
  assert.equal(last.phase, "onboarding");
  assert.equal(/Perfecto|Pago 89|Para empezar/.test(last.body), false);
  assert.match(last.body, /Google Maps/i);
});

test("manager how-to does not repeat the same FAQ", () => {
  const lastOut =
    "We never ask for your password. In Google: add reviews@babyrock.ai as a manager (not owner). I’ll walk you through it. Payment is the other step: The payment link is in the message above.";
  const first = decideRosalia({
    ...seed({
      preferredLang: "en",
      phase: "awaiting_pay",
      outboundBodies: [lastOut],
    }),
    event: { type: "inbound_text", text: "how do I add you as manager?" },
  });
  assert.equal(first.faqId, "onboard_maps");
  const second = decideRosalia({
    ...seed({
      preferredLang: "en",
      phase: "onboarding",
      onboardingStep: "maps",
      outboundBodies: [lastOut, first.body],
    }),
    event: { type: "inbound_text", text: "yes i don't know how to add you as manager" },
  });
  assert.equal(second.faqId, "onboard_maps");
  assert.equal(/Payment is the other step/.test(second.body), false);
});

test("bare yes still sends the pay link", () => {
  const { last } = run({ preferredLang: "en" }, [{ type: "inbound_text", text: "Yes" }]);
  assert.equal(last.faqId, "pay");
  assert.match(last.body, /\/pay/);
});

test("language switch is explicit only", () => {
  const { decisions } = run({ preferredLang: "es" }, [
    { type: "inbound_text", text: "vale" },
    { type: "inbound_text", text: "can we talk in english" },
  ]);
  assert.equal(decisions[0].lang, "es");
  assert.equal(decisions[1].lang, "en");
});

test("us-initiated payment ping is held without a 24h window", () => {
  const d = decideRosalia({
    ...seed({ phase: "awaiting_pay", clientStatus: "paye", lastInboundAt: null, preferredLang: "es" }),
    event: { type: "payment_confirmed", via: "stripe" },
  });
  assert.equal(d.sendPolicy, "if_window");
  assert.equal(shouldSendNow(d, null), false);
  assert.equal(shouldSendNow(d, new Date()), true);
});

test("I paid is not treated as send me the pay link", () => {
  assert.equal(wantsPayLink("ya pagué"), false);
  assert.equal(wantsPayLink("manda el enlace"), true);
});

test("LLM route JSON picks a script id", () => {
  assert.deepEqual(parseRoute('{"route":"onboard_email"}'), { route: "onboard_email" });
  assert.equal(parseTurn("nope")?.route, "hello");
  assert.equal(parseTurn("nope")?.reply, "nope");
});

test("coerceRoute does not resend the current onboard step", () => {
  assert.equal(coerceRoute("onboard_email", "email", "Ah ok and?"), "onboard_role");
  assert.equal(coerceRoute("onboard_email", "email", "Tutu"), "onboard_role");
  assert.equal(coerceRoute("hello", "email", "test"), "hello");
  assert.equal(coerceRoute("onboard_email", "email", "what's the email to invite?"), "onboard_email");
});

test("decisionFromScript applies onboard_email and stays in English", () => {
  const d = decisionFromScript("onboard_email", seed({ preferredLang: "en", phase: "onboarding", onboardingStep: "people" }));
  assert.equal(d.faqId, "onboard_email");
  assert.equal(d.phase, "onboarding");
  assert.equal(d.onboardingStep, "email");
  assert.equal(d.lang, "en");
  assert.match(d.body, /reviews@babyrock\.ai/);
});

test("in_business without a Google connection does not go active", () => {
  const premature = decisionFromScript("in_business", seed({ managerInviteStatus: "pending" }));
  assert.notEqual(premature.phase, "active");
  assert.equal(premature.faqId, "onboard_premature");
  const live = decisionFromScript("in_business", seed({ managerInviteStatus: "accepted" }));
  assert.equal(live.phase, "active");
  assert.equal(live.faqId, "in_business");
});

test("low_star_ok from the LLM path applies owner approval", () => {
  assert.equal(decisionFromScript("low_star_ok", seed()).applyClientReply, "ok");
  assert.equal(decisionFromScript("baja_active", seed()).applyClientReply, "baja");
});

test("human route stays needs_human", () => {
  const d = decisionFromScript("human", seed());
  assert.equal(d.status, "needs_human");
  assert.equal(d.source, "off_script");
});

test("manager_connected is the in-business trigger", () => {
  const d = decideRosalia({
    ...seed({
      phase: "onboarding",
      onboardingStep: "wait_google",
      clientStatus: "paye",
      preferredLang: "es",
      lastInboundAt: new Date(),
    }),
    event: { type: "manager_connected" },
  });
  assert.equal(d.phase, "active");
  assert.equal(d.faqId, "in_business");
  assert.match(d.body, /reviews@babyrock\.ai/);
});

test("manager_connected without payment walks them to pay", () => {
  const d = decideRosalia({
    ...seed({
      phase: "outreach",
      clientStatus: "lead",
      preferredLang: "es",
      lastInboundAt: new Date(),
    }),
    event: { type: "manager_connected" },
  });
  assert.equal(d.faqId, "manager_accepted_unpaid");
  assert.equal(d.phase, "awaiting_pay");
  assert.match(d.body, /\/pay/);
});

test("payment after manager already accepted starts work, not gestor walkthrough", () => {
  const d = decideRosalia({
    ...seed({
      phase: "awaiting_pay",
      managerInviteStatus: "accepted",
      clientStatus: "paye",
      preferredLang: "en",
    }),
    event: { type: "payment_confirmed", via: "stripe" },
  });
  assert.equal(d.faqId, "in_business");
  assert.equal(d.phase, "active");
});

test("owner invite is declined in copy", () => {
  const d = decideRosalia({
    ...seed({ preferredLang: "en" }),
    event: { type: "manager_owner_declined" },
  });
  assert.equal(d.faqId, "manager_owner_wrong");
  assert.match(d.body, /Owner/i);
});
