/**
 * nieuwFormulierMapping — pure logica voor een FormulierDefinitie in **nieuw-modus**:
 * van de formulierwaarden (plat, op vol pad `ENT.rol.veld`; lijsten als arrays onder
 * `ENT.rol`) naar de wijzigingen van één registratie die de entiteit én al haar GE's
 * opvoert. Tegenhanger van customFormMapping.bouwCustomWijzigingen, dat een bestaande
 * entiteit bijwerkt.
 *
 * Layout-eigenschappen die hier betekenis hebben (plan 2026-09-22 §5.5):
 *   - veld.vasteWaarde   — niet als invoer getoond; geldt als vaste waarde bij opvoeren
 *                          (bv. Initiatief.aanmeldstatussen.status = "nieuwe_aanmelding").
 *                          Binnen een lijst is het óók het filter van die lijst: meerdere
 *                          lijsten op dezelfde bron (drie bijdragen, gemeenten per rol)
 *                          delen één array en zien elk hun eigen rijen.
 *   - veld.kopieerNaar   — één invoer, twee doelen (startdatum → Initiatief.aanvang.datum).
 *                          De renderer schrijft beide paden; hier tellen ze gewoon mee.
 *   - lijst.min/max      — vaste rij = lijst met min = max = 1 op een vaste waarde.
 *   - lijst.widget       — "meerkeuze": de renderer maakt per aangevinkte optie een rij
 *                          { ...vast, [veld]: optie }; de mapping ziet gewone rijen.
 *
 * Een rij waarin buiten de vaste waarden niets is ingevuld, wordt niet opgevoerd.
 *
 * Adressering: dezelfde als customFormMapping (vol pad = ENT.jsonRolnaam.veld).
 */

/** Wandel de layout af en roep fn(element, padContext) aan; binnen een lijst is padContext de bron. */
export function wandelLayout(el, fn, padContext = null) {
  if (!el) return;
  fn(el, padContext);
  const kinderen = el.type === "conditioneel" ? el.dan : el.elementen;
  const context = el.type === "lijst" ? el.bron : padContext;
  (kinderen || []).forEach((k) => wandelLayout(k, fn, context));
}

/** Vol pad van een veld-element: binnen een lijst relatief aan de bron. */
export function volPadVan(element, padContext) {
  if (!element?.veld) return null;
  if (padContext && !element.veld.includes(".")) return `${padContext}.${element.veld}`;
  return element.veld;
}

function heeftVasteWaarde(el) {
  return el?.type === "veld" && el.vasteWaarde !== undefined && el.vasteWaarde !== null && el.vasteWaarde !== "";
}

/** Vaste waarden buiten lijsten: { volPad → waarde }. (Binnen een lijst gelden ze per rij.) */
export function verzamelVasteWaarden(layout) {
  const uit = {};
  wandelLayout(layout, (el, ctx) => {
    if (heeftVasteWaarde(el) && !ctx) uit[volPadVan(el, ctx)] = el.vasteWaarde;
  });
  return uit;
}

/** De vaste waarden in het sjabloon van één lijst: { relatiefVeld → waarde }. */
export function vasteWaardenVanLijst(lijstEl) {
  const uit = {};
  wandelLayout({ type: "groep", elementen: lijstEl?.elementen || [] }, (el) => {
    if (heeftVasteWaarde(el)) uit[el.veld] = el.vasteWaarde;
  });
  return uit;
}

/** Alle lijst-elementen per bron: { bron → [lijstEl, …] }. */
export function lijstenPerBron(layout) {
  const uit = {};
  wandelLayout(layout, (el) => {
    if (el.type === "lijst" && el.bron) (uit[el.bron] ||= []).push(el);
  });
  return uit;
}

/** Hoort deze rij bij deze lijst? (alle vaste waarden van de lijst komen overeen) */
export function rijPastBijLijst(rij, vast) {
  return Object.entries(vast).every(([k, v]) => String(rij?.[k] ?? "") === String(v));
}

export function leeg(v) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/**
 * De rijen van een bron die opgevoerd moeten worden: rijen waarin buiten de vaste
 * sleutels (van álle lijsten op die bron) iets is ingevuld.
 */
export function bouwLijstItems(lijstEls, waarde) {
  const rijen = Array.isArray(waarde) ? waarde : [];
  const vasteSleutels = new Set();
  (lijstEls || []).forEach((l) => Object.keys(vasteWaardenVanLijst(l)).forEach((k) => vasteSleutels.add(k)));
  return rijen.filter((rij) => rij && Object.entries(rij).some(([k, v]) => !vasteSleutels.has(k) && !k.startsWith("_") && !leeg(v)));
}

const PLUMBING = new Set(["opvoer", "afvoer", "versie", "rel_id"]);

