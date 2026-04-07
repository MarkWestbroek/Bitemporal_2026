-- Upgrade voor nieuw toegevoegde relationele rolvelden in het CG-model.
--
-- Reden:
-- - In de gegenereerde Go-modellen is `rol` toegevoegd aan relationele _Data-tabellen.
-- - Deze velden zijn string-backed enums in Go, zonder expliciet DB-type in de bun-tags.
-- - Daarom is `TEXT` in PostgreSQL de passende en veilige keuze.
--
-- Betrokken velden:
-- - initiatiefgemeente_data.rol       -> Gemeenterol ('Realiseert', 'Maakt gebruik van')
-- - initiatieforganisatie_data.rol   -> Organisatierol ('Contactorganisatie', 'BetrokkenOrganisatie')
--
-- We houden de kolommen hier bewust nullable voor backward compatibility met bestaande data.
-- Als je later stricter wilt zijn, kun je na backfill alsnog NOT NULL zetten.

ALTER TABLE IF EXISTS initiatiefgemeente_data
    ADD COLUMN IF NOT EXISTS rol TEXT;

ALTER TABLE IF EXISTS initiatieforganisatie_data
    ADD COLUMN IF NOT EXISTS rol TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_initiatiefgemeente_data_rol_values'
    ) THEN
        ALTER TABLE initiatiefgemeente_data
            ADD CONSTRAINT chk_initiatiefgemeente_data_rol_values
            CHECK (rol IS NULL OR rol IN ('Realiseert', 'Maakt gebruik van'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_initiatieforganisatie_data_rol_values'
    ) THEN
        ALTER TABLE initiatieforganisatie_data
            ADD CONSTRAINT chk_initiatieforganisatie_data_rol_values
            CHECK (rol IS NULL OR rol IN ('Contactorganisatie', 'BetrokkenOrganisatie'));
    END IF;
END $$;
