/**
 * studioProfielen — alle M2-profielen voor taal=studio, op de id's die projectbestanden
 * gebruiken (`diagramTypeId`, zie studio/activities/*Activity.jsx).
 *
 * Wordt met esbuild gebundeld (bouw.mjs): de profielen importeren JSX, dat Node niet
 * kan lezen. De .jsx-modules zijn in die bundel leeg; de tekenaar heeft React niet nodig.
 *
 * De tekenaar gaat mee in deze bundel: de ShapeTypes staan in een register in modulestaat,
 * dus profielen en tekenaar moeten dezelfde kopie delen.
 */
export { tekenDiagram, naarSvg } from "../web/vite/src/diagramcore/tekenaar/index.js";
import { rondreisStand } from "../web/vite/src/studio/activities/profielRondreis.js";
import { getDiagramType } from "../web/vite/src/diagramcore/types/typeRegistry.js";
import { versieVan, profielVingerafdruk } from "../web/vite/src/diagramcore/types/profielVersie.js";
import { registreerActivity, ACTIVITY_ID } from "../web/vite/src/diagramprofielen/activity/index.js";
import { registreerArchimate, ARCHIMATE_ID } from "../web/vite/src/diagramprofielen/archimate/index.js";
import { registreerBpmnMotor, BPMN_ID } from "../web/vite/src/diagramprofielen/bpmn/index.js";
import { registreerBusiness, businessDiagramType } from "../web/vite/src/diagramprofielen/business/index.js";
import { registreerCanoniekUml, CANONIEK_UML_ID } from "../web/vite/src/diagramprofielen/canoniek-uml/index.js";
import { registreerCmmn, CMMN_ID } from "../web/vite/src/diagramprofielen/cmmn/index.js";
import { registreerCommunication, communicationDiagramType } from "../web/vite/src/diagramprofielen/communication/index.js";
import { registreerComponentDeployment, componentDeploymentDiagramType } from "../web/vite/src/diagramprofielen/component-deployment/index.js";
import { registreerCompositeStructure, compositeStructureDiagramType } from "../web/vite/src/diagramprofielen/composite-structure/index.js";
import { registreerDmnDrd, DMN_DRD_ID } from "../web/vite/src/diagramprofielen/dmn-drd/index.js";
import { registreerErd, ERD_ID } from "../web/vite/src/diagramprofielen/erd/index.js";
import { registreerFormulierProfiel, FORMULIER_ID } from "../web/vite/src/diagramprofielen/formulier/index.js";
import { registreerGraphql, GRAPHQL_ID } from "../web/vite/src/diagramprofielen/graphql/index.js";
import { registreerMim12, MIM12_ID } from "../web/vite/src/diagramprofielen/mim12/index.js";
import { registreerOas31, OAS31_ID } from "../web/vite/src/diagramprofielen/oas31/index.js";
import { registreerObject, objectDiagramType } from "../web/vite/src/diagramprofielen/object/index.js";
import { registreerPuurUml, PUUR_UML_ID } from "../web/vite/src/diagramprofielen/puur-uml/index.js";
import { registreerRequirements, requirementsDiagramType } from "../web/vite/src/diagramprofielen/requirements/index.js";
import { registreerSimulatie, SIMULATIE_ID } from "../web/vite/src/diagramprofielen/simulatie/index.js";
import { registreerShacl, SHACL_ID } from "../web/vite/src/diagramprofielen/shacl/index.js";
import { registreerSequence, SEQUENCE_ID } from "../web/vite/src/diagramprofielen/sequence/index.js";
import { registreerStateMachine, STATEMACHINE_ID } from "../web/vite/src/diagramprofielen/statemachine/index.js";
import { registreerSysml, SYSML_ID } from "../web/vite/src/diagramprofielen/sysml/index.js";
import { registreerToegangsregelProfiel, TOEGANGSREGEL_ID } from "../web/vite/src/diagramprofielen/toegangsregel/index.js";
import { registreerTransformatieProfiel, TRANSFORMATIE_PROFIEL_ID } from "../web/vite/src/diagramprofielen/transformatie/index.js";
import { registreerUseCase, USECASE_ID } from "../web/vite/src/diagramprofielen/usecase/index.js";
import { registreerWsdl, wsdlDiagramType } from "../web/vite/src/diagramprofielen/wsdl/index.js";
import { registreerXsd, xsdDiagramType } from "../web/vite/src/diagramprofielen/xsd/index.js";

