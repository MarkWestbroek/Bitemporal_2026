// @ts-check
/**
 * herkomst — wat SHACL → canoniek (naarCanoniek.js) bij elk canoniek element onthoudt, zodat
 * canoniek → SHACL (vanCanoniek.js) dezelfde shapes terug kan schrijven (rondgang).
 *
 * Elk element of veld dat uit SHACL komt, krijgt `data.shacl`:
 *   - `regels`: de property shapes waar het uit komt, letterlijk ({sleutel, shape, nr, naam,
 *     fieldType, data, aantal}); `aantal` = hoeveel canonieke onderdelen uit die regel komen
 *     (een sh:or van twee klassen geeft twee relaties);
 *   - `afdruk`: hoe het onderdeel er in het canonieke model uitzag (naam, type, kardinaliteit,
 *     doel). Is de afdruk bij de terugweg gelijk, dan gaat de oorspronkelijke SHACL terug; is
 *     hij anders (in het CM gewijzigd), dan leidt vanCanoniek de regel opnieuw af;
 *   - bij een entiteit: `shapes` (de node shapes waarvan ze de regels draagt), `klasse` (het
 *     klasse-element), `graaf` (de shapes graph), `naam`;
 *   - bij een generalisatie: `elementen` (subklasse-connectoren) of `impliciet` (uit de
 *     doelklassen van één shape); bij een constraint: `element` + `lijn`; bij een enumeratie:
 *     `termen` (waarde → Turtle-term, voor sh:in met IRI's).
 *
 * De afdruk-functies staan hier zodat beide richtingen precies hetzelfde vergelijken.
 */

const velden = (el, soort = "velden") => (el?.compartimenten || []).filter((c) => c.compartmentType === soort).flatMap((c) => c.velden || []);

export const waardenVan = (en) => velden(en, "waarden").map((v) => v.naam).filter(Boolean);

export const afdrukVeld = (v) => JSON.stringify(["veld", v?.naam || "", v?.data?.typeLabel || "", Boolean(v?.data?.verplicht)]);

/** @param {any} r @param {Record<string, any>} els */
export const afdrukRelatie = (r, els) => JSON.stringify(["rel", r.data?.naamLabelHeen || "", r.data?.doelKardinaliteit || "", els[r.target]?.naam || ""]);

/** @param {any} c @param {Record<string, any>} els */
export const afdrukCompositie = (c, els) => {
  const ge = els[c.target];
  return JSON.stringify(["comp", c.data?.rolnaam || "", c.data?.kardinaliteit || "", c.data?.momentvoorkomen || "", ge?.naam || "", velden(ge).map((v) => [v.naam, v.data?.typeLabel || ""])]);
};

/** @param {any} g @param {Record<string, any>} els */
export const afdrukGeneralisatie = (g, els) => JSON.stringify(["gen", els[g.source]?.naam || "", els[g.target]?.naam || ""]);

export const afdrukConstraint = (c) => JSON.stringify(["con", c?.naam || ""]);

export const afdrukEnumeratie = (en) => JSON.stringify(["enum", waardenVan(en)]);

/** Diepe kopie van gewone gegevens (JSON). */
export const kopie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
