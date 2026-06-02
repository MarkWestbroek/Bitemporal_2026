/**
 * berichtModel.js — pure helpers voor het Berichttype-concept (stap 3 van de
 * "driehoek proces – regels – data").
 *
 * Een Berichttype is een BENOEMDE PROJECTIE over het canoniek model: een
 * geordende bundel veldreferenties (FieldRefs). MIM-conform is dit een
 * subset/aggregatie van objecttypen + attribuutsoorten. Een message- of
 * signal-event in BPMN "eet" geen losse velden maar een berichttype, en een
 * berichttype is per definitie een view op het metamodel — zo kan data nooit
 * buiten het canoniek model bestaan.
 *
 * Zie process_engine_v01/docs/driehoek-proces-regels-data.md (§3, §5).
 *
 * Datamodel:
 *   Berichttype {
 *     id, naam, beschrijving,
 *     velden: [ BerichtVeld ],
 *   }
 *   BerichtVeld { ref: FieldRef, verplicht: bool }
 *
 * Naast het interne V3-formaat levert deze module exporters die het berichttype
 * bruikbaar maken VANUIT Valtimo / Operaton (de open-source Camunda 7-fork):
 *   - naarOperatonMessage()      → message-correlatie-contract (POST /message)
 *   - naarJSONSchema()           → JSON Schema voor payload-validatie
 *   - naarBpmnExtensionElements()→ <canoniek:berichttype> XML voor BPMN-message
 *   - naarV3Berichttype()        → interne V3 JSON berichttypen[]-entry
 */

import { fieldRefKey } from "../modelpicker/modelTree.js";

