// @ts-check
/**
 * bpmnGzacRegels — **engine-regelset** "BPMN-profiel → uitvoerbare BPMN voor
 * GZAC" (Valtimo op Operaton, het Camunda 7-dialect). Data, geen code: wat de
 * schrijver (`transformatie/bpmnXmlSchrijver.js`) per taaksoort extra schrijft
 * zodat de engine het proces kan uitvoeren. Een andere engine is een andere
 * regelset; het model blijft gelijk.
 *
 * Wat GZAC zelf bindt, staat niet in de XML: plugin-acties (zaak aanmaken,
 * status zetten, document koppelen) en taakformulieren hangen in de
 * process-links van de dossierbundel aan de activityId (FUNDAMENT 30-10). Een
 * servicetaak krijgt daarom alleen een lege expressie `${true}`, zodat de
 * engine hem kan uitvoeren; de process-link voert de actie uit.
 *
 * Proceskoppeling (0.5.0, Mark 05-11): de process-link van een proces is een
 * eigen artefact (`procesLinkArtefact.js`). Een gebruikerstaak met een
 * `formulier` krijgt een formulierkoppeling; `proceskoppeling.formulier` is
 * het sjabloon.
 *
 * Acties (0.6.0, Mark 05-11): een servicetaak zegt in het model wat hij doet
 * (`actie`: zaak aanmaken, rol koppelen, document koppelen, zaakstatus
 * zetten). `proceskoppeling.plugin` vertaalt dat naar de plugin-actie van GZAC
 * en zijn eigenschappen. De dossierstatus die een taak zet, is een waarde uit
 * de statuslijst van het canonieke model; de sleutel in GZAC is die waarde met
 * koppeltekens (`{dossierstatus|kebab}`).
 *
 * Losse processen (Mark 30-10): oppakken is de brug tussen aanvraag en zaak en
 * eindigt bij de zaak; behandelen start zelfstandig op een bericht (message
 * start event). Het werpende event correleert dat bericht via de engine-API,
 * met dezelfde businessKey (= het dossier), zodat Valtimo het nieuwe proces aan
 * hetzelfde dossier koppelt (FUNDAMENT, proef op cg-test 30-10). Een call
 * activity zou het oppakproces laten wachten tot de behandeling klaar is.
 *
 * Ontvankelijkheid (0.4.0, Mark 30-10): een businessRuleTask leest een
 * beslistabel (dmn-artefact) met een vaste decisionRef; de invoer van de tabel
 * komt als input-parameters uit het dossier (JSON-pointer, uit de traceregels
 * van het objecttype) of is al een procesvariabele (bv. bsn van de
 * Verzoek-plugin). Een servicetaak met `dossierstatus` zet de interne status
 * van het dossier (FUNDAMENT 30-10).
 *
 * Bron van de keuzes: de handgemaakte processen gehandicaptenparkeerkaart-
 * beoordelen en aanvraag-oppakken (artefacten 6 en 7) die al op cg-test
 * draaiden.
 */

