"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppHeader, OutboundBanner, StatusBadge } from "@/components/Chrome";

type Msg = { id: string; direction: string; body: string; createdAt: string; payload?: { source?: string; kind?: string } | null };
type Thread = {
  id: string;
  channel: string;
  counterparty: string;
  firstName?: string | null;
  subject: string | null;
  status: string;
  phase?: string | null;
  humanPaused?: boolean;
  lastMessageAt: string;
  lead: { id: string; name: string; city: string | null } | null;
  messages: Msg[];
};

export default function AdminInboxPage() {
  const [email, setEmail] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [simFrom, setSimFrom] = useState("");
  const [simBody, setSimBody] = useState("OK");
  const [simType, setSimType] = useState("text");
  const [simEvent, setSimEvent] = useState("");
  const [simCity, setSimCity] = useState("");
  const [draftEdit, setDraftEdit] = useState("");

  const refresh = useCallback(async () => {
    const [me, inbox] = await Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/admin/inbox").then((r) => r.json()),
    ]);
    setEmail(me.session?.email ?? "");
    setThreads(inbox.threads ?? []);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setNotice(String(e)));
  }, [refresh]);

  useEffect(() => {
    const d = threads.find((t) => t.id === (openId ?? threads[0]?.id))?.messages.find((m) => m.direction === "draft");
    if (d) setDraftEdit(d.body);
  }, [threads, openId]);

  async function sync() {
    setBusy("sync");
    const res = await fetch("/api/admin/inbox/sync", { method: "POST" });
    const data = await res.json();
    setBusy(null);
    const r = data.sync?.result;
    setNotice(
      data.sync?.error
        ? String(data.sync.error)
        : `Zoho : ${r?.scanned ?? "?"} lus, ${r?.created ?? "?"} nouveaux.`,
    );
    await refresh();
  }

  async function sim(e: FormEvent) {
    e.preventDefault();
    setBusy("sim");
    const res = await fetch("/api/admin/inbox/sim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "whatsapp",
        from: simFrom,
        body: simBody,
        type: simType,
        event: simEvent || undefined,
        city: simCity || undefined,
      }),
    });
    const data = await res.json();
    setBusy(null);
    setNotice(res.ok ? "WhatsApp simulé (sans passer par Meta)." : data.error ?? "échec");
    await refresh();
  }

  const open = threads.find((t) => t.id === openId) ?? threads[0] ?? null;
  const draft = open?.messages.find((m) => m.direction === "draft") ?? null;
  const visible = open?.messages.filter((m) => m.direction !== "draft") ?? [];

  async function propose() {
    if (!open) return;
    setBusy("propose");
    const res = await fetch("/api/admin/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: open.id, action: "propose" }),
    });
    const data = await res.json();
    setBusy(null);
    setNotice(res.ok ? `Brouillon Rosalia (${data.proposed?.source ?? "ok"}).` : data.error ?? "échec");
    await refresh();
  }

  async function sendDraft() {
    if (!open) return;
    setBusy("send");
    const res = await fetch("/api/admin/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: open.id, action: "send", text: draftEdit || draft?.body }),
    });
    const data = await res.json();
    setBusy(null);
    setNotice(res.ok ? "WhatsApp envoyé." : data.error ?? "échec");
    if (res.ok) setDraftEdit("");
    await refresh();
  }

  async function takeover(action: "pause" | "release") {
    if (!open) return;
    setBusy("pause");
    const res = await fetch("/api/admin/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: open.id, action }),
    });
    const data = await res.json();
    setBusy(null);
    setNotice(res.ok ? (action === "pause" ? "Rosalia en pause." : "Rosalia relancée.") : data.error ?? "échec");
    await refresh();
  }

  return (
    <div className="min-h-screen">
      <OutboundBanner />
      <AppHeader role="admin" email={email} />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl">Inbox démarchage</h1>
            <p className="text-sm text-muted mt-1">
              Réponses des prospects à Rosalia (mail Zoho) et à notre WhatsApp (webhook Meta, ou
              simu). Pas la file d’avis Google — ça c’est « File avis ».
            </p>
          </div>
          <button
            onClick={sync}
            disabled={busy === "sync"}
            className="rounded-lg bg-ink text-paper px-4 py-2 text-sm disabled:opacity-60"
          >
            {busy === "sync" ? "Lecture Zoho…" : "Récupérer les mails Zoho"}
          </button>
        </div>
        {notice && <p className="text-sm bg-white/70 border border-line rounded-xl px-4 py-3">{notice}</p>}

        <form onSubmit={sim} className="bg-white/70 border border-line rounded-2xl p-4 text-sm flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Simuler un WhatsApp (sans Meta)</span>
            <input
              className="rounded-lg border border-line bg-paper px-3 py-2"
              placeholder="34600111222"
              value={simFrom}
              onChange={(e) => setSimFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 grow">
            <span className="text-xs text-muted">Message</span>
            <input
              className="rounded-lg border border-line bg-paper px-3 py-2"
              value={simBody}
              onChange={(e) => setSimBody(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Type</span>
            <select
              className="rounded-lg border border-line bg-paper px-3 py-2"
              value={simType}
              onChange={(e) => setSimType(e.target.value)}
            >
              <option value="text">texte</option>
              <option value="image">image</option>
              <option value="audio">audio</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Ville</span>
            <input
              className="rounded-lg border border-line bg-paper px-3 py-2 w-40"
              placeholder="Sant Cugat…"
              value={simCity}
              onChange={(e) => setSimCity(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Événement</span>
            <select
              className="rounded-lg border border-line bg-paper px-3 py-2"
              value={simEvent}
              onChange={(e) => setSimEvent(e.target.value)}
            >
              <option value="">(message)</option>
              <option value="payment_confirmed">paiement Stripe</option>
              <option value="trial_started">essai Sant Cugat</option>
              <option value="manager_connected">gestor accepté</option>
              <option value="low_star">avis 1–3★</option>
            </select>
          </label>
          <button disabled={busy === "sim"} className="rounded-lg border border-line px-3 py-2">
            Simuler
          </button>
        </form>

        <div className="grid md:grid-cols-3 gap-4">
          <ul className="border border-line rounded-2xl bg-white/70 overflow-auto max-h-[70vh]">
            {threads.length === 0 && (
              <li className="p-4 text-sm text-muted">Vide. Récupère Zoho, ou simule un WhatsApp.</li>
            )}
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setOpenId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-line ${open?.id === t.id ? "bg-sand/60" : ""}`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <StatusBadge status={t.channel} />
                    <StatusBadge status={t.status} />
                    {t.phase ? <StatusBadge status={t.phase} /> : null}
                  </div>
                  <div className="font-medium text-sm mt-1">
                    {t.firstName ? `${t.firstName} · ` : ""}
                    {t.lead?.name ?? t.counterparty}
                  </div>
                  <div className="text-xs text-muted">{t.subject ?? t.counterparty}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="md:col-span-2 border border-line rounded-2xl bg-white/70 p-4 min-h-[40vh]">
            {!open && <p className="text-sm text-muted">Choisis une conversation.</p>}
            {open && (
              <>
                <h2 className="font-display text-2xl">
                  {open.firstName ? `${open.firstName} · ` : ""}
                  {open.lead?.name ?? open.counterparty}
                </h2>
                <p className="text-xs text-muted mb-4">
                  {open.channel} · {open.counterparty}
                  {open.lead?.city ? ` · ${open.lead.city}` : ""}
                </p>
                <div className="space-y-3">
                  {visible.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.direction === "in" ? "bg-sand/80" : "bg-moss/10"
                      }`}
                    >
                      <div className="text-[10px] text-muted mb-1">
                        {m.direction === "in" ? "eux" : "nous"} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      {m.body}
                    </div>
                  ))}
                </div>
                {open.channel === "whatsapp" && (
                  <div className="mt-4 border-t border-line pt-4 space-y-2">
                    <p className="text-xs text-muted">
                      Brouillon Rosalia
                      {draft?.payload && typeof draft.payload === "object" && "source" in draft.payload
                        ? ` · ${String((draft.payload as { source?: string }).source)}`
                        : ""}
                      . Fil WhatsApp : envoi auto. Hors script → humain.
                    </p>
                    <textarea
                      className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm min-h-[8rem]"
                      value={draftEdit}
                      onChange={(e) => setDraftEdit(e.target.value)}
                      placeholder="Pas encore de brouillon. Simule un message, ou Régénère."
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={propose}
                        disabled={busy === "propose"}
                        className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-60"
                      >
                        {busy === "propose" ? "…" : "Régénérer"}
                      </button>
                      <button
                        type="button"
                        onClick={sendDraft}
                        disabled={busy === "send" || !draftEdit.trim()}
                        className="rounded-lg bg-ink text-paper px-3 py-2 text-sm disabled:opacity-60"
                      >
                        {busy === "send" ? "Envoi…" : "Envoyer WhatsApp"}
                      </button>
                      <button
                        type="button"
                        onClick={() => takeover(open.humanPaused ? "release" : "pause")}
                        disabled={busy === "pause"}
                        className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-60"
                      >
                        {open.humanPaused ? "Reprendre Rosalia" : "Prendre la main"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
