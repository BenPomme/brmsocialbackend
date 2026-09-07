import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMapsUrl, namesOverlap, pickInviteMatch, scoreInviteMatch } from "./listing";

test("names overlap ignores SL and accents", () => {
  assert.equal(namesOverlap("Cala Sant Cugat", "Cala Sant Cugat S.L."), true);
  assert.equal(namesOverlap("Café Nuria", "Cafe Nuria"), true);
  assert.equal(namesOverlap("Forn de Pa", "Pizzeria Roma"), false);
});

test("one paid client with matching city wins", () => {
  const invite = { name: "Cala Sant Cugat", address: "Carrer de la Plaça 1, Sant Cugat del Vallès" };
  const clients = [
    {
      id: "a",
      name: "Cala Sant Cugat",
      city: "Sant Cugat del Vallès",
      formattedAddress: null,
      placeId: null,
      status: "paye",
      managerInviteStatus: "pending",
    },
    {
      id: "b",
      name: "Bar Roma",
      city: "Barcelona",
      formattedAddress: null,
      placeId: null,
      status: "lead",
      managerInviteStatus: "pending",
    },
  ];
  const picked = pickInviteMatch(invite, clients);
  assert.equal(picked.kind, "one");
  assert.equal(picked.hits[0].id, "a");
});

test("two similar pending shops is many, not a guess", () => {
  const invite = { name: "Bar Central", address: "Barcelona" };
  const clients = [
    {
      id: "a",
      name: "Bar Central",
      city: "Barcelona",
      formattedAddress: null,
      placeId: null,
      status: "paye",
      managerInviteStatus: "pending",
    },
    {
      id: "b",
      name: "Bar Central",
      city: "Barcelona",
      formattedAddress: null,
      placeId: null,
      status: "essai",
      managerInviteStatus: "pending",
    },
  ];
  assert.equal(pickInviteMatch(invite, clients).kind, "many");
  assert.equal(scoreInviteMatch(invite, clients[0]) > 0, true);
});

test("extracts a Google Maps URL", () => {
  const u = extractMapsUrl("aqui https://maps.app.goo.gl/abc123 hola");
  assert.equal(u, "https://maps.app.goo.gl/abc123");
});
