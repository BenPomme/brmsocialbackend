import assert from "node:assert/strict";
import { test } from "node:test";
import { capabilityMatches, hashCapability, issueCapability } from "./capability";

test("issued capability matches its hash and a forged token does not", () => {
  const issued = issueCapability();
  assert.equal(capabilityMatches(issued.token, issued.hash), true);
  assert.equal(capabilityMatches("forged-token", issued.hash), false);
  assert.equal(hashCapability(issued.token), issued.hash);
});
