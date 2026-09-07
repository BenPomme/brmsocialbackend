import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, siteUrl, stripeMode } from "./env";
import { isSantCugat, SANT_CUGAT_OFFER } from "./offers";
import { IVA_PERCENT, skuForPlan, splitTtc, type PayPlanId } from "./skus";
import { getStripe } from "./stripe";
import { continuePayClient, registerPayDraft, type PayAccess } from "./pay-access";
import { servicePeriod } from "./billing-state";

export type { PayPlanId } from "./skus";
export type VatMode = "es_iva" | "eu_reverse";

export function parsePayPlan(raw: unknown): PayPlanId {
  if (raw === "year") return "year";
  if (raw === "trial_santcugat") return "trial_santcugat";
  return "month";
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function originFromRequest(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")).replace(/:$/, "");
  if (host) return `${proto}://${host}`;
  const configured = appUrl();
  if (configured) return configured.replace(/\/$/, "");
  return url.origin;
}

export function payCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = new Set(
    [
      siteUrl(),
      appUrl(),
      process.env.PAY_PUBLIC_URL,
      "http://localhost:3000",
      "http://localhost:3001",
      "https://www.babyrock.ai",
      "https://babyrock.ai",
      "https://pay.babyrock.ai",
      "https://app.babyrock.ai",
    ]
      .filter(Boolean)
      .map((u) => u!.replace(/\/$/, "")),
  );
  const allow = allowed.has(origin) ? origin : siteUrl().replace(/\/$/, "");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export type BillingInput = {
  clientId?: string | null;
  capability?: string | null;
  idempotencyKey?: string | null;
  name?: string | null;
  email?: string | null;
  city?: string | null;
  whatsapp?: string | null;
  mapsUri?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  billingEmail?: string | null;
  billingLine1?: string | null;
  billingPostcode?: string | null;
  billingCity?: string | null;
  billingCountry?: string | null;
};

export function payAccessOf(input: BillingInput, sessionClientId?: string | null): PayAccess {
  return {
    clientId: input.clientId,
    capability: input.capability,
    idempotencyKey: input.idempotencyKey,
    sessionClientId,
  };
}

/** PATCH: omitted or blank fields are left unchanged. */
export function definedBillingPatch(input: BillingInput) {
  const email = (input.billingEmail ?? input.email)?.trim().toLowerCase() || undefined;
  const data: Record<string, string | null | undefined> = {};
  if (input.name?.trim()) data.name = input.name.trim();
  if (input.legalName?.trim()) data.legalName = input.legalName.trim();
  if (input.taxId?.trim()) data.taxId = normalizeTaxId(input.taxId);
  if (email) {
    data.billingEmail = email;
    data.emailPublic = email;
  }
  if (input.billingLine1?.trim()) data.billingLine1 = input.billingLine1.trim();
  if (input.billingPostcode?.trim()) data.billingPostcode = input.billingPostcode.trim();
  if ((input.billingCity ?? input.city)?.trim()) {
    data.billingCity = (input.billingCity ?? input.city)!.trim();
    data.city = (input.city ?? input.billingCity)!.trim();
  }
  if (input.billingCountry?.trim()) {
    const country = input.billingCountry.trim().toUpperCase();
    data.billingCountry = country;
    data.country = country;
  }
  if (input.whatsapp?.trim()) data.whatsappOwner = input.whatsapp.trim();
  if (input.mapsUri?.trim()) data.mapsUri = input.mapsUri.trim();
  if (data.billingCountry || data.taxId) {
    data.vatMode = inferVatMode((data.billingCountry as string | null) ?? null, (data.taxId as string | null) ?? null);
  }
  return data;
}

export function normalizeTaxId(raw: string) {
  return raw.replace(/[\s.]/g, "").toUpperCase();
}

export function inferVatMode(country: string | null, taxId: string | null): VatMode {
  const c = (country ?? "").trim().toUpperCase();
  const t = taxId ? normalizeTaxId(taxId) : "";
  if (c === "FR" || t.startsWith("FR")) return "eu_reverse";
  if (c && c !== "ES" && /^[A-Z]{2}/.test(t) && !t.startsWith("ES")) return "eu_reverse";
  return "es_iva";
}

export function inferTaxIdType(taxId: string): { type: "es_cif" | "eu_vat"; value: string } {
  let value = normalizeTaxId(taxId);
  if (value.startsWith("ES") && value.length > 3) {
    const rest = value.slice(2);
    if (/^[A-Z0-9]/.test(rest)) value = rest;
  }
  if (/^[A-Z]{2}\d/.test(normalizeTaxId(taxId)) && !normalizeTaxId(taxId).startsWith("ES")) {
    return { type: "eu_vat", value: normalizeTaxId(taxId) };
  }
  return { type: "es_cif", value };
}

export function planAmounts(plan: PayPlanId, vatMode: VatMode) {
  const split = splitTtc(skuForPlan(plan).ttc);
  if (vatMode !== "es_iva") return { ht: split.ht, iva: 0, ttc: split.ht };
  return split;
}

export async function resolvePayClient(input: BillingInput & { sessionClientId?: string | null }) {
  return continuePayClient(definedBillingPatch(input), payAccessOf(input, input.sessionClientId));
}

export async function startPayRegistration(input: BillingInput) {
  return registerPayDraft(definedBillingPatch(input), payAccessOf(input));
}

export type InvoiceLinks = {
  id: string | null;
  pdf: string | null;
  hosted: string | null;
};

export function invoiceFromSession(session: Stripe.Checkout.Session): InvoiceLinks {
  const empty: InvoiceLinks = { id: null, pdf: null, hosted: null };
  const inv = session.invoice;
  if (!inv) return empty;
  if (typeof inv === "string") return { ...empty, id: inv };
  if ("deleted" in inv && inv.deleted) return { ...empty, id: inv.id };
  return {
    id: inv.id,
    pdf: "invoice_pdf" in inv ? (inv.invoice_pdf ?? null) : null,
    hosted: "hosted_invoice_url" in inv ? (inv.hosted_invoice_url ?? null) : null,
  };
}

export async function retrieveCheckout(sessionId: string) {
  return getStripe().checkout.sessions.retrieve(sessionId, { expand: ["invoice"] });
}

export async function resolveInvoice(session: Stripe.Checkout.Session): Promise<InvoiceLinks> {
  const fromSession = invoiceFromSession(session);
  if (fromSession.pdf || fromSession.hosted) return fromSession;
  const id = fromSession.id;
  if (!id) return fromSession;
  const inv = await getStripe().invoices.retrieve(id);
  return { id: inv.id, pdf: inv.invoice_pdf ?? null, hosted: inv.hosted_invoice_url ?? null };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Checkout puts the invoice on the session a moment after payment. */
export async function waitForInvoice(sessionId: string, attempts = 12) {
  let session = await retrieveCheckout(sessionId);
  let invoice = await resolveInvoice(session);
  for (let i = 0; i < attempts && !(invoice.pdf || invoice.hosted); i++) {
    await sleep(400);
    session = await retrieveCheckout(sessionId);
    invoice = await resolveInvoice(session);
  }
  return { session, invoice };
}

function subscriptionIdOf(session: Stripe.Checkout.Session) {
  const sub = session.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const trialCheckout = session.mode === "subscription" && session.metadata?.trial === "santcugat";
  const okStatus =
    session.payment_status === "paid" ||
    (session.mode === "subscription" && (session.payment_status === "no_payment_required" || trialCheckout));
  if (!okStatus) {
    return { ok: false as const, reason: "not_paid" as const, paymentStatus: session.payment_status };
  }
  if (!session.livemode && stripeMode() === "live") {
    return { ok: false as const, reason: "test_payment_in_live" as const };
  }
  const clientId = session.client_reference_id || session.metadata?.clientId || null;
  if (!clientId) return { ok: false as const, reason: "no_client" as const };

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false as const, reason: "client_missing" as const };

  const invoice = await resolveInvoice(session);
  const ids = [session.id, invoice.id].filter((x): x is string => Boolean(x));
  const existing = await prisma.paymentEvidence.findFirst({
    where: { provider: "stripe", providerPaymentId: { in: ids } },
  });
  if (existing) {
    return { ok: true as const, clientId: client.id, already: true as const, invoice };
  }

  const plan = session.metadata?.plan === "avis_year" || session.metadata?.plan === "year" ? "year" : "month";
  const now = new Date();
  const period = servicePeriod({
    plan: trialCheckout ? "trial_santcugat" : plan,
    from: now,
    trialEndsAt: trialCheckout ? new Date(now.getTime() + SANT_CUGAT_OFFER.trialDays * 24 * 60 * 60 * 1000) : null,
  });
  const email = session.customer_details?.email ?? client.billingEmail ?? client.emailPublic;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? client.stripeCustomerId;
  const subId = subscriptionIdOf(session);
  const evidenceId = invoice.id ?? session.id;
  const nextStatus = trialCheckout && session.payment_status !== "paid" ? "essai" : "paye";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvidence.create({
        data: {
          clientId: client.id,
          provider: "stripe",
          providerPaymentId: evidenceId,
          product: "social",
          interval: period.interval,
          amount: session.amount_total ?? null,
          currency: session.currency ?? "eur",
          livemode: session.livemode,
          periodStart: period.start,
          periodEnd: period.end,
        },
      });
      await tx.client.update({
        where: { id: client.id },
        data: {
          status: nextStatus,
          plan: plan === "year" ? "avis_year" : "avis_month",
          trialEndsAt: nextStatus === "essai" ? period.end : null,
          offer: trialCheckout ? SANT_CUGAT_OFFER.id : client.offer,
          stripeOrBizumRef: session.id,
          emailPublic: email,
          billingEmail: email,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
          stripeInvoiceId: invoice.id,
        },
      });
      await tx.lead.updateMany({
        where: { clientId: client.id },
        data: { status: "paid" },
      });
      await tx.action.create({
        data: {
          clientId: client.id,
          type: "billing",
          actor: "stripe",
          result: "ok",
          payload: {
            event: "checkout_paid",
            sessionId: session.id,
            invoiceId: invoice.id,
            plan,
            amount: session.amount_total,
            currency: session.currency,
            vatMode: session.metadata?.vatMode ?? client.vatMode,
            livemode: session.livemode,
            paymentStatus: session.payment_status,
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: true as const, clientId: client.id, already: true as const, invoice };
    }
    throw e;
  }

  const mailed = await deliverInvoiceEmail({
    to: email,
    legalName: client.legalName ?? client.name,
    taxId: client.taxId,
    amount: session.amount_total,
    invoice,
    livemode: session.livemode,
  });

  try {
    const { linkThreadToClient, emitRosaliaEvent } = await import("./rosalia-reply");
    await linkThreadToClient(client.id);
    await emitRosaliaEvent({
      clientId: client.id,
      event: { type: "payment_confirmed", via: nextStatus === "essai" ? "trial" : "stripe" },
    });
    const fresh = await prisma.client.findUnique({ where: { id: client.id } });
    if (fresh?.managerInviteStatus === "accepted") {
      const { importCatchupReviews } = await import("./catchup-reviews");
      await importCatchupReviews(client.id).catch((err) => console.warn("catchup after pay", err));
    }
  } catch (e) {
    console.warn("rosalia payment_confirmed", e);
  }

  return { ok: true as const, clientId: client.id, already: false as const, invoice, mailed };
}

export async function fulfillPaidInvoice(invoice: Stripe.Invoice) {
  if (invoice.status !== "paid") {
    return { ok: false as const, reason: "not_paid" as const };
  }
  if (!invoice.livemode && stripeMode() === "live") {
    return { ok: false as const, reason: "test_payment_in_live" as const };
  }
  const sub = (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }).subscription;
  const subId = typeof sub === "string" ? sub : sub && typeof sub === "object" ? sub.id : null;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        ...(subId ? [{ stripeSubscriptionId: subId }] : []),
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
  });
  if (!client) return { ok: false as const, reason: "client_missing" as const };

  const existing = await prisma.paymentEvidence.findUnique({
    where: { provider_providerPaymentId: { provider: "stripe", providerPaymentId: invoice.id } },
  });
  if (existing) return { ok: true as const, clientId: client.id, already: true as const };

  const line = invoice.lines.data[0] as { price?: { recurring?: { interval?: string } | null } | null } | undefined;
  const interval = line?.price?.recurring?.interval === "year" ? "year" : "month";
  const periodStartUnix = (invoice as Stripe.Invoice & { period_start?: number }).period_start;
  const period = servicePeriod({ plan: interval, from: new Date((periodStartUnix ?? 0) * 1000 || Date.now()) });
  await prisma.$transaction(async (tx) => {
    await tx.paymentEvidence.create({
      data: {
        clientId: client.id,
        provider: "stripe",
        providerPaymentId: invoice.id,
        product: "social",
        interval: period.interval,
        amount: invoice.amount_paid ?? null,
        currency: invoice.currency ?? "eur",
        livemode: invoice.livemode,
        periodStart: period.start,
        periodEnd: period.end,
      },
    });
    await tx.client.update({
      where: { id: client.id },
      data: {
        status: "paye",
        trialEndsAt: null,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subId ?? client.stripeSubscriptionId,
      },
    });
  });
  return { ok: true as const, clientId: client.id, already: false as const };
}

