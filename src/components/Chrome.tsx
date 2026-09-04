"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function OutboundBanner() {
  return (
    <div className="bg-ink text-paper px-4 py-2 text-xs tracking-wide flex items-center justify-between gap-3">
      <span>OUTBOUND_ENABLED=false — SMTP / SMS off. Zoho : allowlist. WhatsApp Fil Babyrock : ouvert.</span>
      <span className="opacity-70">Publier = dry-run, sauf fiche à nous avec publish_live.</span>
    </div>
  );
}

export function AppHeader(props: {
  role: "admin" | "operator" | "client";
  email: string;
}) {
  const router = useRouter();
  const label =
    props.role === "admin" ? "Admin" : props.role === "operator" ? "Opérateur" : "Client";
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="border-b border-line bg-paper/80 backdrop-blur px-5 py-3 flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <Link href="/" className="font-display text-xl tracking-tight">
          Babyrock
        </Link>
        <span className="text-xs uppercase tracking-[0.18em] text-muted">{label}</span>
        {props.role === "admin" && (
          <nav className="hidden md:flex items-center gap-3 text-sm font-normal normal-case tracking-normal">
            <Link href="/admin" className="underline decoration-line underline-offset-4">
              Scope
            </Link>
            <Link href="/admin/inbox" className="underline decoration-line underline-offset-4">
              Inbox
            </Link>
            <Link href="/admin/prospects" className="underline decoration-line underline-offset-4">
              Prospects
            </Link>
            <Link href="/admin/lots" className="underline decoration-line underline-offset-4">
              Lots
            </Link>
            <Link href="/admin/accounts" className="underline decoration-line underline-offset-4">
              Paid accounts
            </Link>
            <Link href="/operator" className="underline decoration-line underline-offset-4">
              File avis
            </Link>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted hidden sm:inline">{props.email}</span>
        <button type="button" onClick={logout} className="underline decoration-line underline-offset-4">
          Déconnexion
        </button>
      </div>
    </header>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    nouveau: "bg-sand text-ink",
    brouillon: "bg-amber-100 text-warn",
    attente_client: "bg-orange-100 text-accent-dark",
    pret: "bg-emerald-100 text-ok",
    publie: "bg-moss text-white",
    bloque: "bg-neutral-300 text-ink",
    proposed: "bg-amber-100 text-warn",
    applied: "bg-emerald-100 text-ok",
    rejected: "bg-neutral-200 text-muted",
    queued: "bg-sand text-ink",
    run: "bg-amber-100 text-warn",
    done: "bg-emerald-100 text-ok",
    fail: "bg-red-100 text-accent-dark",
    proto: "bg-sand text-ink",
    lead: "bg-sand text-ink",
    paye: "bg-emerald-100 text-ok",
    essai: "bg-amber-100 text-warn",
    actif: "bg-moss text-white",
    pause: "bg-amber-100 text-warn",
    resilie: "bg-neutral-300 text-ink",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${map[status] ?? "bg-sand"}`}>
      {status}
    </span>
  );
}
