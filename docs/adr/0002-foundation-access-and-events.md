# 0002 — Foundation: registration, events, approvals, payment evidence

**Date:** 2026-09-05  
**Status:** accepted

## Decision

1. Public `/pay` registration is a new Paid Account (shop) plus a hashed, short-lived capability. Email and WhatsApp are not merge keys.
2. WhatsApp POST verifies Meta HMAC, persists a unique `ProviderEvent`, and enqueues `wa_inbound`. Missing secret fails closed.
3. Owner approval is stored against a reply version and the owning account. Publish checks that row.
4. Conversation workers load newest history and the triggering inbound id.
5. Entitlement is `paye` / `essai` / `actif`. A Stripe Customer ID is not payment. Fulfillment inserts unique `PaymentEvidence`.

## Rollback

Revert the commit and `prisma db push` the previous schema. New tables can stay empty. Keep `WHATSAPP_APP_SECRET` set: without it the webhook fails closed by design.

## Out of scope

Stripe Billing 0.7 %, live GBP write, Rosalía tool-calling (file 02).
