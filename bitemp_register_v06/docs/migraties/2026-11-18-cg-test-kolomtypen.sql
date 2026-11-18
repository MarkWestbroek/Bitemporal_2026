-- 2026-11-18 — cg-test (database omnium): vijf tekstkolommen naar het type van het model.
--
-- Aanleiding: docs/KOLOMTYPEN.md. Deze velden waren ooit tekst en zijn in het model
-- (Studio-project Inrichten, schema-versie 7) een tijdstip, ja/nee of geheel getal. dbsetup zet
-- het type van een bestaande kolom niet om, dus de varchar bleef staan.
--
-- Uitvoeren: door de beheerder van het cluster, met psql, als eigenaar van de tabellen.
--   psql -v ON_ERROR_STOP=1 -f 2026-11-18-cg-test-kolomtypen.sql
-- Alles staat in één transactie. Elke controle die faalt breekt af met een melding; dan is er
-- niets gewijzigd. ALTER COLUMN TYPE neemt kort een exclusief slot op de tabel en herschrijft
-- hem (hier hooguit 392 rijen).
--
-- Niet in dit script, bewust:
--   - de vervallen snake_case-tekstkolommen naast de datumvelden (uitgebracht_op, ondersteund_tot,
--     overgenomen_op): de API gebruikt daar de kolom "uitgebrachtOp" enz. van type date;
--   - de weestabel gehandicaptenparkeerkaart_gpkkaartgegevens_data;
--   - registratie en wijziging: de formele historie verandert niet, alleen de opslagvorm van de waarde.

\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------- controles vooraf
DO $$
DECLARE
	r RECORD;
	n BIGINT;
	-- tabel, kolom, verwacht type nu, doeltype, patroon waaraan elke gevulde waarde moet voldoen
	kolommen CONSTANT TEXT[][] := ARRAY[
		['uitrol_uitrolverloop_data', 'gestart_op', 'timestamptz',
			'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'],
		['uitrol_uitrolverloop_data', 'afgerond_op', 'timestamptz',
			'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'],
		['uitrolresultaat_data', 'tijdstip', 'timestamptz',
			'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'],
		['gehandicaptenparkeerkaartaanvraag_gpkaanvraagkaart_data', 'eerdere_kaart', 'boolean',
			'^(true|false)$'],
		['gehandicaptenparkeerkaartaanvraag_gpkaanvraagbeperking_data', 'loopafstand_meter', 'bigint',
			'^-?\d+$']
	];
	i INT;
	huidig TEXT;
BEGIN
	FOR i IN 1 .. array_length(kolommen, 1) LOOP
		SELECT udt_name INTO huidig FROM information_schema.columns
		 WHERE table_schema = current_schema() AND table_name = kolommen[i][1] AND column_name = kolommen[i][2];
		IF huidig IS NULL THEN
			RAISE EXCEPTION 'vooraf: kolom %.% bestaat niet', kolommen[i][1], kolommen[i][2];
		END IF;
		IF huidig NOT IN ('varchar', 'text') THEN
			RAISE EXCEPTION 'vooraf: kolom %.% is % en geen tekst; al omgezet of anders dan verwacht',
				kolommen[i][1], kolommen[i][2], huidig;
		END IF;
		-- Lege tekst kan niet naar een tijdstip, ja/nee of getal: die moet eerst NULL worden, en dat
		-- doet dit script niet stilzwijgend.
		EXECUTE format('SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I !~ %L',
			kolommen[i][1], kolommen[i][2], kolommen[i][2], kolommen[i][4]) INTO n;
		IF n > 0 THEN
			RAISE EXCEPTION 'vooraf: %.% heeft % waarde(n) die niet naar % om te zetten zijn',
				kolommen[i][1], kolommen[i][2], n, kolommen[i][3];
		END IF;
		EXECUTE format('SELECT count(*) FROM %I WHERE %I IS NOT NULL', kolommen[i][1], kolommen[i][2]) INTO n;
		RAISE NOTICE 'vooraf: %.% is %, % gevulde waarde(n), allemaal om te zetten naar %',
			kolommen[i][1], kolommen[i][2], huidig, n, kolommen[i][3];
	END LOOP;
END $$;

-- De waarden vóór het omzetten bewaren, om ze achteraf te vergelijken.
CREATE TEMP TABLE _kolomtype_voor ON COMMIT DROP AS
	SELECT 'gestart_op' AS kolom, uitrol_id::text || '/' || rel_id || '/' || versie AS sleutel, gestart_op AS waarde
	  FROM uitrol_uitrolverloop_data WHERE gestart_op IS NOT NULL
	UNION ALL
	SELECT 'afgerond_op', uitrol_id::text || '/' || rel_id || '/' || versie, afgerond_op
	  FROM uitrol_uitrolverloop_data WHERE afgerond_op IS NOT NULL
	UNION ALL
	SELECT 'tijdstip', ctid::text, tijdstip
	  FROM uitrolresultaat_data WHERE tijdstip IS NOT NULL;

