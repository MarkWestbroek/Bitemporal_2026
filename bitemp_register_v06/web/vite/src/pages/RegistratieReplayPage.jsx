import { useEffect, useMemo, useState } from "react";
import "../shared/schema-viz.css";

const DEFAULT_PAGE_SIZE = 20;

// Stabiele kleuren voor domein-badges; hash-gebaseerd zodat dezelfde domein altijd dezelfde kleur krijgt.
const DOMEIN_KLEUREN = [
  "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed",
  "#0891b2", "#be185d", "#4f46e5", "#65a30d", "#ea580c",
];
function domeinKleur(domein) {
  let h = 0;
  for (let i = 0; i < domein.length; i++) h = ((h << 5) - h + domein.charCodeAt(i)) | 0;
  return DOMEIN_KLEUREN[Math.abs(h) % DOMEIN_KLEUREN.length];
}

function toPrettyJson(value) {
  if (value == null) {
    return "-";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryParseJson(value) {
  if (value == null) {
    return { ok: false, value: null };
  }
  if (typeof value === "object") {
    return { ok: true, value };
  }
  if (typeof value !== "string") {
    return { ok: false, value: null };
  }
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value: null };
  }
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectDeep);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function isTemporalString(value) {
  if (typeof value !== "string") {
    return false;
  }
  const text = value.trim();
  if (!text) {
    return false;
  }
  return !Number.isNaN(Date.parse(text));
}

function isTemporalValue(value) {
  return value == null || isTemporalString(value);
}

function stripComparisonFieldsDeep(value, ignoreDynamicFields) {
  if (Array.isArray(value)) {
    return value.map((item) => stripComparisonFieldsDeep(item, ignoreDynamicFields));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const result = {};
  Object.keys(value).forEach((key) => {
    if (key === "tijdstip") {
      return;
    }

    const fieldValue = value[key];
    if ((key === "opvoer" || key === "afvoer") && isTemporalValue(fieldValue)) {
      return;
    }

    if (ignoreDynamicFields && (key === "message" || key === "registratie_id" || key === "registratieId" || key === "rel_id")) {
      return;
    }

    result[key] = stripComparisonFieldsDeep(fieldValue, ignoreDynamicFields);
  });

  return result;
}

function areJsonEqual(a, b, ignoreDynamicFields) {
  const left = stripComparisonFieldsDeep(a, ignoreDynamicFields);
  const right = stripComparisonFieldsDeep(b, ignoreDynamicFields);
  return JSON.stringify(sortObjectDeep(left)) === JSON.stringify(sortObjectDeep(right));
}

function bumpNumericLike(value, offset) {
  if (offset === 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value + offset;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return String(Number(value) + offset);
  }
  return value;
}

function normalizeEntityNames(entityNames) {
  const names = Array.isArray(entityNames) ? entityNames : [];
  return Array.from(new Set(names.map((name) => String(name || "").trim()).filter(Boolean)));
}

function entityNameAliases(name) {
  const raw = String(name || "").trim();
  if (!raw) {
    return [];
  }

  const aliases = new Set([raw]);
  const parts = raw.split("_").filter(Boolean);
  if (parts.length > 0) {
    aliases.add(parts[0]);
  }

  return Array.from(aliases);
}

function buildEntityNameInfo(entityNamesForIDs, namesForText) {
  const idNames = normalizeEntityNames(entityNamesForIDs);
  const textNames = normalizeEntityNames(namesForText && namesForText.length > 0 ? namesForText : idNames);

  const entityNameUpperSet = new Set(textNames.map((name) => name.toUpperCase()));
  const entityContainerKeySet = new Set(idNames.map((name) => name.toLowerCase()));
  const entityIDKeySet = new Set(idNames.map((name) => `${name.toLowerCase()}_id`));
  entityIDKeySet.add("entiteit_id");

  return { entityNameUpperSet, entityContainerKeySet, entityIDKeySet };
}

function bumpNieuweEntiteitTekst(value, offset, entityNameUpperSet) {
  if (offset === 0 || typeof value !== "string") {
    return value;
  }

  if (!(entityNameUpperSet instanceof Set) || entityNameUpperSet.size === 0) {
    return value;
  }

  return value.replace(/\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*(-?\d+)\b/g, (full, entityName, rawId) => {
    if (!entityNameUpperSet.has(String(entityName).toUpperCase())) {
      return full;
    }
    const bumped = Number(rawId) + offset;
    return `${entityName}=${bumped}`;
  });
}

function applyEntityIDOffsetDeep(value, offset, entityNamesForIDs, namesForText, parentKey = "", entityNameInfo = null) {
  if (offset === 0) {
    return value;
  }

  const info = entityNameInfo || buildEntityNameInfo(entityNamesForIDs, namesForText);

  if (Array.isArray(value)) {
    return value.map((item) => applyEntityIDOffsetDeep(item, offset, entityNamesForIDs, namesForText, parentKey, info));
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      return bumpNieuweEntiteitTekst(value, offset, info.entityNameUpperSet);
    }
    return value;
  }

  const out = {};
  Object.keys(value).forEach((key) => {
    const fieldValue = value[key];
    const lowerKey = String(key).toLowerCase();
    if (info.entityIDKeySet.has(lowerKey)) {
      out[key] = bumpNumericLike(fieldValue, offset);
      return;
    }
    if (lowerKey === "id" && info.entityContainerKeySet.has(String(parentKey).toLowerCase())) {
      out[key] = bumpNumericLike(fieldValue, offset);
      return;
    }

    out[key] = applyEntityIDOffsetDeep(fieldValue, offset, entityNamesForIDs, namesForText, key, info);
  });
  return out;
}

