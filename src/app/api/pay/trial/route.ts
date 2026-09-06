import { NextResponse } from "next/server";
import { PayAuthError } from "@/lib/pay-access";
import { createTrialSantCugat, payCorsHeaders, str } from "@/lib/pay";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: payCorsHeaders(req) });
}

export async function POST(req: Request) {
  const headers = payCorsHeaders(req);
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  try {
    if (body.acceptedTerms !== true) {
      return NextResponse.json({ error: "Debe aceptar las condiciones" }, { status: 400, headers });
    }
    const trial = await createTrialSantCugat({
      clientId: str(body.clientId),
      capability: str(body.capability),
      idempotencyKey: str(body.idempotencyKey) ?? req.headers.get("idempotency-key"),
      name: str(body.name),
      email: str(body.email),
      city: str(body.city),
      whatsapp: str(body.whatsapp),
      mapsUri: str(body.mapsUri),
      legalName: str(body.legalName),
      taxId: str(body.taxId),
      billingEmail: str(body.billingEmail) ?? str(body.email),
      billingLine1: str(body.billingLine1),
      billingPostcode: str(body.billingPostcode),
      billingCity: str(body.billingCity) ?? str(body.city),
      billingCountry: str(body.billingCountry) ?? "ES",
    });
    return NextResponse.json({ ok: true, ...trial }, { headers });
  } catch (e) {
    const status = e instanceof PayAuthError ? e.status : 400;
    const message = e instanceof Error ? e.message : "échec essai";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
