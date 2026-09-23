-- Opruimen na de herstructurering van QueryDefinitie (23-09-2026).
--
-- Waarom: de eerste versie van QueryDefinitie (gemerged op 23-09-2026, commit e78c494) had
-- een Meta-GE en een Document-GE zonder `toelichting` en zonder materiële tijd. De tweede
-- versie splitst Meta in losse GE's (Naam, Beschrijving, Status, Toegankelijkheid) en maakt
-- Status, Toegankelijkheid en Document materieel. `dbsetup.CreateTables` werkt met
-- CREATE TABLE IF NOT EXISTS: het maakt nieuwe tabellen aan, maar voegt geen kolommen toe aan
-- bestaande en verwijdert niets. Op een instantie die de eerste versie al heeft gedraaid
-- blijven daardoor de Meta-tabellen staan, en mist `querydefinitie_document_data` de kolom
-- `toelichting` (waardoor elke registratie van een document faalt).
--
-- Wat: alle querydefinitie-tabellen weg, kinderen vóór ouders (foreign keys). Ze zijn op elke
-- instantie leeg (de eerste versie is nooit gevuld); daarna maakt de backend ze bij de
-- eerstvolgende start opnieuw aan.
--
-- Wanneer: éénmalig, vóór het starten van een backend met de tweede versie, op elke instantie
-- die de eerste versie heeft gedraaid (desktop, en de VPS als die tussentijds is bijgewerkt).
-- Een instantie die de eerste versie nooit heeft gedraaid heeft dit niet nodig.
--
-- Controle vooraf (hoort 0 te geven; anders eerst kijken wat erin staat):
--   SELECT count(*) FROM querydefinitie;
--
-- Uitvoeren, bv.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/2026-09-23-querydefinitie-losse-ges-opruimen.sql
--   docker exec -i <postgres-container> psql -U postgres -d <db> -v ON_ERROR_STOP=1 \
--     < scripts/sql/2026-09-23-querydefinitie-losse-ges-opruimen.sql
--
-- Tabelnamen van de tweede versie volgen de GE-namen (QuerydefinitieNaam → querydefinitie_querydefinitienaam).
-- Getest op 23-09-2026 tegen een verse database met de tweede versie: 19 tabellen → 0 → na
-- herstart van de backend weer 19.

BEGIN;

-- 1. Data-, aanvang- en eindetabellen van de GE's (hangen aan hun hub)
DROP TABLE IF EXISTS querydefinitie_meta_data;                 -- eerste versie
DROP TABLE IF EXISTS querydefinitie_querydefinitienaam_data;
DROP TABLE IF EXISTS querydefinitie_querydefinitiebeschrijving_data;
DROP TABLE IF EXISTS querydefinitie_querydefinitiestatus_data;
DROP TABLE IF EXISTS querydefinitie_querydefinitiestatus_aanvang;
DROP TABLE IF EXISTS querydefinitie_querydefinitiestatus_einde;
DROP TABLE IF EXISTS querydefinitie_querydefinitietoegankelijkheid_data;
DROP TABLE IF EXISTS querydefinitie_querydefinitietoegankelijkheid_aanvang;
DROP TABLE IF EXISTS querydefinitie_querydefinitietoegankelijkheid_einde;
DROP TABLE IF EXISTS querydefinitie_document_data;             -- eerste versie
DROP TABLE IF EXISTS querydefinitie_querydefinitiedocument_data;
DROP TABLE IF EXISTS querydefinitie_querydefinitiedocument_aanvang;
DROP TABLE IF EXISTS querydefinitie_querydefinitiedocument_einde;

-- 2. De hubs (hangen aan de entiteit)
DROP TABLE IF EXISTS querydefinitie_meta;                      -- eerste versie
DROP TABLE IF EXISTS querydefinitie_querydefinitienaam;
DROP TABLE IF EXISTS querydefinitie_querydefinitiebeschrijving;
DROP TABLE IF EXISTS querydefinitie_querydefinitiestatus;
DROP TABLE IF EXISTS querydefinitie_querydefinitietoegankelijkheid;
DROP TABLE IF EXISTS querydefinitie_document;                  -- eerste versie
DROP TABLE IF EXISTS querydefinitie_querydefinitiedocument;

-- 3. De materiële plumbing van de entiteit, dan de entiteit zelf
DROP TABLE IF EXISTS querydefinitie_aanvang;
DROP TABLE IF EXISTS querydefinitie_einde;
DROP TABLE IF EXISTS querydefinitie;

COMMIT;

-- Daarna: backend (her)starten; CreateTables maakt de 19 querydefinitie-tabellen opnieuw aan.
