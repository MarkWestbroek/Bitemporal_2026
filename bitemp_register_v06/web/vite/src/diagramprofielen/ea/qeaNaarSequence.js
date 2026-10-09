// @ts-check
/**
 * qeaNaarSequence — EA sequence-diagrammen (`t_diagram.Diagram_Type = "Sequence"`)
 * naar het Omnium sequence-profiel.
 *
 * Hoe EA een sequence-diagram bewaart (GGM EA16, diagram "JS" 1297):
 *   - **levenslijnen** zijn gewone diagramobjecten: Object (met `Classifier` =
 *     de klasse), Sequence (benoemde lifeline), Actor, Class, Component, … —
 *     hoge smalle rechthoeken (RectTop…RectBottom = de lijn);
 *   - **berichten** staan NIET in `t_diagramlinks` maar als `t_connector` met
 *     `Connector_Type = "Sequence"` en `DiagramID` = het diagram, in volgorde
 *     `SeqNo`; de plek is `PtStartX/PtStartY` → `PtEndX/PtEndY` (y negatief,
 *     zoals RectTop). `PDATA1` = Synchronous/Asynchronous, `PDATA3` = Call/
 *     Return, `PDATA2` = "retval=…;params=…". Een zelf-bericht heeft
 *     Start = End.
 *
 * Omnium (sequence/index.js): een levenslijn is een smalle hoge node (14 px);
 * berichten lopen tussen **punten** (rand-elementen, klem "as") op de lijn.
 * Elk EA-bericht wordt dus: een punt op de bron-lijn (y van PtStartY), een
 * punt op de doel-lijn (y van PtEndY) en een connector synchroon/asynchroon/
 * retour. Een zelf-bericht wordt één punt met een lus (het "oortje").
 * Activaties en fragmenten (EA: InteractionFragment) komen in een volgende stap.
 */
import { idUitGuid, deelboomPakketten, EA_SCHAAL } from "./qeaHulp.js";
import { maakHulptabellen, maakVerslag, sla, extraData, diagramId } from "./qeaKern.js";

export const SEQUENCE_DIAGRAMTYPE = "sequence";

/** Breedte van de levenslijn-node en maat van een punt (sequence/shapes.jsx). */
const LIJN_BREED = 14;
const PUNT = 12;

/** Objecttypen die op een sequence-diagram géén levenslijn zijn. */
const GEEN_LEVENSLIJN = new Set(["Note", "Text", "Boundary", "InteractionFragment", "InteractionOccurrence"]);

/**
 * @param {import("./qeaKern.js").QeaBron} bron
 * @param {{packageId:number, diagramTypeId?:string, schaal?:number}} opties
 */
