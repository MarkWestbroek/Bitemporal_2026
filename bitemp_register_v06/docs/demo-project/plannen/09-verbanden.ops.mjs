// 09 — wat de talen aan elkaar bindt: de kruisverbanden (koppelingen-matrix) en het doorklikken
// (verwijstNaar: dubbelklik op een element opent een diagram, ook in een andere taal).
// Rechtstreeks als operaties, omdat element-ids alleen binnen een taal uniek zijn (Evenementaanvraag
// bestaat in zeven talen) en een plan ze op id aanwijst.
//
// Lees een regel als: <van> <soort> <naar>. Soorten: komt voort uit | heeft te maken met |
// genereert | realiseert.
const VERBANDEN = [
  // De rode draad: use case → proces → beslissing → gegevens → API
  ["bpmnMotor05", "Bepaal risicoklasse", "taak", "realiseert", "usecase05", "Bepaal de risicoklasse", "usecase"],
  ["bpmnMotor05", "Beoordeel de aanvraag", "taak", "realiseert", "usecase05", "Beoordeel de aanvraag", "usecase"],
  ["bpmnMotor05", "Win veiligheidsadviezen in", "taak", "realiseert", "usecase05", "Geef veiligheidsadvies", "usecase"],
  ["bpmnMotor05", "Leg de vergunning vast", "taak", "realiseert", "usecase05", "Verleen of weiger de vergunning", "usecase"],
  ["bpmnMotor05", "Bepaal risicoklasse", "taak", "heeft te maken met", "dmnDrd05", "Risicoklasse", "decision"],
  ["bpmnMotor05", "Bereken leges", "taak", "heeft te maken met", "dmnDrd05", "Leges", "decision"],
  ["dmnDrd05", "Evenementaanvraag", "inputData", "komt voort uit", "diagram05", "Evenementaanvraag", "entiteit"],
  ["oas05", "dienAanvraagIn", "operatie", "realiseert", "usecase05", "Vraag evenementenvergunning aan", "usecase"],
  ["oas05", "leesAanvraag", "operatie", "realiseert", "usecase05", "Volg de status van de aanvraag", "usecase"],
  ["oas05", "leesKalender", "operatie", "realiseert", "usecase05", "Bekijk de evenementenkalender", "usecase"],
  // Het canonieke model als bron van de andere gegevensmodellen
  ["diagram05", "Evenementaanvraag", "entiteit", "genereert", "oas05", "Evenementaanvraag", "schema"],
  ["diagram05", "Organisator", "entiteit", "genereert", "oas05", "Organisator", "schema"],
  ["diagram05", "Evenementlocatie", "entiteit", "genereert", "oas05", "Evenementlocatie", "schema"],
  ["diagram05", "Evenementaanvraag", "entiteit", "genereert", "graphql05", "Evenementaanvraag", "object"],
  ["diagram05", "Organisator", "entiteit", "genereert", "graphql05", "Organisator", "object"],
  ["diagram05", "Evenementlocatie", "entiteit", "genereert", "graphql05", "Evenementlocatie", "object"],
  ["diagram05", "Evenementenvergunning", "entiteit", "genereert", "graphql05", "Evenementenvergunning", "object"],
  ["diagram05", "Evenementaanvraag", "entiteit", "genereert", "erd05", "evenementaanvraag", "entiteit"],
  ["diagram05", "Organisator", "entiteit", "genereert", "erd05", "organisator", "entiteit"],
  ["diagram05", "Evenementaanvraag", "entiteit", "genereert", "shacl05", "EvenementaanvraagShape", "nodeshape"],
  ["diagram05", "Evenementaanvraag", "entiteit", "komt voort uit", "mim05", "Evenementaanvraag", "objecttype"],
  ["diagram05", "Organisator", "entiteit", "komt voort uit", "mim05", "Organisator", "objecttype"],
  ["diagram05", "Evenementlocatie", "entiteit", "komt voort uit", "mim05", "Evenementlocatie", "objecttype"],
  ["formulierdiagram", "Aanvraag evenementenvergunning", "formulier", "komt voort uit", "diagram05", "Evenementaanvraag", "entiteit"],
  ["formulierdiagram", "Aanvraag evenementenvergunning", "formulier", "realiseert", "usecase05", "Vraag evenementenvergunning aan", "usecase"],
  ["xsd05", "AdviesType", "complexType", "komt voort uit", "diagram05", "Veiligheidsadvies", "entiteit"],
  ["object05", "aanvraag3", "object", "heeft te maken met", "diagram05", "Evenementaanvraag", "entiteit"],
  ["statemachine05", "Ingediend", "toestand", "heeft te maken met", "diagram05", "AanvraagStatus", "enumeratie"],
  // Architectuur naar de uitwerking
  ["bpmnMotor05", "Beoordeel de aanvraag", "taak", "realiseert", "archimate05", "Evenementaanvraag behandelen", "business-proces"],
  ["oas05", "Evenementen-API", "api", "realiseert", "archimate05", "Evenementen-API", "app-interface"],
  ["diagram05", "Evenementaanvraag", "entiteit", "realiseert", "archimate05", "Evenementaanvraag", "business-object"],
  ["dmnDrd05", "Risicoklasse", "decision", "realiseert", "archimate05", "Risicoklasse bepalen", "app-service"],
  ["componentDeployment05", "Evenementenregister", "component", "realiseert", "archimate05", "Evenementenregister", "app-component"],
  ["sequence05", "Evenementen-API", "levenslijn", "heeft te maken met", "oas05", "Evenementen-API", "api"],
  ["wsdl05", "AdviesPortType", "portType", "heeft te maken met", "bpmnMotor05", "Ontvang advies brandweer", "taak"],
  // Eisen en toegang
  ["dmnDrd05", "Risicoklasse", "decision", "realiseert", "requirements05", "Uitlegbare risicoklasse", "requirement"],
  ["usecase05", "Vraag evenementenvergunning aan", "usecase", "realiseert", "requirements05", "Digitaal aanvragen", "requirement"],
  ["usecase05", "Volg de status van de aanvraag", "usecase", "realiseert", "requirements05", "Status volgen", "requirement"],
  ["toegangsregels", "de evenementaanvraag", "gegevensselectie", "heeft te maken met", "diagram05", "Evenementaanvraag", "entiteit"],
  ["toegangsregels", "de contactgegevens van de organisator", "gegevensselectie", "heeft te maken met", "diagram05", "Contactgegevens", "gegevenselement"],
  ["cmmn05", "Bezwaar evenementenvergunning", "case-plan", "realiseert", "usecase05", "Dien bezwaar in", "usecase"],
  ["business05", "Evenementenvergunning verlenen", "proces", "heeft te maken met", "archimate05", "Evenementaanvraag behandelen", "business-proces"],
];