export const BPMN_NAAR_GZAC = {
  id: "bpmn-naar-gzac",
  versie: "0.7.0",
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
      // Uit het model: `{veld}` = data.veld, letterlijk vervangen (${…} blijft staan).
      // De dossierstatus is een waarde uit de statuslijst van het model; GZAC krijgt hem als sleutel met koppeltekens.
      uitData: [{ als: "dossierstatus", attributen: { "camunda:expression": "${documentDelegateService.setInternalStatus(execution, '{dossierstatus|kebab}')}" } }],
    },
    businessRuleTask: {
      // Valtimo's exporter zoekt de beslistabel op sleutel op, net als bij calledElement.
      vasteSleutel: true,
      attributen: { "camunda:mapDecisionResult": "singleResult" },
      uitData: [{ als: "beslissing", attributen: { "camunda:decisionRef": "{beslissing}", "camunda:resultVariable": "{resultaat}" } }],
      // Per kolom van de beslistabel die uit het dossier komt een input-parameter.
      invoer: {
        tag: "camunda:inputOutput",
        parameter: "camunda:inputParameter",
        dossier: '${documentDelegateService.findValueByJsonPointerOrDefault("{pointer}", execution, null)}',
        // 0.4.1: ook een procesvariabele expliciet, want feel-scala faalt op een
        // ontbrekende variabele ("no variable found"); getVariable geeft dan null
        // (FUNDAMENT 31-10: bsn staat niet altijd in het verzoek).
        variabele: "${execution.getVariable('{variabele}')}",
      },
    },
    callActivity: {
      // Nog toegestaan, maar voor een vervolgproces is een bericht (hieronder) beter.
      // Het aangeroepen proces draait op hetzelfde dossier (businessKey); welke variabelen
      // erheen en terug gaan, zegt het model (variabelen, hieronder).
      asyncAfter: true,
      // 0.2.0 (uitrol 26, FUNDAMENT 30-10): calledElement moet een vaste proces-id
      // zijn. Operaton voert een expressie wel uit, maar de export van de
      // dossierbundel (Valtimo ProcessDefinitionExporter) zoekt het aangeroepen
      // proces op sleutel op en faalt dan.
      vasteSleutel: true,
      extensies: [{ tag: "camunda:in", attributen: { businessKey: "#{execution.processBusinessKey}" } }],
      // 0.7.0 (FUNDAMENT 08-11): welke variabelen erheen en terug, uit data.aangeroepenIn /
      // data.aangeroepenUit ("a, b:c" of "alle"). Leeg erheen = alle (zoals vóór 0.7.0), leeg terug = niets.
      variabelen: { in: "camunda:in", uit: "camunda:out", standaardIn: "alle" },
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
  /**
   * Proceskoppeling (process-link): per taak wat GZAC eraan hangt. De schrijver
   * zet `activityId` voorop en `formDefinitionName` tussen `voor` en `na` (de
   * volgorde van de Valtimo-export). `subtitles` is een lege lijst: zo geeft
   * GZAC hem terug, en met null zou elke uitrol "bijgewerkt" melden
   * (FUNDAMENT 05-11).
   */
  proceskoppeling: {
    formulier: {
      voor: { activityType: "bpmn:UserTask:create" },
      na: { viewModelEnabled: false, formDisplayType: "panel", formSize: "large", subtitles: [], processLinkType: "form" },
    },
    /**
     * Servicetaak met een `actie` → plugin-koppeling: activityId, `voor`,
     * pluginConfigurationId, pluginDefinitionKey, pluginActionDefinitionKey,
     * actionProperties en `na`. Dat is de vorm die GZAC zelf teruggeeft
     * (met referenceType, pluginDefinitionKey en actionResultMappings), zodat
     * een uitrol zonder wijziging "ongewijzigd" meldt (FUNDAMENT 05-11).
     *
     * In een eigenschap staat `pv:<naam>` voor een procesvariabele die de
     * Verzoek-plugin bij het oppakken zet (RSIN, zaaktype, roltype, initiator,
     * document). `{zaaktype}`, `{volgnummer}` en `{toelichting}` vult de
     * schrijver in; een plaatshouder met een dollarteken lost de uitrol per
     * omgeving op.
     */
    plugin: {
      voor: { activityType: "bpmn:ServiceTask:start", processLinkType: "plugin", referenceType: "FIXED" },
      // De Zaken API-plugin: de configuratie in de omgeving (plaatshouder) en de sleutel van de plugin.
      configuratie: "${PLUGINCONFIG_ID:zakenapi}",
      definitie: "zakenapi",
      na: { actionResultMappings: [] },
      acties: {
        zaakAanmaken: {
          actie: "create-zaak",
          eigenschappen: { rsin: "pv:RSIN", zaaktypeUrl: "pv:zaakTypeUrl" },
        },
        rolKoppelen: {
          actie: "create-natuurlijk-persoon-zaak-rol",
          // De rol is een roltype van het zaaktype. De regelset kent nu alleen
          // de initiator: een natuurlijk persoon (BSN) uit het verzoek, waarvan
          // de Verzoek-plugin het roltype als procesvariabele aanlevert.
          doel: { soort: "rol", alleenGeneriek: "initiator" },
          eigenschappen: { roltypeUrl: "pv:rolTypeUrl", rolToelichting: "pv:rolDescription", inpBsn: "pv:initiatorValue" },
        },
        documentKoppelen: {
          actie: "link-document-to-zaak",
          eigenschappen: { documentUrl: "pv:documentUrl" },
        },
        zaakstatusZetten: {
          actie: "set-zaakstatus",
          // De status is een statustype van het zaaktype; het volgnummer volgt de volgorde in de e-dienst.
          doel: { soort: "status" },
          eigenschappen: { statustypeUrl: "${STATUSTYPE_URL:{zaaktype}:{volgnummer}}", statustoelichting: "{toelichting}" },
        },
      },
    },
  },
};