export async function cancelStripeSubscription(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client?.stripeSubscriptionId) return { ok: false as const, reason: "no_subscription" as const };
  const sub = await getStripe().subscriptions.update(client.stripeSubscriptionId, { cancel_at_period_end: true });
  await prisma.client.update({ where: { id: client.id }, data: { status: "pause" } });
  await prisma.action.create({
    data: {
      clientId: client.id,
      type: "billing",
      actor: "stripe",
      result: "ok",
      payload: { event: "cancel_at_period_end", subscriptionId: sub.id, cancelAt: sub.cancel_at },
    },
  });
  return { ok: true as const, cancelAt: sub.cancel_at };
}

export async function markSubscriptionDeleted(subscriptionId: string) {
  const client = await prisma.client.findFirst({ where: { stripeSubscriptionId: subscriptionId } });
  if (!client) return { ok: false as const };
  await prisma.client.update({ where: { id: client.id }, data: { status: "resilie" } });
  return { ok: true as const, clientId: client.id };
}

export async function deliverInvoiceEmail(opts: {
  to: string | null;
  legalName: string;
  taxId: string | null;
  amount: number | null;
  invoice: InvoiceLinks;
  livemode: boolean;
}) {
  const to = opts.to?.trim() ?? "";
  if (!to) return { stripe: false, zoho: false as const, reason: "no_email" as const };

  let stripeSent = false;
  if (opts.invoice.id) {
    try {
      await getStripe().invoices.sendInvoice(opts.invoice.id);
      stripeSent = true;
    } catch (e) {
      console.warn("stripe sendInvoice", e instanceof Error ? e.message : e);
    }
  }

  let zohoSent = false;
  try {
    const { isAllowlisted, sendZohoMail } = await import("./zoho-mail");
    if (!isAllowlisted(to)) {
      return { stripe: stripeSent, zoho: false as const, reason: "not_allowlisted" as const };
    }
    const euros = opts.amount != null ? `${(opts.amount / 100).toFixed(2)} €` : "";
    const hosted = opts.invoice.hosted ?? "";
    const pdf = opts.invoice.pdf ?? "";
    await sendZohoMail({
      to,
      subject: `Factura Babyrock Social — ${opts.legalName} ${euros}`.trim(),
      mailFormat: "html",
      content: [
        `<p>Hola,</p>`,
        `<p>Pago recibido para <strong>${opts.legalName}</strong>${opts.taxId ? ` (NIF/CIF ${opts.taxId})` : ""}.</p>`,
        `<p>Importe: <strong>${euros}</strong></p>`,
        hosted ? `<p><a href="${hosted}">Ver factura</a></p>` : "",
        pdf ? `<p><a href="${pdf}">Descargar PDF</a></p>` : "",
        `<p>Stripe en modo test no envía el correo solo. En live, Stripe lo mandará al correo de facturación si está activado en el Dashboard (Successful payments).</p>`,
        `<p>— Rosalia, Babyrock Social</p>`,
      ].join(""),
    });
    zohoSent = true;
  } catch (e) {
    console.warn("invoice zoho mail", e instanceof Error ? e.message : e);
  }

  return { stripe: stripeSent, zoho: zohoSent, reason: zohoSent ? ("sent" as const) : ("zoho_failed" as const) };
}

