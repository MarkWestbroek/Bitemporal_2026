// @ts-check
/**
 * qeaNaarPuurUml — lezer: rijen uit een Sparx EA-repository (één pakket met
 * deelpakketten, plus wat van elders op zijn diagrammen staat) → een
 * puur-uml-model ({elements, diagrams}) mét diagrammen, posities, maten,
 * knikpunten en verborgen lijnen.
 *
 * Principe (onderzoek §6.8): de lezer gooit niets weg. Wat puur-uml niet
 * kent reist mee op `data`: `eaGuid` (externe identiteit), `stereotypen`
 * (volledige namen uit t_xref), `tags` (tagged values), `notes`, `alias`.
 * Elementtypen die puur-uml niet heeft (Activity, UseCase, …) worden
 * overgeslagen en geteld in het verslag — die zijn voor de activity-/use
 * case-lezer (`qeaNaarActivity.js`).
 *
 * Pure functie, geen sql.js: de rijen komen uit `qeaLezer.js` (browser) of
 * uit een JSON-fixture (test). Kolomnamen = EA-kolomnamen. Gedeelde delen
 * (hulptabellen, knikpunten, diagrammen) staan in `qeaKern.js`.
 */
import { kleurUitBgr, idUitGuid, kardinaliteitUitGrenzen, deelboomPakketten, EA_SCHAAL } from "./qeaHulp.js";
import { maakHulptabellen, maakVerslag, sla, extraData, maakConnectorElement, maakBevat, bouwDiagram } from "./qeaKern.js";

export const PUUR_UML_DIAGRAMTYPE = "puur-uml";

/** EA Object_Type → puur-uml elementtype (null = overslaan). */
const OBJECTTYPE_NAAR_ELEMENTTYPE = {
  Class: "klasse",
  Interface: "interface",
  Enumeration: "enumeratie",
  DataType: "datatype",
  PrimitiveType: "datatype",
  Note: "notitie",
  Text: "notitie",
  Boundary: "boundary",
};

/**
 * @param {import("./qeaKern.js").QeaBron} bron
 * @param {{packageId:number, diagramTypeId?:string, schaal?:number}} opties
 *   `schaal` vergroot posities, maten en knikpunten (standaard `EA_SCHAAL`).
 */
