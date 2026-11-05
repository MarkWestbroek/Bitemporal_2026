# Servicetaken en dossierstatus uit het model (voorstel en besluit, 2026-11-05)

Aanleiding: Mark (05-11) over het handwerk in de GZAC-dossierbundel van de GPK:
"handwerk is goed, maar met het idee van automatisering vanuit het model in
gedachten. Wat doe je daar precies met de hand, en hoe zou dat uit het model
kunnen komen via een transformatie?"

Stap 1 is gebouwd (TRANSFORMATIES §11.9 en §11.13): de dossierdefinitie, de
processen bij het dossier, de documentkolommen en de formulierkoppeling van een
gebruikerstaak komen nu uit de e-dienst en het BPMN-model. Dit voorstel gaat
over stap 2: de twee bestanden die FUNDAMENT nog met de hand maakt, omdat het
model de kennis nog niet heeft.

| Bestand in de bundel | Wat er met de hand in staat |
|---|---|
| `process-link/aanvraag-oppakken.process-link.json` | wat de vier servicetaken doen, als plugin-acties van GZAC |
| `case/internal-status/gehandicaptenparkeerkaart.internal-case-status.json` | de dossierstatus "Niet opgepakt", met titel en kleur |

Het voorstel raakt hoe een proces gemodelleerd wordt, dus Mark besliste eerst.

## 0. Besluit (Mark, 2026-11-05)

Mark is akkoord met het advies op alle zes de vragen; het is daarna gebouwd
(TRANSFORMATIES §11.9 en §11.13).

| # | Vraag | Besluit |
|---|---|---|
| 1 | Actie als eigenschap of een eigen taaksoort? | Eigenschap `actie` op de servicetaak. |
| 2 | Waar hoort de lijst acties? | Nu als optioneel veld in het BPMN-profiel; later een aanvulling "zaakgericht werken", als er een tweede domein met eigen acties komt. |
| 3 | Verwijzen op naam of naar een modelelement? | Nu op naam (rol "Aanvrager", status "Ontvangen" in het zaaktype van de e-dienst). Via de uuid kan pas als het zaaktype zelf een model is. |
| 4 | Is de status van de aanvraag die van het dossier? | Ja, één lijst: `AanvraagStatus` in het canonieke model. |
| 5 | De statussen van de zaak (ZGW) ook uit het model? | Nu niet. |
| 6 | Welke sleutel in GZAC? | `niet-in-behandeling`, afgeleid uit de waarde in het model; FUNDAMENT voert `niet-opgepakt` af. |

Wat anders is uitgevallen dan in het voorstel hieronder:

- De actie "dossierstatus zetten" is geen aparte actie: de taak houdt zijn veld
  `dossierstatus`, nu met een waarde uit de statuslijst.
- De rol bij "rol koppelen" wordt getoetst tegen het zaaktype, maar GZAC haalt
  het roltype uit een procesvariabele van de Verzoek-plugin. De regelset kent
  daarom alleen de initiator.
- De titel van een status komt uit de naam van de waarde; de statuslijst in het
  model heeft geen beschrijving per waarde.

De tekst hieronder is het voorstel zoals het aan Mark is voorgelegd.

## 1. Wat een servicetaak doet

### 1.1 Nu

Het BPMN-model (M1, profiel bpmn-motor) kent in het proces "Aanvraag oppakken"
vier servicetaken, maar alleen bij naam:

| Taak | Wat het handwerk eraan hangt | Gegevens in het handwerk |
|---|---|---|
| Zaak aanmaken | plugin-actie `create-zaak` | RSIN en zaaktype-url uit procesvariabelen |
| Rol aanvrager koppelen | `create-natuurlijk-persoon-zaak-rol` | roltype-url, toelichting en BSN uit procesvariabelen |
| Documenten koppelen | `link-document-to-zaak` | document-url uit een procesvariabele |
| Status Ontvangen | `set-zaakstatus` | statustype 1 van zaaktype GPK, en een toelichting |

Dat een taak "Zaak aanmaken" heet, is voor een mens genoeg, maar een
transformatie kan er niets mee. De betekenis staat alleen in het handwerk, in
termen van één engine.

### 1.2 Voorstel: een actie op de servicetaak

De servicetaak krijgt in het BPMN-profiel (M2) een eigenschap **actie**, met
waarden in gewone termen. Een actie kan één verwijzing nodig hebben.

| Actie (M2) | Verwijzing op de taak (M1) | Waar de verwijzing naar wijst |
|---|---|---|
| zaak aanmaken | geen | het zaaktype van de e-dienst |
| rol koppelen | de rol, bv. "Aanvrager" | een roltype van het zaaktype in de e-dienst |
| document koppelen | geen | de documenten van het verzoek |
| zaakstatus zetten | de status, bv. "Ontvangen" | een statustype van het zaaktype in de e-dienst |
| dossierstatus zetten | de status (zie §2) | bestaat al als `dossierstatus` |

De engine-regelset `bpmn-naar-gzac` vertaalt een actie naar de plugin-actie en
zijn eigenschappen. Dat is hetzelfde patroon als bij de beslistabel
(`decisionRef`) en de dossierstatus (`setInternalStatus`), die al zo werken.

- **Het model blijft los van de engine.** "Zaak aanmaken" is wat het proces
  doet. Welke plugin dat uitvoert en uit welke procesvariabele de RSIN komt, is
  kennis van de regelset. Een andere engine krijgt een eigen regelset op
  hetzelfde model.