// [profiel-id in het project, registratie, type-id in het typeregister]
const PROFIELEN = [
  ["activity05", registreerActivity, ACTIVITY_ID],
  ["archimate05", registreerArchimate, ARCHIMATE_ID],
  ["bpmnMotor05", registreerBpmnMotor, BPMN_ID],
  ["business05", registreerBusiness, businessDiagramType.id],
  ["cmmn05", registreerCmmn, CMMN_ID],
  ["communication05", registreerCommunication, communicationDiagramType.id],
  ["componentDeployment05", registreerComponentDeployment, componentDeploymentDiagramType.id],
  ["compositeStructure05", registreerCompositeStructure, compositeStructureDiagramType.id],
  ["diagram05", registreerCanoniekUml, CANONIEK_UML_ID],
  ["dmnDrd05", registreerDmnDrd, DMN_DRD_ID],
  ["erd05", registreerErd, ERD_ID],
  ["formulierdiagram", registreerFormulierProfiel, FORMULIER_ID],
  ["graphql05", registreerGraphql, GRAPHQL_ID],
  ["mim05", registreerMim12, MIM12_ID],
  ["oas05", registreerOas31, OAS31_ID],
  ["object05", registreerObject, objectDiagramType.id],
  ["puurUml05", registreerPuurUml, PUUR_UML_ID],
  ["requirements05", registreerRequirements, requirementsDiagramType.id],
  ["sequence05", registreerSequence, SEQUENCE_ID],
  ["shacl05", registreerShacl, SHACL_ID],
  ["simulatiemodel05", registreerSimulatie, SIMULATIE_ID],
  ["statemachine05", registreerStateMachine, STATEMACHINE_ID],
  ["sysml05", registreerSysml, SYSML_ID],
  ["toegangsregels", registreerToegangsregelProfiel, TOEGANGSREGEL_ID],
  ["transformatie05", registreerTransformatieProfiel, TRANSFORMATIE_PROFIEL_ID],
  ["usecase05", registreerUseCase, USECASE_ID],
  ["wsdl05", registreerWsdl, wsdlDiagramType.id],
  ["xsd05", registreerXsd, xsdDiagramType.id],
];

const typeIds = new Map();
for (const [profielId, registreer, typeId] of PROFIELEN) {
  registreer();
  typeIds.set(profielId, typeId);
}

export const profielIds = [...typeIds.keys()];

/**
 * Per profiel-id de versie en de vingerafdruk van de structuur (types/profielVersie.js). De
 * test profielVersies.test.mjs legt dit naast profielVersies.vast.json: een structuurwijziging
 * zonder versieverhoging laat hem falen.
 * @returns {Record<string, {versie: string, vingerafdruk: string}>}
 */
export function profielVersieOverzicht() {
  return Object.fromEntries(
    [...typeIds.keys()].sort().map((pid) => {
      const d = getDiagramType(typeIds.get(pid));
      return [pid, { versie: versieVan(d), vingerafdruk: profielVingerafdruk(d) }];
    }),
  );
}

/**
 * Wat de profielen verliezen op de rondreis descriptor → ontwerp-model → descriptor
 * (studio/activities/profielRondreis.js); bewaakt door profielRondreis.test.mjs.
 * @returns {Record<string, number>}
 */
export function profielRondreisStand() {
  return rondreisStand([...typeIds.values()].map((id) => getDiagramType(id)));
}

/** De descriptor van een profiel-id uit een project, of undefined. */
export function descriptorVan(profielId) {
  return typeIds.has(profielId) ? getDiagramType(typeIds.get(profielId)) : undefined;
}

// ── V3-export van een Studio-project (07-11, Mark: "het model is de bron voor het genereren") ──
// Dezelfde terugreis als de Studio (canoniek-uml/adapter.js naarCanoniekModel + store/adapters.js
// storeNaarV3Model), met eerst de ops ná de snapshot nagespeeld (zoals de MCP) en de migratie van
// het profiel (composities, overerving, «gebruikt»). Zie server.mjs POST /export/v3.
import { maakStand, speelOpsNa } from "../web/vite/src/diagramprofielen/ea/sidecarImport.js";
import { naarCanoniekModel } from "../web/vite/src/diagramprofielen/canoniek-uml/adapter.js";
import { exporteerV3 as studioExporteerV3, importeerV3 } from "../web/vite/src/diagramprofielen/canoniek-uml/serialisatie.js";
import { valideerVoorV3 } from "../web/vite/src/store/adapters.js";
import { metMarksBijlage } from "../web/vite/src/marks/v3Bijlage.js";

