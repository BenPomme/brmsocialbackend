import "server-only";
import { handleClientReply } from "./client-reply";
import { ingestInbound } from "./inbox";
import { quoteFor, resolveQuoteCity } from "./catalog";
import { isSantCugat } from "./offers";
import { prisma } from "./db";
import { extractSpokenName, personFirstName } from "./language";
import { xaiFastModel, xaiText } from "./xai";
import { isWhatsappAllowlisted, sendWhatsappText } from "./whatsapp-send";
import { isAllowlisted, sendZohoMail } from "./zoho-mail";
import { classifyInbound } from "./classify-inbound";
import { hasScript } from "./rosalia/copy";
import { decideRosalia, decisionFromScript, shouldSendNow } from "./rosalia/decide";
import { coerceRoute, isRoutable, nextOnboard, parseTurn, repeats, talkPrompt } from "./rosalia/route";
import type { ConvoLang, RosaliaEvent, ThreadPhase, OnboardingStep } from "./rosalia/types";

export { wantsPayLink } from "./rosalia/decide";
export { detectConvoLang } from "./rosalia/lang";
export { decideRosalia } from "./rosalia/decide";
export type { ConvoLang };

function isLocalHost(url: string) {
  return /localhost|127\.0\.0\.1/.test(url);
}

export function payUrl(opts?: { wa?: string | null; city?: string | null }) {
  const candidates = [
    process.env.PAY_PUBLIC_URL,
    process.env.APP_URL,
    process.env.SITE_URL,
    "http://localhost:3001",
  ]
    .map((u) => (u ?? "").trim().replace(/\/$/, ""))
    .filter(Boolean);
  const base = candidates.find((u) => !isLocalHost(u)) ?? candidates[0];
  const url = new URL(`${base.replace(/\/pay$/i, "")}/pay`);
  if (opts?.wa) url.searchParams.set("wa", opts.wa.replace(/\D/g, ""));
  if (opts?.city) url.searchParams.set("city", opts.city);
  if (opts?.city && isSantCugat(opts.city)) url.searchParams.set("plan", "trial_santcugat");
  return url.toString();
}

function asLang(v: string | null | undefined): ConvoLang | null {
  return v === "es" || v === "ca" || v === "en" || v === "fr" ? v : null;
}

function asPhase(v: string | null | undefined): ThreadPhase {
  if (v === "awaiting_pay" || v === "onboarding" || v === "active" || v === "stopped") return v;
  return "outreach";
}

function asStep(v: string | null | undefined): OnboardingStep | null {
  if (v === "maps" || v === "people" || v === "email" || v === "role" || v === "wait_google" || v === "done") return v;
  return null;
}

function mediaFromPayload(payload: unknown): RosaliaEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const media = (payload as { mediaType?: string }).mediaType;
  if (!media || media === "text") return null;
  if (media === "image" || media === "audio" || media === "video" || media === "sticker" || media === "document") {
    return { type: "inbound_media", media };
  }
  return { type: "inbound_media", media: "other" };
}

function nameFromThread(thread: {
  firstName?: string | null;
  messages: { direction: string; body: string; payload: unknown }[];
}) {
  if (thread.firstName) return thread.firstName;
  for (const m of thread.messages) {
    if (m.direction !== "in") continue;
    const spoken = extractSpokenName(m.body);
    if (spoken) return spoken;
    const p = m.payload as { profileName?: string } | null;
    const fromProfile = personFirstName(p?.profileName ?? "");
    if (fromProfile) return fromProfile;
  }
  return "";
}

const SESSION_GAP_MS = 10 * 60 * 1000;

function sessionSlice<T extends { createdAt: Date; direction: string }>(messages: T[]) {
  const real = messages.filter((m) => m.direction !== "draft");
  let cut = 0;
  for (let i = 1; i < real.length; i++) {
    if (real[i].createdAt.getTime() - real[i - 1].createdAt.getTime() > SESSION_GAP_MS) cut = i;
  }
  return real.slice(cut);
}

