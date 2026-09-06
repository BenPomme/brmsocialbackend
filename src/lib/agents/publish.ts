import { prisma } from "../db";

export const CHECKLIST_KEYS = [
  "detail_in_review",
  "no_person_name",
  "no_health_invented",
  "no_commercial_gesture",
  "language_matches",
] as const;

export type Checklist = Record<(typeof CHECKLIST_KEYS)[number], boolean>;

export function checklistComplete(c: Partial<Checklist> | undefined) {
  if (!c) return false;
  return CHECKLIST_KEYS.every((k) => c[k] === true);
}

export function canPublishLive(client: {
  publishLive: boolean;
  managerInviteStatus: string;
}) {
  // GBP write is not implemented in this proto. Even if both flags are true,
  // we still do not call Google. The flags are the gate the real worker will use.
  return (
    client.publishLive === true &&
    client.managerInviteStatus === "accepted" &&
    process.env.GBP_LIVE_IMPLEMENTED === "true"
  );
}

export function publishTextFromLatest(latest: {
  publishedText: string | null;
  sentToOwnerText: string | null;
  operatorText: string | null;
  draftText: string | null;
}) {
  return (
    latest.sentToOwnerText ||
    latest.operatorText ||
    latest.draftText ||
    ""
  );
}

export async function publishAvis(opts: {
  avisId: string;
  actor: string;
  checklist: Checklist;
}) {
  if (!checklistComplete(opts.checklist)) {
    throw new Error("checklist incomplete — Publier refused");
  }

  const avis = await prisma.avis.findUnique({
    where: { id: opts.avisId },
    include: {
      client: true,
      reponses: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!avis) throw new Error("avis not found");
  if (avis.status === "bloque") throw new Error("avis is blocked");
  if (avis.status === "publie") throw new Error("already published");
  const latest = avis.reponses[0];
  if (!latest) throw new Error("no draft to publish");
  if (avis.stars <= 3) {
    const approval = await prisma.replyApproval.findFirst({
      where: { avisId: avis.id, reponseId: latest.id, decision: "approved", valid: true },
    });
    if (!approval || approval.clientId !== avis.clientId) {
      throw new Error("1–3★ cannot be published without a valid owner approval of this reply version");
    }
  }
  const text = publishTextFromLatest(latest).trim();
  if (!text) throw new Error("empty reply text");

  const live = canPublishLive(avis.client);
  const dryRun = !live;
  const reason = live
    ? "gbp_live"
    : avis.client.publishLive && avis.client.managerInviteStatus === "accepted"
      ? "gbp_write_not_implemented_in_proto"
      : "dry-run, pas envoyé à Google";

  if (live) {
    // Intentionally unreachable until GBP_LIVE_IMPLEMENTED is wired with OAuth.
    throw new Error("GBP live path is not implemented — refusing to write to Google");
  }

  await prisma.reponse.update({
    where: { id: latest.id },
    data: { publishedText: text, actor: opts.actor === "operator" ? "operator" : latest.actor },
  });
  await prisma.avis.update({
    where: { id: avis.id },
    data: { status: "publie" },
  });
  await prisma.action.create({
    data: {
      clientId: avis.clientId,
      avisId: avis.id,
      type: "publish",
      actor: opts.actor,
      payload: {
        dryRun,
        reason,
        checklist: opts.checklist,
        text,
        publishLive: avis.client.publishLive,
        managerInviteStatus: avis.client.managerInviteStatus,
      },
      result: "ok",
    },
  });

  return { status: "publie" as const, dryRun, reason, text };
}

export async function editAvis(opts: { avisId: string; actor: string; text: string }) {
  const avis = await prisma.avis.findUnique({
    where: { id: opts.avisId },
    include: { reponses: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!avis) throw new Error("avis not found");
  const latest = avis.reponses[0];
  const version = (latest?.version ?? 0) + 1;
  await prisma.reponse.create({
    data: {
      avisId: avis.id,
      version,
      draftModel: latest?.draftModel,
      draftText: latest?.draftText,
      operatorText: opts.text,
      sentToOwnerText: latest?.sentToOwnerText,
      actor: "operator",
    },
  });
  await prisma.action.create({
    data: {
      clientId: avis.clientId,
      avisId: avis.id,
      type: "edit",
      actor: opts.actor,
      payload: { text: opts.text },
      result: "ok",
    },
  });
  return { version };
}

export async function blockAvis(opts: { avisId: string; actor: string; reason?: string }) {
  const avis = await prisma.avis.findUnique({ where: { id: opts.avisId } });
  if (!avis) throw new Error("avis not found");
  await prisma.avis.update({ where: { id: avis.id }, data: { status: "bloque" } });
  await prisma.action.create({
    data: {
      clientId: avis.clientId,
      avisId: avis.id,
      type: "block",
      actor: opts.actor,
      payload: { reason: opts.reason ?? null },
      result: "ok",
    },
  });
}
