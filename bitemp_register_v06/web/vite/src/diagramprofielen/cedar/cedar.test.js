// cedar.test.js — Cedar-profiel: lezer, schrijver, adapter (heen en terug), afleiding.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/cedar/cedar.test.js
//
// De EST-verwachtingen hieronder zijn de uitvoer van cedar-wasm 4.15.0 (`policyToJson`) voor
// dezelfde tekst, eenmalig vergeleken (8/8 policies gelijk, ook de sleutelvolgorde; schrijver →
// wasm geeft weer dezelfde EST). cedar-wasm is geen afhankelijkheid: het weigert de PABC-vorm.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { leesPolicies, leesExpressie, ontsnap } from "./lezer.js";
import { policyTekst, expressieTekst, policySetJson } from "./schrijver.js";
import { vanCedar, naarCedar, lijktOpCedar, typeTekst, typeJson } from "./adapter.js";
import { leidAf, registreerCedar, CEDAR_ID, policyRegels } from "./index.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lees = (f) => readFileSync(path.resolve(hier, "fixtures", f), "utf8");
const VOORBEELD = lees("pabc-voorbeeld.cedar");
const LIJST = lees("pabc-voorbeeld.openftv.json");

test("lezer: scope, annotaties en condities als de EST van Cedar", () => {
  const [p] = leesPolicies('@id("p1") @reason("x \\"q\\" y") @leeg\nforbid (principal == User::"alice", action == Action::"view", resource in Folder::"f1") when { true };');
  assert.deepEqual(p.est, {
    effect: "forbid",
    principal: { op: "==", entity: { type: "User", id: "alice" } },
    action: { op: "==", entity: { type: "Action", id: "view" } },
    resource: { op: "in", entity: { type: "Folder", id: "f1" } },
    conditions: [{ kind: "when", body: { Value: true } }],
    annotations: { id: "p1", leeg: null, reason: 'x "q" y' },
  });
  const [q] = leesPolicies('permit (principal is User in Group::"g", action in [Action::"a", NS::Action::"b"], resource is NS::Doc,);');
  assert.deepEqual(q.est.principal, { op: "is", entity_type: "User", in: { entity: { type: "Group", id: "g" } } });
  assert.deepEqual(q.est.action, { op: "in", entities: [{ type: "Action", id: "a" }, { type: "NS::Action", id: "b" }] });
});

test("lezer: expressies (voorrang, methoden, has-pad, like, if, extensies)", () => {
  assert.deepEqual(leesExpressie('principal.r.contains("x") && resource.d.isEmpty()'), {
    "&&": { left: { contains: { left: { ".": { left: { Var: "principal" }, attr: "r" } }, right: { Value: "x" } } }, right: { isEmpty: { arg: { ".": { left: { Var: "resource" }, attr: "d" } } } } },
  });
  assert.deepEqual(leesExpressie("principal has a.b.c"), { has: { left: { Var: "principal" }, attr: ["a", "b", "c"] } });
  assert.deepEqual(leesExpressie('context.x like "a*b\\*c"'), { like: { left: { ".": { left: { Var: "context" }, attr: "x" } }, pattern: [{ Literal: "a" }, "Wildcard", { Literal: "b*c" }] } });
  assert.deepEqual(leesExpressie("-principal.n + 2 * 3 - -4 < 10"), {
    "<": { left: { "-": { left: { "+": { left: { neg: { arg: { ".": { left: { Var: "principal" }, attr: "n" } } } }, right: { "*": { left: { Value: 2 }, right: { Value: 3 } } } } }, right: { Value: -4 } } }, right: { Value: 10 } },
  });
  assert.deepEqual(leesExpressie('context.ip.isInRange(ip("10.0.0.0/8"))'), { isInRange: [{ ".": { left: { Var: "context" }, attr: "ip" } }, { ip: [{ Value: "10.0.0.0/8" }] }] });
  assert.equal(ontsnap('"a\\nb\\u{41}"'), "a\nbA");
  assert.throws(() => leesPolicies("permit (principal, action);"), /regel 1, kolom \d+: verwacht ","/);
});

test("schrijver: wat hij schrijft leest de lezer terug als dezelfde EST", () => {
  const teksten = [
    'permit (principal, action, resource) when { if principal.level > 3 then true else context.x like "a*b\\*c" };',
    'forbid (principal in Group::"g", action == Action::"x", resource) unless { !(context has token) || resource["sp ace"] != "q" };',
    'permit (principal, action, resource) when { {a: 1, "b c": [1, "x", User::"u"]}.a == 1 && (1 + 2) * 3 == 9 };',
  ];
  for (const t of teksten) {
    const est = leesPolicies(t)[0].est;
    assert.deepEqual(leesPolicies(policyTekst(est))[0].est, est, t);
  }
  assert.equal(expressieTekst(leesExpressie("(a || b) && c".replace(/[abc]/g, (x) => `context.${x}`))), "(context.a || context.b) && context.c");
  assert.deepEqual(Object.keys(policySetJson([{ id: "x", est: {} }])), ["staticPolicies", "templates", "templateLinks"]);
});