function draftId(threadId: string) {
  return `draft-${threadId}`;
}

async function loadThread(threadId: string) {
  const thread = await prisma.inboxThread.findUnique({
    where: { id: threadId },
    include: {
      lead: { select: { name: true, city: true } },
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 80 },
    },
  });
  if (!thread) return null;
  return { ...thread, messages: [...thread.messages].reverse() };
}

async function clientForThread(thread: { clientId: string | null; counterparty: string; lead: { city: string | null } | null }) {
  if (thread.clientId) {
    return prisma.client.findUnique({ where: { id: thread.clientId } });
  }
  const digits = thread.counterparty.replace(/\D/g, "");
  const tail = digits.length >= 9 ? digits.slice(-9) : "";
  if (!tail) return null;
  return prisma.client.findFirst({
    where: { OR: [{ whatsappOwner: { contains: tail } }, { whatsappSite: { contains: tail } }] },
  });
}

export async function proposeRosaliaReply(threadId: string, eventOverride?: RosaliaEvent) {
  const thread = await loadThread(threadId);
  if (!thread) throw new Error("thread not found");

  const lastIn = eventOverride && "messageId" in eventOverride && eventOverride.messageId
    ? thread.messages.find((m) => m.id === eventOverride.messageId) ??
      [...thread.messages].reverse().find((m) => m.direction === "in")
    : [...thread.messages].reverse().find((m) => m.direction === "in");
  const event: RosaliaEvent | null =
    eventOverride ??
    (lastIn
      ? mediaFromPayload(lastIn.payload) ?? { type: "inbound_text", text: lastIn.body, messageId: lastIn.id }
      : null);
  if (!event) return { created: false as const, reason: "no inbound" };
  if (event.type === "inbound_text" && event.messageId && lastIn && lastIn.id !== event.messageId) {
    const newer = [...thread.messages].reverse().find((m) => m.direction === "in");
    if (newer && newer.id !== event.messageId) {
      return { created: false as const, reason: "stale inbound" };
    }
  }

  const allMessages = thread.messages.filter((m) => m.direction !== "draft");
  const allOutbound = allMessages.filter((m) => m.direction === "out").map((m) => m.body);
  const lastOut = [...allMessages].reverse().find((m) => m.direction === "out");
  const firstName = nameFromThread(thread) || (lastIn ? extractSpokenName(lastIn.body) : "");
  const rememberedLang = asLang(thread.preferredLang);
  const client = await clientForThread(thread);
  const inboundForCity = event.type === "inbound_text" ? event.text : "";
  const city = resolveQuoteCity({
    city: client?.city ?? thread.lead?.city ?? thread.city,
    inbound: inboundForCity,
  });
  const lastInbound = thread.lastInboundAt ?? lastIn?.createdAt ?? null;
  const pendingLow = client
    ? Boolean(
        await prisma.avis.findFirst({
          where: { clientId: client.id, stars: { lte: 3 }, status: "attente_client" },
          select: { id: true },
        }),
      )
    : false;

  const link = payUrl({ wa: thread.counterparty, city });
  const decideOpts = {
    event,
    outboundBodies: allOutbound,
    firstName,
    preferredLang: rememberedLang,
    phase: asPhase(thread.phase),
    onboardingStep: asStep(thread.onboardingStep),
    clientStatus: client?.status ?? null,
    managerInviteStatus: client?.managerInviteStatus ?? null,
    city,
    lastInboundAt: lastInbound,
    payUrl: link,
    pendingLowStar: pendingLow,
  };
  const alreadyStopped = asPhase(thread.phase) === "stopped";
  const hard =
    event.type !== "inbound_text" ||
    classifyInbound(event.text) === "stop" ||
    process.env.ROSALIA_LLM === "false";

  let decided = hard ? decideRosalia(decideOpts) : null;
  let replySource: "template" | "llm" | "off_script" = decided?.source ?? "off_script";

  if (alreadyStopped && event.type === "inbound_text" && classifyInbound(event.text) !== "stop") {
    decided = decisionFromScript("fallback", decideOpts);
    replySource = "off_script";
  } else if (!hard && event.type === "inbound_text") {
    const session = sessionSlice(thread.messages);
    const historyLines = session
      .filter((m) => m.direction !== "draft")
      .slice(-8)
      .map((m) => `${m.direction === "in" ? "ellos" : "rosalia"}: ${m.body}`);
    const quote = quoteFor({ city, inbound: event.text });
    try {
      const raw = await xaiText(
        talkPrompt({
          lang: rememberedLang ?? "es",
          phase: asPhase(thread.phase),
          step: asStep(thread.onboardingStep),
          monthLabel: quote.monthLabel,
          managerEmail: quote.managerEmail,
          payUrl: link,
          lastOut: allOutbound.at(-1) ?? null,
        }),
        `History:\n${historyLines.join("\n") || "(empty)"}\n\nInbound:\n${event.text}`,
        { model: xaiFastModel(), maxTokens: 280, temperature: 0.4, reasoning: "none" },
      );
      let parsed = parseTurn(raw ?? "");
      if (!parsed?.reply || repeats(parsed.reply, allOutbound)) {
        const retry = await xaiText(
          talkPrompt({
            lang: rememberedLang ?? "es",
            phase: asPhase(thread.phase),
            step: asStep(thread.onboardingStep),
            monthLabel: quote.monthLabel,
            managerEmail: quote.managerEmail,
            payUrl: link,
            lastOut: allOutbound.at(-1) ?? null,
          }),
          `History:\n${historyLines.join("\n") || "(empty)"}\n\nInbound:\n${event.text}\n\nWrite a NEW WhatsApp reply. reply must not be empty.`,
          { model: xaiFastModel(), maxTokens: 280, temperature: 0.4, reasoning: "none" },
        );
        parsed = parseTurn(retry ?? "") ?? parsed;
      }
      const route = coerceRoute(
        parsed?.route ?? "human",
        asStep(thread.onboardingStep),
        event.text,
        asPhase(thread.phase),
      );
      const spoken = (parsed?.reply ?? "").trim();
      console.log("rosalia route", { inbound: event.text.slice(0, 80), raw: (raw ?? "").slice(0, 120), route });
      const base = decisionFromScript(
        route === "human" || !isRoutable(route) || !hasScript(route) ? "fallback" : route,
        decideOpts,
      );
      if (spoken && !repeats(spoken, allOutbound)) {
        decided = { ...base, body: spoken.slice(0, 700), source: "template", status: "ok", faqId: route || "llm_reply" };
        replySource = "llm";
      } else {
        decided = { ...base, source: "off_script", status: "needs_human" };
        replySource = "off_script";
      }
    } catch (e) {
      console.warn("rosalia route", e);
    }
  }

  if (!decided) {
    decided = decideRosalia(decideOpts);
    replySource = decided.source;
  }
  if (repeats(decided.body, allOutbound)) {
    const bump = nextOnboard(asStep(thread.onboardingStep) ?? decided.onboardingStep);
    if (bump !== "human" && hasScript(bump)) {
      const alt = decisionFromScript(bump, decideOpts);
      if (!repeats(alt.body, allOutbound)) {
        decided = alt;
        replySource = "llm";
      } else {
        decided = decisionFromScript("fallback", decideOpts);
        replySource = "off_script";
      }
    } else {
      decided = decisionFromScript("fallback", decideOpts);
      replySource = "off_script";
    }
  }
  const body = decided.body;

  const existing = await prisma.inboxMessage.findUnique({ where: { providerId: draftId(thread.id) } });
  const draft = existing
    ? await prisma.inboxMessage.update({
        where: { id: existing.id },
        data: {
          body,
          payload: {
            source: replySource,
            kind: decided.kind,
            faqId: decided.faqId,
            phase: decided.phase,
            inboundMessageId: event.type === "inbound_text" ? event.messageId ?? lastIn?.id : lastIn?.id,
          },
        },
      })
    : await prisma.inboxMessage.create({
        data: {
          threadId: thread.id,
          direction: "draft",
          body,
          providerId: draftId(thread.id),
          payload: {
            source: replySource,
            kind: decided.kind,
            faqId: decided.faqId,
            phase: decided.phase,
            inboundMessageId: event.type === "inbound_text" ? event.messageId ?? lastIn?.id : lastIn?.id,
          },
        },
      });

  if (client && decided.applyClientReply && lastIn && (decided.applyClientReply === "ok" || decided.applyClientReply === "text" || decided.applyClientReply === "cerrado")) {
    try {
      await handleClientReply({ clientId: client.id, text: lastIn.body, actor: "rosalia" });
    } catch (e) {
      console.warn("rosalia apply client reply", e);
    }
  }

  const inboundAt =
    event.type === "inbound_text" || event.type === "inbound_media" ? new Date() : lastInbound;

  await prisma.inboxThread.update({
    where: { id: thread.id },
    data: {
      status: decided.status,
      lastMessageAt: new Date(),
      phase: decided.phase,
      onboardingStep: decided.onboardingStep,
      preferredLang: decided.lang,
      ...(decided.city ? { city: decided.city } : {}),
      ...(firstName ? { firstName } : {}),
      ...(client ? { clientId: client.id } : {}),
      ...(event.type === "inbound_text" || event.type === "inbound_media" ? { lastInboundAt: inboundAt } : {}),
    },
  });

  console.log("rosalia out", {
    phone: thread.counterparty,
    firstName: firstName || null,
    faqId: decided.faqId,
    replySource,
    lang: decided.lang,
    phase: decided.phase,
    preview: body.slice(0, 120),
  });

  return {
    created: true as const,
    draftId: draft.id,
    source: replySource,
    kind: decided.kind,
    body,
    decision: decided,
    lastInboundAt: inboundAt,
  };
}

