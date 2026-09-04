function read(name: string): string | undefined {
  const v = process.env[name];
  if (v == null || v.trim() === "") return undefined;
  return v.trim().replace(/^["']|["']$/g, "");
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function allowlistRaw() {
  return read("WHATSAPP_ALLOWLIST") ?? "";
}

/** Empty / * / all / open = anyone. Otherwise comma-separated E.164 digits. */
export function whatsappAllowlistOpen() {
  const t = allowlistRaw().trim().toLowerCase();
  return t === "" || t === "*" || t === "all" || t === "open";
}

export function whatsappAllowlist(): string[] {
  if (whatsappAllowlistOpen()) return [];
  return allowlistRaw()
    .split(",")
    .map((s) => digitsOnly(s))
    .filter((s) => s.length >= 9);
}

export function isWhatsappAllowlisted(to: string) {
  if (whatsappAllowlistOpen()) return true;
  const d = digitsOnly(to);
  return whatsappAllowlist().some((n) => n === d || d.endsWith(n) || n.endsWith(d));
}

export class WhatsappSendError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly body = "",
  ) {
    super(message);
    this.name = "WhatsappSendError";
  }
}

export async function sendWhatsappText(to: string, body: string) {
  const token = read("WHATSAPP_TOKEN");
  const phoneId = read("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) {
    throw new WhatsappSendError("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing");
  }
  const recipient = digitsOnly(to);
  if (!isWhatsappAllowlisted(recipient)) {
    throw new WhatsappSendError(
      `WhatsApp allowlist — refused to send to ${recipient}. Add the number to WHATSAPP_ALLOWLIST.`,
    );
  }
  const text = body.trim();
  if (!text) throw new WhatsappSendError("empty body");

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });
  const json = (await res.json()) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number };
  };
  if (!res.ok || json.error) {
    throw new WhatsappSendError(
      json.error?.message ?? `WhatsApp send ${res.status}`,
      res.status,
      JSON.stringify(json).slice(0, 500),
    );
  }
  return { providerId: json.messages?.[0]?.id ?? `wa-out-${Date.now()}`, to: recipient };
}
