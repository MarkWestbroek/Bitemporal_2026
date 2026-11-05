// @ts-check
/**
 * inhoud — de inhoud-tekenaar van de motor (plan 2026-11-04 Eén tekenaar §3.1: "inhoud is van de
 * motor, niet van de vorm"). Tekent in het `inhoudsvak` van een ShapeRenderer: stereotype, naam,
 * badges, de eigen inhoud van het type (`hooks.inhoudsregels`) en de compartimenten met hun
 * veldregels — één keer, voor alle profielen. Een renderer tekent dit nooit zelf.
 *
 * Maten volgen de canvas-CSS (diagramcore.css: kop 6/10/4, stereotype 10px, naam 14px vet,
 * compartiment 4/10/6, veld 11px op 16px-rijen, type 10px) en de tekstmaat-tabel van diagramsvg,
 * zodat server, documenten en straks het canvas dezelfde uitkomst geven.
 *
 * Twee stappen: `planInhoud` meet (hoogte en de breedte die de inhoud minimaal wil), `tekenInhoud`
 * zet het plan in een vak. Puur.
 *
 * Modus (ShapeType.parameters.inhoud):
 *   "volledig"     stereotype, naam, badges, inhoudsregels, compartimenten (class-box)
 *   "naam"         alleen de naam (kader, package-tab, actor)
 *   "tekst"        de tekst van het element (notitie: element.data.tekst)
 *   "specificatie" stereotype, naam en `{specificatie}` (constraint, rounded: data.expressie)
 */
import { tekstBreedte, breekAf } from "../../diagramsvg/tekstmaat.js";
import { vorm } from "../types/shapeType.js";
import { isAfgeleid, veldAanvulling } from "../model/afgeleid.js";

export const PAD_X = 10;
const KOP_BOVEN = 6;
const KOP_ONDER = 4;
const STEREO = 10;
const NAAM = 14;
const VELD = 11;
const TYPE = 10;
const RIJ = 16;
const LABEL = 9;
const TEKST = 12;
const REGEL = 15;

/** Sleutel voor inline bewerken van een veld; zelfde vorm als canvas/inlineNaam.js maakVeldSleutel. */
const veldSleutel = (compartmentType, index) => `${compartmentType}:${index}`;

function stereotypeVan(element, elementType) {
  const d = element.data || {};
  const afgeleid = elementType?.hooks?.stereotype?.(element);
  return afgeleid !== undefined ? afgeleid || elementType?.stereotype : d.stereotype || elementType?.stereotype;
}

/** Eén veldregel als plat blok (naam links, type rechts), volgens de viewer van het veldtype. */
function veldBlok(veld, fieldType, sleutel) {
  const d = veld.data || {};
  const viewer = fieldType?.viewer || fieldType?.render || "naam-type";
  if (viewer === "waarde" || viewer === "tekst") {
    return { soort: "veld", naam: veld.naam || "", type: "", vet: false, cursief: viewer === "tekst", sleutel, h: RIJ };
  }
  const uml = veldAanvulling(d, fieldType);
  const achter = [
    uml.kardinaliteit ? `[${uml.kardinaliteit}]` : "",
    uml.standaardwaarde ? `= ${uml.standaardwaarde}` : "",
    uml.eigenschappen.length ? `{${uml.eigenschappen.join(", ")}}` : "",
  ].filter(Boolean).join(" ");
  const voor = `${uml.zichtbaarheid || ""}${isAfgeleid(d, fieldType) ? "/" : ""}`;
  return {
    soort: "veld",
    naam: `${voor}${veld.naam || ""}`,
    type: [d.typeLabel || "", achter].filter(Boolean).join(" "),
    vet: !!d.verplicht,
    cursief: !!d.cursief,
    sleutel,
    h: RIJ,
  };
}

/** Blokken van de compartimenten (descriptor-volgorde; alleen gevulde). */
function compartimentBlokken(element, elementType, fieldTypesById, compartmentTypesById, veldSleutels, inspring = 0) {
  const orde = new Map((elementType?.compartments || []).map((ct, i) => [ct.id, i]));
  const comps = (element.compartimenten || [])
    .map((c, i) => ({ c, sleutel: orde.get(c.compartmentType) ?? 1000 + i }))
    .sort((a, b) => a.sleutel - b.sleutel)
    .map((x) => x.c)
    .filter((c) => (c.velden || []).length > 0);
  const uit = [];
  for (const c of comps) {
    const ct = compartmentTypesById?.[c.compartmentType];
    uit.push({ soort: "divider", h: 1 + 4 });
    if (ct?.label) uit.push({ soort: "label", tekst: ct.label, h: 12, inspring });
    c.velden.forEach((v, j) => {
      const ft = fieldTypesById?.[v.fieldType];
      const viewer = ft?.viewer || ft?.render;
      if (viewer === "sub-vak") {
        // Opname: een deel ín zijn geheel — kop (naam vet + meta) en zijn velden ingesprongen.
        const d = v.data || {};
        const meta = (d.kop || []).map((deel) => deel.tekst).filter(Boolean);
        uit.push({ soort: "veld", naam: v.naam || "", type: meta.join(" "), vet: true, cursief: false, sleutel: null, h: RIJ, inspring });
        for (const b of compartimentBlokken({ compartimenten: d.compartimenten || [] }, null, fieldTypesById, compartmentTypesById, false, inspring + 8)) {
          if (b.soort !== "divider") uit.push(b);
        }
        return;
      }
      const sleutel = veldSleutels && c.compartmentType && !c.extra ? veldSleutel(c.compartmentType, j) : null;
      uit.push({ ...veldBlok(v, ft, sleutel), inspring });
    });
    uit.push({ soort: "ruimte", h: 6 });
  }
  return uit;
}