export async function deliverRosaliaDraft(threadId: string, textOverride?: string) {
  const thread = await prisma.inboxThread.findUnique({
    where: { id: threadId },
    include: { messages: { where: { direction: "draft" }, take: 1 } },
  });
  if (!thread) throw new Error("thread not found");
  const draft = thread.messages[0];
  const text = (textOverride ?? draft?.body ?? "").trim();
  if (!text) throw new Error("rien à envoyer");

  if (thread.channel === "whatsapp") {
    const sent = await sendWhatsappText(thread.counterparty, text);
    await ingestInbound({
      channel: "whatsapp",
      counterparty: thread.counterparty,
      body: text,
      providerId: `wa-out-${sent.providerId}`,
      direction: "out",
    });
    if (draft) await prisma.inboxMessage.delete({ where: { id: draft.id } }).catch(() => null);
    return { channel: "whatsapp" as const, providerId: sent.providerId };
  }

  if (thread.channel === "email") {
    const sent = await sendZohoMail({
      to: thread.counterparty,
      subject: thread.subject ? `Re: ${thread.subject.replace(/^re:\s*/i, "")}` : "Babyrock Social",
      content: text,
    });
    await ingestInbound({
      channel: "email",
      counterparty: thread.counterparty,
      body: text,
      subject: thread.subject,
      providerId: `zoho-out-${sent.messageId ?? sent.mailId ?? Date.now()}`,
      direction: "out",
    });
    if (draft) await prisma.inboxMessage.delete({ where: { id: draft.id } }).catch(() => null);
    return { channel: "email" as const, providerId: String(sent.messageId ?? sent.mailId ?? "") };
  }

  throw new Error(`canal ${thread.channel} non géré`);
}

