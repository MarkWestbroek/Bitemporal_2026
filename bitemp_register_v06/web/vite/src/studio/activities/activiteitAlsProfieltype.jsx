/**
 * activiteitAlsProfieltype — registreert een klassieke activiteit (dmn-js,
 * bpmn, berichten, de klassieke Canoniek model IDE) als *profieltype*, zodat
 * de Modelleren-tab-host haar kan tonen (consolidatieplan fase 2, sluitstuk).
 *
 * Deze editors draaien op een andere motor dan diagramcore. De shim geeft ze
 * een minimale store-façade met documenten; twee smaken:
 *
 *  - **vaste documenten** (IDE v1, berichten): precies één document, geen ＋.
 *  - **documentenbeheer** (BPMN, DMN): meerdere documenten, elk met eigen
 *    inhoud. De activiteit registreert daarvoor een *documentkoppeling*
 *    ({ haal, zet }) vanuit haar Provider; de shim bewaart de inhoud per
 *    document in localStorage en wisselt bij tab-/documentwissel. De
 *    elementen van zo'n document leven in de eigen editor (bpmn.io/dmn-js),
 *    niet in de projectboom — dat is bewust (sessiebesluit 2026-07-13);
 *    "BPMN gewoon tekenen op de eigen motor" is een later metamodel-spoor.
 *
 * De eigen Sidebar van de activiteit (bv. DmnTreeBrowser + ModelPicker)
 * verschijnt in het ondervak van de projectbrowser.
 */
import { create } from "zustand";
import { registreerProfieltype } from "../profieltypeRegistry";

const Passthrough = ({ children }) => children;

// ── Documentkoppelingen: de brug tussen shim en editor ──────────────
// De Provider van de activiteit meldt zich met { haal: async () => inhoud,
// zet: async (inhoud|null) => void } (null = starter). Registratie laadt
// meteen de inhoud van het actieve document (Provider is net gemount).
const _koppelingen = new Map();
const _bijRegistratie = new Map();

export function registreerDocumentKoppeling(profielId, koppeling) {
  _koppelingen.set(profielId, koppeling);
  _bijRegistratie.get(profielId)?.();
  return () => {
    if (_koppelingen.get(profielId) === koppeling) _koppelingen.delete(profielId);
  };
}

