function read(name: string): string | undefined {
  const v = process.env[name];
  if (v == null || v.trim() === "") return undefined;
  return v.trim();
}

/** Proto hard rule: outbound is off, even if someone puts true in .env. */
export const OUTBOUND_ENABLED = false;

export function envChecklist() {
  const triedOutbound = (process.env.OUTBOUND_ENABLED ?? "false").toLowerCase();
  return {
    DATABASE_URL: Boolean(read("DATABASE_URL")),
    GOOGLE_PLACES_API_KEY: Boolean(read("GOOGLE_PLACES_API_KEY")),
    XAI_API_KEY: Boolean(read("XAI_API_KEY")),
    SESSION_SECRET: Boolean(read("SESSION_SECRET")),
    OUTBOUND_ENABLED,
    outboundEnvTried: triedOutbound,
    XAI_MODEL: read("XAI_MODEL") ?? "grok-4.3",
    XAI_FAST_MODEL: read("XAI_FAST_MODEL") ?? "grok-4.20-0309-non-reasoning",
    SCOUT_MAX_PLACES: Number(read("SCOUT_MAX_PLACES") ?? 80),
    SCOUT_MAX_DETAILS: Number(read("SCOUT_MAX_DETAILS") ?? 80),
    DATAFORSEO_LOGIN: Boolean(read("DATAFORSEO_LOGIN")),
    DATAFORSEO_PASSWORD: Boolean(read("DATAFORSEO_PASSWORD")),
    ZOHO_REFRESH_TOKEN: Boolean(read("ZOHO_REFRESH_TOKEN")),
    INSPECT_MAX_DEPTH: Number(read("INSPECT_MAX_DEPTH") ?? 150),
    INSPECT_WINDOW_MONTHS: Number(read("INSPECT_WINDOW_MONTHS") ?? 6),
    STRIPE_SECRET_KEY: Boolean(read("STRIPE_SECRET_KEY")),
    STRIPE_PUBLISHABLE_KEY: Boolean(read("STRIPE_PUBLISHABLE_KEY")),
    STRIPE_WEBHOOK_SECRET: Boolean(read("STRIPE_WEBHOOK_SECRET")),
    stripeMode: stripeMode(),
    GOOGLE_GBP_REFRESH_TOKEN: Boolean(read("GOOGLE_GBP_REFRESH_TOKEN")),
    FOUNDER_WHATSAPP: Boolean(read("FOUNDER_WHATSAPP")),
  };
}

export function databaseUrl() {
  const url = read("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is missing");
  return url;
}

export function sessionSecret() {
  const s = read("SESSION_SECRET");
  if (!s || s.length < 24) {
    throw new Error("SESSION_SECRET is missing or too short (24+ chars)");
  }
  return s;
}

export function placesKey() {
  return read("GOOGLE_PLACES_API_KEY");
}

export function xaiKey() {
  return read("XAI_API_KEY");
}

export function xaiModel() {
  return read("XAI_MODEL") ?? "grok-4.3";
}

/** Cheap model for FAQ / outreach close. Fast slugs retired May 2026 → grok-4.3 + max_tokens. */
export function xaiFastModel() {
  return read("XAI_FAST_MODEL") ?? "grok-4.20-0309-non-reasoning";
}

export function dataforseoLogin() {
  return read("DATAFORSEO_LOGIN");
}

export function dataforseoPassword() {
  return read("DATAFORSEO_PASSWORD");
}

export function inspectMaxDepth() {
  const n = Number(read("INSPECT_MAX_DEPTH") ?? 150);
  if (!Number.isFinite(n) || n < 10) return 150;
  return Math.min(Math.floor(n), 4490);
}

export function babyrockWhatsappDisplay() {
  return read("BABYROCK_WHATSAPP_DISPLAY") ?? read("BABYROCK_WHATSAPP_E164");
}

export function inspectWindowMonths() {
  const n = Number(read("INSPECT_WINDOW_MONTHS") ?? 6);
  if (!Number.isFinite(n) || n < 1) return 6;
  return Math.floor(n);
}

export function stripeSecretKey() {
  return read("STRIPE_SECRET_KEY");
}

export function stripePublishableKey() {
  return read("STRIPE_PUBLISHABLE_KEY");
}

export function stripeWebhookSecret() {
  return read("STRIPE_WEBHOOK_SECRET");
}

export function stripeMode(): "test" | "live" | "off" {
  const secret = stripeSecretKey();
  if (!secret) return "off";
  if (secret.startsWith("sk_live_")) return "live";
  return "test";
}

export function appUrl() {
  return read("APP_URL");
}

export function siteUrl() {
  return read("SITE_URL") ?? "https://www.babyrock.ai";
}

export function founderWhatsapp() {
  return read("FOUNDER_WHATSAPP");
}

export function gbpClientId() {
  return read("GOOGLE_GBP_CLIENT_ID");
}

export function gbpClientSecret() {
  return read("GOOGLE_GBP_CLIENT_SECRET");
}

export function gbpRefreshToken() {
  return read("GOOGLE_GBP_REFRESH_TOKEN");
}

export function gbpAccountName() {
  return read("GOOGLE_GBP_ACCOUNT_NAME");
}
