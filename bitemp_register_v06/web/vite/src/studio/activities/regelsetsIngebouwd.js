// @ts-check
/**
 * regelsetsIngebouwd — meldt de regelsets uit de broncode aan bij de catalogus
 * (`transformatie/regelsetCatalogus.js`), met per regelset waar hij staat en, waar dat kan, een
 * **proef**: hoe je een proefbron leest en het plan als tekst schrijft (TRANS-1 stap 1).
 *
 * Proefdraaien kan nu voor regelsets met één bron: geplakte tekst (Mermaid, BPMN-XML, DMN-XML, ODRL in Turtle) of
 * een map uit het project (use case-model). De regelsets met een samengestelde bron (canoniek
 * model + e-dienst + referentielijst) en Toegangsspraak → ODRL zijn te bekijken; hun proefbron
 * vraagt het bereik van TRANSFORMATIES.md §4 en volgt later.
 *
 * Geen stores: dit bestand is in de node-testrunner te laden.
 */
import { registreerRegelset } from "../../transformatie/regelsetCatalogus.js";
import { leesMermaidFlowcharts } from "../../transformatie/mermaidFlowchart.js";
import { planNaarMermaid } from "../../transformatie/mermaidSchrijver.js";
import { leesBpmn } from "../../transformatie/bpmnXml.js";
import { leesDmn } from "../../transformatie/dmnXml.js";
import { MERMAID_NAAR_USECASE } from "../../diagramprofielen/usecase/mermaidRegels.js";
import { USECASE_NAAR_MERMAID } from "../../diagramprofielen/usecase/mermaidExportRegels.js";
import { BPMN_XML_NAAR_BPMN } from "../../diagramprofielen/bpmn/bpmnXmlRegels.js";
import { BPMN_NAAR_GZAC } from "../../diagramprofielen/bpmn/bpmnGzacRegels.js";
import { BPMN_SCHRIJVER_SCHEMA } from "../../diagramprofielen/bpmn/bpmnSchrijverSchema.js";
import { DMN_XML_NAAR_DRD } from "../../diagramprofielen/dmn-drd/dmnXmlRegels.js";
import { CANONIEK_NAAR_OBJECTTYPE } from "../../diagramprofielen/canoniek-uml/objecttypeRegels.js";
import { CANONIEK_NAAR_FORMULIER } from "../../diagramprofielen/canoniek-uml/formulierRegels.js";
import { CANONIEK_NAAR_ZAAKTYPE } from "../../diagramprofielen/canoniek-uml/zaaktypeRegels.js";
import { CANONIEK_NAAR_DOSSIER } from "../../diagramprofielen/canoniek-uml/dossierRegels.js";
import { DOSSIER_SCHRIJVER_SCHEMA, ZAAKTYPE_SCHRIJVER_SCHEMA } from "../../diagramprofielen/canoniek-uml/inrichtingSchemas.js";
import { TOEGANGSSPRAAK_NAAR_ODRL_AP_NL } from "../../toegangsspraak/odrlApNlRegels.js";
import { ODRL_AP_NL_NAAR_TOEGANGSSPRAAK } from "../../toegangsspraak/odrlNaarToegangsspraakRegels.js";
import { toegangsspraakNaarOdrl } from "../../toegangsspraak/odrlExport.js";
import { odrlBrongraaf } from "../../toegangsspraak/odrlImport.js";
import { planNaarBeleid } from "../../toegangsspraak/odrlNaarBeleid.js";
import { renderBeleid } from "../../toegangsspraak/renderer.js";
import { VOORBEELD_BELEID } from "../../toegangsspraak/voorbeeld.js";
import { leesTurtle } from "../../transformatie/turtleLezer.js";

const MERMAID_VOORBEELD = `flowchart LR
  klant((Klant))
  subgraph Webwinkel
    bestellen([Bestelling plaatsen])
    betalen([Betalen])
  end
  klant --> bestellen
  bestellen -. include .-> betalen
`;

const BPMN_VOORBEELD = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="proef" targetNamespace="http://example.org/proef">
  <process id="p1" name="Aanvraag behandelen">
    <startEvent id="start" name="Aanvraag ontvangen" />
    <userTask id="beoordelen" name="Beoordelen" />
    <endEvent id="einde" name="Afgehandeld" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="beoordelen" />
    <sequenceFlow id="f2" sourceRef="beoordelen" targetRef="einde" />
  </process>
</definitions>
`;

const DMN_VOORBEELD = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="proef" name="Proef" namespace="http://example.org/proef">
  <inputData id="leeftijd" name="Leeftijd" />
  <decision id="korting" name="Korting">
    <informationRequirement id="r1"><requiredInput href="#leeftijd" /></informationRequirement>
  </decision>
</definitions>
`;

const SAMENGESTELD = "De bron is samengesteld (canoniek model, e-dienst en soms een referentielijst); proefdraaien hier volgt met het bereik van een transformatie.";

