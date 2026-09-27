import { test } from "node:test";
import assert from "node:assert/strict";
import { periodeAs, duurTekst, datumNL } from "./periode.js";

const vandaag = new Date(Date.UTC(2026, 8, 26));

test("as: begin vóór einde, vandaag ertussen, jaren als streepjes", () => {
  const a = periodeAs("2026-01-01", "2027-06-30", vandaag);
  assert.ok(a.begin > 0 && a.begin < a.vandaag && a.vandaag < a.einde && a.einde < 1);
  assert.deepEqual(a.jaren.map((j) => j.jaar), [2026, 2027]);
  assert.equal(a.open, false);
});

test("open einde, omgekeerd, leeg", () => {
  assert.equal(periodeAs("2026-01-01", "", vandaag).open, true);
  assert.equal(periodeAs("2027-01-01", "2026-01-01", vandaag).omgekeerd, true);
  assert.equal(periodeAs("", "", vandaag), null);
});

test("duur en datum in het Nederlands", () => {
  assert.equal(duurTekst("2026-01-01", "2026-01-11"), "10 dagen");
  assert.equal(duurTekst("2026-01-01", "2026-08-01"), "≈ 7 maanden");
  assert.equal(duurTekst("2026-01-01", "2029-01-01"), "≈ 3,0 jaar");
  assert.equal(duurTekst("2026-02-01", "2026-01-01"), "");
  assert.equal(datumNL("2026-09-26"), "26 september 2026");
});

test("as: lange periode (levensloop) — jaartallen uitgedund, hooguit 8", () => {
  const a = periodeAs("1988-04-12", "", new Date(Date.UTC(2026, 8, 27)));
  assert.ok(a.jaren.length <= 8 && a.jaren.length >= 4, `aantal ${a.jaren.length}`);
  assert.ok(a.jaren.every((j) => j.jaar % 5 === 0), a.jaren.map((j) => j.jaar).join(","));
});