function applyRegistratieIDOffsetDeep(value, registratieIdOffset) {
  if (registratieIdOffset === 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyRegistratieIDOffsetDeep(item, registratieIdOffset));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const registratieRefKeys = new Set([
    "maakt_ongedaan_registratie_id",
    "maaktongedaanregistratieid",
    "corrigeert_registratie_id",
    "corrigeertregistratieid",
  ]);

  const out = {};
  Object.keys(value).forEach((key) => {
    const fieldValue = value[key];
    const normalizedKey = String(key).replace(/[^A-Za-z0-9_]/g, "").toLowerCase();
    if (registratieRefKeys.has(normalizedKey)) {
      out[key] = bumpNumericLike(fieldValue, registratieIdOffset);
      return;
    }
    out[key] = applyRegistratieIDOffsetDeep(fieldValue, registratieIdOffset);
  });

  return out;
}

function normalizeRegistrationForExport(reg) {
  let requestBody = reg.request_body ?? null;
  if (requestBody && typeof requestBody === "object" && !Array.isArray(requestBody)) {
    const innerRegistratie = requestBody.registratie;
    if (innerRegistratie && typeof innerRegistratie === "object" && !Array.isArray(innerRegistratie)) {
      const nieuweOpmerking = normalizeOpmerkingInput(reg.opmerking);
      const nextRegistratie = { ...innerRegistratie };
      if (nieuweOpmerking == null) {
        delete nextRegistratie.opmerking;
      } else {
        nextRegistratie.opmerking = nieuweOpmerking;
      }
      requestBody = {
        ...requestBody,
        registratie: nextRegistratie,
      };
    }
  }

  return {
    registratie_id: reg.id,
    registratietype: reg.registratietype,
    tijdstip: reg.tijdstip,
    request_path: reg.request_path || "/registratie/",
    request_method: (reg.request_method || "POST").toUpperCase(),
    request_body: requestBody,
    expected_response_code: reg.response_code ?? null,
    expected_response_body: reg.response_body ?? null,
  };
}

