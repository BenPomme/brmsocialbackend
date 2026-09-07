import { prisma } from "./db";
import { isPaidClient } from "./billing-state";
import { notifyFounder } from "./founder-notify";
import {
  acceptGbpInvitation,
  declineGbpInvitation,
  isManagerRole,
  isOwnerRole,
  listGbpInvitations,
  type GbpInvitation,
} from "./gbp-invitations";
import { gbpConfigured } from "./gbp-auth";
import { pickInviteMatch, type MatchCandidate } from "./listing";
import { importCatchupReviews } from "./catchup-reviews";
import { markManagerConnected } from "./rosalia-reply";

async function alreadyHandled(invitationName: string) {
  const ev = await prisma.providerEvent.findUnique({
    where: {
      provider_receivingAccount_eventId: {
        provider: "gbp",
        receivingAccount: "reviews@babyrock.ai",
        eventId: invitationName,
      },
    },
  });
  return ev;
}

async function recordEvent(invitationName: string, state: string, payload: object) {
  await prisma.providerEvent.upsert({
    where: {
      provider_receivingAccount_eventId: {
        provider: "gbp",
        receivingAccount: "reviews@babyrock.ai",
        eventId: invitationName,
      },
    },
    create: {
      provider: "gbp",
      receivingAccount: "reviews@babyrock.ai",
      eventId: invitationName,
      eventTime: new Date(),
      payload,
      state,
    },
    update: { state, payload },
  });
}

async function candidates(): Promise<MatchCandidate[]> {
  const rows = await prisma.client.findMany({
    where: { managerInviteStatus: { not: "revoked" } },
    select: {
      id: true,
      name: true,
      city: true,
      formattedAddress: true,
      placeId: true,
      status: true,
      managerInviteStatus: true,
    },
  });
  return rows;
}

async function pingBen(text: string) {
  await notifyFounder(text);
}

export async function processGbpInvitation(invite: GbpInvitation) {
  const prior = await alreadyHandled(invite.name);
  if (prior && (prior.state === "accepted" || prior.state === "declined")) {
    return { skipped: true as const, reason: prior.state, name: invite.name };
  }

  const listing = `${invite.locationName}${invite.locationAddress ? ` — ${invite.locationAddress}` : ""}`;

  if (isOwnerRole(invite.role)) {
    await declineGbpInvitation(invite.name);
    const picked = pickInviteMatch(
      { name: invite.locationName, address: invite.locationAddress },
      await candidates(),
    );
    const clientId = picked.kind === "one" ? picked.hits[0].id : null;
    await recordEvent(invite.name, "declined", { role: invite.role, listing, clientId });
    if (clientId) {
      await prisma.action.create({
        data: {
          clientId,
          type: "invite_ok",
          actor: "gbp",
          payload: { invitation: invite.name, role: invite.role, declined: true },
          result: "ok",
        },
      }).catch(() => null);
    }
    if (clientId) {
      const { emitRosaliaEvent } = await import("./rosalia-reply");
      await emitRosaliaEvent({ clientId, event: { type: "manager_owner_declined" } });
    }
    await pingBen(`Ben, a Google invite arrived as Owner (not Manager): ${listing}. We declined it.`);
    return { skipped: false as const, action: "declined_owner" as const, listing, clientId };
  }

  if (!isManagerRole(invite.role)) {
    await recordEvent(invite.name, "ignored", { role: invite.role, listing });
    await pingBen(`Ben, a Google invite with role ${invite.role} for ${listing}. Not Manager — ignored.`);
    return { skipped: false as const, action: "ignored_role" as const, listing };
  }

  const picked = pickInviteMatch(
    { name: invite.locationName, address: invite.locationAddress },
    await candidates(),
  );

  if (picked.kind !== "one") {
    if (prior?.state === "unmatched") {
      return { skipped: true as const, reason: "unmatched_already", name: invite.name };
    }
    await recordEvent(invite.name, "unmatched", {
      listing,
      hitIds: picked.hits.map((h) => h.id),
      kind: picked.kind,
    });
    const why = picked.kind === "many" ? "several shops match" : "no shop matches";
    await pingBen(`Ben, a manager invite we cannot match (${why}): ${listing}`);
    return { skipped: false as const, action: "unmatched" as const, listing, hits: picked.hits.length };
  }

  const clientId = picked.hits[0].id;
  await acceptGbpInvitation(invite.name);
  await recordEvent(invite.name, "accepted", { listing, clientId, role: invite.role });
  await prisma.action.create({
    data: {
      clientId,
      type: "invite_ok",
      actor: "gbp",
      payload: { invitation: invite.name, role: invite.role, listing },
      result: "ok",
    },
  }).catch(() => null);

  const after = await markManagerConnected(clientId);
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  await pingBen(`Ben, a new customer added us as manager: ${client?.name ?? listing}.`);

  if (client && isPaidClient(client)) {
    await importCatchupReviews(clientId).catch((e) => console.warn("catchup after invite", e));
  }

  return {
    skipped: false as const,
    action: "accepted" as const,
    listing,
    clientId,
    paid: Boolean(client && isPaidClient(client)),
    rosalia: after,
  };
}

export async function pollGbpInvitations() {
  if (!gbpConfigured()) return { skipped: true as const, reason: "gbp_oauth_missing" };
  const invites = await listGbpInvitations();
  const results = [];
  for (const invite of invites) {
    try {
      results.push(await processGbpInvitation(invite));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.warn("gbp invite", invite.name, error);
      results.push({ skipped: false as const, action: "error" as const, name: invite.name, error });
    }
  }
  return { skipped: false as const, count: invites.length, results };
}
