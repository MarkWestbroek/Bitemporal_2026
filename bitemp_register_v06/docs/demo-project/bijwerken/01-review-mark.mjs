// 01 — de review van Mark (16-11) verwerkt, op de stand van de server:
//   - submappen: per proces, per koppelvlak en per taal een map met het diagram en zijn elementen;
//   - maat naar inhoud (de vaste 160 × 70 van de bouw weg) en daarna opnieuw geplaatst;
//   - ERD: kardinaliteiten als kraaienpoten (een, nul-of-meer, …);
//   - SHACL: de regels met hun parameters; de pijlen volgen uit sh:class (afleiding.js);
//   - DMN: de regels van de beslistabel leesbaar naast de beslissing (de motor heeft nog geen
//     tabelweergave op een DRD-beslissing);
//   - het voorbeeldfestival heet Rietpop (Dijkpop bestaat echt).
// Idempotent: een tweede keer draaien levert niets nieuws op.
import { leidAf } from "../../../web/vite/src/diagramprofielen/shacl/afleiding.js";

const STD = { width: 160, height: 70 };

/** Submappen: [hoofdmap, [[naam van de submap, profiel, diagramnaam], …]] */
const SUBMAPPEN = [
  ["2 Proces", [
    ["Evenementaanvraag behandelen", "bpmnMotor05", "Evenementaanvraag behandelen"],
    ["Veiligheidsadviezen inwinnen", "bpmnMotor05", "Veiligheidsadviezen inwinnen"],
    ["Evenement op de kalender zetten", "bpmnMotor05", "Evenement op de kalender zetten"],
    ["Levensloop (state machine)", "statemachine05", "Levensloop van een evenementaanvraag"],
  ]],
  ["4 Gegevens", [
    ["Canoniek model", "diagram05", "Evenementen (canoniek)"],
    ["Aanvraagformulier", "formulierdiagram", "Aanvraagformulier evenement"],
  ]],
  ["5 Koppelvlakken", [
    ["REST (OAS 3.1)", "oas05", "Evenementen-API (OAS 3.1)"],
    ["GraphQL", "graphql05", "Evenementen (GraphQL)"],
    ["Aanvraag indienen (sequence)", "sequence05", "Aanvraag indienen via de API"],
  ]],
  ["8 Meer talen", [
    ["Activity", "activity05", null],
    ["Requirements", "requirements05", null],
    ["Object", "object05", null],
    ["UML-klassen", "puurUml05", null],
    ["Composite structure", "compositeStructure05", null],
    ["Communication", "communication05", null],
    ["Component en deployment", "componentDeployment05", null],
    ["SysML", "sysml05", null],
    ["Bedrijfsproces (Eriksson-Penker)", "business05", null],
    ["CMMN", "cmmn05", null],
    ["MIM", "mim05", null],
    ["ERD", "erd05", null],
    ["SHACL", "shacl05", null],
    ["XML Schema", "xsd05", null],
    ["WSDL", "wsdl05", null],
  ]],
];

/** Profielen waar de vaste maat weg moet (elementen met velden; requirements ook zonder). */
const MAAT_WEG = ["diagram05", "erd05", "mim05", "xsd05", "wsdl05", "shacl05", "puurUml05", "requirements05", "formulierdiagram"];