function sortRegistratiesById(rows) {
  return [...rows].sort((a, b) => {
    const left = Number(a?.id ?? 0);
    const right = Number(b?.id ?? 0);
    return left - right;
  });
}

function toTooltip(value) {
  if (value == null || value === "") {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateTooltip(text, maxLength = 3500) {
  if (typeof text !== "string") {
    return "-";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n... (afgekapt)`;
}

function normalizeOpmerkingInput(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

function asPositiveIntOrNull(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }
  return n;
}

function refRegistratieIdVoorReg(reg) {
  const type = String(reg?.registratietype || "").toLowerCase();
  if (type === "ongedaanmaking") {
    return (
      asPositiveIntOrNull(reg?.maakt_ongedaan_registratie_id) ??
      asPositiveIntOrNull(reg?.maaktOngedaanRegistratieID)
    );
  }
  if (type === "correctie") {
    return (
      asPositiveIntOrNull(reg?.corrigeert_registratie_id) ??
      asPositiveIntOrNull(reg?.corrigeertRegistratieID)
    );
  }
  return null;
}

export default function RegistratieReplayPage() {
  const [baseUrl, setBaseUrl] = useState(() => window.location.origin || "http://localhost:8080");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [registraties, setRegistraties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [selectAllBusy, setSelectAllBusy] = useState(false);
  const [selectAllError, setSelectAllError] = useState("");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [importEntries, setImportEntries] = useState([]);
  const [importError, setImportError] = useState("");
  const [runningReplay, setRunningReplay] = useState(false);
  const [ignoreDynamicFields, setIgnoreDynamicFields] = useState(true);
  const [entityIdOffset, setEntityIdOffset] = useState(0);
  const [registratieIdOffset, setRegistratieIdOffset] = useState(0);
  const [schemaEntiteitNamen, setSchemaEntiteitNamen] = useState([]);
  const [schemaTypeNamen, setSchemaTypeNamen] = useState([]);
  const [replayResults, setReplayResults] = useState([]);
  const [editingOpmerkingId, setEditingOpmerkingId] = useState(null);
  const [editingOpmerkingValue, setEditingOpmerkingValue] = useState("");
  const [savingOpmerkingId, setSavingOpmerkingId] = useState(null);
  const [opmerkingSaveError, setOpmerkingSaveError] = useState("");

  // Domein-filter: "" = alle, anders bijv. "np_loc"
  const [domeinFilter, setDomeinFilter] = useState("");
  // Unieke domeinen verzameld uit geladen registraties (voor de dropdown)
  const [beschikbareDomeinen, setBeschikbareDomeinen] = useState([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const qs = new URLSearchParams({ page: String(page), size: String(size) });
        if (domeinFilter) qs.set("domein", domeinFilter);
        qs.set("_ts", String(Date.now()));
        const res = await fetch(`${baseUrl}/full/registraties?${qs.toString()}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const rows = Array.isArray(json?.Registraties) ? json.Registraties : [];
        if (!active) {
          return;
        }
        setRegistraties(sortRegistratiesById(rows));
        setHasMore(Boolean(json?.has_more));
        // Verzamel unieke domeinen voor de filter-dropdown
        const domSet = new Set();
        for (const r of rows) {
          if (Array.isArray(r?.domeinen)) {
            for (const d of r.domeinen) if (d) domSet.add(d);
          }
        }
        setBeschikbareDomeinen((prev) => {
          const merged = new Set([...prev, ...domSet]);
          return [...merged].sort();
        });
      } catch (err) {
        if (!active || err?.name === "AbortError") {
          return;
        }
        setRegistraties([]);
        setHasMore(false);
        setLoadError(String(err?.message || err));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [baseUrl, page, size, domeinFilter]);

  useEffect(() => {
    let active = true;

    async function loadSchemaEntiteitNamen() {
      try {
        const res = await fetch(`${baseUrl}/api/viz/schema`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          throw new Error(`Schema HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!active) {
          return;
        }

        const types = Array.isArray(json?.types) ? json.types : [];
        const entiteitNames = types
          .filter((typeMeta) => String(typeMeta?.metatype || "").toLowerCase() === "entiteit")
          .map((typeMeta) => String(typeMeta?.typenaam || "").trim())
          .filter(Boolean);

        const alleTypeNames = types
          .map((typeMeta) => String(typeMeta?.typenaam || "").trim())
          .filter(Boolean);

        setSchemaEntiteitNamen(normalizeEntityNames(entiteitNames));
        setSchemaTypeNamen(normalizeEntityNames(alleTypeNames));

        // Verzamel unieke domeinen uit schema voor de filter-dropdown
        const schemaDomeinen = [...new Set(
          types.map((t) => String(t?.domein || "").trim()).filter(Boolean)
        )].sort();
        setBeschikbareDomeinen((prev) => {
          const merged = new Set([...prev, ...schemaDomeinen]);
          return [...merged].sort();
        });
      } catch {
        if (active) {
          setSchemaEntiteitNamen([]);
          setSchemaTypeNamen([]);
        }
      }
    }

    loadSchemaEntiteitNamen();
    return () => {
      active = false;
    };
  }, [baseUrl]);

  const selectedRegs = useMemo(() => {
    const idSet = selectedIds;
    return registraties.filter((reg) => idSet.has(String(reg?.id)));
  }, [registraties, selectedIds]);

  const allCurrentPageSelected = useMemo(() => {
    return registraties.length > 0 && registraties.every((reg) => selectedIds.has(String(reg?.id)));
  }, [registraties, selectedIds]);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleSelectAllCurrentPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = registraties.length > 0 && registraties.every((reg) => next.has(String(reg?.id)));
      if (allSelected) {
        registraties.forEach((reg) => next.delete(String(reg?.id)));
      } else {
        registraties.forEach((reg) => next.add(String(reg?.id)));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function startEditOpmerking(reg) {
    setOpmerkingSaveError("");
    setEditingOpmerkingId(String(reg?.id || ""));
    setEditingOpmerkingValue(String(reg?.opmerking || ""));
  }

  function cancelEditOpmerking() {
    setEditingOpmerkingId(null);
    setEditingOpmerkingValue("");
    setOpmerkingSaveError("");
  }

  async function saveOpmerking(regId, value) {
    const key = String(regId || "");
    if (!key || savingOpmerkingId === key) {
      return;
    }

    const huidigeReg = registraties.find((reg) => String(reg?.id) === key);
    const oudeOpmerking = normalizeOpmerkingInput(huidigeReg?.opmerking);
    const nieuweOpmerking = normalizeOpmerkingInput(value);
    if (oudeOpmerking === nieuweOpmerking) {
      setEditingOpmerkingId(null);
      setEditingOpmerkingValue("");
      return;
    }

    setSavingOpmerkingId(key);
    setOpmerkingSaveError("");
    try {
      const payload = {
        opmerking: nieuweOpmerking,
      };

      const res = await fetch(`${baseUrl}/registraties/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const updated = json?.registratie || null;
      setRegistraties((prev) => sortRegistratiesById(prev.map((reg) => {
        if (String(reg?.id) !== key) {
          return reg;
        }
        if (updated && typeof updated === "object") {
          return { ...reg, ...updated };
        }
        return { ...reg, opmerking: payload.opmerking };
      })));

      setEditingOpmerkingId(null);
      setEditingOpmerkingValue("");
    } catch (err) {
      setOpmerkingSaveError(String(err?.message || err));
    } finally {
      setSavingOpmerkingId(null);
    }
  }

  async function fetchRegistratiesPage(pageNumber, bypassCache = false) {
    const qs = new URLSearchParams({ page: String(pageNumber), size: String(size) });
    if (bypassCache) {
      qs.set("_ts", `${Date.now()}-${pageNumber}`);
    }
    const res = await fetch(`${baseUrl}/full/registraties?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    return {
      rows: sortRegistratiesById(Array.isArray(json?.Registraties) ? json.Registraties : []),
      hasMoreRows: Boolean(json?.has_more),
    };
  }

  async function fetchAllRegistraties(bypassCache = false) {
    const all = [];
    let pageNumber = 1;
    let hasMoreRows = true;

    while (hasMoreRows) {
      const chunk = await fetchRegistratiesPage(pageNumber, bypassCache);
      all.push(...chunk.rows);
      hasMoreRows = chunk.hasMoreRows;
      pageNumber += 1;

      if (pageNumber > 10000) {
        throw new Error("Te veel pagina's tijdens ophalen van alle registraties.");
      }
    }

    return all;
  }

  async function selectAllAcrossPages() {
    if (selectAllBusy) {
      return;
    }
    setSelectAllBusy(true);
    setSelectAllError("");
    try {
      const allRows = await fetchAllRegistraties(true);
      const allIds = new Set(allRows.map((reg) => String(reg?.id)).filter((id) => id && id !== "undefined"));
      setSelectedIds(allIds);
    } catch (err) {
      setSelectAllError(String(err?.message || err));
    } finally {
      setSelectAllBusy(false);
    }
  }

  async function exportSelected() {
    const idsToExport = selectedIds.size > 0
      ? new Set(selectedIds)
      : new Set(registraties.map((reg) => String(reg?.id)).filter((id) => id && id !== "undefined"));

    if (idsToExport.size === 0) {
      return;
    }

    try {
      setSelectAllError("");
      const allRows = await fetchAllRegistraties(true);
      const source = allRows.filter((reg) => idsToExport.has(String(reg?.id)));

      if (source.length === 0) {
        setSelectAllError("Exportfout: geen registraties gevonden voor de huidige selectie.");
        return;
      }

      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        source: `${baseUrl}/full/registraties?page=${page}&size=${size}`,
        count: source.length,
        entries: source.map(normalizeRegistrationForExport),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registraties-replay-p${page}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSelectAllError(`Exportfout: ${String(err?.message || err)}`);
    }
  }

  async function importFile(file) {
    if (!file) {
      return;
    }

    setImportError("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const entries = Array.isArray(json?.entries) ? json.entries : [];
      if (entries.length === 0) {
        throw new Error("Importbestand bevat geen entries[].");
      }
      setImportEntries(entries);
      setReplayResults([]);
    } catch (err) {
      setImportEntries([]);
      setReplayResults([]);
      setImportError(String(err?.message || err));
    }
  }

  async function runImportedReplay() {
    if (importEntries.length === 0 || runningReplay) {
      return;
    }

    setRunningReplay(true);
    setReplayResults([]);

    const results = [];
    for (let i = 0; i < importEntries.length; i += 1) {
      const entry = importEntries[i] || {};
      const method = String(entry.request_method || "POST").toUpperCase();
      const requestPath = String(entry.request_path || "/registratie/");
      const requestBody = entry.request_body ?? null;
      const expectedResponseBody = entry.expected_response_body ?? null;
      const expectedResponseCode = typeof entry.expected_response_code === "number" ? entry.expected_response_code : null;

      const requestBodyWithEntityOffset = applyEntityIDOffsetDeep(
        requestBody,
        entityIdOffset,
        schemaEntiteitNamen,
        schemaTypeNamen
      );
      const requestBodyForRun = applyRegistratieIDOffsetDeep(requestBodyWithEntityOffset, registratieIdOffset);

      const itemResult = {
        index: i,
        registratie_id: entry.registratie_id ?? null,
        request_path: requestPath,
        request_method: method,
        ok: false,
        status: null,
        matches_status: null,
        matches_response: null,
        error: "",
      };

      try {
        const response = await fetch(`${baseUrl}${requestPath}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: requestBodyForRun == null ? null : JSON.stringify(requestBodyForRun),
        });

        itemResult.status = response.status;
        if (expectedResponseCode != null) {
          itemResult.matches_status = response.status === expectedResponseCode;
        }

        const bodyText = await response.text();
        const parsedActual = tryParseJson(bodyText);
        const actualBody = parsedActual.ok ? parsedActual.value : bodyText;

        const parsedExpected = tryParseJson(expectedResponseBody);
        if (parsedExpected.ok && parsedActual.ok) {
          const expectedWithEntityOffset = applyEntityIDOffsetDeep(
            parsedExpected.value,
            entityIdOffset,
            schemaEntiteitNamen,
            schemaTypeNamen
          );
          const expectedForCompare = applyRegistratieIDOffsetDeep(expectedWithEntityOffset, registratieIdOffset);
          itemResult.matches_response = areJsonEqual(expectedForCompare, actualBody, ignoreDynamicFields);
        } else if (expectedResponseBody == null) {
          itemResult.matches_response = null;
        } else {
          itemResult.matches_response = String(expectedResponseBody) === String(bodyText);
        }

        itemResult.ok = response.ok;
      } catch (err) {
        itemResult.error = String(err?.message || err);
      }

      results.push(itemResult);
      setReplayResults([...results]);
    }

    setRunningReplay(false);
  }

  const replaySummary = useMemo(() => {
    if (replayResults.length === 0) {
      return null;
    }
    const total = replayResults.length;
    const ok = replayResults.filter((x) => x.ok).length;
    const responseMatches = replayResults.filter((x) => x.matches_response === true).length;
    const statusMatches = replayResults.filter((x) => x.matches_status === true).length;
    return { total, ok, responseMatches, statusMatches };
  }, [replayResults]);

  return (
    <div className="container" style={{ maxWidth: 1400 }}>
      <h1 className="page-title">Registraties replay en vergelijking</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        <a className="muted" href="/viz/react/">Schema-index</a>
        {" | "}
        <a className="muted" href="/viz/react/tijdlijn.html">Schema-tijdlijn</a>
      </p>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="controls" style={{ gridTemplateColumns: "2fr 120px 120px 160px auto auto auto auto auto" }}>
          <label>
            Base URL
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value.trim())} placeholder="http://localhost:8080" />
          </label>
          <label>
            Pagina
            <input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(Math.max(1, Number(e.target.value || 1)))}
            />
          </label>
          <label>
            Grootte
            <input
              type="number"
              min={1}
              max={100}
              value={size}
              onChange={(e) => setSize(Math.min(100, Math.max(1, Number(e.target.value || DEFAULT_PAGE_SIZE))))}
            />
          </label>
          <label>
            Domein
            <select
              value={domeinFilter}
              onChange={(e) => { setDomeinFilter(e.target.value); setPage(1); }}
            >
              <option value="">Alle domeinen</option>
              {beschikbareDomeinen.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label style={{ justifyContent: "flex-end" }}>
            <span>&nbsp;</span>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Vorige
            </button>
          </label>
          <label style={{ justifyContent: "flex-end" }}>
            <span>&nbsp;</span>
            <button type="button" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
              Volgende
            </button>
          </label>
          <label style={{ justifyContent: "flex-end" }}>
            <span>&nbsp;</span>
            <button type="button" onClick={toggleSelectAllCurrentPage}>
              {allCurrentPageSelected ? "Deselecteer pagina" : "Selecteer pagina"}
            </button>
          </label>
          <label style={{ justifyContent: "flex-end" }}>
            <span>&nbsp;</span>
            <button type="button" onClick={clearSelection} disabled={selectedIds.size === 0}>Deselecteer alles</button>
          </label>
          <label style={{ justifyContent: "flex-end" }}>
            <span>&nbsp;</span>
            <button type="button" onClick={selectAllAcrossPages} disabled={selectAllBusy}>
              {selectAllBusy ? "Alles selecteren..." : "Selecteer alles (alle pagina's)"}
            </button>
          </label>
        </div>
        {loadError && <p style={{ color: "#b91c1c", margin: "10px 0 0" }}>Fout: {loadError}</p>}
        {selectAllError && <p style={{ color: "#b91c1c", margin: "10px 0 0" }}>Select-all fout: {selectAllError}</p>}
        {opmerkingSaveError && <p style={{ color: "#b91c1c", margin: "10px 0 0" }}>Opslaan opmerking mislukt: {opmerkingSaveError}</p>}
        <p className="muted" style={{ marginBottom: 0 }}>
          {loading
            ? "Registraties laden..."
            : `Aantal op pagina: ${registraties.length}, geselecteerd op pagina: ${selectedRegs.length}, totaal geselecteerd: ${selectedIds.size}.`}
        </p>
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <button type="button" onClick={exportSelected} disabled={registraties.length === 0}>
            Exporteer selectie als JSON
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, flexDirection: "row" }}>
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      disabled={registraties.length === 0}
                    />
                    Select all
                  </label>
                </th>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}
                  title="Standaard sortering: ID oplopend"
                >
                  ID ↑
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Domeinen</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Opmerking</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Tijdstip</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Ref</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Route</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Duur (ms)</th>
              </tr>
            </thead>
            <tbody>
              {registraties.map((reg) => {
                const key = String(reg?.id);
                const refId = refRegistratieIdVoorReg(reg);
                const isEditingOpmerking = editingOpmerkingId === key;
                const isSavingOpmerking = savingOpmerkingId === key;
                return (
                  <tr key={key}>
                    <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>
                      <input type="checkbox" checked={selectedIds.has(key)} onChange={() => toggleSelected(reg?.id)} />
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{reg?.id}</td>
                    <td
                      style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}
                      title={truncateTooltip(toTooltip(reg?.opmerking || "Geen opmerking"))}
                    >
                      {reg?.registratietype || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>
                      {Array.isArray(reg?.domeinen) && reg.domeinen.length > 0
                        ? reg.domeinen.map((d) => (
                            <span
                              key={d}
                              style={{
                                display: "inline-block",
                                padding: "1px 7px",
                                marginRight: 4,
                                borderRadius: 9999,
                                fontSize: 11,
                                fontWeight: 600,
                                background: domeinKleur(d),
                                color: "#fff",
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                              }}
                              title={`Filter op ${d}`}
                              onClick={() => { setDomeinFilter(d); setPage(1); }}
                            >
                              {d}
                            </span>
                          ))
                        : <span style={{ color: "#94a3b8" }}>-</span>}
                    </td>
                    <td
                      style={{ borderBottom: "1px solid #e2e8f0", padding: 8, minWidth: 260 }}
                      title={isEditingOpmerking ? "" : "Klik om opmerking te bewerken"}
                    >
                      {isEditingOpmerking ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            value={editingOpmerkingValue}
                            onChange={(e) => setEditingOpmerkingValue(e.target.value)}
                            onBlur={() => saveOpmerking(reg?.id, editingOpmerkingValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveOpmerking(reg?.id, editingOpmerkingValue);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEditOpmerking();
                              }
                            }}
                            disabled={isSavingOpmerking}
                            autoFocus
                            style={{ minWidth: 220, width: "100%" }}
                          />
                          {isSavingOpmerking && (
                            <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                              Opslaan...
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditOpmerking(reg)}
                          style={{
                            all: "unset",
                            cursor: "pointer",
                            display: "inline-block",
                            width: "100%",
                            color: "inherit",
                          }}
                        >
                          {reg?.opmerking || "-"}
                        </button>
                      )}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{reg?.tijdstip || "-"}</td>
                    <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{refId ?? "-"}</td>
                    <td
                      style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}
                      title={truncateTooltip(toTooltip(reg?.request_body))}
                    >
                      {reg?.request_method || "-"} {reg?.request_path || "-"}
                    </td>
                    <td
                      style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}
                      title={truncateTooltip(toTooltip(reg?.response_body ?? reg?.error ?? reg?.foutmelding ?? "Geen response/fout beschikbaar"))}
                    >
                      {reg?.response_code ?? "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{reg?.duration_ms ?? "-"}</td>
                  </tr>
                );
              })}
              {registraties.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} style={{ padding: 10, color: "#64748b" }}>
                    Geen registraties gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>Import en replay</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => importFile(e.target.files?.[0] || null)}
          />
          <button type="button" onClick={runImportedReplay} disabled={importEntries.length === 0 || runningReplay}>
            {runningReplay ? "Replay draait..." : "Voer replay uit"}
          </button>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexDirection: "row" }}
            title="Voegt deze waarde toe aan alle entiteit-ID's (a_id, b_id, etc.) en aan nummers in opmerkingteksten (bijv. 'A=1' wordt 'A=101' met offset=100)"
          >
            Entiteit-ID offset X
            <input
              type="number"
              value={entityIdOffset}
              onChange={(e) => setEntityIdOffset(Number(e.target.value || 0))}
              style={{ width: 100 }}
            />
          </label>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexDirection: "row" }}
            title="Voegt deze waarde toe aan registratie-ID's in verwijzingen (maakt_ongedaan_registratie_id, corrigeert_registratie_id)"
          >
            Registratie-ID offset X
            <input
              type="number"
              value={registratieIdOffset}
              onChange={(e) => setRegistratieIdOffset(Number(e.target.value || 0))}
              style={{ width: 100 }}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, flexDirection: "row" }}>
            <input
              type="checkbox"
              checked={ignoreDynamicFields}
              onChange={(e) => setIgnoreDynamicFields(Boolean(e.target.checked))}
            />
            Negeer dynamische velden en tijdstempels (tijdstip, opvoer/afvoer als tijd)
          </label>
        </div>
        {importError && <p style={{ color: "#b91c1c", margin: "8px 0" }}>Importfout: {importError}</p>}
        <p className="muted" style={{ margin: "6px 0" }}>Geimporteerde entries: {importEntries.length}</p>
        {replaySummary && (
          <p className="muted" style={{ margin: "6px 0" }}>
            Replay: {replaySummary.ok}/{replaySummary.total} HTTP-ok, status-match {replaySummary.statusMatches}, response-match {replaySummary.responseMatches}
          </p>
        )}

        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>#</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Reg ID</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Methode/route</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Status match</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Response match</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: 8 }}>Fout</th>
              </tr>
            </thead>
            <tbody>
              {replayResults.map((result) => (
                <tr key={`${result.index}-${result.registratie_id ?? "n/a"}`}>
                  <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{result.index + 1}</td>
                  <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{result.registratie_id ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{result.request_method} {result.request_path}</td>
                  <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{result.status ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{result.matches_status == null ? "-" : String(result.matches_status)}</td>
                  <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8 }}>{result.matches_response == null ? "-" : String(result.matches_response)}</td>
                  <td style={{ borderBottom: "1px solid #e2e8f0", padding: 8, color: "#b91c1c" }}>{result.error || "-"}</td>
                </tr>
              ))}
              {replayResults.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 10, color: "#64748b" }}>
                    Nog geen replay-resultaten.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>Voorbeeld van huidige selectie</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Handig om snel te controleren wat er in export/import meegaat.
        </p>
        <pre
          style={{
            margin: 0,
            maxHeight: 260,
            overflow: "auto",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {toPrettyJson((selectedRegs[0] ? normalizeRegistrationForExport(selectedRegs[0]) : registraties[0] ? normalizeRegistrationForExport(registraties[0]) : null))}
        </pre>
      </section>
    </div>
  );
}
