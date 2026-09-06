import assert from "node:assert/strict";
import { test } from "node:test";
import { detectConvoLang, guessLocale } from "./lang";

test("German, Arabic and Japanese are not classified as Spanish", () => {
  assert.equal(guessLocale("Das ist zu teuer, ich möchte bitte den Preis wissen."), "de");
  assert.equal(guessLocale("كم سعر الخدمة الشهرية؟"), "ar");
  assert.equal(guessLocale("月額はいくらですか"), "ja");
  assert.notEqual(guessLocale("Das ist zu teuer, ich möchte bitte den Preis wissen."), "es");
});

test("short OK does not reset a remembered language", () => {
  assert.equal(guessLocale("ok", "fr"), "fr");
  assert.equal(detectConvoLang("ok", null, "fr"), "fr");
});
