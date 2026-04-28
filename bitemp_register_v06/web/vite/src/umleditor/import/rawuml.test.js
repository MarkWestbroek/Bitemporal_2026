// rawuml.test.js — tests voor RawUML adapter + orphan-helpers.
// Run met: node --test src/umleditor/import/rawuml.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import {
  rawUMLNaarEditor,
  detecteerOrphans,
  pasOrphanActiesToe,
} from "./rawuml.js";

// === RawUML adapter ===================================================

test("rawUMLNaarEditor: lege input levert lege editor-shape", () => {
  const out = rawUMLNaarEditor({ nodes: [], edges: [] });
  assert.deepEqual(out, { nodes: [], edges: [] });
});

test("rawUMLNaarEditor: undefined input is veilig", () => {
  const out = rawUMLNaarEditor(undefined);
  assert.deepEqual(out, { nodes: [], edges: [] });
});

test("rawUMLNaarEditor: entiteit met velden krijgt correct type", () => {
  const ruw = {
    nodes: [{
      naam: "Persoon",
      stereotypes: ["entiteit"],
      velden: [{ naam: "voornaam", type: "string" }],
    }],
    edges: [],
    bronFormaat: "mermaid",
  };
  const { nodes } = rawUMLNaarEditor(ruw);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, "entiteit");
  assert.equal(nodes[0].data.typenaam, "Persoon");
  assert.equal(nodes[0].data.velden.length, 1);
});

test("rawUMLNaarEditor: edge naar onbekende node maakt placeholder-entiteit", () => {
  const ruw = {
    nodes: [{ naam: "A", stereotypes: ["entiteit"] }],
    edges: [{ bronNaam: "A", doelNaam: "B", soort: "associatie" }],
    bronFormaat: "mermaid",
  };
  const { nodes, edges } = rawUMLNaarEditor(ruw);
  // A en B (auto-gemaakt) moeten beide bestaan
  assert.equal(nodes.length, 2);
  assert.equal(edges.length, 1);
  const namen = nodes.map((n) => n.data.typenaam).sort();
  assert.deepEqual(namen, ["A", "B"]);
});

test("rawUMLNaarEditor: generalisatie wordt kind→ouder met isGeneralization-vlag", () => {
  const ruw = {
    nodes: [
      { naam: "Voertuig", stereotypes: ["entiteit"] },
      { naam: "Auto", stereotypes: ["entiteit"] },
    ],
    edges: [{ bronNaam: "Auto", doelNaam: "Voertuig", soort: "generalisatie" }],
    bronFormaat: "mermaid",
  };
  const { edges } = rawUMLNaarEditor(ruw);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].data.isGeneralization, true);
});

// === Orphan-detectie ==================================================

test("detecteerOrphans: GE zonder parent-entiteit wordt geflagd", () => {
  const graaf = {
    nodes: [
      { id: "ge1", type: "gegevenselement", data: { typenaam: "LosseGE" } },
    ],
    edges: [],
  };
  const orph = detecteerOrphans(graaf);
  assert.equal(orph.length, 1);
  assert.equal(orph[0].type, "gegevenselement");
  assert.equal(orph[0].naam, "LosseGE");
});

test("detecteerOrphans: GE met compositie-edge vanuit entiteit is geen orphan", () => {
  const graaf = {
    nodes: [
      { id: "e1", type: "entiteit", data: { typenaam: "Persoon" } },
      { id: "ge1", type: "gegevenselement", data: { typenaam: "Naam" } },
    ],
    edges: [{ id: "edge1", source: "e1", target: "ge1", data: {} }],
  };
  const orph = detecteerOrphans(graaf);
  assert.equal(orph.length, 0);
});

test("detecteerOrphans: GE met dependency-edge is wél orphan (geen echte parent)", () => {
  const graaf = {
    nodes: [
      { id: "e1", type: "entiteit", data: { typenaam: "X" } },
      { id: "ge1", type: "gegevenselement", data: { typenaam: "GE" } },
    ],
    edges: [{ id: "ed1", source: "e1", target: "ge1", data: { isDependency: true } }],
  };
  const orph = detecteerOrphans(graaf);
  assert.equal(orph.length, 1);
});

test("detecteerOrphans: relatie zonder koppelingen is orphan", () => {
  const graaf = {
    nodes: [{ id: "r1", type: "relatie", data: { typenaam: "Loszwevend" } }],
    edges: [],
  };
  const orph = detecteerOrphans(graaf);
  assert.equal(orph.length, 1);
  assert.equal(orph[0].type, "relatie");
});

