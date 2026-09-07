import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeWebhookSecret } from "@/lib/env";
import { fulfillCheckoutSession, fulfillPaidInvoice, markSubscriptionDeleted, retrieveCheckout } from "@/lib/pay";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET manquant" }, { status: 503 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "signature manquante" }, { status: 400 });

  const raw = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "signature invalide";
    console.warn("stripe webhook signature", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const id = (event.data.object as { id?: string }).id;
      if (!id) return NextResponse.json({ error: "session id manquant" }, { status: 400 });
      const session = await retrieveCheckout(id);
      const result = await fulfillCheckoutSession(session);
      console.log("stripe webhook", event.type, result);
    } else if (event.type === "invoice.paid") {
      const result = await fulfillPaidInvoice(event.data.object as Stripe.Invoice);
      console.log("stripe webhook invoice.paid", result);
    } else if (event.type === "customer.subscription.deleted") {
      const id = (event.data.object as { id?: string }).id;
      if (id) await markSubscriptionDeleted(id);
    } else if (event.type === "checkout.session.async_payment_failed") {
      console.warn("stripe webhook async payment failed", (event.data.object as { id?: string }).id);
    }
  } catch (e) {
    console.warn("stripe webhook handler", e);
    return NextResponse.json({ error: "handler" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
