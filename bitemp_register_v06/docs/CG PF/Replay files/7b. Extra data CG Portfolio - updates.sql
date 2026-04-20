-- ═══════════════════════════════════════════════════════════════════════
-- Extra data CG Portfolio - UPDATE statements voor bestaande records
-- ═══════════════════════════════════════════════════════════════════════
--
-- Gegenereerd door: generate_extra_data_replay.py
-- Bron: uitgebreid.txt (SharePoint PowerBI export)
--
-- Dit script vult extra velden aan op bestaande _Data records:
--   - initiatief_planning_data: obstakels, verwacht_ready_datum
--   - initiatief_product_data: vervangt_ouder_product
--   - initiatief_bijdrage_data: score (per bijdragetype via JOIN op hub)
--   - initiatief_initiatiefinfo_data: aanmeldingsdatum
--
-- Voer dit uit NADAT:
--   1. De migratie-SQL (20260611_...) is gedraaid (nieuwe kolommen)
--   2. Replay 4 is afgespeeld (bestaande records)
--   3. Replay 7 is afgespeeld (nieuwe GE's: beoordeling, etalage)
--
-- Let op: deze UPDATEs werken direct op de _Data records en omzeilen
-- de bitemporale audittrail (geen registratie/wijziging). Dit is
-- acceptabel voor initiële data-import.
--
-- Database: bitemp_go_db_v06
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- initiatief_id=37 (Zaakregister)
UPDATE initiatief_planning_data SET obstakels = 'belangrijkste is leveranciers/commerciele partijen geïnteresseerd maken voor gebruik van dit component in hun toepassingen.' WHERE initiatief_id = 37 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-01-22'::date WHERE initiatief_id = 37 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 37   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 37   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 37   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-01-26'::date WHERE initiatief_id = 37 AND rel_id = 1;

-- initiatief_id=38 (Signalen)
UPDATE initiatief_planning_data SET obstakels = 'onafhankelijke juridische entiteit om informele gemeentelijke samenwerkingen te kunnen representeren en waar de code base in beheer gegeven kan worden' WHERE initiatief_id = 38 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2020-12-12'::date WHERE initiatief_id = 38 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 38   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 38   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 1 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 38   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-01-25'::date WHERE initiatief_id = 38 AND rel_id = 1;

-- initiatief_id=40 (GEM)
UPDATE initiatief_planning_data SET obstakels = 'Samen Organiseren wordt nog niet altijd begrepen door gemeenten, CG gedachte zijn veel definities van in het land, gemeentes willen soms alleen afnamen en niet samen ontwikkelen. In positieve zin: als we samen ontwikkeling werpt dat vruchten af' WHERE initiatief_id = 40 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2021-07-01'::date WHERE initiatief_id = 40 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 40 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 40   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 40   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 40   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-01-26'::date WHERE initiatief_id = 40 AND rel_id = 1;

-- initiatief_id=43 (OpenWoo.app)
UPDATE initiatief_planning_data SET obstakels = 'De onwennigheid van gemeenten om te voldoen aan de Wet open overheid. Daarnaast het juist labelen en koppelen met o.a. KOOP en Woogle' WHERE initiatief_id = 43 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-01-01'::date WHERE initiatief_id = 43 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 43   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 43   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 43   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-02-06'::date WHERE initiatief_id = 43 AND rel_id = 1;

-- initiatief_id=44 (NLPortal MijnOmgeving voor inwoners en ondernemers)
UPDATE initiatief_planning_data SET obstakels = 'De DigiD pentest en de inmiddels opgeloste bevindingen. De pentesten en inmiddels opgeloste bevindingen. De toetsing voor privacy en Security en de verwerking van de aanbevelingen. Daarmee is een basis neergezet. Nu richten we ons op rijkere en meer functionaliteit voor onze klanten.' WHERE initiatief_id = 44 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-04-01'::date WHERE initiatief_id = 44 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 44   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 44   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 44   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-02-07'::date WHERE initiatief_id = 44 AND rel_id = 1;

-- initiatief_id=45 (OpenCatalogi)
UPDATE initiatief_planning_data SET obstakels = 'moet ik nog even over nadenken' WHERE initiatief_id = 45 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-12-14'::date WHERE initiatief_id = 45 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 45   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 45   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 45   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-02-09'::date WHERE initiatief_id = 45 AND rel_id = 1;

-- initiatief_id=47 (Waardepapieren)
UPDATE initiatief_planning_data SET obstakels = '1) opschalen van pilot naar live-oplossing. Wie neemt eigenaarschap en kostenverdeling; 2) bestuurlijke en ambtelijke besluitvorming bij gemeente om daadwerkelijk in gebruik te nemen., 3) lange doorlooptijd, met risico op afhaken' WHERE initiatief_id = 47 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-10-01'::date WHERE initiatief_id = 47 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 47   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 47   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 47   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-02-27'::date WHERE initiatief_id = 47 AND rel_id = 1;

-- initiatief_id=48 (KISS, KlantinteractieServicesysteem)
UPDATE initiatief_planning_data SET obstakels = '''Ken je klant'' is een belangrijk gegeven om persoonlijke, proactieve diensten te kunnen leveren. Wat houdt een klantbeeld in? Daarover hebben medewerkers, maar ook klanten verschillend beelden ne verwachtingen. Een ander struikelblok zijn de API-standaarden; zij zijn in ontwikkeling, ze zijn er niet, maar toch moet het project door en moeten er dus keuzes (tijdelijke oplossingen) gemaakt worden. Niet ideaal, maar min of meer inherent aan werken op het nieuwe Common Ground speelveld. Nieuw naast oud; we ontkomen er niet aan, maar het passend maken op elkaar en een juiste route vinden in het in- en uitfaseren is vaak een hele opgave. Hierbij kunnen we helaas niet teruggrijpen op eerdere ervaringen.' WHERE initiatief_id = 48 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-11-01'::date WHERE initiatief_id = 48 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 48   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 48   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 48   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-02-29'::date WHERE initiatief_id = 48 AND rel_id = 1;

-- initiatief_id=49 (Verwerkinglogging implementatie)
UPDATE initiatief_planning_data SET obstakels = 'deze software zou eigenlijk landelijk aangeboden moeten worden, als SaaS,  geen enkele reden voor een gemeente om hier zelf operationeel verantwoordelijk voor te hoeven zijn; er is geen construct waar dit kan landen' WHERE initiatief_id = 49 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-01-02'::date WHERE initiatief_id = 49 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 49 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 49   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 49   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 49   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-01'::date WHERE initiatief_id = 49 AND rel_id = 1;

-- initiatief_id=50 (Coopax)
UPDATE initiatief_planning_data SET obstakels = 'Implementatie verzorgen wij, zal geen probleem opleveren. Bij externe locaties is vaak de uitdaging dat ze niet strategisch hebben nagedacht over opstellen offertes, bij Coopax moet dat wel, want offertes krijgen zelfde opstelling.  In ontwikkeling was het lastig te denken vanuit het planning perspectief, alswel vanuit de locatie perspectief. Moesten we technisch matchen' WHERE initiatief_id = 50 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-01-07'::date WHERE initiatief_id = 50 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 50   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 50   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 1 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 50   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-01'::date WHERE initiatief_id = 50 AND rel_id = 1;

-- initiatief_id=51 (GZAC)
UPDATE initiatief_planning_data SET obstakels = 'De complexiteit van het gehele landschap. Om te kunnen schalen naar kleinere gemeentes met minder kennis en budget moet er verder worden gestandaardiseerd. De Exchange is daar een eerste aanzet toe. Het hoofddoel voor dit jaar is versnelling van de procesimplementaties (en dus vereenvoudiging).  Verder lopen we aan tegen complexiteit in de datalaag door versnippering van de API''s en het gebrek aan een relationeel model in laag 1. Dit kerngroep architectuur van de koplopers heeft dit onderkend, wordt aan gewerkt. Verder is er behoefte aan een PDC. En meer ontwikkelsnelheid - er zijn meer wensen dan tijd.' WHERE initiatief_id = 51 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2020-03-01'::date WHERE initiatief_id = 51 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 51   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 51   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 51   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-02'::date WHERE initiatief_id = 51 AND rel_id = 1;

-- initiatief_id=52 (Open Zaak)
UPDATE initiatief_planning_data SET obstakels = 'Ontwikkeling: Afstemming tussen standaard (VNG) en realisatie (Maykin; Implementatie: Component is geen volledige oplossing (lees: het is geen silo-zaaksysteem)' WHERE initiatief_id = 52 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2020-02-07'::date WHERE initiatief_id = 52 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 52 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 52   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 52   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 52   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-04'::date WHERE initiatief_id = 52 AND rel_id = 1;

-- initiatief_id=53 (Open Formulieren)
UPDATE initiatief_planning_data SET obstakels = '1) Testen met sommige "standaarden" is lastig door het gebrek aan toegang/testset (Suwinet, StUF-ZKN); 2) Gemeenten verschillen onderling enorm in wat ze willen en kunnen; 3) Financiering doorontwikkeling is uitdagend.' WHERE initiatief_id = 53 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2022-03-10'::date WHERE initiatief_id = 53 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 53 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 53   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 53   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 53   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-04'::date WHERE initiatief_id = 53 AND rel_id = 1;

-- initiatief_id=54 (Samen delen)
UPDATE initiatief_planning_data SET obstakels = 'Financiering en stakeholders.' WHERE initiatief_id = 54 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-04-30'::date WHERE initiatief_id = 54 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 54   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 54   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 54   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-04'::date WHERE initiatief_id = 54 AND rel_id = 1;

-- initiatief_id=55 (Open Inwoner Platform (OIP))
UPDATE initiatief_planning_data SET obstakels = 'OIP koppelt middels de ZGW APIs met zowel Open Zaak en de eSuite, uitdaging is het omgaan met verschillende versies van deze APIs waardoor OIP in te zetten is zonder dat een nieuw zaaksysteem nodig is' WHERE initiatief_id = 55 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-06-14'::date WHERE initiatief_id = 55 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 55   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 55   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 55   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-04'::date WHERE initiatief_id = 55 AND rel_id = 1;

-- initiatief_id=56 (Open Zaakbrug)
UPDATE initiatief_planning_data SET obstakels = 'Wij hebben een behoefte, maar deze wordt niet gezien door vng/volgers. Transitie vergt een aanpak waarbij je pragmatische keuzes moet maken en dus niet in één keer perfect kan zijn (en vanuit standaard/vng wil men dit wel), uitrol: beheer, doorontwikkeling, deployment  nieuwe partijen' WHERE initiatief_id = 56 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2022-01-01'::date WHERE initiatief_id = 56 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 56   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 56   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 56   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-05'::date WHERE initiatief_id = 56 AND rel_id = 1;

-- initiatief_id=57 (Osano Registersysteem)
UPDATE initiatief_planning_data SET obstakels = 'Het onderbrengen van het Osano registersysteem in een open source community die de verantwoordelijkheid voor de doorontwikkeling op zich kan nemen.' WHERE initiatief_id = 57 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2016-01-04'::date WHERE initiatief_id = 57 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 57   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 57   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 57   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-05'::date WHERE initiatief_id = 57 AND rel_id = 1;

-- initiatief_id=58 (Open Klant)
UPDATE initiatief_planning_data SET obstakels = 'Open Klant is gestart toen de nieuwe Klanten en Contactmomenten API door VNG werden gelanceerd. Deze API is echter, voor deze definitief, werd door VNG vervangen door de Klantinteracties API. Open Klant speelt in op de nieuwste ontwikkelingen en dat komt met een bepaald risico.' WHERE initiatief_id = 58 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-03-06'::date WHERE initiatief_id = 58 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 58 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 58   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 58   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 58   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-05'::date WHERE initiatief_id = 58 AND rel_id = 1;

-- initiatief_id=59 (vrijBRP (open source BRP voor gemeenten))
UPDATE initiatief_planning_data SET obstakels = 'Wij zijn de eerste grote toepassing en platform van verschillende componenten die volledig van oud (GEMMA) naar nieuw (CG) gaat op het niveau van basisregistraties. Hiervoor moet veel gebeuren, dit met nog veel CG componenten en governance die nog in ontwikkeling zijn. Wij zijn ook het eerste initiatief die gestart is vanuit een marktpartij, dit is voor zowel VNG als gemeenten lastig in te schatten.' WHERE initiatief_id = 59 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2021-02-15'::date WHERE initiatief_id = 59 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 59   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 59   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 59   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-06'::date WHERE initiatief_id = 59 AND rel_id = 1;

-- initiatief_id=60 (Alfresco Documenten API)
UPDATE initiatief_planning_data SET obstakels = 'Veel afstemming met VNG en het OpenZaak team. De API''s kunnen nog wel eens anders geinterpreteerd worden. De common-ground referentie-componenten voldoen soms zelf niet aan de API''s en daar moeten wij dan bugs voor aanmelden bij de VNG. Andere probleem is dat gemeenten laag 2 & 1 zelf niet goed weten te hosten en daarop technisch applicatiebeheer kunnen doen. Dit kan een leverancier met kennis veel sneller/beter/efficienter doen.' WHERE initiatief_id = 60 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2022-02-03'::date WHERE initiatief_id = 60 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 60   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 60   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 60   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-18'::date WHERE initiatief_id = 60 AND rel_id = 1;

-- initiatief_id=61 (Open Notificaties)
UPDATE initiatief_planning_data SET obstakels = 'Notificaties worden door VNG niet breed genoeg gepositioneerd waardoor het niet consistent in andere APIs wordt opgenomen. Dit beperkt de adoptie.' WHERE initiatief_id = 61 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2020-02-01'::date WHERE initiatief_id = 61 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 61 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 61   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 61   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 61   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-07'::date WHERE initiatief_id = 61 AND rel_id = 1;

-- initiatief_id=62 (OpenStad)
UPDATE initiatief_planning_data SET obstakels = 'Organiseren van de community, vinden van structurele funding, adoptie van digitale participatie in de organisatie van deelnemende gemeenten' WHERE initiatief_id = 62 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2019-04-01'::date WHERE initiatief_id = 62 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 62 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 62   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 62   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 62   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-07'::date WHERE initiatief_id = 62 AND rel_id = 1;

-- initiatief_id=63 (OpenServices)
UPDATE initiatief_planning_data SET obstakels = 'Het ontwikkelen van een uniforme aanpak voor het beheer van microservices en de integratie van diensten. Het ontwikkelen van een schaalbaar platform dat kan voldoen aan de eisen van verschillende gemeenten. Het ontwikkelen van een platform dat voldoet aan de eisen van Common Ground en de AVG.' WHERE initiatief_id = 63 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-11-01'::date WHERE initiatief_id = 63 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 63   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 63   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 63   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-11'::date WHERE initiatief_id = 63 AND rel_id = 1;

-- initiatief_id=64 (BRKRegister)
UPDATE initiatief_planning_data SET obstakels = 'Uitdagingen bij de integratie met bestaande kadastrale systemen en het waarborgen van data-integriteit en privacy.' WHERE initiatief_id = 64 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-11-01'::date WHERE initiatief_id = 64 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 64   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 64   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 64   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-11'::date WHERE initiatief_id = 64 AND rel_id = 1;

-- initiatief_id=65 (Zakenregister)
UPDATE initiatief_planning_data SET obstakels = 'Uitdagingen in de integratie met bestaande systemen, het garanderen van data-integriteit en het voldoen aan privacyvereisten. Performance Meervoudig uit te leggen standaarden en interpetatie verschillen tussen leveranciers' WHERE initiatief_id = 65 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2022-01-01'::date WHERE initiatief_id = 65 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 65   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 65   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 65   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-11'::date WHERE initiatief_id = 65 AND rel_id = 1;

-- initiatief_id=66 (Open Index)
UPDATE initiatief_planning_data SET obstakels = 'Sterke afhankenlijkheid van overheden op commerciele partijen voer zoek oplossingen Heeeeeeeeeeel veel lagacy applicaties en bronnen die onderling sterk verschillen PKI ahankenlijkheid van FSC terwijl PKI geen geldig internationaal certificaat is' WHERE initiatief_id = 66 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-11-01'::date WHERE initiatief_id = 66 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 66   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 66   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 66   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-11'::date WHERE initiatief_id = 66 AND rel_id = 1;

-- initiatief_id=67 (Open Registers)
UPDATE initiatief_planning_data SET obstakels = 'Er is nog een gebrek aan overkoepelende API patronen (zo als extend) waardoor het ook lastig is om een overkoepeld framework neer te zetten dat deze patronen ondersteund, commercieel en politiek hebben we er veel last van dat vanuit de VNG alleen de oplossingen van Utrecht / Den Haag worden gezien als het gaat om componenten die standaarden leveren waardoor het moeilijk is voor andere overheden en leveranciers om hun open-source oplossing onder de aandacht te brengen. Dit verminderd het aantal deelnemers in het speelveld en is daarmee schadelijk voor innovatie.' WHERE initiatief_id = 67 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-11-01'::date WHERE initiatief_id = 67 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 67   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 67   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 67   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-03-11'::date WHERE initiatief_id = 67 AND rel_id = 1;

-- initiatief_id=69 (Gemeenschappelijke DataCatalogus (GDC))
UPDATE initiatief_planning_data SET obstakels = 'Vooral de organisationele kant is een uitdaging; hoe leg je de verantwoordelijkheid intern goed vast, en zorg je ervoor dat datasets opgevoerd en bijgehouden worden? In deze fase is het ook een uitdaging hoe we de samenwerking tussen gemeenten vormgeven; hoe gaan we om met budget, prioritering en de communicatie naar geïnteresseerden.' WHERE initiatief_id = 69 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2022-01-01'::date WHERE initiatief_id = 69 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 69 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 69   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 69   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 69   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-04-04'::date WHERE initiatief_id = 69 AND rel_id = 1;

-- initiatief_id=71 (Rx.Mission)
UPDATE initiatief_planning_data SET obstakels = '1) Er zijn weinig productie waardige onderlagen (laag 1 & 2) beschikbaar die de hoge load aan documenten aan kunnen van VTH. 2) het beheer van persoonsgegevens is abominabel in de ZRC. 3) doorontwikkeling van de ZGW standaard gaat te langzaam' WHERE initiatief_id = 71 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2022-01-01'::date WHERE initiatief_id = 71 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 71   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 71   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 71   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-04-05'::date WHERE initiatief_id = 71 AND rel_id = 1;

-- initiatief_id=72 (Rx.Open)
UPDATE initiatief_planning_data SET obstakels = 'Urgentie creëren bij gemeenten om met de Wet open overheid aan de gang te gaan.' WHERE initiatief_id = 72 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-02-01'::date WHERE initiatief_id = 72 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 72 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 72   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 72   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 72   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-04-05'::date WHERE initiatief_id = 72 AND rel_id = 1;

-- initiatief_id=75 (Digitale terinzagelegging)
UPDATE initiatief_planning_data SET obstakels = 'Het proces om deze informatie tot standaard te verklaren is het meest problematisch' WHERE initiatief_id = 75 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2022-07-01'::date WHERE initiatief_id = 75 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 75   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 75   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 75   AND bd.type_bijdrage = 'Regie op gegevens';

-- initiatief_id=76 (Open Archiefbeheer)
UPDATE initiatief_planning_data SET obstakels = 'Er zijn in de ZGW API-standaard enkele gebreken waar dit component last van heeft. Ook is er behoefte om buiten zaken te archiveren wat lastig is door het ontbreken van standaarden.' WHERE initiatief_id = 76 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-09-27'::date WHERE initiatief_id = 76 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 76   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 76   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 76   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-04-29'::date WHERE initiatief_id = 76 AND rel_id = 1;

-- initiatief_id=77 (Appsemble)
UPDATE initiatief_planning_data SET obstakels = 'Onze cultuur is een hele technische. Dat is een grote kracht maar ook een zwakte. We denken dat we in de kern betere software bouwen dan onze concurrenten. Maar op het vlak van sales en marketing is onze aanpak: goede dienstverlening moet uiteindelijk leiden tot positieve mond-tot-mond reclame. Dat heeft een langere opstarttijd nodig en initiatieven als dit Portfolio kunnen dit een handje helpen zonder dat we onze cultuur hoeven te veranderen omdat ik denk dat deze open source en technische cultuur uiteindelijk ook maakt dat we een beter alternatief bieden dan b.v. Mendix, Betty blocks, Powerapps.' WHERE initiatief_id = 77 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-01-01'::date WHERE initiatief_id = 77 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 77   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 77   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 77   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-05-03'::date WHERE initiatief_id = 77 AND rel_id = 1;

-- initiatief_id=78 (Open Producten)
UPDATE initiatief_planning_data SET obstakels = 'Samenwerking met VNG liep zeer stroef. Gemeenten een eenduidig IM laten maken lukte niet. Financiering kwam er niet doorheen.' WHERE initiatief_id = 78 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-11-01'::date WHERE initiatief_id = 78 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 78   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 78   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 78   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-05-03'::date WHERE initiatief_id = 78 AND rel_id = 1;

-- initiatief_id=79 (Tezza)
UPDATE initiatief_planning_data SET obstakels = 'Funding, geen gemeenschappelijke funding, geen gemeenschappelijke visie. We zijn als leverancier toch overal het idee opnieuw aan het verkopen. Veel gemeentes kijken nog steeds kat uit de boom, bijv. er is geen eind-datum aan Stuf-ZKN gezet.' WHERE initiatief_id = 79 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2021-01-01'::date WHERE initiatief_id = 79 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 79   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 79   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 79   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-05-10'::date WHERE initiatief_id = 79 AND rel_id = 1;

-- initiatief_id=80 (Archivering en Vernietigings Component)
UPDATE initiatief_planning_data SET obstakels = 'Te weinig focus of archiveren en vernietigen door gemeenten, de meeste initiatieven focussen alleen op creatie en beheer.' WHERE initiatief_id = 80 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-05-01'::date WHERE initiatief_id = 80 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 80 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 80   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 80   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 1 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 80   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-05-10'::date WHERE initiatief_id = 80 AND rel_id = 1;

-- initiatief_id=81 (Atlas)
UPDATE initiatief_planning_data SET obstakels = '1.' WHERE initiatief_id = 81 AND rel_id = 1;

-- initiatief_id=82 (Werkplek reservering)
UPDATE initiatief_planning_data SET obstakels = 'Testen van daadwerkelijke koppelingen kan vaak even duren voordat IT binnen gemeente de AD heeft opgezet.' WHERE initiatief_id = 82 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-05-31'::date WHERE initiatief_id = 82 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 82   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 82   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 82   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-05-31'::date WHERE initiatief_id = 82 AND rel_id = 1;

-- initiatief_id=83 (Referentielijsten API)
UPDATE initiatief_planning_data SET obstakels = 'Budget en akkoord verkrijgen duurt veel te lang voor een klein component als dit.' WHERE initiatief_id = 83 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-05-29'::date WHERE initiatief_id = 83 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 83 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 83   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 83   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 1 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 83   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-05-31'::date WHERE initiatief_id = 83 AND rel_id = 1;

-- initiatief_id=85 (Open Webconcept)
UPDATE initiatief_planning_data SET obstakels = 'onbekendheid van het concept bij gemeenten.' WHERE initiatief_id = 85 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2020-01-01'::date WHERE initiatief_id = 85 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = true WHERE initiatief_id = 85 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 85   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 85   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 85   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-07-16'::date WHERE initiatief_id = 85 AND rel_id = 1;

-- initiatief_id=86 (Geval (Generieke Validaties))
UPDATE initiatief_planning_data SET obstakels = '1. Het verifiëren van invoer vereist achterliggende ''regels''. Businessrules/beslisregels dus. De vraag is waar dat moet plaats vinden in het 5-laagsmodel. Het hardcoded inbouwen van dergelijke beslisregels is geen goede route. Beslisregels moeten op 1 plek aangepast worden en vervolgens doorwerken naar alle applicaties. 2. Het aanbieden van OpenSource code op github tbv hergebruik werkt op zich. Maar, niemand is eigenaar. Dus wie doet binnen CG dan het afhandelen van bugs, wijzigingsverzoeken, kwaliteitscontrole, etc.?' WHERE initiatief_id = 86 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-08-01'::date WHERE initiatief_id = 86 AND rel_id = 1;
UPDATE initiatief_product_data SET vervangt_ouder_product = false WHERE initiatief_id = 86 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 1 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 86   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 86   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 86   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-10-03'::date WHERE initiatief_id = 86 AND rel_id = 1;

-- initiatief_id=87 (Vergunning Controle Service (VCS))
UPDATE initiatief_planning_data SET obstakels = '1. Nieuwe semantische techniek, dat is nieuw ingericht binnen de gemeente 2. Het ''verservicen'' en open aanbieden van data in bestaande bronnen is uitdagend. 3. De koppeling tussen de informatiemodellen van het gebouwmodel en het stadsmodel en de juridische taal vanuit de regelgeving is een afstemmingsvraagstuk.' WHERE initiatief_id = 87 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-10-01'::date WHERE initiatief_id = 87 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 87   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 87   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 87   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-10-03'::date WHERE initiatief_id = 87 AND rel_id = 1;

-- initiatief_id=88 (Datavirtualisatie)
UPDATE initiatief_planning_data SET obstakels = 'Dat het voor een marktpartij ook tijd kost om bestaande open source software te doorgronden. En dat sparren met een PWO-er van de bestaande open source van meerwaarde kan zijn. Maar wel extra geld kost.' WHERE initiatief_id = 88 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-10-25'::date WHERE initiatief_id = 88 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 88   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 88   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 1 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 88   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2024-09-12'::date WHERE initiatief_id = 88 AND rel_id = 1;

-- initiatief_id=94 (xxllnc Zaken)
UPDATE initiatief_planning_data SET obstakels = 'Nog veel onduidelijkheid en weinig concreetheid in de markt' WHERE initiatief_id = 94 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2018-01-01'::date WHERE initiatief_id = 94 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 94   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 94   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 94   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-01-10'::date WHERE initiatief_id = 94 AND rel_id = 1;

-- initiatief_id=96 (Digitale Medewerker ‘Chatbot MAI’)
UPDATE initiatief_planning_data SET obstakels = 'Datamanagement voor de kennisbank, guardrails, eeen werkende chatbot maken :)' WHERE initiatief_id = 96 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-10-14'::date WHERE initiatief_id = 96 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 96   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 96   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 96   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-02-26'::date WHERE initiatief_id = 96 AND rel_id = 1;

-- initiatief_id=98 (digitaal ondertekenen)
UPDATE initiatief_planning_data SET obstakels = 'Geen grote punten' WHERE initiatief_id = 98 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2025-03-26'::date WHERE initiatief_id = 98 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 98   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 98   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 98   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-03-28'::date WHERE initiatief_id = 98 AND rel_id = 1;

-- initiatief_id=99 (Octopus)
UPDATE initiatief_planning_data SET obstakels = 'Volwassenheid van ZGW bij andere leveranciers.' WHERE initiatief_id = 99 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-01-01'::date WHERE initiatief_id = 99 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 99   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 99   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 99   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-03-31'::date WHERE initiatief_id = 99 AND rel_id = 1;

-- initiatief_id=100 (MyFMS)
UPDATE initiatief_planning_data SET obstakels = 'Elke Gemeente worstelt met een universeel koppelvlak voor IAM daar zijn de meeste vragen over.' WHERE initiatief_id = 100 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2026-03-30'::date WHERE initiatief_id = 100 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 100   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 100   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 1 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 100   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-04-18'::date WHERE initiatief_id = 100 AND rel_id = 1;

-- initiatief_id=101 (iSyNAPS)
UPDATE initiatief_planning_data SET obstakels = 'Ervaringsdata delen met andere gemeenten (transparantie), kwaliteit en volledigheid projectdata, koudwatervrees over AI' WHERE initiatief_id = 101 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2025-07-01'::date WHERE initiatief_id = 101 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 101   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 101   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 101   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-06-05'::date WHERE initiatief_id = 101 AND rel_id = 1;

-- initiatief_id=102 (koppelen Zaaksysteem JOIN (Decos) met OpenWebConcept formulieren)
UPDATE initiatief_planning_data SET obstakels = 'performance van de API''s, derhalve zijn we overgestapt op de meest recente versie' WHERE initiatief_id = 102 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-01-01'::date WHERE initiatief_id = 102 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 102   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 102   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 102   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-06-06'::date WHERE initiatief_id = 102 AND rel_id = 1;

-- initiatief_id=103 (Aansluiting JOIN Zaaksysteem (Decos) op de MijnOmgeving van OWC gemeenten)
UPDATE initiatief_planning_data SET obstakels = 'performance API''s, daarom gemigreerd naar versie 1.5' WHERE initiatief_id = 103 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2025-08-01'::date WHERE initiatief_id = 103 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 103   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 103   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 103   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-06-06'::date WHERE initiatief_id = 103 AND rel_id = 1;

-- initiatief_id=105 (Archiefbeheer)
UPDATE initiatief_planning_data SET obstakels = 'Gevoel van urgentie creeeren om tijdig te vernietigen.  Gebrek aan overheidstandaarden om data te kunnen overbrengen naar e-depots (nogsteeds een uitdaging)' WHERE initiatief_id = 105 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2023-01-01'::date WHERE initiatief_id = 105 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 105   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 105   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 105   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-06-11'::date WHERE initiatief_id = 105 AND rel_id = 1;

-- initiatief_id=106 (Centric Leefomgeving)
UPDATE initiatief_planning_data SET obstakels = 'Het is de standaard manier van werken en zijn de basisprincipes die de basis is voor onze doorontwikkeling. Zowel met ZGW, eDienst worden deze nu uitgerold naar de klanten.' WHERE initiatief_id = 106 AND rel_id = 1;

-- initiatief_id=110 (Digitale Tweeling Nederland Platform | Analyze, Alkmaar en (Stichting i.o.) Digitale Tweeling Nederland)
UPDATE initiatief_planning_data SET obstakels = 'Analyze B.V., in samenwerking met Gemeente Alkmaar' WHERE initiatief_id = 110 AND rel_id = 1;

-- initiatief_id=111 (Djuma DnA)
UPDATE initiatief_planning_data SET obstakels = 'Standaard is zeker nog niet volwassen. Nog veel kinderziektes waar we samen met andere leveranciers tegenaan lopen of die nog onvoldoende gedocumenteerd zijn.' WHERE initiatief_id = 111 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-02-01'::date WHERE initiatief_id = 111 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 111   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 111   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 111   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-07-18'::date WHERE initiatief_id = 111 AND rel_id = 1;

-- initiatief_id=113 (NotifyNL en OMC)
UPDATE initiatief_planning_data SET obstakels = 'Het geautomatiseerd notificeren vereist dat data op orde is en men moet wennen aan het automatisch notificeren in werkprocessen.' WHERE initiatief_id = 113 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-01-01'::date WHERE initiatief_id = 113 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 113   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 113   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 2 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 113   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-08-26'::date WHERE initiatief_id = 113 AND rel_id = 1;

-- initiatief_id=114 (DiVault FLEX (pre-depot))
UPDATE initiatief_planning_data SET obstakels = 'ZGW API wordt geïmplementeerd' WHERE initiatief_id = 114 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2025-09-01'::date WHERE initiatief_id = 114 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 114   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 114   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 114   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-09-01'::date WHERE initiatief_id = 114 AND rel_id = 1;

-- initiatief_id=116 (MapGallery)
UPDATE initiatief_planning_data SET obstakels = 'Het behouden van een gebruikersvriendelijk en generiek product, zonder in te leveren op mogelijkheden en klantspecifieke wensen' WHERE initiatief_id = 116 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2025-01-01'::date WHERE initiatief_id = 116 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 116   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 116   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 116   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-09-11'::date WHERE initiatief_id = 116 AND rel_id = 1;

-- initiatief_id=117 (Xential)
UPDATE initiatief_planning_data SET obstakels = 'Ketenpartners zien onvoldoende de urgentie en voordelen van common ground' WHERE initiatief_id = 117 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-01-01'::date WHERE initiatief_id = 117 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 117   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 117   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 117   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-10-06'::date WHERE initiatief_id = 117 AND rel_id = 1;

-- initiatief_id=121 (SafeGPT)
UPDATE initiatief_planning_data SET obstakels = 'De technologie is vrij nieuw voor gemeenten. Adoptie is vereist. We nemen dit nu standaard mee in ons offerte traject. Het AI-geletterdheidniveau door gemeentenland is nog erg laag. We werken hier in communityverband aan om gemeenten te scholen richting het gebruik van AI. LLM''s zijn voor niet alles de oplossing. Dat men moet controlleren is niet een simpele controle slag, maar een essentiele interactiestap in het proces voor het gebruiken van AI.' WHERE initiatief_id = 121 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2024-06-01'::date WHERE initiatief_id = 121 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 121   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 121   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 3 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 121   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2025-12-30'::date WHERE initiatief_id = 121 AND rel_id = 1;

-- initiatief_id=122 (ASE Cloud Services)
UPDATE initiatief_planning_data SET obstakels = '1. Als startup zoeken wij actief launching partners in de publieke sector die de waarde zien van Europese AI-soevereiniteit 2. Non-EU vendor afhankelijkheid in de markt: Veel "Nederlandse" IT-diensten draaien onbewust op Non-EU servers; bewustwording en transitie naar echte Europese oplossingen kost tijd. 3. Duurzaamheid van AI: De energie-intensiteit van AI terugbrengen was een grote uitdaging. Door innovatieve optimalisatietechnieken - lokale processing, slimme caching, efficiëntere modellen en eliminatie van intercontinentale data transfers - realiseerden wij 95% CO2-reductie. Dezelfde kwaliteit, fractie van de kosten én digitale footprint.' WHERE initiatief_id = 122 AND rel_id = 1;
UPDATE initiatief_planning_data SET verwacht_ready_datum = '2026-01-01'::date WHERE initiatief_id = 122 AND rel_id = 1;
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 122   AND bd.type_bijdrage = 'Wendbaarheid';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 122   AND bd.type_bijdrage = 'Dienstverlening';
UPDATE initiatief_bijdrage_data bd SET score = 4 FROM initiatief_bijdrage b WHERE bd.initiatief_id = b.initiatief_id   AND bd.rel_id = b.rel_id   AND b.initiatief_id = 122   AND bd.type_bijdrage = 'Regie op gegevens';
UPDATE initiatief_initiatiefinfo_data SET aanmeldingsdatum = '2026-01-26'::date WHERE initiatief_id = 122 AND rel_id = 1;

COMMIT;
