import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray, platSlaHubItems, platSlaAlleVersies, tUitRegistratieTijdstip } from "../../shared/schemaUtils";
import { evalueerCelExpressie, bouwCelContext, evalueerWeergaveVeldenVoorItem } from "../../shared/celEvaluator";
import RepresentatieFormulier from "./RepresentatieFormulier";
import { useFormulierDefinitie } from "../../hooks/useFormulierDefinitie";
import CustomFormulierRenderer from "./CustomFormulierRenderer";
import { coercedWaardeVoorVeld } from "../actions/ActionFormParts";

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * filterActueel — filtert platgeslagen items op formele geldigheid.
 *
 * Bitemporele context:
 *   - Een GE/relatie is "actueel" als het een opvoer heeft en géén afvoer.
 *   - Na een ongedaanmaking kan de opvoer ontbreken → dan is het record niet meer geldig.
 *   - Bij een nieuwe versie van een enkelvoudig GE (bijv. Partnernaam_Data v2)
 *     wordt de vorige versie afgevoerd (afvoer gezet); de nieuwe is actueel.
 *
 * Na platSlaan bevat het item de opvoer/afvoer van het hub-record.
 * De inhoudsvelden komen uit het actieve data-record (platSlaHubItems kiest
 * het data-record zonder afvoer).
 *
 * @param {Array} flatItems - platgeslagen hub-items (output van platSlaHubItems)
 * @returns {Array} Alleen items die nu formeel geldig zijn (opvoer ≠ null, afvoer = null)
 */
function filterActueel(flatItems) {
  return flatItems.filter((item) => item.opvoer && !item.afvoer);
}

/**
 * Berekent weergaveveld-tekst voor een child group uit de full entity.
 * Gebruikt het actuele (niet-afgevoerde) record voor de CEL-evaluatie.
 */
function childWeergave(childMeta, items, typeMetaByTypenaam) {
  const afgVelden = safeArray(childMeta?.afgeleideVelden)
    .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (afgVelden.length === 0 || items.length === 0) return null;

  const flat = platSlaHubItems(items, childMeta, typeMetaByTypenaam);
  const actief = flat.find((i) => !i.afvoer) || flat[0];
  if (!actief) return null;

  // Bouw context via bouwCelContext zodat ook rolnaam-lijstexpressies werken
  // (bijv. Trefwoordtaalvarianten.filter(t, t.taal == "nl")[0].woord)
  const childGroups = [{ doeltype: childMeta?.typenaam, rolnaam: childMeta?.veldnaam, items: flat, typeMeta: childMeta }];
  const ctx = bouwCelContext(childGroups, typeMetaByTypenaam);

  return afgVelden
    .map((av) => av.afleidingsregelTaal === "cel" ? evalueerCelExpressie(av.afleidingsregel, ctx) : null)
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" | ");
}

/**
 * Geeft een korte samenvatting (max 3 primitieve velden) van een platgeslagen GE/rel item.
 */
