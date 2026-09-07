import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogQuoteResult, isToolId, validatedQuoteCity } from "./tools";

test("only listed tools are executable", () => {
  assert.equal(isToolId("get_catalog_quote"), true);
  assert.equal(isToolId("create_checkout"), true);
  assert.equal(isToolId("get_invoice"), true);
  assert.equal(isToolId("cancel_service"), true);
  assert.equal(isToolId("create_support_case"), true);
  assert.equal(isToolId("publish_google"), false);
});

test("catalogue quote is Social only, with month and year", () => {
  const q = catalogQuoteResult(null);
  assert.equal(q.productId, "social");
  assert.equal(q.monthLabel.includes("99"), true);
  assert.equal(q.yearLabel.includes("990"), true);
  assert.equal(q.offer, null);
});

test("model-claimed Sant Cugat without customer or known city is not an offer", () => {
  const city = validatedQuoteCity({
    claimed: "Sant Cugat del Vallès",
    knownCity: null,
    inbound: "how much is it per month?",
  });
  assert.equal(catalogQuoteResult(city).offer, null);
});
