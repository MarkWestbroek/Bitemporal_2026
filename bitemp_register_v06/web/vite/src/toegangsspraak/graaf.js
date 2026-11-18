// @ts-check
/**
 * graaf — **lezer**: een Toegangsspraak-beleid (AST) als brongraaf.
 *
 * Eerste stap van de export naar ODRL (zie docs/TRANSFORMATIES.md §3). De
 * syntax zit in de parser; dit bestand legt de zin uit elkaar tot knopen en
 * verbindingen, in de begrippen van de taal zelf. Wat een onderdeel in ODRL
 * wordt staat hier níet — dat is de regelset (`odrlApNlRegels.js`).
 *
 * Knopen dragen `aard` (de toepasser gebruikt `soort` zelf voor knoop/groep/
 * verbinding) en `tekst`, de zinsnede uit de klare taal:
 *
 *   beleid · grondslag · doel
 *   regel (modaliteit mag / mag-niet, met de hele zin)
 *   handeling (per regel: het werkwoord)
 *   partij (wie) · gegevensbegrip (wat, als begrip) · registerdeel (pad in het
 *     model, niveau entiteit / gegevenselement / veld)
 *   voorwaarde (anker, subpad, operator, waarde) · voorwaardegroep (en/of/xof)
 *   plicht
 *   term — een woord uit de taal dat in het doel een eigen naam nodig heeft:
 *     operand, operator, handeling, plichthandeling, niveau
 *
 * Verbindingen dragen `aard`: regel, grondslag, doel, afbakening, doet, wie, wat, als, lid,
 * waarbij, onderdeel-van, waarde, zie-ook, niveau, kenmerk.
 *
 * Eén keuze van de lezer verdient uitleg: **waar een voorwaarde aan hangt.**
 * Een voorwaarde over het verzoek zelf (aanvraag, aanvrager) hangt aan de
 * handeling — ze is te toetsen voordat de bron iets ophaalt. Een voorwaarde
 * over de gegevens (betrokkene, veldwaarde) of een bestaansvraag hangt aan de
 * regel: die is pas te toetsen met de gegevens in handen. `over` op de
 * voorwaarde zegt welke van de twee het is.
 *
 * De `waarde` van een voorwaarde is **getypeerd** (geen ingebedde notatie):
 * een getal, een boolean, `{ letterlijk }` voor tekst, `{ datum }`, of een lijst
 * daarvan. Is de waarde een ander onderdeel van het beleid (de doelbinding), dan
 * is het een verbinding `waarde`, geen eigenschap. Zo ook `zie-ook` (operand →
 * registerdeel) en `niveau` (registerdeel → term).
 *
 * Dit bestand leest geen syntax: het geeft het graafbeeld van een model, de
 * pijl "model (bereik)" in het schema van docs/TRANSFORMATIES.md §3. Voor de
 * toepasser is dat dezelfde rol als een lezer.
 *
 * Puur en zonder dependencies buiten de taal zelf.
 */
import { verwijzingNaarPad, verwijzingNaarGroepPad } from "./parser.js";
import { renderBeleid, renderVerwijzing, renderVoorwaarde } from "./renderer.js";
import { vindOperator } from "./operatoren.js";
import { slug, woordenNaarVeldnaam, camelNaarWoorden, lidwoordVoor } from "./woorden.js";

const NIVEAUS = ["entiteit", "gegevenselement", "veld"];
const DEFINITIE = {
  aanvraag: "Kenmerk van het verwerkingsverzoek zelf (argument of context); te toetsen voordat de bron iets ophaalt.",
  aanvrager: "Kenmerk van degene die het verzoek doet; te toetsen voordat de bron iets ophaalt.",
  betrokkene: "Gegeven van de persoon over wie de gegevens gaan; pas te toetsen met de gegevens in handen.",
  gegevens: "Waarde in de opgevraagde gegevens; pas te toetsen met de gegevens in handen.",
  veldwaarde: "Waarde van een veld in het register; pas te toetsen met de gegevens in handen.",
  bestaat: "Bestaansvraag aan een informatiepunt: het beleid zegt wát er moet bestaan en voor wie, de uitvoering beantwoordt de vraag.",
};

