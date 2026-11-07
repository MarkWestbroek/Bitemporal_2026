/**
 * shaclTransformatie — "Canoniek model → SHACL-shapes" als transformatie (richting transform)
 * in Modelleren: bron = het canonieke model in een map, doel = een map met een SHACL-diagram.
 * Fase 3 van docs/plans/"2026-11-06 Linked data als M2 — SHACL, SKOS, OWL (plan).md".
 *
 * De afbeelding zelf is puur en getest (diagramprofielen/shacl/vanCanoniek.js); hier alleen
 * de aansluiting:
 *   - ids per bronmap (`cs_<map>_…`), zodat twee maps elkaar niet raken;
 *   - **opnieuw genereren werkt bij**: de shapes van een eerdere run uit dezelfde map
 *     (`data.uitCanoniek`) worden vervangen, de posities op het diagram blijven staan, en wat
 *     niet meer gegenereerd wordt verdwijnt (met zijn kruisverbanden);
 *   - per gemaakte shape een **kruisverband** "genereert" in de koppelingen-matrix: het
 *     canonieke element (kolom) genereert de shape (rij).
 *
 * En de omgekeerde richting, "SHACL-shapes → canoniek model" (naarCanoniek.js): een UML-weergave
 * van een vocabulaire waarvoor alleen shapes bestaan (ODRL 2.2). Zelfde aansluiting: ids per
 * bronmap (`vs_<map>_…`), opnieuw uitvoeren werkt bij, kruisverbanden shape (rij) genereert
 * canoniek element (kolom).
 *
 * Daarnaast: SHACL (Turtle) importeren en exporteren via hetzelfde paneel (shaclRegistry.js).
 */
import { registreerTransformatie } from "./transformatieRegistry.js";
import { collectMapModel } from "./transformaties.js";
import { getProfieltype } from "../profieltypeRegistry";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { useKruisStore, refKey } from "./koppelingenActivity.jsx";
import { canoniekNaarShacl, voegShapesIn } from "../../diagramprofielen/shacl/vanCanoniek.js";
import { registreerShaclTransformaties } from "../../diagramprofielen/shacl/shaclRegistry.js";
import { shaclNaarCanoniek, voegCanoniekIn } from "../../diagramprofielen/shacl/naarCanoniek.js";

const CANONIEK = "diagram05";
const SHACL = "shacl05";
registreerTransformatie({
  id: "canoniek-naar-shacl",
  label: "Canoniek model → SHACL-shapes",
  richting: "transform",
  profielTypes: [CANONIEK],
  toelichting:
    "Maakt uit het canonieke model in deze map node shapes (entiteit = klasse, velden met xsd-datatypen en facetten, " +
    "gegevenselementen via sh:node, relaties via sh:class) in een SHACL-diagram in de doelmap. Momentbeeld: de stand op " +
    "één moment. Opnieuw uitvoeren werkt de shapes bij; elk krijgt een kruisverband naar zijn canonieke element.",
  opties: [{ key: "basisIri", label: "basis-IRI (per domein komt er <domein># achter)", datatype: "string", default: "https://omnium.example/model/" }],
  run: async ({ bronMap, doelMap, mapNaam, opties = {} }) => {
    const canoniek = collectMapModel(bronMap)[CANONIEK];
    if (!canoniek || !Object.keys(canoniek.elements || {}).length) throw new Error("Geen canoniek model in deze map.");
    const p = getProfieltype(SHACL);
    if (!p) throw new Error("Het SHACL-profiel is niet geladen.");
    const { datatypes } = (await import("../../transformatie/gegevenstypen.snapshot.json")).default;
    const uit = canoniekNaarShacl(canoniek, { basisIri: String(opties.basisIri || "").trim() || undefined, titel: `${mapNaam || useModellerenStore.getState().mappen?.[bronMap]?.naam || "Model"} (SHACL)`, gegevenstypen: datatypes });

    const st = p.useStore.getState();
    const { elements, diagrams, diagramId, weg, her } = voegShapesIn({ elements: st.elements, diagrams: st.diagrams }, uit, bronMap);
    p.useStore.setState({ elements, diagrams });
    useModellerenStore.getState().plaatsDiagram(`${SHACL}::${diagramId}`, doelMap || bronMap);

    // Kruisverbanden: canoniek (kolom) genereert shape (rij).
    const kruis = useKruisStore.getState();
    const verweesd = new Set(weg.map((id) => refKey({ profielId: SHACL, elementId: id })));
    const wis = kruis.links.filter((l) => verweesd.has(refKey(l.rij))).map((l) => l.id);
    const zet = uit.kruisverbanden.map(({ shaclId, canoniekId }) => {
      const rij = { profielId: SHACL, elementId: her(shaclId) };
      const kolom = { profielId: CANONIEK, elementId: canoniekId };
      return { id: `${refKey(rij)}##${refKey(kolom)}`, rij, kolom, soort: "genereert", omgekeerd: true };
    });
    kruis.patchLinks({ zet, wis });

    const shapes = Object.values(elements).filter((el) => el.elementType === "nodeshape" && el.data?.uitCanoniek === bronMap).length;
    return {
      status: uit.meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
      summary: `${shapes} node shapes in "${diagrams[diagramId].naam}", ${zet.length} kruisverbanden.`,
      diagnostics: uit.meldingen.map((m) => ({ severity: m.niveau === "fout" ? "error" : m.niveau === "waarschuwing" ? "warning" : "info", code: "SHACL-CAN", message: m.bericht, sourceId: m.elementId || null })),
    };
  },
});

