// @ts-check
/**
 * store — de store van de simulatie als log (ontwerp §3.4).
 *
 * De store bewaart mutaties en leidt de toestand daaruit af. Eén logregel is
 * één stap van de simulatie met de mutaties van die stap; de vorm lijkt op het
 * paar registratie en wijziging uit het register (één stap = één registratie,
 * elke mutatie = één wijziging), zonder bitemporele tijdlijnen.
 *
 * Alles wat de simulatie weet staat in het log: de cm-objecten, maar ook de
 * procesinstanties (zelf objecten, type `Procesinstantie`), de tokens, de
 * procesvariabelen en de gaten. Terugspoelen is daardoor het log afkappen en
 * de toestand opnieuw afleiden.
 *
 * Mutaties (`soort`):
 *   maak      {id, type, data}            een nieuw object
 *   zet       {id, velden}                velden van een bestaand object
 *   overgang  {id, veld, naar}            de state van een object verandert (`van` vult de store in)
 *   verbind   {van, naar, rol}            een relatie tussen twee objecten
 *   ontbind   {van, naar, rol}
 *   extern    {actie, doel, verwijzing}   iets buiten het cm (een ZGW-actie met een stub, ontwerp §8 vraag 8)
 *   variabele {naam, waarde}              een procesvariabele van de afhandeling
 *   token     {id, instantie, plek, …}    een token verplaatst; plek null = verbruikt
 *   gat       {id, open, …}               een gat ontstaat of wordt gevuld
 *   bericht   {naam, weg?}                een geworpen bericht wacht op een ontvanger (weg = opgehaald)
 *
 * M0 (simulatie): dezelfde vorm als geregistreerde instanties, maar er wordt
 * niets in een register geschreven.
 *
 * Puur.
 */

export const PROCESINSTANTIE = "Procesinstantie";

/** @returns {any} */
export function legeToestand() {
  return { objecten: {}, relaties: [], extern: [], variabelen: {}, tokens: {}, gaten: {}, berichten: [] };
}

const kopie = (w) => (w === undefined ? w : JSON.parse(JSON.stringify(w)));

/**
 * Past één mutatie toe op de toestand (ter plekke) en geeft de mutatie terug
 * zoals hij in het log hoort (bij een overgang met `van` ingevuld).
 */
export function pasToe(toestand, mutatie) {
  const m = mutatie;
  switch (m.soort) {
    case "maak":
      if (toestand.objecten[m.id]) throw new Error(`Object "${m.id}" bestaat al`);
      toestand.objecten[m.id] = { id: m.id, type: m.type, data: kopie(m.data) || {} };
      return m;
    case "zet": {
      const o = toestand.objecten[m.id];
      if (!o) throw new Error(`Object "${m.id}" bestaat niet`);
      Object.assign(o.data, kopie(m.velden));
      return m;
    }
    case "overgang": {
      const o = toestand.objecten[m.id];
      if (!o) throw new Error(`Object "${m.id}" bestaat niet`);
      const van = o.data[m.veld] ?? null;
      o.data[m.veld] = m.naar;
      return "van" in m ? m : { ...m, van };
    }
    case "verbind":
      toestand.relaties.push({ van: m.van, naar: m.naar, rol: m.rol });
      return m;
    case "ontbind":
      toestand.relaties = toestand.relaties.filter((r) => !(r.van === m.van && r.naar === m.naar && r.rol === m.rol));
      return m;
    case "extern": {
      const { soort, ...rest } = m;
      toestand.extern.push(kopie(rest));
      return m;
    }
    case "variabele":
      toestand.variabelen[m.naam] = kopie(m.waarde);
      return m;
    case "token": {
      const { soort, ...rest } = m;
      if (m.plek === null) delete toestand.tokens[m.id];
      else toestand.tokens[m.id] = { ...toestand.tokens[m.id], ...kopie(rest) };
      return m;
    }
    case "gat": {
      const { soort, ...rest } = m;
      toestand.gaten[m.id] = { ...toestand.gaten[m.id], ...kopie(rest) };
      return m;
    }
    case "bericht":
      if (m.weg) toestand.berichten = toestand.berichten.filter((b) => b.naam !== m.naam);
      else toestand.berichten.push({ naam: m.naam });
      return m;
    default:
      throw new Error(`Onbekende mutatie "${m.soort}"`);
  }
}

/**
 * De toestand na de eerste `totEnMet` logregels (standaard: het hele log).
 * @param {{wijzigingen: any[]}[]} log
 * @param {number} [totEnMet]
 */
export function toestandUit(log, totEnMet = log.length) {
  const t = legeToestand();
  for (const regel of log.slice(0, totEnMet)) for (const m of regel.wijzigingen) pasToe(t, m);
  return t;
}

/** Objecten van een cm-type (of `Procesinstantie`). */
export const objectenVanType = (toestand, type) => Object.values(toestand.objecten).filter((o) => o.type === type);

/**
 * Waarom heeft dit object deze toestand: de logregels die het geraakt hebben.
 * @returns {{nr: number, wat: string, wijzigingen: any[]}[]}
 */
export function spoorVan(log, objectId) {
  return log
    .map((regel) => ({ nr: regel.nr, wat: regel.wat, wijzigingen: regel.wijzigingen.filter((m) => m.id === objectId || m.van === objectId || m.naar === objectId) }))
    .filter((regel) => regel.wijzigingen.some((m) => ["maak", "zet", "overgang", "verbind", "ontbind"].includes(m.soort)));
}
