import { gbpAccountName, gbpClientId, gbpClientSecret, gbpRefreshToken } from "./env";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";

export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

export class GbpError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly body = "",
  ) {
    super(message);
    this.name = "GbpError";
  }
}

export function gbpConfigured() {
  return Boolean(gbpClientId() && gbpClientSecret() && gbpRefreshToken());
}

export async function gbpAccessToken() {
  const id = gbpClientId();
  const secret = gbpClientSecret();
  const refresh = gbpRefreshToken();
  if (!id || !secret || !refresh) {
    throw new GbpError("GOOGLE_GBP_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN missing");
  }
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new GbpError(json.error_description || json.error || `token ${res.status}`, res.status, JSON.stringify(json).slice(0, 400));
  }
  return json.access_token;
}

export async function gbpFetch(path: string, init: RequestInit = {}) {
  const token = await gbpAccessToken();
  const url = path.startsWith("http") ? path : `https://mybusinessaccountmanagement.googleapis.com/v1/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = json.error?.message || json.error_description || `GBP ${res.status}`;
    throw new GbpError(message, res.status, text.slice(0, 800));
  }
  return json;
}

export async function resolveGbpAccountName() {
  const configured = gbpAccountName();
  if (configured) return configured.startsWith("accounts/") ? configured : `accounts/${configured}`;
  const json = (await gbpFetch(ACCOUNTS_URL)) as { accounts?: { name?: string }[] };
  const name = json.accounts?.[0]?.name;
  if (!name) throw new GbpError("No Google Business Profile account on this OAuth user");
  return name;
}