registreerTransformatie({
  id: "shacl-naar-canoniek",
  label: "SHACL-shapes → canoniek model (UML)",
  richting: "transform",
  profielTypes: [SHACL],
  toelichting:
    "Maakt uit de SHACL-shapes in deze map een canoniek model in de doelmap: doelklassen als entiteiten, sh:class als " +
    "relaties met kardinaliteit, velden met hun type, sh:in als enumeratie, een shape voor meer klassen als supertype, " +
    "xone/or/sparql als constraint. Opnieuw uitvoeren werkt het model bij; elk element krijgt een kruisverband naar zijn shape.",
  opties: [],
  run: async ({ bronMap, doelMap, mapNaam }) => {
    const shacl = collectMapModel(bronMap)[SHACL];
    if (!shacl || !Object.values(shacl.elements || {}).some((el) => el.elementType === "nodeshape")) throw new Error("Geen SHACL-shapes in deze map.");
    const p = getProfieltype(CANONIEK);
    if (!p) throw new Error("Het canonieke profiel is niet geladen.");
    const graaf = Object.values(shacl.elements).find((el) => el.elementType === "shapesgraaf");
    const naam = graaf?.data?.titel || graaf?.naam || mapNaam || useModellerenStore.getState().mappen?.[bronMap]?.naam || "Model";
    const uit = shaclNaarCanoniek(shacl, { titel: `${naam} (UML)` });

    const st = p.useStore.getState();
    const { elements, diagrams, diagramId, weg, her } = voegCanoniekIn({ elements: st.elements, diagrams: st.diagrams }, uit, bronMap);
    p.useStore.setState({ elements, diagrams });
    useModellerenStore.getState().plaatsDiagram(`${CANONIEK}::${diagramId}`, doelMap || bronMap);

    // Kruisverbanden: shape (rij) genereert canoniek element (kolom).
    const kruis = useKruisStore.getState();
    const verweesd = new Set(weg.map((id) => refKey({ profielId: CANONIEK, elementId: id })));
    const wis = kruis.links.filter((l) => verweesd.has(refKey(l.kolom))).map((l) => l.id);
    const zet = uit.kruisverbanden.map(({ shaclId, canoniekId }) => {
      const rij = { profielId: SHACL, elementId: shaclId };
      const kolom = { profielId: CANONIEK, elementId: her(canoniekId) };
      return { id: `${refKey(rij)}##${refKey(kolom)}`, rij, kolom, soort: "genereert", omgekeerd: false };
    });
    kruis.patchLinks({ zet, wis });

    const tel = (soort) => Object.values(uit.elements).filter((el) => el.elementType === soort).length;
    return {
      status: uit.meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
      summary: `${tel("entiteit")} entiteiten, ${tel("relatie")} relaties, ${tel("generalisatie")} generalisaties in "${diagrams[diagramId].naam}", ${zet.length} kruisverbanden.`,
      diagnostics: uit.meldingen.map((m) => ({ severity: m.niveau === "fout" ? "error" : m.niveau === "waarschuwing" ? "warning" : "info", code: "SHACL-UML", message: m.bericht, sourceId: m.elementId || null })),
    };
  },
});

// SHACL (Turtle) in en uit via het paneel, met de echte stores.
registreerShaclTransformaties({
  getProfieltype,
  getModellerenState: () => useModellerenStore.getState(),
  collectMapModel,
  download: (naam, tekst) => {
    const url = URL.createObjectURL(new Blob([tekst], { type: "text/turtle;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = naam;
    a.click();
    URL.revokeObjectURL(url);
  },
});
