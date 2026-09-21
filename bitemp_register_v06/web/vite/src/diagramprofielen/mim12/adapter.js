// @ts-check
/**
 * adapter — twee routes het MIM-profiel in (verkenning §4.5/§4.6):
 *
 *  1. `vanCanoniekCoreNaarMim(coreState)` — transformatie vanuit het
 *     canonieke model (in de diagramcore-vorm die `vanCanoniekModel`
 *     oplevert). Het canonieke profiel is bijna een MIM-dialect:
 *       entiteit → objecttype          gegevenselement → gegevensgroeptype
 *       compositie → gegevensgroep     relatie → relatiesoort (met rollen)
 *       enumeratie → enumeratie        gegevenstype → primitief datatype
 *       referentielijst → referentielijst   domein-package → package
 *       materieel → indicatie materiële historie
 *     Diagram-layouts blijven behouden (zelfde nodes, nieuwe diagramType).
 *
 *  2. `vanMimXmi(xmlTekst)` — import van een XMI-export met het
 *     MIM-UML-profiel (de gangbare EA-vorm van Geonovum): uml:Package/
 *     uml:Class/uml:Enumeration/uml:DataType + stereotypes uit de
 *     xmi:Extension (base_Class/base_Package/…-verwijzingen), attributen
 *     met kardinaliteit, associaties met rollen, generalisaties en
 *     package-nesting. Tagged values (metagegevens) zijn fase 2.
 *
 * Puur en store-loos: testbaar met kale objecten/strings.
 */

const PER_RIJ = 4;

/** Kardinaliteit uit canoniek veld-data (verplicht → 1, anders 0..1). */
function veldKardinaliteit(data) {
  return data?.verplicht === false ? "0..1" : "1";
}

/** Canoniek attribuut-/afgeleid-veld → MIM-attribuutsoort-veld. */
function naarAttribuutsoort(veld, { afgeleid = false } = {}) {
  const d = veld.data || {};
  return {
    naam: veld.naam,
    fieldType: "attribuutsoort",
    data: {
      ...(d.typeLabel ? { typeLabel: d.typeLabel } : {}),
      kardinaliteit: veldKardinaliteit(d),
      ...(afgeleid || d.afgeleid ? { indicatieAfleidbaar: true } : {}),
    },
  };
}

function compVelden(el, compartmentType) {
  return (
    (el.compartimenten || []).find((c) => c.compartmentType === compartmentType)?.velden || []
  );
}

/**
 * Canoniek diagramcore-model → MIM-model ({elements, diagrams}).
 * @param {{elements: Record<string, Object>, diagrams?: Record<string, Object>, meta?: Object}} coreState
 */
