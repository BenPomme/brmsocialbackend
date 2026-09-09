import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LegalId = "aviso" | "condiciones" | "privacidad" | "cookies" | "encargo";
export type LegalLocale = "es" | "ca" | "fr" | "en";

export const LEGAL_VERSION = "2026-09-09";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(s: string) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+|mailto:[^)]+)\)/g,
      '<a href="$2" rel="noopener">$1</a>',
    );
}

export function legalHtml(md: string) {
  return String(md || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const first = lines[0] ?? "";
      if (first.startsWith("# ")) {
        const rest = lines.slice(1).join("\n").trim();
        return `<h1>${inline(first.slice(2))}</h1>${rest ? `<p>${inline(rest)}</p>` : ""}`;
      }
      if (first.startsWith("## ")) {
        const rest = lines.slice(1).join("\n").trim();
        return `<h2>${inline(first.slice(3))}</h2>${rest ? `<p>${inline(rest)}</p>` : ""}`;
      }
      if (lines.every((l) => l.trim().startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${inline(block)}</p>`;
    })
    .join("\n");
}

export function loadLegal(id: LegalId, locale: LegalLocale = "es") {
  const path = join(process.cwd(), "legal", locale, `${id}.md`);
  return readFileSync(path, "utf8");
}
