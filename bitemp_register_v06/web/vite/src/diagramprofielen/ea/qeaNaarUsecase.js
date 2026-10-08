// @ts-check
/**
 * qeaNaarUsecase — lezer: EA use case-diagrammen → het use case-profiel.
 *
 * EA tekent op een use case-diagram graag méér dan use cases en actoren:
 * klassen uit andere pakketten (hier de registraties die een use case "legt
 * vast"), kaders (Boundary), notities en de gestippelde ovaal (Collaboration,
 * EA's "use case realization"). Alles wat op zo'n diagram staat komt mee;
 * klassen als `klasse` (alleen de naam), de rest in zijn eigen type.
 *
 * Connectoren: UseCase «include»/«extend» (voorwaarde in `PDATA4`),
 * Association, Generalization, Realisation (collaboratie → use case =
 * `realiseert`), Dependency (naam of «stereotype» als label), NoteLink.
 */
import { kleurUitBgr, idUitGuid, deelboomPakketten, EA_SCHAAL } from "./qeaHulp.js";
import { maakHulptabellen, maakVerslag, sla, extraData, maakConnectorElement, bouwDiagram } from "./qeaKern.js";

export const USECASE_DIAGRAMTYPE = "usecase";

/** EA Object_Type → use case-elementtype. */
const OBJECTTYPE_NAAR_ELEMENTTYPE = {
  UseCase: "usecase",
  Actor: "actor",
  Boundary: "boundary",
  Collaboration: "collaboratie",
  CollaborationOccurrence: "collaboratie",
  Note: "notitie",
  Text: "notitie",
  Class: "klasse",
  Interface: "klasse",
  Object: "klasse",
  Component: "klasse",
  Enumeration: "klasse",
  DataType: "klasse",
};

/**
 * @param {import("./qeaKern.js").QeaBron} bron
 * @param {{packageId:number, diagramTypeId?:string, schaal?:number}} opties
 */
export function qeaNaarUsecase(bron, { packageId, diagramTypeId = USECASE_DIAGRAMTYPE, schaal = EA_SCHAAL }) {
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const verslag = maakVerslag();
  const h = maakHulptabellen(bron, schaal);

  const ucDiagrammen = (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && d.Diagram_Type === "Use Case");
  for (const d of (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && d.Diagram_Type !== "Use Case")) {
    sla(verslag, `diagram ${d.Diagram_Type}`);
  }
  const opDiagram = new Set();
  for (const d of ucDiagrammen) for (const o of h.objectenPerDiagram.get(d.Diagram_ID) || []) opDiagram.add(o.Object_ID);

  /** @type {Record<string, any>} */
  const elements = {};
  const idVanObject = new Map();
  // Elementen: wat op een use case-diagram staat, plus use cases/actoren/
  // collaboraties van het pakket zelf (ook zonder tekening).
  const kandidaten = (bron.t_object || []).filter(
    (o) => opDiagram.has(o.Object_ID) || (pakketIds.has(o.Package_ID) && ["UseCase", "Actor", "Collaboration"].includes(o.Object_Type))
  );
  for (const o of kandidaten) {
    const elementType = OBJECTTYPE_NAAR_ELEMENTTYPE[o.Object_Type];
    if (!elementType) {
      sla(verslag, o.Object_Type);
      continue;
    }
    const id = idUitGuid(o.ea_guid);
    idVanObject.set(o.Object_ID, id);
    const data = {
      ...extraData(h, o.ea_guid, o.Object_ID),
      eaPakket: o.Package_ID,
      ...(o.Alias ? { alias: o.Alias } : {}),
      ...(o.Note && elementType !== "notitie" ? { toelichting: o.Note } : {}),
      ...(elementType === "klasse" && o.Object_Type !== "Class" ? { eaType: o.Object_Type } : {}),
    };
    const kleur = kleurUitBgr(o.Backcolor);
    if (kleur) data.kleur = kleur;
    elements[id] = {
      id,
      naam: elementType === "notitie" ? "" : o.Name || "",
      elementType,
      compartimenten: [],
      data: elementType === "notitie" ? { ...data, tekst: o.Note || o.Name || "" } : data,
    };
    verslag.elementen += 1;
  }

  // Connectoren
  const idVanConnector = new Map();
  for (const c of bron.t_connector || []) {
    const bronId = idVanObject.get(c.Start_Object_ID);
    const doelId = idVanObject.get(c.End_Object_ID);
    if (!bronId || !doelId) continue;
    const vertaald = vertaalConnector(c, bronId, doelId, elements);
    if (!vertaald) {
      sla(verslag, `connector ${c.Connector_Type}`);
      continue;
    }
    const el = maakConnectorElement(h, c, vertaald);
    idVanConnector.set(c.Connector_ID, el.id);
    elements[el.id] = el;
    verslag.connectoren += 1;
  }

  /** @type {Record<string, any>} */
  const diagrams = {};
  for (const d of ucDiagrammen) {
    const diagram = bouwDiagram(h, d, { idVanObject, idVanConnector, diagramTypeId, elements });
    diagrams[diagram.id] = diagram;
    verslag.diagrammen += 1;
  }
  return { diagramTypeId, elements, diagrams, verslag };
}

function vertaalConnector(c, bronId, doelId, elements) {
  const bron = elements[bronId]?.elementType, doel = elements[doelId]?.elementType;
  const naam = c.Name || "";
  const label = naam || (c.Stereotype ? `«${c.Stereotype}»` : "");
  const voorwaarde = c.PDATA4 ? { voorwaarde: c.PDATA4 } : {};
  switch (c.Connector_Type) {
    case "UseCase": {
      const soort = String(c.Stereotype || "").toLowerCase();
      if (soort === "include" || soort === "extend") {
        if (bron !== "usecase" || doel !== "usecase") return null;
        return { elementType: soort, naam, source: bronId, target: doelId, data: { ...voorwaarde } };
      }
      return null;
    }
    case "Association":
    case "Aggregation":
      return {
        elementType: "associatie",
        naam: label,
        source: bronId,
        target: doelId,
        data: {
          ...voorwaarde,
          ...(c.SourceCard ? { bronKardinaliteit: c.SourceCard } : {}),
          ...(c.DestCard ? { doelKardinaliteit: c.DestCard } : {}),
          ...(c.Connector_Type === "Aggregation" ? { eaConnectorType: "Aggregation" } : {}),
        },
      };
    case "Generalization":
      if (bron !== doel) return null; // actor→actor, usecase→usecase, klasse→klasse
      return { elementType: "generalisatie", naam, source: bronId, target: doelId, data: {} };
    case "Realisation":
    case "Realization":
      if (bron === "collaboratie" && doel === "usecase") {
        return { elementType: "realiseert", naam, source: bronId, target: doelId, data: {} };
      }
      return { elementType: "dependency", naam: naam || "«realize»", source: bronId, target: doelId, data: { eaConnectorType: c.Connector_Type } };
    case "Dependency":
    case "Abstraction":
    case "Usage":
      return { elementType: "dependency", naam: label, source: bronId, target: doelId, data: { ...voorwaarde } };
    case "NoteLink": {
      const bronIsNotitie = bron === "notitie";
      if (bronIsNotitie === (doel === "notitie")) return null;
      return {
        elementType: "notitielijn",
        naam: "",
        source: bronIsNotitie ? bronId : doelId,
        target: bronIsNotitie ? doelId : bronId,
        data: {},
        omgedraaid: !bronIsNotitie,
      };
    }
    default:
      return null;
  }
}