/**
 * @param {{profiel: any, ops?: Array<{store: string, op: string, args: any[], volgnummer?: number}>, profielId?: string,
 *   marks?: any, markContext?: string | string[] | null}} p - `marks`: het onderdeel `marks` van het werkbestand
 * @returns {{model: any, meldingen: Array<{regel?: string, bericht: string, elementId?: string}>, nagespeeld: number}}
 */
export function exporteerV3({ profiel, ops = [], profielId = "diagram05", marks = undefined, markContext = null }) {
  const stand = maakStand({ profielen: { [profielId]: profiel || {} }, ...(marks !== undefined ? { marks } : {}) });
  // De ops van dit profiel, en die op de marks (18-11); structuur en kruisverbanden doen voor V3 niet mee.
  const r = speelOpsNa(stand, (ops || []).filter((o) => o?.store === `model:${profielId}` || o?.store === "marks"));
  const st = stand.profielVoor(profielId).getState();
  const basis = { elements: st.elements || {}, diagrams: st.diagrams || {}, meta: st.meta || {} };
  const desc = descriptorVan(profielId);
  const mig = desc?.hooks?.migreerModel?.(basis);
  const staat = mig ? { ...basis, ...mig } : basis;
  // Precies wat de Studio bij "Exporteer V3" doet (serialisatie.exporteerV3, met het overzicht en
  // de canonieke diagram-ids); de Studio geeft hem zijn al gemigreerde storestaat.
  const { v3: kaal, overgeslagen } = studioExporteerV3({ ...st, ...staat });
  // Marks als bijlage naast het model: wat geldt in `markContext` (een lijst laag-ids of het id
  // van een bewaarde context); zonder: alle lagen van het project in hun volgorde.
  const v3 = metMarksBijlage(kaal, stand.marks.stand, markContext);
  const meldingen = [
    ...r.problemen.map((bericht) => ({ regel: "OPS", bericht })),
    ...(valideerVoorV3(naarCanoniekModel(staat)) || []).map((o) => ({ regel: o.regel, bericht: o.bericht || o.melding || o.tekst || JSON.stringify(o), ...(o.elementId ? { elementId: o.elementId } : {}) })),
    ...(overgeslagen?.length ? [{ regel: "OVERGESLAGEN", bericht: `Niet in V3 (geen tegenhanger): ${overgeslagen.join(", ")}.` }] : []),
  ];
  return { model: v3, meldingen, nagespeeld: r.toegepast };
}

/** Heenreis (voor tests en proeven): V3 → de profielstaat zoals de Studio hem bewaart. */
export function v3NaarProfiel(v3) {
  const core = importeerV3(v3);
  return { diagramTypeId: core.diagramTypeId, elements: core.elements, diagrams: core.diagrams, meta: core.meta || {} };
}

// ── Verschil tussen een afgeleid project (branch) en MAIN (09-11, branch stap 1) ──────────────
// Drie werkbestanden materialiseren (snapshot + ops, zoals hierboven) en vergelijken met
// studio/takken/verschilMetMain.js. Na elkaar: maakStand ontkoppelt de vorige stand.
import { bouwWerkbestand } from "../web/vite/src/diagramprofielen/ea/sidecarImport.js";
import { verschilMetMain } from "../web/vite/src/studio/takken/verschilMetMain.js";
import { bouwHierarchie } from "../web/vite/src/studio/boomRegels.js";

/** Snapshot + ops → werkbestand ("studio-project" v3). */
export function materialiseer({ profiel, ops = [] }) {
  const stand = maakStand(profiel || {});
  const r = speelOpsNa(stand, ops || []);
  return { werkbestand: bouwWerkbestand(stand), problemen: r.problemen, nagespeeld: r.toegepast };
}

/**
 * Eén profiel nagespeeld (10-11, voor GET /api/studio/projecten/:id/model/:profiel van BACKEND en
 * laag 2 van de werkplaats op Imprint): het profiel uit de blob plus alleen de ops op zijn eigen
 * store (`model:<profielId>`). Ops op structuur of kruis raken het profiel niet; die worden
 * overgeslagen (en geteld). → `{profiel, nagespeeld, overgeslagen, meldingen}`; een op die niet
 * na te spelen is staat in `meldingen` (regel "OPS").
 *
 * @param {{profielId: string, profiel: any, ops?: any[]}} p
 */
