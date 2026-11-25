# Cedar als M2: profiel en vertaling via Toegangsspraak (plan)

Status 25-11-2026: **fase 1 gebouwd** (branch `feat/cedar-profiel`), fase 2 en 3 open.
Opdracht van Mark (25-11), op voorstel van de sessie ODRL.

## Aanleiding

Op het fieldlab-cluster draait Open FTV (Digilab). De PAP daar beheert toegangsbeleid in **Cedar**:
de PABC-policies (functionele rol → applicatierollen, per domein of voor alle entiteittypen). Mark
wil Cedar en ODRL in beide richtingen kunnen vertalen.

Aanpak: Cedar wordt een **extra notatie** (M2-descriptor plus adapter, geen motorwerk), met
**Toegangsspraak als spil**. Dus niet rechtstreeks Cedar ↔ ODRL, maar Cedar ↔ Toegangsspraak, en
naar ODRL via de bestaande keten Toegangsspraak → ODRL-AP-NL (TRANSFORMATIES.md §8).

## Besluiten

| Wat | Besluit |
|---|---|
| Lezer en schrijver | **Eigen JS**, geen `@cedar-policy/cedar-wasm`. De officiële parser (4.15) weigert alle PABC-policies: die schrijven een actie als `name::"zaakafhandelcomponent/behandelaar"`, terwijl Cedar een actie van type `Action` eist (`name::Action::"…"`). Open FTV gebruikt cedar-go v1.8.0 (go.mod), dat het wel aanneemt. De eigen lezer leest beide en geeft dezelfde EST als cedar-wasm (gecontroleerd); de adapter meldt de afwijking en verandert de vorm niet. Bijkomend: geen 4,4 MB wasm in de Studio. cedar-wasm kan later terug als optionele strikte controle. |
| Opslag | Per policy de **Cedar-tekst** (het bewerkvlak) en de **EST** (JSON-vorm van Cedar), die eruit volgt. Ongewijzigd terugschrijven geeft dezelfde bytes. |
| Schema | Lezen als Cedar-schema (JSON). PABC heeft **geen schema** (de PDP draait zonder; de entiteiten komen per verzoek via AuthZEN). Dan leidt de adapter het af uit de policies: typen uit de scope, attributen en hun type uit de condities, acties met appliesTo. Gemarkeerd als `afgeleid`. |
| Applicatierollen ↔ handelingen | **Eigen actielijst in het profiel** (Mark 25-11), geen vaste tabel met werkwoorden: de acties uit het schema (of afgeleid) zijn de woordenschat. Fase 2. |
| `contains` ↔ "is" | "Is" op een kenmerk met meer waarden betekent "heeft de rol / één van de waarden is" (Mark 25-11); `contains` is de programmeervorm. Vastgelegd in TOEGANGSSPRAAK.md; de vertaling in fase 2. |
| Betrokkene → `resource.<attr>` | In fase 1 en 2 weggelaten, met een melding: bij registerpaden als entiteiten is het record niet de resource. Later met Mark. |
| Testdata | **Verzonnen** PABC-vormige policies in `diagramprofielen/cedar/fixtures/` (rollen en domeinen bedacht). De echte 26 PABC-policies staan in de privé-repo van Fundament en komen niet in deze (publieke) repo; een test leest ze alleen lokaal en slaat over als het bestand er niet is. |
| Grenzen | Geen koppeling met de PAP (lezen of schrijven via `/v1/policies`): dat loopt later via FUNDAMENT, schrijven alleen met akkoord van Mark. Geen wijzigingen in `toegang/`, `pep/`, `bundel.js` (van de sessie ODRL). De Go-PDP blijft de uitvoerder; Cedar is een uitwisselvorm. |

## Fase 1: profiel en adapter (gebouwd 25-11)

`web/vite/src/diagramprofielen/cedar/`:

- `lezer.js`: Cedar-tekst → EST (scope, annotaties, condities; volledige expressiegrammatica:
  voorrang, `has` met pad, `like`, `is … in`, methoden, extensies, records, sets, `if`). Fouten met
  regel en kolom. Per policy ook de letterlijke tekst.
- `schrijver.js`: EST → tekst in de PABC-opmaak (scope op drie regels, inspringing 4, `&&` aan het
  eind van de regel; een conditie die alleen een waarde is op één regel); EST → JSON-policyset.
- `index.js`: de M2-descriptor. Elementen: **policy** («permit»/«forbid», de regels in de kaart
  afgeleid uit de EST), **entiteittype** (attributen als regels), **actie**, **commontype**, kader.
  Connectoren: **in** (memberOf/memberOfTypes), **appliesTo** (rol principal/resource), en
  **scope**: afgeleid van policy naar entiteittype en actie (`leidAf` in `hooks.migreerModel`,
  zoals bij SHACL). Een gewijzigde Cedar-tekst wordt opnieuw gelezen; een leesfout staat in de kaart.
- `adapter.js`: in (`vanCedar`): Cedar-tekst, Cedar-JSON (policyset, policy, schema) of een Open
  FTV-policylijst (de bewaarde velden gaan ongewijzigd terug). Uit (`naarCedar`): tekst, JSON,
  Open FTV-lijst, schema. Meldingen: actie niet van type Action (één keer per type), een policy
  die nooit geldt (`when { false }`), templates, het afgeleide schema.
- `cedarRegistry.js`: import en vier exports in het transformatiepaneel. De activiteit
  `studio/activities/cedarActivity.jsx` (preview, niet in de balk) met importmenu en export als tekst.
