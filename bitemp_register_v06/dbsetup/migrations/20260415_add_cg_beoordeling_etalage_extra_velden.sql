-- Upgrade voor de CG Portfolio modeluitbreiding (juni 2025).
--
-- Reden:
-- - Nieuwe velden toegevoegd aan bestaande _Data-tabellen op basis van de
--   analyse van extra-data uit SharePoint-exports (zie ANALYSE_EXTRA_DATA.md).
-- - Nieuwe tabellen (initiatief_beoordeling, initiatief_beoordeling_data,
--   initiatief_beoordeling_aanvang, initiatief_beoordeling_einde,
--   initiatief_etalage, initiatief_etalage_data) worden automatisch aangemaakt
--   door de Bun ORM IfNotExists()-logica bij het starten van de backend.
--
-- Dit script voegt alleen KOLOMMEN toe aan BESTAANDE tabellen.
-- Alle kolommen zijn nullable voor backward compatibility.
--
-- Let op: voer dit script uit op de applicatie-database (standaard: bitemp_go_db_v06),
-- niet op de postgres systeemdatabase.
--
-- Betrokken tabellen en nieuwe kolommen:
-- - initiatief_planning_data.obstakels             -> TEXT
-- - initiatief_planning_data.verwacht_ready_datum   -> DATE
-- - initiatief_product_data.vervangt_ouder_product  -> BOOLEAN
-- - initiatief_bijdrage_data.score                  -> INTEGER
-- - initiatief_initiatiefinfo_data.aanmeldingsdatum -> DATE

-- Planning: obstakels en verwachte ready-datum
ALTER TABLE IF EXISTS public.initiatief_planning_data
    ADD COLUMN IF NOT EXISTS obstakels TEXT;

ALTER TABLE IF EXISTS public.initiatief_planning_data
    ADD COLUMN IF NOT EXISTS verwacht_ready_datum DATE;

-- Product: vervangt een ouder product?
ALTER TABLE IF EXISTS public.initiatief_product_data
    ADD COLUMN IF NOT EXISTS vervangt_ouder_product BOOLEAN;

-- Bijdrage: numerieke score
ALTER TABLE IF EXISTS public.initiatief_bijdrage_data
    ADD COLUMN IF NOT EXISTS score INTEGER;

-- Initiatiefinfo: aanmeldingsdatum
ALTER TABLE IF EXISTS public.initiatief_initiatiefinfo_data
    ADD COLUMN IF NOT EXISTS aanmeldingsdatum DATE;
