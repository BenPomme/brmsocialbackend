/**
 * Creates / updates Stripe Products + Prices from src/lib/skus.ts (test or live, selon la clé).
 * Lookup keys: avis_month, avis_year, avis_wa_month.
 *
 *   npx tsx scripts/stripe-sync-skus.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";
import { liveSkus, splitTtc, type Sku } from "../src/lib/skus";

for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const k = t.slice(0, i);
  let v = t.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("STRIPE_SECRET_KEY missing");
  process.exit(1);
}

const stripe = new Stripe(key);

async function ensureProduct() {
  const list = await stripe.products.list({ limit: 100, active: true });
  const found = list.data.find((p) => p.metadata?.catalog === "babyrock");
  if (found) {
    console.log("product", found.id, found.name);
    return found;
  }
  const created = await stripe.products.create({
    name: "BabyRock Social",
    description: "Respuestas a reseñas de Google para comercios.",
    metadata: { catalog: "babyrock", product_id: "social" },
  });
  console.log("product created", created.id);
  return created;
}

async function ensurePrice(productId: string, sku: Sku) {
  const split = splitTtc(sku.ttc);
  const listed = await stripe.prices.list({ lookup_keys: [sku.lookupKey], active: true, limit: 1 });
  const current = listed.data[0];
  if (
    current &&
    current.unit_amount === sku.ttc &&
    current.currency === "eur" &&
    current.recurring?.interval === sku.interval
  ) {
    console.log("price ok", sku.lookupKey, current.id, sku.ttc);
    return current;
  }
  if (current) {
    await stripe.prices.update(current.id, { active: false, lookup_key: `${sku.lookupKey}_old_${Date.now()}` });
    console.log("price retired", current.id, "was", current.unit_amount);
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: sku.ttc,
    recurring: { interval: sku.interval },
    lookup_key: sku.lookupKey,
    transfer_lookup_key: true,
    nickname: `${sku.label} TTC`,
    metadata: {
      sku: sku.id,
      ttc: String(sku.ttc),
      ht: String(split.ht),
      iva: String(split.iva),
      display: "ttc",
    },
  });
  console.log("price created", sku.lookupKey, created.id, sku.ttc);
  return created;
}

async function main() {
  const product = await ensureProduct();
  for (const sku of liveSkus()) {
    await ensurePrice(product.id, sku);
  }
  console.log("done. Checkout still splits HT+IVA on the session; these Prices are the catalogue TTC.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
