// toegangsspraak.test.js — Cedar ↔ Toegangsspraak (fase 2 van "2026-11-25 Cedar als M2").
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/cedar/toegangsspraak.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { vanCedar, naarCedar } from "./adapter.js";
import { cedarNaarToegangsspraak } from "./naarToegangsspraak.js";
import { toegangsspraakNaarCedar, pasPoliciesToe } from "./vanToegangsspraak.js";
import { cedarWoordenschat, standaardWoord, standaardKenmerk } from "./woordenschat.js";
import { CEDAR_NAAR_TOEGANGSSPRAAK, TOEGANGSSPRAAK_NAAR_CEDAR } from "./toegangsspraakRegels.js";
import { valideerRegelset } from "../../transformatie/regels.js";
import { toegangsspraakNaarOdrl } from "../../toegangsspraak/odrlExport.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lees = (f) => readFileSync(path.resolve(hier, "fixtures", f), "utf8");
const LIJST = lees("pabc-voorbeeld.openftv.json");

/** Het model zonder policies: alleen het (afgeleide) schema, de woordenschat. */
const alleenSchema = (m) => ({ elements: Object.fromEntries(Object.entries(m.elements).filter(([, e]) => e.elementType !== "policy" && e.elementType !== "scope")) });
/** Wat een policy zegt, zonder annotaties en ongeacht `action == x` of `action in [x]`. */
const inhoud = (est) => {
  const a = est.action;
  const acties = a.op === "==" ? [a.entity] : a.entities;
  return JSON.stringify([est.effect, est.principal, acties, est.resource, est.conditions || []]);
};

test("regelsets zijn geldig", () => {
  assert.deepEqual(valideerRegelset(CEDAR_NAAR_TOEGANGSSPRAAK), []);
  assert.deepEqual(valideerRegelset(TOEGANGSSPRAAK_NAAR_CEDAR), []);
});

test("woordenschat: handeling uit de naam, kenmerk rol uit …Rollen, meerwaardig uit Set", () => {
  assert.equal(standaardWoord("zaakafhandelcomponent/behandelaar"), "behandelaar");
  assert.equal(standaardWoord("Action::view-all"), "view_all");
  assert.equal(standaardKenmerk("functioneleRollen"), "rol");
  assert.equal(standaardKenmerk("afdelingCode"), "afdeling code");
  const ws = cedarWoordenschat(vanCedar(LIJST).elements);
  assert.equal(ws.acties.length, 5);
  assert.equal(ws.actieVoorWoord("brp_zoeken")?.naam, "zaakafhandelcomponent/brp_zoeken");
  const rol = ws.attribuut(["pabc_gebruiker"], "rol");
  assert.equal(rol?.naam, "functioneleRollen");
  assert.equal(rol?.meerwaardig, true);
});

test("PABC → Toegangsspraak: één regel per policy en actie, de rol in de zin", () => {
  const r = cedarNaarToegangsspraak(vanCedar(LIJST), { naam: "PABC" });
  assert.equal(
    r.tekst,
    `Beleid "PABC".
  Standaard: weigeren.

  Regel "voorbeeld.beheerders.alle administrator".
    Iemand met rol "beheerders" mag alle gegevens van een pabc entiteittype administrator.

  Regel "voorbeeld.beheerders.alle beheerder".
    Iemand met rol "beheerders" mag alle gegevens van een pabc entiteittype beheerder.

  Regel "voorbeeld.medewerkers.domein-a behandelaar".
    Iemand met rol "medewerkers" mag alle gegevens van een pabc entiteittype behandelaar
    als de domeinen van de gegevens "voorbeeld-a" is.

  Regel "voorbeeld.medewerkers.domein-a raadpleger".
    Iemand met rol "medewerkers" mag alle gegevens van een pabc entiteittype raadpleger
    als de domeinen van de gegevens "voorbeeld-a" is.

  Regel "voorbeeld.medewerkers.domein-b".
    Iemand met rol "medewerkers" mag alle gegevens van een pabc entiteittype raadpleger
    als de domeinen van de gegevens "voorbeeld-b" is.

  Regel "voorbeeld.medewerkers.applicatie".
    Iemand met rol "medewerkers" mag alle gegevens van een pabc applicatie brp_zoeken
    als de id van de gegevens "zaakafhandelcomponent" is.
`,
  );
  // Het startbeleid (when { false }) valt weg, met een melding; de betekenis verandert niet.
  assert.deepEqual(r.vertaald.length, 4);
  assert.ok(r.meldingen.some((m) => m.niveau === "info" && /startbeleid: geldt nooit/.test(m.bericht)));
});

