import Link from "next/link";
import { legalHtml, loadLegal, type LegalId } from "@/lib/legal/md";

const NAV: { href: string; label: string; id: LegalId }[] = [
  { href: "/legal/aviso", label: "Aviso legal", id: "aviso" },
  { href: "/legal/terms", label: "Condiciones", id: "condiciones" },
  { href: "/legal/privacy", label: "Privacidad", id: "privacidad" },
  { href: "/legal/cookies", label: "Cookies", id: "cookies" },
  { href: "/legal/dpa", label: "Encargo", id: "encargo" },
];

export function LegalDoc({ id }: { id: LegalId }) {
  const html = legalHtml(loadLegal(id, "es"));
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-12">
      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mb-8">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.id === id ? "text-ink underline" : "underline decoration-line underline-offset-4"}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <article
        className="legal-prose text-sm leading-relaxed [&_h1]:font-display [&_h1]:text-3xl [&_h1]:mb-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="text-muted text-xs mt-10">
        BABYROCK MINERALS, S.L. · NIF B88957212 ·{" "}
        <a className="underline" href="mailto:contact@babyrock.ai">
          contact@babyrock.ai
        </a>
      </p>
    </main>
  );
}
