# Wayfinder map: Rosalía foundation

## Destination

The five verified defects in file 01 are gone, with regression tests. File 02 (conversation tools, GBP, billing lifecycle) starts only after that.

## Notes

- Local tracker: `.scratch/`. Triage roles on `Status:`.
- Product glossary: `CONTEXT.md`. Two Paid Accounts may share email/phone/card.

## Decisions so far

- File 01 before file 02. No competing identity/event/approval models.
- Empty / `*` WhatsApp allowlist is open (already shipped, not this effort).
- 01–05 implemented: registration capability, signed WhatsApp events, versioned owner approval, newest history, payment evidence. See ADR 0002.

## Not yet specified

- Live GBP write access and Meta production recipient limits.
- Recurring Stripe Billing (0.7 %) vs current one-off Checkout — needs an ADR in file 02.
