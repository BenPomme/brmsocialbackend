import { isCerradoIntent } from "../fiche/recap";
import { isCommercialOk, quoteFor, resolveQuoteCity } from "../catalog";
import { classifyInbound } from "../classify-inbound";
import { onboardCopyId, txt } from "./copy";
import { detectConvoLang, explicitLangSwitch } from "./lang";
import type {
  ConvoLang,
  DecideInput,
  OnboardingStep,
  RosaliaDecision,
  ThreadPhase,
} from "./types";

const NEXT_STEP: Record<Exclude<OnboardingStep, "done">, OnboardingStep> = {
  maps: "people",
  people: "email",
  email: "role",
  role: "wait_google",
  wait_google: "wait_google",
};

function inboundText(event: DecideInput["event"]) {
  return event.type === "inbound_text" ? event.text : "";
}

export function isPaidClaim(text: string) {
  return /ya pagu[eé]|he pagado|acabo de pagar|pago hecho|i (already )?paid|paid already|just paid|ja he pagat|ja pagat|j['’]ai pay[eé]/i.test(
    text,
  );
}

export function wantsPayLink(text: string) {
  if (isPaidClaim(text)) return false;
  return (
    /\b(pago|pagar|bizum|stripe|tarjeta|sepa|enlace|link|env[ií]a(?:\s*lo|\s*me)?|m[aá]nda(?:\s*me|\s*lo)?|send(?: it)?|do it)\b/i.test(
      text,
    )
  );
}

export function alreadyPitched(outbound: string[], monthLabel: string) {
  const price = monthLabel.replace(" €", "\\s*€");
  const re = new RegExp(`${price}|reviews@babyrock\\.ai|Babyrock Social|BabyRock Social`, "i");
  return outbound.some((b) => re.test(b));
}

export function alreadySentPayLink(outbound: string[], payUrl: string) {
  return outbound.some((b) => (payUrl && b.includes(payUrl)) || /\/pay\b/.test(b));
}

