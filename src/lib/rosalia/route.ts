import { onboardCopyId, SCRIPT_IDS } from "./copy";
import type { OnboardingStep, ThreadPhase } from "./types";

const NEXT: Record<string, string> = {
  maps: "onboard_people",
  people: "onboard_email",
  email: "onboard_role",
  role: "onboard_wait",
  wait_google: "onboard_wait",
};

export function tooSimilar(a: string, b: string) {
  const na = a.replace(/\s+/g, " ").trim().toLowerCase();
  const nb = b.replace(/\s+/g, " ").trim().toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const head = na.slice(0, 60);
  return head.length >= 40 && nb.includes(head);
}

export function repeats(body: string, outbound: string[]) {
  return outbound.slice(-4).some((b) => tooSimilar(body, b));
}

/** If the model re-picks the step we just sent, bump forward unless they asked about that step. */
export function coerceRoute(
  route: string,
  step: OnboardingStep | null,
  inbound: string,
  phase?: ThreadPhase,
): string {
  if (phase === "stopped") return "human";
  if (!step || step === "done") return route;
  if (route === "human" || route === "stop" || route === "fallback" || route === "baja_active") {
    return route;
  }
  if (!route.startsWith("onboard_")) return route;
  const next = NEXT[step] ?? "human";
  const cur = onboardCopyId(step);
  const askingThis =
    /\b(email|maps|people|password|reviews@|gestor|lápiz|pencil|invite)\b/i.test(inbound);
  if (route === cur && !askingThis) return next === cur ? "human" : next;
  return next === cur && route === cur ? "human" : route;
}

export function nextOnboard(step: OnboardingStep | null) {
  if (!step || step === "done") return "human";
  const next = NEXT[step] ?? "human";
  return next === onboardCopyId(step) ? "human" : next;
}

export function parseTurn(raw: string): { route: string; reply: string } | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    if (cleaned && !cleaned.startsWith("{")) return { route: "hello", reply: cleaned };
    return null;
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { route?: string; reply?: string };
    const route = String(parsed.route ?? "").trim();
    const reply = String(parsed.reply ?? "").trim();
    if (reply) return { route: route || "hello", reply };
    if (route) return { route, reply: "" };
    return null;
  } catch {
    if (cleaned && !cleaned.startsWith("{")) return { route: "hello", reply: cleaned };
    return null;
  }
}

/** @deprecated use parseTurn */
export function parseRoute(raw: string) {
  const t = parseTurn(raw);
  return t ? { route: t.route } : null;
}

export function isRoutable(id: string) {
  return id === "human" || SCRIPT_IDS.includes(id);
}

export function talkPrompt(opts: {
  lang: string;
  phase: ThreadPhase;
  step: OnboardingStep | null;
  monthLabel: string;
  yearLabel?: string;
  managerEmail: string;
  payUrl: string;
  lastOut: string | null;
  managerInviteStatus?: string | null;
}) {
  const next = opts.step ? NEXT[opts.step] : "onboard_maps";
  const named: Record<string, string> = {
    es: "español (usted)",
    ca: "català (vostè)",
    en: "English",
    fr: "français (vous)",
    de: "Deutsch",
    ar: "العربية",
    ja: "日本語",
    pt: "português",
    it: "italiano",
    und: "the customer's language",
  };
  const langName = named[opts.lang] ?? opts.lang;
  const year = opts.yearLabel ? ` Annual alternative: ${opts.yearLabel}/year.` : "";
  const google = opts.managerInviteStatus === "accepted" ? "Google manager is connected." : "Google manager is NOT connected — do not claim we are live.";
  return `You are Rosalia. You write WhatsApp messages for Babyrock Social. You sound like a colleague, not a bot, not a numbered wizard.
Language: ${langName}. Two or three short sentences. No "Step N". No "Reply YES when…". No "I'll pass this to a colleague" unless you truly cannot help.
Facts (never invent others): BabyRock Social = Google review replies, ${opts.monthLabel}/month.${year} Invite ${opts.managerEmail} as Manager, not Owner, no password. Direct / Instagram / SEO are not for sale. Pay link only if they need it: ${opts.payUrl}. ${google}
Where you are: phase ${opts.phase}, gestor ${opts.step ?? "none"} (maps → people → email → role → wait). If they just confirmed this step, set route to "${next}".
If they ask something else, answer it, then one line on the next useful action.
If you don't know, or a person must decide, set route "human" and keep reply to one short acknowledgement.
Do not repeat or paraphrase your last message:
${opts.lastOut || "(none)"}
JSON only: {"route":"<script id or human>","reply":"<the exact WhatsApp text>"}.
reply is required and is what they read.`;
}