export function qeaNaarSequence(bron, { packageId, diagramTypeId = SEQUENCE_DIAGRAMTYPE, schaal = EA_SCHAAL }) {
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const verslag = maakVerslag();
  const diagrammen = (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && d.Diagram_Type === "Sequence");
  const h = maakHulptabellen(bron, schaal, { diagramVoorkeur: diagrammen.map((d) => d.Diagram_ID) });
  for (const d of (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && d.Diagram_Type !== "Sequence")) {
    sla(verslag, `diagram ${d.Diagram_Type}`);
  }

  /** @type {Record<string, any>} */
  const elements = {};
  /** @type {Record<string, any>} */
  const diagrams = {};
  const classifierNaam = (o) => {
    const c = o.Classifier && o.Classifier !== 0 && o.Classifier !== "0" ? h.classifierPerId.get(o.Classifier) : null;
    return c?.Name || "";
  };
  const berichtenPerDiagram = new Map();
  for (const c of bron.t_connector || []) {
    if (c.Connector_Type !== "Sequence") continue;
    if (!berichtenPerDiagram.has(c.DiagramID)) berichtenPerDiagram.set(c.DiagramID, []);
    berichtenPerDiagram.get(c.DiagramID).push(c);
  }

  for (const d of diagrammen) {
    const nodes = [];
    const lijnen = {};
    /** EA Object_ID → { id, top, left, breed } van de levenslijn op dít diagram. */
    const lijnVanObject = new Map();
    const rects = h.rectPerDiagram.get(d.Diagram_ID) || new Map();
    for (const dobj of [...(h.objectenPerDiagram.get(d.Diagram_ID) || [])].reverse()) {
      const o = h.objectPerId.get(dobj.Object_ID);
      if (!o) continue;
      const rect = rects.get(dobj.Object_ID);
      if (!rect) continue;
      const id = idUitGuid(o.ea_guid);
      if (o.Object_Type === "Note" || o.Object_Type === "Text") {
        if (!elements[id]) {
          elements[id] = { id, naam: "", elementType: "notitie", compartimenten: [], data: { ...extraData(h, o.ea_guid, o.Object_ID), tekst: o.Note || o.Name || "" } };
          verslag.elementen += 1;
        }
        nodes.push({ elementId: id, position: { x: rect.x, y: rect.y }, size: { width: rect.width, height: rect.height } });
        continue;
      }
      if (GEEN_LEVENSLIJN.has(o.Object_Type)) {
        sla(verslag, o.Object_Type);
        continue;
      }
      // Levenslijn: naam = Name, anders de classifier; de classifier reist mee.
      const type = classifierNaam(o);
      if (!elements[id]) {
        elements[id] = {
          id,
          naam: o.Name || type || o.Object_Type,
          elementType: "levenslijn",
          compartimenten: [],
          data: {
            ...extraData(h, o.ea_guid, o.Object_ID),
            eaPakket: o.Package_ID,
            eaObjectType: o.Object_Type,
            ...(type ? { typeNaam: type } : {}),
            ...(o.Note ? { notes: o.Note } : {}),
          },
        };
        verslag.elementen += 1;
      }
      // De smalle lijn-node gecentreerd op EA's kolom; de hoogte is EA's lijn.
      const x = Math.round(rect.x + rect.width / 2 - LIJN_BREED / 2);
      nodes.push({ elementId: id, position: { x, y: rect.y }, size: { width: LIJN_BREED, height: rect.height } });
      lijnVanObject.set(o.Object_ID, { id, top: rect.y, x });
    }

    // Berichten: punten op de lijnen + connector, in SeqNo-volgorde.
    const berichten = [...(berichtenPerDiagram.get(d.Diagram_ID) || [])].sort((a, b) => (Number(a.SeqNo) || 0) - (Number(b.SeqNo) || 0));
    for (const c of berichten) {
      const bron_ = lijnVanObject.get(c.Start_Object_ID);
      const doel = lijnVanObject.get(c.End_Object_ID);
      if (!bron_ || !doel) {
        sla(verslag, "bericht zonder levenslijn op het diagram");
        continue;
      }
      const cid = idUitGuid(c.ea_guid);
      const yStart = Math.round(-Number(c.PtStartY || 0) * schaal);
      const yEind = Math.round(-Number(c.PtEndY || 0) * schaal);
      const zelf = c.Start_Object_ID === c.End_Object_ID;
      const maakPunt = (lijn, y, suffix) => {
        const pid = `${cid}~${suffix}`;
        elements[pid] = { id: pid, naam: "", elementType: "punt", compartimenten: [], data: { randVan: lijn.id, eaBericht: cid } };
        // Positie relatief aan de levenslijn-node (rand-element, klem "as"):
        // x gecentreerd op de lijn, y op de hoogte van het bericht.
        nodes.push({ elementId: pid, position: { x: Math.round(LIJN_BREED / 2 - PUNT / 2), y: y - lijn.top - PUNT / 2 } });
        return pid;
      };
      const vanPunt = maakPunt(bron_, yStart, "van");
      const naarPunt = zelf ? vanPunt : maakPunt(doel, yEind, "naar");
      const soort = String(c.PDATA3 || "").toLowerCase() === "return" ? "retour" : String(c.PDATA1 || "").toLowerCase() === "asynchronous" ? "asynchroon" : "synchroon";
      const signatuur = Object.fromEntries(
        String(c.PDATA2 || "")
          .split(";")
          .map((kv) => kv.split("="))
          .filter(([k, v]) => k && v !== undefined)
          .map(([k, v]) => [k.trim(), v])
      );
      elements[cid] = {
        id: cid,
        naam: c.Name || "",
        elementType: soort,
        source: vanPunt,
        target: naarPunt,
        compartimenten: [],
        data: {
          ...extraData(h, c.ea_guid, null),
          volgnummer: Number(c.SeqNo) || 0,
          ...(signatuur.retval ? { retourtype: signatuur.retval } : {}),
          ...(signatuur.paramsDlg ? { argumenten: signatuur.paramsDlg } : {}),
          ...(c.Notes ? { notes: c.Notes } : {}),
        },
      };
      verslag.connectoren += 1;
      lijnen[cid] = { vorm: zelf ? "hoekig" : "recht" };
    }

    // Notitie-lijnen (NoteLink in t_diagramlinks) naar een levenslijn.
    for (const l of h.linksPerDiagram.get(d.Diagram_ID) || []) {
      const c = (bron.t_connector || []).find((x) => x.Connector_ID === l.ConnectorID);
      if (!c || c.Connector_Type !== "NoteLink") continue;
      const a = h.objectPerId.get(c.Start_Object_ID), b = h.objectPerId.get(c.End_Object_ID);
      if (!a || !b) continue;
      const aNotitie = a.Object_Type === "Note";
      const notitie = aNotitie ? a : b, ander = aNotitie ? b : a;
      const nid = idUitGuid(notitie.ea_guid), aid = idUitGuid(ander.ea_guid);
      if (!elements[nid] || !elements[aid]) continue;
      const cid = idUitGuid(c.ea_guid);
      elements[cid] = { id: cid, naam: "", elementType: "notitielijn", source: nid, target: aid, compartimenten: [], data: { ...extraData(h, c.ea_guid, null) } };
      verslag.connectoren += 1;
    }

    diagrams[diagramId(d)] = {
      id: diagramId(d),
      naam: d.Name || `Diagram ${d.Diagram_ID}`,
      diagramType: diagramTypeId,
      eaPakket: d.Package_ID,
      nodes,
      edges: [],
      ...(Object.keys(lijnen).length ? { lijnen } : {}),
    };
    verslag.diagrammen += 1;
  }

  return { diagramTypeId, elements, diagrams, verslag };
}