const SKIP_AUTO = new Set(["16315551181", "34600000001", "15555551234"]);

export async function proposeAndMaybeSend(threadId: string, eventOverride?: RosaliaEvent) {
  const proposed = await proposeRosaliaReply(threadId, eventOverride);
  if (!proposed.created) return { ...proposed, sent: false as const };

  const thread = await prisma.inboxThread.findUnique({ where: { id: threadId } });
  if (!thread) return { ...proposed, sent: false as const };

  const digits = thread.counterparty.replace(/\D/g, "");
  if (SKIP_AUTO.has(digits) || proposed.source === "off_script") {
    return { ...proposed, sent: false as const };
  }
  if (!shouldSendNow(proposed.decision, proposed.lastInboundAt)) {
    return { ...proposed, sent: false as const, held: true as const };
  }

  const lastIn = await prisma.inboxMessage.findFirst({
    where: { threadId: thread.id, direction: "in" },
    orderBy: { createdAt: "desc" },
  });
  const simulated = Boolean(lastIn && lastIn.payload && typeof lastIn.payload === "object" && "simulated" in lastIn.payload && (lastIn.payload as { simulated?: boolean }).simulated);

  if (simulated) {
    await ingestInbound({
      channel: thread.channel as "email" | "whatsapp",
      counterparty: thread.counterparty,
      body: proposed.body,
      providerId: `sim-out-${thread.channel}-${Date.now()}`,
      direction: "out",
      skipDraft: true,
    });
    await prisma.inboxMessage.deleteMany({ where: { threadId: thread.id, direction: "draft" } }).catch(() => null);
    return { ...proposed, sent: true as const, simulated: true as const };
  }

  const allowed =
    (thread.channel === "whatsapp" && isWhatsappAllowlisted(thread.counterparty)) ||
    (thread.channel === "email" && isAllowlisted(thread.counterparty));
  if (!allowed) return { ...proposed, sent: false as const };

  try {
    const sent = await deliverRosaliaDraft(threadId);
    return { ...proposed, sent: true as const, delivered: sent };
  } catch (e) {
    console.warn("rosalia auto-send", e);
    return { ...proposed, sent: false as const, sendError: e instanceof Error ? e.message : String(e) };
  }
}