/** Plaats (en voor containers de maat) per profiel: elementnaam[|type] → [x, y, w?, h?]. */
const PLAATS = {
  graphql05: {
    Evenementen: [40, 200], Query: [280, 70], Mutation: [280, 330], AanvraagInvoer: [280, 480], Date: [40, 480],
    Evenementaanvraag: [660, 140], Organisator: [980, 20], Evenementlocatie: [980, 160], Evenementenvergunning: [980, 290],
    AanvraagStatus: [980, 440], Risicoklasse: [980, 620],
  },
  diagram05: {
    Adviesgegevens: [40, 40], Veiligheidsadvies: [320, 60], AdviesOordeel: [40, 220],
    Evenementenvergunning: [1000, 60], Besluit: [1250, 40], Voorschrift: [1490, 40],
    Organisator: [110, 380], Evenementaanvraag: [730, 380], Evenementlocatie: [1330, 380],
    Organisatiegegevens: [0, 560], Contactgegevens: [220, 560], Aanvraaggegevens: [450, 560], Evenementgegevens: [700, 560], Beoordeling: [980, 560],
    Adres: [1220, 560], Terrein: [1440, 560],
    AanvraagStatus: [450, 740], EvenementSoort: [700, 860], Risicoklasse: [980, 740],
  },
  erd05: { aanvraag_locatie: [40, 40], evenementlocatie: [40, 280], evenementenvergunning: [400, 40], evenementaanvraag: [400, 280], organisator: [760, 280] },
  mim05: {
    "Evenementen|package": [20, 20, 760, 600], "Evenementaanvraag": [300, 70], Organisator: [60, 320], Evenementlocatie: [540, 320],
    Adres: [540, 480], Risicoklasse: [300, 460],
  },
  xsd05: { "advies|schema": [20, 20, 680, 560], "advies|element": [60, 70], adviesverzoek: [370, 70], AdviesType: [60, 220], AdviesverzoekType: [370, 220], OordeelType: [60, 410] },
  wsdl05: {
    "AdviesService|namespace": [20, 20, 900, 520], "AdviesService|service": [60, 70], AdviesSoapBinding: [60, 240], AdviesPortType: [380, 70],
    AdviesverzoekBericht: [330, 250], AdviesBericht: [620, 250], "advies.xsd": [480, 400],
  },
  puurUml05: { Beslisservice: [40, 40], Beslisregel: [400, 40], Uitkomst: [720, 40], LegesRegel: [40, 240], RisicoklasseRegel: [400, 240], Risicoklasse: [400, 420] },
  requirements05: {
    Evenementenloket: [460, 40], "Digitaal aanvragen": [20, 260], "Status volgen": [330, 260], "Beslistermijn acht weken": [640, 260], "Uitlegbare risicoklasse": [950, 260],
    "Vraag evenementenvergunning aan": [60, 480], Risicoklasse: [1010, 480],
  },
  shacl05: { "Evenementen-shapes": [40, 40], EvenementaanvraagShape: [40, 180], OrganisatorShape: [660, 180], "ev:Evenementlocatie": [660, 440] },
  formulierdiagram: {
    "Aanvraag evenementenvergunning": [380, 40], "Het evenement": [40, 240], Bijzonderheden: [380, 240], Locaties: [720, 240], Wanneer: [40, 460], "Bij een wegafsluiting": [380, 460],
  },
  dmnDrd05: { Leges: [520, 40], Risicoklasse: [300, 220], Evenementaanvraag: [520, 420], "Legesverordening 2026": [780, 20], "APV Waterstede, art. 2:25": [40, 110], "Risicoscan evenementen": [40, 300] },
};

const ERD_KARD = { "0..*": "nul-of-meer", "1..*": "een-of-meer", "0..1": "nul-of-een", 1: "een" };

const SHACL_REGELS = {
  EvenementaanvraagShape: [
    ["ev:naam", { datatype: "xsd:string", minCount: 1, maxCount: 1 }],
    ["ev:datumVan", { datatype: "xsd:date", minCount: 1, maxCount: 1 }],
    ["ev:verwachtAantalBezoekers", { datatype: "xsd:integer", minCount: 1, maxCount: 1, minInclusive: "1" }],
    ["ev:ingediendDoor", { klasse: "ev:Organisator", minCount: 1, maxCount: 1 }],
    ["ev:vindtPlaatsOp", { klasse: "ev:Evenementlocatie", minCount: 1 }],
  ],
  OrganisatorShape: [
    ["ev:naam", { datatype: "xsd:string", minCount: 1, maxCount: 1 }],
    ["ev:email", { datatype: "xsd:string", minCount: 1, pattern: "^.+@.+$" }],
  ],
};

