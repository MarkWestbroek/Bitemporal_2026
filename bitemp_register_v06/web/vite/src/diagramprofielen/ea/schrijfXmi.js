// @ts-check
/**
 * schrijfXmi — de terugweg naar Sparx EA: een Omnium-klassenmodel (puur-uml
 * of MIM) als **XMI 2.1 in EA's eigen vorm**, met de bewaarde GUIDs, zodat EA
 * bij importeren de bestaande elementen bijwerkt in plaats van ze te
 * verdubbelen (onderzoek §3: EA → Omnium uit de .qea, Omnium → EA via XMI).
 *
 * Vorm (afgekeken van EA 16's export "Gemeentelijk Gegevensmodel XMI2.1.xml"):
 *   <xmi:XMI xmlns:xmi="…/XMI/2.1" xmlns:uml="…/UML/2.1">
 *     <xmi:Documentation exporter="…"/>
 *     <uml:Model …>  packagedElement uml:Package → uml:Class/Interface/
 *       Enumeration/DataType (ownedAttribute, ownedOperation, ownedLiteral,
 *       generalization), uml:Association (memberEnd + ownedEnd met type,
 *       lower/upper, aggregation), uml:Dependency/Realization, ownedComment
 *     <xmi:Extension extender="Enterprise Architect">
 *       <elements>   per element: model/properties (stereotype, documentation,
 *                    isAbstract), tags
 *       <connectors> per lijn: source/target (rol, multipliciteit, aggregatie),
 *                    properties ea_type, labels, tags
 *       <diagrams>   per diagram: elements met geometry Left/Top/Right/Bottom
 *                    (EA-eenheden: Omnium-coördinaten gedeeld door de schaal),
 *                    lijnen met Path (knikken) en Mode/TREE uit de lijnvorm
 *
 * Identiteit: `data.eaGuid` (of het id `ea-<guid>` / `ead-<guid>` uit de
 * lezer) → `EAID_…` / `EAPK_…` (accolades weg, streepjes → underscores,
 * zoals EA). Elementen zonder GUID krijgen er hier een; de aanroeper krijgt
 * die terug (`nieuweGuids`) om ze op het element te bewaren, zodat een
 * volgende export dezelfde identiteit houdt.
 *
 * Puur: geen DOM, geen store — testbaar in node.
 */
import { EA_SCHAAL } from "./qeaHulp.js";

/** Omnium elementtype → UML-type in het uml:Model (puur-uml en mim12). */
const UML_TYPE = {
  klasse: "uml:Class",
  interface: "uml:Interface",
  enumeratie: "uml:Enumeration",
  datatype: "uml:DataType",
  package: "uml:Package",
  // MIM 1.2
  objecttype: "uml:Class",
  gegevensgroeptype: "uml:Class",
  codelijst: "uml:Class",
  referentielijst: "uml:Class",
  primitiefDatatype: "uml:DataType",
  gestructureerdDatatype: "uml:DataType",
  keuze: "uml:Class",
  constraint: "uml:Constraint",
};
/** MIM-elementtypen → EA-stereotype (MIM-MDG); puur-uml heeft er geen. */
const MIM_STEREOTYPE = {
  objecttype: "Objecttype",
  gegevensgroeptype: "Gegevensgroeptype",
  enumeratie: "Enumeratie",
  codelijst: "Codelijst",
  referentielijst: "Referentielijst",
  primitiefDatatype: "Primitief datatype",
  gestructureerdDatatype: "Gestructureerd datatype",
  keuze: "Keuze",
  constraint: "Constraint",
};
const ASSOCIATIE_TYPEN = new Set(["associatie", "aggregatie", "compositie", "relatiesoort", "gegevensgroep", "externeKoppeling"]);
const GEHEEL_AAN_BRON = { aggregatie: "shared", compositie: "composite", gegevensgroep: "composite" };
/** Omnium-lijnvorm → EA Style (lijnstijl). */
const STIJL_VOOR_VORM = { recht: "Mode=3;", hoekig: "Mode=3;TREE=OS;", boom: "Mode=3;TREE=V;", bezier: "Mode=3;" };

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "&#xA;");