test("detecteerOrphans: relatie gekoppeld aan entiteit is geen orphan", () => {
  const graaf = {
    nodes: [
      { id: "e1", type: "entiteit", data: { typenaam: "X" } },
      { id: "r1", type: "relatie", data: { typenaam: "R" } },
    ],
    edges: [{ id: "e", source: "e1", target: "r1", data: {} }],
  };
  const orph = detecteerOrphans(graaf);
  assert.equal(orph.length, 0);
});

// === Orphan-acties ====================================================

test("pasOrphanActiesToe: 'placeholder' voor GE maakt placeholder-entiteit + edge", () => {
  const graaf = {
    nodes: [{ id: "ge1", type: "gegevenselement", data: { typenaam: "GE" } }],
    edges: [],
  };
  const orphans = detecteerOrphans(graaf);
  const result = pasOrphanActiesToe(graaf, orphans, { ge1: "placeholder" });
  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.length, 1);
  const ph = result.nodes.find((n) => n.id !== "ge1");
  assert.ok(ph.data.isPlaceholder);
  assert.match(ph.data.typenaam, /^Placeholder_/);
  assert.equal(result.edges[0].source, ph.id);
  assert.equal(result.edges[0].target, "ge1");
  assert.ok(result.samenvatting.length > 0);
});

test("pasOrphanActiesToe: 'placeholder' voor relatie maakt bron + doel placeholder", () => {
  const graaf = {
    nodes: [{ id: "r1", type: "relatie", data: { typenaam: "R" } }],
    edges: [],
  };
  const orphans = detecteerOrphans(graaf);
  const result = pasOrphanActiesToe(graaf, orphans, { r1: "placeholder" });
  // 1 relatie + 2 placeholders
  assert.equal(result.nodes.length, 3);
  // 2 edges: bronPh→r1, r1→doelPh
  assert.equal(result.edges.length, 2);
  const phs = result.nodes.filter((n) => n.id !== "r1");
  assert.equal(phs.length, 2);
  assert.ok(phs.every((n) => n.data.isPlaceholder));
});

test("pasOrphanActiesToe: 'overslaan' verwijdert orphan + adjacent edges", () => {
  const graaf = {
    nodes: [
      { id: "e1", type: "entiteit", data: { typenaam: "X" } },
      { id: "ge1", type: "gegevenselement", data: { typenaam: "GE" } },
    ],
    edges: [{ id: "ed", source: "e1", target: "ge1", data: { isDependency: true } }],
  };
  const orphans = detecteerOrphans(graaf);
  const result = pasOrphanActiesToe(graaf, orphans, { ge1: "overslaan" });
  assert.equal(result.nodes.find((n) => n.id === "ge1"), undefined);
  // De dependency-edge naar de verwijderde GE moet ook weg zijn
  assert.equal(result.edges.length, 0);
  assert.ok(result.samenvatting.some((s) => s.includes("Overgeslagen")));
});

test("pasOrphanActiesToe: 'abort' gooit Error met code ORPHAN_ABORT", () => {
  const graaf = {
    nodes: [{ id: "ge1", type: "gegevenselement", data: { typenaam: "GE" } }],
    edges: [],
  };
  const orphans = detecteerOrphans(graaf);
  assert.throws(
    () => pasOrphanActiesToe(graaf, orphans, { ge1: "abort" }),
    (err) => err.code === "ORPHAN_ABORT"
  );
});

test("pasOrphanActiesToe: default actie is placeholder", () => {
  const graaf = {
    nodes: [{ id: "ge1", type: "gegevenselement", data: { typenaam: "GE" } }],
    edges: [],
  };
  const orphans = detecteerOrphans(graaf);
  // Geen keuzes meegegeven
  const result = pasOrphanActiesToe(graaf, orphans, {});
  assert.equal(result.nodes.length, 2);
});

test("pasOrphanActiesToe: gemengde keuzes — abort breekt af zonder mutaties", () => {
  const graaf = {
    nodes: [
      { id: "ge1", type: "gegevenselement", data: { typenaam: "GE1" } },
      { id: "ge2", type: "gegevenselement", data: { typenaam: "GE2" } },
    ],
    edges: [],
  };
  const orphans = detecteerOrphans(graaf);
  assert.throws(
    () => pasOrphanActiesToe(graaf, orphans, { ge1: "placeholder", ge2: "abort" }),
    (err) => err.code === "ORPHAN_ABORT"
  );
});
