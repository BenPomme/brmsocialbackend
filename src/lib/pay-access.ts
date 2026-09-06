import { prisma } from "./db";
import { capabilityMatches, issueCapability } from "./capability";

export class PayAuthError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
    this.name = "PayAuthError";
  }
}

export type PayAccess = {
  clientId?: string | null;
  capability?: string | null;
  idempotencyKey?: string | null;
  sessionClientId?: string | null;
};

async function rotateCapability(registrationId: string) {
  const issued = await issueCapability();
  await prisma.payRegistration.update({
    where: { id: registrationId },
    data: { capabilityHash: issued.hash, expiresAt: issued.expiresAt },
  });
  return issued.token;
}

export async function registerPayDraft(
  data: Record<string, string | null | undefined>,
  access: PayAccess,
) {
  const key = access.idempotencyKey?.trim() || null;
  if (key) {
    const hit = await prisma.payRegistration.findUnique({ where: { idempotencyKey: key } });
    if (hit) {
      const token = await rotateCapability(hit.id);
      return { clientId: hit.clientId, registrationId: hit.id, capability: token, reused: true as const };
    }
  }

  const name = data.name?.trim() || data.legalName?.trim() || "Simu Stripe";
  const client = await prisma.client.create({
    data: {
      plan: "avis_month",
      status: "lead",
      ...data,
      name,
    },
  });
  const issued = await issueCapability();
  const registration = await prisma.payRegistration.create({
    data: {
      clientId: client.id,
      capabilityHash: issued.hash,
      expiresAt: issued.expiresAt,
      idempotencyKey: key,
    },
  });
  return { clientId: client.id, registrationId: registration.id, capability: issued.token, reused: false as const };
}

export async function authorizePayClient(access: PayAccess) {
  const clientId = access.clientId?.trim() || null;
  if (!clientId) return null;
  if (access.sessionClientId && access.sessionClientId === clientId) {
    return prisma.client.findUnique({ where: { id: clientId } });
  }
  const token = access.capability?.trim() || null;
  if (!token) {
    throw new PayAuthError("registration capability required", 403);
  }
  const registration = await prisma.payRegistration.findUnique({ where: { clientId } });
  if (!registration) throw new PayAuthError("unknown registration", 403);
  if (registration.expiresAt.getTime() < Date.now()) throw new PayAuthError("registration expired", 403);
  if (!(await capabilityMatches(token, registration.capabilityHash))) {
    throw new PayAuthError("registration capability invalid", 403);
  }
  return prisma.client.findUnique({ where: { id: clientId } });
}

export async function continuePayClient(data: Record<string, string | null | undefined>, access: PayAccess) {
  if (access.clientId?.trim()) {
    const existing = await authorizePayClient(access);
    if (!existing) throw new PayAuthError("client introuvable", 404);
    const { name: _n, ...patch } = data;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) return existing;
    return prisma.client.update({ where: { id: existing.id }, data: clean });
  }
  const created = await registerPayDraft(data, access);
  return prisma.client.findUniqueOrThrow({ where: { id: created.clientId } });
}