test("rondreis met het model als basis: de Open FTV-lijst komt byte voor byte terug", () => {
  const m = vanCedar(LIJST);
  const heen = cedarNaarToegangsspraak(m, { naam: "PABC" });
  const terug = toegangsspraakNaarCedar(heen.tekst, { staat: m });
  assert.deepEqual(terug.policies.map((p) => p.status), ["ongewijzigd", "ongewijzigd", "ongewijzigd", "ongewijzigd", "behouden"]);
  const uit = naarCedar({ elements: pasPoliciesToe(m, terug.policies).elements }, { vorm: "openftv" }).tekst;
  assert.equal(uit, LIJST.replace(/\r\n/g, "\n"));
});

test("rondreis zonder policies in het model: dezelfde inhoud (annotaties en schrijfwijze van de actie daargelaten)", () => {
  const m = vanCedar(LIJST);
  const terug = toegangsspraakNaarCedar(cedarNaarToegangsspraak(m, { naam: "PABC" }).tekst, { staat: alleenSchema(m) });
  const origineel = Object.values(m.elements).filter((e) => e.elementType === "policy" && !/startbeleid/.test(e.naam));
  assert.equal(terug.policies.length, origineel.length);
  for (const p of terug.policies) {
    assert.equal(p.status, "nieuw");
    assert.equal(inhoud(p.est), inhoud(origineel.find((o) => o.naam === p.naam).data.cedar), p.naam);
    assert.deepEqual(p.est.annotations, { id: p.naam });
  }
});

