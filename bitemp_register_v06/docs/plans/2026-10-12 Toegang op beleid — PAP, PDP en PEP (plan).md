# Toegang op beleid — PAP, PDP en PEP (plan)

> 2026-10-12, concept voor besluitvorming door Mark. Aanleiding, stand, doelbeeld, fasering en
> open beslissingen. Nog niets gebouwd.

## 1. Aanleiding

- **Lek op pf.** `pf.common-ground-lab.nl` draait met `LEESTOEGANG=open`. Daardoor is alle
  registerdata buiten domein `beheer` anoniem leesbaar via `/full/*`, de GE-routes en GraphQL.
  `GET /full/personen` geeft op 12-10 zonder inloggen **70 e-mailadressen** terug
  (`Persoon_Persoonscontactgegevens.email`). App (`app.omnium-ide.nl`) heeft dezelfde instelling,
  maar daar stonden op die paden geen e-mailadressen. Mark besloot op 12-10 om pf voorlopig zo te
  laten en het structureel op te lossen.
- **Aantekeningen** komen erbij (bij personen/organisaties in CG); die mogen niet openbaar zijn.
- **Formulier "Houd mij op de hoogte"** (Omnium-site): anoniem insturen, met optioneel e-mail.
  Kan pas live als inzendingen niet openbaar leesbaar zijn.

Een vlag per domein is te grof: in CG staan openbare portfolio-data (initiatieven) en
persoonsgegevens naast elkaar, en `/full/personen` neemt de contactgegevens in hetzelfde antwoord
mee. Marks richting: **beleid (policies) met een PAP, PDP en PEP**.

## 2. Stand van zaken

