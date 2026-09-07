/** Fold listing names/addresses for matching Google manager invites to clients. */

export function foldListing(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namesOverlap(a: string, b: string) {
  const fa = foldListing(a);
  const fb = foldListing(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  if (fa.length >= 4 && fb.includes(fa)) return true;
  if (fb.length >= 4 && fa.includes(fb)) return true;
  const tokensA = fa.split(" ").filter((t) => t.length >= 4);
  if (tokensA.length === 0) return false;
  const setB = new Set(fb.split(" ").filter((t) => t.length >= 3));
  const hits = tokensA.filter((t) => setB.has(t) || fb.includes(t));
  if (tokensA.length === 1) return hits.length === 1;
  return hits.length >= Math.ceil(tokensA.length / 2);
}

export function addressOverlap(inviteAddress: string, city?: string | null, formatted?: string | null) {
  const inv = foldListing(inviteAddress);
  if (!inv) return false;
  if (city && foldListing(city) && inv.includes(foldListing(city))) return true;
  if (formatted && namesOverlap(inviteAddress, formatted)) return true;
  return false;
}

export type InviteListing = {
  name: string;
  address: string;
};

export type MatchCandidate = {
  id: string;
  name: string;
  city: string | null;
  formattedAddress: string | null;
  placeId: string | null;
  status: string;
  managerInviteStatus: string;
};

export function scoreInviteMatch(invite: InviteListing, client: MatchCandidate) {
  if (client.managerInviteStatus === "accepted") return 0;
  const nameOk = namesOverlap(invite.name, client.name);
  if (!nameOk) return 0;
  const addrOk = addressOverlap(invite.address, client.city, client.formattedAddress);
  const weakAddr = !client.city && !client.formattedAddress;
  if (!addrOk && !weakAddr) return 0;
  let score = 2;
  if (addrOk) score += 2;
  if (client.status === "paye" || client.status === "essai" || client.status === "actif") score += 1;
  return score;
}

export function pickInviteMatch(invite: InviteListing, clients: MatchCandidate[]) {
  const scored = clients
    .map((c) => ({ client: c, score: scoreInviteMatch(invite, c) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { kind: "none" as const, hits: [] as MatchCandidate[] };
  const top = scored[0].score;
  const hits = scored.filter((x) => x.score === top).map((x) => x.client);
  if (hits.length === 1) return { kind: "one" as const, hits };
  return { kind: "many" as const, hits };
}

const MAPS_URL =
  /https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps[^\s]*|maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|maps\.google\.[a-z.]+[^\s]*)/i;

export function extractMapsUrl(text: string) {
  const m = text.match(MAPS_URL);
  return m ? m[0].replace(/[),.;]+$/, "") : null;
}

export function extractListingHint(text: string): { mapsUri: string | null; listingName: string | null; listingAddress: string | null } {
  const mapsUri = extractMapsUrl(text);
  if (mapsUri) return { mapsUri, listingName: null, listingAddress: null };
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 8 || t.length > 180) return { mapsUri: null, listingName: null, listingAddress: null };
  if (/https?:\/\//i.test(t)) return { mapsUri: null, listingName: null, listingAddress: null };
  const hasNumber = /\d{1,4}/.test(t);
  const hasStreet = /\b(carrer|calle|avenue|avda|plaza|plaça|rue|road|c\/|c\.|street)\b/i.test(t);
  if (hasNumber && hasStreet) {
    const parts = t.split(",").map((s) => s.trim()).filter(Boolean);
    return {
      mapsUri: null,
      listingName: parts.length > 1 ? parts[0] : null,
      listingAddress: parts.length > 1 ? parts.slice(1).join(", ") : t,
    };
  }
  return { mapsUri: null, listingName: null, listingAddress: null };
}
