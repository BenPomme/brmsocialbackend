import { envChecklist, OUTBOUND_ENABLED } from "./env";
import { OUTBOUND_JOB_KINDS } from "./outbound";

function mark(ok: boolean, optional = false) {
  if (ok) return "set";
  return optional ? "missing (optional)" : "MISSING";
}

export function printBootChecklist() {
  const c = envChecklist();
  const lines = [
    "============================================================",
    "Babyrock proto — boot checklist",
    "============================================================",
    `  OUTBOUND_ENABLED        = ${OUTBOUND_ENABLED}  (forced false in code)`,
    `  DATABASE_URL            = ${mark(c.DATABASE_URL)}`,
    `  GOOGLE_PLACES_API_KEY   = ${mark(c.GOOGLE_PLACES_API_KEY)}`,
    `  DATAFORSEO_LOGIN        = ${mark(c.DATAFORSEO_LOGIN, true)}`,
    `  DATAFORSEO_PASSWORD     = ${mark(c.DATAFORSEO_PASSWORD, true)}`,
    `  ZOHO_REFRESH_TOKEN      = ${mark(c.ZOHO_REFRESH_TOKEN, true)}`,
    `  XAI_API_KEY             = ${mark(c.XAI_API_KEY, true)}`,
    `  SESSION_SECRET          = ${mark(c.SESSION_SECRET)}`,
    `  STRIPE_SECRET_KEY       = ${mark(c.STRIPE_SECRET_KEY)} (${c.stripeMode})`,
    `  STRIPE_WEBHOOK_SECRET   = ${mark(c.STRIPE_WEBHOOK_SECRET, true)}`,
    `  XAI_MODEL               = ${c.XAI_MODEL}`,
    "",
    "  Refusing outbound workers:",
    `    ${OUTBOUND_JOB_KINDS.join(", ")}`,
    "  Zoho Mail (rosalia@) can send only to OUTREACH_ALLOWLIST. SMTP / SMS off. WhatsApp auto-reply is open unless WHATSAPP_ALLOWLIST lists numbers.",
    "  Publish writes the DB and logs dry-run unless publish_live=true",
    "  AND manager_invite_status=accepted AND GBP write is wired (it is not).",
    "",
  ];

  if (c.outboundEnvTried !== "false") {
    lines.push(
      `  NOTE: .env has OUTBOUND_ENABLED=${c.outboundEnvTried} — ignored. Proto will not send.`,
      "",
    );
  }
  if (!c.GOOGLE_PLACES_API_KEY) {
    lines.push(
      "  Scout will fail until GOOGLE_PLACES_API_KEY is set (Places API New).",
      "",
    );
  }
  if (!c.DATAFORSEO_LOGIN || !c.DATAFORSEO_PASSWORD) {
    lines.push(
      "  No DataForSEO: Inspect cannot read owner replies. Scout still runs on Places.",
      "",
    );
  }
  if (!c.ZOHO_REFRESH_TOKEN) {
    lines.push(
      "  No Zoho refresh token: outreach send test will fail. Compose still works.",
      "",
    );
  }
  if (!c.XAI_API_KEY) {
    lines.push(
      "  No xAI API key (console.x.ai). SuperGrok chat quota cannot be used here. Drafts are templates.",
      "",
    );
  }
  if (!c.STRIPE_SECRET_KEY) {
    lines.push("  No Stripe: /pay will 503. Add STRIPE_SECRET_KEY (test is enough to simulate).", "");
  } else if (c.stripeMode === "test") {
    lines.push("  Stripe test mode. Open /pay, card 4242. Not Billing 0.7 % — one-off Checkout.", "");
  }
  lines.push("============================================================");
  console.log(lines.join("\n"));
}
