import { NextResponse } from "next/server";
import { acceptWhatsappWebhook, WhatsappWebhookError } from "@/lib/whatsapp-accept";
import { pumpWaInboundJobs } from "@/lib/jobs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && expected && token === expected && challenge) {
    console.log("whatsapp webhook verify: ok");
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  console.warn("whatsapp webhook verify: rejected");
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  try {
    const result = await acceptWhatsappWebhook(raw, signature);
    const { after } = await import("next/server");
    after(() => pumpWaInboundJobs().catch((e) => console.warn("wa_inbound pump", e)));
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof WhatsappWebhookError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.warn("whatsapp webhook", e);
    return NextResponse.json({ error: "accept failed" }, { status: 500 });
  }
}