async function ensureStripeCustomer(client: {
  id: string;
  stripeCustomerId: string | null;
  legalName: string | null;
  name: string;
  billingEmail: string | null;
  emailPublic: string | null;
  billingLine1: string | null;
  billingPostcode: string | null;
  billingCity: string | null;
  billingCountry: string | null;
  taxId: string | null;
}) {
  const stripe = getStripe();
  const email = client.billingEmail ?? client.emailPublic ?? undefined;
  const name = client.legalName ?? client.name;
  const address =
    client.billingLine1 && client.billingCountry
      ? {
          line1: client.billingLine1,
          postal_code: client.billingPostcode ?? undefined,
          city: client.billingCity ?? undefined,
          country: client.billingCountry,
        }
      : undefined;

  let customerId = client.stripeCustomerId;
  if (customerId) {
    await stripe.customers.update(customerId, { name, email, address });
  } else {
    const created = await stripe.customers.create({
      name,
      email,
      address,
      metadata: { clientId: client.id },
    });
    customerId = created.id;
    await prisma.client.update({ where: { id: client.id }, data: { stripeCustomerId: customerId } });
  }

  if (client.taxId) {
    const { type, value } = inferTaxIdType(client.taxId);
    const existing = await stripe.customers.listTaxIds(customerId, { limit: 10 });
    const already = existing.data.some((t) => t.value === value);
    if (!already) {
      try {
        await stripe.customers.createTaxId(customerId, { type, value });
      } catch (e) {
        console.warn("stripe tax_id rejected", type, value, e instanceof Error ? e.message : e);
      }
    }
  }
  return customerId;
}

