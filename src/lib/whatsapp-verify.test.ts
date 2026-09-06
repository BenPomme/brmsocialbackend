import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  assertReceivingAccount,
  assertWhatsappSignature,
  verifyHubSignature,
  WhatsappWebhookError,
} from "./whatsapp-verify";

const secret = "test-app-secret";
const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

function sign(body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

test("valid signature succeeds", () => {
  assert.equal(verifyHubSignature(raw, sign(raw), secret), true);
});

test("missing signature is rejected", () => {
  assert.equal(verifyHubSignature(raw, null, secret), false);
  assert.throws(() => assertWhatsappSignature(raw, null, secret), (e: unknown) => {
    return e instanceof WhatsappWebhookError && e.status === 401;
  });
});

test("one changed byte of a signed payload is rejected", () => {
  const header = sign(raw);
  assert.equal(verifyHubSignature(raw + "x", header, secret), false);
  const flipped = `${header.slice(0, -1)}${header.endsWith("a") ? "b" : "a"}`;
  assert.equal(verifyHubSignature(raw, flipped, secret), false);
});

test("missing app secret fails closed", () => {
  assert.throws(() => assertWhatsappSignature(raw, sign(raw), undefined), (e: unknown) => {
    return e instanceof WhatsappWebhookError && e.status === 503;
  });
});

test("unrelated receiving phone is rejected", () => {
  assert.throws(
    () =>
      assertReceivingAccount({
        phoneNumberId: "111",
        wabaId: "waba",
        expectedPhoneId: "222",
        expectedWabaId: "waba",
      }),
    (e: unknown) => e instanceof WhatsappWebhookError && e.status === 403,
  );
});
