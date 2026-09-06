import { parseTurn } from "./route";
import { isToolId, type ToolId } from "./tools";

export type StructuredTurn = {
  route: string;
  reply: string;
  locale: string | null;
  intent: string | null;
  tool: ToolId | null;
  args: Record<string, unknown>;
};

export function parseStructuredTurn(raw: string): StructuredTurn | null {
  const base = parseTurn(raw);
  if (!base) return null;
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  let extra: { locale?: unknown; intent?: unknown; tool?: unknown; args?: unknown } = {};
  if (start >= 0 && end > start) {
    try {
      extra = JSON.parse(cleaned.slice(start, end + 1)) as typeof extra;
    } catch {
      extra = {};
    }
  }
  const tool = typeof extra.tool === "string" && isToolId(extra.tool) ? extra.tool : null;
  const args =
    extra.args && typeof extra.args === "object" && !Array.isArray(extra.args)
      ? (extra.args as Record<string, unknown>)
      : {};
  return {
    route: base.route,
    reply: base.reply,
    locale: typeof extra.locale === "string" ? extra.locale : null,
    intent: typeof extra.intent === "string" ? extra.intent : null,
    tool,
    args,
  };
}
