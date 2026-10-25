// @ts-check
/**
 * jsonSchemaSchrijver — **schrijver**: plan → JSON Schema (2020-12).
 *
 * Laatste stap van een transformatie (docs/TRANSFORMATIES.md §3). Kent alleen
 * JSON Schema; wat een veld of een gegevenselement wordt staat in de regelset.
 * Het plan gebruikt dit doelvocabulaire:
 *
 *   element.type  "schema"   — het wortelobject (precies één); naam → title
 *                 "object"   — een object-property
 *                 "array"    — een array van objecten; data.description op de
 *                              array, de overige data (additionalProperties)
 *                              op `items`
 *                 "property" — een blad; data = JSON-Schema-sleutelwoorden
 *   element.groep de omvattende schema/object/array
 *   data.verplicht (boolean) — zet de naam in `required` van de ouder;
 *                              wordt zelf niet geschreven. `required` is in
 *                              JSON Schema een verzameling; de schrijver zet
 *                              hem gesorteerd neer, zodat de hash (JCS, die
 *                              lijstvolgorde wél telt) niet afhangt van de
 *                              volgorde van de properties
 *
 * Lege waarden (`""`, `null`, lege lijst) worden weggelaten, zodat een regel
 * altijd alle sleutelwoorden mag noemen (`"{eigenschappen.pattern}"`) zonder
 * dat er lege velden in het schema belanden.
 *
 * Geeft naast het schema per plan-element het JSON-Pointer-pad in het schema
 * terug — voor de trace van het artefact ("doelPad"). Deterministisch:
 * properties in planvolgorde. Puur.
 */

const VOLGORDE = ["$schema", "title", "type", "description", "format", "pattern", "minLength", "maxLength", "enum", "items", "properties", "required", "additionalProperties"];

const isLeeg = (waarde) => waarde === undefined || waarde === null || waarde === "" || (Array.isArray(waarde) && waarde.length === 0);

/** Sleutels in een vaste, leesbare volgorde; lege waarden weg. */
function geordend(object) {
  const uit = {};
  const sleutels = Object.keys(object).filter((k) => !isLeeg(object[k]));
  for (const k of VOLGORDE) if (sleutels.includes(k)) uit[k] = object[k];
  for (const k of sleutels) if (!(k in uit)) uit[k] = object[k];
  return uit;
}

const escapePointer = (deel) => String(deel).replace(/~/g, "~0").replace(/\//g, "~1");

/**
 * @param {{elementen: any[]}} plan
 * @returns {{schema: Record<string, any>|null, paden: Map<string, string>, diagnostics: any[]}}
 */
export function planNaarJsonSchema(plan) {
  const diagnostics = [];
  const paden = new Map();
  const wortels = plan.elementen.filter((el) => el.type === "schema");
  if (wortels.length !== 1) {
    diagnostics.push({ severity: "error", code: "JSN-WORTEL", message: `Verwacht precies één schema-element, gevonden: ${wortels.length}`, sourceId: null, path: null });
    return { schema: null, paden, diagnostics };
  }
  const kinderen = (sleutel) => plan.elementen.filter((el) => el.groep === sleutel);

  /** properties + required van de kinderen van een container, op pad `basis`. */
  function eigenschappen(sleutel, basis) {
    const properties = {};
    const required = [];
    for (const kind of kinderen(sleutel)) {
      if (!kind.naam) {
        diagnostics.push({ severity: "warning", code: "JSN-NAAMLOOS", message: `Element zonder naam (${kind.type}); niet geschreven`, sourceId: kind.sleutel, path: null });
        continue;
      }
      if (kind.naam in properties) {
        diagnostics.push({ severity: "error", code: "JSN-DUBBEL", message: `Property "${kind.naam}" komt twee keer voor in hetzelfde object`, sourceId: kind.sleutel, path: basis });
        continue;
      }
      const pad = `${basis}/properties/${escapePointer(kind.naam)}`;
      properties[kind.naam] = schrijf(kind, pad);
      if (kind.data?.verplicht === true) required.push(kind.naam);
    }
    return { properties, required: required.sort() };
  }

  function schrijf(el, pad) {
    paden.set(el.sleutel, pad);
    const { verplicht: _verplicht, ...data } = el.data || {};
    if (el.type === "property") return geordend(data);
    if (el.type === "array") {
      const { description, ...itemData } = data;
      const binnen = eigenschappen(el.sleutel, `${pad}/items`);
      return geordend({ type: "array", description, items: geordend({ ...itemData, type: "object", ...binnen }) });
    }
    if (el.type === "object" || el.type === "schema") {
      const binnen = eigenschappen(el.sleutel, pad);
      return geordend({ ...data, ...(el.type === "schema" ? { title: el.naam } : {}), type: "object", ...binnen });
    }
    diagnostics.push({ severity: "warning", code: "JSN-ONBEKEND", message: `Onbekend elementtype "${el.type}"; niet geschreven`, sourceId: el.sleutel, path: pad });
    return {};
  }

  const schema = schrijf(wortels[0], "");
  return { schema, paden, diagnostics };
}