- Aangesloten in de render-bundel (`render-svc/studioProfielen.js`, profielversie `cedar05` 1.0.0)
  en in `tools/omnium-mcp/profielen.json`.

Getest:

- `cedar.test.js` (10 tests):
  - de lezer tegen de EST van cedar-wasm 4.15: 8/8 policies gelijk, ook de sleutelvolgorde;
  - wat de schrijver schrijft, leest cedar-wasm terug als dezelfde EST (8/8);
  - de PABC-vorm komt byte voor byte terug, ook opnieuw geschreven uit de EST;
  - de Open FTV-lijst gaat heen en terug, byte voor byte;
  - een gewijzigde policy wordt opnieuw gelezen; een leesfout staat in de kaart;
  - het schema gaat heen en terug;
  - lokaal: alle 26 echte PABC-policies gaan heen en terug; de enige verschillen zijn CRLF en het
    regeleinde aan het eind.
- e2e `81-studio-cedar` en `46-studio-shacl-import` (8/8).
- render-svc: 49/49.
- Alle unit-tests: 1932.

## Fase 2: Cedar ↔ Toegangsspraak (open)

In de transformatievorm lezer → regelset → toepasser (zoals Toegangsspraak → ODRL-AP-NL):

- regel toestemming ↔ permit, verbod ↔ forbid;
- subject met rol ↔ `principal is <type> when principal.<rollen>.contains("x")`; het attribuut
  komt uit het schema;
- handeling ↔ een actie uit de actielijst van het profiel;
- gegevens (registerpad, "dekt het pad en alles eronder") ↔ `resource in Pad::"…"`, met elk
  registerpad als entiteit met ouders. Voor PABC: `resource is pabc_entiteittype when
  resource.domeinen.contains("d")`;
- voorwaarde op de aanvraag ↔ `context.*`; `Doel:` in de kop ↔ `context.doel == "…"` op elke permit;
- standaard weigeren = Cedar; standaard toestaan → `permit(principal, action, resource)` plus de
  forbids; "verbod wint" = Cedar;
- niet te vertalen, als melding in de trace of het verliesrapport: "toestemming wint", "eerste
  geldt", plichten (hooguit als annotatie), de assigner, en `if`/rekenen/`like`/extensies in
  condities.

Begin met het PABC-patroon, dat zonder verlies heen en terug gaat:
- functionele rol → applicatierollen voor alle entiteittypen;
- voor één domein;
- voor een applicatie zonder entiteittype.

De proef van de sessie ODRL met de 26 policies:
- 25 passen in het patroon;
- ze geven één Toegangsspraak-beleid met 55 regels;
- de ODRL-AP-NL-export geeft geen meldingen;
- terug naar Cedar komt byte voor byte dezelfde tekst;
- het uitgezette startbeleid past niet.

Vorm uit de proef van de sessie ODRL (scratch `pabc/omzetten.mjs`, niet in de repo):

- **Heen.** Eén beleid "PABC" met `Standaard: weigeren`. De begrippen zijn:
  - "Entiteittypen zijn: alle gegevens van een pabc entiteittype.";
  - "Applicaties zijn: …".

  Per policy en per actie komt er één regel, want een Toegangsspraak-regel heeft één handeling:
  `Regel "<policy-id> <actie>". Iemand met rol "<rol>" mag de entiteittypen|applicaties <handeling>`.
  Daarbij komt eventueel `als de domeinen van de betrokkene "<d>" is`, of `als de naam van de
  betrokkene "zaakafhandelcomponent" is`. De rol staat in de zin zelf; er zijn geen verzonnen
  begripsnamen nodig.
- **Handeling.** De parser eist één woord. `zaakafhandelcomponent/behandelaar` kan dus niet
  letterlijk in de zin. Per actie in de actielijst is een woord (label) nodig, met de koppeling
  naar het id van de actie.
- **Terug.** De regels worden gegroepeerd op policy-id, de acties staan in de volgorde van de
  regels, en `@reason` wordt opnieuw opgebouwd uit het patroon. Uitkomst in de proef: 25/25 byte
  voor byte gelijk.
- **Niet in de proef:**
  - titel, beschrijving, regeling en pdps van de Open FTV-lijst. Die leiden we af uit het
    patroon, of we bewaren ze via de herkomst;
  - het startbeleid met `when { false }`. Dat moet een melding geven en mag niet stil wegvallen.
- **Doel.** Een beleid met `Doel:` wordt `context.doel == "…"` op elke permit. PABC zelf heeft
  geen doel.

## Fase 3: Cedar → ODRL via Toegangsspraak (open)

Cedar → Toegangsspraak (fase 2) → ODRL-AP-NL (bestaande regelset `odrlApNlRegels.js`; de rol als
`apnl:rolAanvrager` in een verfijning op de handeling). Controle met pyshacl tegen de SHACL-kern
(`model-exchange/linked-data/odrl22-kern.shacl.ttl`).

## Open

- Een Cedar-schema als tekst (`.cedarschema`) inlezen en schrijven; nu alleen JSON.
- Templates (`?principal`): nu bewaard als tekst, niet gemodelleerd.
- Of cedar-go de PABC-acties echt goed beslist, is niet nagegaan. De sessie ODRL geeft het punt
  via FUNDAMENT door aan de beheerder van pabc-ftv. Het officiële schema, als het bestaat, staat in
  pabc-ftv (`generate.py`).
