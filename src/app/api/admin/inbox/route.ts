import { NextResponse } from "next/server";
import { isResponse, requireRole } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await requireRole(["admin"]);
  if (isResponse(session)) return session;
  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const threadId = url.searchParams.get("threadId");

  const messageQuery = {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 40,
    ...(before && threadId ? { cursor: { id: before }, skip: 1 } : {}),
  };

  const threads = await prisma.inboxThread.findMany({
    where: threadId ? { id: threadId } : undefined,
    orderBy: { lastMessageAt: "desc" },
    take: 80,
    include: {
      lead: { select: { id: true, name: true, city: true } },
      messages: messageQuery,
    },
  });

  const shaped = await Promise.all(
    threads.map(async (t) => {
      const [latestIn, latestOut, draft] = await Promise.all([
        prisma.inboxMessage.findFirst({
          where: { threadId: t.id, direction: "in" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        prisma.inboxMessage.findFirst({
          where: { threadId: t.id, direction: "out" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        prisma.inboxMessage.findFirst({
          where: { threadId: t.id, direction: "draft" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      ]);
      return {
        ...t,
        messages: [...t.messages].reverse(),
        latestIn,
        latestOut,
        draft,
        nextBefore: t.messages.length === 40 ? t.messages[t.messages.length - 1]?.id : null,
      };
    }),
  );
  return NextResponse.json({ threads: shaped });
}