export function qeaNaarPuurUml(bron, { packageId, diagramTypeId = PUUR_UML_DIAGRAMTYPE, schaal = EA_SCHAAL }) {
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const verslag = maakVerslag();
  const h = maakHulptabellen(bron, schaal);

  /** @type {Record<string, any>} */
  const elements = {};
  /** EA Object_ID → element-id (alleen voor gemapte objecten). */
  const idVanObject = new Map();
  /** EA Package_ID → element-id van het package-element. */
  const idVanPakket = new Map();

  // ── Packages (t_package; het bijbehorende t_object van type Package slaan we over) ──
  const pakketten = (bron.t_package || []).filter((p) => pakketIds.has(p.Package_ID));
  for (const p of pakketten) {
    const id = idUitGuid(p.ea_guid);
    idVanPakket.set(p.Package_ID, id);
    elements[id] = {
      id,
      naam: p.Name || "",
      elementType: "package",
      compartimenten: [],
      data: { eaGuid: p.ea_guid, ...(p.Notes ? { notes: p.Notes } : {}) },
    };
    verslag.elementen += 1;
  }
  for (const p of pakketten) {
    const ouder = idVanPakket.get(p.Parent_ID);
    if (ouder) maakBevat(elements, ouder, idVanPakket.get(p.Package_ID));
  }
  // Een package staat ook op diagrammen — via zijn t_object (type Package,
  // PDATA1 = Package_ID). Koppel dat object aan het package-element.
  for (const o of bron.t_object || []) {
    if (o.Object_Type !== "Package") continue;
    const id = idVanPakket.get(Number(o.PDATA1));
    if (id) idVanObject.set(o.Object_ID, id);
  }

  // ── Elementen (in de pakketten, of van elders op een diagram hier) ─────
  for (const o of bron.t_object || []) {
    if (o.Object_Type === "Package") continue; // dubbel met t_package
    const elementType = OBJECTTYPE_NAAR_ELEMENTTYPE[o.Object_Type];
    if (!elementType) {
      sla(verslag, o.Object_Type);
      continue;
    }
    const id = idUitGuid(o.ea_guid);
    idVanObject.set(o.Object_ID, id);
    const data = {
      ...extraData(h, o.ea_guid, o.Object_ID),
      ...(o.Alias ? { alias: o.Alias } : {}),
      ...(o.Note && elementType !== "notitie" ? { notes: o.Note } : {}),
      ...(String(o.Abstract) === "1" ? { abstract: true } : {}),
    };
    const kleur = kleurUitBgr(o.Backcolor);
    if (kleur) data.kleur = kleur;

    const element = {
      id,
      naam: elementType === "notitie" ? "" : o.Name || "",
      elementType,
      compartimenten: [],
      data,
    };
    if (elementType === "notitie") {
      element.data.tekst = o.Note || o.Name || "";
    } else {
      element.compartimenten = compartimentenVoor(o, elementType, h);
    }
    elements[id] = element;
    verslag.elementen += 1;
    const pakket = idVanPakket.get(o.Package_ID);
    if (pakket) maakBevat(elements, pakket, id);
  }

  // ── Connectoren ───────────────────────────────────────────────────────
  /** EA Connector_ID → element-id. */
  const idVanConnector = new Map();
  for (const c of bron.t_connector || []) {
    const bronId = idVanObject.get(c.Start_Object_ID);
    const doelId = idVanObject.get(c.End_Object_ID);
    if (!bronId || !doelId) {
      if (c.Connector_Type !== "NoteLink") sla(verslag, `connector buiten bereik (${c.Connector_Type})`);
      continue;
    }
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

  // ── Diagrammen ────────────────────────────────────────────────────────
  /** @type {Record<string, any>} */
  const diagrams = {};
  for (const d of (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID))) {
    const diagram = bouwDiagram(h, d, { idVanObject, idVanConnector, diagramTypeId, elements });
    diagrams[diagram.id] = diagram;
    verslag.diagrammen += 1;
  }

  return { diagramTypeId, elements, diagrams, verslag };
}

// ── Hulpfuncties ────────────────────────────────────────────────────────

/** Attributen/operaties/literals als compartimenten van puur-uml. */
function compartimentenVoor(o, elementType, h) {
  const attrs = h.attrsPerObject.get(o.Object_ID) || [];
  const ops = h.opsPerObject.get(o.Object_ID) || [];
  const comps = [];
  if (elementType === "enumeratie") {
    if (attrs.length) {
      comps.push({
        compartmentType: "literals",
        velden: attrs.map((a) => ({ naam: a.Name || "", fieldType: "literal", data: veldData(a) })),
      });
    }
    return comps;
  }
  if (["klasse", "datatype"].includes(elementType) && attrs.length) {
    comps.push({
      compartmentType: "attributen",
      velden: attrs.map((a) => {
        const kard = kardinaliteitUitGrenzen(a.LowerBound, a.UpperBound);
        return {
          naam: a.Name || "",
          fieldType: "attribuut",
          data: {
            ...veldData(a),
            ...(a.Type ? { typeLabel: a.Type } : {}),
            ...(kard ? { kardinaliteit: kard } : {}),
            ...(a.Scope ? { zichtbaarheid: a.Scope } : {}),
            ...(String(a.Derived) === "1" ? { afgeleid: true } : {}),
          },
        };
      }),
    });
  }
  if (["klasse", "interface"].includes(elementType) && ops.length) {
    comps.push({
      compartmentType: "operaties",
      velden: ops.map((op) => ({
        naam: `${op.Name || ""}()`,
        fieldType: "operatie",
        data: { ...veldData(op), ...(op.Type ? { typeLabel: op.Type } : {}) },
      })),
    });
  }
  return comps;
}

function veldData(rij) {
  return {
    ...(rij.ea_guid ? { eaGuid: rij.ea_guid } : {}),
    ...(rij.Notes ? { notes: rij.Notes } : {}),
    ...(rij.Stereotype ? { stereotypen: [rij.Stereotype] } : {}),
  };
}

/**
 * EA-connector → puur-uml-connector. Let op de richting van aggregaties: in
 * EA is Start het deel en End het geheel (ruit aan End); puur-uml tekent de
 * ruit aan de bron, dus bron = geheel (`omgedraaid` draait de knikken mee).
 * @returns {{elementType:string, naam:string, source:string, target:string, data:Record<string,any>, omgedraaid?:boolean}|null}
 */
