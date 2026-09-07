import { NextResponse } from "next/server";
import { PayAuthError } from "@/lib/pay-access";
import { payCorsHeaders, startPayRegistration, str } from "@/lib/pay";

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
  const name = str(body.name);
  const email = str(body.email);
  const city = str(body.city);
  const whatsapp = str(body.whatsapp);
  if (!name) return NextResponse.json({ error: "Falta el nombre del comercio" }, { status: 400, headers });
  if (!email) return NextResponse.json({ error: "Falta el correo" }, { status: 400, headers });
  if (!city) return NextResponse.json({ error: "Falta la ciudad" }, { status: 400, headers });
  if (!whatsapp || whatsapp.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "Falta el WhatsApp" }, { status: 400, headers });
  }
  const company = body.companyInvoice === true;
  try {
    const started = await startPayRegistration({
      name,
      email,
      city,
      whatsapp,
      mapsUri: str(body.mapsUri),
      legalName: company ? str(body.legalName) : null,
      taxId: company ? str(body.taxId) : null,
      billingEmail: email,
      billingLine1: company ? str(body.billingLine1) : null,
      billingPostcode: company ? str(body.billingPostcode) : null,
      billingCity: city,
      billingCountry: str(body.billingCountry) ?? "ES",
      idempotencyKey: str(body.idempotencyKey) ?? req.headers.get("idempotency-key"),
    });
    return NextResponse.json(
      { clientId: started.clientId, registrationId: started.registrationId, capability: started.capability },
      { headers },
    );
  } catch (e) {
    const status = e instanceof PayAuthError ? e.status : 400;
    const message = e instanceof Error ? e.message : "No se ha podido registrar";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