/**
 * Meet de inhoud voor een gegeven breedte (Infinity = natuurlijke breedte, niets afbreken).
 * @param {Object} p
 * @param {Object} p.element
 * @param {Object} p.elementType
 * @param {number} p.breedte            - breedte van het vak
 * @param {Object} [p.parameters]       - ShapeType.parameters (inhoud, naamGrootte, tekstAnker, stereotype)
 * @param {Record<string, Object>} [p.fieldTypesById]
 * @param {Record<string, Object>} [p.compartmentTypesById]
 * @param {import("../types/schema.js").InhoudsRegel[]} [p.inhoudsregels]
 * @returns {{blokken: Object[], h: number, minW: number, modus: string}}
 */
export function planInhoud({ element, elementType, breedte, parameters = {}, fieldTypesById, compartmentTypesById, inhoudsregels = [] }) {
  const modus = parameters.inhoud || "volledig";
  const d = element?.data || {};
  const binnen = Math.max(20, breedte - 2 * PAD_X);
  const blokken = [];
  let minW = 0;
  const meet = (t, grootte, opts) => {
    minW = Math.max(minW, tekstBreedte(t, grootte, opts));
  };
  const naamGrootte = parameters.naamGrootte ?? (modus === "naam" ? 12 : NAAM);
  const naamTekst = element?.naam || (modus === "volledig" || modus === "specificatie" ? "(naamloos)" : "");

  if (modus === "tekst") {
    const tekst = String(d[parameters.tekstVeld || "tekst"] || "").trim();
    const regels = tekst ? breekAf(tekst, TEKST, binnen) : [];
    for (const r of regels) meet(r, TEKST);
    blokken.push({ soort: "tekst", regels, grootte: TEKST, h: Math.max(REGEL, regels.length * REGEL), leeg: !tekst });
  } else {
    if (modus !== "naam" && parameters.stereotype !== false) {
      const st = stereotypeVan(element, elementType);
      if (st) {
        meet(st, STEREO);
        blokken.push({ soort: "stereotype", tekst: st, h: 13 });
      }
    }
    if (naamTekst) {
      const regels = breekAf(naamTekst, naamGrootte, binnen, { vet: true });
      for (const r of regels) meet(r, naamGrootte, { vet: true });
      blokken.push({ soort: "naam", regels, grootte: naamGrootte, cursief: !!d.abstract, h: regels.length * Math.round(naamGrootte * 1.3) });
    }
    if (modus === "volledig" && d.materieel) {
      blokken.push({ soort: "badge", tekst: "materieel", h: 14 });
      meet("materieel", LABEL);
    }
    if (modus === "specificatie") {
      // Zonder specificatie alleen een plaatshouder als het type dat wil (constraint: `{…}`);
      // een afgeronde vorm zonder expressie toont niets extra's.
      const spec = String(d.specificatie || d.expressie || "").trim();
      if (spec || parameters.leegToon) {
        const tekst = spec ? `{${spec}}` : "{…}";
        const regels = breekAf(tekst, VELD, binnen, { mono: true });
        for (const r of regels) meet(r, VELD, { mono: true });
        blokken.push({ soort: "tekst", regels, grootte: VELD, mono: true, h: regels.length * REGEL, leeg: !spec });
      }
    }
    if (modus === "volledig") {
      for (const regel of inhoudsregels) {
        const tekst = regel.delen.map((x) => x.tekst).filter(Boolean).join(" ");
        meet(tekst, VELD);
        blokken.push({ soort: "regel", delen: regel.delen, h: REGEL });
      }
      const comps = compartimentBlokken(element, elementType, fieldTypesById, compartmentTypesById, true);
      for (const b of comps) {
        if (b.soort === "veld") minW = Math.max(minW, tekstBreedte(b.naam, VELD, { vet: b.vet }) + (b.type ? 12 + tekstBreedte(b.type, TYPE) : 0) + (b.inspring || 0));
        if (b.soort === "label") meet(b.tekst, LABEL);
      }
      blokken.push(...comps);
    }
  }
  const h = KOP_BOVEN + blokken.reduce((t, b) => t + b.h, 0) + KOP_ONDER;
  return { blokken, h, minW: Math.ceil(minW + 2 * PAD_X), modus };
}

/**
 * Teken een plan in een vak. Tekst krijgt `data-dc-naam` (de naam) en `data-dc-veld` (een eigen
 * veld), zodat het canvas er later inline op kan bewerken.
 * @param {import("../types/schema.js").Vak} vak
 * @param {ReturnType<typeof planInhoud>} plan
 * @param {{inkt: string, gedempt: string, rand: string}} kleuren
 * @param {{tekstAnker?: "midden"|"links"}} [opties]
 * @returns {import("../types/schema.js").VormBoom}
 */
