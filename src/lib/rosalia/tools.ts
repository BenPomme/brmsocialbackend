import { isCommercialOk, quoteFor, resolveQuoteCity } from "../catalog";
import { isSantCugat } from "../offers";
import { isPaidClient } from "../billing-state";
import { prisma } from "../db";
import { IVA_PERCENT, splitTtc, SKUS } from "../skus";

export const TOOL_IDS = [
  "get_catalog_quote",
  "create_checkout",
  "get_invoice",
  "cancel_service",
  "create_support_case",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export function isToolId(v: string): v is ToolId {
  return (TOOL_IDS as readonly string[]).includes(v);
}

export type ToolCtx = {
  threadId: string;
  clientId: string | null;
  counterparty: string;
  knownCity: string | null;
  inbound: string;
  actor: string;
  payUrlFor: (city: string | null) => string;
};

/** Sant Cugat offer only if the known shop city or the customer text says so — not a model-invented city. */
export function validatedQuoteCity(opts: { claimed?: string | null; knownCity: string | null; inbound: string }) {
  if (isSantCugat(opts.knownCity)) return opts.knownCity!.trim();
  if (isSantCugat(opts.inbound)) return "Sant Cugat del Vallès";
  if (isSantCugat(opts.claimed) && isSantCugat(opts.inbound)) return "Sant Cugat del Vallès";
  return resolveQuoteCity({ city: opts.knownCity, inbound: opts.inbound });
}

export function catalogQuoteResult(city: string | null) {
  const quote = quoteFor({ city });
  const month = splitTtc(SKUS.avis_month.ttc);
  const year = splitTtc(SKUS.avis_year.ttc);
  return {
    product: quote.productName,
    productId: quote.productId,
    monthTtc: quote.monthTtc,
    yearTtc: quote.yearTtc,
    monthHt: month.ht,
    yearHt: year.ht,
    ivaPercent: IVA_PERCENT,
    monthLabel: quote.monthLabel,
    yearLabel: quote.yearLabel,
    offer: quote.offer,
    comingSoon: quote.comingSoon,
    managerEmail: quote.managerEmail,
    checkoutPath: "/pay",
  };
}

export async function runRosaliaTool(
  id: ToolId,
  args: Record<string, unknown>,
  ctx: ToolCtx,
): Promise<{ ok: boolean; fact: Record<string, unknown>; speak: string }> {
  if (id === "get_catalog_quote") {
    const city = validatedQuoteCity({
      claimed: typeof args.city === "string" ? args.city : null,
      knownCity: ctx.knownCity,
      inbound: ctx.inbound,
    });
    const q = catalogQuoteResult(city);
    const url = ctx.payUrlFor(city);
    return {
      ok: true,
      fact: { ...q, checkoutUrl: url, city },
      speak: `${q.product}: ${q.monthLabel}/month or ${q.yearLabel}/year.${q.offer ? " Sant Cugat first month 0 €." : ""} Pay: ${url}`,
    };
  }

  if (id === "create_checkout") {
    const city = validatedQuoteCity({
      claimed: typeof args.city === "string" ? args.city : null,
      knownCity: ctx.knownCity,
      inbound: ctx.inbound,
    });
    const url = ctx.payUrlFor(city);
    return { ok: true, fact: { checkoutUrl: url, livemode: false }, speak: url };
  }

  if (id === "get_invoice") {
    if (!ctx.clientId) {
      return { ok: false, fact: { found: false }, speak: "No invoice on file for this chat." };
    }
    const client = await prisma.client.findUnique({
      where: { id: ctx.clientId },
      include: { paymentEvidence: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!client || !isPaidClient(client)) {
      return { ok: false, fact: { found: false }, speak: "Payment is not confirmed yet. Use the pay link." };
    }
    const ev = client.paymentEvidence[0];
    return {
      ok: true,
      fact: {
        found: true,
        stripeInvoiceId: client.stripeInvoiceId,
        evidenceId: ev?.id ?? null,
        interval: ev?.interval ?? null,
      },
      speak: client.stripeInvoiceId
        ? `Invoice ${client.stripeInvoiceId} is on the billing email.`
        : "Payment is on file. The Stripe PDF goes to the billing email.",
    };
  }

  if (id === "cancel_service") {
    if (!ctx.clientId) {
      return { ok: false, fact: { canceled: false }, speak: "No Paid Account on this chat to cancel." };
    }
    const client = await prisma.client.findUnique({ where: { id: ctx.clientId } });
    if (!client || !isCommercialOk(client.status)) {
      return { ok: false, fact: { canceled: false }, speak: "There is no active paid period to stop." };
    }
    const { cancelStripeSubscription } = await import("../pay");
    await cancelStripeSubscription(client.id).catch(() => null);
    await prisma.client.update({ where: { id: client.id }, data: { status: "pause" } });
    await prisma.action.create({
      data: {
        clientId: client.id,
        type: "billing",
        actor: ctx.actor,
        result: "ok",
        payload: { event: "cancel_at_period_end", via: "tool" },
      },
    });
    return { ok: true, fact: { canceled: true, status: "pause" }, speak: "We stop at the end of the period already paid." };
  }

  const summary = typeof args.summary === "string" ? args.summary : ctx.inbound.slice(0, 400);
  const opened = await prisma.supportCase.create({
    data: {
      threadId: ctx.threadId,
      clientId: ctx.clientId,
      category: typeof args.category === "string" ? args.category : "human",
      summary,
      draftReply: typeof args.draftReply === "string" ? args.draftReply : null,
      state: "open",
    },
  });
  return { ok: true, fact: { caseId: opened.id }, speak: "A colleague will take this." };
}

export function groundedReply(spoken: string, toolSpeak: string | null) {
  if (!toolSpeak) return spoken;
  if (!spoken.trim()) return toolSpeak;
  return spoken;
}