export function materialiseerProfiel({ profielId, profiel, ops = [] }) {
  const store = `model:${profielId}`;
  const eigen = (ops || []).filter((o) => o?.store === store);
  const werkbestand = { formaat: "studio-project", versie: 3, profielen: { [profielId]: profiel || { elements: {}, diagrams: {} } } };
  const r = materialiseer({ profiel: werkbestand, ops: eigen });
  return {
    profiel: r.werkbestand?.profielen?.[profielId] ?? null,
    nagespeeld: r.nagespeeld,
    overgeslagen: (ops || []).length - eigen.length,
    meldingen: (r.problemen || []).map((bericht) => ({ regel: "OPS", bericht: typeof bericht === "string" ? bericht : JSON.stringify(bericht) })),
  };
}

/**
 * @param {{basis: {profiel: any, ops?: any[]}, tak: {profiel: any, ops?: any[]}, main: {profiel: any, ops?: any[]}, mapId?: string|null}} p
 */
export function vergelijkProjecten({ basis, tak, main, mapId = null }) {
  const m = { basis: materialiseer(basis), tak: materialiseer(tak), main: materialiseer(main) };
  const uit = verschilMetMain({ basis: m.basis.werkbestand, tak: m.tak.werkbestand, main: m.main.werkbestand, mapId, ouderVan: maakOuderVan() });
  const meldingen = Object.entries(m).flatMap(([kant, x]) => x.problemen.map((bericht) => ({ regel: "OPS", kant, bericht })));
  return { ...uit, meldingen };
}

/** Boomouder per profiel en per stand (hiërarchie van de descriptor), voor kinderen zonder plaatsing. */
function maakOuderVan() {
  const cache = new Map();
  return (profielId, elementId, stand) => {
    const sleutel = stand.profielen?.[profielId];
    if (!sleutel) return null;
    if (!cache.has(sleutel)) {
      const desc = descriptorVan(profielId);
      let kaart = new Map();
      if (desc?.hierarchie) {
        try {
          kaart = bouwHierarchie(sleutel.elements || {}, desc.hierarchie, desc.hooks?.hierarchieParen?.(sleutel) || []).ouderVan;
        } catch { kaart = new Map(); }
      }
      cache.set(sleutel, kaart);
    }
    return cache.get(sleutel).get(elementId) || null;
  };
}

// ── Branch terugmergen, stap 1 en 2 (14-11, plan "Branch terugmergen") ───────────────────────
// Stap 1: alles uit de branch naar MAIN, een conflict blokkeert. Stap 2: keuze per eenheid;
// daarna haalt de branch MAIN op, behalve wat niet gekozen werd (dat blijft in de branch).
import { voegSamen, opsVoorVerschil, nieuweSamenhangFouten } from "../web/vite/src/studio/takken/samenvoegen.js";
import { buitenScope } from "../web/vite/src/studio/takken/verschilMetMain.js";
import { splitsPatch } from "../web/vite/src/diagramprofielen/ea/sidecarImport.js";

/**
 * Samenvoegen van een branch met MAIN, als voorstel: de server schrijft het weg.
 *
 * Invoer `keuze` (stap 2, optioneel): sleutel (`verschilSleutel`) → true | false | "terug".
 * Zonder keuze gaat alles mee en blokkeren conflicten (stap 1). Met keuze blokkeert een conflict
 * niet: gekozen = de versie van de branch, niet gekozen = die van MAIN; "terug" = de branch neemt
 * de versie van MAIN over (terugzetten).
 *
 * → `{conflicten, opgelost, buitenMap, samenhang, opsMain, opsTak, basis, telling, verschillen, meldingen}`:
 *   - `conflicten`: conflicten die blokkeren (alleen zonder keuze; dan zijn de ops leeg);
 *   - `opgelost`: conflicten die met de keuze zijn beslist (`gekozen`: "tak" of "main");
 *   - `buitenMap`: gekozen wijzigingen van de branch buiten de afgesplitste map (de server vraagt
 *     daarvoor een expliciete bevestiging);
 *   - `samenhang`: verwijzingen die de keuze stuk zou maken (dan zijn de ops leeg; stap 2-vangnet);
 *   - `opsMain`: MAIN → samengevoegd (de merge), `opsTak`: branch → nieuwe stand van de branch;
 *   - `basis`: het samengevoegde werkbestand zoals MAIN het na `opsMain` heeft; dat wordt het
 *     nieuwe uitgangspunt van de branch.
 *
 * Vangnet: de sidecar speelt `opsMain` en `opsTak` na op de echte stores en vergelijkt de uitkomst
 * met wat er moest uitkomen. Wijkt er iets af, dan gooit hij (422): liever geen merge dan een halve.
 *
 * @param {{basis: {profiel: any, ops?: any[]}, tak: {profiel: any, ops?: any[]}, main: {profiel: any, ops?: any[]},
 *          mapId?: string|null, keuze?: Record<string, boolean|"terug">|null}} p
 */
