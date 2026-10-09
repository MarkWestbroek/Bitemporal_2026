// @ts-check
/**
 * eaMapping — Sparx EA → requirements-profiel. EA's requirementsdiagram is
 * Diagram_Type "Custom" met `StyleEx` die "MDGDgm=…Requirements…" noemt, of
 * "Requirements" in nieuwere versies; de lezer kijkt naar beide. Puur data;
 * id's zijn een contract (EA-GUID → id).
 *
 * EA-velden per requirement: `t_object.Status` (→ status), `PDATA2` (→
 * prioriteit) en `PDATA3` (→ moeilijkheid) — EA bewaart Priority/Difficulty
 * in de PDATA-kolommen, niet in eigen velden (EA-SYNC, GGM) — `Alias` (→
 * reqId), `Note` (→ tekst), stereotype (→ soort, bv. Functional).
 */

export const EA_DIAGRAM_TYPES = ["Requirements", "Custom"];

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Requirement", elementType: "requirement", opmerking: "Alias → reqId; Note → tekst; Status → status; PDATA2 → prioriteit; PDATA3 → moeilijkheid; stereotype → soort" },
  { objectType: "Feature", elementType: "feature" },
  { objectType: "Issue", elementType: "issue" },
  { objectType: "Change", elementType: "change" },
  { objectType: "Package", elementType: "package" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
  // Alles wat EA verder op een requirementsdiagram zet, als verwijzing
  // (stereotype = het EA Object_Type, kleine letters).
  { objectType: "UseCase", elementType: "verwijzing", opmerking: "stereotype 'use case'" },
  { objectType: "Class", elementType: "verwijzing" },
  { objectType: "Component", elementType: "verwijzing" },
  { objectType: "Actor", elementType: "verwijzing" },
  { objectType: "Activity", elementType: "verwijzing" },
  { objectType: "Object", elementType: "verwijzing" },
  { objectType: "Artifact", elementType: "verwijzing" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "Aggregation", elementType: "aggregatie", opmerking: "deel → geheel; EA: geheel is de kant met DestIsAggregate/SourceIsAggregate" },
  { connectorType: "Realisation", elementType: "realisatie" },
  { connectorType: "Realization", elementType: "realisatie" },
  { connectorType: "Abstraction", stereotype: "trace", elementType: "trace" },
  { connectorType: "Dependency", stereotype: "trace", elementType: "trace" },
  { connectorType: "Abstraction", stereotype: "derive", elementType: "derive" },
  { connectorType: "Dependency", stereotype: "derive", elementType: "derive" },
  { connectorType: "Dependency", stereotype: "verify", elementType: "verify" },
  { connectorType: "Abstraction", stereotype: "refine", elementType: "refine" },
  { connectorType: "Dependency", stereotype: "refine", elementType: "refine" },
  { connectorType: "Dependency", elementType: "dependency", opmerking: "overig stereotype → data.stereotype" },
  { connectorType: "Abstraction", elementType: "dependency" },
  { connectorType: "Generalization", elementType: "generalisatie" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
];

export const RAND_ELEMENTEN = [];
export const CONTAINERS = ["package"];
