// naarCanoniek.test.js — SHACL-shapes → canoniek model, met de ODRL-kern als proef.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/shacl/naarCanoniek.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { vanTurtle } from "./adapter.js";
import { shaclNaarCanoniek, voegCanoniekIn, typeVoorXsd, lokaleNaam } from "./naarCanoniek.js";
import { canoniekNaarShacl } from "./vanCanoniek.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const KERN = readFileSync(path.resolve(hier, "../../../../../model-exchange/linked-data/odrl22-kern.shacl.ttl"), "utf8");
const odrl = () => shaclNaarCanoniek(vanTurtle(KERN, {}), { titel: "ODRL" });
const perNaam = (els) => new Map(Object.values(els).filter((el) => el.naam).map((el) => [el.naam, el]));
const lijn = (els, soort, van, naar) => Object.values(els).find((el) => el.elementType === soort && els[el.source]?.naam === van && els[el.target]?.naam === naar);

test("hulpjes: lokale naam en xsd-type", () => {
  assert.equal(lokaleNaam("odrl:Policy"), "Policy");
  assert.equal(lokaleNaam("<http://www.w3.org/ns/odrl/2/Policy>"), "Policy");
  assert.equal(lokaleNaam("<https://x.nl/model#Zaak>"), "Zaak");
  assert.equal(typeVoorXsd("xsd:dateTime"), "date-time");
  assert.equal(typeVoorXsd("xsd:decimal"), "number");
  assert.equal(typeVoorXsd("", "IRI"), "URL");
  assert.equal(typeVoorXsd("", ""), "");
});

test("ODRL-kern: de klassen van het informatiemodel als entiteiten", () => {
  const { elements } = odrl();
  const ent = Object.values(elements).filter((el) => el.elementType === "entiteit").map((el) => el.naam).sort();
  assert.deepEqual(ent, ["Action", "Agreement", "Asset", "AssetCollection", "Constraint", "Duty", "LeftOperand", "LogicalConstraint", "Offer", "Operator", "Party", "PartyCollection", "Permission", "Policy", "Prohibition", "RightOperand", "Rule", "Set"]);
});

test("een shape voor meer klassen wordt een supertype", () => {
  const { elements, meldingen } = odrl();
  for (const kind of ["Set", "Offer", "Agreement"]) assert.ok(lijn(elements, "generalisatie", kind, "Policy"), `${kind} ▷ Policy`);
  for (const kind of ["Permission", "Prohibition", "Duty"]) assert.ok(lijn(elements, "generalisatie", kind, "Rule"), `${kind} ▷ Rule`);
  assert.ok(meldingen.some((m) => /Rule is supertype van Permission, Prohibition, Duty/.test(m.bericht)));
  // De regels van RuleShape staan bij Rule, niet bij de kinderen.
  assert.ok(lijn(elements, "relatie", "Rule", "Action"));
  assert.ok(!lijn(elements, "relatie", "Permission", "Action"));
});

test("sh:class wordt een relatie met de kardinaliteit uit min/maxCount", () => {
  const { elements } = odrl();
  assert.equal(lijn(elements, "relatie", "Rule", "Action").data.doelKardinaliteit, "1..1");
  assert.equal(lijn(elements, "relatie", "Permission", "Asset").data.doelKardinaliteit, "1..1");
  assert.equal(lijn(elements, "relatie", "Duty", "Asset").data.doelKardinaliteit, "0..1");
  assert.equal(lijn(elements, "relatie", "Policy", "Permission").data.doelKardinaliteit, "0..*");
  assert.equal(lijn(elements, "relatie", "Policy", "Permission").data.naamLabelHeen, "permission");
  // Aantal en klasse in twee property shapes (de kern) → één relatie 1..1.
  const left = Object.values(elements).filter((el) => el.elementType === "relatie" && el.data.naamLabelHeen === "leftOperand");
  assert.equal(left.length, 1);
  assert.equal(left[0].data.doelKardinaliteit, "1..1");
  // sh:or van klassen → één relatie per klasse.
  assert.ok(lijn(elements, "relatie", "Rule", "Constraint"));
  assert.ok(lijn(elements, "relatie", "Rule", "LogicalConstraint"));
  // Relatienamen zijn uniek.
  const namen = Object.values(elements).filter((el) => el.elementType === "relatie").map((el) => el.naam);
  assert.equal(new Set(namen).size, namen.length);
});

