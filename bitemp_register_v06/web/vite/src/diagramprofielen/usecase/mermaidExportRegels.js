// @ts-check
/**
 * mermaidExportRegels — de **regelset** "use case-model → Mermaid flowchart".
 *
 * Spiegelbeeld van mermaidRegels.js (de import): dezelfde conventie de andere
 * kant op, zodat een geëxporteerde tekst weer hetzelfde model oplevert
 * (roundtrip, zie mermaidExport.test.js). De bron is het graafbeeld van het
 * model (`transformatie/modelNaarGraaf.js`: `aard` = elementtype, `tekst` =
 * naam, `eigenschappen` = data); het doel zijn de Mermaid-vormen van
 * `transformatie/mermaidSchrijver.js`.
 */

export const USECASE_NAAR_MERMAID = {
  id: "usecase-naar-mermaid-flowchart",
  versie: 1,
  titel: "Use case-model → Mermaid flowchart",
  bron: "usecase",
  doel: "mermaid-flowchart",
  regels: [
    // ── Elementen; de toelichting wordt een notitie aan een stippellijn ──
    { naam: "Actor", bij: "knoop", als: { aard: "actor" }, maak: { type: "cirkel", data: { klasse: "actor", notitie: "{eigenschappen.toelichting}" } } },
    { naam: "Use case", bij: "knoop", als: { aard: "usecase" }, maak: { type: "stadion", data: { klasse: "usecase", notitie: "{eigenschappen.toelichting}" } } },
    { naam: "Systeemkader", bij: "knoop", als: { aard: "systeem" }, maak: { type: "subgraph", data: { notitie: "{eigenschappen.toelichting}" } } },
    { naam: "Notitie", bij: "knoop", als: { aard: "notitie" }, maak: { type: "rechthoek", naam: "{eigenschappen.tekst}", data: { klasse: "note" } } },

    // ── Relaties ──
    { naam: "Include", bij: "verbinding", als: { aard: "include" }, maak: { type: "gestippeld", data: { label: "<<include>>" } } },
    { naam: "Extend", bij: "verbinding", als: { aard: "extend" }, maak: { type: "gestippeld", data: { label: "<<extend>>" } } },
    // Een benoemde generalisatie (bv. "gespreksvorm") houdt haar naam als label;
    // een naamloze wordt "specialisatie" — precies wat de import weer herkent.
    { naam: "Generalisatie (benoemd)", bij: "verbinding", als: { aard: "generalisatie", label: { leeg: false } }, maak: { type: "gestippeld", data: { label: "{label}" } } },
    { naam: "Generalisatie", bij: "verbinding", als: { aard: "generalisatie" }, maak: { type: "gestippeld", data: { label: "specialisatie" } } },
    { naam: "Associatie", bij: "verbinding", als: { aard: "associatie" }, maak: { type: "doorgetrokken", data: { label: "{label}" } } },
    // Lidmaatschap zit al in de nesting van de subgraph.
    { naam: "Lidmaatschap", bij: "verbinding", als: { aard: "bevat" }, negeer: true },
  ],
};