export function samenvoegProjecten({ basis, tak, main, mapId = null, keuze = null }) {
  const m = { basis: materialiseer(basis), tak: materialiseer(tak), main: materialiseer(main) };
  const meldingen = Object.entries(m).flatMap(([kant, x]) => x.problemen.map((bericht) => ({ regel: "OPS", kant, bericht })));
  const verschil = verschilMetMain({ basis: m.basis.werkbestand, tak: m.tak.werkbestand, main: m.main.werkbestand, mapId, ouderVan: maakOuderVan() });
  // Buiten de map telt alleen wat meegaat (zonder keuze: alles; met keuze: wat gekozen is, of
  // ontbreekt en geen conflict is).
  // Per veld (stap 2b): een keuze `<sleutel>#<veld>` telt; één veld mee = de eenheid gaat (deels) mee.
  const gaatMee = (v) => {
    if (!keuze) return true;
    const perVeld = Object.keys(keuze).filter((k) => k.startsWith(`${v.sleutel}#`));
    if (perVeld.length) return perVeld.some((k) => keuze[k] === true);
    return keuze[v.sleutel] === undefined ? v.status !== "conflict" : keuze[v.sleutel] === true;
  };
  const buitenMap = mapId ? buitenScope(verschil.verschillen).filter(gaatMee) : [];
  const { samengevoegd, nieuwTak, conflicten } = voegSamen({ basis: m.basis.werkbestand, tak: m.tak.werkbestand, main: m.main.werkbestand, keuze });
  const blokkerend = keuze ? [] : conflicten;
  const opgelost = keuze ? conflicten : [];
  const kern = { conflicten: blokkerend, opgelost, buitenMap, samenhang: [], telling: verschil.telling, verschillen: verschil.verschillen, meldingen };
  if (blokkerend.length) return { ...kern, opsMain: [], opsTak: [], basis: null };

  // Stap-2-vangnet: geen verwijzing naar iets wat er niet meer is (alleen wat deze keuze stuk maakt).
  const samenhang = [
    ...nieuweSamenhangFouten(samengevoegd, m.main.werkbestand, m.tak.werkbestand).map((f) => ({ kant: "main", fout: f })),
    ...nieuweSamenhangFouten(nieuwTak, m.main.werkbestand, m.tak.werkbestand).map((f) => ({ kant: "tak", fout: f })),
  ];
  if (samenhang.length) return { ...kern, samenhang, opsMain: [], opsTak: [], basis: null };

  const splits = (p) => splitsPatch(p);
  const opsMain = opsVoorVerschil(m.main.werkbestand, samengevoegd, { splits });
  const opsTak = opsVoorVerschil(m.tak.werkbestand, nieuwTak, { splits });

  // Vangnet: naspelen op de echte stores, dan mag er geen verschil meer zijn.
  const naMain = materialiseer({ profiel: m.main.werkbestand, ops: opsMain });
  const naTak = materialiseer({ profiel: m.tak.werkbestand, ops: opsTak });
  const rest = [
    ...verschilMetMain({ basis: samengevoegd, tak: samengevoegd, main: naMain.werkbestand }).verschillen.map((v) => ({ ...v, kant: "main" })),
    ...verschilMetMain({ basis: nieuwTak, tak: nieuwTak, main: naTak.werkbestand }).verschillen.map((v) => ({ ...v, kant: "tak" })),
  ];
  if (rest.length || naMain.problemen.length || naTak.problemen.length) {
    const wat = [...rest.slice(0, 5).map((v) => `${v.kant}: ${v.soort} ${v.profielId ?? ""}/${v.id}`), ...naMain.problemen, ...naTak.problemen];
    throw new Error(`Het samenvoegen klopt niet na naspelen: ${wat.join("; ")}`);
  }
  return { ...kern, opsMain, opsTak, basis: naMain.werkbestand };
}