/** Literal uit de AST → getypeerde waarde. */
const getypeerd = (term) =>
  term.soort !== "literal" ? { letterlijk: renderVerwijzing(term) } : term.type === "getal" ? Number(term.waarde) : term.type === "datum" ? { datum: String(term.waarde) } : { letterlijk: String(term.waarde) };
const ketenSubpad = (keten) => keten.slice().reverse().map((g) => woordenNaarVeldnaam(g.woorden)).join(".");

/**
 * @param {any} beleid  de AST uit parseBeleid
 * @param {Object} [opties]
 * @param {(pad: string) => string} [opties.resolveerPad]    naïef pad → pad in het model
 * @param {(pad: string) => string[]} [opties.kinderenVan]   de delen direct onder een pad
 * @param {string} [opties.uitgegeven]                       publicatiedatum (ISO)
 * @returns {{knopen: any[], groepen: any[], verbindingen: any[], waarschuwingen: any[]}}
 */
export function beleidNaarGraaf(beleid, opties = {}) {
  const resolveer = opties.resolveerPad || ((pad) => pad);
  const kinderenVan = opties.kinderenVan || (() => []);
  const canoniek = renderBeleid(beleid);

  /** @type {Map<string, any>} */
  const knopen = new Map();
  const verbindingen = [];
  const knoop = (id, eigenschappen) => {
    if (!knopen.has(id)) knopen.set(id, { id, ...eigenschappen });
    return id;
  };
  const verbind = (aard, bron, doel, extra = {}) => {
    const id = `${aard}:${bron}>${doel}`;
    if (!verbindingen.some((v) => v.id === id)) verbindingen.push({ id, aard, bron, doel, label: aard, ...extra });
  };
  const term = (id, termsoort, tekst, extra = {}) => knoop(id, { aard: "term", termsoort, tekst, ...extra });

  // De zin per regel en de omschrijving per begrip, uit de canonieke tekst.
  const regelZin = new Map();
  for (const m of canoniek.matchAll(/^ {2}Regel "(.+?)"\.\n((?: {4}.*\n?)+)/gm)) {
    regelZin.set(m[1], m[2].trim().split("\n").map((r) => r.trim()).join(" "));
  }
  const begripZin = (naam) => {
    const veilig = naam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return canoniek.match(new RegExp(`^ {4}(?:(?:Een|De|Het) )?${veilig} (?:is|zijn): (.+)\\.$`, "im"))?.[1] || "";
  };

  // ── het register: paden als delen-van ────────────────────────────────────
  function registerdeel(pad, label) {
    const delen = pad.split(".");
    for (let i = 1; i <= delen.length; i++) {
      const p = delen.slice(0, i).join(".");
      const niveau = NIVEAUS[Math.min(i, 3) - 1];
      const niveauTerm = term(`ts:${niveau[0].toUpperCase()}${niveau.slice(1)}`, "niveau", niveau);
      knoop(`reg:${p}`, {
        aard: "registerdeel",
        niveau,
        pad: p,
        tekst: i === delen.length && label ? label : camelNaarWoorden(delen[i - 1]).join(" "),
      });
      verbind("niveau", `reg:${p}`, niveauTerm);
      if (i > 1) verbind("onderdeel-van", `reg:${p}`, `reg:${delen.slice(0, i - 1).join(".")}`);
    }
    for (const kind of kinderenVan(pad)) registerdeel(kind);
    return `reg:${pad}`;
  }

  // ── doel en grondslag ────────────────────────────────────────────────────
  const doel = (naam) => knoop(`doel-${slug(naam)}`, { aard: "doel", tekst: naam });

  knoop("beleid", {
    aard: "beleid",
    tekst: beleid.naam,
    geldigVanaf: beleid.geldigVanaf || "",
    geldigTot: beleid.geldigTot || "",
    uitgegeven: opties.uitgegeven || "",
    // De canonieke klare taal reist mee (ts:brontekst): de import neemt haar over als ze
    // aantoonbaar hetzelfde zegt als de ODRL, en houdt zo woordkeus en volgorde (odrlImport.js).
    brontekst: canoniek,
    // De superpolicy: hoe regels die elkaar tegenspreken worden afgewogen (ODRL kent prohibit en
    // perm; "de eerste regel geldt" is een eigen term), en wat geldt als geen regel iets zegt
    // (ODRL weigert dan; alleen "toestaan" hoeft gezegd).
    conflict: { "toestemming-wint": "odrl:perm", "eerste-geldt": "ts:eersteRegel" }[beleid.conflict] || "odrl:prohibit",
    standaard: beleid.standaard === "toestaan" ? "toestaan" : "",
    toelichting:
      "Geschreven in Toegangsspraak (klare taal) en daaruit vertaald naar ODRL. Elke regel draagt zijn oorspronkelijke zin als beschrijving." +
      (beleid.doel ? ` Doel: ${beleid.doel}.` : "") +
      (beleid.grondslag ? ` Grondslag: ${beleid.grondslag}.` : ""),
  });
  if (beleid.conflict === "eerste-geldt") term("ts:eersteRegel", "conflictregel", "de eerste regel geldt");
  if (beleid.grondslag) {
    knoop("grondslag", { aard: "grondslag", tekst: beleid.grondslag });
    verbind("grondslag", "beleid", "grondslag");
  }
  /** De doelbinding als voorwaarde; de waarde is een verbinding naar het doel. */
  const doelVoorwaarde = (naam) => {
    const id = knoop(`vw-doel-${slug(naam)}`, {
      aard: "voorwaarde",
      tekst: `het doel van de aanvraag is "${naam}"`,
      anker: "aanvraag",
      subpad: "doel",
      operator: "eq",
      kern: true,
      over: "verzoek",
    });
    verbind("waarde", id, doel(naam));
    return id;
  };
  const beleidsdoel = beleid.doel ? doelVoorwaarde(beleid.doel) : null;
  // Het doel van het beleid zelf (kopregel "Doel:"), los van de voorwaarde die eruit volgt.
  if (beleid.doel) verbind("doel", "beleid", doel(beleid.doel));

  // ── voorwaarden ──────────────────────────────────────────────────────────
  /** Kenmerk van de aanvrager (uit een wie-begrip) als voorwaarde. */
  function kenmerk(k, waarde) {
    const subpad = woordenNaarVeldnaam(k.split(" "));
    const vanVorm = `${lidwoordVoor(k.split(" ").pop())} ${k} van de aanvrager`;
    term(`ts:aanvrager.${subpad}`, "operand", vanVorm, { anker: "aanvrager", subpad, definitie: DEFINITIE.aanvrager });
    return knoop(`vw-aanvrager-${slug(k)}-${slug(waarde)}`, {
      aard: "voorwaarde",
      tekst: `${vanVorm} is "${waarde}"`,
      anker: "aanvrager",
      subpad,
      operator: "eq",
      kern: true,
      waarde: { letterlijk: String(waarde) },
      over: "verzoek",
    });
  }

  /** Een verwijzing als operand: anker en subpad, en bij een pad in het model het registerdeel. */
  function operandVan(verwijzing) {
    const vanVorm = renderVerwijzing(verwijzing);
    if (verwijzing.basis.soort === "type") {
      const subpad = resolveer(verwijzing.pad || verwijzingNaarPad(verwijzing));
      return { anker: "veldwaarde", subpad, vanVorm, deel: registerdeel(subpad, vanVorm), id: `ts:veldwaarde.${subpad}` };
    }
    const subpad = ketenSubpad(verwijzing.keten);
    return { anker: verwijzing.basis.anker, subpad, vanVorm, deel: null, id: `ts:${verwijzing.basis.anker}${subpad ? `.${subpad}` : ""}` };
  }
  /** De term van een operand in de woordenschat (met de zinsnede als label). */
  function operandTerm(o) {
    const id = term(o.id, "operand", o.vanVorm, { anker: o.anker, subpad: o.subpad, definitie: DEFINITIE[o.anker] || "" });
    if (o.deel) verbind("zie-ook", id, o.deel);
    return id;
  }

  function voorwaarde(v) {
    const zin = renderVoorwaarde(v, "stelling");
    const id = `vw-${slug(zin)}`;
    if (v.operator === "bestaat") {
      const e = v.existentie;
      const subpad = woordenNaarVeldnaam(e.woorden);
      term(`ts:bestaat.${subpad}`, "operand", e.woorden.join(" ") + (e.voor ? ` voor ${renderVerwijzing(e.voor)}` : ""), {
        anker: "bestaat",
        subpad,
        definitie: DEFINITIE.bestaat,
      });
      term("ts:bestaat", "operator", "bestaat");
      // "voor …": voor wie het moet bestaan, als verwijzing naar die operand (ts:voor).
      const voor = e.voor ? operandTerm(operandVan(e.voor)) : "";
      return knoop(id, { aard: "voorwaarde", tekst: zin, anker: "bestaat", subpad, operator: "bestaat", kern: false, waarde: !e.ontkenning, voor, over: "bron" });
    }
    const links = operandVan(v.links);
    const { anker, subpad } = links;
    // De doelbinding in een voorwaarde is dezelfde knoop als die van het beleid.
    if (anker === "aanvraag" && subpad === "doel" && v.operator === "eq" && v.rechts?.soort === "literal") return doelVoorwaarde(v.rechts.waarde);
    operandTerm(links);
    const op = vindOperator(v.operator);
    const kern = Boolean(op?.odrl?.startsWith("odrl:"));
    if (!kern) term(`ts:${v.operator}`, "operator", op?.zin || v.operator);
    let waarde;
    if (op?.unair) waarde = true;
    else if (op?.lijst) waarde = v.lijst.map(getypeerd);
    else if (op?.tussen) waarde = [getypeerd(v.rechts), getypeerd(v.rechts2)];
    else if (v.rechts.soort === "literal") waarde = getypeerd(v.rechts);
    // Een verwijzing als rechterterm ("… is de afdeling van de aanvrager"): geen waarde maar een
    // verwijzing naar die operand (odrl:rightOperandReference).
    const waardeVerwijzing = !op?.unair && !op?.lijst && !op?.tussen && v.rechts.soort !== "literal" ? operandTerm(operandVan(v.rechts)) : "";
    return knoop(id, {
      aard: "voorwaarde",
      tekst: zin,
      anker,
      subpad,
      operator: v.operator,
      kern,
      waarde,
      waardeVerwijzing,
      over: anker === "aanvraag" || anker === "aanvrager" ? "verzoek" : "bron",
    });
  }

  let groepTeller = 0;
  function groep(blok, regelId) {
    groepTeller += 1;
    const id = knoop(`${regelId.replace(/^regel-/, "vw-")}-groep-${groepTeller}`, {
      aard: "voorwaardegroep",
      logica: blok.soort,
      tekst: `${{ en: "alle", of: "ten minste één", xof: "precies één" }[blok.soort]} van de volgende voorwaarden`,
    });
    for (const item of blok.items) verbind("lid", id, item.soort === "voorwaarde" ? voorwaarde(item) : groep(item, regelId), { logica: blok.soort });
    return id;
  }

  // ── wie en wat ───────────────────────────────────────────────────────────
  const wieBegrip = (naam) => beleid.begrippen.find((b) => b.soort === "wie" && b.naam.toLowerCase() === naam.toLowerCase());
  const watBegrip = (naam) => beleid.begrippen.find((b) => b.soort === "wat" && b.naam.toLowerCase() === naam.toLowerCase());

  function wie(w) {
    if (w.soort === "iedereen") {
      // Elke partij, ook zonder bekend subject: een groep zonder kenmerken.
      const id = knoop("groep-iedereen", { aard: "partij", tekst: "iedereen", definitie: "iedereen, ook zonder bekend subject (openbaar)" });
      return { id, kenmerken: [] };
    }
    const begrip = w.soort === "begrip" ? wieBegrip(w.naam) : null;
    const kenmerken = w.soort === "iemand" ? w.kenmerken : begrip ? begrip.kenmerken : [{ kenmerk: "rol", waarde: w.naam }];
    const naam = w.soort === "iemand" ? kenmerken.map((k) => `${k.kenmerk} ${k.waarde}`).join(", ") : w.naam;
    const id = knoop(`groep-${slug(naam)}`, {
      aard: "partij",
      tekst: naam,
      definitie: (begrip && begripZin(begrip.naam)) || `iemand met ${kenmerken.map((k) => `${k.kenmerk} "${k.waarde}"`).join(" en ")}`,
    });
    // De kenmerken bepalen wie bij de groep hoort (verbinding `kenmerk`); de
    // regel toetst ze bovendien op het verzoek (verbinding `als`, hieronder).
    const voorwaarden = kenmerken.map((k) => kenmerk(k.kenmerk, k.waarde));
    for (const v of voorwaarden) verbind("kenmerk", id, v);
    return { id, kenmerken: voorwaarden };
  }

  function wat(w) {
    const padVan = (deel) => {
      const v = deel.soort === "alle" ? deel.verwijzing : deel;
      return { v, pad: resolveer(v.pad || (deel.soort === "alle" ? verwijzingNaarGroepPad(v) : verwijzingNaarPad(v))) };
    };
    if (w.soort !== "begrip") {
      const { v, pad } = padVan(w);
      return registerdeel(pad, renderVerwijzing(v));
    }
    const begrip = watBegrip(w.naam);
    const id = knoop(`gegevens-${slug(w.naam)}`, { aard: "gegevensbegrip", tekst: (begrip?.naam || w.naam).toLowerCase(), definitie: begrip ? begripZin(begrip.naam) : "" });
    if (begrip) {
      const { v, pad } = padVan(begrip.wat);
      verbind("onderdeel-van", registerdeel(pad, renderVerwijzing(v)), id);
      // "waarvan …" bakent de populatie af: een voorwaarde op de verzameling zelf.
      if (begrip.waarvan) verbind("afbakening", id, voorwaarde(begrip.waarvan));
    }
    return id;
  }

  // ── regels ───────────────────────────────────────────────────────────────
  for (const [nr, regel] of beleid.regels.entries()) {
    const rs = slug(regel.naam);
    const modaliteit = regel.verbod ? "mag-niet" : "mag";
    // `volgorde`: RDF kent geen volgorde tussen toestemmingen en verboden; het volgnummer houdt die van de tekst.
    const regelId = knoop(`regel-${rs}`, { aard: "regel", tekst: regel.naam, zin: regelZin.get(regel.naam) || "", modaliteit, volgorde: nr + 1 });
    verbind("regel", "beleid", regelId, { modaliteit });

    term(`ts:${regel.actie}`, "handeling", regel.actie);
    const handeling = knoop(`handeling-${rs}`, { aard: "handeling", tekst: regel.actie, actie: regel.actie });
    verbind("doet", regelId, handeling);

    const w = wie(regel.wie);
    verbind("wie", regelId, w.id);
    verbind("wat", regelId, wat(regel.wat));

    for (const k of w.kenmerken) verbind("als", handeling, k, { herkomst: "begrip" });
    const blok = regel.voorwaarden;
    const items = !blok ? [] : blok.soort === "voorwaarde" ? [blok] : blok.soort === "en" ? blok.items : [blok];
    for (const item of items) {
      if (item.soort === "voorwaarde") {
        const id = voorwaarde(item);
        verbind("als", knopen.get(id).over === "verzoek" ? handeling : regelId, id, { herkomst: "regel" });
      } else {
        verbind("als", regelId, groep(item, regelId), { herkomst: "regel" });
      }
    }
    // De doelbinding van het beleid geldt voor wat mag; een verbod geldt
    // ongeacht het doel.
    if (beleidsdoel && !regel.verbod) verbind("als", handeling, beleidsdoel, { herkomst: "beleid" });

    for (const p of regel.plichten) {
      const woord = p.nlgov.split(":").pop();
      term(`ts:${woord}`, "plichthandeling", p.zin);
      verbind("waarbij", regelId, knoop(`plicht-${slug(p.zin)}`, { aard: "plicht", tekst: p.zin, plicht: woord }));
    }
  }

  // Een registerdeel met delen eronder (NatuurlijkPersoon boven NatuurlijkPersoon.Inkomen) is in
  // ODRL een verzameling: `odrl:partOf` wijst naar een AssetCollection, en een regel op de
  // verzameling geldt voor elk lid. De regelset leest dit kenmerk.
  for (const v of verbindingen) {
    const doel = v.aard === "onderdeel-van" ? knopen.get(v.doel) : null;
    if (doel?.aard === "registerdeel") doel.heeftOnderdelen = true;
  }

  return { knopen: [...knopen.values()], groepen: [], verbindingen, waarschuwingen: [] };
}
