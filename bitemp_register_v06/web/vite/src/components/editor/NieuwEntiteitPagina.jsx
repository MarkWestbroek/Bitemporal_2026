/**
 * NieuwEntiteitPagina.jsx
 *
 * Zelfstandige pagina voor het opvoeren van een nieuwe entiteit met al haar
 * onderliggende gegevenselementen en relaties in één registratie-aanroep.
 *
 * Gerouteerd vanuit NieuwRecordFormulier als typeMeta.metatype === 'entiteit'
 * en er onderliggende GEs/relaties zijn.
 *
 * Hergebruikt dezelfde logica als het "Nieuwe entiteit opvoeren" paneel in
 * IndexSchemaPage, maar als zelfstandige route (/t/:typePad/nieuw).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import { berekenWeergaveveld } from "../../shared/celEvaluator";
import { coercedWaardeVoorVeld } from "../actions/ActionFormParts";
import {
  bouwGroepOptiesVanTypeMeta,
  bouwInitieleRijen,
  initialiseerGeWaardenVoorOptie,
  isMeervoudigOptie,
  vulMaterieleTijdVoorHubInput,
} from "../../shared/entiteitOpvoerUtils";
import NieuweEntiteitActieBox from "../actions/NieuweEntiteitActieBox";

// ── ID-suggestie ────────────────────────────────────────────────────────

async function fetchMaxId(baseUrl, typenaam) {
  const res = await fetch(`${baseUrl}/api/viz/entiteit/${encodeURIComponent(typenaam)}/max-id`);
  if (!res.ok) throw new Error(`Max-id HTTP ${res.status}`);
  return await res.json();
}

// ── Component ───────────────────────────────────────────────────────────

/**
 * Props:
 *  - typeMeta: schema-entry van de entiteit (metatype === 'entiteit')
 *  - onSuccess: optionele callback na geslaagde registratie (ontvangt {registratieId, entiteitId})
 */