let _counter = 0;
function genId(prefix) {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter}`;
}

/** Maak een leeg berichttype. */
export function nieuwBerichttype(naam = "NieuwBericht") {
  return { id: genId("bt"), naam, beschrijving: "", velden: [] };
}

/** Stabiele sleutel van een berichtveld (gelijk aan de FieldRef-sleutel). */
export function berichtVeldKey(veld) {
  return fieldRefKey(veld?.ref);
}

/**
 * Voeg een FieldRef toe als berichtveld. Dedupliceert op FieldRef-sleutel,
 * zodat hetzelfde veld niet twee keer in de projectie kan zitten.
 */
export function voegVeldToe(bericht, fieldRef, { verplicht = false } = {}) {
  if (!fieldRef) return bericht;
  const key = fieldRefKey(fieldRef);
  if (bericht.velden.some((v) => fieldRefKey(v.ref) === key)) return bericht;
  return { ...bericht, velden: [...bericht.velden, { ref: fieldRef, verplicht }] };
}

/** Verwijder een berichtveld op sleutel. */
export function verwijderVeld(bericht, key) {
  return { ...bericht, velden: bericht.velden.filter((v) => fieldRefKey(v.ref) !== key) };
}

/** Zet de verplicht-vlag van een berichtveld. */
export function zetVerplicht(bericht, key, verplicht) {
  return {
    ...bericht,
    velden: bericht.velden.map((v) =>
      fieldRefKey(v.ref) === key ? { ...v, verplicht: Boolean(verplicht) } : v
    ),
  };
}

/** Verplaats een berichtveld omhoog (-1) of omlaag (+1) in de volgorde. */
export function verplaatsVeld(bericht, key, richting) {
  const idx = bericht.velden.findIndex((v) => fieldRefKey(v.ref) === key);
  if (idx < 0) return bericht;
  const doel = idx + (richting < 0 ? -1 : 1);
  if (doel < 0 || doel >= bericht.velden.length) return bericht;
  const velden = [...bericht.velden];
  [velden[idx], velden[doel]] = [velden[doel], velden[idx]];
  return { ...bericht, velden };
}

/** Zet naam/beschrijving. */
export function zetNaam(bericht, naam) {
  return { ...bericht, naam };
}
export function zetBeschrijving(bericht, beschrijving) {
  return { ...bericht, beschrijving };
}

/**
 * valideerBerichttype — bewaakt de regel dat een berichttype een geldige
 * projectie over het canoniek model is. Retourneert [{niveau, tekst}].
 *   - fout: lege naam, geen velden, dubbele veldnamen in de payload
 *   - info: berichttype is bruikbaar
 */
export function valideerBerichttype(bericht) {
  const meldingen = [];
  if (!bericht?.naam || !bericht.naam.trim()) {
    meldingen.push({ niveau: "fout", tekst: "Berichttype heeft geen naam." });
  }
  if (!Array.isArray(bericht?.velden) || bericht.velden.length === 0) {
    meldingen.push({ niveau: "fout", tekst: "Berichttype heeft geen velden (lege projectie)." });
  }
  // Payload-sleutel is de veldnaam; dubbele veldnamen botsen in JSON/variabelen.
  const namen = new Map();
  (bericht?.velden || []).forEach((v) => {
    const n = v.ref?.veldnaam || "";
    namen.set(n, (namen.get(n) || 0) + 1);
  });
  [...namen.entries()]
    .filter(([, n]) => n > 1)
    .forEach(([naam]) =>
      meldingen.push({
        niveau: "fout",
        tekst: `Veldnaam "${naam}" komt meermaals voor; geef een alias of kies één bron.`,
      })
    );
  if (meldingen.length === 0) {
    meldingen.push({ niveau: "info", tekst: "Berichttype is een geldige projectie over het canoniek model." });
  }
  return meldingen;
}

// ---------------------------------------------------------------------------
// Type-mappings: canoniek model (OAS-type/format) → externe systemen
// ---------------------------------------------------------------------------

/**
 * OAS-type/format → Operaton/Camunda-variabeletype.
 * Operaton kent: String, Boolean, Short, Integer, Long, Double, Date, Json, Bytes.
 */
export function naarOperatonType(type, format) {
  const t = (type || "").toLowerCase();
  const f = (format || "").toLowerCase();
  if (t === "integer") return "Long";
  if (t === "number") return "Double";
  if (t === "boolean") return "Boolean";
  if (t === "string" && (f === "date" || f === "date-time")) return "Date";
  if (t === "object" || t === "array") return "Json";
  return "String";
}

/**
 * Exporteer een berichttype naar een Operaton/Camunda-7 message-correlatie-
 * contract. Dit is het sjabloon dat je naar `POST /message` (REST) of in een
 * Valtimo-plugin stuurt: een messageName + getypeerde processVariables.
 *
 * De waarden zijn leeg (template) — de runtime vult ze met data die herleidbaar
 * is tot de bijbehorende FieldRef (zie `_canoniek`-annotatie per variabele).
 */
export function naarOperatonMessage(bericht) {
  const processVariables = {};
  (bericht.velden || []).forEach((v) => {
    const ref = v.ref || {};
    processVariables[ref.veldnaam] = {
      value: null,
      type: naarOperatonType(ref.type, ref.format),
      // Niet-standaard annotatie die de herkomst vastlegt (lineage naar metamodel).
      valueInfo: {
        _canoniek: {
          typenaam: ref.typenaam,
          veldpad: ref.veldpad,
          tDimensie: ref.tDimensie || "formeel",
          afgeleid: Boolean(ref.afgeleid),
          verplicht: Boolean(v.verplicht),
        },
      },
    };
  });
  return {
    messageName: bericht.naam,
    // resultEnabled/all kunnen door de host gezet worden; hier het kerncontract.
    processVariables,
  };
}

/**
 * Exporteer een berichttype naar een JSON Schema (draft 2020-12) voor de
 * payload. Bruikbaar voor validatie in Valtimo-formulieren of externe tooling.
 */
export function naarJSONSchema(bericht) {
  const properties = {};
  const required = [];
  (bericht.velden || []).forEach((v) => {
    const ref = v.ref || {};
    const prop = {};
    const t = (ref.type || "string").toLowerCase();
    prop.type = ["string", "integer", "number", "boolean", "object", "array"].includes(t) ? t : "string";
    if (ref.format) prop.format = ref.format;
    if (Array.isArray(ref.enum) && ref.enum.length > 0) prop.enum = [...ref.enum];
    prop["x-canoniek"] = {
      typenaam: ref.typenaam,
      veldpad: ref.veldpad,
      tDimensie: ref.tDimensie || "formeel",
      afgeleid: Boolean(ref.afgeleid),
    };
    properties[ref.veldnaam] = prop;
    if (v.verplicht) required.push(ref.veldnaam);
  });
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `urn:canoniek:berichttype:${bericht.naam}`,
    title: bericht.naam,
    type: "object",
    properties,
    additionalProperties: false,
  };
  if (bericht.beschrijving) schema.description = bericht.beschrijving;
  if (required.length > 0) schema.required = required;
  return schema;
}

/**
 * Exporteer een berichttype als BPMN `<bpmn:message>` + `extensionElements`
 * met `<canoniek:fieldRef>`-elementen. Plak dit in een BPMN-bestand zodat een
 * message/signal-event in Valtimo/Operaton getypeerd aan het metamodel hangt
 * (analoog aan hoe Camunda `camunda:` extensies gebruikt).
 *
 * Retourneert een XML-string (geen DOM), klaar om in `<bpmn:definitions>` te
 * nesten.
 */
export function naarBpmnExtensionElements(bericht) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const NS = "https://canoniek-register/bpmn/extensies";
  const veldRegels = (bericht.velden || [])
    .map((v) => {
      const r = v.ref || {};
      return (
        `      <canoniek:fieldRef typenaam="${esc(r.typenaam)}" veldpad="${esc(r.veldpad)}"` +
        ` veldnaam="${esc(r.veldnaam)}" type="${esc(r.type)}"` +
        (r.format ? ` format="${esc(r.format)}"` : "") +
        (r.datatype ? ` datatype="${esc(r.datatype)}"` : "") +
        ` t="${esc(r.tDimensie || "formeel")}" afgeleid="${r.afgeleid ? "true" : "false"}"` +
        ` verplicht="${v.verplicht ? "true" : "false"}"/>`
      );
    })
    .join("\n");
  const veilNaam = (bericht.naam || "Bericht").replace(/[^A-Za-z0-9_]/g, "_");
  return (
    `<bpmn:message id="Message_${veilNaam}" name="${esc(bericht.naam)}">\n` +
    `  <bpmn:extensionElements>\n` +
    `    <canoniek:berichttype xmlns:canoniek="${NS}"` +
    (bericht.beschrijving ? ` beschrijving="${esc(bericht.beschrijving)}"` : "") +
    `>\n` +
    (veldRegels ? veldRegels + "\n" : "") +
    `    </canoniek:berichttype>\n` +
    `  </bpmn:extensionElements>\n` +
    `</bpmn:message>`
  );
}

/**
 * Exporteer naar de interne V3 JSON berichttypen[]-entry (zie §5 van het
 * ontwerp). Dit is het formaat dat naast entiteiten/relaties in het V3-model
 * wordt opgeslagen.
 */
export function naarV3Berichttype(bericht) {
  return {
    naam: bericht.naam,
    beschrijving: bericht.beschrijving || "",
    velden: (bericht.velden || []).map((v) => ({
      typenaam: v.ref?.typenaam || "",
      veldpad: v.ref?.veldpad || "",
      veldnaam: v.ref?.veldnaam || "",
      tDimensie: v.ref?.tDimensie || "formeel",
      afgeleid: Boolean(v.ref?.afgeleid),
      verplicht: Boolean(v.verplicht),
    })),
  };
}
