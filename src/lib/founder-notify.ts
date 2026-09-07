import { founderWhatsapp } from "./env";
import { digitsOnly, sendWhatsappText } from "./whatsapp-send";

export async function notifyFounder(body: string) {
  const to = founderWhatsapp();
  if (!to || digitsOnly(to).length < 9) {
    console.warn("FOUNDER_WHATSAPP missing — skipped founder ping");
    return { sent: false as const, reason: "no_number" };
  }
  try {
    const sent = await sendWhatsappText(to, body, { ignoreAllowlist: true });
    return { sent: true as const, providerId: sent.providerId };
  } catch (e) {
    console.warn("founder notify", e);
    return { sent: false as const, reason: e instanceof Error ? e.message : String(e) };
  }
}