| Rol | Wat er is | Beperking |
|---|---|---|
| **PEP** | `middleware/authz_pep.go`: mapt methode + pad op een AuthZEN-actie (`read`/`write`/`admin`) en een resource, vraagt de PDP, 403 bij deny, fail-closed (`AUTHZ_DENY_ON_ERROR`). | Alleen per **route**. Weet niets van typen, GE's of velden in een antwoord. Staat op beide VPS-instanties **uit** (`AUTHZ_PDP_ENABLED=false`). |
| **PDP** | OpenFTV (Digilab) als sidecar, AuthZEN `POST /authzen/v1/evaluation`, Rego-beleid `authz/manager/policies/bitemp_authz.rego` (rolhiërarchie, pagina's, API-niveaus). `docker-compose.auth.yml`. | Alleen lokaal; niet op de VPS. Beleid gaat over rollen en pagina's, niet over gegevens. |
| **PAP** | OpenFTV Manager (Rego met de hand). In Omnium: het **Toegangsspraak**-profiel (`diagramprofielen/toegangsregel/`, M2) en de export naar **ODRL** (ODRL-AP-NL, Turtle; regelset-vorm). Ontwerp ODRL-register: `docs/plans/ODRL-Register-Toegangsbeleid.md`. | Geen verbinding tussen het Omnium-beleid en wat de PDP uitvoert. |
| **PIP** | `authz/manager/data/entities/{roles,pages}.json`; gebruikers en rollen in domein `beheer` (rol per verzoek, §3.5a AUTH-gids). | Geen resource-attributen (domein, type, classificatie) uit de MetaRegistry. |
| **Hard-codering** | `beheer` is admin-only op drie plekken: `routes/leestoegang.go` (lezen), `dynql/schema_builder.go` (niet in GraphQL), `handlers/registration_beheer.go` (schrijven). Plus `LEESTOEGANG=open\|documenten` (alles of niets) en `OPENBARE_FORMULIEREN` (anoniem insturen). | Precies wat beleid moet vervangen. |

## 3. Doelbeeld

Metaniveaus (CLAUDE.md): het **beleid is een M1-model** in het M2-profiel Toegangsspraak; de
resources in dat beleid verwijzen naar elementen van het **canonieke M1-model**; afdwingen
gebeurt op **M0** (register, API, GraphQL).

```
Omnium Studio (PAP, beschrijvend)                 Register-runtime
Toegangsspraak-model ──compileer──▶ beleidsbundel (JSON) ──▶ PDP in Go-API ◀── PEP (route · veld · schrijven)
   │  resources = ENT / ENT.GE / ENT.GE.veld                              ▲
   └─ export ODRL (FTV-werkgroep)                                     PIP: rollen, organisatie,
                                                                       resource-attributen (MetaRegistry)
```

- **PAP = Omnium.** Beleid wordt gemodelleerd in Toegangsspraak (met visuele weergave), is
  beschrijvend en exporteerbaar als ODRL. Een **transformatie** (regelset-vorm, zoals de
  ODRL-export) maakt er uitvoerbaar beleid van voor de PDP. Het beleid zelf kan later een
  bitemporeel register zijn ("welk beleid gold op t?").
- **PDP** beslist op AuthZEN-vragen. Zie open beslissing B1 (OpenFTV-sidecar of ingebouwd).
- **PEP op drie plekken:**
  1. **Route** — bestaat (`authz_pep.go`).
  2. **Lezen per type** — `/full/*`, GE-routes, GraphQL-resolvers en generieke paden vragen per
     entiteit/GE (en later per veld) of het mag, en **laten weg** wat niet mag. Met een
     batch-vraag per verzoek (AuthZEN *evaluations*), niet per rij.
  3. **Schrijven** — in de registratie-engine, op elke route (ook `/registratie/`, PATCH, GraphQL).
     Vervangt `registration_beheer.go`. Anoniem insturen via een openbaar formulier wordt een
     beleidsregel ("anoniem mag `Belangstellende` opvoeren via formulier X") in plaats van de
     env-lijst `OPENBARE_FORMULIEREN`.
- **PIP** levert rollen/organisatie (domein `beheer`) en resource-attributen uit de MetaRegistry
  (domein, typenaam, metatype, later classificatie/doelbinding).
- **Generieke leespaden** meenemen: `/registraties`, `/full/registraties`, `/wijzigingen` (alleen
  metadata: type + id), `/api/viz/*/max-id`, `secondaire-ids`, bestanden, lineage, export, en de
  publicatiepagina.

## 4. Fasering (voorstel)

| Fase | Inhoud | Lost op |
|---|---|---|
| **1. Resourcemodel + PEP op het leespad** | Resource-identiteit voor type/GE (MetaRegistry-pad), PEP-filter in `/full`, GE-routes, GraphQL en generieke paden. PDP-interface (AuthZEN) met — voorlopig — beleid dat de huidige hard-coderingen dekt plus "contactgegevens alleen voor ingelogd/rol". | het pf-lek; voorbereiding aantekeningen |
| **2. PEP op het schrijfpad** | Registratie-engine vraagt de PDP; `beheer`-regel en `OPENBARE_FORMULIEREN` worden beleid. | anoniem formulier als beleid |
| **3. PAP vanuit Omnium** | Transformatie Toegangsspraak → uitvoerbaar beleid; publiceren naar de PDP (zoals een schema-versie). PDP op de VPS. | beleid modelgedreven |
| **4. Toepassingen** | Formulier "Houd mij op de hoogte" (nieuw domein, app), aantekeningen in CG. | beide verzoeken |
| **5. Verder** | Beleid bitemporeel (ODRL-register), per-veld-afscherming, AuthZEN-koppeling met FTV, classificatie/doelbinding/grondslag als attributen. | ODRL-plan |

## 5. Besluiten Mark (12-10)

- **B1 — PDP in de Go-API.** Geen sidecar in het leespad.
- **B2 — Deny-by-default, per instantie.** pf: ja. app (Omnium): ja; daar staan ook demodata en
  demodomeinen die voor het functioneren niet nodig zijn (opschonen is een apart punt). Daarnaast
  komt er een **probeer-register**: genereren vanuit een model, puur demodata, daar mag lezen open
  — behalve de plumbing-tabellen. Het actieve beleid is dus een instelling per instantie.
- **B3 — Per veld**, omdat het beleid al tot op veldniveau gaat; alleen terugvallen op per type als
  het in eerste instantie onevenredig moeilijk blijkt.
- **B4 — Toegangsspraak zelf uitvoeren**, niet via ODRL → Rego. ODRL blijft het
  uitwisselformaat. Uitwerking hieronder.

### Uitwerking B4: een eigen Toegangsspraak-uitvoerder

Aanleiding: de meting van 30-09 (`2026-09-30 FTV GraphQL-profiel … uitvoerbaarheid van ODRL in de
PDP.md` §3, §8). Native ODRL (pyodre) kost ± 2 ms per veldrecord, 5–11 ms per query; een
geïndexeerde, data-gedreven evaluatie (OPA) ± 17 µs per veldrecord. Het verschil zit niet in
ODRL tegenover Rego, maar in **indexeren en regels als data**. Dat kan net zo goed rechtstreeks
in Go, zonder de omweg via ODRL en zonder OPA als afhankelijkheid.

Argumenten:
- **De semantiek is toch van ons.** ODRL 2.2 heeft geen normatieve uitvoersemantiek; wie ODRL
  uitvoert, kiest een interpretatie. Die keuze maken we al in Toegangsspraak.
- **Alles ligt klaar.** Paden zijn canonieke modelpaden (`ENT.GE.veld`), de operatoren en
  leftOperands staan als register in `toegangsspraak/operatoren.js`, de MetaRegistry levert de
  index per type en veld.
- **Eén parser.** De Studio (PAP) parseert zoals nu (JS) en **publiceert een gecompileerde
  beleidsbundel** (JSON: regels als data, index per type/veld/rol) naar de API, zoals een
  schema-versie. De Go-PDP evalueert data; er komt geen tweede parser in Go. (Zelfde redenering
  als "één tekenaar" bij de render-API.)
- **ODRL blijft belangrijk voor uitwisseling** (FTV, ODRL-AP-NL-export bestaat) — en wordt de
  **conformiteitstoets**: dezelfde testvectoren gaan door de Go-uitvoerder én door een
  ODRL-evaluator op de export; beide moeten hetzelfde beslissen. Patroon als
  `testdata/cel-pariteit.json`. Dat bewijst dat onze uitvoering een geldige ODRL-interpretatie is.

Uitvoering in drie stappen per verzoek (fasering uit §9 van de analyse van 30-09):
1. **Per subject vooraf** (bij inloggen/beleidswijziging, gecachet): de verzameling toegestane
  veldpaden per handeling — feitelijk een subschema.
2. **Per verzoek**: route- en typecheck, en uit het antwoord weglaten wat niet in die verzameling
  zit (`/full`, GE-routes, GraphQL per veld).
3. **Waardeafhankelijke voorwaarden** ("alleen de eigen gemeente") later als residu naar een
  SQL-filter.

## 6. Besluiten Mark (12-10, vervolg) en nog open

- **Subject: voorlopig alleen `gebruiker` of `anoniem`** (geen bekend subject = openbaar). Het
  rijkere subjectmodel — organisatie → organisatieonderdeel → medewerker → rol, en partij
  (NP / NNP / vestiging / MA / zorgverlener / overheidsorganisatie) — is nog niet uitgedacht en
  komt later. De bundel moet daar wel op voorbereid zijn (subject-condities als data, niet
  hard-gecodeerd op twee waarden).
- **Opslag van de bundel: meteen bitemporeel** — het beleid als register in de eigen
  architectuur (ODRL-registerplan §5), zodat "welk beleid gold op t?" te beantwoorden is.
- **Superpolicy (Mark, 12-10)**: per beleid instelbaar of alles dicht/open is tenzij, en hoe
  tegenstrijdige regels worden afgewogen. Gebouwd als kopregels `Standaard:` en `Bij conflict:`
  (verbod gaat voor / toestemming gaat voor / de eerste regel geldt = volgorde als prioriteit).
- Nog open: **meerdere beleiden combineren** op één instantie (bv. een openbaarheidsbeleid naast
  een privacybeleid) — een beleidsset met een eigen combinatieregel; anoniem subject bij openbare
  formulieren als beleidsregel; demodomeinen op app opschonen (los van dit plan).

### Volgorde fase 1

- **1a** — bundelformaat vastleggen + Go-uitvoerder (pure functie, geen gedragswijziging in de
  API) + gedeelde testvectoren. **Gebouwd 12-10** op `feat/toegang-pdp` (worktree
  `Bitemporal_2026_toegang`, niet gecommit): `toegangsspraak/bundel.js`, package `toegang/`,
  `testdata/toegang/`, taaluitbreiding **"Iedereen"** (nodig voor openbaar beleid bij
  deny-by-default). Keuze onderweg: kenmerken van de aanvrager zijn een gesloten wereld
  (ontbreken = leeg, dus onwaar); gegevens van de betrokkene blijven onbepaald zolang de PDP ze
  niet kent. Benchmark ± 0,4 µs per veldbeslissing. Zie `docs/TOEGANGSSPRAAK.md` §Uitvoeren.
- **1b** — PEP op het leespad (`/full`, GE-routes, GraphQL, generieke paden), achter een
  schakelaar, met de bundel uit een bestand. **Gebouwd 12/13-10** (zelfde branch): package
  `pep/` (`TOEGANG_BUNDEL`, subject uit claims met rolhiërarchie, snoeier op JSON-paden,
  `Prefix` per type via de MetaRegistry — alle 311 typen eenduidig), aangesloten op `/full`,
  platte routes (incl. `q`/`filter.`/`sort` als zijkanaal dicht), GraphQL (als laatste stap,
  ook filterargument) en plumbing/bestanden (alleen ingelogd). Getest met unit-tests, sqlmock
  door de echte handlers, en een echte lokale `/full`-respons (alleen-lezen) met drie bundels.
  **Bekende beperkingen:** (1) `total_count`/`has_more` tellen vóór het filteren; (2)
  voorwaarden over gegevens buiten het record (doorkijk via een relatie, bv. de wijk van de
  woonlocatie) zijn onbepaald → fail-closed; (3) een record met alleen technische velden is
  zichtbaar als het subject van het type iets mag zien; (4) plumbing per veld/wijziging nog
  niet (nu: ingelogd); (5) met `AUTH_ENABLED=false` is iedereen anoniem; (6) nog niet
  end-to-end tegen een draaiende API met database getest (bewust geen tweede instantie op de
  ontwikkel-DB gestart).
- **1c** — de bundel als bitemporeel register (domein voor beleid) en publiceren vanuit de Studio.

## 7. Oorspronkelijke open beslissingen (beantwoord in §5)

- **B1 — PDP.** (a) OpenFTV-sidecar ook in productie (zoals lokaal; extra container + Manager),
  of (b) een **ingebouwde PDP** in de Go-API met een AuthZEN-interface naar buiten, zodat lezen
  per type geen netwerkronde per verzoek kost; OpenFTV kan dan later naast/achter. Voorkeur?
- **B2 — Standaardhouding lezen.** Deny-by-default betekent dat al het openbare (portfolio,
  publicatie, referentielijsten) expliciet in beleid moet staan. Of: allow-by-default met
  expliciete afscherming als tussenstap?
- **B3 — Granulariteit fase 1.** Per entiteit/GE, of meteen per veld?
- **B4 — Beleidstaal voor uitvoering.** Rego (past bij OpenFTV nu) of Cedar?
- **B5 — Het pf-lek.** Uitgesteld op 12-10. Of er een AVG-melding nodig is, is een afweging voor
  de verwerkingsverantwoordelijke; buiten dit plan.
