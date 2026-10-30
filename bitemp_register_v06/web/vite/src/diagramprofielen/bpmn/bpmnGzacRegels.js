// @ts-check
/**
 * bpmnGzacRegels — **engine-regelset** "BPMN-profiel → uitvoerbare BPMN voor
 * GZAC" (Valtimo op Operaton, het Camunda 7-dialect). Data, geen code: wat de
 * schrijver (`transformatie/bpmnXmlSchrijver.js`) per taaksoort extra schrijft
 * zodat de engine het proces kan uitvoeren. Een andere engine is een andere
 * regelset; het model blijft gelijk.
 *
 * Wat GZAC zelf bindt, hoort hier niet: plugin-acties (zaak aanmaken, status
 * zetten, document koppelen) en taakformulieren hangen in de process-links van
 * de dossierbundel aan de activityId (FUNDAMENT 30-10). Een servicetaak krijgt
 * daarom alleen een lege expressie `${true}`, zodat de engine hem kan
 * uitvoeren; de process-link voert de actie uit.
 *
 * Bron van de keuzes: de handgemaakte processen gehandicaptenparkeerkaart-
 * beoordelen en aanvraag-oppakken (artefacten 6 en 7) die al op cg-test
 * draaiden.
 */

export const BPMN_NAAR_GZAC = {
  id: "bpmn-naar-gzac",
  versie: "0.1.0",
  titel: "BPMN-profiel → uitvoerbare BPMN voor GZAC (Operaton, Camunda 7-dialect)",
  engine: "operaton",
  namespaces: { camunda: "http://camunda.org/schema/1.0/bpmn" },
  proces: { isExecutable: "true" },
  /** Het attribuut voor een wachtpunt ná de taak: elke servicetaak krijgt er een, bij multi-instance per instantie. */
  asyncAfter: "camunda:asyncAfter",
  /** Multi-instance: verzameling en elementvariabele (data.lusVerzameling / data.lusElement). */
  lus: { verzameling: "camunda:collection", element: "camunda:elementVariable" },
  taken: {
    userTask: {
      // Iedere ingelogde behandelaar kan de taak oppakken; rollen per taak volgen later uit het model (lanes).
      attributen: { "camunda:candidateGroups": "ROLE_USER" },
    },
    serviceTask: {
      attributen: { "camunda:expression": "${true}" },
      asyncAfter: true,
    },
    callActivity: {
      // Het aangeroepen proces draait op hetzelfde dossier (businessKey) met alle variabelen.
      asyncAfter: true,
      extensies: [
        { tag: "camunda:in", attributen: { businessKey: "#{execution.processBusinessKey}" } },
        { tag: "camunda:in", attributen: { variables: "all" } },
      ],
    },
  },
};
