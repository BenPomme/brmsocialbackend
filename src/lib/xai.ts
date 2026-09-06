import { xaiKey, xaiModel } from "./env";
import { PROVIDER_TIMEOUT_MS } from "./rosalia/pricing";

/** Volume FAQ / 4–5★: no chain-of-thought billed as output. Same list price as 4.3, far fewer tokens. */
export function xaiFastModel() {
  return process.env.XAI_FAST_MODEL?.trim() || "grok-4.20-0309-non-reasoning";
}

export type LlmCall = {
  content: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export async function xaiText(
  system: string,
  user: string,
  opts?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    reasoning?: "none" | "low" | "medium" | "high";
    timeoutMs?: number;
  },
): Promise<string | null> {
  const r = await xaiComplete(system, user, opts);
  return r?.content ?? null;
}

export async function xaiComplete(
  system: string,
  user: string,
  opts?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    reasoning?: "none" | "low" | "medium" | "high";
    timeoutMs?: number;
  },
): Promise<LlmCall | null> {
  const key = xaiKey();
  if (!key) return null;
  const started = Date.now();
  const model = opts?.model ?? xaiModel();
  const reasoning = opts?.reasoning ?? (model.includes("non-reasoning") ? undefined : "none");
  const payload: Record<string, unknown> = {
    model,
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 400,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (reasoning) payload.reasoning_effort = reasoning;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? PROVIDER_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok && reasoning && res.status === 400) {
      delete payload.reasoning_effort;
      res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    }
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xAI ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const u = data.usage;
  if (u) {
    console.log("xai usage", {
      model,
      prompt: u.prompt_tokens,
      completion: u.completion_tokens,
      total: u.total_tokens,
    });
  }
  return {
    content: data.choices?.[0]?.message?.content?.trim() ?? null,
    model,
    promptTokens: u?.prompt_tokens ?? 0,
    completionTokens: u?.completion_tokens ?? 0,
    latencyMs: Date.now() - started,
  };
}

export async function xaiFastText(system: string, user: string): Promise<string | null> {
  return xaiText(system, user, {
    model: xaiFastModel(),
    maxTokens: 180,
    temperature: 0.2,
  });
}

export async function xaiJson<T>(system: string, user: string): Promise<T | null> {
  const raw = await xaiText(
    `${system}\n\nReturn ONLY valid JSON. No markdown.`,
    user,
  );
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}
