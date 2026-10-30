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
 * Losse processen (Mark 30-10): oppakken is de brug tussen aanvraag en zaak en
 * eindigt bij de zaak; behandelen start zelfstandig op een bericht (message
 * start event). Het werpende event correleert dat bericht via de engine-API,
 * met dezelfde businessKey (= het dossier), zodat Valtimo het nieuwe proces aan
 * hetzelfde dossier koppelt (FUNDAMENT, proef op cg-test 30-10). Een call
 * activity zou het oppakproces laten wachten tot de behandeling klaar is.
 *
 * Bron van de keuzes: de handgemaakte processen gehandicaptenparkeerkaart-
 * beoordelen en aanvraag-oppakken (artefacten 6 en 7) die al op cg-test
 * draaiden.
 */

export const BPMN_NAAR_GZAC = {
  id: "bpmn-naar-gzac",
  versie: "0.3.0",
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
      // Nog toegestaan, maar voor een vervolgproces is een bericht (hieronder) beter.
      // Het aangeroepen proces draait op hetzelfde dossier (businessKey) met alle variabelen.
      asyncAfter: true,
      // 0.2.0 (uitrol 26, FUNDAMENT 30-10): calledElement moet een vaste proces-id
      // zijn. Operaton voert een expressie wel uit, maar de export van de
      // dossierbundel (Valtimo ProcessDefinitionExporter) zoekt het aangeroepen
      // proces op sleutel op en faalt dan.
      vasteSleutel: true,
      extensies: [
        { tag: "camunda:in", attributen: { businessKey: "#{execution.processBusinessKey}" } },
        { tag: "camunda:in", attributen: { variables: "all" } },
      ],
    },
  },
  berichten: {
    // Werpend bericht-event (intermediate throw of end event): start het proces
    // met het message start event van die naam, op hetzelfde dossier. Alle
    // procesvariabelen gaan mee (zoals camunda:in variables="all" bij de call
    // activity); een smallere overdracht kan later per bericht.
    werpen: {
      asyncAfter: true,
      definitie: {
        "camunda:expression":
          "${execution.getProcessEngineServices().getRuntimeService().createMessageCorrelation('{bericht}')" +
          ".processInstanceBusinessKey(execution.getProcessBusinessKey()).setVariables(execution.getVariables()).correlateStartMessage()}",
      },
    },
  },
};