-- uitrolresultaat_data heeft hier geen sleutel die we kennen: vergelijk de som van de momenten.
CREATE TEMP TABLE _kolomtype_som ON COMMIT DROP AS
	SELECT coalesce(sum(extract(epoch FROM tijdstip::timestamptz)), 0) AS som FROM uitrolresultaat_data;

-- ---------------------------------------------------------------- omzetten
ALTER TABLE uitrol_uitrolverloop_data
	ALTER COLUMN gestart_op  TYPE timestamptz USING gestart_op::timestamptz,
	ALTER COLUMN afgerond_op TYPE timestamptz USING afgerond_op::timestamptz;

ALTER TABLE uitrolresultaat_data
	ALTER COLUMN tijdstip TYPE timestamptz USING tijdstip::timestamptz;

ALTER TABLE gehandicaptenparkeerkaartaanvraag_gpkaanvraagkaart_data
	ALTER COLUMN eerdere_kaart TYPE boolean USING eerdere_kaart::boolean;

ALTER TABLE gehandicaptenparkeerkaartaanvraag_gpkaanvraagbeperking_data
	ALTER COLUMN loopafstand_meter TYPE bigint USING loopafstand_meter::bigint;

-- ---------------------------------------------------------------- controles achteraf
DO $$
DECLARE
	voor BIGINT;
	na BIGINT;
	afwijkend BIGINT;
BEGIN
	-- Aantallen gelijk.
	SELECT count(*) INTO voor FROM _kolomtype_voor;
	SELECT (SELECT count(*) FROM uitrol_uitrolverloop_data WHERE gestart_op IS NOT NULL)
	     + (SELECT count(*) FROM uitrol_uitrolverloop_data WHERE afgerond_op IS NOT NULL)
	     + (SELECT count(*) FROM uitrolresultaat_data WHERE tijdstip IS NOT NULL) INTO na;
	IF voor <> na THEN
		RAISE EXCEPTION 'achteraf: % gevulde tijdstippen vóór, % na', voor, na;
	END IF;

	-- Elk tijdstip is hetzelfde moment als de tekst die er stond.
	SELECT count(*) INTO afwijkend
	  FROM _kolomtype_voor v
	  JOIN uitrol_uitrolverloop_data d ON v.sleutel = d.uitrol_id::text || '/' || d.rel_id || '/' || d.versie
	 WHERE (v.kolom = 'gestart_op'  AND v.waarde::timestamptz IS DISTINCT FROM d.gestart_op)
	    OR (v.kolom = 'afgerond_op' AND v.waarde::timestamptz IS DISTINCT FROM d.afgerond_op);
	IF afwijkend > 0 THEN
		RAISE EXCEPTION 'achteraf: % tijdstip(pen) in uitrol_uitrolverloop_data wijken af van de oude tekst', afwijkend;
	END IF;

	SELECT count(*) INTO afwijkend FROM _kolomtype_som s
	 WHERE s.som IS DISTINCT FROM (SELECT coalesce(sum(extract(epoch FROM tijdstip)), 0) FROM uitrolresultaat_data);
	IF afwijkend > 0 THEN
		RAISE EXCEPTION 'achteraf: de tijdstippen in uitrolresultaat_data wijken af van de oude tekst';
	END IF;

	-- De typen staan zoals het model ze verwacht.
	SELECT count(*) INTO na FROM information_schema.columns
	 WHERE table_schema = current_schema() AND (table_name, column_name, udt_name) IN (
		('uitrol_uitrolverloop_data', 'gestart_op', 'timestamptz'),
		('uitrol_uitrolverloop_data', 'afgerond_op', 'timestamptz'),
		('uitrolresultaat_data', 'tijdstip', 'timestamptz'),
		('gehandicaptenparkeerkaartaanvraag_gpkaanvraagkaart_data', 'eerdere_kaart', 'bool'),
		('gehandicaptenparkeerkaartaanvraag_gpkaanvraagbeperking_data', 'loopafstand_meter', 'int8'));
	IF na <> 5 THEN
		RAISE EXCEPTION 'achteraf: % van de 5 kolommen hebben het verwachte type', na;
	END IF;
	RAISE NOTICE 'achteraf: 5 kolommen omgezet, % tijdstippen gelijk gebleven', voor;
END $$;

COMMIT;