test("velden, enumeratie, meervoudige waarden en constraints", () => {
  const { elements } = odrl();
  const n = perNaam(elements);
  const policyVelden = n.get("Policy").compartimenten.find((c) => c.compartmentType === "velden").velden;
  assert.deepEqual(policyVelden.map((v) => [v.naam, v.data.typeLabel, Boolean(v.data.verplicht)]), [["uid", "URL", true], ["conflict", "PolicyConflict", false]]);
  assert.deepEqual(n.get("PolicyConflict").compartimenten[0].velden.map((v) => v.naam), ["perm", "prohibit", "invalid"]);
  // profile en inheritFrom: meer dan één waarde → GE met compositie {meervoudig}.
  const comp = lijn(elements, "compositie", "Policy", "PolicyProfile");
  assert.equal(comp.data.momentvoorkomen, "meervoudig");
  assert.equal(comp.data.kardinaliteit, "0..*");
  // De paden in de xone worden velden, met de constraint erbij.
  const cVelden = n.get("Constraint").compartimenten[0].velden.map((v) => v.naam);
  assert.ok(cVelden.includes("rightOperandReference") && !cVelden.includes("rightOperand"));
  // rightOperand wijst (als documentatie, sh:deactivated) naar odrl:RightOperand: een relatie, zoals leftOperand.
  const right = lijn(elements, "relatie", "Constraint", "RightOperand");
  assert.equal(right.data.naamLabelHeen, "rightOperand");
  assert.equal(right.data.doelKardinaliteit, "0..1");
  const constraints = Object.values(elements).filter((el) => el.elementType === "constraint").map((el) => el.naam);
  assert.ok(constraints.includes("{precies één van rightOperand, rightOperandReference}"));
  assert.ok(constraints.includes("{precies één van or, xone, and, andSequence}"));
  assert.ok(constraints.includes("{minstens één van permission, prohibition, obligation}"));
  assert.ok(constraints.some((c) => /niet van zichzelf/.test(c)));
});

test("diagram en kruisverbanden", () => {
  const { elements, diagrams, kruisverbanden } = odrl();
  const d = diagrams.uit_shacl;
  const knopen = Object.values(elements).filter((el) => !el.source);
  assert.equal(d.nodes.length, knopen.length);
  assert.ok(d.nodes.every((nd) => Number.isFinite(nd.position?.x) && Number.isFinite(nd.position?.y)));
  // Supertype boven het subtype.
  const pos = new Map(d.nodes.map((nd) => [elements[nd.elementId].naam, nd.position]));
  assert.ok(pos.get("Policy").y < pos.get("Offer").y);
  assert.ok(pos.get("Rule").y < pos.get("Permission").y);
  assert.ok(kruisverbanden.some((k) => k.shaclId === "ns_ok_PolicyShape" && elements[k.canoniekId]?.naam === "Policy"));
  assert.ok(kruisverbanden.every((k) => elements[k.canoniekId]));
});

test("opnieuw invoegen vervangt de vorige uitkomst en houdt posities vast", () => {
  const uit = odrl();
  const eerst = voegCanoniekIn({ elements: { eigen: { id: "eigen", naam: "Eigen", elementType: "entiteit" } }, diagrams: {} }, uit, "m1");
  assert.ok(eerst.elements.eigen);
  const policyId = eerst.her("sc_odrl_Policy");
  assert.equal(eerst.elements[policyId].data.uitShacl, "m1");
  const diagram = eerst.diagrams[eerst.diagramId];
  diagram.nodes = diagram.nodes.map((nd) => (nd.elementId === policyId ? { ...nd, position: { x: 7, y: 7 } } : nd));
  const tweede = voegCanoniekIn({ elements: eerst.elements, diagrams: eerst.diagrams }, uit, "m1");
  assert.equal(Object.keys(tweede.elements).length, Object.keys(eerst.elements).length);
  assert.deepEqual(tweede.diagrams[tweede.diagramId].nodes.find((nd) => nd.elementId === policyId).position, { x: 7, y: 7 });
  assert.deepEqual(tweede.weg, []);
});

test("heen en terug: canoniek → SHACL → canoniek houdt entiteiten en relaties", () => {
  const canoniek = {
    elements: {
      zaak: { id: "zaak", naam: "Zaak", elementType: "entiteit", compartimenten: [{ compartmentType: "velden", velden: [{ naam: "omschrijving", data: { typeLabel: "string", verplicht: true } }, { naam: "startdatum", data: { typeLabel: "date" } }] }], data: {} },
      pers: { id: "pers", naam: "Persoon", elementType: "entiteit", compartimenten: [], data: {} },
      r: { id: "r", naam: "ZaakInitiator", elementType: "relatie", source: "zaak", target: "pers", compartimenten: [], data: { doelKardinaliteit: "1..1", naamLabelHeen: "initiator" } },
    },
  };
  const shacl = canoniekNaarShacl(canoniek, {});
  const terug = shaclNaarCanoniek(shacl).elements;
  const n = perNaam(terug);
  assert.ok(n.get("Zaak") && n.get("Persoon"));
  assert.deepEqual(n.get("Zaak").compartimenten[0].velden.map((v) => [v.naam, v.data.typeLabel, Boolean(v.data.verplicht)]), [["omschrijving", "string", true], ["startdatum", "date", false]]);
  assert.equal(lijn(terug, "relatie", "Zaak", "Persoon").data.doelKardinaliteit, "1..1");
});

