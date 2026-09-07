import type { CatalogQuote } from "../catalog";

export type ConvoLang = "es" | "ca" | "en" | "fr";

export type ThreadPhase = "outreach" | "awaiting_pay" | "onboarding" | "active" | "stopped";

export type OnboardingStep = "maps" | "people" | "email" | "role" | "wait_google" | "done";

export type InboundKind = "ok" | "stop" | "phone" | "text";

export type RosaliaEvent =
  | { type: "inbound_text"; text: string; messageId?: string }
  | { type: "inbound_media"; media: "image" | "audio" | "video" | "sticker" | "document" | "other" }
  | { type: "payment_confirmed"; via: "stripe" | "trial" }
  | { type: "manager_connected" }
  | { type: "manager_owner_declined" }
  | {
      type: "low_star";
      avisId: string;
      stars: number;
      author: string | null;
      lang: string | null;
      body: string;
      draft: string;
    }
  | { type: "fiche_alert"; body: string }
  | { type: "monday_recap"; body: string };

export type SendPolicy = "reply" | "if_window";

export type ClientReplyApply = "ok" | "text" | "cerrado" | "baja" | null;

export type DecideInput = {
  event: RosaliaEvent;
  outboundBodies: string[];
  firstName?: string | null;
  preferredLang?: ConvoLang | null;
  phase: ThreadPhase;
  onboardingStep: OnboardingStep | null;
  clientStatus: string | null;
  managerInviteStatus: string | null;
  city: string | null;
  lastInboundAt: Date | null;
  payUrl: string;
  pendingLowStar?: boolean;
  invoiceUrl?: string | null;
  now?: Date;
};

export type RosaliaDecision = {
  kind: InboundKind;
  source: "template" | "off_script";
  faqId: string;
  body: string;
  status: string;
  lang: ConvoLang;
  phase: ThreadPhase;
  onboardingStep: OnboardingStep | null;
  sendPolicy: SendPolicy;
  applyClientReply: ClientReplyApply;
  city: string | null;
  quote: CatalogQuote;
};
