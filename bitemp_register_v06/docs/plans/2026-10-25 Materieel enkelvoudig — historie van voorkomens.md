# Materieel enkelvoudig — historie van voorkomens (plan, 25-10-2026)

Aanleiding: de vraag van FUNDAMENT hoe je een nieuwe versie van een enkelvoudig gegevenselement
registreert (UitrolVerloop, straks AanvraagStatus). Onderzoek op de regressiedatabase liet twee
dingen zien; Mark besliste op 25-10-2026.

## 1. Besluiten van Mark

1. **Geen registratietype = `registratie`.** Een enkelvoudig element registreren sluit dan zijn
   voorganger formeel af. *Gebouwd* (`handlers/registration_handlers.go`, scenario 24).
2. **Een materieel én enkelvoudig element kan meerdere formeel actieve voorkomens hebben**, zoals
   een naam: iemand heeft op elk moment één naam, maar de naam kan wijzigen. Dat is een materieel
   einde van de oude en een materieel begin van de nieuwe, ook met terugwerkende kracht. Een
   statushistorie moet terug te kijken zijn: die weerspiegelt het bestaan en heeft vaak juridische
   betekenis ("aangevraagd van T1 tot T2; T2 mag niet later zijn dan T1 + x dagen").
   Bij een fout in de eerste registratie is een correctie of ongedaanmaking de juiste route.

## 2. Hoe het nu werkt (gemeten 25-10-2026)

- Een nieuw voorkomen van een enkelvoudig element (registratie) voert het vorige voorkomen
  **formeel** af: hub, `_Data`, `_Aanvang` en `_Einde` (`sluitActieveEnkelvoudigeVoorgangersAf`).
  Ook als het element materieel is en het vorige voorkomen een einde heeft.
- De database dwingt "hooguit één formeel actief voorkomen per entiteit" af
  (`ux_<tabel>_enkelvoudig_actief`, `dbsetup/createtables.go`).
- Gevolg: "wat was de status op 1 oktober?" heeft alleen een antwoord op een oud formeel
  peilmoment. Het voorbeeld van de naamswijziging in `ONTWERP_DATA_PATTERN.md` §3.3 (beide
  voorkomens formeel actief, met einde en aanvang) is niet te registreren.
- Materieel tijdreizen bestaat nog niet in de API (BACKLOG B31, `?geldig_op=`).

## 3. Wat er verandert (voorstel)

