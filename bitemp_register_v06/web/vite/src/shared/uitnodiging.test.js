import { test } from "node:test";
import assert from "node:assert/strict";
import { uitnodigingToken, voorgesteldeGebruikersnaam } from "./uitnodiging.js";
import { toegangVoorOpslaan } from "../studio/activities/projectSync.js";

const T = "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDEFG";

test("uitnodigingToken uit het fragment", () => {
  assert.equal(uitnodigingToken(`#uitnodiging=${T}`), T);
  assert.equal(uitnodigingToken(`#tab=x&uitnodiging=${T}`), T);
  assert.equal(uitnodigingToken("#uitnodiging=kort"), null);
  assert.equal(uitnodigingToken("#iets=anders"), null);
  assert.equal(uitnodigingToken(""), null);
});

test("voorgestelde gebruikersnaam: deel vóór de @, alleen als het mag", () => {
  assert.equal(voorgesteldeGebruikersnaam("anna.de-vries@voorbeeld.nl"), "anna.de-vries");
  assert.equal(voorgesteldeGebruikersnaam("a+b@x.nl"), ""); // "ab" is te kort
  assert.equal(voorgesteldeGebruikersnaam("jo@x.nl"), "");
  assert.equal(voorgesteldeGebruikersnaam(""), "");
});

test("toegangVoorOpslaan: trimmen, lege weg, laatste telt, onbekend recht = lezen", () => {
  assert.deepEqual(
    toegangVoorOpslaan([{ subject: " anna ", recht: "schrijven" }, { subject: "", recht: "lezen" }, { subject: "*", recht: "x" }, { subject: "anna", recht: "lezen" }]),
    [{ subject: "anna", recht: "lezen" }, { subject: "*", recht: "lezen" }],
  );
  assert.deepEqual(toegangVoorOpslaan(null), []);
});
