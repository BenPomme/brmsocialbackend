import { prisma } from "./db";
import { processWaInboundEvent } from "./whatsapp-accept";

export async function pumpWaInboundJobs() {
  const queued = await prisma.job.findMany({
    where: { kind: "wa_inbound", status: "queued" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  for (const job of queued) {
    const claimed = await prisma.job.updateMany({
      where: { id: job.id, status: "queued" },
      data: { status: "run", lockedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    const payload = job.payload as { eventId?: string };
    try {
      const result = await processWaInboundEvent(String(payload.eventId));
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "done", result, errorText: null, lockedAt: null },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "fail", errorText: message, lockedAt: null },
      });
      console.warn("wa_inbound job", job.id, e);
    }
  }
}

export function startWaInboundLoop() {
  const tick = () => {
    pumpWaInboundJobs().catch((e) => console.warn("wa_inbound pump", e));
  };
  tick();
  setInterval(tick, 3000);
}
