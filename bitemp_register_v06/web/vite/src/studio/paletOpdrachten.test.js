import { test } from "node:test";
import assert from "node:assert/strict";
import { verzamelOpdrachten, filterOpdrachten, groepeerOpdrachten } from "./paletOpdrachten.js";

const menus = [
  { id: "bestand", label: "Bestand", items: [{ id: "herlaad", label: "Pagina herladen", shortcut: "F5", onClick: () => {} }] },
  {
    id: "diagram", label: "Diagram", items: [
      { id: "nieuw", label: "Nieuw diagram…", uitleg: "Maakt een leeg diagram in dit profiel.", onClick: () => {} },
      { type: "separator" },
      { id: "sub", label: "Exporteer", items: [{ id: "png", label: "Als PNG", onClick: () => {} }, { id: "uit", label: "Uit", disabled: true, onClick: () => {} }] },
    ],
  },
  { id: "ganaar", label: "Ga naar", items: [{ id: "x", label: "dubbel", onClick: () => {} }] },
  { id: "help", label: "Help", items: [{ id: "sneltoetsen", label: "Sneltoetsen…", uitleg: "Overzicht van alle toetsen, ook instelbare.", onClick: () => {} }] },
];
const activiteiten = [{ id: "modelleren", label: "Modelleren", uitleg: "Projectboom en diagrammen." }];
const alle = verzamelOpdrachten({ menus, activiteiten, actiefId: "modelleren", setActief: () => {} });

test("verzamelen: submenu als pad, uitleg mee, uitgeschakeld en Ga naar-menu niet dubbel", () => {
  assert.deepEqual(alle.map((o) => o.label), ["Modelleren", "Pagina herladen", "Nieuw diagram…", "Exporteer › Als PNG", "Sneltoetsen…"]);
  assert.equal(alle.find((o) => o.label === "Nieuw diagram…").uitleg, "Maakt een leeg diagram in dit profiel.");
  assert.equal(alle[0].actief, true);
});

test("zoeken: label boven uitleg, beginletters, accenten", () => {
  assert.equal(filterOpdrachten(alle, "nieuw")[0].label, "Nieuw diagram…");
  assert.equal(filterOpdrachten(alle, "nd")[0].label, "Nieuw diagram…"); // beginletters
  assert.equal(filterOpdrachten(alle, "toetsen instelbare")[0].label, "Sneltoetsen…"); // uitleg telt mee
  assert.equal(filterOpdrachten(alle, "png")[0].label, "Exporteer › Als PNG");
  assert.deepEqual(filterOpdrachten(alle, "bestaatniet"), []);
  assert.equal(filterOpdrachten(alle, "").length, alle.length);
});

test("groeperen: menu's in volgorde, Ga naar en Help achteraan", () => {
  assert.deepEqual(groepeerOpdrachten(alle).map((g) => g.groep), ["Bestand", "Diagram", "Ga naar", "Help"]);
});

test("naastStudio: pagina naast de Studio (melding #6)", async () => {
  const { naastStudio } = await import("./paden.js");
  assert.equal(naastStudio("melden.html", "/viz/react/studio/"), "/viz/react/melden.html");
  assert.equal(naastStudio("melden.html", "/viz/react/studio.html"), "/viz/react/melden.html");
});