export async function createTrialSantCugat(opts: BillingInput) {
  if (!(opts.billingEmail ?? opts.email)?.trim()) throw new Error("Falta el correo");
  if (!(opts.name ?? opts.legalName)?.trim()) throw new Error("Falta el nombre del comercio");
  const wa = (opts.whatsapp ?? "").replace(/\D/g, "");
  if (wa.length < 9) throw new Error("Falta el WhatsApp");
  if (opts.taxId || opts.legalName) {
    if (!opts.legalName?.trim()) throw new Error("Falta la razón social");
    if (!opts.taxId?.trim()) throw new Error("Falta el NIF/CIF");
    if (!opts.billingLine1?.trim()) throw new Error("Falta la dirección fiscal");
  }
  const city = opts.billingCity ?? opts.city;
  if (!isSantCugat(city)) {
    throw new Error("El mes gratis solo vale para Sant Cugat del Vallès");
  }

  const trialEndsAt = new Date(Date.now() + SANT_CUGAT_OFFER.trialDays * 24 * 60 * 60 * 1000);
  const client = await resolvePayClient(opts);
  const evidenceId = `trial:${client.id}:${SANT_CUGAT_OFFER.id}`;
  const already = await prisma.paymentEvidence.findUnique({
    where: { provider_providerPaymentId: { provider: "trial", providerPaymentId: evidenceId } },
  });
  if (already) {
    const existing = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    return {
      clientId: existing.id,
      trialEndsAt: existing.trialEndsAt ?? trialEndsAt,
      catchupMonths: existing.catchupMonths ?? SANT_CUGAT_OFFER.catchupMonths,
    };
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.paymentEvidence.create({
      data: {
        clientId: client.id,
        provider: "trial",
        providerPaymentId: evidenceId,
        product: "social",
        interval: "trial",
        amount: 0,
        currency: "eur",
        livemode: false,
        periodStart: now,
        periodEnd: trialEndsAt,
      },
    });
    const row = await tx.client.update({
      where: { id: client.id },
      data: {
        plan: "avis_month",
        status: "essai",
        offer: SANT_CUGAT_OFFER.id,
        trialEndsAt,
        catchupMonths: SANT_CUGAT_OFFER.catchupMonths,
        city: city?.trim() || "Sant Cugat del Vallès",
      },
    });
    await tx.action.create({
      data: {
        clientId: row.id,
        type: "billing",
        actor: "offer",
        result: "ok",
        payload: {
          event: "trial_started",
          offer: SANT_CUGAT_OFFER.id,
          trialEndsAt: trialEndsAt.toISOString(),
          catchupMonths: SANT_CUGAT_OFFER.catchupMonths,
          thenSku: SANT_CUGAT_OFFER.thenSku,
          amount: 0,
        },
      },
    });
    return row;
  });
  try {
    const { linkThreadToClient, emitRosaliaEvent } = await import("./rosalia-reply");
    await linkThreadToClient(updated.id);
    await emitRosaliaEvent({ clientId: updated.id, event: { type: "payment_confirmed", via: "trial" } });
    const fresh = await prisma.client.findUnique({ where: { id: updated.id } });
    if (fresh?.managerInviteStatus === "accepted") {
      const { importCatchupReviews } = await import("./catchup-reviews");
      await importCatchupReviews(updated.id).catch((err) => console.warn("catchup after trial", err));
    }
  } catch (e) {
    console.warn("rosalia trial_started", e);
  }

  return {
    clientId: updated.id,
    trialEndsAt,
    catchupMonths: SANT_CUGAT_OFFER.catchupMonths,
  };
}