export function tekenInhoud(vak, plan, kleuren, opties = {}) {
  const anker = opties.tekstAnker || "midden";
  const links = vak.x + PAD_X;
  const rechts = vak.x + vak.w - PAD_X;
  const middenX = vak.x + vak.w / 2;
  const ankerX = anker === "links" ? links : middenX;
  const ankerAttr = anker === "links" ? "start" : "middle";
  const start = vak.uitlijning === "midden" ? vak.y + Math.max(0, (vak.h - plan.h) / 2) : vak.y;
  let y = start + KOP_BOVEN;
  const kinderen = [];
  const tekst = (x, yy, t, attrs) => vorm("text", { x, y: yy, ...attrs }, t);

  for (const b of plan.blokken) {
    if (b.soort === "stereotype") {
      // `data-dc-stereotype`: het canvas verbergt hem in de typering-stand "geen"/"icoon" (diagramcore.css).
      kinderen.push(tekst(ankerX, y + 10, b.tekst, { "text-anchor": ankerAttr, "font-size": STEREO, "font-style": "italic", fill: kleuren.gedempt, "data-dc-stereotype": "" }));
    } else if (b.soort === "naam") {
      const lh = Math.round(b.grootte * 1.3);
      b.regels.forEach((r, i) => {
        kinderen.push(
          tekst(ankerX, y + lh * i + b.grootte, r, {
            "text-anchor": ankerAttr,
            "font-size": b.grootte,
            "font-weight": 700,
            ...(b.cursief ? { "font-style": "italic" } : {}),
            fill: kleuren.inkt,
            ...(i === 0 ? { "data-dc-naam": "" } : {}),
          })
        );
      });
    } else if (b.soort === "badge") {
      const bw = Math.ceil(tekstBreedte(b.tekst, LABEL) + 12);
      kinderen.push(vorm("rect", { x: middenX - bw / 2, y: y + 1, width: bw, height: 12, rx: 6, fill: kleuren.rand, "fill-opacity": 0.18 }));
      kinderen.push(tekst(middenX, y + 10, b.tekst, { "text-anchor": "middle", "font-size": LABEL, "font-weight": 600, fill: kleuren.inkt }));
    } else if (b.soort === "regel") {
      let x = links;
      const delen = b.delen.filter((d) => d.tekst);
      for (const deel of delen) {
        const attrs = { "font-size": VELD, fill: deel.kleur || kleuren.inkt };
        if (deel.soort === "kardinaliteit" || deel.soort === "constraint" || deel.soort === "staart") attrs.fill = deel.kleur || kleuren.gedempt;
        if (deel.veld) attrs["data-dc-veld"] = deel.veld;
        kinderen.push(tekst(x, y + 11, deel.tekst, attrs));
        x += tekstBreedte(deel.tekst, VELD) + 6;
      }
    } else if (b.soort === "divider") {
      kinderen.push(vorm("line", { x1: vak.x, y1: y + 0.5, x2: vak.x + vak.w, y2: y + 0.5, stroke: kleuren.rand, "stroke-width": 1 }));
    } else if (b.soort === "label") {
      kinderen.push(tekst(links + (b.inspring || 0), y + 9, b.tekst, { "font-size": LABEL, "font-weight": 600, "letter-spacing": 0.5, fill: kleuren.gedempt }));
    } else if (b.soort === "veld") {
      const attrs = { "font-size": VELD, fill: kleuren.inkt };
      if (b.vet) attrs["font-weight"] = 700;
      if (b.cursief) attrs["font-style"] = "italic";
      if (b.sleutel) attrs["data-dc-veld"] = b.sleutel;
      kinderen.push(tekst(links + (b.inspring || 0), y + 12, b.naam, attrs));
      if (b.type) kinderen.push(tekst(rechts, y + 12, b.type, { "text-anchor": "end", "font-size": TYPE, fill: kleuren.gedempt }));
    } else if (b.soort === "tekst") {
      const attrs = { "font-size": b.grootte, fill: b.leeg ? kleuren.gedempt : kleuren.inkt };
      if (b.mono) attrs["font-family"] = "ui-monospace, monospace";
      if (b.leeg) attrs["font-style"] = "italic";
      const regels = b.regels.length ? b.regels : b.leeg ? [b.mono ? "{…}" : "(geen tekst)"] : [];
      regels.forEach((r, i) => kinderen.push(tekst(b.mono || b.grootte === TEKST ? links : ankerX, y + REGEL * i + b.grootte, r, { ...attrs, "text-anchor": b.mono || b.grootte === TEKST ? "start" : ankerAttr })));
    }
    y += b.h;
  }
  const g = vorm("g", { class: "dc-inhoud" }, ...kinderen);
  if (vak.rotatie) {
    g.attrs.transform = `rotate(${vak.rotatie} ${vak.x + vak.w / 2} ${vak.y + vak.h / 2})`;
  }
  return g;
}