export function vanCanoniekCoreNaarMim(coreState) {
  const bron = coreState?.elements || {};
  const elements = {};
  let teller = 0;
  const vrijId = (basis) => `mim_${basis}_${(teller += 1)}`;

  const attribuutsoorten = (el) => [
    ...compVelden(el, "velden").map((v) => naarAttribuutsoort(v)),
    ...compVelden(el, "afgeleid").map((v) => naarAttribuutsoort(v, { afgeleid: true })),
  ];

  for (const el of Object.values(bron)) {
    const d = el.data || {};
    switch (el.elementType) {
      case "entiteit":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "objecttype",
          compartimenten: [{ compartmentType: "attribuutsoorten", velden: attribuutsoorten(el) }],
          data: {
            ...(d.abstract ? { indicatieAbstract: true } : {}),
            ...(d.materieel ? { toelichting: "materieel (tijdlijn) in het canonieke model" } : {}),
          },
        };
        break;
      case "gegevenselement":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "gegevensgroeptype",
          compartimenten: [{ compartmentType: "attribuutsoorten", velden: attribuutsoorten(el) }],
          data: {},
        };
        break;
      case "relatie": {
        if (!el.source || !el.target) break; // wees-relatie: geen MIM-tegenhanger
        const velden = attribuutsoorten(el);
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "relatiesoort",
          source: el.source,
          target: el.target,
          compartimenten: velden.length
            ? [{ compartmentType: "attribuutsoorten", velden }]
            : [],
          data: {
            ...(d.bronKardinaliteit ? { bronKardinaliteit: d.bronKardinaliteit } : {}),
            ...(d.doelKardinaliteit ? { doelKardinaliteit: d.doelKardinaliteit } : {}),
            // Canonieke naam-labels zijn de leesrichtingen; MIM kent rollen.
            ...(d.naamLabelHeen ? { doelRolNaam: d.naamLabelHeen } : {}),
            ...(d.naamLabelTerug ? { bronRolNaam: d.naamLabelTerug } : {}),
            ...(d.directioneel ? { unidirectioneel: true } : {}),
            ...(d.materieel ? { indicatieMaterieleHistorie: true } : {}),
          },
        };
        break;
      }
      case "enumeratie":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "enumeratie",
          compartimenten: [
            {
              compartmentType: "waarden",
              velden: compVelden(el, "waarden").map((v) => ({
                naam: v.naam,
                fieldType: "waarde",
                data: {},
              })),
            },
          ],
          data: {},
        };
        break;
      case "gegevenstype": {
        const eigenschap = (naam) =>
          compVelden(el, "eigenschappen").find((v) => v.naam === naam)?.data?.typeLabel;
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "primitiefDatatype",
          compartimenten: [],
          data: {
            ...(eigenschap("basistype") ? { toelichting: `basistype: ${eigenschap("basistype")}` } : {}),
            ...(d.validatie ? { formeelPatroon: d.validatie } : {}),
            ...(d.weergave ? { patroon: d.weergave } : {}),
          },
        };
        break;
      }
      case "referentielijstInstantie":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "referentielijst",
          compartimenten: [
            {
              compartmentType: "elementen",
              velden: compVelden(el, "eigenschappen").map((v) => ({
                naam: v.naam,
                fieldType: "referentieElement",
                data: { ...(v.data?.typeLabel ? { typeLabel: v.data.typeLabel } : {}) },
              })),
            },
          ],
          data: {},
        };
        break;
      case "package":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "package",
          compartimenten: [],
          data: { soort: "domein" },
        };
        break;
      case "bevat":
        if (el.source && el.target) {
          elements[el.id] = { ...el, compartimenten: [], data: {} };
        }
        break;
      case "generalisatie":
        if (el.source && el.target) {
          elements[el.id] = {
            id: el.id,
            naam: "",
            elementType: "generalisatie",
            source: el.source,
            target: el.target,
            compartimenten: [],
            data: {},
          };
        }
        break;
      case "compositie":
        if (el.source && el.target) {
          elements[el.id] = {
            id: el.id,
            naam: "",
            elementType: "gegevensgroep",
            source: el.source,
            target: el.target,
            compartimenten: [],
            data: {},
          };
        }
        break;
      case "notitie":
        elements[el.id] = { ...el, elementType: "notitie" };
        break;
      case "constraint":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          elementType: "constraint",
          compartimenten: [],
          data: { ...(d.expressie ? { specificatie: d.expressie } : {}) },
        };
        break;
      default:
        // boundary/gebruik e.d.: geen MIM-tegenhanger (types dekken «use» af).
        break;
    }
  }

  // Composities die alleen als structurele meta bestonden (heenreis-spiegel):
  // ook dat zijn MIM-gegevensgroepen.
  for (const e of coreState?.meta?.compositieEdges || []) {
    if (!elements[e.source] || !elements[e.target]) continue;
    const bestaat = Object.values(elements).some(
      (el) => el.elementType === "gegevensgroep" && el.source === e.source && el.target === e.target
    );
    if (!bestaat) {
      const id = vrijId("gg");
      elements[id] = {
        id,
        naam: "",
        elementType: "gegevensgroep",
        source: e.source,
        target: e.target,
        compartimenten: [],
        data: {},
      };
    }
  }

  // Generalisaties die alleen als presentatie-edge leven (spiegel).
  for (const diag of Object.values(coreState?.diagrams || {})) {
    for (const e of diag.edges || []) {
      if (e.data?.bron?.isGeneralization !== true) continue;
      if (!elements[e.source] || !elements[e.target]) continue;
      const bestaat = Object.values(elements).some(
        (el) => el.elementType === "generalisatie" && el.source === e.source && el.target === e.target
      );
      if (!bestaat) {
        const id = vrijId("gen");
        elements[id] = {
          id,
          naam: "",
          elementType: "generalisatie",
          source: e.source,
          target: e.target,
          compartimenten: [],
          data: {},
        };
      }
    }
  }

  // Wortel: één informatiemodel-package boven de domein-packages.
  const domeinPkgs = Object.values(elements).filter(
    (el) => el.elementType === "package" && el.data?.soort === "domein"
  );
  if (domeinPkgs.length) {
    const heeftOuder = new Set(
      Object.values(elements)
        .filter((el) => el.elementType === "bevat")
        .map((el) => el.target)
    );
    const imId = "mim_informatiemodel";
    elements[imId] = {
      id: imId,
      naam: coreState?.meta?.modelMeta?.naam || "Informatiemodel",
      elementType: "package",
      compartimenten: [],
      data: { soort: "informatiemodel", mimVersie: "1.2" },
    };
    for (const pkg of domeinPkgs) {
      if (heeftOuder.has(pkg.id)) continue;
      const id = vrijId("bev");
      elements[id] = {
        id,
        naam: "",
        elementType: "bevat",
        source: imId,
        target: pkg.id,
        compartimenten: [],
        data: {},
      };
    }
  }

  // Diagrammen: zelfde layout, MIM-type; alleen nodes van gemapte elementen.
  const diagrams = {};
  for (const [id, diag] of Object.entries(coreState?.diagrams || {})) {
    diagrams[id] = {
      id,
      naam: diag.naam || id,
      diagramType: "mim12",
      nodes: (diag.nodes || []).filter((n) => elements[n.elementId]),
      edges: [],
      ...(diag.viewport ? { viewport: diag.viewport } : {}),
    };
  }

  return { elements, diagrams };
}

