import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray, platSlaHubItems } from "../../shared/schemaUtils";
import { bouwReflijstOptieLabel, evalueerWeergaveVeldenVoorItem, berekenWeergaveveld } from "../../shared/celEvaluator";

const PAGE_SIZE = 20;

/**
 * Kolommen worden dynamisch bepaald op basis van de schema-API (typeMeta):
 *   - Entiteiten: ID + weergaveveld (CEL) + tellerkolommen per GE + materiële tijd
 *   - Andere types: alle primitieve velden uit de schema
 *
 * Entiteiten worden opgehaald via /full/{padnaam} (inclusief geneste GE's),
 * zodat weergavevelden berekenbaar zijn. Rijen zijn klikbaar naar het
 * EntiteitFormulier voor detail/bewerking.
 */
export default function RepresentatieTabel({ typeMeta }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef(null);
  // Ref-FK weergavenamen: { "TypeNaam": { "id": "label" } }
  // Gevuld via de reflijst-opties API voor alle ref-FK velden in de onderliggende GE's.
  const [refNaamCache, setRefNaamCache] = useState({});

  const isEntiteit = typeMeta?.metatype === "entiteit";
  // API-pad: padnaam is het URL-pad, meervoud is de weergavenaam
  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;

  // Velden → kolommen: entiteiten tonen id + weergaveveld + tellerkolommen per GE
  const columns = useMemo(() => {
    const cols = [];

    if (isEntiteit) {
      // ID-kolom
      const idKolom = typeMeta.idKolom || "id";
      cols.push({
        accessorKey: idKolom,
        header: idKolom,
        meta: { type: "integer" },
        cell: ({ getValue }) => String(getValue() ?? "—"),
      });

      // Weergaveveld-kolom (afgeleid uit CEL-expressies)
      const heeftWeergaveveld = safeArray(typeMeta?.afgeleideVelden)
        .some((av) => av.isWeergaveVeld || av.weergaveVeld);
      if (heeftWeergaveveld) {
        cols.push({
          id: "__weergave__",
          header: "weergave",
          accessorFn: (row) => berekenWeergaveveld(row, typeMeta, typeMetaByTypenaam, refNaamCache),
          cell: ({ getValue }) => {
            const val = getValue();
            if (!val) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            return <span style={{ fontStyle: "italic" }}>{val}</span>;
          },
        });
      }

      // Inhoudskolommen per onderliggend GE/relatie (skip materiële plumbing)
      for (const child of safeArray(typeMeta?.onderliggende)) {
        const key = child.jsonRolnaam || child.rolnaam;
        if (!key) continue;
        // Skip aanvang/einde plumbing
        const childMeta = typeMetaByTypenaam?.[child.doeltype];
        if (childMeta?.ge_subtype === "aanvang" || childMeta?.ge_subtype === "einde") continue;

        // Bepaal inhoudsvelden (data-velden minus plumbing)
        const dataChild = safeArray(childMeta?.onderliggende).find((c) => {
          const cm = typeMetaByTypenaam?.[c.doeltype];
          return cm?.ge_subtype === "data";
        });
        const veldenBron = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : childMeta;
        const inhoudsvelden = safeArray(veldenBron?.velden).filter((v) => {
          const n = String(v.naam || "").toLowerCase();
          const overTeSlaan = new Set(["id", "rel_id", "opvoer", "afvoer", "versie"]);
          if (childMeta.idKolom) overTeSlaan.add(String(childMeta.idKolom).toLowerCase());
          if (childMeta.entiteitIDKolom) overTeSlaan.add(String(childMeta.entiteitIDKolom).toLowerCase());
          return !overTeSlaan.has(n) && !v.autoIncrement;
        });

        cols.push({
          accessorKey: key,
          header: childMeta?.klassenaam || key,
          cell: ({ getValue }) => {
            const val = getValue();
            const hubItems = safeArray(val);
            if (hubItems.length === 0) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            // Platslaan per hub-item en veldwaarden extraheren
            const regels = hubItems.map((hub, idx) => {
              const plat = platSlaHubItems([hub], childMeta, typeMetaByTypenaam);
              const item = plat[0] || hub;
              const weergaveTeksten = evalueerWeergaveVeldenVoorItem(
                childMeta?.afgeleideVelden,
                item,
                childMeta,
                typeMetaByTypenaam,
              );
              const weergave = weergaveTeksten.join(" | ");
              const waarden = inhoudsvelden
                .map((v) => item[v.naam] != null ? String(item[v.naam]) : "")
                .filter(Boolean)
                .join(" | ");
              const label = item.rel_id ?? hub?.rel_id ?? idx + 1;
              const tekst = weergave || waarden;
              const tooltip = weergave && waarden && weergave !== waarden
                ? `${weergave} — ${waarden}`
                : tekst;
              return { label, tekst, tooltip };
            }).filter((r) => r.tekst);
            if (regels.length === 0) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            // Enkelvoudig: toon weergaveveld als aanwezig, anders ruwe inhoud; meervoudig: rel_id: tekst
            const tekst = regels.length === 1
              ? regels[0].tekst
              : regels.map((r) => `${r.label}: ${r.tekst}`).join("; ");
            const tooltip = regels.length === 1
              ? regels[0].tooltip
              : regels.map((r) => `${r.label}: ${r.tooltip}`).join("; ");
            const MAX = 60;
            return (
              <span title={tooltip.length > MAX ? tooltip : undefined}>
                {tekst.length > MAX ? tekst.slice(0, MAX) + "…" : tekst}
              </span>
            );
          },
        });
      }

      // Materiële tijd kolommen (aanvang/einde)
      for (const child of safeArray(typeMeta?.onderliggende)) {
        const childMeta = typeMetaByTypenaam?.[child.doeltype];
        if (childMeta?.ge_subtype === "aanvang") {
          cols.push({
            id: "__aanvang__",
            header: "aanvang",
            accessorFn: (row) => {
              const items = safeArray(row[child.jsonRolnaam] || row[child.rolnaam]);
              const actief = items.find((i) => !i.afvoer) || items[0];
              return actief?.datum || "";
            },
            cell: ({ getValue }) => {
              const v = getValue();
              return v ? String(v).slice(0, 10) : <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            },
          });
        }
        if (childMeta?.ge_subtype === "einde") {
          cols.push({
            id: "__einde__",
            header: "einde",
            accessorFn: (row) => {
              const items = safeArray(row[child.jsonRolnaam] || row[child.rolnaam]);
              const actief = items.find((i) => !i.afvoer) || items[0];
              return actief?.datum || "";
            },
            cell: ({ getValue }) => {
              const v = getValue();
              return v ? String(v).slice(0, 10) : <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            },
          });
        }
      }
    } else {
      // Niet-entiteiten: gewone velden
      const velden = safeArray(typeMeta?.velden);
      for (const veld of velden) {
        if (veld.format === "array") continue;
        cols.push({
          accessorKey: veld.naam,
          header: veld.naam,
          meta: { type: veld.type, format: veld.format, enumOpties: veld.enum },
          cell: ({ getValue }) => {
            const val = getValue();
            if (val === null || val === undefined) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            if (String(veld.format) === "date" && typeof val === "string") return val.slice(0, 10);
            if (String(veld.format) === "date-time" && typeof val === "string") return val.replace("T", " ").slice(0, 19);
            return String(val);
          },
        });
      }
    }

    return cols;
  }, [typeMeta, isEntiteit, typeMetaByTypenaam, refNaamCache]);

  // Data ophalen — entiteiten via /full/ (met geneste GE's), overig via flat endpoint
  // Bij een zoekterm (q) wordt server-side ILIKE search gebruikt op alle string-kolommen.
  const fetchData = useCallback(async (q = "") => {
    if (!apiPath) return;
    setLoading(true);
    setError(null);
    try {
      const prefix = isEntiteit ? "full/" : "";
      const params = new URLSearchParams({ page: "1", size: "1000" });
      if (q) params.set("q", q);
      const res = await fetch(`${baseUrl}/${prefix}${apiPath}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const key = typeMeta.meervoud || Object.keys(json).find((k) => Array.isArray(json[k]));
      setData(safeArray(json[key] || json));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, typeMeta, apiPath, isEntiteit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Server-side zoeken via ?q= ────────────────────────────────────────
  // Wanneer de gebruiker een kolomfilter invult, wordt de waarde na een korte
  // debounce als ?q= parameter naar de backend gestuurd. De backend doet een
  // ILIKE-search over alle string-kolommen (zie core_handlers.go). Zo vind je
  // ook records die niet in de eerste 2000 passen.
  useEffect(() => {
    const actieveFilter = columnFilters.find((f) => f.value);
    const q = actieveFilter ? String(actieveFilter.value).trim() : "";
    setSearchQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(q);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [columnFilters, fetchData]);

  // ── Ref-FK weergavenamen ophalen ──────────────────────────────────────
  // Haal voor alle ref-FK velden in de onderliggende GE's de weergavenamen op via de
  // reflijst-opties API en sla ze op in refNaamCache. berekenWeergaveveld gebruikt deze
  // cache om CEL-context te verrijken met `veldnaam_naam` velden (bijv. gemeente_naam).
  useEffect(() => {
    if (!typeMeta || !baseUrl || !isEntiteit) return;
    let cancelled = false;
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
        try {
          const res = await fetch(
            `${baseUrl}/api/viz/reflijst/${encodeURIComponent(refType)}/opties?size=500`
          );
          if (!res.ok) return [refType, {}];
          const json = await res.json();
          const lookup = {};
          for (const optie of safeArray(json?.opties)) {
            lookup[String(optie.id)] = bouwReflijstOptieLabel(optie, refMeta, typeMetaByTypenaam);
          }
          return [refType, lookup];
        } catch {
          return [refType, {}];
        }
      })
    ).then((entries) => {
      if (!cancelled) setRefNaamCache(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [typeMeta, typeMetaByTypenaam, baseUrl, isEntiteit]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  function handleRijKlik(row) {
    const idKolom = typeMeta.idKolom || "id";
    const idWaarde = row.original[idKolom];
    if (idWaarde != null) {
      navigate(`/t/${typeMeta.padnaam || typeMeta.meervoud || typeMeta.veldnaam}/${idWaarde}`);
    }
  }

  if (error) {
    return <div className="cg-feedback--fout">Fout bij laden: {error}</div>;
  }

  return (
    <div>
      {loading && <div style={{ padding: "0.5rem 0", color: "var(--cg-donkergrijs)" }}>Laden…</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="utrecht-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="utrecht-table__header-row">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="utrecht-table__header-cell"
                    style={{
                      cursor: header.column.getCanSort() ? "pointer" : "default",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && <span className="cg-sort-indicator">▲</span>}
                    {header.column.getIsSorted() === "desc" && <span className="cg-sort-indicator">▼</span>}
                  </th>
                ))}
              </tr>
            ))}
            {/* Filter rij */}
            <tr>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th key={`filter-${header.id}`} style={{ padding: "4px 6px", background: "var(--cg-lichtgrijs)" }}>
                  <FilterInvoer column={header.column} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && !loading && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: "1rem", color: "var(--cg-donkergrijs)" }}>
                  Geen records gevonden.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className="utrecht-table__row cg-table-row-clickable"
                style={{ background: i % 2 === 1 ? "var(--cg-lichtgrijs)" : undefined }}
                onClick={() => handleRijKlik(row)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") handleRijKlik(row); }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="utrecht-table__cell" style={{ padding: "0.5rem 0.75rem" }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginering */}
      <div className="cg-pagination">
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ← Vorige
        </button>
        <span style={{ fontSize: "0.875rem", color: "var(--cg-donkergrijs)" }}>
          Pagina {table.getState().pagination.pageIndex + 1} van {table.getPageCount() || 1}
          {" "}({data.length} records)
        </span>
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Volgende →
        </button>
      </div>
    </div>
  );
}

function FilterInvoer({ column }) {
  const meta = column.columnDef.meta;
  const filterValue = column.getFilterValue() ?? "";
  const enumOpties = Array.isArray(meta?.enumOpties) ? meta.enumOpties.filter(Boolean) : [];

  if (enumOpties.length > 0) {
    return (
      <select
        value={filterValue}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        style={{ width: "100%", fontSize: "0.8125rem", padding: "2px 4px" }}
      >
        <option value="">Alles</option>
        {enumOpties.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={filterValue}
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      placeholder="Filter…"
      style={{ width: "100%", fontSize: "0.8125rem", padding: "2px 4px" }}
    />
  );
}