function soundsAdvance(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return (
    /^(ok|vale|s[ií]|yes|ja|ya|hecho|fet|done|listo|d['’]accord)[\s!.]*$/i.test(t) ||
    /^(ya est[aá]|ja est[aà]|c['’]est fait|it['’]?s done)([\s!.].*)?$/i.test(t) ||
    /\b(lo veo|ja ho veig|i (can )?see|perfil|personas y acceso|persones i acc[eé]s|invit|enviad|afegit|added|pegado|enganxat|pasted)\b/i.test(
      t,
    )
  );
}

function mentionsInviteSent(text: string) {
  return /\b(reviews@babyrock\.ai|invitaci[oó]n enviada|he invitado|already (added|invited)|ja l['’]he afegit|enviada)\b/i.test(
    text,
  );
}

function wantsManagerHow(text: string, lastOut?: string | null) {
  if (
    /\b(how do i add|how (do i|can i|to) add|add you as manager|don['’]?t know how|no s[eé] c[oó]mo)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return (
    /\b(how|c[oó]mo|com es fa)\b/i.test(text) &&
    /reviews@babyrock\.ai|gestor|Google manager/i.test(lastOut ?? "")
  );
}

const FAQ: { id: string; re: RegExp }[] = [
  {
    id: "pay",
    re: /\b(pago|pagar|bizum|stripe|tarjeta|sepa|enlace|link|env[ií]a(?:\s*lo|\s*me)?|m[aá]nda(?:\s*me|\s*lo)?|do it|send(?: it)?)\b/i,
  },
  { id: "hello", re: /^\s*(hola|hello|hi|hey|buenas|bon dia|buenos d[ií]as|salut)(\s+\S+){0,2}[\s!.¿?]*$/i },
  {
    id: "interest",
    re: /\b(interesad[oa]|interested|know more|tell me more|di ?me m[aá]s|dime m[aá]s|saber m[eé]s|vull saber|quiero (probar|el servicio|contratar)|tengo un[ae]? (bar|restaurante|negocio|local|cafeter[ií]a|floristeria)|un bar en|i have a (bar|restaurant|caf[eé]|shop|florist))\b/i,
  },
  {
    id: "off_catalog",
    re: /\b(instagram|seo\b|facebook|tiktok|community|publicidad|anuncios|ads\b|thefork|reservas para (mis |mis)?clientes|whatsapp (de |para )?(mis |my )?clientes|direct\b)\b/i,
  },
  {
    id: "value",
    re: /\b(bueno para|vale la pena|worth|mi (bar|negocio|business|restaurante)|para mi negocio|funciona para)\b/i,
  },
  { id: "price", re: /\b(precio|preu|price|cuesta|coste|cost|tarif|euros?|€|how much)\b/i },
  {
    id: "manager",
    re: /\b(gestor|manager|invitaci[oó]n|acceso|contrase[nñ]a|password|google my business|perfil de empresa|c[oó]mo (te |os |le )?a[nñ]ad|how do i( add)?|add you|don['’]?t know how|no s[eé] (qu[eè] [eé]s|c[oó]mo)|no s[eé] c[oó]mo)\b/i,
  },
  { id: "how", re: /\b(c[oó]mo funciona|com funciona|how (does )?it work|qu[eé] hac[eé]is|que ofrec[eé]n)\b/i },
  {
    id: "lang",
    re: /\b(idioma|llengua|en qu[eé] idioma|speak english|in english|talk here in english|i don.t speak spanish|hablar espa[nñ]ol|en espa[nñ]ol|en castellano|en catal[aà]|en fran[cç]ais|in spanish|in catalan|in french)\b/i,
  },
  { id: "what", re: /\b(qu[eé] es babyrock|who are you|qui[eé]n sois|qui [eé]s)\b/i },
  { id: "hours", re: /\b(horario|horari|hours|cu[aá]ndo public)\b/i },
  { id: "trial", re: /\b(prueba|trial|gratis|gratuit|demo|mes gratis)\b/i },
  { id: "thanks", re: /^(gracias|gr[aà]cies|merci|thanks)[\s!.,]*$/i },
  {
    id: "who_writes",
    re: /\b(inteligencia|ia\b|ai\b|robot|bot|chatgpt|humano|persona|qui[eé]n (escribe|redacta|publica)|who writes|esto es un bot)\b/i,
  },
  {
    id: "cancel",
    re: /\b(cancelar|unsubscri\w*|darse de baja|baja del servicio|how can unsubscri|how (can|do) i cancel)\b/i,
  },
  { id: "after_pay", re: /\b(despu[eé]s de pagar|qu[eé] pasa (luego|despu[eé]s)|cu[aá]ndo empez|how long|tarda|onboarding)\b/i },
  { id: "past_reviews", re: /\b(past reviews|old reviews|reseñas antiguas|meses anteriores|already (on|have)|hist[oó]rico)\b/i },
];

function matchFaq(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  for (const row of FAQ) {
    if (row.re.test(t)) return row.id;
  }
  return null;
}

function fill(
  id: string,
  lang: ConvoLang,
  input: DecideInput,
  quote: ReturnType<typeof quoteFor>,
  extra?: { alreadySentPay?: boolean },
) {
  return txt(id, lang, {
    name: input.firstName,
    quote,
    payUrl: input.payUrl,
    alreadySentPay: extra?.alreadySentPay ?? alreadySentPayLink(input.outboundBodies, input.payUrl),
    invoiceUrl: input.invoiceUrl,
  });
}

function base(
  input: DecideInput,
  quote: ReturnType<typeof quoteFor>,
  lang: ConvoLang,
  partial: Omit<RosaliaDecision, "lang" | "quote" | "city" | "sendPolicy"> & { sendPolicy?: RosaliaDecision["sendPolicy"] },
): RosaliaDecision {
  return {
    ...partial,
    lang,
    quote,
    city: quote.offer ? resolveQuoteCity({ city: input.city, inbound: inboundText(input.event) }) : input.city,
    sendPolicy: partial.sendPolicy ?? "reply",
  };
}

const STEP_BY_SCRIPT: Record<string, OnboardingStep> = {
  onboard_maps: "maps",
  onboard_people: "people",
  onboard_email: "email",
  onboard_role: "role",
  onboard_wait: "wait_google",
  onboard_premature: "wait_google",
};

/** Apply a canned script id chosen by the LLM router. */
export function decisionFromScript(id: string, input: DecideInput): RosaliaDecision {
  const text = inboundText(input.event);
  const city = resolveQuoteCity({ city: input.city, inbound: text });
  const quote = quoteFor({ city, inbound: text });
  const lastOut = input.outboundBodies.at(-1) ?? null;
  const lang = detectConvoLang(text || lastOut || "", lastOut, input.preferredLang);
  let phase: ThreadPhase = input.phase;
  let step = input.onboardingStep;
  if (STEP_BY_SCRIPT[id]) {
    phase = "onboarding";
    step = STEP_BY_SCRIPT[id];
  } else if (id === "stop" || id === "baja_active") {
    phase = "stopped";
  } else if (id === "in_business") {
    if (input.managerInviteStatus === "accepted") {
      phase = "active";
      step = "done";
    } else {
      id = "onboard_premature";
      phase = "onboarding";
      step = "wait_google";
    }
  } else if (id === "pay" || id === "ok" || id === "interest" || id === "hello") {
    if (phase === "outreach") phase = "awaiting_pay";
  }
  const human = id === "fallback" || id === "human";
  const scriptId = human ? "fallback" : id;
  return base(input, quote, lang, {
    kind: human ? "text" : "ok",
    source: human ? "off_script" : "template",
    faqId: scriptId,
    body: fill(scriptId, lang, input, quote),
    status: id === "stop" || id === "baja_active" ? "stop" : human ? "needs_human" : "ok",
    phase,
    onboardingStep: step,
    applyClientReply:
      id === "baja_active" ? "baja" : id === "cerrado" ? "cerrado" : id === "low_star_ok" ? "ok" : id === "low_star_text" ? "text" : null,
  });
}

function onboardingStart(
  input: DecideInput,
  quote: ReturnType<typeof quoteFor>,
  lang: ConvoLang,
  via: "stripe" | "trial",
): RosaliaDecision {
  const head = fill(via === "trial" ? "trial_started" : "payment_confirmed", lang, input, quote);
  const step = fill("onboard_maps", lang, input, quote);
  return base(input, quote, lang, {
    kind: "ok",
    source: "template",
    faqId: "onboard_maps",
    body: `${head}\n\n${step}`,
    status: "ok",
    phase: "onboarding",
    onboardingStep: "maps",
    sendPolicy: "if_window",
    applyClientReply: null,
  });
}

function continueOnboarding(
  input: DecideInput,
  quote: ReturnType<typeof quoteFor>,
  lang: ConvoLang,
  text: string,
): RosaliaDecision {
  const accepted = input.managerInviteStatus === "accepted";
  let step: OnboardingStep = input.onboardingStep ?? "maps";
  if (accepted) {
    return base(input, quote, lang, {
      kind: "ok",
      source: "template",
      faqId: "in_business",
      body: fill("in_business", lang, input, quote),
      status: "ok",
      phase: "active",
      onboardingStep: "done",
      applyClientReply: null,
    });
  }
  if (mentionsInviteSent(text)) step = "wait_google";
  else if (step !== "wait_google" && step !== "done" && soundsAdvance(text)) {
    step = NEXT_STEP[step];
  } else if (step === "wait_google" && soundsAdvance(text)) {
    return base(input, quote, lang, {
      kind: "text",
      source: "template",
      faqId: "onboard_premature",
      body: fill("onboard_premature", lang, input, quote),
      status: "ok",
      phase: "onboarding",
      onboardingStep: "wait_google",
      applyClientReply: null,
    });
  }
  const advanced = step !== (input.onboardingStep ?? "maps");
  if (!advanced && !mentionsInviteSent(text) && !wantsManagerHow(text, input.outboundBodies.at(-1))) {
    return base(input, quote, lang, {
      kind: "text",
      source: "off_script",
      faqId: "onboard_llm",
      body: fill(onboardCopyId(step), lang, input, quote),
      status: "needs_human",
      phase: "onboarding",
      onboardingStep: step,
      applyClientReply: null,
    });
  }
  const id = onboardCopyId(step);
  return base(input, quote, lang, {
    kind: "text",
    source: "template",
    faqId: id,
    body: fill(id, lang, input, quote),
    status: "ok",
    phase: "onboarding",
    onboardingStep: step,
    applyClientReply: null,
  });
}

function mediaBody(input: DecideInput, quote: ReturnType<typeof quoteFor>, lang: ConvoLang) {
  const refuse = fill("media_unsupported", lang, input, quote);
  if (input.phase === "onboarding" && input.onboardingStep && input.onboardingStep !== "done") {
    return `${refuse}\n\n${fill(onboardCopyId(input.onboardingStep), lang, input, quote)}`;
  }
  return refuse;
}

function outreachFaq(
  input: DecideInput,
  quote: ReturnType<typeof quoteFor>,
  lang: ConvoLang,
  text: string,
  kind: ReturnType<typeof classifyInbound>,
): RosaliaDecision {
  const pitched = alreadyPitched(input.outboundBodies, quote.monthLabel);
  const sentPay = alreadySentPayLink(input.outboundBodies, input.payUrl);
  const phase: ThreadPhase = sentPay || pitched ? "awaiting_pay" : input.phase === "outreach" ? "outreach" : input.phase;

  if (wantsPayLink(text) || kind === "ok") {
    const body = pitched ? fill("pay", lang, input, quote) : fill("ok", lang, input, quote);
    return base(input, quote, lang, {
      kind: "ok",
      source: "template",
      faqId: "pay",
      body,
      status: "ok",
      phase: "awaiting_pay",
      onboardingStep: input.onboardingStep,
      applyClientReply: null,
    });
  }

  if (kind === "phone") {
    const thanks =
      lang === "ca"
        ? `Gràcies${input.firstName ? `, ${input.firstName}` : ""}, seguim per aquí.`
        : lang === "en"
          ? `Thanks${input.firstName ? `, ${input.firstName}` : ""}, we’ll stay on this chat.`
          : lang === "fr"
            ? `Merci${input.firstName ? `, ${input.firstName}` : ""}, on continue ici.`
            : `Gracias${input.firstName ? `, ${input.firstName}` : ""}, seguimos por aquí.`;
    return base(input, quote, lang, {
      kind: "phone",
      source: "template",
      faqId: "phone",
      body: `${thanks}\n\n${fill("ok", lang, input, quote)}`,
      status: "needs_human",
      phase: "awaiting_pay",
      onboardingStep: input.onboardingStep,
      applyClientReply: null,
    });
  }

  const trimmed = text.replace(/\s+/g, " ").trim();
  if (/^(hola|hello|hi|hey|buenas|bon dia|salut)\b/i.test(trimmed)) {
    const body = fill(pitched ? "hello_again" : "hello", lang, input, quote);
    return base(input, quote, lang, {
      kind,
      source: "template",
      faqId: "hello",
      body,
      status: "needs_human",
      phase,
      onboardingStep: input.onboardingStep,
      applyClientReply: null,
    });
  }

  const hit = matchFaq(text);
  if (hit) {
    let id = hit;
    if (hit === "hello" && pitched) id = "hello_again";
    if (hit === "lang" && explicitLangSwitch(text)) {
      /* copy already in the switched lang */
    }
    const suppressPay = input.phase === "onboarding" || input.phase === "active";
    let body = fill(id, lang, input, quote, { alreadySentPay: sentPay || suppressPay });
    if (suppressPay && (id === "price" || id === "ok" || id === "pay" || id === "interest")) {
      body = fill(input.phase === "onboarding" ? onboardCopyId(input.onboardingStep ?? "maps") : "nudge", lang, input, quote);
      id = input.phase === "onboarding" ? onboardCopyId(input.onboardingStep ?? "maps") : "nudge";
    }
    return base(input, quote, lang, {
      kind,
      source: "template",
      faqId: id,
      body,
      status: "needs_human",
      phase,
      onboardingStep: input.onboardingStep,
      applyClientReply: null,
    });
  }

  return base(input, quote, lang, {
    kind,
    source: "off_script",
    faqId: "fallback",
    body: fill("fallback", lang, input, quote),
    status: "needs_human",
    phase,
    onboardingStep: input.onboardingStep,
    applyClientReply: null,
  });
}

export function decideRosalia(input: DecideInput): RosaliaDecision {
  const event = input.event;
  const text = inboundText(event);
  const city = resolveQuoteCity({ city: input.city, inbound: text });
  const quote = quoteFor({ city, inbound: text });
  const lastOut = input.outboundBodies.at(-1) ?? null;
  const lang = detectConvoLang(text || lastOut || "", lastOut, input.preferredLang);
  const kind = text ? classifyInbound(text) : "text";
  const confirmed = isCommercialOk(input.clientStatus);
  const switched = explicitLangSwitch(text);

  const stop = (phase: ThreadPhase, id: string): RosaliaDecision =>
    base(input, quote, lang, {
      kind: "stop",
      source: "template",
      faqId: id,
      body: fill(id, lang, input, quote),
      status: "stop",
      phase,
      onboardingStep: input.onboardingStep,
      applyClientReply: id === "baja_active" ? "baja" : null,
    });

  if (kind === "stop" || (text && /^(baja|stop)\b/i.test(text.trim()))) {
    const active = input.phase === "active" || input.phase === "onboarding" || confirmed;
    return stop("stopped", active ? "baja_active" : "stop");
  }

  if (event.type === "inbound_media") {
    return base(input, quote, lang, {
      kind: "text",
      source: "template",
      faqId: "media_unsupported",
      body: mediaBody(input, quote, lang),
      status: "needs_human",
      phase: input.phase,
      onboardingStep: input.onboardingStep,
      applyClientReply: null,
    });
  }

  if (event.type === "payment_confirmed") {
    return onboardingStart(input, quote, lang, event.via);
  }

  if (event.type === "manager_connected") {
    return base(input, quote, lang, {
      kind: "ok",
      source: "template",
      faqId: "in_business",
      body: fill("in_business", lang, input, quote),
      status: "ok",
      phase: "active",
      onboardingStep: "done",
      sendPolicy: "if_window",
      applyClientReply: null,
    });
  }

  if (event.type === "low_star") {
    const author = event.author || (lang === "en" ? "a customer" : lang === "fr" ? "un client" : "un cliente");
    const body = [
      lang === "ca"
        ? `Ressenya ${event.stars}★ de ${author}`
        : lang === "en"
          ? `${event.stars}★ review from ${author}`
          : lang === "fr"
            ? `Avis ${event.stars}★ de ${author}`
            : `Avis ${event.stars}★ de ${author}`,
      `«${event.body}»`,
      "",
      lang === "en" ? "Draft:" : lang === "fr" ? "Brouillon :" : lang === "ca" ? "Esborrany:" : "Borrador:",
      event.draft,
      "",
      lang === "en"
        ? "Reply OK to approve, or send the text to publish."
        : lang === "fr"
          ? "Répondez OK pour valider, ou envoyez le texte à publier."
          : lang === "ca"
            ? "Responeu OK per validar, o envieu el text a publicar."
            : "Responda OK para validar, o envíe el texto a publicar.",
    ].join("\n");
    return base(input, quote, lang, {
      kind: "text",
      source: "template",
      faqId: "low_star",
      body,
      status: "ok",
      phase: "active",
      onboardingStep: "done",
      sendPolicy: "if_window",
      applyClientReply: null,
    });
  }

  if (event.type === "fiche_alert" || event.type === "monday_recap") {
    return base(input, quote, lang, {
      kind: "text",
      source: "template",
      faqId: event.type,
      body: event.body,
      status: "ok",
      phase: input.phase === "outreach" ? "active" : input.phase,
      onboardingStep: input.onboardingStep,
      sendPolicy: "if_window",
      applyClientReply: null,
    });
  }

  if (switched && matchFaq(text) === "lang") {
    return base(input, quote, lang, {
      kind: "text",
      source: "template",
      faqId: "lang",
      body: fill("lang", lang, input, quote),
      status: "needs_human",
      phase: input.phase,
      onboardingStep: input.onboardingStep,
      applyClientReply: null,
    });
  }

  if (isPaidClaim(text) && !confirmed) {
    return base(input, quote, lang, {
      kind: "text",
      source: "template",
      faqId: "paid_unconfirmed",
      body: fill("paid_unconfirmed", lang, input, quote),
      status: "ok",
      phase: input.phase === "outreach" ? "awaiting_pay" : input.phase,
      onboardingStep: input.onboardingStep,
      applyClientReply: null,
    });
  }

  if (confirmed && (input.phase === "onboarding" || input.phase === "awaiting_pay" || isPaidClaim(text))) {
    if (input.managerInviteStatus === "accepted") {
      return base(input, quote, lang, {
        kind: "ok",
        source: "template",
        faqId: "in_business",
        body: fill("in_business", lang, input, quote),
        status: "ok",
        phase: "active",
        onboardingStep: "done",
        applyClientReply: null,
      });
    }
    if (input.phase !== "active") {
      if (input.phase === "awaiting_pay" || input.phase === "outreach" || !input.onboardingStep) {
        const started = onboardingStart(input, quote, lang, "stripe");
        started.sendPolicy = "reply";
        return started;
      }
      return continueOnboarding(input, quote, lang, text);
    }
  }

  if (input.phase === "onboarding") {
    return continueOnboarding(input, quote, lang, text);
  }

  if (
    (input.phase === "outreach" || input.phase === "awaiting_pay") &&
    wantsManagerHow(text, lastOut)
  ) {
    return continueOnboarding(input, quote, lang, text);
  }

  if (input.phase === "active") {
    if (isCerradoIntent(text)) {
      return base(input, quote, lang, {
        kind: "text",
        source: "template",
        faqId: "cerrado",
        body: fill("cerrado", lang, input, quote),
        status: "ok",
        phase: "active",
        onboardingStep: "done",
        applyClientReply: "cerrado",
      });
    }
    if (/\b(factura|invoice|pdf)\b/i.test(text) && !wantsPayLink(text)) {
      const id = input.invoiceUrl ? "invoice_link" : "invoice";
      return base(input, quote, lang, {
        kind: "text",
        source: "template",
        faqId: id,
        body: fill(id, lang, input, quote),
        status: "ok",
        phase: "active",
        onboardingStep: "done",
        applyClientReply: null,
      });
    }
    if (/\b(cambia(r)? (la |esa )?respuesta|edit( that)? (reply|review)|ja (està|está) (en|a) google|already (on|online))\b/i.test(text)) {
      return base(input, quote, lang, {
        kind: "text",
        source: "template",
        faqId: "edit_published",
        body: fill("edit_published", lang, input, quote),
        status: "needs_human",
        phase: "active",
        onboardingStep: "done",
        applyClientReply: null,
      });
    }
    if (input.pendingLowStar) {
      const isOk = /^(ok|oui|yes|d['’]?accord|vale|de acuerdo|s[ií])\b/i.test(text.trim());
      if (isOk) {
        return base(input, quote, lang, {
          kind: "ok",
          source: "template",
          faqId: "low_star_ok",
          body: fill("low_star_ok", lang, input, quote),
          status: "ok",
          phase: "active",
          onboardingStep: "done",
          applyClientReply: "ok",
        });
      }
      return base(input, quote, lang, {
        kind: "text",
        source: "template",
        faqId: "low_star_text",
        body: fill("low_star_text", lang, input, quote),
        status: "ok",
        phase: "active",
        onboardingStep: "done",
        applyClientReply: "text",
      });
    }
    const hit = matchFaq(text);
    if (hit && hit !== "pay" && hit !== "ok" && hit !== "hello") {
      return base(input, quote, lang, {
        kind,
        source: "template",
        faqId: hit,
        body: fill(hit, lang, input, quote, { alreadySentPay: true }),
        status: "needs_human",
        phase: "active",
        onboardingStep: "done",
        applyClientReply: null,
      });
    }
    return base(input, quote, lang, {
      kind,
      source: "off_script",
      faqId: "fallback",
      body: fill("fallback", lang, input, quote),
      status: "needs_human",
      phase: "active",
      onboardingStep: "done",
      applyClientReply: null,
    });
  }

  return outreachFaq(input, quote, lang, text, kind);
}

export const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function withinCustomerWindow(lastInboundAt: Date | null | undefined, now = new Date()) {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < CUSTOMER_WINDOW_MS;
}

export function shouldSendNow(decision: RosaliaDecision, lastInboundAt: Date | null | undefined, now = new Date()) {
  if (decision.sendPolicy === "reply") return true;
  return withinCustomerWindow(lastInboundAt, now);
}