test("PABC-vorm: elke policy van het voorbeeld komt uit de EST byte voor byte terug", () => {
  const pols = leesPolicies(VOORBEELD);
  assert.equal(pols.length, 5);
  assert.equal(pols.map((p) => policyTekst(p.est)).join("\n\n") + "\n", VOORBEELD);
  assert.deepEqual(pols[1].est.action.entities[0], { type: "name", id: "zaakafhandelcomponent/behandelaar" });
});

test("adapter: Cedar-tekst in, schema afgeleid, meldingen, en dezelfde tekst terug", () => {
  const { elements, diagrams, meldingen } = vanCedar(VOORBEELD, { bestandsnaam: "pabc-voorbeeld.cedar" });
  const soort = (s) => Object.values(elements).filter((el) => el.elementType === s);
  assert.equal(soort("policy").length, 5);
  assert.deepEqual(soort("entiteittype").map((e) => e.naam).sort(), ["pabc_applicatie", "pabc_entiteittype", "pabc_gebruiker"]);
  const gebruiker = soort("entiteittype").find((e) => e.naam === "pabc_gebruiker");
  assert.deepEqual(gebruiker.compartimenten[0].velden.map((v) => [v.naam, v.data.typeLabel]), [["functioneleRollen", "Set<String>"]]);
  assert.deepEqual(soort("entiteittype").find((e) => e.naam === "pabc_entiteittype").compartimenten[0].velden.map((v) => [v.naam, v.data.typeLabel]), [["domeinen", "Set<String>"]]);
  assert.equal(soort("actie").length, 5);
  const brp = soort("actie").find((a) => a.naam === "zaakafhandelcomponent/brp_zoeken");
  assert.equal(brp.data.actietype, "name");
  assert.ok(soort("geldtVoor").some((l) => l.source === brp.id && elements[l.target].naam === "pabc_applicatie" && l.data.rol === "resource"));
  // Scope-pijlen (afgeleid): policy → gebruiker, entiteittype, acties.
  const beheer = soort("policy")[0];
  assert.deepEqual(soort("scope").filter((s) => s.source === beheer.id).map((s) => s.data.rol).sort(), ["action", "action", "principal", "resource"]);
  assert.equal(Object.values(diagrams)[0].nodes.length, 5 + 3 + 5);
  // Meldingen: de actievorm (één keer), het uitgezette startbeleid, het afgeleide schema.
  assert.equal(meldingen.filter((m) => /moet een actie type Action hebben/.test(m.bericht)).length, 1);
  assert.ok(meldingen.some((m) => /voorbeeld\.startbeleid|policy4/.test(m.bericht) && /geldt nooit/.test(m.bericht)));
  assert.ok(meldingen.some((m) => /3 entiteittype\(n\) en 5 actie\(s\) afgeleid/.test(m.bericht)));
  // De regels in de kaart.
  assert.deepEqual(policyRegels(soort("policy")[1]).map((c) => c.velden.map((v) => v.naam)), [
    ['@reason("medewerkers: domein voorbeeld-a")'],
    ["principal is pabc_gebruiker", 'action in [name::"zaakafhandelcomponent/behandelaar", name::"zaakafhandelcomponent/raadpleger"]', "resource is pabc_entiteittype"],
    ['when { principal.functioneleRollen.contains("medewerkers") && resource.domeinen.contains("voorbeeld-a") }'],
  ]);
  assert.equal(naarCedar({ elements }).tekst, VOORBEELD);
});

test("adapter: Open FTV-lijst heen en terug, byte voor byte; titel wijzigen gaat mee", () => {
  const { elements, meldingen } = vanCedar(LIJST, { bestandsnaam: "pabc-voorbeeld.openftv.json" });
  assert.ok(!meldingen.some((m) => m.niveau === "fout"));
  assert.deepEqual(Object.values(elements).filter((e) => e.elementType === "policy").map((e) => e.naam), ["voorbeeld.beheerders.alle", "voorbeeld.medewerkers.domein-a", "voorbeeld.medewerkers.domein-b", "voorbeeld.medewerkers.applicatie", "voorbeeld.startbeleid"]);
  assert.equal(naarCedar({ elements }, { vorm: "openftv" }).tekst, LIJST);
  assert.equal(naarCedar({ elements }).tekst, VOORBEELD);
  const pol = elements["pol_voorbeeld_beheerders_alle"];
  pol.data = { ...pol.data, titel: "Nieuwe titel" };
  assert.equal(JSON.parse(naarCedar({ elements }, { vorm: "openftv" }).tekst)[0].metadata.title, "Nieuwe titel");
});