Alleen voor elementen die **materieel én enkelvoudig** zijn (GE's en relaties). Niet-materiële
enkelvoudige elementen houden het huidige gedrag (formeel afsluiten).

| | Nu | Straks |
|---|---|---|
| Nieuw voorkomen registreren | vorige formeel afgevoerd | vorige blijft formeel actief en krijgt een materieel einde |
| Enkelvoudig betekent | ≤ 1 formeel actief voorkomen | ≤ 1 voorkomen op elk materieel moment |
| Constraint op de hub | `ux_…_enkelvoudig_actief` | vervalt voor materiële hubs; materiële overlap controleert de engine (422) |
| Constraint op `_Data`/`_Aanvang`/`_Einde` per voorkomen | ≤ 1 actieve versie | ongewijzigd |
| Correctie (zelfde voorkomen, nieuwe versie) | | ongewijzigd |
| Ongedaanmaking van een opvolging | herstelt vorig voorkomen | verwijdert het nieuwe voorkomen én het automatische einde van het vorige |

Open punten voor Mark staan in §5.

## 4. Wat er geraakt wordt

- **Engine:** `handlers/registration_helpers_generiek.go` (afsluiten van voorgangers), de
  PATCH-route `handlers/wijziging_builder.go` (registratiemodus sluit de voorganger af).
- **Database:** `dbsetup/createtables.go` (constraint per materiële hub laten vallen; bestaande
  databases: `DROP CONSTRAINT` bij de start).
- **GraphQL:** `dynql/query_resolvers.go` en `dynql/type_builder.go` geven een enkelvoudig element
  als één object (het eerste). Bij meerdere voorkomens moet dat het op het materiële peilmoment
  geldige zijn, of een lijst.
- **Afleidingen:** `afleiding/relaties.go` meldt een fout bij meer dan één doel van een enkelvoudige
  relatie.
- **OpenAPI:** `handlers/openapi_generator.go` (enkelvoudig = array met `maxItems: 1`).
- **Studio-editor:** `EntiteitFormulier.jsx` en `RepresentatieFormulier.jsx` tonen een enkelvoudig
  element als één formulier ("max 1 actief record").
- **Bestaande gegevens:** statussen die al onder de oude regel zijn geregistreerd (meldingen op app,
  UitrolVerloop op Fundament) blijven formeel afgevoerd. De nieuwe regel geldt voor nieuwe
  registraties; omzetten van oude historie is een aparte, optionele stap.

## 5. Besluiten en open punten

Besloten door Mark op 25-10-2026:

1. **Einde van de voorganger: automatisch.** De engine zet `einde = aanvang nieuw − 1 dag`
   (inclusieve datums, zoals §3.3: einde 20/3, aanvang 21/3). Een expliciet einde in dezelfde
   registratie mag ook.
2. **Terugwerkende kracht tot op of vóór de aanvang van de voorganger: weigeren** met 422 en het
   advies om een correctie of ongedaanmaking te gebruiken.
3. **Invoegen midden in de historie: eerst alleen achteraan toevoegen.** Invoegen tussen oudere
   voorkomens geeft 422; volledig invoegen (periode splitsen) volgt als het nodig blijkt.
4. **Materieel tijdreizen hoort erbij**, maar Mark reviewt eerst de termen voor filteren op de
   formele en de materiële tijdlijn (zie §5a).

Nog open:

5. **Granulariteit:** aanvang en einde zijn datums. Twee statussen op één dag passen dan niet. Is dat
   voor statussen voldoende, of is een tijdstip nodig?

### 5a. Termen voor de twee tijdlijnen — besloten 27-10-2026 (Mark)

- **Materieel: `geldigOp`** (REST-queryparameter en GraphQL-argument), zoals de werkgroep Historie
  (Ivo: `geldigOp`/`geldigVanaf`/`geldigTot`). Eén parameter die een datum óf een tijdstip
  accepteert; het schema publiceert per representatie welke precisie geldt. Conceptnaam van de as:
  bestaan/geldigheid.
- **Formeel: `peiltijdstip` blijft** (met `t` als testafkorting). Geen tweede naam: de werkgroep
  heeft de systeemtijd-as zelf nog open, en "beschikbaarOp" valt af omdat de registratietijd het
  begin van de transactie is, niet het moment van beschikbaar komen.
- **Einde:** inclusief bij datums (zoals nu, BRP-lijn "tot en met", en een BV bestaat nog op de
  dag van ontbinding), exclusief bij tijdstippen (half-open, zoals het afgeleide `afvoer`).
  Automatisch einde bij een opvolger: `aanvang − 1 dag` bij datums, `= aanvang` bij tijdstippen.
- Precisie per representatie (datum/tijdstip) is een tweede stap (M3-eigenschap, met M3-MOF).


Nu in gebruik (REST en GraphQL): `peiltijdstip` (formeel, RFC 3339), `t` (synthetische afkorting
voor tests), `toonafvoer=1`. Voor de materiële tijdlijn is nog niets gebouwd; in de backlog staat
`geldig_op`, in `docs/API-standaarden-analyse.md` `materieelPeiltijdstip`.

## 6. Testaanpak

Eerst borgen, dan aanpassen, dan dezelfde tests opnieuw (Mark, 25-10-2026).

- **Borging (vóór én ná groen):** de bestaande suite (`go test -tags integration .`, scenario's 01–21)
  en het nieuwe **scenario 22**: één voorkomen van een materieel enkelvoudig GE (Burgerschap) met
  correctie van inhoud en aanvang, formeel tijdreizen per registratie en ongedaanmaking.
- **Scenario 24:** registratie zonder type (besluit 1); faalt vóór de fix met 409, groen erna.
- **Doelscenario's (rood tot de aanpassing er is):** opvolging met materieel einde, formeel en
  materieel terugkijken, ongedaanmaking van een opvolging, terugwerkende kracht, overlap (422),
  en een niet-materieel enkelvoudig element dat ongewijzigd formeel afsluit. Die schrijf ik zodra
  de open punten in §5 beslist zijn.
- Daarnaast: GraphQL en afleidingen op een element met meerdere voorkomens.

Testelementen: in np-loc is alleen Burgerschap materieel en enkelvoudig; daarnaast MeldingStatus
(meldingen) en de inrichting- en aanvraagstatussen. ~~Er is in geen enkel domein een materiële
enkelvoudige relatie~~ — correctie 27-10: die zijn er wél (Woonlocatie, Gebiedsligging, Bereikbaarheid,
Medewerkerafdeling, Afdelingsorganisatie, Gemeentedeelgemeente, MeldingBehandelaar, GebruikerStatus);
de regel geldt voor GE- én relatiehubs gelijk (zelfde code, hub-niveau).

## 7. Gebouwd (27-10-2026)

Gebouwd op `feat/materieel-enkelvoudig` (worktree `_afgeleide_rel`), suite groen (scenario's 01–24,
22 en 24 ongewijzigd groen vóór en ná; 23 nieuw):

- **Engine** `handlers/registration_opvolging.go`: uitgestelde opvolging ná de wijzigingen-lus van
  `RegistreerCore` (de normalizer splitst `_Aanvang` af als eigen wijziging, dus bij de hub-opvoer is
  de aanvang nog niet bekend; de aanvang wordt uit de database gelezen). Automatisch einde = aanvang
  − 1 dag (datum) / = aanvang (tijdstip) als eigen `_Einde`-record met eigen wijziging; 422
  `opvolging_terugwerkend` en `opvolging_invoegen` (problem+json met veldpad); expliciet einde in
  dezelfde registratie wint; meerdere nieuwe voorkomens in één registratie volgen elkaar op.
- **Zonder aanvang** bij een voorganger: **422** `opvolging_zonder_aanvang` (besluit Mark 27-10-2026,
  gekozen boven "formeel vervangen" en "aanvang = vandaag"). Een eerste voorkomen mag zonder aanvang.
  Gevolg: clients die statussen zonder aanvang registreren (Studio-meldingen → OMNIUM-UI;
  UitrolVerloop/AanvraagStatus → FUNDAMENT) moeten een aanvang meegeven.
- **Database** `dbsetup/createtables.go`: `ux_<tabel>_enkelvoudig_actief` vervalt voor materieel
  enkelvoudige hubs (`DROP CONSTRAINT IF EXISTS` bij het opstarten); kindtabellen ongewijzigd.
- **Lezen** `model/materieel_tijd.go`: `geldigOp` (datum of tijdstip) op `GET /full/{pad}[/:id]` en
  GraphQL `full_<pad>`/`full_<pad>_list`, combineerbaar met `peiltijdstip`; snoeit materiële hubs
  (ook de geladen ouder van een subtype) en geeft 404/null als de entiteit zelf dan niet bestaat.
  GraphQL enkelvoudig → het nu (of op `geldigOp`) geldige voorkomen (`dynql.kiesEnkelvoudigVoorkomen`).
- **OpenAPI**: materieel enkelvoudige rol als array zonder `maxItems`.
- **Docs**: API_REFERENCE §5 + §14, dynamische-graphql-laag.md, ONTWERP_DATA_PATTERN §3.3, BACKLOG
  B31 ✅ en B33 ✅ (met open punten).
- **Tests**: `model/materieel_tijd_test.go`; scenario 23 (opvolging, geldigOp datum/tijdstip,
  formeel + materieel gecombineerd, 400, 422 ×2, ongedaanmaking, expliciet einde, GraphQL, zonder
  aanvang).

Nog open (voor Mark): §5.5 granulariteit (tijdstipprecisie per representatie, M3-eigenschap);
invoegen/periode splitsen; Studio-formulieren (OMNIUM-UI: "max 1 actief record");
`geldigOp` op de platte routes en opgeslagen documenten; afleidingen kiezen bij een enkelvoudige
materiële relatie met meerdere doelen nu "de eerste" (`afleiding/relaties.go`) — beter: het geldige.
FUNDAMENT krijgt een seintje zodra dit in een image zit (UitrolVerloop/AanvraagStatus: aanvang meegeven).
