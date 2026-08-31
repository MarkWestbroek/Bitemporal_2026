// @ts-check

export const AMX = Object.freeze({
  XML_ONGELDIG: "AMX-XML-ONGELDIG",
  XML_ROOT: "AMX-XML-ROOT",
  XML_NAMESPACE: "AMX-XML-NAMESPACE",
  ID_ONTBREEKT: "AMX-ID-ONTBREEKT",
  ID_DUBBEL: "AMX-ID-DUBBEL",
  ID_REFERENTIE: "AMX-ID-REFERENTIE",
  TYPE_ELEMENT: "AMX-TYPE-ELEMENT",
  TYPE_RELATIE: "AMX-TYPE-RELATIE",
  VIEW_NODE: "AMX-VIEW-NODE",
  VIEW_CONNECTION: "AMX-VIEW-CONNECTION",
  VIEW_RELATIE_VERBORGEN: "AMX-VIEW-RELATIE-VERBORGEN",
  PROPERTY_DEFINITION: "AMX-PROPERTY-DEFINITION",
  LOSS_STIJL: "AMX-LOSS-STIJL",
  LOSS_ROUTING: "AMX-LOSS-ROUTING",
  LOSS_ATTACHMENT: "AMX-LOSS-ATTACHMENT",
});

/** @returns {import("./exchangeModel.js").Diagnostic} */
export function diagnostic(severity, code, message, sourceId = null, path = null) {
  return { severity, code, message, sourceId, path };
}

export function exchangeFout(message, diagnostics) {
  const fout = new Error(message);
  fout.code = diagnostics?.[0]?.code || AMX.XML_ONGELDIG;
  fout.diagnostics = diagnostics || [];
  return fout;
}