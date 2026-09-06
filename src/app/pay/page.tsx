"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { quoteFor } from "@/lib/catalog";

const DEMO = {
  name: "Cala Sant Cugat",
  legalName: "Cala Sant Cugat S.L.",
  taxId: "B64959740",
  email: "bpommeraud@babyrock.ai",
  billingLine1: "Carrer de la Plaça 1",
  billingPostcode: "08172",
  billingCity: "Sant Cugat del Vallès",
  billingCountry: "ES",
  whatsapp: "",
};

function PayForm() {
  const params = useSearchParams();
  const [step, setStep] = useState<1 | 2>(params.get("client") ? 2 : 1);
  const [plan, setPlan] = useState(
    params.get("plan") === "year" ? "year" : params.get("plan") === "trial_santcugat" ? "trial_santcugat" : "month",
  );
  const [name, setName] = useState(params.get("name") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [whatsapp, setWhatsapp] = useState(params.get("wa") ?? "");
  const [billingCity, setBillingCity] = useState(params.get("city") ?? "");
  const [companyInvoice, setCompanyInvoice] = useState(false);
  const [legalName, setLegalName] = useState(params.get("legalName") ?? "");
  const [taxId, setTaxId] = useState(params.get("taxId") ?? "");
  const [billingLine1, setBillingLine1] = useState(params.get("line1") ?? "");
  const [billingPostcode, setBillingPostcode] = useState(params.get("cp") ?? "");
  const [billingCountry, setBillingCountry] = useState(params.get("country") ?? "ES");
  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [capability, setCapability] = useState("");
  const [idempotencyKey] = useState(() => {
    try {
      const existing = sessionStorage.getItem("br-pay-idem");
      if (existing) return existing;
      const fresh = crypto.randomUUID();
      sessionStorage.setItem("br-pay-idem", fresh);
      return fresh;
    } catch {
      return crypto.randomUUID();
    }
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canceled = params.get("canceled") === "1";
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("br-pay");
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, string>;
      if (s.name) setName(s.name);
      if (s.email) setEmail(s.email);
      if (s.whatsapp) setWhatsapp(s.whatsapp);
      if (s.city) setBillingCity(s.city);
      if (s.plan) setPlan(s.plan);
      if (s.clientId) setClientId(s.clientId);
      if (s.capability) setCapability(s.capability);
      if (s.companyInvoice === "1") setCompanyInvoice(true);
      if (s.legalName) setLegalName(s.legalName);
      if (s.taxId) setTaxId(s.taxId);
      if (s.line1) setBillingLine1(s.line1);
      if (s.cp) setBillingPostcode(s.cp);
    } catch {
      /* ignore */
    }
  }, []);

  const quote = quoteFor({ city: billingCity });
  const santCugat = Boolean(quote.offer);
  const trial = plan === "trial_santcugat";

  const payload = useMemo(
    () => ({
      clientId: clientId || undefined,
      capability: capability || undefined,
      idempotencyKey,
      plan,
      name,
      email,
      billingEmail: email,
      whatsapp,
      city: billingCity,
      billingCity,
      billingCountry,
      companyInvoice,
      legalName: companyInvoice ? legalName : "",
      taxId: companyInvoice ? taxId : "",
      billingLine1: companyInvoice ? billingLine1 : "",
      billingPostcode: companyInvoice ? billingPostcode : "",
    }),
    [
      clientId,
      capability,
      idempotencyKey,
      plan,
      name,
      email,
      whatsapp,
      billingCity,
      billingCountry,
      companyInvoice,
      legalName,
      taxId,
      billingLine1,
      billingPostcode,
    ],
  );

  function fillDemo() {
    setName(DEMO.name);
    setLegalName(DEMO.legalName);
    setTaxId(DEMO.taxId);
    setEmail(DEMO.email);
    setBillingLine1(DEMO.billingLine1);
    setBillingPostcode(DEMO.billingPostcode);
    setBillingCity(DEMO.billingCity);
    setBillingCountry(DEMO.billingCountry);
    setCompanyInvoice(true);
    setPlan("trial_santcugat");
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/pay/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { clientId?: string; capability?: string; error?: string };
    setPending(false);
    if (!res.ok || !data.clientId || !data.capability) {
      setError(data.error ?? "No se ha podido guardar el registro");
      return;
    }
    setClientId(data.clientId);
    setCapability(data.capability);
    try {
      sessionStorage.setItem(
        "br-pay",
        JSON.stringify({
          ...payload,
          clientId: data.clientId,
          capability: data.capability,
          companyInvoice: companyInvoice ? "1" : "",
          line1: billingLine1,
          cp: billingPostcode,
        }),
      );
    } catch {
      /* ignore */
    }
    setStep(2);
  }

  async function onPay(e: FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("Marque que acepta las condiciones.");
      return;
    }
    setPending(true);
    setError(null);
    const body = { ...payload, clientId, acceptedTerms: true };
    if (trial) {
      const res = await fetch("/api/pay/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { clientId?: string; error?: string };
      if (!res.ok || !data.clientId) {
        setPending(false);
        setError(data.error ?? "No se ha podido abrir el mes gratis");
        return;
      }
      window.location.href = `/pay/essai?client=${data.clientId}`;
      return;
    }
    const res = await fetch("/api/pay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setPending(false);
      setError(data.error ?? "No se ha podido abrir el pago");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <p className="font-display text-4xl mb-2">BabyRock Social</p>
        <p className="text-muted mb-6">
          Respuestas a reseñas de Google. <strong>{quote.monthLabel}</strong> al mes o{" "}
          <strong>{quote.yearLabel}</strong> al año, IVA incluido.
        </p>
        <ol className="flex gap-4 text-sm mb-6">
          <li className={step === 1 ? "font-medium" : "text-muted"}>1. Registro</li>
          <li className={step === 2 ? "font-medium" : "text-muted"}>2. Pago</li>
        </ol>
        {canceled && (
          <p className="text-sm bg-sand border border-line rounded-xl px-4 py-3 mb-4">Pago cancelado. Puede reintentar.</p>
        )}
        {step === 1 ? (
          <form onSubmit={onRegister} className="bg-white/70 border border-line rounded-2xl p-6 shadow-card space-y-4">
            <div className="flex justify-between items-baseline">
              <p className="text-sm font-medium">Su comercio</p>
              <button type="button" className="text-xs underline decoration-line" onClick={fillDemo}>
                Ejemplo Sant Cugat
              </button>
            </div>
            <label className="block text-sm">
              Nombre del comercio
              <input
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Correo
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              WhatsApp
              <input
                type="tel"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+34 600 000 000"
                required
              />
            </label>
            <label className="block text-sm">
              Ciudad
              <input
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Plan
              <select
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                {santCugat || trial ? (
                  <option value="trial_santcugat">Sant Cugat — 1.er mes 0 €, luego {quote.monthLabel}</option>
                ) : null}
                <option value="month">Mes a mes — {quote.monthLabel}</option>
                <option value="year">Doce meses — {quote.yearLabel}</option>
              </select>
            </label>
            <fieldset className="text-sm space-y-2">
              <legend className="font-medium">¿Necesita factura con NIF/CIF?</legend>
              <label className="flex gap-2 items-center">
                <input type="radio" name="company" checked={!companyInvoice} onChange={() => setCompanyInvoice(false)} />
                No
              </label>
              <label className="flex gap-2 items-center">
                <input type="radio" name="company" checked={companyInvoice} onChange={() => setCompanyInvoice(true)} />
                Sí, es una empresa
              </label>
            </fieldset>
            {companyInvoice && (
              <div className="space-y-3 border-t border-line pt-3">
                <label className="block text-sm">
                  Razón social
                  <input
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    required={companyInvoice}
                  />
                </label>
                <label className="block text-sm">
                  NIF / CIF
                  <input
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    required={companyInvoice}
                  />
                </label>
                <label className="block text-sm">
                  Dirección fiscal
                  <input
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                    value={billingLine1}
                    onChange={(e) => setBillingLine1(e.target.value)}
                    required={companyInvoice}
                  />
                </label>
                <label className="block text-sm">
                  Código postal
                  <input
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                    value={billingPostcode}
                    onChange={(e) => setBillingPostcode(e.target.value)}
                    required={companyInvoice}
                  />
                </label>
                <label className="block text-sm">
                  País
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                    value={billingCountry}
                    onChange={(e) => setBillingCountry(e.target.value)}
                  >
                    <option value="ES">España</option>
                    <option value="FR">Francia</option>
                  </select>
                </label>
              </div>
            )}
            {error && <p className="text-sm text-accent">{error}</p>}
            <button
              disabled={pending}
              className="w-full rounded-xl bg-ink text-paper py-3 text-sm disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Continuar al pago"}
            </button>
          </form>
        ) : (
          <form onSubmit={onPay} className="bg-white/70 border border-line rounded-2xl p-6 shadow-card space-y-4">
            <p className="text-sm font-medium">Resumen</p>
            <ul className="text-sm space-y-1">
              <li>{name}</li>
              <li className="text-muted">{email}</li>
              <li className="text-muted">{whatsapp}</li>
              <li className="text-muted">{billingCity}</li>
              <li>
                {trial ? `Primer mes 0 €, luego ${quote.monthLabel}` : plan === "year" ? quote.yearLabel : quote.monthLabel}
              </li>
              {companyInvoice ? <li className="text-muted">Factura empresa · {taxId}</li> : <li className="text-muted">Sin NIF</li>}
            </ul>
            <label className="flex gap-2 items-start text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
              />
              <span>
                Acepto las{" "}
                <a href="/legal/terms" className="underline" target="_blank" rel="noreferrer">
                  condiciones
                </a>{" "}
                y la{" "}
                <a href="/legal/privacy" className="underline" target="_blank" rel="noreferrer">
                  privacidad
                </a>
                .
              </span>
            </label>
            {error && <p className="text-sm text-accent">{error}</p>}
            <button
              disabled={pending || !acceptedTerms}
              className="w-full rounded-xl bg-ink text-paper py-3 text-sm disabled:opacity-60"
            >
              {pending ? "Abriendo…" : trial ? "Empezar mes gratis" : "Pagar"}
            </button>
            <button type="button" className="w-full text-sm underline" onClick={() => setStep(1)}>
              Volver
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PayForm />
    </Suspense>
  );
}