export async function emitRosaliaEvent(opts: {
  threadId?: string;
  clientId?: string;
  counterparty?: string;
  event: RosaliaEvent;
}) {
  const threadId = opts.threadId ?? (await findThreadId(opts));
  if (!threadId) return { created: false as const, reason: "no thread" };
  return proposeAndMaybeSend(threadId, opts.event);
}

async function findThreadId(opts: { clientId?: string; counterparty?: string }) {
  if (opts.counterparty) {
    const t = await prisma.inboxThread.findUnique({
      where: { channel_counterparty: { channel: "whatsapp", counterparty: opts.counterparty.replace(/\D/g, "").toLowerCase() } },
    });
    if (t) return t.id;
  }
  if (opts.clientId) {
    const byClient = await prisma.inboxThread.findFirst({
      where: { clientId: opts.clientId, channel: "whatsapp" },
      orderBy: { lastMessageAt: "desc" },
    });
    if (byClient) return byClient.id;
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    const wa = (client?.whatsappOwner ?? client?.whatsappSite ?? "").replace(/\D/g, "");
    const tail = wa.slice(-9);
    if (!tail) return null;
    const t = await prisma.inboxThread.findFirst({
      where: { channel: "whatsapp", counterparty: { contains: tail } },
    });
    return t?.id ?? null;
  }
  return null;
}

export async function linkThreadToClient(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;
  const wa = (client.whatsappOwner ?? "").replace(/\D/g, "");
  const tail = wa.slice(-9);
  if (!tail) return;
  await prisma.inboxThread.updateMany({
    where: { channel: "whatsapp", counterparty: { contains: tail } },
    data: { clientId: client.id },
  });
}

export async function markManagerConnected(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("client not found");
  const nextStatus = client.status === "paye" || client.status === "essai" ? "actif" : client.status;
  await prisma.client.update({
    where: { id: clientId },
    data: { managerInviteStatus: "accepted", status: nextStatus },
  });
  return emitRosaliaEvent({ clientId, event: { type: "manager_connected" } });
}
