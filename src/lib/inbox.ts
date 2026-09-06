import { classifyInbound, type InboundKind } from "./classify-inbound";
import { prisma } from "./db";
import { extractSpokenName, personFirstName } from "./language";

export type { InboundKind };
export { classifyInbound };

export async function ingestInbound(opts: {
  channel: "email" | "whatsapp";
  counterparty: string;
  body: string;
  subject?: string | null;
  providerId: string;
  payload?: unknown;
  direction?: "in" | "out";
  profileName?: string | null;
  skipDraft?: boolean;
  occurredAt?: Date;
}) {
  const counterparty = opts.counterparty.trim().toLowerCase();
  const direction = opts.direction ?? "in";
  const kind = classifyInbound(opts.body);
  const status = kind === "stop" ? "stop" : kind === "ok" ? "ok" : "needs_human";
  const spoken = direction === "in" ? extractSpokenName(opts.body) : "";
  const fromProfile = direction === "in" ? personFirstName(opts.profileName ?? "") : "";
  const digits = counterparty.replace(/\D/g, "");
  const tail = digits.length >= 9 ? digits.slice(-9) : "";

  const paidHit = await prisma.client.findFirst({
    where: {
      AND: [
        {
          OR: [
            { status: { in: ["paye", "essai", "actif"] } },
          ],
        },
        {
          OR: [
            { emailPublic: { equals: counterparty, mode: "insensitive" } },
            { billingEmail: { equals: counterparty, mode: "insensitive" } },
            ...(tail
              ? [{ whatsappOwner: { contains: tail } }, { whatsappSite: { contains: tail } }]
              : []),
          ],
        },
      ],
    },
    select: { id: true },
  });

  let lead = paidHit
    ? await prisma.lead.findFirst({ where: { clientId: paidHit.id } })
    : await prisma.lead.findFirst({
        where: {
          OR: [
            { email: { equals: counterparty, mode: "insensitive" } },
            { outreachTo: { equals: counterparty, mode: "insensitive" } },
            ...(tail
              ? [{ waSite: { contains: tail } }, { mapsPhone: { contains: tail } }]
              : []),
          ],
        },
      });

  if (!paidHit && !lead && direction === "in") {
    lead = await prisma.lead.create({
      data: {
        placeId: `inbound:${opts.channel}:${counterparty}`.slice(0, 180),
        name: (opts.profileName || counterparty).slice(0, 120),
        city: "inbound",
        country: "ES",
        source: "inbound",
        status: "new",
        channelPlan: opts.channel === "email" ? "email" : "wa_only",
        email: opts.channel === "email" ? counterparty : null,
        outreachTo: opts.channel === "email" ? counterparty : null,
        waSite: opts.channel === "whatsapp" ? counterparty : null,
      },
    });
  }

  const at = opts.occurredAt ?? new Date();
  const existing = await prisma.inboxMessage.findUnique({
    where: { providerId: opts.providerId },
  });
  if (existing) return { created: false, messageId: existing.id, threadId: existing.threadId, kind };

  const thread = await prisma.inboxThread.upsert({
    where: { channel_counterparty: { channel: opts.channel, counterparty } },
    create: {
      channel: opts.channel,
      kind: "outreach",
      counterparty,
      subject: opts.subject ?? null,
      status,
      firstName: spoken || fromProfile || null,
      leadId: lead?.id ?? null,
      lastMessageAt: at,
      lastInboundAt: direction === "in" ? at : undefined,
    },
    update: {
      lastMessageAt: at,
      ...(direction === "in" ? { status, lastInboundAt: at } : {}),
      ...(spoken ? { firstName: spoken } : {}),
      leadId: lead?.id ?? undefined,
      subject: opts.subject ?? undefined,
    },
  });

  if (!thread.firstName && fromProfile) {
    await prisma.inboxThread.update({
      where: { id: thread.id },
      data: { firstName: fromProfile },
    });
    thread.firstName = fromProfile;
  }

  const message = await prisma.inboxMessage.create({
    data: {
      threadId: thread.id,
      direction,
      body: opts.body,
      providerId: opts.providerId,
      payload: opts.payload as object | undefined,
      createdAt: at,
    },
  });

  if (!opts.skipDraft && createdInboundShouldDraft(opts.channel, direction)) {
    try {
      const { proposeAndMaybeSend } = await import("./rosalia-reply");
      await proposeAndMaybeSend(thread.id, {
        type: "inbound_text",
        text: opts.body,
        messageId: message.id,
      });
    } catch (e) {
      console.warn("rosalia propose", e);
    }
  }

  return { created: true, messageId: message.id, threadId: thread.id, kind, leadId: lead?.id ?? null };
}

function createdInboundShouldDraft(channel: string, direction: string) {
  return direction === "in" && (channel === "whatsapp" || channel === "email");
}