export default function NieuwEntiteitPagina({ typeMeta, onSuccess }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const navigate = useNavigate();
  const formRef = useRef(null);

  // ── Groepopties (eenmalig berekend uit schema) ──────────────────────
  const { gegevenselementGroepOpties, relatieGroepOpties } = useMemo(
    () => bouwGroepOptiesVanTypeMeta(typeMeta, typeMetaByTypenaam),
    [typeMeta, typeMetaByTypenaam]
  );

  // ── Rijen state ─────────────────────────────────────────────────────
  const [rijen, setRijen] = useState(() => {
    const alleOpties = [...gegevenselementGroepOpties, ...relatieGroepOpties];
    return bouwInitieleRijen(alleOpties, 1).rows;
  });
  const [volgendRijId, setVolgendRijId] = useState(() => {
    const alleOpties = [...gegevenselementGroepOpties, ...relatieGroepOpties];
    return bouwInitieleRijen(alleOpties, 1).nextId;
  });

  // Splits rijen naar GE- en relatie-rijen voor NieuweEntiteitActieBox
  const geRijen = useMemo(() =>
    rijen.filter((r) => gegevenselementGroepOpties.some((o) => o.groupKey === r.groupKey)),
    [rijen, gegevenselementGroepOpties]
  );
  const relatieRijen = useMemo(() =>
    rijen.filter((r) => relatieGroepOpties.some((o) => o.groupKey === r.groupKey)),
    [rijen, relatieGroepOpties]
  );

  // ── ID + opmerking state ─────────────────────────────────────────────
  const [entiteitId, setEntiteitId] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [opmerkingAangepast, setOpmerkingAangepast] = useState(false);
  const [idInfo, setIdInfo] = useState({ loading: false, maxId: null, nextId: null, error: "" });

  // ── Materiële tijd ───────────────────────────────────────────────────
  const [aanvang, setAanvang] = useState("");
  const [einde, setEinde] = useState("");

  const isMaterieel = Boolean(typeMeta?.isMaterieel);
  const materieleTijdMeta = useMemo(() => {
    if (!isMaterieel) return null;
    // Zoek aanvang/einde plumbing-types in de onderliggende van de entiteit
    const onderliggende = safeArray(typeMeta?.onderliggende);
    const aanvangKind = onderliggende.find((o) => o.doeltype?.endsWith("_Aanvang"));
    const eindeKind = onderliggende.find((o) => o.doeltype?.endsWith("_Einde"));
    const aanvangMeta = aanvangKind ? typeMetaByTypenaam?.[aanvangKind.doeltype] : null;
    const eindeMeta = eindeKind ? typeMetaByTypenaam?.[eindeKind.doeltype] : null;
    if (!aanvangMeta && !eindeMeta) return null;
    return {
      aanvangVeldnaam: aanvangMeta?.veldnaam || null,
      eindeVeldnaam: eindeMeta?.veldnaam || null,
      aanvangEntiteitIDKolom: aanvangMeta?.entiteitIDKolom || null,
      eindeEntiteitIDKolom: eindeMeta?.entiteitIDKolom || null,
    };
  }, [isMaterieel, typeMeta, typeMetaByTypenaam]);

  // ── Relatiesecundaire opties (doelentiteit-dropdown) ─────────────────
  const [relatieSecondaireOpties, setRelatieSecondaireOpties] = useState({});
  useEffect(() => {
    async function laadSecondaireOpties() {
      const opties = {};
      for (const optie of relatieGroepOpties) {
        const doelEntTypenaam = optie.doelEntiteit;
        if (!doelEntTypenaam) continue;
        const doelEntMeta = typeMetaByTypenaam?.[doelEntTypenaam];
        if (!doelEntMeta?.padnaam) continue;
        try {
          // Gebruik /full/ endpoint zodat geneste GE-data beschikbaar is voor weergaveveld-berekening
          const res = await fetch(`${baseUrl}/full/${doelEntMeta.padnaam}?page=1&size=200`);
          if (!res.ok) continue;
          const json = await res.json();
          // API retourneert { "<padnaam>": [...] }, bv. { "trefwoorden": [...] }
          const items = Array.isArray(json)
            ? json
            : safeArray(json?.[doelEntMeta.padnaam] || json?.items || json?.data || json);
          const idKolom = doelEntMeta.idKolom || "id";
          const ids = items.map((it) => String(it[idKolom] ?? ""));
          // Bereken weergavelabels via CEL-expressies (zelfde als RepresentatieTabel)
          const labels = {};
          items.forEach((it) => {
            const id = String(it[idKolom] ?? "");
            const weergave = berekenWeergaveveld(it, doelEntMeta, typeMetaByTypenaam);
            if (weergave) labels[id] = weergave;
          });
          opties[optie.groupKey] = { ids, labels, loading: false, error: "" };
        } catch (error) {
          // stil falen: dropdown blijft leeg
          opties[optie.groupKey] = { ids: [], labels: {}, loading: false, error: String(error?.message || "Laden mislukt") };
        }
      }
      setRelatieSecondaireOpties(opties);
    }
    if (relatieGroepOpties.length > 0) laadSecondaireOpties();
  }, [relatieGroepOpties, typeMetaByTypenaam, baseUrl]);

  // ── ID-suggestie ophalen bij mount ───────────────────────────────────
  useEffect(() => {
    if (!typeMeta?.typenaam) return;
    setIdInfo({ loading: true, maxId: null, nextId: null, error: "" });
    fetchMaxId(baseUrl, typeMeta.typenaam)
      .then((json) => {
        const nextId = Number(json?.nextId || 1);
        setIdInfo({ loading: false, maxId: Number(json?.maxId || 0), nextId, error: "" });
        setEntiteitId(String(nextId));
        if (!opmerkingAangepast) {
          setOpmerking(`Nieuwe ${typeMeta.klassenaam || typeMeta.typenaam}=${nextId}`);
        }
      })
      .catch((err) => {
        setIdInfo({ loading: false, maxId: null, nextId: null, error: String(err?.message || err) });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, typeMeta?.typenaam]);

  // ── Preview payload ──────────────────────────────────────────────────
  const opvoerPreview = useMemo(() => {
    try {
      const entiteitVeldnaam = typeMeta?.veldnaam || String(typeMeta?.typenaam || "").toLowerCase();
      const idNummer = Number(entiteitId);
      if (!Number.isInteger(idNummer) || idNummer <= 0) {
        throw new Error("Entiteit-id moet een positief geheel getal zijn.");
      }
      const opm = opmerking.trim() || undefined;
      const registratie = { registratietype: "registratie", ...(opm ? { opmerking: opm } : {}) };
      const wijzigingen = [{ opvoer: { [entiteitVeldnaam]: { id: idNummer } } }];

      const alleRijen = [
        ...geRijen.map((row) => ({ row, opties: gegevenselementGroepOpties })),
        ...relatieRijen.map((row) => ({ row, opties: relatieGroepOpties })),
      ];

      alleRijen.forEach(({ row, opties }) => {
        const optie = opties.find((o) => o.groupKey === row.groupKey);
        if (!optie) throw new Error("Onbekend type in invoer.");
        const item = {};
        if (optie.entiteitIDKolom) item[optie.entiteitIDKolom] = idNummer;
        safeArray(optie.veldDefinities).forEach((veld) => {
          const raw = row?.values?.[veld.naam];
          if (raw === undefined || raw === null || raw === "") return;
          item[veld.naam] = coercedWaardeVoorVeld(raw, veld, `${optie.label}.${veld.naam}`);
        });
        vulMaterieleTijdVoorHubInput(item, row, optie);
        wijzigingen.push({ opvoer: { [optie.geVeldnaam]: item } });
      });

      if (materieleTijdMeta && aanvang) {
        const mtItem = {};
        if (materieleTijdMeta.aanvangEntiteitIDKolom) mtItem[materieleTijdMeta.aanvangEntiteitIDKolom] = idNummer;
        mtItem.datum = aanvang;
        wijzigingen.push({ opvoer: { [materieleTijdMeta.aanvangVeldnaam]: mtItem } });
      }
      if (materieleTijdMeta && einde) {
        const mtItem = {};
        if (materieleTijdMeta.eindeEntiteitIDKolom) mtItem[materieleTijdMeta.eindeEntiteitIDKolom] = idNummer;
        mtItem.datum = einde;
        wijzigingen.push({ opvoer: { [materieleTijdMeta.eindeVeldnaam]: mtItem } });
      }

      return { ok: true, payload: { registratie, wijzigingen } };
    } catch (err) {
      return { ok: false, fout: String(err?.message || err) };
    }
  }, [typeMeta, entiteitId, opmerking, geRijen, relatieRijen, gegevenselementGroepOpties, relatieGroepOpties, materieleTijdMeta, aanvang, einde]);

  // ── Submit ───────────────────────────────────────────────────────────
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState(null);

  const voerUit = useCallback(async () => {
    if (!opvoerPreview?.ok) return;
    setBezig(true);
    setResultaat(null);
    try {
      const res = await fetch(`${baseUrl}/registratie/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opvoerPreview.payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);

      const registratieId = Number(json?.registratie_id ?? json?.registratieId ?? 0);
      const idNummer = Number(entiteitId);
      setResultaat({ ok: true, bericht: `Opvoer geslaagd (registratie id=${registratieId || "-"})` });

      if (onSuccess) {
        onSuccess({ registratieId, entiteitId: idNummer });
      } else {
        // Navigeer naar de entiteitdetailpagina
        const padnaam = typeMeta?.padnaam || typeMeta?.meervoud;
        if (padnaam && idNummer > 0) {
          navigate(`/t/${padnaam}/${idNummer}`);
        }
      }
    } catch (err) {
      setResultaat({ ok: false, bericht: String(err?.message || err) });
    } finally {
      setBezig(false);
    }
  }, [opvoerPreview, baseUrl, entiteitId, typeMeta, navigate, onSuccess]);

  // ── Rij-manipulaties ─────────────────────────────────────────────────
  function voegGeRijToe(groupKey) {
    const optie = gegevenselementGroepOpties.find((o) => o.groupKey === groupKey);
    if (!optie) return;
    setRijen((prev) => [...prev, { id: volgendRijId, groupKey, values: initialiseerGeWaardenVoorOptie(optie) }]);
    setVolgendRijId((n) => n + 1);
  }

  function voegRelatieRijToe(groupKey) {
    const optie = relatieGroepOpties.find((o) => o.groupKey === groupKey);
    if (!optie) return;
    setRijen((prev) => [...prev, { id: volgendRijId, groupKey, values: initialiseerGeWaardenVoorOptie(optie) }]);
    setVolgendRijId((n) => n + 1);
  }

  function updateRijVeld(rowId, veldnaam, waarde) {
    setRijen((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, values: { ...(row.values || {}), [veldnaam]: waarde } } : row
      )
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  const accentColor = typeMeta?.kleur || "#0f766e";
  const typenaamLabel = typeMeta?.klassenaam || typeMeta?.typenaam || "Entiteit";

  return (
    <NieuweEntiteitActieBox
      nieuweEntiteitFormRef={formRef}
      accentColor={accentColor}
      entiteitType={typenaamLabel}
      nieuweEntiteitID={entiteitId}
      setNieuweEntiteitID={setEntiteitId}
      nieuweEntiteitOpmerking={opmerking}
      setNieuweEntiteitOpmerking={setOpmerking}
      setNieuweEntiteitOpmerkingAangepast={setOpmerkingAangepast}
      nieuweEntiteitIDInfo={idInfo}
      gegevenselementGroepOpties={gegevenselementGroepOpties}
      relatieGroepOpties={relatieGroepOpties}
      nieuweEntiteitGegevens={geRijen}
      setNieuweEntiteitGegevens={(fn) =>
        setRijen((prev) => {
          const nieuweGeRijen = typeof fn === "function" ? fn(geRijen) : fn;
          return [...prev.filter((r) => !gegevenselementGroepOpties.some((o) => o.groupKey === r.groupKey)), ...nieuweGeRijen];
        })
      }
      nieuweEntiteitRelaties={relatieRijen}
      setNieuweEntiteitRelaties={(fn) =>
        setRijen((prev) => {
          const nieuweRelRijen = typeof fn === "function" ? fn(relatieRijen) : fn;
          return [...prev.filter((r) => !relatieGroepOpties.some((o) => o.groupKey === r.groupKey)), ...nieuweRelRijen];
        })
      }
      voegNieuweEntiteitGegevenRijToe={voegGeRijToe}
      updateNieuweEntiteitGegevenRijVeld={updateRijVeld}
      voegNieuweEntiteitRelatieRijToe={voegRelatieRijToe}
      updateNieuweEntiteitRelatieRijVeld={updateRijVeld}
      relatieSecondaireOpties={relatieSecondaireOpties}
      isMeervoudigOptie={isMeervoudigOptie}
      nieuweEntiteitOpvoerPreview={opvoerPreview}
      voerNieuweEntiteitActieUit={voerUit}
      nieuweEntiteitBezig={bezig}
      nieuweEntiteitResultaat={resultaat}
      isMaterieel={isMaterieel}
      nieuweEntiteitAanvang={aanvang}
      setNieuweEntiteitAanvang={setAanvang}
      nieuweEntiteitEinde={einde}
      setNieuweEntiteitEinde={setEinde}
    />
  );
}