test("adapter: JSON-policyset heen en terug; een gewijzigde tekst wordt opnieuw gelezen", () => {
  const { elements } = vanCedar(VOORBEELD);
  const json = naarCedar({ elements }, { vorm: "json" }).tekst;
  const terug = vanCedar(json);
  assert.equal(naarCedar({ elements: terug.elements }).tekst, VOORBEELD);
  // Bewerken: de tekst van een policy wijzigen → leidAf leest hem opnieuw, scope-pijlen volgen.
  const pol = Object.values(elements).find((e) => e.elementType === "policy");
  const els = { ...elements, [pol.id]: { ...pol, data: { ...pol.data, tekst: pol.data.tekst.replace("permit", "forbid").replace("resource is pabc_entiteittype", 'resource == pabc_applicatie::"zaakafhandelcomponent"') } } };
  const na = leidAf(els);
  assert.equal(na[pol.id].data.effect, "forbid");
  assert.equal(na[pol.id].data.fout, "");
  assert.ok(Object.values(na).some((s) => s.elementType === "scope" && s.source === pol.id && na[s.target].naam === "pabc_applicatie"));
  assert.equal(leidAf(na), null, "idempotent");
  const kapot = leidAf({ ...na, [pol.id]: { ...na[pol.id], data: { ...na[pol.id].data, tekst: "permit (principal" } } });
  assert.match(kapot[pol.id].data.fout, /regel 1/);
  assert.match(naarCedar({ elements: kapot }).meldingen[0].bericht, /tekst ongewijzigd geschreven/);
});

test("schema: JSON in en uit, typen als tekst", () => {
  const schema = {
    "": {
      entityTypes: {
        Gebruiker: { memberOfTypes: ["Groep"], shape: { type: "Record", attributes: { rollen: { type: "Set", element: { type: "String" } }, leeftijd: { type: "Long", required: false } } } },
        Groep: { shape: { type: "Record", attributes: {} } },
        Dossier: { shape: { type: "Record", attributes: { eigenaar: { type: "Entity", name: "Gebruiker" } } } },
      },
      actions: { bekijken: { appliesTo: { principalTypes: ["Gebruiker"], resourceTypes: ["Dossier"] } }, wijzigen: { memberOf: [{ id: "bekijken" }], appliesTo: { principalTypes: ["Gebruiker"], resourceTypes: ["Dossier"] } } },
    },
  };
  const { elements } = vanCedar(JSON.stringify(schema));
  assert.equal(Object.values(elements).filter((e) => e.elementType === "entiteittype").length, 3);
  assert.ok(Object.values(elements).some((e) => e.elementType === "lid" && elements[e.source].naam === "Gebruiker" && elements[e.target].naam === "Groep"));
  assert.deepEqual(JSON.parse(naarCedar({ elements }, { vorm: "schema" }).tekst), schema);
  assert.equal(typeTekst({ type: "Set", element: { type: "Boolean" } }), "Set<Bool>");
  assert.deepEqual(typeJson("Set<String>"), { type: "Set", element: { type: "String" } });
});

test("profiel: registratie en herkenning", () => {
  registreerCedar();
  assert.equal(getDiagramType(CEDAR_ID)?.id, CEDAR_ID);
  assert.ok(lijktOpCedar({ naam: "x.cedar", tekst: VOORBEELD }) >= 0.9);
  assert.ok(lijktOpCedar({ naam: "x.json", tekst: LIJST }) >= 0.7);
  assert.equal(lijktOpCedar({ naam: "x.ttl", tekst: "@prefix ex: <urn:x> ." }), 0);
});

// Alleen lokaal: de echte PABC-policies van Open FTV (privé, niet in deze repo). Overgeslagen als
// het bestand er niet is.
const ECHT = "D:/Git/CG/Fundament/docs/ftv/pabc-policies-cedar.json";
// Bij een fout alleen tellingen en de plek van het verschil, nooit de inhoud (die is privé).
test("lokaal: de echte PABC-lijst heen en terug, byte voor byte (op de regeleinden na)", { skip: !existsSync(ECHT) && "privébestand niet aanwezig" }, () => {
  // Het bestand heeft CRLF en geen regeleinde aan het eind; de export LF en wel een.
  const tekst = readFileSync(ECHT, "utf8").replace(/\r\n/g, "\n").replace(/\n?$/, "\n");
  const { elements, meldingen } = vanCedar(tekst);
  assert.equal(meldingen.filter((m) => m.niveau === "fout").length, 0, "leesfouten");
  assert.equal(Object.values(elements).filter((e) => e.elementType === "policy").length, JSON.parse(tekst).length);
  const terug = naarCedar({ elements }, { vorm: "openftv" }).tekst;
  let i = 0;
  while (i < tekst.length && tekst[i] === terug[i]) i += 1;
  assert.ok(terug === tekst, `eerste verschil op positie ${i} van ${tekst.length}`);
});