test("bewerkte Toegangsspraak: gewijzigd (met @reason), gesplitst, nieuw verbod, vervallen", () => {
  const m = vanCedar(LIJST);
  let tekst = cedarNaarToegangsspraak(m, { naam: "PABC" }).tekst;
  // Domein b wordt c; domein a alleen voor de behandelaar anders; beheerders weg; een nieuw verbod.
  tekst = tekst.replace('"voorbeeld-b"', '"voorbeeld-c"');
  tekst = tekst.replace(/(Regel "voorbeeld\.medewerkers\.domein-a behandelaar"\.\n.*\n.*)"voorbeeld-a"/, '$1"voorbeeld-x"');
  tekst = tekst.replace(/ {2}Regel "voorbeeld\.beheerders\.alle [a-z]+"\.\n.*\n\n/g, "");
  tekst += `\n  Regel "geheim".\n    Iemand met rol "stagiairs" mag alle gegevens van een pabc entiteittype niet raadpleger\n    als de domeinen van de gegevens "geheim" is.\n`;
  const r = toegangsspraakNaarCedar(tekst, { staat: m });
  const per = Object.fromEntries(r.policies.map((p) => [p.naam, p]));
  assert.equal(per["voorbeeld.medewerkers.domein-b"].status, "gewijzigd");
  assert.match(per["voorbeeld.medewerkers.domein-b"].tekst, /^@reason\("medewerkers: domein voorbeeld-b"\)\npermit \(/);
  assert.match(per["voorbeeld.medewerkers.domein-b"].tekst, /contains\("voorbeeld-c"\)/);
  // De twee regels van domein-a zeggen nu iets anders: twee policies.
  assert.equal(per["voorbeeld.medewerkers.domein-a"].status, "gewijzigd");
  assert.match(per["voorbeeld.medewerkers.domein-a"].tekst, /behandelaar"\],[\s\S]*voorbeeld-x/);
  assert.equal(per["voorbeeld.medewerkers.domein-a raadpleger"].status, "nieuw");
  assert.equal(per.geheim.est.effect, "forbid");
  assert.equal(per["voorbeeld.beheerders.alle"], undefined);
  assert.ok(r.meldingen.some((m) => /Vervallen.*voorbeeld\.beheerders\.alle/.test(m.bericht)));
  // In de Open FTV-lijst: het nieuwe verbod als concept, de bewaarde velden van de rest blijven.
  const lijst = JSON.parse(naarCedar({ elements: pasPoliciesToe(m, r.policies).elements }, { vorm: "openftv" }).tekst);
  assert.equal(lijst.find((i) => i.id === "voorbeeld.medewerkers.domein-b").metadata.regeling, "voorbeeld");
  assert.equal(lijst.find((i) => i.id === "geheim").status, "draft");
});

const ALGEMEEN = `@id("lezen")
permit (principal is Medewerker, action == Action::"lezen", resource is Dossier)
when { principal.afdeling == resource.afdeling && resource.niveau < 3 && (context.kanaal == "balie" || context.kanaal like "web*") };

@id("geheim")
forbid (principal, action, resource is Dossier) when { resource has geheim } unless { principal.rollen.contains("toezicht") };

@id("ip")
permit (principal is Medewerker, action == Action::"lezen", resource is Dossier) when { context.ip.isInRange(ip("10.0.0.0/8")) };
`;

test("algemene condities: pad = pad, getal, of-groep met like, has; nooit ongemerkt ruimer", () => {
  const m = vanCedar(ALGEMEEN);
  const heen = cedarNaarToegangsspraak(m, { naam: "Dossiers" });
  assert.match(heen.tekst, /- de afdeling van de aanvrager is de afdeling van de gegevens;/);
  assert.match(heen.tekst, /van de gegevens is kleiner dan 3;/);
  assert.match(heen.tekst, /- het kanaal van de aanvraag begint met "web"\./);
  assert.match(heen.tekst, /Iedereen mag alle gegevens van een dossier niet lezen\n {4}als de geheim van de gegevens bekend is\./);
  // De permit met een extensie valt weg (strenger); het verbod verliest de uitzondering (ook strenger).
  assert.doesNotMatch(heen.tekst, /Regel "ip"/);
  assert.ok(heen.meldingen.some((x) => x.niveau === "waarschuwing" && /^ip: niet vertaald, het beleid wordt strenger/.test(x.bericht)));
  assert.ok(heen.meldingen.some((x) => x.niveau === "waarschuwing" && /^geheim: het verbod geldt in de Toegangsspraak vaker/.test(x.bericht)));
  // Terug: dezelfde condities.
  const terug = toegangsspraakNaarCedar(heen.tekst, { staat: alleenSchema(m) });
  const lezen = terug.policies.find((p) => p.naam === "lezen");
  assert.equal(inhoud(lezen.est), inhoud(Object.values(m.elements).find((e) => e.naam === "lezen").data.cedar));
});

test("Toegangsspraak → Cedar: doel, betrokkene, plicht, standaard toestaan, conflict", () => {
  const m = vanCedar(LIJST);
  const tekst = `Beleid "Proef".
  Doel: "zaakbehandeling".
  Standaard: toestaan.

  Regel "met doel".
    Iemand met rol "medewerkers" mag alle gegevens van een pabc entiteittype raadpleger.

  Regel "betrokkene".
    Iemand met rol "medewerkers" mag alle gegevens van een pabc entiteittype behandelaar
    als de woonplaats van de betrokkene "Utrecht" is.

  Regel "verbod over de betrokkene".
    Iemand met rol "stagiairs" mag alle gegevens van een pabc entiteittype niet behandelaar
    als aan alle volgende voorwaarden is voldaan:
      - de domeinen van de gegevens is "geheim";
      - de woonplaats van de betrokkene is "Utrecht".

  Regel "met plicht".
    Iemand met rol "medewerkers" mag alle gegevens van een pabc entiteittype beheerder
    waarbij: elke raadpleging wordt vastgelegd in het logboek.
`;
  const r = toegangsspraakNaarCedar(tekst, { staat: alleenSchema(m) });
  const per = Object.fromEntries(r.policies.map((p) => [p.naam, p]));
  // Het doel staat op elke permit, niet op het verbod.
  assert.match(per["met doel"].tekst, /principal\.functioneleRollen\.contains\("medewerkers"\) &&\n {4}context\.doel == "zaakbehandeling"/);
  assert.doesNotMatch(per["verbod over de betrokkene"].tekst, /context\.doel/);
  // Betrokkene en plicht kent Cedar niet: de permit valt weg; het verbod verliest die voorwaarde.
  assert.equal(per.betrokkene, undefined);
  assert.equal(per["met plicht"], undefined);
  assert.match(per["verbod over de betrokkene"].tekst, /resource\.domeinen\.contains\("geheim"\)\n\};$/);
  assert.ok(r.meldingen.some((x) => /^betrokkene: geen policy, het beleid wordt strenger/.test(x.bericht)));
  assert.ok(r.meldingen.some((x) => /^met plicht: geen policy/.test(x.bericht)));
  assert.ok(r.meldingen.some((x) => /^verbod over de betrokkene: het verbod geldt in Cedar vaker/.test(x.bericht)));
  // Standaard toestaan: een permit voor alles.
  assert.match(per["standaard-toestaan"].tekst, /permit \(\n {4}principal,\n {4}action,\n {4}resource\n\);/);
  // Bij conflict: toestemming gaat voor → kan niet, foutmelding.
  const c = toegangsspraakNaarCedar(tekst.replace("Standaard: toestaan.", "Bij conflict: toestemming gaat voor."), { staat: alleenSchema(m) });
  assert.ok(c.meldingen.some((x) => x.niveau === "fout" && /kent Cedar niet/.test(x.bericht)));
});

test("eigen woord per actie (veld handeling); twee keer hetzelfde woord is een fout", () => {
  const m = vanCedar(LIJST);
  const id = Object.values(m.elements).find((e) => e.elementType === "actie" && e.naam.endsWith("/behandelaar")).id;
  m.elements[id] = { ...m.elements[id], data: { ...m.elements[id].data, handeling: "behandelen" } };
  const heen = cedarNaarToegangsspraak(m, { naam: "PABC" });
  assert.match(heen.tekst, /Regel "voorbeeld\.medewerkers\.domein-a behandelen"\.\n.* behandelen\n/);
  const terug = toegangsspraakNaarCedar(heen.tekst, { staat: m });
  assert.ok(terug.policies.every((p) => p.status === "ongewijzigd" || p.status === "behouden"));
  m.elements[id] = { ...m.elements[id], data: { ...m.elements[id].data, handeling: "raadpleger" } };
  assert.ok(cedarWoordenschat(m.elements).meldingen.some((x) => x.niveau === "fout" && /hetzelfde woord "raadpleger"/.test(x.bericht)));
});

test("de Toegangsspraak gaat door naar ODRL-AP-NL zonder verlies (voorproef fase 3)", () => {
  const heen = cedarNaarToegangsspraak(vanCedar(LIJST), { naam: "PABC" });
  const odrl = toegangsspraakNaarOdrl(heen.tekst, { modelNaam: "pabc" });
  assert.equal(odrl.ok, true);
  assert.deepEqual(odrl.trace.filter((t) => t.actie === "geen-regel" || t.actie === "overgeslagen"), []);
  assert.match(odrl.turtle, /apnl:rolAanvrager/);
});

// Alleen lokaal: de echte PABC-policies staan in de privé-repo van Fundament en komen niet in deze
// (publieke) repo. Alleen tellingen in de uitvoer, geen inhoud.
const ECHT = "D:/Git/CG/Fundament/docs/ftv/pabc-policies-cedar.json";
test("lokaal: de echte PABC-policies heen en terug (25 vertaald, 55 regels, lijst gelijk)", { skip: !existsSync(ECHT) }, () => {
  const bron = readFileSync(ECHT, "utf8").replace(/\r\n/g, "\n");
  const m = vanCedar(bron);
  const heen = cedarNaarToegangsspraak(m, { naam: "PABC" });
  const terug = toegangsspraakNaarCedar(heen.tekst, { staat: m });
  const tel = terug.policies.reduce((t, p) => ({ ...t, [p.status]: (t[p.status] || 0) + 1 }), {});
  const uit = naarCedar({ elements: pasPoliciesToe(m, terug.policies).elements }, { vorm: "openftv" }).tekst;
  const gelijk = uit.trimEnd() === bron.trimEnd();
  assert.ok(gelijk && heen.vertaald.length === 25 && heen.beleid.regels.length === 55 && tel.ongewijzigd === 25 && tel.behouden === 1, `vertaald ${heen.vertaald.length}, regels ${heen.beleid.regels.length}, ${JSON.stringify(tel)}, lijst gelijk: ${gelijk}`);
});
