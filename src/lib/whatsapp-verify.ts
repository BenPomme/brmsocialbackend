import { hmacSha256Hex, timingSafeEqualStr } from "./sha";

export class WhatsappWebhookError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WhatsappWebhookError";
  }
}

export async function verifyHubSignature(raw: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const expected = `sha256=${await hmacSha256Hex(secret, raw)}`;
  return timingSafeEqualStr(header, expected);
}

export async function assertWhatsappSignature(raw: string, header: string | null, secret: string | undefined) {
  if (!secret?.trim()) {
    throw new WhatsappWebhookError("WHATSAPP_APP_SECRET missing", 503);
  }
  if (!header?.startsWith("sha256=")) {
    throw new WhatsappWebhookError("signature missing", 401);
  }
  if (!(await verifyHubSignature(raw, header, secret.trim()))) {
    throw new WhatsappWebhookError("signature invalid", 401);
  }
}

export type WaInboundMessage = {
  id: string;
  from: string;
  type: string;
  text: string;
  timestamp: Date;
  profileName: string | null;
  mediaType: string;
};

export function receivingIds(body: {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          id?: string;
          from?: string;
          from_user_id?: string;
          type?: string;
          timestamp?: string;
          text?: { body?: string };
        }>;
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
      };
    }>;
  }>;
}): { wabaId: string | null; phoneNumberId: string | null; messages: WaInboundMessage[] } {
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0]?.value;
  const phoneNumberId = change?.metadata?.phone_number_id ?? null;
  const contacts = change?.contacts ?? [];
  const profileByWa = new Map(
    contacts.filter((c) => c.wa_id && c.profile?.name).map((c) => [c.wa_id!.replace(/\D/g, ""), c.profile!.name!]),
  );
  const messages: WaInboundMessage[] = [];
  for (const m of change?.messages ?? []) {
    const from = (m.from ?? m.from_user_id ?? "").trim();
    if (!m.id || !from) continue;
    const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();
    const mediaType = m.type && m.type !== "text" ? m.type : "text";
    messages.push({
      id: m.id,
      from,
      type: m.type ?? "text",
      text: m.type === "text" ? m.text?.body ?? "" : `(${m.type ?? "message"})`,
      timestamp: Number.isNaN(ts.getTime()) ? new Date() : ts,
      profileName: profileByWa.get(from.replace(/\D/g, "")) ?? contacts[0]?.profile?.name ?? null,
      mediaType,
    });
  }
  return { wabaId: entry?.id ?? null, phoneNumberId, messages };
}

export function assertReceivingAccount(opts: {
  phoneNumberId: string | null;
  wabaId: string | null;
  expectedPhoneId: string | undefined;
  expectedWabaId: string | undefined;
}) {
  const expectedPhone = opts.expectedPhoneId?.trim();
  if (!expectedPhone) throw new WhatsappWebhookError("WHATSAPP_PHONE_NUMBER_ID missing", 503);
  if (opts.phoneNumberId !== expectedPhone) {
    throw new WhatsappWebhookError("receiving phone mismatch", 403);
  }
  const expectedWaba = opts.expectedWabaId?.trim();
  if (expectedWaba && opts.wabaId !== expectedWaba) {
    throw new WhatsappWebhookError("receiving account mismatch", 403);
  }
}