function nieuweGuid() {
  const hex = (n) => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, "0").toUpperCase();
  if (globalThis.crypto?.randomUUID) return `{${globalThis.crypto.randomUUID().toUpperCase()}}`;
  return `{${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}}`;
}
/** `{3A5B…}` → `3A5B_…` (EA-id-staart). */
const guidStaart = (guid) => String(guid).replace(/[{}]/g, "").replace(/-/g, "_");
/** GUID uit een lezer-id (`ea-<guid>` / `ead-<guid>`), anders null. */
function guidUitId(id) {
  const m = String(id || "").match(/^ead?-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return m ? `{${m[1].toUpperCase()}}` : null;
}
/** Omnium-kardinaliteit ("0..*", "1", "1..*") → [lower, upper] voor XMI. */
function grenzen(kard) {
  const k = String(kard || "").trim();
  if (!k) return null;
  const m = k.match(/^(\d+|\*)(?:\.\.(\d+|\*))?$/);
  if (!m) return null;
  const lo = m[1] === "*" ? "0" : m[1];
  const hi = m[2] == null ? m[1] : m[2];
  return [lo, hi === "*" ? "-1" : hi];
}

/**
 * @param {{elements: Record<string, any>, diagrams?: Record<string, any>}} model
 * @param {{naam?: string, schaal?: number, exporter?: string}} [opties]
 * @returns {{xml: string, nieuweGuids: Map<string, string>, verslag: {elementen: number, connectoren: number, diagrammen: number, overgeslagen: Record<string, number>}}}
 */
export function schrijfXmi(model, { naam = "Omnium", schaal = EA_SCHAAL, exporter = "Omnium Studio" } = {}) {
  const elements = model.elements || {};
  const diagrams = model.diagrams || {};
  const nieuweGuids = new Map();
  const verslag = { elementen: 0, connectoren: 0, diagrammen: 0, overgeslagen: {} };
  const sla = (soort) => (verslag.overgeslagen[soort] = (verslag.overgeslagen[soort] || 0) + 1);

  const guidVan = (obj, sleutel = obj.id) => {
    const bekend = obj?.data?.eaGuid || guidUitId(sleutel);
    if (bekend) return bekend;
    if (!nieuweGuids.has(sleutel)) nieuweGuids.set(sleutel, nieuweGuid());
    return nieuweGuids.get(sleutel);
  };
  const eaId = (el) => `EAID_${guidStaart(guidVan(el))}`;
  const pkId = (el) => `EAPK_${guidStaart(guidVan(el))}`;
  const xmiId = (el) => (el.elementType === "package" ? pkId(el) : eaId(el));

  // ── Structuur: pakketten en lidmaatschap (bevat) ───────────────────────
  const alle = Object.values(elements);
  const isConnector = (el) => !!(el.source && el.target);
  const ouderVan = new Map(); // element-id → package-id
  for (const el of alle) if (el.elementType === "bevat" && isConnector(el)) ouderVan.set(el.target, el.source);
  const pakketten = alle.filter((el) => el.elementType === "package");
  const wortelGuid = { id: "__wortel__", data: {} };
  const wortelId = `EAPK_${guidStaart(guidVan(wortelGuid, "__wortel__"))}`;
  const kinderenVan = new Map(); // package-id (of "__wortel__") → elementen
  const voeg = (ouder, el) => {
    if (!kinderenVan.has(ouder)) kinderenVan.set(ouder, []);
    kinderenVan.get(ouder).push(el);
  };
  for (const el of alle) {
    if (isConnector(el) || el.elementType === "bevat") continue;
    const ouder = ouderVan.get(el.id);
    voeg(ouder && elements[ouder]?.elementType === "package" ? ouder : "__wortel__", el);
  }
  const naamVan = new Map(alle.filter((el) => !isConnector(el)).map((el) => [el.naam, el]));
  const typeRef = (label) => {
    const el = label ? naamVan.get(label) : null;
    if (el && UML_TYPE[el.elementType] && el.elementType !== "package") return `<type xmi:idref="${xmiId(el)}"/>`;
    return label ? `<type xmi:idref="EAJava_${esc(String(label).replace(/[^A-Za-z0-9_]/g, "_"))}"/>` : "";
  };

  // ── uml:Model ──────────────────────────────────────────────────────────
  const lijnenVan = (el) => alle.filter((c) => isConnector(c) && c.source === el.id);
  const umlElement = (el, diepte) => {
    const t = UML_TYPE[el.elementType];
    const inspr = "\t".repeat(diepte);
    if (el.elementType === "notitie") {
      // Notitie: uml:Comment; de notitielijn is het annotatedElement.
      const doelen = lijnenVan(el).filter((c) => c.elementType === "notitielijn" && elements[c.target]);
      return `${inspr}<ownedComment xmi:type="uml:Comment" xmi:id="${eaId(el)}" body="${esc(el.data?.tekst || el.naam || "")}">${doelen.map((c) => `<annotatedElement xmi:idref="${xmiId(elements[c.target])}"/>`).join("")}</ownedComment>\n`;
    }
    if (!t) {
      sla(el.elementType);
      return "";
    }
    verslag.elementen += 1;
    if (el.elementType === "package") {
      const kinderen = (kinderenVan.get(el.id) || []).map((k) => umlElement(k, diepte + 1)).join("");
      return `${inspr}<packagedElement xmi:type="uml:Package" xmi:id="${pkId(el)}" name="${esc(el.naam)}" visibility="public">\n${kinderen}${inspr}</packagedElement>\n`;
    }
    const delen = [];
    for (const comp of el.compartimenten || []) {
      for (const veld of comp.velden || []) {
        const vid = `EAID_${guidStaart(guidVan(veld, `${el.id}#${comp.compartmentType}#${veld.naam}`))}`;
        if (comp.compartmentType === "literals" || veld.fieldType === "literal") {
          delen.push(`${inspr}\t<ownedLiteral xmi:type="uml:EnumerationLiteral" xmi:id="${vid}" name="${esc(veld.naam)}" visibility="public"/>`);
        } else if (comp.compartmentType === "operaties" || veld.fieldType === "operatie") {
          delen.push(`${inspr}\t<ownedOperation xmi:type="uml:Operation" xmi:id="${vid}" name="${esc(String(veld.naam || "").replace(/\(.*\)\s*$/, ""))}" visibility="public"/>`);
        } else {
          const g = grenzen(veld.data?.kardinaliteit);
          const lu = g ? `<lowerValue xmi:type="uml:LiteralInteger" xmi:id="${vid}_lo" value="${g[0]}"/><upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${vid}_hi" value="${g[1]}"/>` : "";
          delen.push(
            `${inspr}\t<ownedAttribute xmi:type="uml:Property" xmi:id="${vid}" name="${esc(veld.naam)}" visibility="${veld.data?.zichtbaarheid === "Private" ? "private" : "public"}" isDerived="${veld.data?.afgeleid ? "true" : "false"}">${typeRef(veld.data?.typeLabel)}${lu}</ownedAttribute>`
          );
        }
      }
    }
    for (const c of lijnenVan(el)) {
      if (c.elementType === "generalisatie" && elements[c.target]) {
        delen.push(`${inspr}\t<generalization xmi:type="uml:Generalization" xmi:id="${eaId(c)}" general="${xmiId(elements[c.target])}"/>`);
      }
    }
    const kop = `${inspr}<packagedElement xmi:type="${t}" xmi:id="${eaId(el)}" name="${esc(el.naam)}" visibility="public"${el.data?.abstract || el.data?.indicatieAbstract ? ' isAbstract="true"' : ""}`;
    return delen.length ? `${kop}>\n${delen.join("\n")}\n${inspr}</packagedElement>\n` : `${kop}/>\n`;
  };
  const umlConnector = (c, diepte) => {
    const inspr = "\t".repeat(diepte);
    if (c.elementType === "notitielijn" || c.elementType === "bevat") return ""; // lidmaatschap/notitielijn: alleen structuur/extension
    const bron = elements[c.source], doel = elements[c.target];
    if (!bron || !doel || !UML_TYPE[bron.elementType] || !UML_TYPE[doel.elementType]) return "";
    const id = eaId(c);
    const staart = guidStaart(guidVan(c)).slice(2);
    if (ASSOCIATIE_TYPEN.has(c.elementType)) {
      verslag.connectoren += 1;
      const einde = (prefix, typeEl, kard, rol, aggregatie) => {
        const eid = `EAID_${prefix}${staart}`;
        const g = grenzen(kard);
        const lu = g ? `<lowerValue xmi:type="uml:LiteralInteger" xmi:id="${eid}_lo" value="${g[0]}"/><upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${eid}_hi" value="${g[1]}"/>` : "";
        return `${inspr}\t<memberEnd xmi:idref="${eid}"/>\n${inspr}\t<ownedEnd xmi:type="uml:Property" xmi:id="${eid}"${rol ? ` name="${esc(rol)}"` : ""} visibility="public" association="${id}" aggregation="${aggregatie}"><type xmi:idref="${xmiId(typeEl)}"/>${lu}</ownedEnd>`;
      };
      const agg = GEHEEL_AAN_BRON[c.elementType] || "none";
      // Bron = het geheel (ruit aan de bron): dat uiteinde draagt de aggregatie.
      const d = c.data || {};
      return (
        `${inspr}<packagedElement xmi:type="uml:Association" xmi:id="${id}" name="${esc(c.naam)}" visibility="public">\n` +
        `${einde("dst", doel, d.doelKardinaliteit ?? d.kardinaliteit, d.doelRolNaam, "none")}\n` +
        `${einde("src", bron, d.bronKardinaliteit, d.bronRolNaam, agg)}\n${inspr}</packagedElement>\n`
      );
    }
    if (c.elementType === "dependency" || c.elementType === "realisatie" || c.elementType === "realiseert") {
      verslag.connectoren += 1;
      const t = c.elementType === "dependency" ? "uml:Dependency" : "uml:Realization";
      return `${inspr}<packagedElement xmi:type="${t}" xmi:id="${id}"${c.naam ? ` name="${esc(c.naam)}"` : ""} supplier="${xmiId(doel)}" client="${xmiId(bron)}"/>\n`;
    }
    if (c.elementType === "generalisatie") {
      verslag.connectoren += 1; // zit in het element (generalization)
      return "";
    }
    sla(`connector ${c.elementType}`);
    return "";
  };
  const wortelKinderen = kinderenVan.get("__wortel__") || [];
  // Connectoren horen in het uml:Model onder het pakket van hun bron.
  const perPakket = new Map();
  for (const c of alle.filter(isConnector)) {
    const bron = elements[c.source];
    const ouder = bron ? ouderVan.get(bron.id) : null;
    const sleutel = ouder && elements[ouder]?.elementType === "package" ? ouder : "__wortel__";
    if (!perPakket.has(sleutel)) perPakket.set(sleutel, []);
    perPakket.get(sleutel).push(c);
  }
  const umlPakket = (el, diepte) => {
    const inspr = "\t".repeat(diepte);
    const kinderen = (kinderenVan.get(el.id) || []).map((k) => (k.elementType === "package" ? umlPakket(k, diepte + 1) : umlElement(k, diepte + 1))).join("");
    const conns = (perPakket.get(el.id) || []).map((c) => umlConnector(c, diepte + 1)).join("");
    verslag.elementen += 1;
    return `${inspr}<packagedElement xmi:type="uml:Package" xmi:id="${pkId(el)}" name="${esc(el.naam)}" visibility="public">\n${kinderen}${conns}${inspr}</packagedElement>\n`;
  };
  const wortelInhoud =
    wortelKinderen.map((k) => (k.elementType === "package" ? umlPakket(k, 3) : umlElement(k, 3))).join("") +
    (perPakket.get("__wortel__") || []).map((c) => umlConnector(c, 3)).join("");

  // ── xmi:Extension ──────────────────────────────────────────────────────
  const tags = (el, eig) => {
    const uit = [];
    for (const [k, v] of Object.entries(el.data?.tags || {})) {
      uit.push(`\t\t\t\t\t<tag xmi:id="EAID_${guidStaart(guidVan({ id: `${el.id}#tag#${k}`, data: {} }, `${el.id}#tag#${k}`))}" name="${esc(k)}" value="${esc(typeof v === "object" ? JSON.stringify(v) : v)}" modelElement="${eig}"/>`);
    }
    return uit.length ? `\t\t\t\t<tags>\n${uit.join("\n")}\n\t\t\t\t</tags>\n` : "\t\t\t\t<tags/>\n";
  };
  const extElementen = alle
    .filter((el) => !isConnector(el) && el.elementType !== "bevat" && (UML_TYPE[el.elementType] || el.elementType === "notitie"))
    .map((el) => {
      const id = xmiId(el);
      const t = el.elementType === "notitie" ? "uml:Note" : UML_TYPE[el.elementType];
      const ouder = ouderVan.get(el.id);
      const pkg = ouder && elements[ouder]?.elementType === "package" ? pkId(elements[ouder]) : wortelId;
      const stereotype = el.data?.stereotypen?.[0] || MIM_STEREOTYPE[el.elementType] || "";
      const doc = el.elementType === "notitie" ? el.data?.tekst || "" : el.data?.notes || el.data?.definitie || "";
      const sType = t.replace("uml:", "");
      return (
        `\t\t\t<element xmi:idref="${id}" xmi:type="${t}"${el.naam ? ` name="${esc(el.naam)}"` : ""} scope="public">\n` +
        `\t\t\t\t<model package="${pkg}" ea_eleType="${el.elementType === "package" ? "package" : "element"}"/>\n` +
        `\t\t\t\t<properties${doc ? ` documentation="${esc(doc)}"` : ""} isSpecification="false" sType="${sType}" nType="0" scope="public"${stereotype ? ` stereotype="${esc(stereotype)}"` : ""} isAbstract="${el.data?.abstract || el.data?.indicatieAbstract ? "true" : "false"}"/>\n` +
        (el.data?.kleur ? `\t\t\t\t<style appearance="BackColor=${kleurNaarBgr(el.data.kleur)};"/>\n` : "") +
        tags(el, id) +
        `\t\t\t</element>\n`
      );
    })
    .join("");
  const EA_TYPE = {
    associatie: "Association", aggregatie: "Aggregation", compositie: "Aggregation", relatiesoort: "Association", gegevensgroep: "Aggregation",
    externeKoppeling: "Association", generalisatie: "Generalization", dependency: "Dependency", realisatie: "Realisation", realiseert: "Realisation",
  };
  /** Staat dit element in het uml:Model (en dus met een xmi:id)? */
  const geexporteerd = (el) => !!el && !isConnector(el) && (!!UML_TYPE[el.elementType] || el.elementType === "notitie");
  const connectorGeexporteerd = (c) => !!EA_TYPE[c.elementType] && UML_TYPE[elements[c.source]?.elementType] && UML_TYPE[elements[c.target]?.elementType];
  const extConnectoren = alle
    .filter((c) => isConnector(c) && connectorGeexporteerd(c))
    .map((c) => {
      const d = c.data || {};
      const bron = elements[c.source], doel = elements[c.target];
      const agg = GEHEEL_AAN_BRON[c.elementType] ? (c.elementType === "aggregatie" ? "shared" : "composite") : "none";
      const kant = (el, rol, kard, aggregatie) =>
        `\t\t\t\t\t<model type="${(UML_TYPE[el.elementType] || "uml:Note").replace("uml:", "")}" name="${esc(el.naam)}"/>\n\t\t\t\t\t<role${rol ? ` name="${esc(rol)}"` : ""} visibility="Public" targetScope="instance"/>\n\t\t\t\t\t<type${kard ? ` multiplicity="${esc(kard)}"` : ""} aggregation="${aggregatie}" containment="Unspecified"/>\n`;
      const stereotype = d.stereotypen?.[0] || (c.elementType === "externeKoppeling" ? "Externe koppeling" : c.elementType === "gegevensgroep" ? "Gegevensgroep" : "");
      return (
        `\t\t\t<connector xmi:idref="${eaId(c)}"${c.naam ? ` name="${esc(c.naam)}"` : ""}>\n` +
        `\t\t\t\t<source xmi:idref="${xmiId(bron)}">\n${kant(bron, d.bronRolNaam, d.bronKardinaliteit, agg)}\t\t\t\t</source>\n` +
        `\t\t\t\t<target xmi:idref="${xmiId(doel)}">\n${kant(doel, d.doelRolNaam, d.doelKardinaliteit ?? d.kardinaliteit, "none")}\t\t\t\t</target>\n` +
        `\t\t\t\t<properties ea_type="${EA_TYPE[c.elementType]}" direction="${d.unidirectioneel ? "Source -&gt; Destination" : "Unspecified"}"${stereotype ? ` stereotype="${esc(stereotype)}"` : ""}/>\n` +
        `\t\t\t\t<labels${d.bronKardinaliteit ? ` lb="${esc(d.bronKardinaliteit)}"` : ""}${c.naam ? ` mt="${esc(c.naam)}"` : ""}${d.doelKardinaliteit ?? d.kardinaliteit ? ` rb="${esc(d.doelKardinaliteit ?? d.kardinaliteit)}"` : ""}/>\n` +
        tags(c, eaId(c)) +
        `\t\t\t</connector>\n`
      );
    })
    .join("");
  const extDiagrammen = Object.values(diagrams)
    .map((d) => {
      verslag.diagrammen += 1;
      const did = `EAID_${guidStaart(guidVan(d, d.id))}`;
      const nodes = (d.nodes || []).filter((n) => geexporteerd(elements[n.elementId]));
      const eersteOuder = nodes.map((n) => ouderVan.get(n.elementId)).find((o) => o && elements[o]?.elementType === "package");
      const pkg = eersteOuder ? pkId(elements[eersteOuder]) : wortelId;
      const nodeRegels = nodes.map((n, i) => {
        const el = elements[n.elementId];
        const w = n.size?.width ?? 160, h = n.size?.height ?? 80;
        const L = Math.round(n.position.x / schaal), T = Math.round(n.position.y / schaal);
        return `\t\t\t\t\t<element geometry="Left=${L};Top=${T};Right=${L + Math.round(w / schaal)};Bottom=${T + Math.round(h / schaal)};" subject="${xmiId(el)}" seqno="${nodes.length - i}"${el.data?.kleur ? ` style="BCol=${kleurNaarBgr(el.data.kleur)};"` : ""}/>`;
      });
      const opDiagram = new Set(nodes.map((n) => n.elementId));
      const verborgen = new Set(d.verborgenConnectoren || []);
      const lijnRegels = alle
        .filter((c) => isConnector(c) && connectorGeexporteerd(c) && opDiagram.has(c.source) && opDiagram.has(c.target))
        .map((c) => {
          const lijn = { ...(c.data || {}), ...(d.lijnen?.[c.id] || {}) };
          const pad = (lijn.knikken || []).map((k) => `${Math.round(k.x / schaal)}:${-Math.round(k.y / schaal)}`).join("$");
          const stijl = STIJL_VOOR_VORM[lijn.vorm] || "Mode=3;";
          return `\t\t\t\t\t<element geometry="SX=0;SY=0;EX=0;EY=0;EDGE=1;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=${pad ? pad + "$" : ""};" subject="${eaId(c)}" style="${stijl}Color=-1;LWidth=0;Hidden=${verborgen.has(c.id) ? 1 : 0};"/>`;
        });
      return (
        `\t\t\t<diagram xmi:id="${did}">\n\t\t\t\t<model package="${pkg}" owner="${pkg}"/>\n\t\t\t\t<properties name="${esc(d.naam)}" type="Logical"/>\n` +
        (d.verbergCompartimenten ? `\t\t\t\t<style1 value="HideAtts=1;HideOps=1;"/>\n` : "") +
        `\t\t\t\t<elements>\n${[...nodeRegels, ...lijnRegels].join("\n")}\n\t\t\t\t</elements>\n\t\t\t</diagram>\n`
      );
    })
    .join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">\n` +
    `\t<xmi:Documentation exporter="${esc(exporter)}" exporterVersion="6.5"/>\n` +
    `\t<uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">\n` +
    `\t\t<packagedElement xmi:type="uml:Package" xmi:id="${wortelId}" name="${esc(naam)}" visibility="public">\n` +
    wortelInhoud +
    `\t\t</packagedElement>\n\t</uml:Model>\n` +
    `\t<xmi:Extension extender="Enterprise Architect" extenderID="6.5">\n` +
    `\t\t<elements>\n` +
    `\t\t\t<element xmi:idref="${wortelId}" xmi:type="uml:Package" name="${esc(naam)}" scope="public">\n\t\t\t\t<model ea_eleType="package"/>\n\t\t\t\t<properties isSpecification="false" sType="Package" nType="0" scope="public"/>\n\t\t\t</element>\n` +
    extElementen +
    `\t\t</elements>\n\t\t<connectors>\n${extConnectoren}\t\t</connectors>\n\t\t<primitivetypes/>\n\t\t<diagrams>\n${extDiagrammen}\t\t</diagrams>\n` +
    `\t</xmi:Extension>\n</xmi:XMI>\n`;
  return { xml, nieuweGuids, verslag };
}

/** `#rrggbb` → EA BGR-getal. */
export function kleurNaarBgr(hex) {
  const m = String(hex || "").match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return -1;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return (b << 16) | (g << 8) | r;
}