- **Verwijzingen op naam worden plaatshouders.** De status "Ontvangen" is het
  eerste statustype van zaaktype GPK, dus `${STATUSTYPE_URL:GPK:1}`; de rol
  wordt `${ROLTYPE_URL:GPK:initiator}`. De plugin wordt
  `${PLUGINCONFIG_ID:zakenapi}`. De uitrol (FUNDAMENT) kent die plaatshouders
  al.
- **Toetsen.** Een rol of status die het zaaktype niet kent, is een fout. Een
  servicetaak zonder actie geeft een waarschuwing.
- **Uitkomst.** De proceskoppeling van "Aanvraag oppakken" wordt dan een
  artefact, net als die van het beoordeelproces. De lijst `activityIds` in de
  e-dienst vervalt: die bewaakt nu met de hand wat dan uit het model volgt.

### 1.3 Wat het vraagt

| Wie | Wat | Omvang |
|---|---|---|
| TRANSFORMATIES | eigenschap `actie` + verwijzing in het profiel, de regels in `bpmn-naar-gzac`, toetsen, de proceskoppeling voor servicetaken | ± 1 dag |
| OMNIUM-UI | de actie kiezen in de inspector; de rol of status kiezen uit het zaaktype van de e-dienst (nu een tekstveld) | ± ½ dag, later |
| FUNDAMENT | de proceskoppeling van oppakken registreren, het handwerk weghalen | klein |

### 1.4 Vragen aan Mark

1. **Is "actie op de servicetaak" de goede vorm?** Het alternatief is een eigen
   taaksoort per actie in het profiel (een "zaaktaak"). Dat is zichtbaarder in
   het diagram, maar maakt het profiel groter en wijkt af van BPMN.
2. **Hoe heet de lijst acties, en waar hoort hij?** De vijf acties hierboven
   zijn ZGW-acties. Ze horen niet in de kern van het BPMN-profiel. Voorstel:
   een aanvulling op het profiel ("zaakgericht werken"), zodat een proces
   buiten het zaakdomein er geen last van heeft.
3. **Verwijst de taak naar de naam van de status, of naar een modelelement?**
   Nu staan status- en roltypen alleen in de e-dienst, als tekst. Verwijzen op
   naam werkt meteen. Volgens de regel van 31-10 (links via de uuid, export op
   naam) zou het een verwijzing naar een modelelement moeten zijn, en dan
   moeten de status- en roltypen eerst zelf in een model staan.

## 2. De status van het dossier

### 2.1 Nu

Er zijn drie lijsten die over hetzelfde gaan:

| Lijst | Waar | Waarden |
|---|---|---|
| status van de aanvraag | canoniek model, `AanvraagStatus` (Mark 31-10) | ingediend, inBehandeling, nietInBehandeling, afgehandeld |
| statustypen van de zaak | e-dienst, zaaktype GPK | Ontvangen, In behandeling, Afgehandeld |
| interne status van het dossier | handwerk bij FUNDAMENT, en als tekst op een servicetaak in het BPMN-model | niet-opgepakt |

De servicetaak "Dossierstatus Niet opgepakt" zet `niet-opgepakt` als losse
tekst. Dat het dezelfde toestand is als `nietInBehandeling` in het model, staat
nergens.

### 2.2 Voorstel

- De taak verwijst naar een **waarde uit de statuslijst van het model**
  (`AanvraagStatus.nietInBehandeling`), niet naar een losse tekst.
- Een nieuw artefact `dossierstatussen` maakt de interne statussen van het
  dossier uit die lijst: de sleutel uit de waarde, de titel uit de beschrijving
  van de waarde.
- **Kleur en zichtbaarheid in de dossierlijst** zijn vormgeving. Die komen in
  de e-dienst, bij het artefact, met een standaard uit de regelset.
- Welke waarden een dossierstatus worden, kiest de e-dienst. Standaard alleen
  de waarden die een taak in een proces van de e-dienst zet; zo blijft het bij
  de GPK bij één status, zoals nu.

### 2.3 Vragen aan Mark

4. **Is de status van de aanvraag dezelfde als de status van het dossier?** Zo
   ja, dan volstaat één lijst in het model en is het hierboven de weg. Zo nee
   (het dossier is van de behandelaar, de aanvraag van de aanvrager), dan hoort
   de dossierstatus als eigen lijst in het model, in het domein `behandeling`
   (plan 30-10).
5. **Hoort de status van de zaak (ZGW) er ook bij?** "In behandeling" staat nu
   in het model én in het zaaktype. Als de statustypen van het zaaktype uit het
   model komen, verdwijnt die dubbeling ook. Dat is een grotere stap; het
   zaaktype leest nu alleen het aanvraagtype uit het model.
6. **De sleutel in GZAC.** Nu `niet-opgepakt`. Uit het model zou het
   `nietInBehandeling` of `niet-in-behandeling` worden. Een andere sleutel is
   voor GZAC een nieuwe status; FUNDAMENT moet de oude dan afvoeren.

## 3. Volgorde

1. Mark beantwoordt de vragen 1 tot en met 6.
2. Servicetaken (§1): klein en afgebakend, kan op naam beginnen.
3. Dossierstatus (§2): hangt af van vraag 4 en 5; raakt het canonieke model.

Daarna is de dossierbundel van de GPK zonder handwerk.