registreerRegelset(MERMAID_NAAR_USECASE, {
  richting: "import",
  bestand: "diagramprofielen/usecase/mermaidRegels.js",
  proef: { soort: "tekst", lees: (tekst) => leesMermaidFlowcharts(tekst), voorbeeld: MERMAID_VOORBEELD, uitleg: "Plak een Mermaid flowchart." },
});
registreerRegelset(USECASE_NAAR_MERMAID, {
  bestand: "diagramprofielen/usecase/mermaidExportRegels.js",
  proef: { soort: "map", profielId: "usecase05", schrijf: (plan) => planNaarMermaid(plan, { titel: "proef" }), uitleg: "Kies een map met een use case-model, of het hele model." },
});
registreerRegelset(BPMN_XML_NAAR_BPMN, {
  richting: "import",
  bestand: "diagramprofielen/bpmn/bpmnXmlRegels.js",
  proef: { soort: "tekst", lees: (tekst, opties) => [leesBpmn(tekst, opties)], voorbeeld: BPMN_VOORBEELD, uitleg: "Plak BPMN 2.0 XML." },
});
registreerRegelset(DMN_XML_NAAR_DRD, {
  richting: "import",
  bestand: "diagramprofielen/dmn-drd/dmnXmlRegels.js",
  proef: { soort: "tekst", lees: (tekst, opties) => [leesDmn(tekst, opties)], voorbeeld: DMN_VOORBEELD, uitleg: "Plak DMN XML." },
});
registreerRegelset(TOEGANGSSPRAAK_NAAR_ODRL_AP_NL, {
  bestand: "toegangsspraak/odrlApNlRegels.js",
  proef: null,
});
// De terugweg. Het plan wordt hier uit de structuur een beleid in klare taal (de bouwer); de
// import zelf (toegangsspraak/odrlImport.js) neemt daarnaast de meegegeven brontekst over als die klopt.
registreerRegelset(ODRL_AP_NL_NAAR_TOEGANGSSPRAAK, {
  richting: "import",
  bestand: "toegangsspraak/odrlNaarToegangsspraakRegels.js",
  proef: {
    soort: "tekst",
    lees: (tekst) => [odrlBrongraaf(leesTurtle(tekst)).graaf],
    schrijf: (plan) => {
      const { beleid } = planNaarBeleid(plan);
      return beleid ? renderBeleid(beleid) : "";
    },
    get voorbeeld() {
      return toegangsspraakNaarOdrl(VOORBEELD_BELEID).turtle;
    },
    uitleg: "Plak ODRL in Turtle (ODRL-AP-NL).",
  },
});
registreerRegelset(CANONIEK_NAAR_OBJECTTYPE, { richting: "inrichting", bestand: "diagramprofielen/canoniek-uml/objecttypeRegels.js" });
registreerRegelset(CANONIEK_NAAR_FORMULIER, { richting: "inrichting", bestand: "diagramprofielen/canoniek-uml/formulierRegels.js" });
registreerRegelset(CANONIEK_NAAR_ZAAKTYPE, { richting: "inrichting", bestand: "diagramprofielen/canoniek-uml/zaaktypeRegels.js", schema: ZAAKTYPE_SCHRIJVER_SCHEMA, schrijver: "zaaktype-schrijver (diagramprofielen/canoniek-uml/zaaktypeArtefact.js)" });
registreerRegelset(CANONIEK_NAAR_DOSSIER, { richting: "inrichting", bestand: "diagramprofielen/canoniek-uml/dossierRegels.js", schema: DOSSIER_SCHRIJVER_SCHEMA, schrijver: "dossierbundel-schrijver (diagramprofielen/canoniek-uml/dossierArtefact.js)" });
// Een stand van de BPMN-schrijver: het schema hoort bij de schrijver (de motor), niet bij GZAC.
registreerRegelset(BPMN_NAAR_GZAC, { richting: "inrichting", bestand: "diagramprofielen/bpmn/bpmnGzacRegels.js", schema: BPMN_SCHRIJVER_SCHEMA, schrijver: "BPMN-schrijver (transformatie/bpmnXmlSchrijver.js)" });

/** Waarom een regelset (nog) geen proefbron heeft, voor het scherm. */
export function geenProefUitleg(vermelding) {
  if (vermelding?.vorm === "instellingen") {
    return vermelding.schema
      ? "Dit is een stand van een schrijver: de instellingen waarmee hij het model in de map omzet. Er zijn geen regels om proef te draaien."
      : "Deze regelset bestaat uit instellingen die een schrijver leest; er zijn geen regels om proef te draaien. De instellingen hebben nog geen beschrijving, dus je ziet ze als JSON.";
  }
  if (vermelding?.regelset?.id === TOEGANGSSPRAAK_NAAR_ODRL_AP_NL.id) return "De bron is een toegangsbeleid uit Toegangverlening; proefdraaien hier volgt.";
  return SAMENGESTELD;
}
