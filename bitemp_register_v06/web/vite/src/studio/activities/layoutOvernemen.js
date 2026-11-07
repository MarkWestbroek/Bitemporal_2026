// @ts-check
/**
 * layoutOvernemen — schik een diagram zoals een voorbeeld in een andere taal, via de
 * kruisverbanden (of, zonder kruisverband, op naam). Aanleiding (Mark 07-11): het canonieke
 * ODRL-model is met de hand geordend zoals het ODRL 2.2-diagram van W3C; het SHACL-diagram waar
 * het uit komt moet dezelfde ordening krijgen.
 *
 * Werkwijze, puur (getest in layoutOvernemen.test.js):
 *   1. per doelknoop de partner in het voorbeeld (kruisverband; bij meer partners die met dezelfde
 *      naam, anders de eerste);
 *   2. de positie van de partner, geschaald: de dozen in het doel zijn vaak groter (een node
 *      shape met tien regels tegenover een entiteit met twee velden). Schaal "auto" = de mediaan
 *      van de verhouding doelmaat / voorbeeldmaat, per as, tussen 1 en 3;
 *   3. knopen zonder partner op een rij boven het geheel (bv. de shapes graph);
 *   4. wat dan nog overlapt schuift over de kortste as weg (haalUitElkaar, ook de tekenaar-SVG).
 */
import { haalUitElkaar } from "../../diagramsvg/ontwarren.js";

/** "odrl:PolicyShape" / "Policy" / "PolicyShape" → "policy": voor de naamvergelijking. */
export function naamSleutel(naam) {
  return String(naam || "")
    .trim()
    .replace(/>$/, "")
    .replace(/^.*[:#/]/, "")
    .replace(/Shape$/, "")
    .toLowerCase();
}

const mediaan = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 1;
};
const begrens = (x) => Math.min(3, Math.max(1, Number.isFinite(x) ? x : 1));

/**
 * @param {{
 *   voorbeeld: Map<string, {x: number, y: number, w: number, h: number, naam?: string}>,
 *   doelNodes: {id: string, elementId?: string, type?: string, naam?: string, x: number, y: number, w: number, h: number}[],
 *   partnersVan: (elementId: string, naam?: string) => string[],
 *   schaal?: "auto" | number,
 *   tussenruimte?: number,
 * }} invoer
 * @returns {{posities: Map<string, {x: number, y: number}>, overgenomen: number, los: string[], schaal: {x: number, y: number}}}
 */
export function layoutOvernemen({ voorbeeld, doelNodes, partnersVan, schaal = "auto", tussenruimte = 40 }) {
  // 1. Partner per doelknoop.
  const paar = new Map();
  for (const n of doelNodes) {
    const kandidaten = partnersVan(n.elementId ?? n.id, n.naam).filter((k) => voorbeeld.has(k));
    if (!kandidaten.length) continue;
    const zelfde = kandidaten.find((k) => naamSleutel(voorbeeld.get(k)?.naam) === naamSleutel(n.naam));
    paar.set(n.id, zelfde || kandidaten[0]);
  }

  // 2. Schaal en positie.
  const metPartner = doelNodes.filter((n) => paar.has(n.id));
  const sx = schaal === "auto" ? begrens(mediaan(metPartner.map((n) => n.w / (voorbeeld.get(paar.get(n.id)).w || n.w)))) : Number(schaal) || 1;
  const sy = schaal === "auto" ? begrens(mediaan(metPartner.map((n) => n.h / (voorbeeld.get(paar.get(n.id)).h || n.h)))) : Number(schaal) || 1;
  const bronnen = metPartner.map((n) => voorbeeld.get(paar.get(n.id)));
  const minBx = Math.min(...bronnen.map((b) => b.x));
  const minBy = Math.min(...bronnen.map((b) => b.y));
  const basisX = Math.min(...doelNodes.map((n) => n.x));
  const basisY = Math.min(...doelNodes.map((n) => n.y));
  const items = [];
  for (const n of metPartner) {
    const b = voorbeeld.get(paar.get(n.id));
    items.push({ id: n.id, type: n.type, x: basisX + (b.x - minBx) * sx, y: basisY + (b.y - minBy) * sy, w: n.w, h: n.h });
  }

  // 3. Zonder partner: een rij boven het geheel, in de oude volgorde van links naar rechts.
  const los = doelNodes.filter((n) => !paar.has(n.id)).sort((a, b) => a.x - b.x || a.y - b.y);
  if (los.length) {
    const hoogste = Math.max(...los.map((n) => n.h));
    let x = basisX;
    for (const n of los) {
      items.push({ id: n.id, type: n.type, x, y: basisY - hoogste - 2 * tussenruimte, w: n.w, h: n.h });
      x += n.w + tussenruimte;
    }
  }

  // 4. Overlap weg.
  haalUitElkaar(items, { tussenruimte });
  const posities = new Map(items.map((it) => [it.id, { x: Math.round(it.x), y: Math.round(it.y) }]));
  return { posities, overgenomen: metPartner.length, los: los.map((n) => n.id), schaal: { x: Math.round(sx * 100) / 100, y: Math.round(sy * 100) / 100 } };
}

/**
 * De partners van een element via de kruisverbanden (beide kanten van een link), als sleutels
 * `profielId::elementId`. Zonder link: elementen met dezelfde naam (naamSleutel).
 * @param {{rij: {profielId: string, elementId: string}, kolom: {profielId: string, elementId: string}}[]} links
 * @param {string} profielId
 * @param {Map<string, {naam?: string}>} voorbeeld
 */
export function maakPartnersVan(links, profielId, voorbeeld) {
  const perNaam = new Map();
  for (const [k, v] of voorbeeld) {
    const s = naamSleutel(v.naam);
    if (s && !perNaam.has(s)) perNaam.set(s, k);
  }
  return (elementId, naam) => {
    const uitLinks = [];
    for (const l of links || []) {
      if (l.rij?.profielId === profielId && l.rij.elementId === elementId) uitLinks.push(`${l.kolom.profielId}::${l.kolom.elementId}`);
      else if (l.kolom?.profielId === profielId && l.kolom.elementId === elementId) uitLinks.push(`${l.rij.profielId}::${l.rij.elementId}`);
    }
    const opNaam = perNaam.get(naamSleutel(naam));
    return uitLinks.length ? uitLinks : opNaam ? [opNaam] : [];
  };
}