/**
 * bouwNieuwWijzigingen — de wijzigingen van de registratie.
 *
 * @param {object} args
 * @param {object} args.layout        de layout-root
 * @param {object} args.values        formulierwaarden (vol pad → waarde; bron → array)
 * @param {object} args.veldNaarGE    uit customFormMapping.bouwCustomVeldMapping (vol pad → GE-info)
 * @param {object} args.typeMeta      meta van de entiteit
 * @param {number} args.id            het nieuwe entiteit-id
 * @param {Function} [args.coerce]    (raw, veldDef, naam) → gecoërceerde waarde
 * @param {object} [args.materieel]   { aanvangVeldnaam, entiteitIDKolom } voor "<ENT>.aanvang.datum"
 * @returns {{ wijzigingen: Array, ontbrekend: string[] }}  ontbrekend = verplichte velden zonder waarde
 */
export function bouwNieuwWijzigingen({ layout, values, veldNaarGE, typeMeta, id, coerce, materieel = null }) {
  const entiteitVeldnaam = typeMeta?.veldnaam || String(typeMeta?.typenaam || "").toLowerCase();
  const wijzigingen = [{ opvoer: { [entiteitVeldnaam]: { id } } }];
  const ontbrekend = [];
  const alleWaarden = { ...verzamelVasteWaarden(layout), ...(values || {}) };

  // Materiële aanvang van de entiteit zelf (via kopieerNaar of een eigen veld).
  const aanvangPad = `${typeMeta?.typenaam}.aanvang.datum`;
  if (materieel?.aanvangVeldnaam && !leeg(alleWaarden[aanvangPad])) {
    const item = { datum: alleWaarden[aanvangPad] };
    if (materieel.entiteitIDKolom) item[materieel.entiteitIDKolom] = id;
    wijzigingen.push({ opvoer: { [materieel.aanvangVeldnaam]: item } });
  }

  // Enkelvoudige GE's: groepeer platte waarden per GE.
  const perGE = {};
  for (const [pad, waarde] of Object.entries(alleWaarden)) {
    if (Array.isArray(waarde) || pad === aanvangPad) continue;
    const info = veldNaarGE?.[pad];
    if (!info || info.isMeervoudig || info.isParentVeld) continue;
    const key = info.childMeta?.typenaam;
    if (!key) continue;
    (perGE[key] ||= { info, waarden: {} }).waarden[pad] = waarde;
  }
  for (const { info, waarden } of Object.values(perGE)) {
    const hubMeta = info.childMeta;
    const payload = {};
    if (hubMeta.entiteitIDKolom) payload[hubMeta.entiteitIDKolom] = id;
    let iets = false;
    const bronVelden = info.bronVelden || info.dataMeta?.velden || hubMeta?.velden || [];
    for (const v of bronVelden) {
      const naam = v?.naam;
      if (!naam || PLUMBING.has(naam) || v.autoIncrement) continue;
      if (hubMeta.entiteitIDKolom && naam === hubMeta.entiteitIDKolom) continue;
      const pad = `${info.entTypenaam}.${info.rol}.${naam}`;
      const raw = waarden[pad];
      if (leeg(raw)) {
        if (v.verplicht && Object.values(waarden).some((w) => !leeg(w))) ontbrekend.push(pad);
        continue;
      }
      payload[naam] = coerce ? coerce(raw, v, naam) : raw;
      iets = true;
    }
    if (iets) wijzigingen.push({ opvoer: { [hubMeta.veldnaam || hubMeta.padnaam]: payload } });
  }

  // Lijsten (meervoudige GE's en relaties): één opvoer per rij.
  for (const [bron, lijstEls] of Object.entries(lijstenPerBron(layout))) {
    const info = veldNaarGE?.[bron];
    if (!info?.childMeta) continue;
    const hubMeta = info.childMeta;
    const bronVelden = info.bronVelden || info.dataMeta?.velden || hubMeta?.velden || [];
    for (const rij of bouwLijstItems(lijstEls, alleWaarden[bron])) {
      const payload = {};
      if (hubMeta.entiteitIDKolom) payload[hubMeta.entiteitIDKolom] = id;
      for (const v of bronVelden) {
        const naam = v?.naam;
        if (!naam || PLUMBING.has(naam) || v.autoIncrement) continue;
        if (hubMeta.entiteitIDKolom && naam === hubMeta.entiteitIDKolom) continue;
        const raw = rij[naam];
        if (leeg(raw)) {
          if (v.verplicht) ontbrekend.push(`${bron}.${naam}`);
          continue;
        }
        payload[naam] = coerce ? coerce(raw, v, naam) : raw;
      }
      wijzigingen.push({ opvoer: { [hubMeta.veldnaam || hubMeta.padnaam]: payload } });
    }
  }

  return { wijzigingen, ontbrekend };
}
