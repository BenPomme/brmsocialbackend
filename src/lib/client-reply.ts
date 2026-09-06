import { prisma } from "./db";
import { isCerradoIntent } from "./fiche/recap";

export class ClientReplyError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
    this.name = "ClientReplyError";
  }
}

const OK_RE = /^(ok|oui|yes|d['’]?accord|vale|de acuerdo)\b/i;

export async function handleClientReply(opts: {
  clientId: string;
  avisId?: string | null;
  text: string;
  actor: string;
}) {
  const text = opts.text.trim();
  if (!text) throw new ClientReplyError("empty reply", 400);
  if (!opts.clientId) throw new ClientReplyError("unbound client", 403);

  if (isCerradoIntent(text)) {
    return applyCerrado(opts.clientId, opts.actor, text);
  }

  const pending = await prisma.avis.findMany({
    where: { clientId: opts.clientId, stars: { lte: 3 }, status: "attente_client" },
    include: { reponses: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  let avis =
    opts.avisId != null && opts.avisId !== ""
      ? await prisma.avis.findFirst({
          where: { id: opts.avisId, clientId: opts.clientId },
          include: { reponses: { orderBy: { version: "desc" }, take: 1 } },
        })
      : null;

  if (opts.avisId) {
    if (!avis) throw new ClientReplyError("avis not found for this account", 403);
    if (avis.status !== "attente_client" && avis.status !== "pret") {
      throw new ClientReplyError("no open approval request", 400);
    }
  } else if (pending.length > 1) {
    return { ok: false as const, needs: "which_review" as const, pending: pending.map((a) => a.id) };
  } else if (pending.length === 1) {
    avis = pending[0];
  }

  if (!avis) {
    await prisma.messageWhatsapp.create({
      data: {
        clientId: opts.clientId,
        direction: "in",
        body: text,
        providerMsgId: `in:${opts.clientId}:${Date.now()}`,
      },
    });
    return { ok: true as const, note: "message stored, no pending 1–3★" };
  }

  const latest = avis.reponses[0];
  if (!latest) throw new ClientReplyError("no reply version to approve", 400);

  const isOk = OK_RE.test(text);

  if (isOk) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.replyApproval.findFirst({
        where: { reponseId: latest.id, decision: "approved", valid: true },
      });
      if (existing) {
        return { ok: true as const, avisId: avis.id, status: "pret", mode: "ok" as const, idempotent: true as const };
      }
      await tx.replyApproval.create({
        data: {
          avisId: avis.id,
          reponseId: latest.id,
          clientId: opts.clientId,
          actor: opts.actor,
          decision: "approved",
          valid: true,
        },
      });
      await tx.avis.update({ where: { id: avis.id }, data: { status: "pret" } });
      await tx.action.create({
        data: {
          clientId: avis.clientId,
          avisId: avis.id,
          type: "owner_ok",
          actor: opts.actor,
          payload: { mode: "ok", reponseId: latest.id },
          result: "ok",
        },
      });
      await tx.messageWhatsapp.create({
        data: {
          clientId: avis.clientId,
          avisId: avis.id,
          direction: "in",
          body: text,
          providerMsgId: `in:${avis.id}:${Date.now()}`,
        },
      });
      return { ok: true as const, avisId: avis.id, status: "pret", mode: "ok" as const };
    });
  }

  const version = (latest.version ?? 0) + 1;
  return prisma.$transaction(async (tx) => {
    await tx.replyApproval.updateMany({
      where: { avisId: avis.id, valid: true },
      data: { valid: false },
    });
    const created = await tx.reponse.create({
      data: {
        avisId: avis.id,
        version,
        draftModel: latest.draftModel,
        draftText: latest.draftText,
        operatorText: latest.operatorText,
        sentToOwnerText: text,
        actor: "owner",
      },
    });
    await tx.avis.update({ where: { id: avis.id }, data: { status: "attente_client" } });
    await tx.messageWhatsapp.create({
      data: {
        clientId: avis.clientId,
        avisId: avis.id,
        direction: "in",
        body: text,
        providerMsgId: `in:${avis.id}:${Date.now()}`,
      },
    });
    return {
      ok: true as const,
      avisId: avis.id,
      status: "attente_client",
      mode: "text" as const,
      reponseId: created.id,
      confirm: true as const,
    };
  });
}

async function applyCerrado(clientId: string, actor: string, text: string) {
  const pending = await prisma.action.findMany({
    where: { clientId, type: "holiday_hours" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const hit = pending.find((a) => (a.payload as { status?: string }).status === "pending");
  if (!hit) return { ok: true as const, note: "no pending holiday" };
  const payload = hit.payload as { date?: string; name?: string };
  await prisma.action.create({
    data: {
      clientId,
      type: "holiday_hours",
      actor,
      payload: { date: payload.date, name: payload.name, status: "owner_cerrado" },
      result: "ok",
    },
  });
  await prisma.messageWhatsapp.create({
    data: {
      clientId,
      direction: "in",
      body: text,
      providerMsgId: `in:cerrado:${clientId}:${payload.date ?? Date.now()}`,
    },
  });
  return { ok: true as const, mode: "cerrado" as const, date: payload.date ?? null };
}
