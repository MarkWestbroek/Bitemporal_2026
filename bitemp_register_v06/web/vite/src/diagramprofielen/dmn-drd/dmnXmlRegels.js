// @ts-check
/**
 * dmnXmlRegels — de **regelset** "DMN XML → DMN DRD-profiel". Data, geen
 * code; de syntax zit in `transformatie/dmnXml.js`. De lezer levert de
 * requirements al in DRD-richting (van het vereiste naar de vereiser), dus de
 * verbindingsregels zijn 1-op-1.
 */

export const DMN_XML_NAAR_DRD = {
  id: "dmn-xml-naar-dmn-drd",
  versie: 1,
  titel: "DMN XML → DMN DRD-profiel",
  bron: "dmn-xml",
  doel: "dmn-drd",
  regels: [
    { naam: "Beslissing", bij: "knoop", als: { aard: "decision" }, maak: { type: "decision", data: { vraag: "{vraag}", toelichting: "{toelichting}" } } },
    { naam: "Invoergegeven", bij: "knoop", als: { aard: "inputData" }, maak: { type: "inputData", data: { toelichting: "{toelichting}" } } },
    { naam: "Business knowledge model", bij: "knoop", als: { aard: "businessKnowledgeModel" }, maak: { type: "bkm", data: { toelichting: "{toelichting}" } } },
    { naam: "Kennisbron", bij: "knoop", als: { aard: "knowledgeSource" }, maak: { type: "knowledgeSource", data: { toelichting: "{toelichting}" } } },
    { naam: "Tekstannotatie", bij: "knoop", als: { aard: "textAnnotation" }, maak: { type: "notitie", naam: "", data: { tekst: "{tekst}" } } },

    { naam: "Information requirement", bij: "verbinding", als: { aard: "informationRequirement" }, maak: { type: "infoReq" } },
    { naam: "Knowledge requirement", bij: "verbinding", als: { aard: "knowledgeRequirement" }, maak: { type: "knowReq" } },
    { naam: "Authority requirement", bij: "verbinding", als: { aard: "authorityRequirement" }, maak: { type: "authReq" } },
    { naam: "Notitie-lijn", bij: "verbinding", als: { aard: "association", bron: { type: "notitie" } }, maak: { type: "notitielijn" } },
    { naam: "Notitie-lijn (omgekeerd)", bij: "verbinding", als: { aard: "association", doel: { type: "notitie" } }, maak: { type: "notitielijn", omgekeerd: true } },
    { naam: "Overige associatie", bij: "verbinding", als: { aard: "association" }, negeer: true },
  ],
};
