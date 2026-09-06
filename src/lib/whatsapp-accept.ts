import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  assertReceivingAccount,
  assertWhatsappSignature,
  receivingIds,
  WhatsappWebhookError,
} from "./whatsapp-verify";

export { WhatsappWebhookError };

export async function acceptWhatsappWebhook(raw: string, signature: string | null) {
  await assertWhatsappSignature(raw, signature, process.env.WHATSAPP_APP_SECRET);
  let json: Parameters<typeof receivingIds>[0];
  try {
    json = JSON.parse(raw) as Parameters<typeof receivingIds>[0];
  } catch {
    throw new WhatsappWebhookError("invalid json", 400);
  }
  const parsed = receivingIds(json);
  assertReceivingAccount({
    phoneNumberId: parsed.phoneNumberId,
    wabaId: parsed.wabaId,
    expectedPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    expectedWabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  });
  const receiving = parsed.phoneNumberId!;
  const accepted: string[] = [];
  const duplicates: string[] = [];
  for (const m of parsed.messages) {
    try {
      await prisma.$transaction(async (tx) => {
        const ev = await tx.providerEvent.create({
          data: {
            provider: "whatsapp",
            receivingAccount: receiving,
            eventId: m.id,
            eventTime: m.timestamp,
            payload: {
              from: m.from,
              text: m.text || "(vide)",
              type: m.type,
              profileName: m.profileName,
              mediaType: m.mediaType,
            },
            state: "accepted",
          },
        });
        const job = await tx.job.create({
          data: {
            kind: "wa_inbound",
            payload: { eventId: ev.id, threadKey: m.from },
            status: "queued",
          },
        });
        await tx.providerEvent.update({ where: { id: ev.id }, data: { jobId: job.id } });
      });
      accepted.push(m.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicates.push(m.id);
        continue;
      }
      throw e;
    }
  }
  return { ok: true as const, accepted, duplicates };
}

export async function processWaInboundEvent(eventId: string) {
  const ev = await prisma.providerEvent.findUnique({ where: { id: eventId } });
  if (!ev) throw new Error("provider event missing");
  if (ev.state === "processed") return { skipped: true as const };
  const payload = ev.payload as {
    from?: string;
    text?: string;
    profileName?: string | null;
    mediaType?: string;
  };
  const { ingestInbound } = await import("./inbox");
  await ingestInbound({
    channel: "whatsapp",
    counterparty: payload.from ?? "",
    body: payload.text || "(vide)",
    providerId: `wa-${ev.eventId}`,
    payload: { providerEventId: ev.id, profileName: payload.profileName, mediaType: payload.mediaType },
    profileName: payload.profileName ?? null,
    occurredAt: ev.eventTime,
  });
  await prisma.providerEvent.update({ where: { id: ev.id }, data: { state: "processed" } });
  return { skipped: false as const };
}
