/**
 * One-time OAuth as reviews@babyrock.ai for Google Business Profile
 * Account Management (list/accept/decline manager invites).
 *
 *   npx tsx scripts/gbp-oauth.ts
 *
 * Needs GOOGLE_GBP_CLIENT_ID and GOOGLE_GBP_CLIENT_SECRET in .env
 * (Desktop or Web client, redirect http://127.0.0.1:8788/oauth/gbp).
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const k = t.slice(0, i);
  let v = t.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const clientId = process.env.GOOGLE_GBP_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_GBP_CLIENT_SECRET?.trim();
const redirect = process.env.GOOGLE_GBP_REDIRECT_URI?.trim() || "http://127.0.0.1:8788/oauth/gbp";
const scope = "https://www.googleapis.com/auth/business.manage";

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_GBP_CLIENT_ID and GOOGLE_GBP_CLIENT_SECRET in .env");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
  }).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", redirect);
  if (url.pathname !== "/oauth/gbp") {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err || !code) {
    res.writeHead(400);
    res.end(err || "missing code");
    return;
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const json = (await tokenRes.json()) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(json.error_description || json.error || "token exchange failed");
    server.close();
    process.exit(1);
    return;
  }
  let account = "";
  if (json.access_token) {
    const acc = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    const accJson = (await acc.json()) as { accounts?: { name?: string; accountName?: string }[] };
    account = accJson.accounts?.[0]?.name || "";
  }
  const lines = [
    "Paste into .env (local and /opt/babyrock/.env):",
    "",
    `GOOGLE_GBP_REFRESH_TOKEN=${json.refresh_token || "(missing — revoke app access and retry with prompt=consent)"}`,
    account ? `GOOGLE_GBP_ACCOUNT_NAME=${account}` : "GOOGLE_GBP_ACCOUNT_NAME=accounts/… (list failed; fill after API access is granted)",
    "",
  ].join("\n");
  console.log(lines);
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("OK. Copy the refresh token from the terminal. You can close this tab.");
  server.close();
});

server.listen(8788, "127.0.0.1", () => {
  console.log("Open this URL as reviews@babyrock.ai (2FA on your phone):\n");
  console.log(authUrl);
  console.log("\nWaiting on", redirect);
});
