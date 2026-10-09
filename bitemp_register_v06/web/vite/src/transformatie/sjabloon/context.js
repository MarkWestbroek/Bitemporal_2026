/**
 * sjabloon/context — van een bereik (de inhoud van een map, per profiel) naar
 * de context waar een documentsjabloon over loopt. Puur: geen stores, geen
 * DOM. De Studio-kant (studio/activities/documentContext.js) verzamelt de
 * map-inhoud en geeft een `svgVan`-tekenaar mee.
 *
 * Vorm (zie het ontwerpvoorstel §3.3):
 *
 *   { map: {naam, omschrijving}, titel, omschrijving, diepte, kop,
 *     kinderen:   [ …submappen in dezelfde vorm, diepte + 1… ],
 *     profielen:  [{ id, label, elementen, diagrammen, verbindingen }],
 *     elementen:  [{ id, naam, type:{id,label}, data, toelichting, velden, diagrammen, verbindingen, profiel }],
 *     diagrammen: [{ id, naam, type, beschrijving, elementen, aantal, svg(), profiel }],
 *     verbindingen: [{ id, naam, type:{id,label}, bron, doel, profiel }] }
 *
 * Een verbinding staat bij beide uiteinden met `richting: "uit"` (bron) of
 * `"in"` (doel) en `ander` = het andere uiteinde; zo kan een sjabloon
 * `{{#elk verbindingen type=include richting=uit}}` schrijven.
 */

const naamOf = (el) => el?.naam || "";

/**
 * @param {{ naam: string,
 *   profielen: Array<{ id: string, label: string, descriptor: Object,
 *                      elements: Record<string, Object>, diagrams: Record<string, Object> }>,
 *   svgVan?: (diagram: Object, profielCtx: Object) => string }} invoer
 */
export function maakDocumentContext({ naam, omschrijving = "", profielen = [], svgVan = null, kinderen = [], diepte = 1 }) {
  const ctx = {
    map: { naam: naam || "", omschrijving: omschrijving || "" },
    naam: naam || "",
    titel: naam || "",
    omschrijving: omschrijving || "",
    diepte,
    // Markdown-kop voor deze map: "#" op niveau 1, "##" op 2, … (max 6).
    kop: "#".repeat(Math.min(6, Math.max(1, diepte))),
    subkop: "#".repeat(Math.min(6, Math.max(1, diepte + 1))),
    kinderen: [],
    profielen: [],
    elementen: [],
    diagrammen: [],
    verbindingen: [],
  };
  for (const p of profielen) {
    const typen = Object.fromEntries((p.descriptor?.elementTypes || []).map((t) => [t.id, t]));
    const typeVan = (el) => {
      const et = typen[el.elementType];
      return { id: el.elementType, label: et?.label || el.elementType, isConnector: !!et?.isConnector };
    };
    const profielCtx = { id: p.id, label: p.label || p.id, elementen: [], diagrammen: [], verbindingen: [] };
    const perId = new Map();
    const alle = Object.values(p.elements || {});

    // Elementen (geen connectoren).
    for (const el of alle) {
      const type = typeVan(el);
      if (type.isConnector) continue;
      const data = el.data || {};
      const velden = [];
      for (const c of el.compartimenten || []) {
        for (const v of c.velden || []) {
          velden.push({
            naam: v.naam || "",
            compartiment: c.compartmentType || "",
            fieldType: v.fieldType || "",
            type: v.data?.typeLabel || "",
            data: v.data || {},
          });
        }
      }
      const e = {
        id: el.id,
        naam: naamOf(el),
        type,
        data,
        toelichting: data.toelichting || data.beschrijving || data.omschrijving || "",
        velden,
        diagrammen: [],
        verbindingen: [],
        profiel: profielCtx,
      };
      perId.set(el.id, e);
      profielCtx.elementen.push(e);
    }

    // Verbindingen (connectoren) met beide uiteinden bekend.
    for (const el of alle) {
      const type = typeVan(el);
      if (!type.isConnector || !el.source || !el.target) continue;
      const bron = perId.get(el.source);
      const doel = perId.get(el.target);
      if (!bron || !doel) continue;
      const v = { id: el.id, naam: naamOf(el), type, bron, doel, data: el.data || {}, profiel: profielCtx };
      profielCtx.verbindingen.push(v);
      bron.verbindingen.push({ ...v, richting: "uit", ander: doel });
      doel.verbindingen.push({ ...v, richting: "in", ander: bron });
    }

    // Diagrammen: welke elementen erop staan; svg lui.
    for (const d of Object.values(p.diagrams || {})) {
      const opDiagram = [];
      for (const n of d.nodes || []) {
        const e = perId.get(n.elementId);
        if (e && !opDiagram.includes(e)) opDiagram.push(e);
      }
      const dc = {
        id: d.id,
        naam: d.naam || d.id,
        type: d.diagramType || "",
        beschrijving: d.beschrijving || d.data?.beschrijving || "",
        elementen: opDiagram,
        aantal: opDiagram.length,
        profiel: profielCtx,
        svg: () => (svgVan ? svgVan(d, { elements: p.elements, descriptor: p.descriptor, profiel: profielCtx }) : ""),
      };
      for (const e of opDiagram) e.diagrammen.push({ id: dc.id, naam: dc.naam });
      profielCtx.diagrammen.push(dc);
    }

    ctx.profielen.push(profielCtx);
    ctx.elementen.push(...profielCtx.elementen);
    ctx.diagrammen.push(...profielCtx.diagrammen);
    ctx.verbindingen.push(...profielCtx.verbindingen);
  }
  // Submappen: dezelfde vorm, één niveau dieper (de mappenboom = de
  // hoofdstukindeling van een projectdocument).
  for (const kind of kinderen) {
    ctx.kinderen.push(maakDocumentContext({ svgVan, ...kind, diepte: diepte + 1 }));
  }
  return ctx;
}
