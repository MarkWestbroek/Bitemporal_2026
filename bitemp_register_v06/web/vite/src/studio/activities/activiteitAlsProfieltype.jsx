/**
 * activiteitAlsProfieltype — registreert een klassieke activiteit (dmn-js,
 * bpmn, berichten, de klassieke UML-IDE) als *profieltype*, zodat de
 * Modelleren-tab-host haar kan tonen (consolidatieplan fase 2, sluitstuk).
 *
 * Deze editors draaien op een andere motor dan diagramcore en hebben geen
 * multi-diagram-store. De shim geeft ze een minimale store-façade met
 * **vaste documenten** (bv. "DMN-model"): de projectbrowser toont ze, ze
 * zijn in mappen te plaatsen en openen als tab; menubalk en inspector
 * volgen mee via het bestaande profieltype-contract. `vasteDocumenten`
 * vertelt de host dat hier niets bij te maken of te exporteren valt —
 * de echte inhoud leeft in de eigen stores/backends van de modules.
 *
 * De eigen Sidebar van de activiteit (bv. DmnTreeBrowser + ModelPicker)
 * verschijnt in het ondervak van de projectbrowser (de ElementenBrowser-
 * plek), zodat er geen functionaliteit verloren gaat.
 */
import { create } from "zustand";
import { registreerProfieltype } from "../profieltypeRegistry";

const Passthrough = ({ children }) => children;

export function registreerActiviteitAlsProfieltype(
  activiteit,
  { kleur, documenten, label, eigenSchil = false } = {}
) {
  const docs = documenten?.length
    ? documenten
    : [{ id: activiteit.id, naam: label || activiteit.label }];
  const typeId = `act-${activiteit.id}`;

  const useStore = create((set) => ({
    diagramTypeId: typeId,
    elements: {},
    diagrams: Object.fromEntries(
      docs.map((d) => [d.id, { id: d.id, naam: d.naam, diagramType: typeId, nodes: [], edges: [] }])
    ),
    viewports: {},
    meta: null,
    actiefDiagramId: docs[0].id,
    setActiefDiagram: (id) => set({ actiefDiagramId: id }),
    // Hernoemen werkt (sessie-lokaal); documenten zijn verder vast.
    renameDiagram: (id, naam) =>
      set((s) => (s.diagrams[id] ? { diagrams: { ...s.diagrams, [id]: { ...s.diagrams[id], naam } } } : {})),
    laadModel: () => {},
  }));

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
    vasteDocumenten: true,
    // true → deze editor brengt zijn eigen volledige schil mee (bv. de
    // FlexLayout-IDE): de host klapt zijn zijpanelen dan automatisch in.
    eigenSchil,
  });
}
