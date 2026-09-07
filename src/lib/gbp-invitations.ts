import { gbpFetch, resolveGbpAccountName } from "./gbp-auth";

export type GbpInviteRole = "PRIMARY_OWNER" | "OWNER" | "MANAGER" | "SITE_MANAGER" | string;

export type GbpInvitation = {
  name: string;
  role: GbpInviteRole;
  locationName: string;
  locationAddress: string;
};

export function isOwnerRole(role: string) {
  const r = role.toUpperCase();
  return r === "OWNER" || r === "PRIMARY_OWNER";
}

export function isManagerRole(role: string) {
  const r = role.toUpperCase();
  return r === "MANAGER" || r === "SITE_MANAGER";
}

function asInvitation(raw: {
  name?: string;
  role?: string;
  targetLocation?: { locationName?: string; locationAddress?: string };
  targetAccount?: { accountName?: string };
}): GbpInvitation | null {
  const name = raw.name?.trim();
  if (!name) return null;
  const locationName = (raw.targetLocation?.locationName || raw.targetAccount?.accountName || "").trim();
  const locationAddress = (raw.targetLocation?.locationAddress || "").trim();
  return {
    name,
    role: raw.role || "MANAGER",
    locationName: locationName || "unknown listing",
    locationAddress,
  };
}

export async function listGbpInvitations(): Promise<GbpInvitation[]> {
  const account = await resolveGbpAccountName();
  const json = (await gbpFetch(`${account}/invitations`)) as {
    invitations?: Parameters<typeof asInvitation>[0][];
  };
  return (json.invitations ?? []).map(asInvitation).filter((x): x is GbpInvitation => Boolean(x));
}

export async function acceptGbpInvitation(name: string) {
  await gbpFetch(`https://mybusinessaccountmanagement.googleapis.com/v1/${name}:accept`, {
    method: "POST",
    body: "{}",
  });
}

export async function declineGbpInvitation(name: string) {
  await gbpFetch(`https://mybusinessaccountmanagement.googleapis.com/v1/${name}:decline`, {
    method: "POST",
    body: "{}",
  });
}
