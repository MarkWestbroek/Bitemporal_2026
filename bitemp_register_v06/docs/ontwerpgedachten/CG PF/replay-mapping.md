# Replay-mapping voor CG Portfolio Intake

Deze notitie beschrijft hoe [Intake Portfolio Common Ground 1.json](docs/ontwerpgedachten/CG%20PF/Intake%20Portfolio%20Common%20Ground%201.json) als bron wordt gebruikt voor een draft replay-bestand tegen het CG-model.

**Huidige modelversie:** CG v0.5.9.3 (`docs/ontwerpgedachten/CG PF/CG v0.5.9.3.json`).

## Directe mapping

- `ID` -> `initiatief.id`
- `Wat is de naam van het initiatief dat je wilt aanmelden?` -> `product.naam`
- `Wat is een korte omschrijving van het product?` -> `product.omschrijving`
- `Indien een toepassing, pitch je product...` -> `product.pitch`
- `Op welke website kunnen we meer info...` -> `product.website`
- `Wat is de Gitlhub of Gitlab omgeving van het initiatief?` -> `product.git_repo`
- `Wat voor type product is het initiatief?` -> `product.type` na normalisatie
- `Op welke laag of op welke lagen bevindt dit initiatief zich` -> `product.CG_laag` als eerste herkenbare CG-laag
- `Wat is de startdatum van het initiatief` -> `initiatief_aanvang.datum` en `planning.startdatum`
- `Wanneer wordt verwacht dat het initiatief ready for use is...` -> `planning.ready_for_use`
- `Waar staat informatie over de planning?` -> `planning.planningsinfo`
- `Waar zijn jullie tegenaan gelopen...` -> `planning.waar_tegenaan_gelopen`
- `In welke fase bevindt het initiatief zich?` -> `planning.fase` na normalisatie
- De drie schaalvragen -> drie losse `bijdrage` records met `type_bijdrage`, `schaal`, `toelichting`
- `In welk domein(en) past het initiatief?` -> meerdere `initiatiefdomein` relaties
- Gemeentevelden -> meerdere `initiatiefgemeente` relaties
- `Welke API-standaarden zijn toegepast?` -> meerdere `initiatiefapistandaard` relaties

## Niet 1-op-1 in het huidige schema

- ~~`Initiatief` heeft geen relatie naar `Organisatie`.~~ **Opgelost in v0.5.2**: `InitiatiefOrganisatie` (meervoudig) en `Initiatiefinfo` GE zijn nu beschikbaar. De generator koppelt opgeschoonde organisatienamen via `initiatieforganisatie` en slaat ongestructureerde tekst op in `initiatiefinfo`.
- ~~`contactgegevens` ambigu~~ **Opgelost via `chooseMetaByPayload()`** in `REST request models.go`: bij veldnaam-collisions (`naam`, `contactgegevens`) wordt gedisambigueerd op basis van de `EntiteitIDKolom` in de payload.
- **PO e-mail replay toegevoegd (april 2026)**: `Replay files/5. PO email naar Persoon.Contactgegevens 2026.replay.json` vult nu `Persoon.Contactgegevens.email` op basis van `Wat is het emailadres van de PO?`. Dit bestand speel je **na replay 4** af, zodra `telefoonnummer` niet meer verplicht is.
- **Opgeschoonde PO e-mail replay toegevoegd (april 2026)**: `Replay files/5b. PO email naar Persoon.Contactgegevens 2026 - opgeschoond.replay.json` is de voorkeursvariant voor import. Deze laat vrije-tekstcontacten, placeholders en dubieuze niet-persoonsrecords bewust weg.
- **Persooncorrectie-replay toegevoegd (april 2026)**: `Replay files/6. Persooncorrecties David en cleanup 2026.replay.json` ruimt een bekende dubbele `David Bronsveld` op en voert test-/pseudo-persoon `persoon_id 53` af. Deze replay is optioneel en bedoeld als nabehandeling na de import.
- **Nieuw in v0.5.9**: `BetrokkenOrganisatie` GE (meervoudig, met `Organisatietype` enum: Gemeenten, Leveranciers, VNG, Ketenpartners, Rijk). Het bronveld `organisatie_types` wordt nu per initiatief omgezet naar losse `betrokkenorganisatie`-entries.
- **Fase-enum uitgebreid in v0.5.9**: de waarden zijn nu volledige beschrijvende strings (bijv. "Idee (nog geen concrete opbrengsten)") i.p.v. korte labels. De FASE_MAP in de generator is hierop aangepast.
- **Producttype `Standaard`**: komt 6x voor in de brondata maar ontbreekt nog in de Go enum (alleen Component en Toepassing). Wordt later via het model/codegen toegevoegd.