// ═══════════════════════════════════════════════════════════════════════════
// XMI-import (MIM-UML-profiel, EA-vorm)
// ═══════════════════════════════════════════════════════════════════════════

/** Lokale naam zonder namespace-prefix ("thecustomprofile:Objecttype" → "objecttype"). */
function lokaleNaam(tag) {
  return tag.split(":").pop().toLowerCase();
}

/** xmi:type/xmi:id lezen, namespace-onafhankelijk. */
function attr(el, naam) {
  return (
    el.getAttribute(naam) ||
    el.getAttribute(`xmi:${naam}`) ||
    el.getAttributeNS?.("http://www.omg.org/spec/XMI/20131001", naam) ||
    el.getAttributeNS?.("http://schema.omg.org/spec/XMI/2.1", naam) ||
    null
  );
}

const STEREOTYPE_NAAR_TYPE = {
  objecttype: "objecttype",
  gegevensgroeptype: "gegevensgroeptype",
  enumeratie: "enumeratie",
  codelijst: "codelijst",
  referentielijst: "referentielijst",
  "primitief datatype": "primitiefDatatype",
  primitiefdatatype: "primitiefDatatype",
  "gestructureerd datatype": "gestructureerdDatatype",
  gestructureerddatatype: "gestructureerdDatatype",
  keuze: "keuze",
  domein: "domein",
  informatiemodel: "informatiemodel",
  extern: "extern",
  view: "view",
};

/** Kardinaliteit uit lower/upper ("1","*" → "1..*"; gelijk → één getal). */
function kardinaliteit(lower, upper) {
  const lo = lower ?? "1";
  const hi = upper === "-1" ? "*" : upper ?? "1";
  return String(lo) === String(hi) ? String(lo) : `${lo}..${hi}`;
}