export async function createCheckoutSession(opts: BillingInput & { req: Request; plan: PayPlanId }) {
  if (opts.plan === "trial_santcugat") {
    const city = opts.billingCity ?? opts.city;
    if (!isSantCugat(city)) throw new Error("El mes gratis solo vale para Sant Cugat del Vallès");
  }
  if (!(opts.billingEmail ?? opts.email)?.trim()) throw new Error("Falta el correo");
  if (!(opts.name ?? opts.legalName)?.trim()) throw new Error("Falta el nombre del comercio");
  const wa = (opts.whatsapp ?? "").replace(/\D/g, "");
  if (wa.length < 9) throw new Error("Falta el WhatsApp");
  if (opts.taxId || opts.legalName) {
    if (!opts.legalName?.trim()) throw new Error("Falta la razón social");
    if (!opts.taxId?.trim()) throw new Error("Falta el NIF/CIF");
    if (!opts.billingLine1?.trim()) throw new Error("Falta la dirección fiscal");
  }

  const sku = skuForPlan(opts.plan);
  const client = await resolvePayClient(opts);
  const vatMode = (client.vatMode as VatMode) || inferVatMode(client.billingCountry, client.taxId);
  const amounts = planAmounts(opts.plan === "trial_santcugat" ? "month" : opts.plan, vatMode);
  const origin = originFromRequest(opts.req);
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(client);
  const interval = sku.interval;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: amounts.ht,
        recurring: { interval },
        product_data: { name: sku.label, description: sku.description },
      },
    },
  ];
  if (amounts.iva > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: amounts.iva,
        recurring: { interval },
        product_data: {
          name: `IVA ${IVA_PERCENT} %`,
          description: "IVA español 21 %. Deducible si su empresa está en ES.",
        },
      },
    });
  }

  const trialDays = opts.plan === "trial_santcugat" ? SANT_CUGAT_OFFER.trialDays : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    locale: "es",
    customer: customerId,
    customer_update: { name: "auto", address: "auto" },
    billing_address_collection: opts.taxId || opts.legalName ? "auto" : "required",
    client_reference_id: client.id,
    metadata: {
      clientId: client.id,
      plan: sku.id,
      sku: sku.lookupKey,
      vatMode,
      source: "factory",
      trial: trialDays ? "santcugat" : "",
    },
    subscription_data: {
      metadata: { clientId: client.id, plan: sku.id, sku: sku.lookupKey },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    line_items: lineItems,
    success_url: `${origin}/pay/ok?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pay?canceled=1&client=${client.id}`,
  });

  await prisma.action.create({
    data: {
      clientId: client.id,
      type: "billing",
      actor: "stripe",
      result: "ok",
      payload: {
        event: "checkout_created",
        sessionId: session.id,
        plan: sku.id,
        sku: sku.lookupKey,
        amount: amounts.ttc,
        vatMode,
        taxId: client.taxId,
      },
    },
  });

  if (!session.url) throw new Error("Stripe n’a pas renvoyé d’URL Checkout");
  return {
    url: session.url,
    sessionId: session.id,
    clientId: client.id,
    amountTtc: amounts.ttc,
    vatMode,
  };
}
