// @ts-check
/**
 * koppelsoorten — de soorten (stereotypen) van koppelingen/kruisverbanden, per project.
 *
 * Mark, 07-11: "het zou handig zijn als de stereotypen die je aangemaakt hebt ook in de lijst
 * verschijnen … dan moet je wel ergens die lijst kunnen bewerken". Het project bewaart daarom
 * zijn eigen lijst (`koppelsoorten` in de project-JSON, naast `kruisverbanden`). Zolang een
 * project geen eigen lijst heeft (`null`) geldt de standaardlijst hieronder. Een soort die in een
 * link staat maar niet (meer) in de lijst, blijft zichtbaar (achteraan): er gaat niets verloren.
 *
 * Een soort: `{ soort, stijl: "afhankelijk" | "realisatie", defaultOmgekeerd }`.
 *  - afhankelijk = dependency (gestippeld, open pijl, de soort als «stereotype»), zoals EA;
 *  - realisatie = gestippeld met holle driehoek;
 *  - defaultOmgekeerd = een nieuwe link in de matrix staat kolom→rij (zoals *genereert*).
 *
 * Geen React/DOM: testbaar met `node --test`.
 */

/** @typedef {{soort: string, stijl: string, defaultOmgekeerd: boolean}} Koppelsoort */

export const STIJLEN = [
  { id: "afhankelijk", label: "dependency (open pijl)" },
  { id: "realisatie", label: "realisatie (holle driehoek)" },
];

/** @type {Koppelsoort[]} */
export const STANDAARD_SOORTEN = [
  { soort: "komt voort uit", stijl: "afhankelijk", defaultOmgekeerd: false },
  { soort: "heeft te maken met", stijl: "afhankelijk", defaultOmgekeerd: false },
  { soort: "genereert", stijl: "afhankelijk", defaultOmgekeerd: true },
  { soort: "realiseert", stijl: "realisatie", defaultOmgekeerd: false },
  { soort: "traceert naar", stijl: "afhankelijk", defaultOmgekeerd: false },
  { soort: "verfijnt", stijl: "afhankelijk", defaultOmgekeerd: false },
  { soort: "is afgeleid van", stijl: "afhankelijk", defaultOmgekeerd: false },
  { soort: "voldoet aan", stijl: "afhankelijk", defaultOmgekeerd: false },
];

/** Een nieuwe (vrije) soort: een dependency in de richting rij → kolom. */
export const nieuweSoort = (soort) => ({ soort, stijl: "afhankelijk", defaultOmgekeerd: false });

/**
 * Zet een opgeslagen lijst om naar het huidige formaat; `null` (geen eigen lijst) blijft `null`.
 * Lege namen en dubbelen vallen weg.
 * @returns {Koppelsoort[] | null}
 */
export function normaliseerSoorten(lijst) {
  if (!Array.isArray(lijst)) return null;
  const gezien = new Set();
  const uit = [];
  for (const x of lijst) {
    const soort = (typeof x === "string" ? x : x?.soort || "").trim();
    if (!soort || gezien.has(soort)) continue;
    gezien.add(soort);
    uit.push({
      soort,
      stijl: x?.stijl === "realisatie" ? "realisatie" : "afhankelijk",
      defaultOmgekeerd: !!x?.defaultOmgekeerd,
    });
  }
  return uit;
}

/**
 * De soorten van het project: de eigen lijst (of de standaardlijst), plus de soorten die in de
 * links staan maar niet in de lijst (gesorteerd, achteraan).
 * @param {Koppelsoort[] | null | undefined} eigen
 * @param {{soort?: string}[]} [links]
 * @returns {Koppelsoort[]}
 */
export function effectieveSoorten(eigen, links = []) {
  const basis = eigen ?? STANDAARD_SOORTEN;
  const bekend = new Set(basis.map((t) => t.soort));
  const los = [...new Set((links || []).map((l) => l?.soort).filter((s) => s && !bekend.has(s)))].sort();
  return [...basis, ...los.map(nieuweSoort)];
}

/** Zoek een soort; een onbekende tekent als dependency. */
export function vindSoort(soort, eigen, links) {
  return effectieveSoorten(eigen, links).find((t) => t.soort === soort) || nieuweSoort(soort);
}

/**
 * De eigen lijst met deze soort erbij (als hij er nog niet in staat). Begint vanuit de
 * effectieve lijst, zodat de standaardsoorten bij de eerste eigen soort meekomen.
 * @returns {Koppelsoort[] | null} null = niets veranderd
 */
export function metSoort(eigen, links, soort) {
  const s = (soort || "").trim();
  if (!s) return null;
  const huidig = effectieveSoorten(eigen, links);
  if (eigen && eigen.some((t) => t.soort === s)) return null;
  if (!eigen && STANDAARD_SOORTEN.some((t) => t.soort === s)) return null;
  const basis = huidig.filter((t) => t.soort !== s);
  return [...basis, huidig.find((t) => t.soort === s) || nieuweSoort(s)];
}

/**
 * Hernoem een soort in de lijst én in alle links. Bestaat de nieuwe naam al, dan gaan de twee
 * samen (de links krijgen de bestaande soort, de oude verdwijnt uit de lijst).
 * @returns {{soorten: Koppelsoort[], links: any[]} | null} null = niets te doen
 */
export function hernoemSoort(eigen, links, oud, nieuw) {
  const n = (nieuw || "").trim();
  if (!n || n === oud) return null;
  const huidig = effectieveSoorten(eigen, links);
  const bestaatAl = huidig.some((t) => t.soort === n);
  const soorten = bestaatAl
    ? huidig.filter((t) => t.soort !== oud)
    : huidig.map((t) => (t.soort === oud ? { ...t, soort: n } : t));
  const nieuweLinks = (links || []).map((l) => (l.soort === oud ? { ...l, soort: n } : l));
  return { soorten, links: nieuweLinks };
}

/** Pas stijl/defaultOmgekeerd van één soort aan (in de effectieve lijst). */
export function wijzigSoort(eigen, links, soort, patch) {
  return effectieveSoorten(eigen, links).map((t) => (t.soort === soort ? { ...t, ...patch, soort: t.soort } : t));
}

/** Verwijder een soort uit de lijst. Een soort die nog in links staat, blijft (zie effectieveSoorten). */
export function zonderSoort(eigen, links, soort) {
  return effectieveSoorten(eigen, links).filter((t) => t.soort !== soort);
}

/** Hoeveel links gebruiken deze soort? */
export const gebruikVanSoort = (links, soort) => (links || []).filter((l) => l?.soort === soort).length;

/** Schuif een soort één plek omhoog (-1) of omlaag (+1). */
export function schuifSoort(eigen, links, soort, richting) {
  const lijst = [...effectieveSoorten(eigen, links)];
  const i = lijst.findIndex((t) => t.soort === soort);
  const j = i + richting;
  if (i < 0 || j < 0 || j >= lijst.length) return null;
  [lijst[i], lijst[j]] = [lijst[j], lijst[i]];
  return lijst;
}
