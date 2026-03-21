-- Migratie: hernoem de FK-kolom "id" naar "{entiteit}_id" in de 4 materiële-tijd
-- plumbing-tabellen, zodat de naamgeving consistent is met andere GE-types die
-- naar een bovenliggende entiteit verwijzen (bv. a_u.a_id, a_v.a_id).
-- Voorheen heette deze kolom "id" wat verwarrend was met de entiteit's eigen PK.

-- a_aanvang: id → a_id
ALTER TABLE a_aanvang RENAME COLUMN "id" TO "a_id";

-- a_einde: id → a_id
ALTER TABLE a_einde RENAME COLUMN "id" TO "a_id";

-- b_aanvang: id → b_id
ALTER TABLE b_aanvang RENAME COLUMN "id" TO "b_id";

-- b_einde: id → b_id
ALTER TABLE b_einde RENAME COLUMN "id" TO "b_id";