export function registreerActiviteitAlsProfieltype(
  activiteit,
  { kleur, documenten, label, eigenSchil = false, documentenBeheer = false } = {}
) {
  const standaardDocs = documenten?.length
    ? documenten
    : [{ id: activiteit.id, naam: label || activiteit.label }];
  const typeId = `act-${activiteit.id}`;
  const docsSleutel = `studio-docs-${activiteit.id}`;
  const inhoudSleutel = `studio-docinhoud-${activiteit.id}`;

  const leesJson = (sleutel, anders) => {
    try {
      const raw = localStorage.getItem(sleutel);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return anders;
  };
  const bewaarJson = (sleutel, waarde) => {
    try {
      localStorage.setItem(sleutel, JSON.stringify(waarde));
    } catch { /* ignore */ }
  };

  const startDocs = documentenBeheer ? leesJson(docsSleutel, standaardDocs) : standaardDocs;
  const naarDiagrams = (docs) =>
    Object.fromEntries(
      docs.map((d) => [d.id, { id: d.id, naam: d.naam, diagramType: typeId, nodes: [], edges: [] }])
    );
  const bewaarDocs = (diagrams) =>
    bewaarJson(docsSleutel, Object.values(diagrams).map((d) => ({ id: d.id, naam: d.naam })));

  /** Bewaar de inhoud van het huidige document (via de koppeling). */
  const bewaarInhoudVan = async (docId) => {
    const koppeling = _koppelingen.get(activiteit.id);
    if (!koppeling || !docId) return;
    try {
      const inhoud = await koppeling.haal();
      if (inhoud != null) {
        const alles = leesJson(inhoudSleutel, {});
        alles[docId] = inhoud;
        bewaarJson(inhoudSleutel, alles);
      }
    } catch { /* editor niet (meer) beschikbaar */ }
  };

  /** Laad de inhoud van een document in de editor (null = starter). */
  const laadInhoudVan = async (docId) => {
    const koppeling = _koppelingen.get(activiteit.id);
    if (!koppeling || !docId) return;
    const alles = leesJson(inhoudSleutel, {});
    try {
      await koppeling.zet(alles[docId] ?? null);
    } catch { /* ignore */ }
  };

  const useStore = create((set, get) => ({
    diagramTypeId: typeId,
    elements: {},
    diagrams: naarDiagrams(startDocs),
    viewports: {},
    meta: null,
    actiefDiagramId: startDocs[0]?.id || null,

    /** Documentwissel: huidige inhoud bewaren, nieuwe laden. */
    setActiefDiagram: (id) => {
      const van = get().actiefDiagramId;
      if (van === id) return;
      set({ actiefDiagramId: id });
      if (documentenBeheer) {
        (async () => {
          await bewaarInhoudVan(van);
          await laadInhoudVan(id);
        })();
      }
    },

    /** Voor de host: bewaar het actieve document (bv. vóór een profielwissel). */
    bewaarActieveInhoud: () => (documentenBeheer ? bewaarInhoudVan(get().actiefDiagramId) : undefined),

    addDiagram: (diagram) => {
      if (!documentenBeheer) return;
      const van = get().actiefDiagramId;
      set((s) => {
        const diagrams = { ...s.diagrams, [diagram.id]: { nodes: [], edges: [], diagramType: typeId, ...diagram } };
        bewaarDocs(diagrams);
        return { diagrams, actiefDiagramId: diagram.id };
      });
      (async () => {
        await bewaarInhoudVan(van);
        await laadInhoudVan(diagram.id); // geen opgeslagen inhoud → starter
      })();
    },

    renameDiagram: (id, naam) =>
      set((s) => {
        if (!s.diagrams[id]) return {};
        const diagrams = { ...s.diagrams, [id]: { ...s.diagrams[id], naam } };
        if (documentenBeheer) bewaarDocs(diagrams);
        return { diagrams };
      }),

    verwijderDiagram: (id) => {
      if (!documentenBeheer) return;
      set((s) => {
        const { [id]: _weg, ...diagrams } = s.diagrams;
        bewaarDocs(diagrams);
        const alles = leesJson(inhoudSleutel, {});
        delete alles[id];
        bewaarJson(inhoudSleutel, alles);
        const actiefDiagramId =
          s.actiefDiagramId === id ? Object.keys(diagrams)[0] || null : s.actiefDiagramId;
        return { diagrams, actiefDiagramId };
      });
      laadInhoudVan(get().actiefDiagramId);
    },

    laadModel: () => {},
  }));

  if (documentenBeheer) {
    // Provider net gemount (tab geopend): actieve document-inhoud laden.
    _bijRegistratie.set(activiteit.id, () => laadInhoudVan(useStore.getState().actiefDiagramId));
  }

  registreerProfieltype({
    id: activiteit.id,
    label: label || activiteit.label,
    icon: activiteit.icon,
    kleur,
    useStore,
    descriptor: { id: typeId, elementTypes: [] },
    Provider: activiteit.Provider || Passthrough,
    Main: activiteit.Main,
    Inspector: activiteit.Inspector,
    // De eigen tree/picker van de activiteit in het ondervak van de browser.
    ElementenBrowser: activiteit.Sidebar,
    menus: activiteit.menus,
    menuPrefix: activiteit.id,
    diagramTerm: "diagram",
    // Klassieke editor (andere motor): niet in de project-export, geen
    // element-inhoud in de boom.
    klassiek: true,
    // Zonder documentenbeheer is er precies één vast document (geen ＋).
    vasteDocumenten: !documentenBeheer,
    documentenBeheer,
    // true → deze editor brengt zijn eigen volledige schil mee (bv. de
    // FlexLayout-IDE): de host klapt zijn zijpanelen dan automatisch in.
    eigenSchil,
  });
}
