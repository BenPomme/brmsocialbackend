import assert from "node:assert/strict";
import { test } from "node:test";
import { definedBillingPatch } from "./pay";

test("omitted billing fields are not present on the patch", () => {
  const patch = definedBillingPatch({
    name: "New Shop",
    email: "owner@example.invalid",
  });
  assert.equal(patch.name, "New Shop");
  assert.equal(patch.billingEmail, "owner@example.invalid");
  assert.equal("taxId" in patch, false);
  assert.equal("legalName" in patch, false);
  assert.equal("billingLine1" in patch, false);
});

test("blank strings do not clear existing fiscal data", () => {
  const patch = definedBillingPatch({
    name: "New Shop",
    taxId: "",
    legalName: "   ",
  });
  assert.equal("taxId" in patch, false);
  assert.equal("legalName" in patch, false);
});