## Generator

De draft replay wordt gegenereerd met [scripts/maak_cgpf_portfolio_replay.py](scripts/maak_cgpf_portfolio_replay.py).

Voorbeeld:

```bash
cd bitemp_register_v06
python scripts/maak_cgpf_portfolio_replay.py \
  "docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground 1.json" \
  "docs/ontwerpgedachten/CG PF/CG v0.5.9.3.json" \
  "docs/ontwerpgedachten/CG PF/Replay files/4. Intake Portfolio Common Ground 2.replay (zonder gemeenten).json"
```

## Officiële gemeenteseed via CBS (2026)

Voor een opgeschoonde referentielijst met alle **342 gemeenten** is daarnaast een losse seed gemaakt op basis van de officiële CBS-download **Gemeenten alfabetisch 2026**:

- bronbestand: `docs/ontwerpgedachten/CG PF/Gemeenten alfabetisch 2026 (CBS).xlsx`
- replay-bestand: `docs/ontwerpgedachten/CG PF/Gemeenten CBS 2026.replay.json`
- bronpagina: <https://www.cbs.nl/nl-nl/onze-diensten/methoden/classificaties/overig/gemeentelijke-indelingen-per-jaar/indeling-per-jaar/gemeentelijke-indeling-op-1-januari-2026>

Deze seed gebruikt de **numerieke CBS-gemeentecode als `gemeente.id`** en bewaart daarnaast de officiële `GM####`-code in `gemeentegegevens.code`.

### Aanbevolen uitvoervolgorde

1. voer eerst `Gemeenten CBS 2026.replay.json` uit om de complete officiële gemeentelijst te laden;
2. voer daarna `Domeinen vast 2026.replay.json` uit voor de vaste shortlist van 10 CG-portfolio-domeinen;
3. voer daarna `API standaarden rationalisatie 2026.replay.json` uit voor de gerationaliseerde lijst API-standaarden;
4. voer daarna `Intake Portfolio Common Ground 2.replay (zonder gemeenten).json` uit;
5. voer daarna bij voorkeur `5b. PO email naar Persoon.Contactgegevens 2026 - opgeschoond.replay.json` uit zodra `telefoonnummer` niet meer verplicht is (of gebruik anders de volledige variant `5. ...`);
6. voer desgewenst daarna `6. Persooncorrecties David en cleanup 2026.replay.json` uit voor handmatige opschoning van dubbele/testachtige persoonrecords.

> **Let op:** na de upgrade naar model v0.5.2 moeten eerst de bestaande CG-tabellen gedropt worden via `DELETE /admin/db/droptables/<wachtwoord>?domein=CG` en opnieuw aangemaakt, voordat de replays opnieuw uitgevoerd worden.

> **Replay 3 (overige velden) is nu overbodig.** Het aparte bestand `Intake Portfolio Common Ground 3.replay (overige velden).json` bevatte alleen `anderdomein`, `andereapistandaard` en `andersdangemeente`. Al deze keys worden nu direct in replay 2 gegenereerd. Het bestand en de kopie in `replay files/` kunnen verwijderd worden.

> **Automatische seed-detectie.** De generator herkent nu ook de genummerde seedbestanden in `Replay files/` (`1. Gemeenten ...`, `2. Domeinen ...`, `3. API standaarden ...`) en laat de corresponderende seedblokken in replay 4 dan automatisch weg. Daarmee voorkom je duplicate-ID fouten aan het begin van de import.

In dat vierde replay-bestand is de oude `Seed referentielijst Gemeente` verwijderd. Voor `gemeente`, `domein` en `api-standaard` geldt nu expliciet:

- **match op de referentielijst** → de generator voert een **REL** op (`initiatiefgemeente`, `initiatiefdomein`, `initiatiefapistandaard`)
- **geen match** → de generator voert de waarde op als **overig-GE** (`andersdangemeente`, `anderdomein`, `andereapistandaard`)

Daardoor gaat relevante vrije tekst niet meer verloren, terwijl de opgeschoonde referentielijstkoppelingen wel behouden blijven.

### Vastgelegde weggelaten heuristische treffers

De volgende waarden kwamen in de oude heuristische gemeentelijst voor, maar zijn **niet als officiële gemeente herleid** en daarom niet meer als `initiatiefgemeente` opgenomen. Ze zijn hier bewust vastgelegd voor latere handmatige opschoning:

- `Dimpact` (7x) — voorbeeld bij `bron_id=45`, `OpenCatalogi`
- `Drechteland` (2x) — voorbeeld bij `bron_id=52`, `Open Zaak`
- `RDW.` (2x) — voorbeeld bij `bron_id=99`, `Octopus`
- `Elsevier` (1x) — voorbeeld bij `bron_id=44`, `NLPortal MijnOmgeving voor inwoners en ondernemers`
- `Min. van Binnenlandse Zaken` (1x) — voorbeeld bij `bron_id=45`, `OpenCatalogi`
- `SIMgroep` (1x) — voorbeeld bij `bron_id=45`, `OpenCatalogi`
- `Min. BZK` (1x) — voorbeeld bij `bron_id=45`, `OpenCatalogi`
- `Bovenstaand` (1x) — voorbeeld bij `bron_id=51`, `GZAC`
- `Omgevingsdienst Midden Holland` (1x) — voorbeeld bij `bron_id=72`, `Rx.Open`
- `SED Organisatie` (1x) — voorbeeld bij `bron_id=72`, `Rx.Open`
- `Digeplan` (1x) — voorbeeld bij `bron_id=74`, `Fundament`
- `DataMask` (1x) — voorbeeld bij `bron_id=74`, `Fundament`
- `Geoweb` (1x) — voorbeeld bij `bron_id=74`, `Fundament`
- `Omgevingsdienst Noord-Holland-Noord` (1x) — voorbeeld bij `bron_id=79`, `Tezza`
- `Saxion Hogescholen` (1x) — voorbeeld bij `bron_id=79`, `Tezza`
- `de` (1x) — voorbeeld bij `bron_id=95`, `NotifyNL (NotificatieNL)`
- `Waterschap Rivierenland` (1x) — voorbeeld bij `bron_id=101`, `iSyNAPS`
- `Provincie Overijssel` (1x) — voorbeeld bij `bron_id=104`, `ValidSign`
- `SED-organisatie` (1x) — voorbeeld bij `bron_id=104`, `ValidSign`
- `Duoplus` (1x) — voorbeeld bij `bron_id=105`, `Archiefbeheer`
- `De Buch` (1x) — voorbeeld bij `bron_id=105`, `Archiefbeheer`
- `WTS Zuiderzeeland` (1x) — voorbeeld bij `bron_id=114`, `DiVault FLEX (pre-depot)`

## Aanvullende afgeleiden (april 2026)

### `overigNietGemeente` als JSON

Voor de eerder weggelaten niet-gemeentelijke treffers is nu ook een los JSON-bestand gemaakt:

- bestand: `docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground overigNietGemeente.json`
- inhoud per item: `bron_id`, `initiatief_id`, `initiatief_naam`, `overigNietGemeente`
- huidige stand: **21 initiatieven** met samen **24 unieke waarden** zoals `Dimpact`, `Drechteland`, `Omgevingsdienst Midden Holland`, `Provincie Overijssel` en `Waterschap Rivierenland`

Dit bestand dient nu als bron en controlelijst voor het expliciete GE `andersdangemeente`, zodat deze waarden niet foutief als officiële gemeente worden geregistreerd maar ook niet meer verloren gaan.

### Vaste domeinseed

Op basis van de compacte domeinshortlist uit de intake is een aparte seed gemaakt:

- documentatiekopie: `docs/ontwerpgedachten/CG PF/Domeinen vast 2026.replay.json`
- directe replay-kopie: `replay files/registraties-replay-init-domeinen-vast-cgpf-2026.json`
- inhoud: **10 vaste domeinen** (`Burgerzaken`, `Sociaal Domein`, `Ruimtelijke ordening`, `Bedrijfsvoering`, `Dienstverlening`, `(Lokale) belastingen`, `Fysieke leefomgeving`, `Bestuur`, `Openbare orde en veiligheid`, `Overkoepelend / randvoorwaardelijk voor CG`)

### Gerationaliseerde API-standaardseed

De vrije-tekstantwoorden over API-standaarden zijn nu ook geclusterd tot een compactere referentielijst:

- analysebestand: `docs/ontwerpgedachten/CG PF/API standaarden rationalisatie 2026.json`
- replay-bestand: `docs/ontwerpgedachten/CG PF/API standaarden rationalisatie 2026.replay.json`
- directe replay-kopie: `replay files/registraties-replay-init-apistandaarden-cgpf-rationeel-2026.json`
- huidige stand: **48 canonieke API-standaarden** uit **80 bruikbare antwoorden**; **15 ruwe antwoorden** zijn apart bewaard onder `unmatched_raw_answers` voor handmatige review