/**
 * XMI (MIM-UML-profiel) → MIM-model ({elements, diagrams}).
 * @param {string} xmlTekst
 */
export function vanMimXmi(xmlTekst) {
  const doc = new DOMParser().parseFromString(xmlTekst, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Dit bestand is geen geldige XML.");
  }
  const alles = [...doc.getElementsByTagName("*")];
  const model = alles.find((el) => (attr(el, "type") || "") === "uml:Model");
  if (!model) throw new Error("Geen uml:Model gevonden — is dit een XMI-export?");

  // Stereotypes: profielelementen buiten het model verwijzen via base_*-
  // attributen naar hun doel ("<MIM:Objecttype base_Class='id42'/>").
  const stereotypeVan = new Map();
  for (const el of alles) {
    for (const a of el.attributes || []) {
      if (!a.name.startsWith("base_")) continue;
      const naam = lokaleNaam(el.tagName);
      if (!stereotypeVan.has(a.value)) stereotypeVan.set(a.value, naam);
    }
  }

  const elements = {};
  const naamVanId = new Map();
  let teller = 0;
  const vrijId = (basis) => `xmi_${basis}_${(teller += 1)}`;

  const typeVoorClass = (xmiId, umlType) => {
    const st = STEREOTYPE_NAAR_TYPE[stereotypeVan.get(xmiId) || ""];
    if (st && !["domein", "informatiemodel", "extern", "view"].includes(st)) return st;
    if (umlType === "uml:Enumeration") return "enumeratie";
    if (umlType === "uml:DataType" || umlType === "uml:PrimitiveType") return "primitiefDatatype";
    return "objecttype"; // zonder stereotype: de veiligste aanname
  };

  const leden = (pkgEl) =>
    [...pkgEl.children].filter((k) => k.tagName === "packagedElement");

  /** Verwerk een package(-inhoud); geeft de element-ids van de leden terug. */
  const verwerkPackage = (pkgEl, ouderPkgId) => {
    for (const kind of leden(pkgEl)) {
      const umlType = attr(kind, "type") || "";
      const xmiId = attr(kind, "id") || vrijId("el");
      const naam = kind.getAttribute("name") || "(naamloos)";

      if (umlType === "uml:Package") {
        const st = STEREOTYPE_NAAR_TYPE[stereotypeVan.get(xmiId) || ""] || "domein";
        elements[xmiId] = {
          id: xmiId,
          naam,
          elementType: "package",
          compartimenten: [],
          data: { soort: st === "extern" || st === "view" || st === "informatiemodel" ? st : "domein" },
        };
        koppelBevat(ouderPkgId, xmiId);
        verwerkPackage(kind, xmiId);
        continue;
      }

      if (umlType === "uml:Association") {
        associaties.push(kind);
        continue;
      }

      if (["uml:Class", "uml:Enumeration", "uml:DataType", "uml:PrimitiveType"].includes(umlType)) {
        const elementType = typeVoorClass(xmiId, umlType);
        naamVanId.set(xmiId, naam);
        const attribuutVelden = [];
        const waardeVelden = [];
        for (const sub of kind.children) {
          if (sub.tagName === "ownedLiteral") {
            waardeVelden.push({ naam: sub.getAttribute("name") || "", fieldType: "waarde", data: {} });
          } else if (sub.tagName === "ownedAttribute" && !sub.getAttribute("association")) {
            const lower = sub.getElementsByTagName("lowerValue")[0]?.getAttribute("value");
            const upper = sub.getElementsByTagName("upperValue")[0]?.getAttribute("value");
            const typeRef =
              sub.getAttribute("type") ||
              sub.getElementsByTagName("type")[0]?.getAttribute("xmi:idref") ||
              null;
            attribuutVelden.push({
              naam: sub.getAttribute("name") || "",
              fieldType: "attribuutsoort",
              data: {
                ...(typeRef ? { _typeRef: typeRef } : {}),
                kardinaliteit: kardinaliteit(lower, upper),
              },
            });
          } else if (sub.tagName === "generalization") {
            const doel = sub.getAttribute("general");
            if (doel) generalisaties.push({ source: xmiId, target: doel });
          }
        }
        const compartimenten = [];
        if (attribuutVelden.length) {
          compartimenten.push({ compartmentType: "attribuutsoorten", velden: attribuutVelden });
        }
        if (waardeVelden.length && elementType === "enumeratie") {
          compartimenten.push({ compartmentType: "waarden", velden: waardeVelden });
        }
        elements[xmiId] = { id: xmiId, naam, elementType, compartimenten, data: {} };
        koppelBevat(ouderPkgId, xmiId);
      }
    }
  };

  const associaties = [];
  const generalisaties = [];
  const koppelBevat = (ouderId, kindId) => {
    if (!ouderId) return;
    const id = vrijId("bevat");
    elements[id] = {
      id,
      naam: "",
      elementType: "bevat",
      source: ouderId,
      target: kindId,
      compartimenten: [],
      data: {},
    };
  };

  verwerkPackage(model, null);

  // Attribuut-typen: idref → naam van het (nu bekende) type-element.
  for (const el of Object.values(elements)) {
    for (const c of el.compartimenten || []) {
      for (const v of c.velden || []) {
        if (v.data?._typeRef) {
          const naam = naamVanId.get(v.data._typeRef);
          if (naam) v.data.typeLabel = naam;
          delete v.data._typeRef;
        }
      }
    }
  }

  // Associaties: memberEnd-properties (rolnaam/kardinaliteit per zijde).
  for (const assoc of associaties) {
    const ends = [...assoc.getElementsByTagName("ownedEnd")];
    // EA zet één end soms als ownedAttribute op de class; zoek die erbij.
    const assocId = attr(assoc, "id");
    for (const el of alles) {
      if (el.tagName === "ownedAttribute" && el.getAttribute("association") === assocId) {
        ends.push(el);
      }
    }
    const kanten = ends
      .map((end) => ({
        type: end.getAttribute("type") || end.getElementsByTagName("type")[0]?.getAttribute("xmi:idref"),
        rol: end.getAttribute("name") || "",
        kard: kardinaliteit(
          end.getElementsByTagName("lowerValue")[0]?.getAttribute("value"),
          end.getElementsByTagName("upperValue")[0]?.getAttribute("value")
        ),
      }))
      .filter((k) => k.type && elements[k.type]);
    if (kanten.length < 2) continue;
    const [a, b] = kanten;
    const id = attr(assoc, "id") || vrijId("rel");
    elements[id] = {
      id,
      naam: assoc.getAttribute("name") || "",
      elementType: "relatiesoort",
      source: a.type,
      target: b.type,
      compartimenten: [],
      data: {
        ...(a.kard ? { bronKardinaliteit: a.kard } : {}),
        ...(b.kard ? { doelKardinaliteit: b.kard } : {}),
        ...(a.rol ? { bronRolNaam: a.rol } : {}),
        ...(b.rol ? { doelRolNaam: b.rol } : {}),
      },
    };
  }

  for (const gen of generalisaties) {
    if (!elements[gen.source] || !elements[gen.target]) continue;
    const id = vrijId("gen");
    elements[id] = {
      id,
      naam: "",
      elementType: "generalisatie",
      source: gen.source,
      target: gen.target,
      compartimenten: [],
      data: {},
    };
  }

  // Eén diagram met een simpele grid-plaatsing van de "canvas-waardige" typen.
  const canvasIds = Object.values(elements)
    .filter((el) => !el.source && el.elementType !== "package")
    .map((el) => el.id);
  const nodes = canvasIds.map((eid, i) => ({
    elementId: eid,
    position: { x: 60 + (i % PER_RIJ) * 340, y: 60 + Math.floor(i / PER_RIJ) * 280 },
  }));
  const modelNaam = model.getAttribute("name") || "MIM-import";
  return {
    elements,
    diagrams: {
      import: { id: "import", naam: modelNaam, diagramType: "mim12", nodes, edges: [] },
    },
  };
}
