import { isPaidClient } from "./billing-state";

export const REVIEW_FLOOR = 50;
export const REPLY_RATE_MAX = 0.15;
export { isPaidClient };

export type PipelineStatus =
  | "in_scope"
  | "pitchable"
  | "needs_contact"
  | "draft"
  | "approved"
  | "sent"
  | "failed"
  | "replied"
  | "stop"
  | "paid";

export function googleReplyRate(lead: {
  inspectReviews6m: number | null;
  inspectReplied6m: number | null;
}) {
  const n = lead.inspectReviews6m ?? 0;
  if (n <= 0) return null;
  return (lead.inspectReplied6m ?? 0) / n;
}

export function hasTo(lead: { email: string | null; outreachTo: string | null; waSite: string | null }) {
  return Boolean((lead.outreachTo || lead.email || lead.waSite)?.trim());
}

export function isPitchable(lead: {
  userRatingCount: number | null;
  inspectReviews6m: number | null;
  inspectReplied6m: number | null;
  inspectVerdict: string | null;
}) {
  if ((lead.userRatingCount ?? 0) < REVIEW_FLOOR) return false;
  if (lead.inspectVerdict === "orphan") return true;
  const rate = googleReplyRate(lead);
  if (rate == null) return false;
  return rate < REPLY_RATE_MAX;
}

export function pipelineStatus(
  lead: {
    source: string;
    email: string | null;
    outreachTo: string | null;
    waSite: string | null;
    outreachStatus: string | null;
    outreachBody: string | null;
    userRatingCount: number | null;
    inspectReviews6m: number | null;
    inspectReplied6m: number | null;
    inspectVerdict: string | null;
  },
  client: { status: string; stripeCustomerId?: string | null } | null,
  inboxStatus?: string | null,
): PipelineStatus {
  if (isPaidClient(client)) return "paid";
  if (inboxStatus === "stop" || lead.outreachStatus === "stop") return "stop";
  if (inboxStatus === "ok" || lead.outreachStatus === "replied") return "replied";
  if (lead.outreachStatus === "sent") return "sent";
  if (lead.outreachStatus === "failed") return "failed";
  if (lead.outreachStatus === "approved") return "approved";
  if (lead.outreachBody?.trim()) return "draft";
  const pitch = isPitchable(lead) || lead.source === "inbound";
  if (pitch && !hasTo(lead)) return "needs_contact";
  if (isPitchable(lead)) return "pitchable";
  return "in_scope";
}
