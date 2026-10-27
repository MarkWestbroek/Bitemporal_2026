// @ts-check
/**
 * formulierGraaf — **lezer** voor het formulier-artefact van een e-dienst:
 * V3-model + de stappen uit het e-dienst-inrichtingsmodel (+ M0-items van de
 * referentielijsten) → graaf (docs/TRANSFORMATIES.md §11.6).
 *
 * De e-dienst bepaalt de vorm van het formulier: welke stappen, welke velden
 * in welke volgorde, de key en het label, eventueel `verplicht`, `toonAls` en
 * een afwijkende `component`. Het model levert de feiten van elk veld
 * (basistype, datatype, enum, verwijzing naar een referentielijst, verplicht);
 * die lost `v3Graaf` op, zodat objecttype en formulier dezelfde feiten zien.
 * Welke Form.io-component een veld wordt, staat in de regelset, niet hier.
 *
 * Graaf:
 *
 *   groep  formulier  id <identifier>            — het formulier
 *   groep  stap       id stap:<slug>              — groep: het formulier
 *   knoop  veld       id <modelpad van het veld>  — groep: de stap
 *
 * Een knoop draagt het modelpad als id, net als in het objecttype; zo wijst de
 * trace van het formulier (component-key) en die van het objecttype
 * (property) naar dezelfde modelknoop — de aansluitingscontrole.
 *
 * Puur en store-loos.
 */
import { v3Graaf } from "./v3Graaf.js";

const hoofdletter = (tekst) => String(tekst).charAt(0).toUpperCase() + String(tekst).slice(1);

/**
 * @param {Object} invoer
 * @param {any} invoer.model                 - V3-model (het object onder `model`, of het hele bestand)
 * @param {any} invoer.keuzes                - het formulier-artefact uit het e-dienstmodel ({bron, naam, stappen, inloggen})
 * @param {any[]} [invoer.datatypen]         - de gedeelde datatypebibliotheek
 * @param {Record<string, any[]>} [invoer.referentielijsten] - M0-items per referentielijst, voor de keuzelijsten
 * @returns {{knopen: any[], groepen: any[], verbindingen: any[], waarschuwingen: any[]}}
 */
export function formulierGraaf({ model: invoerModel, keuzes, datatypen = [], referentielijsten = {} }) {
  const model = invoerModel?.model || invoerModel;
  const entiteiten = new Map((model?.entiteiten || []).map((e) => [e.typenaam, e]));
  const waarschuwingen = [];
  const meld = (melding, tekst = "") => waarschuwingen.push({ regel: 0, tekst, melding });

  // De feiten van de gekozen velden via v3Graaf. Relaties van de bron en zijn
  // voorouders tellen alle als ingebed en referentielijsten als code: hier
  // alleen om velden achter een relatie op te lossen, niet als vorm.
  const relaties = {};
  const gezien = new Set();
  for (let e = entiteiten.get(keuzes?.bron); e && !gezien.has(e.typenaam); e = e.erft ? entiteiten.get(e.erft) : undefined) {
    gezien.add(e.typenaam);
    for (const r of e.relaties || []) relaties[r.naam] = { als: "ingebed" };
  }
  const lijsten = [...entiteiten.values()].filter((e) => e.entiteitSubtype === "referentielijst_item");
  const stappen = keuzes?.stappen || [];
  const velden = stappen.flatMap((s) => (s.velden || []).map((v) => v.veld));
  const v3 = v3Graaf({
    model,
    keuzes: { bron: keuzes?.bron, velden, projectie: { relaties, referentielijsten: Object.fromEntries(lijsten.map((e) => [e.typenaam, { als: "code" }])) } },
    datatypen,
  });
  waarschuwingen.push(...v3.waarschuwingen);
  const feiten = new Map(v3.knopen.map((k) => [k.id, k.eigenschappen]));

  /** Keuzes van een referentielijst: waarde = de sleutel (code), label = de omschrijving. */
  function lijstWaarden(naam, pad) {
    const items = referentielijsten[naam];
    if (!items) {
      meld(`Geen items voor referentielijst ${naam}; de keuzelijst blijft leeg`, pad);
      return [];
    }
    const sleutel = (entiteiten.get(naam)?.gegevenselementen || []).flatMap((g) => g.velden).find((v) => v.uniek === "entiteit")?.naam || "code";
    return items.map((item) => ({ label: item.omschrijving ?? item[sleutel], value: item[sleutel] }));
  }

  const groepen = [
    {
      id: keuzes?.identifier,
      aard: "formulier",
      tekst: keuzes?.naam || keuzes?.identifier,
      groep: null,
      eigenschappen: { slug: keuzes?.identifier, inloggen: keuzes?.inloggen || [] },
    },
  ];
  const knopen = [];
  const keys = new Set();
  for (const stap of stappen) {
    const stapId = `stap:${stap.slug}`;
    groepen.push({ id: stapId, aard: "stap", tekst: stap.naam, groep: keuzes?.identifier, eigenschappen: { slug: stap.slug } });
    for (const veld of stap.velden || []) {
      const f = feiten.get(veld.veld);
      if (!f) continue; // v3Graaf meldde het onbekende pad al
      if (keys.has(veld.key)) meld(`Key "${veld.key}" komt twee keer voor in het formulier`, veld.veld);
      keys.add(veld.key);
      const [when, eq] = Object.entries(veld.toonAls || {})[0] || [];
      if (Object.keys(veld.toonAls || {}).length > 1) meld(`toonAls met meer dan één voorwaarde; alleen ${when} telt`, veld.veld);
      const waarden = f.refAls === "code" ? lijstWaarden(f.refNaar, veld.veld) : (f.enumWaarden || []).map((w) => ({ label: hoofdletter(w), value: w }));
      knopen.push({
        id: veld.veld,
        aard: "veld",
        tekst: veld.key,
        groep: stapId,
        // Toetsbaar op het item zelf (regels.js, `past`).
        vasteVorm: Boolean(veld.component),
        refAls: f.refAls || "",
        heeftEnum: Boolean(f.enumWaarden),
        basistype: f.basistype,
        datatype: f.datatype,
        format: f.format,
        eigenschappen: {
          ...f,
          key: veld.key,
          label: veld.label || veld.key,
          // Hulptekst bij het veld alleen uit de e-dienst: de beschrijving in het
          // model is voor wie het schema leest, niet voor wie het formulier invult.
          hulptekst: veld.toelichting || "",
          component: veld.component || "",
          // `verplicht` van de e-dienst gaat voor dat van het model; alleen een
          // expliciete keuze of een verplicht veld komt in `validate`.
          verplicht: veld.verplicht ?? f.verplicht,
          valideerVerplicht: veld.verplicht !== undefined || f.verplicht === true,
          waarden,
          conditional: when ? { show: true, when, eq } : null,
        },
      });
    }
  }
  return { knopen, groepen, verbindingen: [], waarschuwingen };
}
