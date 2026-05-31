/**
 * procesContract.js — pure helpers voor het Procescontract: het input- en
 * output-berichttype van een proces of CallActivity. Stap 5 van de "driehoek
 * proces – regels – data".
 *
 * Het procescontract bindt een heel proces (of een aanroep daarvan via een
 * CallActivity) aan het canoniek model: wat gaat erin, wat komt eruit. Bij een
 * CallActivity leidt dat tot PER VELD GETYPEERDE variabele-mapping
 * (camunda:in / camunda:out) in plaats van het beruchte variables="all" — dat
 * laatste liet ooit een niet-gemodelleerde `Plaats`-kolom ongemerkt meeliften.
 *
 * Geen bpmn-js-afhankelijkheid; de modeler-integratie zit in BpmnEditor.jsx.
 * Zie process_engine_v01/docs/driehoek-proces-regels-data.md (§3, §4.3, §5).
 */

import { eventKind } from "./bpmnBinding.js";

/**
 * Een Procescontract is { input: Berichttype|null, output: Berichttype|null }.
 * Berichttype is de vorm uit berichtModel.js: {naam, beschrijving, velden[]}.
 */
export function leegContract() {
  return { input: null, output: null };
}

/** Kan dit element een procescontract dragen? (proces of CallActivity) */
export function isContractDrager(element) {
  const t = element?.businessObject?.$type || element?.$type || "";
  return t === "bpmn:Process" || t === "bpmn:Participant" || t === "bpmn:CallActivity";
}

/** Is dit een CallActivity (getypeerde in/out-mapping van toepassing)? */
export function isCallActivity(element) {
  const t = element?.businessObject?.$type || element?.$type || "";
  return t === "bpmn:CallActivity";
}

/** Mag dit element een berichttype op een event dragen of een contract? */
export function bindbaarSoort(element) {
  if (isContractDrager(element)) return "contract";
  if (eventKind(element)) return "event";
  return null;
}

/**
 * Lees een bestaand procescontract uit een businessObject. Retourneert
 * {input, output} (elk Berichttype-vorm of null). Pure functie.
 */
export function leesContract(businessObject) {
  const ext = businessObject?.extensionElements;
  const values = Array.isArray(ext?.values) ? ext.values : [];
  const contract = values.find((v) => v?.$type === "canoniek:Procescontract");
  if (!contract) return leegContract();
  const berichten = Array.isArray(contract.berichten) ? contract.berichten : [];
  const lees = (kant) => {
    const b = berichten.find((x) => x.kant === kant);
    if (!b) return null;
    return {
      naam: b.naam || "",
      beschrijving: b.beschrijving || "",
      velden: (b.velden || []).map((f) => ({
        // Bewaar de FieldRef-vorm zoals berichtModel verwacht.
        ref: {
          typenaam: f.typenaam || "",
          veldpad: f.veldpad || "",
          veldnaam: f.veldnaam || "",
          type: f.type || "",
          format: f.format || "",
          datatype: f.datatype || "",
          tDimensie: f.t || "formeel",
          afgeleid: Boolean(f.afgeleid),
        },
        verplicht: Boolean(f.verplicht),
      })),
    };
  };
  return { input: lees("input"), output: lees("output") };
}

/**
 * Bereken de getypeerde variabele-mapping voor een CallActivity uit een
 * procescontract. Het input-berichttype levert camunda:in (variabelen die het
 * subproces in gaan), het output-berichttype levert camunda:out.
 *
 * Pure transformatie naar platte mapping-objecten:
 *   { in: [{source, target, t, type}], out: [{source, target, t, type}] }
 * waarbij source/target de veldnaam is (1-op-1; aliassen kunnen later).
 */
export function contractNaarIoMapping(contract) {
  const mapVelden = (bericht) =>
    (bericht?.velden || []).map((v) => {
      const r = v.ref || {};
      return {
        source: r.veldnaam || "",
        target: r.veldnaam || "",
        veldpad: r.veldpad || "",
        type: r.type || "",
        t: r.tDimensie || "formeel",
        verplicht: Boolean(v.verplicht),
      };
    });
  return { in: mapVelden(contract?.input), out: mapVelden(contract?.output) };
}

/**
 * Valideer een procescontract. Retourneert [{niveau, tekst}].
 *  - fout: een berichttype zonder velden (lege projectie)
 *  - waarschuwing: geen input én geen output (leeg contract)
 *  - info: contract is bruikbaar
 */
export function valideerContract(contract, { isCall = false } = {}) {
  const meldingen = [];
  const check = (bericht, kant) => {
    if (!bericht) return;
    if (!bericht.naam || !bericht.naam.trim()) {
      meldingen.push({ niveau: "fout", tekst: `${kant}-berichttype heeft geen naam.` });
    }
    if (!Array.isArray(bericht.velden) || bericht.velden.length === 0) {
      meldingen.push({ niveau: "fout", tekst: `${kant}-berichttype heeft geen velden (lege projectie).` });
    }
  };
  check(contract?.input, "Input");
  check(contract?.output, "Output");
  if (!contract?.input && !contract?.output) {
    meldingen.push({ niveau: "waarschuwing", tekst: "Contract is leeg: geen input- of output-berichttype." });
  }
  if (isCall && meldingen.every((m) => m.niveau !== "fout") && (contract?.input || contract?.output)) {
    const m = contractNaarIoMapping(contract);
    meldingen.push({
      niveau: "info",
      tekst: `CallActivity getypeerd: ${m.in.length}× camunda:in, ${m.out.length}× camunda:out (geen variables="all").`,
    });
  }
  if (meldingen.length === 0) {
    meldingen.push({ niveau: "info", tekst: "Procescontract is een geldige projectie over het canoniek model." });
  }
  return meldingen;
}

/**
 * Exporteer een procescontract als Operaton/Camunda-7 CallActivity in/out-
 * extensies (XML-fragment voor `<bpmn:extensionElements>`). Dit is wat de
 * proces-engine nodig heeft om variabelen getypeerd door te geven.
 */
export function naarCamundaIoXml(contract) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const m = contractNaarIoMapping(contract);
  const regels = [
    ...m.in.map(
      (x) =>
        `  <camunda:in source="${esc(x.source)}" target="${esc(x.target)}"` +
        ` canoniek:t="${esc(x.t)}" canoniek:veldpad="${esc(x.veldpad)}"/>`
    ),
    ...m.out.map(
      (x) =>
        `  <camunda:out source="${esc(x.source)}" target="${esc(x.target)}"` +
        ` canoniek:t="${esc(x.t)}" canoniek:veldpad="${esc(x.veldpad)}"/>`
    ),
  ];
  return (
    `<bpmn:extensionElements xmlns:camunda="http://camunda.org/schema/1.0/bpmn"` +
    ` xmlns:canoniek="https://canoniek-register/bpmn/extensies">\n` +
    (regels.length ? regels.join("\n") + "\n" : "") +
    `</bpmn:extensionElements>`
  );
}

/**
 * Exporteer een procescontract naar een leesbaar koppelvlak-overzicht (V3-vorm):
 * { input: {naam, velden[]}, output: {naam, velden[]} }.
 */
export function naarV3Contract(contract) {
  const plat = (bericht) =>
    bericht
      ? {
          naam: bericht.naam || "",
          velden: (bericht.velden || []).map((v) => ({
            veldnaam: v.ref?.veldnaam || "",
            veldpad: v.ref?.veldpad || "",
            tDimensie: v.ref?.tDimensie || "formeel",
            verplicht: Boolean(v.verplicht),
          })),
        }
      : null;
  return { input: plat(contract?.input), output: plat(contract?.output) };
}
