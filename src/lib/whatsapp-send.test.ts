import assert from "node:assert/strict";
import { test } from "node:test";
import { isWhatsappAllowlisted, whatsappAllowlistOpen } from "./whatsapp-send";

const KEY = "WHATSAPP_ALLOWLIST";

function withAllowlist<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env[KEY];
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  }
}

test("empty allowlist is open — anyone can receive", () => {
  withAllowlist("", () => {
    assert.equal(whatsappAllowlistOpen(), true);
    assert.equal(isWhatsappAllowlisted("34611111111"), true);
    assert.equal(isWhatsappAllowlisted("+34 611 111 111"), true);
  });
});

test("* / all / open mean everyone", () => {
  for (const v of ["*", "all", "OPEN"]) {
    withAllowlist(v, () => {
      assert.equal(whatsappAllowlistOpen(), true);
      assert.equal(isWhatsappAllowlisted("15551234567"), true);
    });
  }
});

test("a number list still restricts", () => {
  withAllowlist("34689526449", () => {
    assert.equal(whatsappAllowlistOpen(), false);
    assert.equal(isWhatsappAllowlisted("34689526449"), true);
    assert.equal(isWhatsappAllowlisted("+34 689 526 449"), true);
    assert.equal(isWhatsappAllowlisted("34611111111"), false);
  });
});