// ── Rondgang: SHACL → canoniek → SHACL (herkomst.js) ───────────────────────
const zonderAfgeleid = (els) => Object.fromEntries(Object.entries(els).filter(([, el]) => el.elementType !== "verwijzing"));

test("rondgang: ongewijzigd terug geeft dezelfde shapes (ook via de store en een JSON-export)", () => {
  const m = vanTurtle(KERN, {});
  const ingevoegd = JSON.parse(JSON.stringify(voegCanoniekIn({ elements: {}, diagrams: {} }, shaclNaarCanoniek(m, {}), "m1")));
  const terug = canoniekNaarShacl({ elements: ingevoegd.elements }, {});
  assert.deepEqual(terug.meldingen, []);
  // Elk element van de lezer komt terug, met dezelfde id en inhoud; dus schrijft de schrijver dezelfde graaf.
  assert.deepEqual(zonderAfgeleid(terug.elements), zonderAfgeleid(m.elements));
});

test("rondgang: wat in het CM wijzigt, wordt opnieuw afgeleid; de rest blijft letterlijk", () => {
  const m = vanTurtle(KERN, {});
  const els = JSON.parse(JSON.stringify(shaclNaarCanoniek(m, {}).elements));
  const n = (nm) => Object.values(els).find((e) => e.naam === nm);
  const rel = (van, rol) => Object.values(els).find((e) => e.elementType === "relatie" && els[e.source]?.naam === van && e.data.naamLabelHeen === rol);
  rel("Permission", "target").data.doelKardinaliteit = "1..*";
  n("Party").compartimenten.find((c) => c.compartmentType === "velden").velden.push({ naam: "naam", fieldType: "attribuut", data: { typeLabel: "string" } });
  els.lic = { id: "lic", naam: "Licentiehouder", elementType: "entiteit", compartimenten: [], data: {} };
  els.g1 = { id: "g1", naam: "", elementType: "generalisatie", source: "lic", target: n("Party").id, compartimenten: [], data: {} };
  n("PolicyConflict").compartimenten[0].velden.push({ naam: "nieuw", fieldType: "waarde", data: {} });

  const { elements: t, meldingen } = canoniekNaarShacl({ elements: els }, {});
  assert.ok(meldingen.some((x) => /2 onderdeel\/onderdelen uit SHACL zijn in het canonieke model gewijzigd/.test(x.bericht)), JSON.stringify(meldingen));
  const regels = (id) => t[id].compartimenten.find((c) => c.compartmentType === "eigenschappen").velden;
  // Permission.target: nieuw afgeleid, zonder maxCount en zonder de oude melding "precies één".
  const target = regels("ns_ok_PermissionShape").find((r) => r.naam === "odrl:target");
  assert.equal(target.data.klasse, "odrl:Asset");
  assert.equal(target.data.minCount, 1);
  assert.equal(target.data.maxCount, undefined);
  assert.equal(target.data.beschrijving, undefined);
  // De andere regels van Permission en de shape zelf: letterlijk.
  assert.deepEqual(regels("ns_ok_PermissionShape").find((r) => r.naam === "odrl:duty"), m.elements.ns_ok_PermissionShape.compartimenten[0].velden.find((r) => r.naam === "odrl:duty"));
  assert.equal(t.ns_ok_PermissionShape.data.doelklassen, m.elements.ns_ok_PermissionShape.data.doelklassen);
  // Een nieuw veld krijgt de eigen namespace (ok:), niet die van ODRL.
  assert.ok(regels("ns_ok_PartyShape").some((r) => r.naam === "ok:naam" && r.data.datatype === "xsd:string"));
  // Een nieuwe entiteit: shape = klasse in ok:, subklasse naar de ODRL-klasse.
  const lic = Object.values(t).find((el) => el.naam === "Licentiehouder" && el.elementType === "nodeshape");
  assert.equal(lic.data.iri, "ok:Licentiehouder");
  assert.ok(Object.values(t).some((el) => el.elementType === "subklasse" && el.data.van === "ok:Licentiehouder" && el.data.naar === "odrl:Party"));
  // Enumeratie met IRI-waarden: de termen blijven IRI's, de nieuwe waarde is tekst; de ernst blijft.
  const conflict = regels("ns_ok_PolicyShape").filter((r) => r.naam === "odrl:conflict");
  assert.equal(conflict.length, 1);
  assert.equal(conflict[0].data.in, '( odrl:perm odrl:prohibit odrl:invalid "nieuw" )');
});
