import assert from "node:assert/strict";
import { test } from "node:test";
import { capabilityMatches, hashCapability, issueCapability } from "./capability";

test("issued capability matches its hash and a forged token does not", async () => {
  const issued = await issueCapability();
  assert.equal(await capabilityMatches(issued.token, issued.hash), true);
  assert.equal(await capabilityMatches("forged-token", issued.hash), false);
  assert.equal(await hashCapability(issued.token), issued.hash);
});
