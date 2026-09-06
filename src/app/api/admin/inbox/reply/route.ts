import { NextResponse } from "next/server";
import { isResponse, requireRole } from "@/lib/api-guard";
import { deliverRosaliaDraft, proposeRosaliaReply } from "@/lib/rosalia-reply";

export async function POST(req: Request) {
  const session = await requireRole(["admin"]);
  if (isResponse(session)) return session;

  const body = (await req.json()) as {
    threadId?: string;
    action?: "propose" | "send" | "pause" | "release";
    text?: string;
  };
  const threadId = (body.threadId ?? "").trim();
  const action = body.action === "send" ? "send" : body.action === "pause" ? "pause" : body.action === "release" ? "release" : "propose";
  if (!threadId) return NextResponse.json({ error: "threadId requis" }, { status: 400 });

  if (action === "pause" || action === "release") {
    const { prisma } = await import("@/lib/db");
    await prisma.inboxThread.update({ where: { id: threadId }, data: { humanPaused: action === "pause" } });
    return NextResponse.json({ ok: true, humanPaused: action === "pause" });
  }

  if (action === "propose") {
    const proposed = await proposeRosaliaReply(threadId);
    return NextResponse.json({ ok: true, proposed });
  }

  try {
    const sent = await deliverRosaliaDraft(threadId, body.text);
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
