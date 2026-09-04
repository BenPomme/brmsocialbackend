import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyInbound } from "../classify-inbound";
import { coerceRoute, parseTurn, repeats } from "./route";

/** Prod 16:43: model said hello; coerceRoute sent onboard_wait. */
test("hello? anyone? on wait_google is not rewritten to onboard_wait", () => {
  assert.notEqual(coerceRoute("hello", "wait_google", "hello? anyone?"), "onboard_wait");
});

/** Last onboard step: next === current, so bumping loops the wait blob. */
test("Ok on wait_google does not resend onboard_wait", () => {
  assert.notEqual(coerceRoute("onboard_wait", "wait_google", "Ok"), "onboard_wait");
});

test("Stop sending this is a stop", () => {
  assert.equal(classifyInbound("Stop sending this"), "stop");
});

test("stopped phase does not coerce into onboard_wait", () => {
  assert.equal(coerceRoute("hello", "wait_google", "hello? anyone?", "stopped"), "human");
});

test("repeats blocks sending the same WhatsApp twice", () => {
  const blob =
    "Step 3: invite reviews@babyrock.ai (paste the email exactly). Not your password. Reply YES when it’s pasted.";
  assert.equal(repeats(blob, [blob]), true);
  assert.equal(repeats("Something else entirely about hours.", [blob]), false);
});

test("prose without JSON is still a WhatsApp reply", () => {
  const t = parseTurn(
    "Hola, ¿qué tal? BabyRock Social te ayuda a mejorar tu visibilidad en Google con reseñas.",
  );
  assert.ok(t);
  assert.equal(t!.route, "hello");
  assert.match(t!.reply, /BabyRock Social/);
});
