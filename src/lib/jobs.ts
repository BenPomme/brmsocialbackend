import { prisma } from "./db";
import { assertNotOutbound, isOutboundKind, OutboundRefusedError } from "./outbound";
import { runScout } from "./agents/scout";
import { runInspect } from "./agents/inspect";
import { runCarrier } from "./agents/carrier";
import { syncZohoInbox } from "./zoho-inbox";
import { draftMany } from "./agents/draft";
import { publishAvis, type Checklist } from "./agents/publish";
import { runFicheWatch } from "./agents/fiche-watch";
import type { Prisma } from "@prisma/client";

export async function enqueueJob(kind: string, payload: Prisma.InputJsonValue) {
  return prisma.job.create({
    data: { kind, payload, status: "queued" },
  });
}

export async function runJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("job not found");

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "run", lockedAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    if (isOutboundKind(job.kind)) {
      assertNotOutbound(job.kind);
    }
    let result: Prisma.InputJsonValue = {};
    const payload = job.payload as Record<string, unknown>;
    if (job.kind === "scout") {
      result = (await runScout({
        cityId: typeof payload.cityId === "string" ? payload.cityId : undefined,
        categoryId: typeof payload.categoryId === "string" ? payload.categoryId : undefined,
        maxPlaces: typeof payload.maxPlaces === "number" ? payload.maxPlaces : undefined,
        maxDetails: typeof payload.maxDetails === "number" ? payload.maxDetails : undefined,
        skipDraft: payload.skipDraft === true,
      })) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "inspect") {
      result = (await runInspect({
        city: typeof payload.city === "string" ? payload.city : undefined,
        leadIds: Array.isArray(payload.leadIds) ? (payload.leadIds as string[]) : undefined,
        maxLeads: typeof payload.maxLeads === "number" ? payload.maxLeads : undefined,
      })) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "carrier") {
      result = (await runCarrier({
        city: typeof payload.city === "string" ? payload.city : undefined,
        leadId: typeof payload.leadId === "string" ? payload.leadId : undefined,
        maxLeads: typeof payload.maxLeads === "number" ? payload.maxLeads : undefined,
        send: payload.send === true,
      })) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "inbox_sync") {
      result = (await syncZohoInbox()) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "draft") {
      const ids = Array.isArray(payload.avisIds) ? (payload.avisIds as string[]) : [];
      result = (await draftMany(ids)) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "publish") {
      result = (await publishAvis({
        avisId: String(payload.avisId),
        actor: String(payload.actor ?? "operator"),
        checklist: payload.checklist as Checklist,
      })) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "fiche_watch") {
      result = (await runFicheWatch({
        clientId: String(payload.clientId),
        weekly: payload.weekly === true,
      })) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "wa_inbound") {
      const { processWaInboundEvent } = await import("./whatsapp-accept");
      result = (await processWaInboundEvent(String(payload.eventId))) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "gbp_invites") {
      const { pollGbpInvitations } = await import("./manager-invite");
      result = (await pollGbpInvitations()) as unknown as Prisma.InputJsonValue;
    } else if (job.kind === "scope") {
      result = { note: "scope is interactive, not a worker" };
    } else {
      throw new Error(`unknown job kind "${job.kind}"`);
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "done", result, errorText: null, lockedAt: null },
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const outbound = e instanceof OutboundRefusedError;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "fail",
        errorText: message,
        result: { outboundRefused: outbound },
        lockedAt: null,
      },
    });
    throw e;
  }
}

export async function enqueueAndRun(kind: string, payload: Prisma.InputJsonValue) {
  const job = await enqueueJob(kind, payload);
  try {
    const result = await runJob(job.id);
    return { jobId: job.id, result };
  } catch (e) {
    return {
      jobId: job.id,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
