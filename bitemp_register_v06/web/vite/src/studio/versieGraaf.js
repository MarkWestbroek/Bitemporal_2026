// @ts-check
/**
 * versieGraaf — de graaf van uitgebrachte versies van een centraal project (plan "Sidecar-project"
 * §10, stap 10; Mark 22-11): liefst één lijn, met **onderhoudslijnen** (een patch op een oudere
 * X.Y terwijl de hoofdlijn verder is) en **terugmergen** (een versie met twee ouders). De regels
 * op de server staan in `handlers/studio_versiegraaf.go`; dit is de Studio-kant: indelen,
 * tekenen en voorstellen.
 *
 * Puur.
 */
import { vergelijkVersie, parseVersie } from "./centraal.js";

/** "X.Y" van een versie. */
export const lijnVan = (versie) => {
  const v = parseVersie(versie) || [0, 0, 0];
  return `${v[0]}.${v[1]}`;
};

/** Versies van één soort, oplopend in volgorde van uitbrengen (anders op nummer). */
function opVolgorde(versies) {
  return [...versies].sort((a, b) => {
    const ta = Date.parse(a.uitgebracht || "");
    const tb = Date.parse(b.uitgebracht || "");
    if (!isNaN(ta) && !isNaN(tb) && ta !== tb) return ta - tb;
    return vergelijkVersie(a.versie, b.versie);
  });
}

/**
 * Per versie de lijn: "hoofd" als ze bij het uitbrengen hoger was dan alles ervoor, anders de
 * onderhoudslijn "X.Y".
 * @returns {Map<string, string>}
 */
export function lijnen(versies) {
  const uit = new Map();
  let hoogste = "";
  for (const u of opVolgorde(versies)) {
    if (!hoogste || vergelijkVersie(u.versie, hoogste) > 0) {
      uit.set(u.versie, "hoofd");
      hoogste = u.versie;
    } else {
      uit.set(u.versie, lijnVan(u.versie));
    }
  }
  return uit;
}

/** Alle voorouders van een versie (via `ouders`), zonder de versie zelf. */
export function voorouders(versie, versies) {
  const per = new Map(versies.map((u) => [u.versie, u]));
  const uit = new Set();
  const stapel = [...(per.get(versie)?.ouders || []).map((o) => o.versie)];
  while (stapel.length) {
    const v = stapel.pop();
    if (uit.has(v)) continue;
    uit.add(v);
    for (const o of per.get(v)?.ouders || []) stapel.push(o.versie);
  }
  return uit;
}

/**
 * Onderhoudsversies die nog niet in de hoofdlijn zitten (geen voorouder van de hoogste versie):
 * kandidaten voor een tweede ouder bij de volgende versie van de hoofdlijn. Hoogste per lijn.
 */
export function nietTeruggemerged(versies) {
  if (!versies.length) return [];
  const top = [...versies].sort((a, b) => vergelijkVersie(b.versie, a.versie))[0].versie;
  const binnen = voorouders(top, versies);
  binnen.add(top);
  const l = lijnen(versies);
  const perLijn = new Map();
  for (const u of versies) {
    const lijn = l.get(u.versie);
    if (lijn === "hoofd" || binnen.has(u.versie)) continue;
    if (!perLijn.has(lijn) || vergelijkVersie(u.versie, perLijn.get(lijn)) > 0) perLijn.set(lijn, u.versie);
  }
  // Alleen als het hoogste van de lijn er nog niet in zit (een lagere die er wel in zit, telt niet).
  return [...perLijn.values()].filter((v) => !binnen.has(v)).sort((a, b) => vergelijkVersie(b, a));
}

/** De volgende patch op een lijn "X.Y" (na de hoogste die er is). */
export function volgendeOnderhoud(lijn, versies) {
  let top = null;
  for (const u of versies) if (lijnVan(u.versie) === lijn && (!top || vergelijkVersie(u.versie, top) > 0)) top = u.versie;
  const v = parseVersie(top || `${lijn}.0`) || [0, 0, 0];
  return top ? `${v[0]}.${v[1]}.${v[2] + 1}` : `${lijn}.0`;
}

/**
 * Waar een onderhoudslijn kan beginnen: per oudere lijn X.Y (niet die van de hoogste versie) de
 * hoogste versie erin.
 * @returns {{lijn: string, vanaf: string, volgende: string}[]}
 */
export function onderhoudStartpunten(versies) {
  if (!versies.length) return [];
  const top = [...versies].sort((a, b) => vergelijkVersie(b.versie, a.versie))[0].versie;
  const perLijn = new Map();
  for (const u of versies) {
    const lijn = lijnVan(u.versie);
    if (lijn === lijnVan(top)) continue;
    if (!perLijn.has(lijn) || vergelijkVersie(u.versie, perLijn.get(lijn)) > 0) perLijn.set(lijn, u.versie);
  }
  return [...perLijn.entries()]
    .sort((a, b) => vergelijkVersie(`${b[0]}.0`, `${a[0]}.0`))
    .map(([lijn, vanaf]) => ({ lijn, vanaf, volgende: volgendeOnderhoud(lijn, versies) }));
}

/**
 * De indeling om te tekenen: per versie een knoop (kolom = volgorde van uitbrengen, rij = lijn:
 * 0 de hoofdlijn, daaronder per onderhoudslijn, nieuwste lijn eerst) en per ouder een lijn.
 * @returns {{knopen: {versie: string, kolom: number, rij: number, lijn: string, u: any}[], lijnen: {van: string, naar: string, merge: boolean}[], rijen: string[]}}
 */
export function graafIndeling(versies) {
  const l = lijnen(versies);
  const onderhoud = [...new Set([...l.values()].filter((x) => x !== "hoofd"))].sort((a, b) => vergelijkVersie(`${b}.0`, `${a}.0`));
  const rijen = ["hoofd", ...onderhoud];
  const knopen = opVolgorde(versies).map((u, kolom) => ({ versie: u.versie, kolom, rij: rijen.indexOf(l.get(u.versie)), lijn: l.get(u.versie), u }));
  const bekend = new Set(versies.map((u) => u.versie));
  const verbindingen = [];
  for (const u of versies) {
    const ouders = (u.ouders || []).map((o) => o.versie).filter((v) => bekend.has(v));
    ouders.forEach((o, i) => verbindingen.push({ van: o, naar: u.versie, merge: i > 0 }));
  }
  return { knopen, lijnen: verbindingen, rijen };
}
