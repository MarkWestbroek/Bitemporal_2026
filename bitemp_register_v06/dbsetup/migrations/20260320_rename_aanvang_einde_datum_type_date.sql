-- Hernoem het waarde-kolom in de aanvang/einde plumbing-tabellen
-- van de oorspronkelijke naam (aanvang / einde) naar datum,
-- en wijzig het type van timestamptz naar date.
-- Van toepassing op alle 8 aanvang/einde-tabellen.

BEGIN;

ALTER TABLE a_aanvang RENAME COLUMN aanvang TO datum;
ALTER TABLE a_aanvang ALTER COLUMN datum TYPE date USING datum::date;

ALTER TABLE a_einde RENAME COLUMN einde TO datum;
ALTER TABLE a_einde ALTER COLUMN datum TYPE date USING datum::date;

ALTER TABLE b_aanvang RENAME COLUMN aanvang TO datum;
ALTER TABLE b_aanvang ALTER COLUMN datum TYPE date USING datum::date;

ALTER TABLE b_einde RENAME COLUMN einde TO datum;
ALTER TABLE b_einde ALTER COLUMN datum TYPE date USING datum::date;

ALTER TABLE a_w_aanvang RENAME COLUMN aanvang TO datum;
ALTER TABLE a_w_aanvang ALTER COLUMN datum TYPE date USING datum::date;

ALTER TABLE a_w_einde RENAME COLUMN einde TO datum;
ALTER TABLE a_w_einde ALTER COLUMN datum TYPE date USING datum::date;

ALTER TABLE rel_a_b_aanvang RENAME COLUMN aanvang TO datum;
ALTER TABLE rel_a_b_aanvang ALTER COLUMN datum TYPE date USING datum::date;

ALTER TABLE rel_a_b_einde RENAME COLUMN einde TO datum;
ALTER TABLE rel_a_b_einde ALTER COLUMN datum TYPE date USING datum::date;

COMMIT;