### Aanvullende replay voor de nieuwe `overige` velden in CGPF 0.4.4

Omdat `CGPF 0.4.4.json` nu ook de gegevenselementen `AnderDomein`, `AndersDanGemeente` en `AndereAPIStandaard` bevat, is daarvoor een aparte replaystructuur klaargezet:

- JSON-bron voor overige gemeenten: `docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground overigNietGemeente.json`
- JSON-bron voor overige domeinen: `docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground overigDomein.json`
- JSON-bron voor overige API-standaarden: `docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground overigeAPIStandaarden.json`
- replay-bestand: `docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground 3.replay (overige velden).json`
- directe replay-kopie: `replay files/registraties-replay-init-overige-velden-cgpf-2026.json`

Deze replay gebruikt voorlopig de request-keys:

- `anderdomein` met veld `domein`
- `andersdangemeente` met veld `andersDanGemeente`
- `andereapistandaard` met veld `api_standaard`

Dat volgt dezelfde conventie als de bestaande keys `planning`, `product` en `bijdrage`.

De hoofdgenerator `scripts/maak_cgpf_portfolio_replay.py` past deze logica nu ook direct toe in `Intake Portfolio Common Ground 2.replay (zonder gemeenten).json`, zodat dit bestand meteen de juiste mix van REL-records en `overig`-GE's bevat.

### Root cause van de crash bij API-standaarden-seed

De seed met `ApiStandaard`-namen gebruikte de JSON-key `naam`. Die key komt in het bredere model op meerdere plekken voor. De runtime-resolver keek eerder via `MetaRegistry.GetByVeldnaam("naam")` alleen naar de **eerste** map-match. Omdat Go-map-iteratie niet stabiel is, werd dezelfde payload soms onterecht als `NatuurlijkPersoon_Naam` geïnterpreteerd in plaats van als `ApiStandaard_Naam`.

Dat is nu opgelost door de request-parser te laten **disambigueren op basis van de payload-velden zelf** (bijv. `apistandaard_id` versus `natuurlijkpersoon_id`). Daardoor hoort een payload met:

- `apistandaard_id` nu deterministisch bij `ApiStandaard_Naam`
- `natuurlijkpersoon_id` nu deterministisch bij `NatuurlijkPersoon_Naam`

### Organisatie-rationalisatie (v0.5.2)

Met de upgrade naar CG v0.5.2 is de organisatiekoppeling volledig geïmplementeerd:

- **Model**: `InitiatiefOrganisatie` relatie (nu **meervoudig**) + nieuw `OrganisatieInfo` GE met veld `informatie`
- **Organisatierol**: enum met waarden `Contactorganisatie` en `BetrokkenOrganisatie`
- **ORG_ALIASES**: ~40 normalisatieregels in de generator (bijv. `Appsemble` → `Appsemble B.V.`, `conduction b.v` → `Conduction B.V.`, `xxllnce` → `Xxllnc`)
- **Org-filtering**: tokens worden geclassificeerd via `is_org_like_token()` — zinnen, testdata, >80 tekens, >8 woorden en Zweedse tekst worden uitgefilterd
- **Resultaat**: 154 ruwe organisatienamen → **123 canonieke organisaties** als seed
- **Koppelingen**: **196 `initiatieforganisatie`** relaties (contactorganisatie + leveranciers)
- **Overig**: **21 `organisatieinfo`** entries met ongestructureerde tekst die niet als organisatienaam herkend is (zinnen, URLs, testdata, complexe parentheticals)

Hierdoor gaat er geen data verloren: opgeschoonde namen worden als relatie vastgelegd, en rommelige tekst wordt als `organisatieinfo.informatie` bewaard.

## Aanbevolen vervolgstappen

1. Maak de request-keys voor `Organisatie_Contactgegevens` en `Persoon_Contactgegevens` uniek.
2. ~~Voeg een expliciete relatie `Initiatief` -> `Organisatie` toe.~~ **Gedaan** in v0.5.2 — `InitiatiefOrganisatie` (meervoudig) en `OrganisatieInfo` GE.
3. ~~Introduceer opgeschoonde referentielijsten of mappingtabellen voor gemeenten, domeinen en API-standaarden.~~ Grotendeels **gedaan** — CBS-gemeenten, vaste domeinen en gerationaliseerde API-standaarden zijn als losse seeds beschikbaar.
4. Controleer de **4 dubbele bron-ID's** (96–99) in de intake: deze verschijnen elk 2× in `Intake Portfolio Common Ground 1.json` en genereren dus dubbele entries.