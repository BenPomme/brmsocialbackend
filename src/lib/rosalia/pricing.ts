/** Pricing table version from the 5 Sep 2026 spec. Estimates only until the live account is measured. */
export const PRICING_TABLE_VERSION = "2026-09-05-spec";

/** USD per million tokens. Grok 4.3 published rates used as the estimate for the cheap path. */
export const TEXT_RATES_USD = { input: 1.25, output: 2.5 };

export const TASK_COST_CEILING_USD = 0.03;
export const PROVIDER_TIMEOUT_MS = 8000;
export const TASK_DEADLINE_MS = 20000;
export const MAX_PROVIDER_CALLS = 3;
export const TARGET_MAX_INPUT_TOKENS = 4000;
export const TARGET_MAX_OUTPUT_TOKENS = 500;

export function estimateCostUsd(promptTokens: number, completionTokens: number) {
  return (promptTokens * TEXT_RATES_USD.input + completionTokens * TEXT_RATES_USD.output) / 1_000_000;
}
