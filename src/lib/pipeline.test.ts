import assert from "node:assert/strict";
import { test } from "node:test";
import { citiesFromScopeTokens } from "./categories";
import { hasTo, isPitchable, pipelineStatus, REVIEW_FLOOR } from "./pipeline";

test("scope chat: Rubi is a city even off the alias list", () => {
  const cities = citiesFromScopeTokens(["active", "rubi", "categorie", "beauty"], "ES");
  assert.equal(cities.length, 1);
  assert.equal(cities[0].name, "Rubi");
  assert.equal(cities[0].country, "ES");
});

test("scope chat: Sant Cugat two-word alias", () => {
  const cities = citiesFromScopeTokens(["active", "sant", "cugat", "restaurant"], null);
  assert.equal(cities[0].name, "Sant Cugat del Vallès");
});

test("pitchable needs 50 reviews and <15% replies", () => {
  assert.equal(
    isPitchable({
      userRatingCount: REVIEW_FLOOR,
      inspectReviews6m: 20,
      inspectReplied6m: 2,
      inspectVerdict: "partial",
    }),
    true,
  );
  assert.equal(
    isPitchable({
      userRatingCount: 49,
      inspectReviews6m: 20,
      inspectReplied6m: 0,
      inspectVerdict: "orphan",
    }),
    false,
  );
});

test("approve path: needs_contact without To, draft with body", () => {
  const base = {
    source: "scout",
    email: null as string | null,
    outreachTo: null as string | null,
    waSite: null as string | null,
    outreachStatus: null as string | null,
    outreachBody: null as string | null,
    userRatingCount: 80,
    inspectReviews6m: 10,
    inspectReplied6m: 0,
    inspectVerdict: "orphan",
  };
  assert.equal(pipelineStatus(base, null), "needs_contact");
  assert.equal(hasTo(base), false);
  assert.equal(pipelineStatus({ ...base, email: "a@b.com", outreachBody: "Hola" }, null), "draft");
  assert.equal(pipelineStatus({ ...base, email: "a@b.com", outreachStatus: "approved", outreachBody: "Hola" }, null), "approved");
  assert.equal(pipelineStatus(base, { status: "paye" }), "paid");
  assert.equal(pipelineStatus(base, { status: "lead", stripeCustomerId: "cus_fixture_unpaid" }), "needs_contact");
  assert.equal(pipelineStatus(base, { status: "essai" }), "paid");
});
