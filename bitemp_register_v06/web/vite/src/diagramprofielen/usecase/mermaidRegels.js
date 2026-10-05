// @ts-check
/**
 * mermaidRegels — de **regelset** "Mermaid flowchart → use case-model".
 *
 * Dit is de leesbare, aanpasbare kern van de transformatie: per soort
 * bron-item (knoop, groep, verbinding) een geordende lijst `als … maak …`-
 * regels. De eerste regel die past wint. De syntax van Mermaid zit in de lezer
 * (`transformatie/mermaidFlowchart.js`), de uitvoering in de toepasser
 * (`transformatie/regels.js`) — hier staat alleen de *betekenis*: wat een
 * vorm of lijn in een Mermaid-tekening is in het use case-profiel.
 *
 * Mermaid kent geen use case-diagram; de gangbare conventie in flowcharts is:
 *   cirkel `(( ))` = actor · stadion `([ ])` = use case · subgraph = systeem ·
 *   rechthoek `[ ]` aan een stippellijn = notitie bij een element.
 */

const INCLUDE = { patroon: "^(<<|«)?\\s*include[sd]?\\s*(>>|»)?$" };
const EXTEND = { patroon: "^(<<|«)?\\s*extends?\\s*(>>|»)?$" };
const SPECIALISATIE = ["specialisatie", "generalisatie", "is een", "is-een", "subtype"];
const DEELNEMER = ["actor", "usecase"];

export const MERMAID_NAAR_USECASE = {
  id: "mermaid-flowchart-naar-usecase",
  versie: 1,
  titel: "Mermaid flowchart → use case-model",
  bron: "mermaid-flowchart",
  doel: "usecase",
  regels: [
    // ── Knopen: eerst de expliciete klasse (`class X actor`), dan de vorm ──
    { naam: "Notitie (klasse)", bij: "knoop", als: { klasse: ["note", "notitie"] }, maak: { type: "notitie", naam: "", data: { tekst: "{tekst}" } } },
    { naam: "Actor (klasse)", bij: "knoop", als: { klasse: "actor" }, maak: { type: "actor" } },
    { naam: "Use case (klasse)", bij: "knoop", als: { klasse: ["usecase", "use-case"] }, maak: { type: "usecase" } },
    { naam: "Actor (cirkel)", bij: "knoop", als: { vorm: ["cirkel", "dubbele-cirkel"] }, maak: { type: "actor" } },
    { naam: "Use case (stadion)", bij: "knoop", als: { vorm: ["stadion", "afgerond"] }, maak: { type: "usecase" } },
    { naam: "Notitie (rechthoek)", bij: "knoop", als: { vorm: "rechthoek" }, maak: { type: "notitie", naam: "", data: { tekst: "{tekst}" } } },

    // ── Groepen ──
    { naam: "Systeemkader", bij: "groep", maak: { type: "systeem" } },

    // ── Verbindingen ──
    // Een notitie aan een element is in het model de toelichting ván dat
    // element; de notitie zelf vervalt (zonder de vetgedrukte kopregel, die
    // herhaalt alleen de naam).
    { naam: "Toelichting uit notitie", bij: "verbinding", als: { doel: { type: "notitie" }, bron: { type: { niet: "notitie" } } }, zet: { op: "bron", data: { toelichting: "{doel.romp}" }, vervalt: "doel" } },
    { naam: "Toelichting uit notitie (omgekeerd)", bij: "verbinding", als: { bron: { type: "notitie" }, doel: { type: { niet: "notitie" } } }, zet: { op: "doel", data: { toelichting: "{bron.romp}" }, vervalt: "bron" } },

    { naam: "Include", bij: "verbinding", als: { label: INCLUDE, bron: { type: "usecase" }, doel: { type: "usecase" } }, maak: { type: "include" } },
    { naam: "Extend", bij: "verbinding", als: { label: EXTEND, bron: { type: "usecase" }, doel: { type: "usecase" } }, maak: { type: "extend" } },

    // Pijl van specifiek naar algemeen, zoals de generalisatie in het profiel.
    { naam: "Generalisatie (actoren)", bij: "verbinding", als: { label: SPECIALISATIE, bron: { type: "actor" }, doel: { type: "actor" } }, maak: { type: "generalisatie" } },
    { naam: "Generalisatie (use cases)", bij: "verbinding", als: { label: SPECIALISATIE, bron: { type: "usecase" }, doel: { type: "usecase" } }, maak: { type: "generalisatie" } },

    { naam: "Associatie", bij: "verbinding", als: { lijn: ["doorgetrokken", "dik"], bron: { type: DEELNEMER }, doel: { type: DEELNEMER } }, maak: { type: "associatie", naam: "{label}" } },
    // Ook een kale stippellijn tussen actor en use case is deelname; mét label
    // (bv. «include» tussen een actor en een use case) raden we niet.
    { naam: "Associatie (stippellijn actor–use case)", bij: "verbinding", als: { label: { leeg: true }, bron: { type: "actor" }, doel: { type: "usecase" } }, maak: { type: "associatie" } },
    { naam: "Associatie (stippellijn use case–actor)", bij: "verbinding", als: { label: { leeg: true }, bron: { type: "usecase" }, doel: { type: "actor" } }, maak: { type: "associatie" } },

    // Interpretatie: een benoemde stippelpijl tussen twee gelijksoortige
    // elementen die geen include/extend is (bv. "gespreksvorm") lezen we als
    // "is een vorm van". Het label blijft als naam bewaard; de toepassing
    // wordt gemeld zodat je het kunt nalopen.
    { naam: "Benoemde stippelpijl → generalisatie (actoren)", bij: "verbinding", meld: true, als: { lijn: "gestippeld", label: { leeg: false }, bron: { type: "actor" }, doel: { type: "actor" } }, maak: { type: "generalisatie", naam: "{label}" } },
    { naam: "Benoemde stippelpijl → generalisatie (use cases)", bij: "verbinding", meld: true, als: { lijn: "gestippeld", label: { leeg: false }, bron: { type: "usecase" }, doel: { type: "usecase" } }, maak: { type: "generalisatie", naam: "{label}" } },

    { naam: "Onzichtbare lijn", bij: "verbinding", als: { lijn: "onzichtbaar" }, negeer: true },
  ],
};
