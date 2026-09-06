import { NextResponse } from "next/server";
import { isResponse, requireRole } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { ClientReplyError, handleClientReply } from "@/lib/client-reply";

export async function GET(_req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  const session = await requireRole(["client", "admin"]);
  if (isResponse(session)) return session;
  const { clientId } = await ctx.params;
  if (session.role === "client" && (!session.clientId || session.clientId !== clientId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, city: true, country: true },
  });
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  const messages = await prisma.messageWhatsapp.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
  });
  const pending = await prisma.avis.findMany({
    where: { clientId, stars: { lte: 3 }, status: "attente_client" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ client, messages, pending });
}

export async function POST(req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  const session = await requireRole(["client", "admin"]);
  if (isResponse(session)) return session;
  const { clientId } = await ctx.params;
  if (session.role === "client" && (!session.clientId || session.clientId !== clientId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json()) as { text?: string; avisId?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  try {
    const result = await handleClientReply({
      clientId,
      avisId: body.avisId ?? null,
      text,
      actor: session.email,
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof ClientReplyError ? e.status : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