const DMN_NOTITIES = [
  ["Risicoklasse", "demo_regels_risicoklasse", [40, 480],
    "Beslistabel (eerste regel die past):\n1. bezoekers >= 5000 → C\n2. bezoekers >= 2000 en alcohol → C\n3. wegafsluiting → B\n4. bezoekers >= 250 → B\n5. alcohol → B\n6. anders → A (melding)"],
  ["Leges", "demo_regels_leges", [800, 180],
    "Beslistabel (precies één regel past):\nA → 0\nB, niet commercieel → 75\nB, commercieel → 150\nC, niet commercieel → 350\nC, commercieel → 900"],
];

const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export default (proj) => {
  const ops = [];
  const P = proj.profielen;
  const zetEl = {}; // profiel → id → element
  const wisEl = {};
  const zetDia = {}; // profiel → id → diagram
  const el = (pid, id) => (zetEl[pid] ||= {})[id] || P[pid].elements[id];
  const dia = (pid, id) => (zetDia[pid] ||= {})[id] || P[pid].diagrams[id];
  const vind = (pid, sleutel) => {
    const [naam, type] = sleutel.split("|");
    const raak = Object.values(P[pid].elements).filter((e) => !e.source && e.naam === naam && (!type || e.elementType === type));
    if (raak.length !== 1) throw new Error(`${pid}: "${sleutel}" ${raak.length ? "is niet uniek" : "bestaat niet"}`);
    return raak[0];
  };

  // ── Het voorbeeldfestival ──
  {
    const pid = "object05";
    const her = (t) => String(t).replace(/Dijkpop/g, "Rietpop").replace(/dijkpop/g, "rietpop");
    for (const e of Object.values(P[pid].elements)) {
      const nieuw = { ...e, naam: her(e.naam), compartimenten: (e.compartimenten || []).map((c) => ({ ...c, velden: c.velden.map((v) => ({ ...v, naam: her(v.naam) })) })) };
      if (JSON.stringify(nieuw) !== JSON.stringify(e)) (zetEl[pid] ||= {})[e.id] = nieuw;
    }
    for (const d of Object.values(P[pid].diagrams)) if (her(d.naam) !== d.naam) (zetDia[pid] ||= {})[d.id] = { ...d, naam: her(d.naam) };
  }

  // ── ERD: kraaienpoten ──
  for (const e of Object.values(P.erd05.elements)) {
    if (e.elementType !== "relatie") continue;
    const data = { ...e.data };
    for (const k of ["bronKardinaliteit", "doelKardinaliteit"]) if (ERD_KARD[data[k]]) data[k] = ERD_KARD[data[k]];
    if (JSON.stringify(data) !== JSON.stringify(e.data)) (zetEl.erd05 ||= {})[e.id] = { ...e, data };
  }

  // ── SHACL: regels met parameters, pijlen afgeleid ──
  {
    const pid = "shacl05";
    const alle = { ...P[pid].elements };
    for (const e of Object.values(alle)) if (e.elementType === "verwijzing" && e.id.startsWith("mcp_")) delete alle[e.id];
    for (const [naam, regels] of Object.entries(SHACL_REGELS)) {
      const e = vind(pid, naam);
      alle[e.id] = { ...e, compartimenten: [{ compartmentType: "eigenschappen", velden: regels.map(([pad, data]) => ({ naam: pad, fieldType: "eigenschap", data })) }] };
    }
    const afgeleid = leidAf(alle) || alle;
    for (const [id, e] of Object.entries(afgeleid)) if (JSON.stringify(e) !== JSON.stringify(P[pid].elements[id])) (zetEl[pid] ||= {})[id] = e;
    for (const id of Object.keys(P[pid].elements)) if (!afgeleid[id]) (wisEl[pid] ||= []).push(id);
  }

  // ── DMN: de regels naast de beslissing ──
  const nieuwInBoom = [];
  {
    const pid = "dmnDrd05";
    const d0 = Object.values(P[pid].diagrams)[0];
    let nodes = dia(pid, d0.id).nodes;
    for (const [beslissing, id, [x, y], tekst] of DMN_NOTITIES) {
      if (P[pid].elements[id]) continue;
      (zetEl[pid] ||= {})[id] = { id, naam: `Regels ${beslissing}`, elementType: "constraint", compartimenten: [], data: { specificatie: tekst } };
      zetEl[pid][`${id}_lijn`] = { id: `${id}_lijn`, naam: "", elementType: "notitielijn", source: id, target: vind(pid, `${beslissing}|decision`).id, compartimenten: [], data: {} };
      nodes = [...nodes, { elementId: id, position: { x, y } }];
      nieuwInBoom.push(`el::${pid}::${id}`);
    }
    if (nodes !== dia(pid, d0.id).nodes) (zetDia[pid] ||= {})[d0.id] = { ...dia(pid, d0.id), nodes };
  }

  // ── Maat naar inhoud en opnieuw plaatsen ──
  for (const pid of new Set([...MAAT_WEG, ...Object.keys(PLAATS)])) {
    for (const d0 of Object.values(P[pid].diagrams)) {
      const d = dia(pid, d0.id);
      const plek = new Map(Object.entries(PLAATS[pid] || {}).map(([s, xy]) => [vind(pid, s).id, xy]));
      const nodes = d.nodes.map((n) => {
        let k = n;
        const e = P[pid].elements[n.elementId];
        const heeftVelden = (e?.compartimenten || []).some((c) => c.velden?.length) || pid === "requirements05";
        if (MAAT_WEG.includes(pid) && heeftVelden && k.size?.width === STD.width && k.size?.height === STD.height) {
          const { size, ...rest } = k;
          k = rest;
        }
        const xy = plek.get(n.elementId);
        if (xy) k = { ...k, position: { x: xy[0], y: xy[1] }, ...(xy[2] ? { size: { width: xy[2], height: xy[3] } } : {}) };
        return k;
      });
      if (JSON.stringify(nodes) !== JSON.stringify(d.nodes)) (zetDia[pid] ||= {})[d0.id] = { ...d, nodes };
    }
  }

  // ── Submappen ──
  const mapOpNaam = (naam, ouderId = null) => Object.values(proj.mappen).find((m) => m.naam === naam && (m.ouderId || null) === ouderId);
  const perMap = {};
  for (const [hoofd, subs] of SUBMAPPEN) {
    const ouder = mapOpNaam(hoofd);
    if (!ouder) throw new Error(`map "${hoofd}" bestaat niet`);
    for (const [naam, pid, diagramNaam] of subs) {
      const d = diagramNaam ? Object.values(P[pid].diagrams).find((x) => x.naam === diagramNaam) : Object.values(P[pid].diagrams)[0];
      if (!d) throw new Error(`${pid}: diagram "${diagramNaam}" bestaat niet`);
      let map = mapOpNaam(naam, ouder.id);
      if (!map) {
        map = { id: `map_demo_${slug(hoofd)}_${slug(naam)}` };
        ops.push({ store: "structuur", op: "nieuweMap", args: [naam, ouder.id, map.id] });
      }
      const keys = [`${pid}::${d.id}`, ...dia(pid, d.id).nodes.map((n) => `el::${pid}::${n.elementId}`)].filter((k) => proj.plaatsing[k] !== map.id);
      if (keys.length) perMap[map.id] = keys;
    }
  }
  const besluiten = mapOpNaam("3 Besluiten");
  if (nieuwInBoom.length && besluiten) perMap[besluiten.id] = nieuwInBoom;

  for (const pid of new Set([...Object.keys(zetDia), ...Object.keys(zetEl), ...Object.keys(wisEl)])) {
    if (zetDia[pid] && Object.keys(zetDia[pid]).length) ops.push({ store: `model:${pid}`, op: "patchDiagrammen", args: [{ zet: zetDia[pid], wis: [] }] });
    if ((zetEl[pid] && Object.keys(zetEl[pid]).length) || wisEl[pid]?.length) ops.push({ store: `model:${pid}`, op: "patchElementen", args: [{ zet: zetEl[pid] || {}, wis: wisEl[pid] || [] }] });
  }
  if (Object.keys(perMap).length) ops.push({ store: "structuur", op: "plaatsPerMap", args: [perMap] });
  return ops;
};