function vertaalConnector(c, bronId, doelId, elements) {
  const naam = c.Name || "";
  const type = c.Connector_Type;
  const gericht = c.Direction === "Source -> Destination";
  const kanten = {
    ...(c.SourceCard ? { bronKardinaliteit: c.SourceCard } : {}),
    ...(c.DestCard ? { doelKardinaliteit: c.DestCard } : {}),
    ...(c.SourceRole ? { bronRolNaam: c.SourceRole } : {}),
    ...(c.DestRole ? { doelRolNaam: c.DestRole } : {}),
  };
  switch (type) {
    case "NoteLink": {
      // EA legt een NoteLink in willekeurige richting; puur-uml wil de
      // notitie als bron. Beide kanten notitie (of geen): overslaan.
      const bronIsNotitie = elements[bronId]?.elementType === "notitie";
      const doelIsNotitie = elements[doelId]?.elementType === "notitie";
      if (bronIsNotitie === doelIsNotitie) return null;
      return {
        elementType: "notitielijn",
        naam: "",
        source: bronIsNotitie ? bronId : doelId,
        target: bronIsNotitie ? doelId : bronId,
        data: {},
        omgedraaid: !bronIsNotitie,
      };
    }
    case "Association": {
      const geheelAanDoel = Number(c.DestIsAggregate) > 0;
      const geheelAanBron = Number(c.SourceIsAggregate) > 0;
      if (geheelAanDoel || geheelAanBron) {
        // Associatie met aggregatie-vlag: zelfde behandeling als Aggregation.
        return aggregatie(c, bronId, doelId, naam, geheelAanDoel);
      }
      return { elementType: "associatie", naam, source: bronId, target: doelId, data: { ...kanten, ...(gericht ? { directioneel: true } : {}) } };
    }
    case "Aggregation":
      return aggregatie(c, bronId, doelId, naam, Number(c.SourceIsAggregate) === 0);
    case "Generalization":
      return { elementType: "generalisatie", naam, source: bronId, target: doelId, data: {} };
    case "Realisation":
    case "Realization":
      if (elements[doelId]?.elementType === "interface") {
        return { elementType: "realisatie", naam, source: bronId, target: doelId, data: {} };
      }
      // Realisatie naar een klasse mag in puur-uml niet; bewaar als dependency met label.
      return { elementType: "dependency", naam: naam || "«realize»", source: bronId, target: doelId, data: { eaConnectorType: type } };
    case "Dependency":
    case "Abstraction":
    case "Usage":
      return {
        elementType: "dependency",
        naam: naam || (c.Stereotype ? `«${c.Stereotype}»` : ""),
        source: bronId,
        target: doelId,
        data: { ...(type !== "Dependency" ? { eaConnectorType: type } : {}) },
      };
    default:
      return null;
  }
}

function aggregatie(c, bronId, doelId, naam, geheelAanDoel) {
  const sterk = Number(geheelAanDoel ? c.DestIsAggregate : c.SourceIsAggregate) === 2 || c.SubType === "Strong";
  const geheel = geheelAanDoel ? doelId : bronId;
  const deel = geheelAanDoel ? bronId : doelId;
  // Kardinaliteiten/rollen volgen de kant: bron (ruit) = geheel.
  const geheelCard = geheelAanDoel ? c.DestCard : c.SourceCard;
  const deelCard = geheelAanDoel ? c.SourceCard : c.DestCard;
  const geheelRol = geheelAanDoel ? c.DestRole : c.SourceRole;
  const deelRol = geheelAanDoel ? c.SourceRole : c.DestRole;
  return {
    elementType: sterk ? "compositie" : "aggregatie",
    naam,
    source: geheel,
    target: deel,
    omgedraaid: geheelAanDoel,
    data: {
      ...(geheelCard ? { bronKardinaliteit: geheelCard } : {}),
      ...(deelCard ? { doelKardinaliteit: deelCard } : {}),
      ...(geheelRol ? { bronRolNaam: geheelRol } : {}),
      ...(deelRol ? { doelRolNaam: deelRol } : {}),
    },
  };
}