function korteVeldSamenvatting(item, meta) {
  if (!item) return "";
  const skip = new Set(["opvoer", "afvoer"]);
  const entKolom = meta?.entiteitIDKolom;
  if (entKolom) skip.add(entKolom);

  return Object.entries(item)
    .filter(([k, v]) => !skip.has(k) && v != null && typeof v !== "object")
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

/**
 * Berekent weergaveveld-tekst voor één platgeslagen relatie-item,
 * inclusief doelentiteit-context als die beschikbaar is.
 *
 * @param {Object} childMeta - Schema metadata van het child type (hub).
 * @param {Object} flatItem - Het platgeslagen item (hub + data gemerged).
 * @param {Object} typeMetaByTypenaam - Map van typenaam → schema metadata.
 * @param {Object} doelEntiteitCache - Map van "Typenaam:id" → platgeslagen entiteitdata.
 * @returns {string|null} De berekende weergavetekst, of null.
 */
function berekenWeergaveVoorItem(childMeta, flatItem, typeMetaByTypenaam, doelEntiteitCache) {
  const afgVelden = safeArray(childMeta?.afgeleideVelden)
    .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (afgVelden.length === 0 || !flatItem) return null;

  // Gebruik evalueerWeergaveVeldenVoorItem als basis (bouwt context met item + aliases)
  // Maar verrijk de context met doelentiteit-data als die beschikbaar is.
  const doelEntTypenaam = childMeta?.doelEntiteit;
  const secKolom = childMeta?.secondaireEntiteitIDKolom;
  const doelId = secKolom ? flatItem[secKolom] : null;

  // Als er doelentiteit-data in de cache is, gebruik altijd de verrijkte context.
  // Reden: CEL-expressies als "Gemeente.GemeenteGegevens.naam + ... + rol" bevatten
  // zowel doelentiteit-verwijzingen als eigen velden. Zonder verrijkte context
  // evalueert de doelentiteit-helft naar "", wat een niet-leeg maar onvolledig
  // resultaat oplevert (bijv. "- Realiseert" i.p.v. "Amsterdam - Realiseert").
  if (doelEntTypenaam && doelId != null && doelEntiteitCache) {
    const cacheKey = `${doelEntTypenaam}:${doelId}`;
    const doelData = doelEntiteitCache[cacheKey];
    if (doelData) {
      // Bouw een verrijkte context: item-velden + doelentiteit als geneste key
      const ctx = {};
      if (flatItem && typeof flatItem === "object") {
        for (const [key, value] of Object.entries(flatItem)) {
          if (key != null && String(key).trim() !== "") ctx[String(key)] = value;
        }
      }
      // Voeg doelentiteit toe onder haar klassenaam
      const doelMeta = typeMetaByTypenaam?.[doelEntTypenaam];
      const doelKlassenaam = doelMeta?.klassenaam || doelEntTypenaam;
      ctx[doelKlassenaam] = doelData;
      // Voeg ook de typenaam als alias toe
      if (doelEntTypenaam !== doelKlassenaam) ctx[doelEntTypenaam] = doelData;

      const teksten = afgVelden
        .filter((av) => av.afleidingsregelTaal === "cel" && av.afleidingsregel)
        .map((av) => evalueerCelExpressie(av.afleidingsregel, ctx))
        .filter((v) => v != null && String(v).trim() !== "")
        .map(String);
      if (teksten.length > 0) return teksten.join(" | ");
    }
  }

  // Fallback: evalueer zonder doelentiteit-context (voor eigen-GE-expressies)
  let teksten = evalueerWeergaveVeldenVoorItem(afgVelden, flatItem, childMeta, typeMetaByTypenaam);

  return teksten.length > 0 ? teksten.join(" | ") : null;
}

/**
 * EntiteitFormulier — toont een volledige entiteit met geneste GE/relatie-secties.
 * Haalt de full entity op via /full/{padnaam}/{id} en rendert per onderliggend
 * type een formulier (enkelvoudig) of compact tabel (meervoudig).
 */
export default function EntiteitFormulier() {
  const { typePad, id } = useParams();
  const { baseUrl, typeMetaByPadnaam, typeMetaByTypenaam } = useSchema();
  const navigate = useNavigate();

  const typeMeta = typeMetaByPadnaam[typePad];
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nieuwGE, setNieuwGE] = useState(null); // doeltype als er een nieuw record wordt toegevoegd
  const [bewerkRij, setBewerkRij] = useState(null); // { doeltype, index } — meervoudig rij in correctiemodus
  const [toonHistorie, setToonHistorie] = useState({}); // { [doeltype]: true/false } — toggle per GE-type
  const [doelEntiteitCache, setDoelEntiteitCache] = useState({}); // { "Typenaam:id": platgeslagenData }
  // Cache voor weergavenamen van ref-FK velden in onderliggende GE's
  // (bijv. gemeente-id → "Amsterdam (0363)") — { "TypeNaam": { "363": "label" } }
  const [entityRefCache, setEntityRefCache] = useState({});
  const [customWeergave, setCustomWeergave] = useState(false); // custom formulier layout modus
  const [customEditValues, setCustomEditValues] = useState({}); // werkwaarden custom formulier
  const [customBusy, setCustomBusy] = useState(false);
  const [customFeedback, setCustomFeedback] = useState(null); // { type: "succes"|"fout", text }

  // Custom FormulierDefinitie ophalen voor dit entiteittype
  const { layout: customLayout, formulierDefinitie: customFormDef, loading: customLayoutLoading } =
    useFormulierDefinitie(typeMeta?.typenaam);

  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;

  const fetchEntity = useCallback(async () => {
    if (!apiPath || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/full/${apiPath}/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEntity(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, apiPath, id]);

  useEffect(() => { fetchEntity(); }, [fetchEntity]);

  // Weergaveveld berekening voor de hoofd-entiteit
  const weergaveTekst = useMemo(() => {
    if (!entity || !typeMeta) return "";
    const afgVelden = safeArray(typeMeta?.afgeleideVelden)
      .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
    if (afgVelden.length === 0) return "";

    const onderliggende = safeArray(typeMeta?.onderliggende);
    const childGroups = onderliggende.map((child) => {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
      const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);

      // Verrijk elk item: voeg voor elk ref-FK veld `veldnaam_naam` toe
      // (bijv. gemeente: 363 → gemeente_naam: "Amsterdam (0363)") zodat
      // CEL-expressies als `Adres.gemeente_naam` beschikbaar hebben.
      const dataChild = safeArray(childMeta?.onderliggende).find(
        (c) => typeMetaByTypenaam?.[c.doeltype]?.ge_subtype === "data"
      );
      const veldenBron = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : childMeta;
      const refVelden = safeArray(veldenBron?.velden).filter((v) => v.ref);
      const enrichedItems =
        refVelden.length > 0 && Object.keys(entityRefCache).length > 0
          ? items.map((item) => {
              const extra = {};
              for (const veld of refVelden) {
                const val = item[veld.naam];
                if (val == null) continue;
                const naam = entityRefCache[veld.ref]?.[String(val)];
                if (naam) extra[`${veld.naam}_naam`] = naam;
              }
              return Object.keys(extra).length > 0 ? { ...item, ...extra } : item;
            })
          : items;

      return { doeltype: child.doeltype, rolnaam: child.rolnaam, items: enrichedItems, typeMeta: childMeta };
    });

    const ctx = bouwCelContext(childGroups, typeMetaByTypenaam);
    return afgVelden
      .map((av) => av.afleidingsregelTaal === "cel" ? evalueerCelExpressie(av.afleidingsregel, ctx) : null)
      .filter((v) => v != null && String(v).trim() !== "")
      .join(" | ");
  }, [entity, typeMeta, typeMetaByTypenaam, entityRefCache]);

  // ── Ref-FK weergavenamen ophalen ──────────────────────────────────────
  // Wanneer een GE een veld heeft met `ref: "Gemeente"` (of andere ref.lijst items),
  // halen we de weergavenamen op via de reflijst-opties API en cachen ze in
  // entityRefCache. De weergaveTekst useMemo gebruikt deze cache om de CEL-context
  // te verrijken met `veldnaam_naam` (bijv. `gemeente_naam = "Amsterdam (0363)"`).
  useEffect(() => {
    if (!entity || !typeMeta || !baseUrl) return;
    let cancelled = false;
    // Verzamel alle ref-types die voorkomen in de onderliggende GE-velden
    const toFetch = new Set();
    for (const child of safeArray(typeMeta.onderliggende)) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      if (!childMeta) continue;
      const dataChild = safeArray(childMeta.onderliggende).find(
        (c) => typeMetaByTypenaam?.[c.doeltype]?.ge_subtype === "data"
      );
      const veldenBron = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : childMeta;
      for (const veld of safeArray(veldenBron?.velden)) {
        if (veld.ref) toFetch.add(veld.ref);
      }
    }
    if (toFetch.size === 0) return;

    Promise.all(
      [...toFetch].map(async (refType) => {
        const refMeta = typeMetaByTypenaam?.[refType];
        const weergaveAv = safeArray(refMeta?.afgeleideVelden)
          .find((av) => av.isWeergaveVeld || av.weergaveVeld);
        const regExp = weergaveAv?.afleidingsregelTaal === "cel" ? weergaveAv.afleidingsregel : null;
        try {
          const res = await fetch(
            `${baseUrl}/api/viz/reflijst/${encodeURIComponent(refType)}/opties?size=200`
          );
          if (!res.ok) return [refType, {}];
          const json = await res.json();
          const lookup = {};
          for (const optie of safeArray(json?.opties)) {
            let label = null;
            if (regExp && optie.velden) {
              try {
                const result = evalueerCelExpressie(regExp, { ...optie.velden });
                if (result != null && String(result).trim() !== "") label = String(result);
              } catch { /* */ }
            }
            if (!label) {
              const vals = Object.values(optie.velden || {}).filter(Boolean);
              label = vals.length > 0 ? vals.join(" — ") : String(optie.id ?? "");
            }
            lookup[String(optie.id)] = label;
          }
          return [refType, lookup];
        } catch {
          return [refType, {}];
        }
      })
    ).then((entries) => {
      if (!cancelled) setEntityRefCache(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [entity, typeMeta, typeMetaByTypenaam, baseUrl]);

  // ── Doelentiteiten ophalen voor weergavevelden van relatie-hubs ───────
  // Relaties als InitiatiefDomein hebben CEL-expressies die verwijzen naar
  // de doelentiteit (bijv. Domein.DomeinGegevens.naam). Die data staat niet
  // in de full-entity response; we halen die apart op en cachen per type+id.
  useEffect(() => {
    if (!entity || !typeMeta) return;
    const onderliggende = safeArray(typeMeta.onderliggende);
    // Verzamel alle benodigde doelentiteit-fetches: { Typenaam → Set<id> }
    const teHalen = {};
    for (const child of onderliggende) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      if (!childMeta?.doelEntiteit || !childMeta.secondaireEntiteitIDKolom) continue;
      // Alleen als er afgeleide weergavevelden zijn
      const heeftWeergave = safeArray(childMeta.afgeleideVelden)
        .some((av) => av.isWeergaveVeld || av.weergaveVeld);
      if (!heeftWeergave) continue;

      const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
      const flat = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
      const secKolom = childMeta.secondaireEntiteitIDKolom;
      for (const item of flat) {
        const doelId = item[secKolom];
        if (doelId == null) continue;
        const key = `${childMeta.doelEntiteit}:${doelId}`;
        if (doelEntiteitCache[key]) continue; // al in cache
        if (!teHalen[childMeta.doelEntiteit]) teHalen[childMeta.doelEntiteit] = new Set();
        teHalen[childMeta.doelEntiteit].add(doelId);
      }
    }
    if (Object.keys(teHalen).length === 0) return;

    // Fetch alle doelentiteiten parallel
    const controller = new AbortController();
    (async () => {
      const nieuweCacheEntries = {};
      const fetches = [];
      for (const [doelTypenaam, ids] of Object.entries(teHalen)) {
        const doelMeta = typeMetaByTypenaam?.[doelTypenaam];
        if (!doelMeta) continue;
        const doelPad = doelMeta.padnaam || doelMeta.meervoud || doelMeta.veldnaam;
        if (!doelPad) continue;
        for (const doelId of ids) {
          fetches.push(
            fetch(`${baseUrl}/full/${doelPad}/${doelId}`, { signal: controller.signal })
              .then((r) => r.ok ? r.json() : null)
              .then((json) => {
                if (!json) return;
                // Platslaan: bouw een context-object met child-klassenamen als keys
                const children = safeArray(doelMeta.onderliggende);
                const platData = {};
                for (const ch of children) {
                  const chMeta = typeMetaByTypenaam?.[ch.doeltype];
                  if (!chMeta) continue;
                  const chNaam = chMeta.klassenaam || ch.doeltype;
                  const rawCh = safeArray(json[ch.jsonRolnaam] || json[ch.rolnaam]);
                  const flatCh = platSlaHubItems(rawCh, chMeta, typeMetaByTypenaam);
                  const actief = flatCh.find((i) => !i.afvoer) || flatCh[0];
                  if (actief) platData[chNaam] = actief;
                }
                // Voeg ook de weergavenaam van de doelentiteit zelf toe als die beschikbaar is
                const doelAfgVelden = safeArray(doelMeta.afgeleideVelden)
                  .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
                if (doelAfgVelden.length > 0) {
                  const doelCtx = bouwCelContext(
                    children.map((ch) => {
                      const chMeta = typeMetaByTypenaam?.[ch.doeltype];
                      const rawCh = safeArray(json[ch.jsonRolnaam] || json[ch.rolnaam]);
                      return { doeltype: ch.doeltype, rolnaam: ch.rolnaam, items: platSlaHubItems(rawCh, chMeta, typeMetaByTypenaam), typeMeta: chMeta };
                    }),
                    typeMetaByTypenaam
                  );
                  const weergave = doelAfgVelden
                    .map((av) => av.afleidingsregelTaal === "cel" ? evalueerCelExpressie(av.afleidingsregel, doelCtx) : null)
                    .filter((v) => v != null && String(v).trim() !== "")
                    .join(" | ");
                  if (weergave) platData.weergavenaam = weergave;
                }
                nieuweCacheEntries[`${doelTypenaam}:${doelId}`] = platData;
              })
              .catch(() => {}) // negeer individuele fouten
          );
        }
      }
      await Promise.all(fetches);
      if (!controller.signal.aborted && Object.keys(nieuweCacheEntries).length > 0) {
        setDoelEntiteitCache((prev) => ({ ...prev, ...nieuweCacheEntries }));
      }
    })();
    return () => controller.abort();
  }, [entity, typeMeta, typeMetaByTypenaam, baseUrl]);

  // Filter onderliggende: skip materiële plumbing (aanvang/einde op entiteitsniveau)
  // N.B.: moet vóór early returns staan zodat useMemo/useCallback hook-orde stabiel blijft.
  const onderliggende = useMemo(() => {
    if (!typeMeta) return [];
    return safeArray(typeMeta.onderliggende).filter((child) => {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      return childMeta && childMeta.ge_subtype !== "aanvang" && childMeta.ge_subtype !== "einde";
    });
  }, [typeMeta, typeMetaByTypenaam]);

  // ── Overerving (TPT): parent-entiteit metadata ────────────────────────
  const parentTypeMeta = typeMeta?.parentTypenaam ? typeMetaByTypenaam?.[typeMeta.parentTypenaam] : null;
  const parentJSONKey = parentTypeMeta ? ("parent_" + typeMeta.parentTypenaam.toLowerCase()) : null;

  // ── Custom formulier: flatten GE-data voor de layout renderer ─────────
  // veldNaarGE: mapping van veldnaam → { childMeta, dataMeta, actueel, bronVelden }
  // zodat we bij opslaan weten welk veld bij welk GE hoort (cross-GE save).
  const { customVelden, customValues, veldNaarGE } = useMemo(() => {
    if (!customLayout || !entity) return { customVelden: [], customValues: {}, veldNaarGE: {} };
    const velden = [];
    const values = {};
    const geMapping = {};
    const gezien = new Set();

    // Geërfde velden (van parent-entiteit via TPT) — vóór eigen GE-velden
    if (parentTypeMeta && parentJSONKey) {
      const parentData = entity[parentJSONKey];
      const geerfdeVeldenRaw = safeArray(typeMeta?.geerfdeVelden);
      const skipNamen = new Set(["opvoer", "afvoer"]);
      for (const v of geerfdeVeldenRaw) {
        const naam = v?.naam;
        if (!naam || gezien.has(naam)) continue;
        if (skipNamen.has(naam.toLowerCase())) continue;
        if (v.autoIncrement) continue;
        if (naam.toLowerCase() === String(parentTypeMeta?.idKolom || "id").toLowerCase()) continue;
        if (naam === "versie" || naam === "rel_id") continue;
        gezien.add(naam);
        velden.push(v);
        geMapping[naam] = { childMeta: parentTypeMeta, dataMeta: null, actueel: parentData, bronVelden: geerfdeVeldenRaw, isParentVeld: true };
      }
      if (parentData) {
        for (const v of geerfdeVeldenRaw) {
          if (v?.naam && parentData[v.naam] != null) values[v.naam] = parentData[v.naam];
        }
      }
    }

    for (const child of onderliggende) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      if (!childMeta) continue;
      const dataChild = safeArray(childMeta?.onderliggende).find((c) => {
        const cm = typeMetaByTypenaam?.[c.doeltype];
        return cm?.ge_subtype === "data";
      });
      const dataMeta = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : null;
      const bronVelden = safeArray(dataMeta?.velden || childMeta?.velden);
      const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
      const flat = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
      const actueel = flat.find((item) => item?.opvoer && !item?.afvoer);
      for (const v of bronVelden) {
        const naam = v?.naam;
        if (!naam || gezien.has(naam)) continue;
        if (["opvoer", "afvoer", "versie"].includes(naam)) continue;
        if (childMeta.entiteitIDKolom && naam === childMeta.entiteitIDKolom) continue;
        if (v.autoIncrement) continue;
        gezien.add(naam);
        velden.push(v);
        geMapping[naam] = { childMeta, dataMeta, actueel, bronVelden };
      }
      if (actueel) {
        for (const v of bronVelden) {
          if (v?.naam && actueel[v.naam] != null) values[v.naam] = actueel[v.naam];
        }
      }
    }
    return { customVelden: velden, customValues: values, veldNaarGE: geMapping };
  }, [customLayout, entity, onderliggende, typeMetaByTypenaam, parentTypeMeta, parentJSONKey, typeMeta]);

  // ── Cross-GE save: groepeer gewijzigde velden per GE en stuur één registratie ──
  const handleCustomOpslaan = useCallback(async () => {
    setCustomBusy(true);
    setCustomFeedback(null);
    try {
      const geGroepen = {};
      for (const [veldnaam, waarde] of Object.entries(customEditValues)) {
        const origWaarde = customValues[veldnaam];
        if (String(waarde ?? "") === String(origWaarde ?? "")) continue;
        const ge = veldNaarGE[veldnaam];
        if (!ge) continue;
        const key = ge.childMeta.typenaam;
        if (!geGroepen[key]) {
          geGroepen[key] = { ...ge, gewijzigdeVelden: {} };
        }
        geGroepen[key].gewijzigdeVelden[veldnaam] = waarde;
      }

      const geKeys = Object.keys(geGroepen);
      if (geKeys.length === 0) {
        setCustomFeedback({ type: "succes", text: "Geen wijzigingen." });
        return;
      }

      const wijzigingen = [];
      // Parent wijzigingen komen EERST (TPT: ensureParentRecordBijOpvoer vindt het record dan al)
      const sortedGroepen = Object.values(geGroepen).sort((a, b) => (a.isParentVeld ? -1 : 0) - (b.isParentVeld ? -1 : 0));
      for (const info of sortedGroepen) {
        const hubMeta = info.childMeta;
        const veldnaamKey = hubMeta.veldnaam || hubMeta.padnaam;
        const payload = {};

        if (info.isParentVeld) {
          // Parent entiteit: shared PK = child entity's ID (TPT patroon)
          const idKolom = hubMeta?.idKolom || "id";
          if (id) payload[idKolom] = Number(id);
        } else {
          if (hubMeta.entiteitIDKolom && id) {
            payload[hubMeta.entiteitIDKolom] = Number(id);
          }
          if (info.actueel?.rel_id != null) {
            payload.rel_id = info.actueel.rel_id;
          }
          if (hubMeta.idKolom && info.actueel?.[hubMeta.idKolom] != null) {
            payload[hubMeta.idKolom] = info.actueel[hubMeta.idKolom];
          }
        }

        const bronVelden = safeArray(info.isParentVeld ? info.bronVelden : (info.dataMeta?.velden || hubMeta?.velden));
        for (const v of bronVelden) {
          const naam = v?.naam;
          if (!naam) continue;
          if (["opvoer", "afvoer", "versie"].includes(naam)) continue;
          if (info.isParentVeld) {
            // Skip parent ID kolom (al handmatig gezet als shared PK)
            if (naam.toLowerCase() === String(hubMeta?.idKolom || "id").toLowerCase()) continue;
          } else {
            if (hubMeta.entiteitIDKolom && naam === hubMeta.entiteitIDKolom) continue;
          }
          if (v.autoIncrement) continue;

          const edited = customEditValues[naam];
          const original = info.actueel?.[naam];
          const raw = edited !== undefined ? edited : original;
          if (raw === "" || raw === null || raw === undefined) {
            if (v.verplicht) throw new Error(`${naam} is verplicht.`);
            continue;
          }
          payload[naam] = coercedWaardeVoorVeld(raw, v, naam);
        }

        wijzigingen.push({ opvoer: { [veldnaamKey]: payload } });
      }

      const res = await fetch(`${baseUrl}/registratie/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registratie: { registratietype: "registratie" },
          wijzigingen,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      setCustomFeedback({ type: "succes", text: `Opgeslagen! (${wijzigingen.length} GE${wijzigingen.length > 1 ? "'s" : ""})` });
      setCustomEditValues({});
      fetchEntity();
    } catch (err) {
      setCustomFeedback({ type: "fout", text: err.message });
    } finally {
      setCustomBusy(false);
    }
  }, [customEditValues, customValues, veldNaarGE, baseUrl, id, fetchEntity]);

  if (!typeMeta) {
    return <div className="cg-feedback--fout">Onbekend type: {typePad}</div>;
  }

  if (loading) {
    return <div style={{ padding: "1rem", color: "var(--cg-donkergrijs)" }}>Laden…</div>;
  }

  if (error) {
    return <div className="cg-feedback--fout">Fout: {error}</div>;
  }

  if (!entity) {
    return <div className="cg-feedback--fout">Record niet gevonden.</div>;
  }

  // Verwijderen (afvoer) van een meervoudig GE record
  async function handleVerwijderenRij(item, childMeta) {
    const label = childMeta?.klassenaam || childMeta?.typenaam || "record";
    if (!window.confirm(`Weet u zeker dat u dit ${label} record wilt verwijderen?`)) return;
    setBewerkRij(null);
    const veldnaam = childMeta.veldnaam || childMeta.padnaam;
    const idKolom = childMeta?.idKolom;
    const entKolom = childMeta?.entiteitIDKolom;
    const sleutel = {};
    if (idKolom && item[idKolom] != null) sleutel[idKolom] = item[idKolom];
    if (entKolom && item[entKolom] != null) sleutel[entKolom] = item[entKolom];
    if (!idKolom && item.rel_id != null) sleutel.rel_id = item.rel_id;
    try {
      const res = await fetch(`${baseUrl}/registratie/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registratie: { registratietype: "registratie" },
          wijzigingen: [{ afvoer: { [veldnaam]: sleutel } }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      fetchEntity();
    } catch (err) {
      alert(`Fout bij verwijderen: ${err.message}`);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1rem" }}>
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => navigate(`/t/${typeMeta.padnaam || typeMeta.meervoud || typePad}`)}
        >
          ← Terug naar overzicht
        </button>
        <h2 className="utrecht-heading-2" style={{ margin: 0 }}>
          {typeMeta.klassenaam || typeMeta.typenaam} #{id}
        </h2>
        {weergaveTekst && (
          <span style={{ color: "var(--cg-donkergrijs)", fontStyle: "italic", fontSize: "1rem" }}>
            {weergaveTekst}
          </span>
        )}
      </div>

      {/* Entiteit ID en formele tijd — compact weergave */}
      <div className="cg-form-card">
        <div className="cg-form-section">
          <div className="cg-form-section__title" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span>
              {typeMeta.klassenaam || typeMeta.typenaam}
              <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--cg-donkergrijs)", marginLeft: "0.5rem" }}>
                #{entity[typeMeta.idKolom || "id"]}
              </span>
            </span>
            <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--cg-donkergrijs)" }}>
              {entity.opvoer && <>t={tUitRegistratieTijdstip(entity.opvoer) ?? "?"}</>}
              {entity.afvoer && <span style={{ color: "var(--cg-fout)", marginLeft: "0.75rem" }}>afgevoerd t={tUitRegistratieTijdstip(entity.afvoer) ?? "?"}</span>}
            </span>
          </div>

          {/* Samenvattend overzicht onderliggende GE's als scroll-knoppen.
            * Telt alleen actuele records (met opvoer, zonder afvoer). */}
          {onderliggende.length > 0 && (
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {onderliggende.map((child) => {
                const childMeta = typeMetaByTypenaam?.[child.doeltype];
                if (!childMeta) return null;
                const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
                const flat = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
                const actueel = filterActueel(flat);
                const count = actueel.length;
                const actief = actueel[0] || null;
                const weergave = actief
                  ? berekenWeergaveVoorItem(childMeta, actief, typeMetaByTypenaam, doelEntiteitCache)
                  : childWeergave(childMeta, rawItems, typeMetaByTypenaam);
                const samenvatting = weergave || (actief ? korteVeldSamenvatting(actief, childMeta) : "");
                const label = childMeta.klassenaam || child.rolnaam || child.doeltype;
                return (
                  <button
                    type="button"
                    key={child.doeltype}
                    onClick={() => {
                      const el = document.getElementById(`ge-${child.doeltype}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    style={{
                      display: "inline-block",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "6px",
                      background: childMeta.kleur || "var(--cg-lichtgrijs)",
                      border: `1px solid ${childMeta.kleur ? "rgba(0,0,0,0.15)" : "var(--cg-grijs)"}`,
                      color: "var(--cg-donkerblauw)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.8125rem",
                      lineHeight: 1.4,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      transition: "box-shadow 0.15s, transform 0.1s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <strong>{label}</strong>
                    {count > 0 ? ` (${count})` : ""}
                    {samenvatting && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "var(--cg-donkergrijs)" }}>
                        {samenvatting.length > 60 ? samenvatting.slice(0, 57) + "…" : samenvatting}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toggle voor custom formulier layout (als er een actieve FormulierDefinitie is) */}
      {customLayout && !customLayoutLoading && (
        <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            className={`utrecht-button ${customWeergave ? "utrecht-button--primary-action" : "utrecht-button--secondary-action"}`}
            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
            onClick={() => setCustomWeergave(!customWeergave)}
          >
            {customWeergave ? "⬦ Standaard weergave" : "⬧ Custom formulier"}
          </button>
          {customFormDef?.meta?.naam && (
            <span style={{ fontSize: "0.75rem", color: "var(--cg-donkergrijs)" }}>
              Layout: {customFormDef.meta.naam}
            </span>
          )}
        </div>
      )}

      {/* Custom formulier weergave — editeerbaar, cross-GE save via één registratie */}
      {customWeergave && customLayout && customVelden.length > 0 && (
        <div className="cg-form-card" style={{ marginBottom: "0.75rem" }}>
          <div className="cg-form-section__title" style={{ marginBottom: "0.5rem", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span>{customFormDef?.meta?.naam || "Custom formulier"}</span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {customFeedback && (
                <span
                  className={customFeedback.type === "fout" ? "cg-feedback--fout" : "cg-feedback--succes"}
                  style={{ fontSize: "0.8125rem", padding: "0.125rem 0.5rem", borderRadius: "4px" }}
                >
                  {customFeedback.text}
                </span>
              )}
              <button
                type="button"
                className="utrecht-button utrecht-button--secondary-action"
                style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                disabled={customBusy}
                onClick={() => { setCustomEditValues({}); setCustomFeedback(null); }}
              >
                Reset
              </button>
              <button
                type="button"
                className="utrecht-button utrecht-button--primary-action"
                style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                disabled={customBusy}
                onClick={handleCustomOpslaan}
              >
                {customBusy ? "Opslaan…" : "Opslaan"}
              </button>
            </div>
          </div>
          <CustomFormulierRenderer
            layout={customLayout}
            velden={customVelden}
            values={{ ...customValues, ...customEditValues }}
            onChange={(veldnaam, waarde) => setCustomEditValues((prev) => ({ ...prev, [veldnaam]: waarde }))}
            readOnly={false}
            typeMeta={typeMeta}
          />
        </div>
      )}

      {/* Parent entiteit velden (TPT overerving) — boven eigen GE-secties */}
      {parentTypeMeta && parentJSONKey && entity[parentJSONKey] && !customWeergave && (
        <div id="ge-parent" className="cg-form-card" style={{ marginTop: "0.75rem" }}>
          <div className="cg-form-section__title" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span>
              {parentTypeMeta.klassenaam || typeMeta.parentTypenaam}
              <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--cg-donkergrijs)", marginLeft: "0.5rem" }}>
                (overgeërfd)
              </span>
            </span>
          </div>
          <RepresentatieFormulier
            typeMeta={parentTypeMeta}
            initialData={entity[parentJSONKey]}
            onSaved={fetchEntity}
            entiteitId={null}
            entiteitIdKolom={null}
            isEnkelvoudig={true}
            hideIdEnTijd={true}
          />
        </div>
      )}

      {/* Onderliggende GE's en relaties */}
      {onderliggende.map((child) => {
        const childMeta = typeMetaByTypenaam?.[child.doeltype];
        if (!childMeta) return null;

        const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);

        /*
         * Platslaan: hub→data zodat inhoudsvelden beschikbaar zijn.
         * Na platslaan bevat elk item de hub-velden (opvoer, afvoer, rel_id, entiteitID)
         * plus de inhoudsvelden van het actieve data-record.
         *
         * Daarna filteren we op formele geldigheid:
         *   - enkelvoudig GE: max 1 actief record (vorige versie is afgevoerd)
         *   - meervoudig GE:  0..n actieve records
         * Niet-actuele records (hub afgevoerd of opvoer leeg na ongedaanmaking) worden
         * uitgefilterd — de UI toont altijd de actuele toestand.
         */
        const flatItems = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
        const actueleItems = filterActueel(flatItems);
        const historischeItems = flatItems.length - actueleItems.length;

        const isEnkelvoudig = child.momentvoorkomen === "enkelvoudig";
        const label = childMeta.klassenaam || child.rolnaam || child.doeltype;

        // Bepaal welk data-type de inhoudsvelden definiëert
        const dataChild = safeArray(childMeta?.onderliggende).find((c) => {
          const cm = typeMetaByTypenaam?.[c.doeltype];
          return cm?.ge_subtype === "data";
        });
        const dataMeta = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : null;
        // Gebruik data-velden als ze er zijn, anders de velden van het hub-type
        const inhoudsvelden = safeArray(dataMeta?.velden || childMeta?.velden).filter((v) => {
          // Filter plumbing-velden
          const naam = String(v.naam || "").toLowerCase();
          if (["opvoer", "afvoer", "versie"].includes(naam)) return false;
          if (childMeta.entiteitIDKolom && naam === childMeta.entiteitIDKolom) return false;
          if (v.autoIncrement) return false;
          return true;
        });

        // Alle velden (incl. plumbing) voor het formulier
        const alleVelden = safeArray(dataMeta?.velden || childMeta?.velden);

        // Bereken historische versies voor alle hub-types (enkelvoudig + meervoudig)
        const alleHistorischeVersies = rawItems.flatMap((hubItem) => {
          const versies = platSlaAlleVersies(hubItem, childMeta, typeMetaByTypenaam);
          return versies.filter((v) => v._data_afvoer);
        });
        const heeftHistorie = alleHistorischeVersies.length > 0;
        const historieTonen = toonHistorie[child.doeltype];

        return (
          <div key={child.doeltype} id={`ge-${child.doeltype}`} className="cg-form-card" style={{ marginTop: "0.75rem" }}>
            <div className="cg-form-section__title" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span>
                {label}
                <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--cg-donkergrijs)", marginLeft: "0.5rem" }}>
                  ({child.momentvoorkomen}) — {actueleItems.length} actueel
                  {heeftHistorie && (
                    <button
                      type="button"
                      onClick={() => setToonHistorie((prev) => ({ ...prev, [child.doeltype]: !prev[child.doeltype] }))}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: "0.75rem", color: historieTonen ? "var(--cg-blauw)" : "var(--cg-donkergrijs)",
                        padding: 0, marginLeft: "0.25rem", textDecoration: "underline", fontFamily: "inherit",
                      }}
                      title={historieTonen ? "Historie verbergen" : "Historie tonen"}
                    >
                      {alleHistorischeVersies.length} hist.
                    </button>
                  )}
                </span>
                {/* Compact ID boven de gele streep voor enkelvoudig */}
                {isEnkelvoudig && actueleItems.length > 0 && (() => {
                  const item = actueleItems[0];
                  const entKolom = String(childMeta.entiteitIDKolom || "").toLowerCase();
                  const entId = entKolom ? item[entKolom] : null;
                  const relId = item.rel_id;
                  const versie = item.versie;
                  if (entId == null) return null;
                  let compactId = `${entId}`;
                  if (relId != null) compactId += `.${relId}`;
                  if (versie != null) compactId += `.${versie}`;
                  return <span style={{ fontWeight: 400, fontFamily: "monospace", fontSize: "0.6875rem", color: "var(--cg-donkergrijs)", marginLeft: "0.75rem" }}>#{compactId}</span>;
                })()}
              </span>
              {/* Symbolische formele tijd rechts, boven de gele streep */}
              {isEnkelvoudig && actueleItems.length > 0 && (
                <span style={{ fontWeight: 400, fontSize: "0.6875rem", color: "var(--cg-donkergrijs)" }}>
                  {actueleItems[0].opvoer && <>t={tUitRegistratieTijdstip(actueleItems[0].opvoer) ?? "?"}</>}
                  {actueleItems[0].afvoer && <span style={{ color: "var(--cg-fout)", marginLeft: "0.5rem" }}>afgevoerd t={tUitRegistratieTijdstip(actueleItems[0].afvoer) ?? "?"}</span>}
                </span>
              )}
            </div>

            {isEnkelvoudig && actueleItems.length > 0 ? (
              /* Enkelvoudig: formulier met het actuele (platgeslagen) record */
              <RepresentatieFormulier
                typeMeta={childMeta}
                dataMeta={dataMeta}
                initialData={actueleItems[0]}
                onSaved={fetchEntity}
                entiteitId={id}
                entiteitIdKolom={childMeta.entiteitIDKolom}
                isEnkelvoudig={true}
                hideIdEnTijd={true}
              />
            ) : !isEnkelvoudig && actueleItems.length > 0 ? (
              /* Meervoudig: compact tabel met actuele records + acties per rij */
              (() => {
                // Bepaal of dit type een weergaveveld heeft
                const heeftWeergave = safeArray(childMeta?.afgeleideVelden)
                  .some((av) => av.isWeergaveVeld || av.weergaveVeld);
                return (
              <div>
                <div style={{ overflowX: "auto" }}>
                  <table className="utrecht-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="utrecht-table__header-row">
                        {inhoudsvelden.map((v) => (
                          <th key={v.naam} className="utrecht-table__header-cell">{v.naam}</th>
                        ))}
                        {heeftWeergave && (
                          <th className="utrecht-table__header-cell" style={{ fontStyle: "italic" }}>weergave</th>
                        )}
                        <th className="utrecht-table__header-cell" style={{ width: "1%", whiteSpace: "nowrap" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {actueleItems.map((item, i) => {
                        const weergaveTekst = heeftWeergave
                          ? berekenWeergaveVoorItem(childMeta, item, typeMetaByTypenaam, doelEntiteitCache)
                          : null;
                        return (
                        <tr
                          key={i}
                          className="utrecht-table__row"
                          style={{
                            background: bewerkRij?.doeltype === child.doeltype && bewerkRij?.index === i
                              ? "var(--cg-lichtblauw, #e0f0ff)"
                              : i % 2 === 1 ? "var(--cg-lichtgrijs)" : undefined,
                          }}
                        >
                          {inhoudsvelden.map((v) => (
                            <td key={v.naam} className="utrecht-table__cell" style={{ padding: "0.375rem 0.75rem" }}>
                              {item[v.naam] != null ? String(item[v.naam]) : "—"}
                            </td>
                          ))}
                          {heeftWeergave && (
                            <td className="utrecht-table__cell" style={{ padding: "0.375rem 0.75rem", fontStyle: "italic", color: "var(--cg-donkergrijs)" }}>
                              {weergaveTekst || "—"}
                            </td>
                          )}
                          <td className="utrecht-table__cell" style={{ padding: "0.375rem 0.5rem", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="utrecht-button utrecht-button--secondary-action"
                              style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem", marginRight: "0.25rem" }}
                              title="Corrigeren"
                              onClick={() => { setNieuwGE(null); setBewerkRij({ doeltype: child.doeltype, index: i }); }}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="utrecht-button utrecht-button--secondary-action"
                              style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem", color: "var(--cg-fout, #b91c1c)" }}
                              title="Verwijderen"
                              onClick={() => handleVerwijderenRij(item, childMeta)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Inline correctieformulier voor geselecteerde meervoudige rij */}
                {bewerkRij?.doeltype === child.doeltype && bewerkRij.index < actueleItems.length && (
                  <div style={{ marginTop: "0.5rem", padding: "0.75rem", border: "1px solid var(--cg-grijs, #ccc)", borderRadius: "6px", background: "var(--cg-lichtgrijs, #f8f9fa)" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Correctie {label}
                    </div>
                    <RepresentatieFormulier
                      typeMeta={childMeta}
                      dataMeta={dataMeta}
                      initialData={actueleItems[bewerkRij.index]}
                      onSaved={() => { setBewerkRij(null); fetchEntity(); }}
                      onCancel={() => setBewerkRij(null)}
                      entiteitId={id}
                      entiteitIdKolom={childMeta.entiteitIDKolom}
                      isEnkelvoudig={false}
                    />
                  </div>
                )}
              </div>
                );
              })()
            ) : null}

            {/* Uitgeklapte historische versies */}
            {heeftHistorie && historieTonen && (
              <div style={{ marginTop: "0.5rem", paddingLeft: "0.5rem", borderLeft: "2px solid var(--cg-grijs, #ccc)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cg-donkergrijs)", marginBottom: "0.25rem" }}>
                  Historische versies ({alleHistorischeVersies.length})
                </div>
                {alleHistorischeVersies.map((versie, vi) => {
                  const tOpvoer = versie._data_opvoer ? tUitRegistratieTijdstip(versie._data_opvoer) : null;
                  const tAfvoer = versie._data_afvoer ? tUitRegistratieTijdstip(versie._data_afvoer) : null;
                  const dataVersie = versie._data_versie;
                  // Toon inhoudsvelden als compacte key=value reeks
                  const veldWaarden = inhoudsvelden
                    .map((v) => ({ naam: v.naam, waarde: versie[v.naam] }))
                    .filter((v) => v.waarde != null && v.waarde !== "");
                  return (
                    <div
                      key={vi}
                      style={{
                        padding: "0.375rem 0.625rem",
                        marginBottom: "0.25rem",
                        border: "1px dashed var(--cg-grijs, #ccc)",
                        borderRadius: "4px",
                        fontSize: "0.8125rem",
                        background: "var(--cg-lichtgrijs, #f8f9fa)",
                      }}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "var(--cg-donkergrijs)" }}>
                        {dataVersie != null && <>v{dataVersie} &middot; </>}
                        {tOpvoer != null && <>t={tOpvoer}</>}
                        {tAfvoer != null && <span style={{ color: "var(--cg-fout, #b91c1c)" }}> → afgevoerd t={tAfvoer}</span>}
                      </span>
                      {veldWaarden.length > 0 && (
                        <span style={{ marginLeft: "0.75rem", color: "var(--cg-tekst, #333)" }}>
                          {veldWaarden.map((v) => `${v.naam}: ${v.waarde}`).join(" | ")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lege GE: mogelijkheid om nieuw record toe te voegen */}
            {actueleItems.length === 0 && nieuwGE !== child.doeltype && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem 0" }}>
                <span style={{ color: "var(--cg-donkergrijs)", fontSize: "0.875rem" }}>Geen records.</span>
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => { setBewerkRij(null); setNieuwGE(child.doeltype); }}
                >
                  + {label} toevoegen
                </button>
              </div>
            )}

            {/* Nieuw record formulier */}
            {nieuwGE === child.doeltype && (
              <div style={{ marginTop: "0.5rem" }}>
                <RepresentatieFormulier
                  typeMeta={childMeta}
                  dataMeta={dataMeta}
                  initialData={null}
                  onSaved={() => { setNieuwGE(null); setBewerkRij(null); fetchEntity(); }}
                  entiteitId={id}
                  entiteitIdKolom={childMeta.entiteitIDKolom}
                />
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}
                  onClick={() => setNieuwGE(null)}
                >
                  Annuleren
                </button>
              </div>
            )}

            {/* Meervoudig: knop om extra record toe te voegen */}
            {!isEnkelvoudig && actueleItems.length > 0 && nieuwGE !== child.doeltype && (
              <div style={{ paddingTop: "0.5rem" }}>
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => { setBewerkRij(null); setNieuwGE(child.doeltype); }}
                >
                  + {label} toevoegen
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