// Doorklikken: [profiel, element, type, doelprofiel, diagramnaam]
const DOORKLIK = [
  ["usecase05", "Bepaal de risicoklasse", "usecase", "dmnDrd05", "Risicoklasse en leges"],
  ["usecase05", "Beoordeel de aanvraag", "usecase", "bpmnMotor05", "Evenementaanvraag behandelen"],
  ["usecase05", "Vraag evenementenvergunning aan", "usecase", "activity05", "Aanvraag indienen (activity)"],
  ["usecase05", "Geef veiligheidsadvies", "usecase", "bpmnMotor05", "Veiligheidsadviezen inwinnen"],
  ["usecase05", "Dien bezwaar in", "usecase", "cmmn05", "Bezwaar tegen een evenementenvergunning (casus)"],
  ["usecase05", "Volg de status van de aanvraag", "usecase", "statemachine05", "Levensloop van een evenementaanvraag"],
  ["bpmnMotor05", "Bepaal risicoklasse", "taak", "dmnDrd05", "Risicoklasse en leges"],
  ["bpmnMotor05", "Bereken leges", "taak", "dmnDrd05", "Risicoklasse en leges"],
  ["bpmnMotor05", "Win veiligheidsadviezen in", "taak", "bpmnMotor05", "Veiligheidsadviezen inwinnen"],
  ["dmnDrd05", "Evenementaanvraag", "inputData", "diagram05", "Evenementen (canoniek)"],
  ["archimate05", "Evenementaanvraag behandelen", "business-proces", "bpmnMotor05", "Evenementaanvraag behandelen"],
  ["archimate05", "Evenementen-API", "app-interface", "oas05", "Evenementen-API (OAS 3.1)"],
  ["archimate05", "Evenementaanvraag", "business-object", "diagram05", "Evenementen (canoniek)"],
  ["archimate05", "Beslisservice (DMN)", "app-component", "dmnDrd05", "Risicoklasse en leges"],
  ["sequence05", "Evenementen-API", "levenslijn", "oas05", "Evenementen-API (OAS 3.1)"],
  ["toegangsregels", "de evenementaanvraag", "gegevensselectie", "diagram05", "Evenementen (canoniek)"],
  ["formulierdiagram", "Aanvraag evenementenvergunning", "formulier", "diagram05", "Evenementen (canoniek)"],
];

export default (proj, { zoek }) => {
  const links = VERBANDEN.map(([vp, vn, vt, soort, np, nn, nt]) => {
    const rij = { profielId: vp, elementId: zoek(vp, vn, vt).id };
    const kolom = { profielId: np, elementId: zoek(np, nn, nt).id };
    return { id: `${rij.profielId}::${rij.elementId}##${kolom.profielId}::${kolom.elementId}`, rij, kolom, soort, omgekeerd: false };
  });
  const perProfiel = {};
  for (const [p, naam, type, dp, diagram] of DOORKLIK) {
    const el = (perProfiel[p] ||= {})[zoek(p, naam, type).id] || zoek(p, naam, type);
    const d = Object.values(proj.profielen[dp].diagrams).find((x) => x.naam === diagram);
    if (!d) throw new Error(`doorklik: diagram "${diagram}" bestaat niet in ${dp}`);
    perProfiel[p][el.id] = { ...el, data: { ...el.data, verwijstNaar: { profielId: dp, diagramId: d.id } } };
  }
  return [
    ...Object.entries(perProfiel).map(([p, zet]) => ({ store: `model:${p}`, op: "patchElementen", args: [{ zet, wis: [] }] })),
    { store: "kruis", op: "patchLinks", args: [{ zet: links, wis: [] }] },
  ];
};
