import { useState, useEffect, useMemo, useCallback } from "react";
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
import { evalueerCelExpressie, bouwCelContext } from "../../shared/celEvaluator";

const PAGE_SIZE = 20;

/**
 * Berekent weergaveveld-tekst voor een entiteit op basis van afgeleide velden.
 *
 * Bitemporele context:
 *   De weergavevelden (bijv. "Joris Vries" voor een NatuurlijkPersoon) worden
 *   berekend via CEL-expressies die refereren aan onderliggende GE-groepen.
 *   bouwCelContext selecteert automatisch het actuele record per groep
 *   (opvoer gezet, geen afvoer), zodat het weergaveveld altijd de huidige
 *   formele toestand weergeeft.
 */
function berekenWeergaveveld(entity, typeMeta, typeMetaByTypenaam) {
  const afgVelden = safeArray(typeMeta?.afgeleideVelden)
    .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (afgVelden.length === 0 || !entity) return "";

  // Bouw child groups structuur zoals de index page dat verwacht
  const onderliggende = safeArray(typeMeta?.onderliggende);
  const childGroups = onderliggende.map((child) => {
    const childMeta = typeMetaByTypenaam?.[child.doeltype];
    const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
    // Hubs platslaan zodat data-velden op het item komen
    const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
    return { doeltype: child.doeltype, rolnaam: child.rolnaam, items, typeMeta: childMeta };
  });

  const ctx = bouwCelContext(childGroups, typeMetaByTypenaam);
  return afgVelden
    .map((av) => {
      if (av.afleidingsregelTaal === "cel" && av.afleidingsregel) {
        return evalueerCelExpressie(av.afleidingsregel, ctx);
      }
      return null;
    })
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" | ");
}

/**
 * RepresentatieTabel — generiek tabel-component voor een entiteit- of GE-type.
 *
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
          accessorFn: (row) => berekenWeergaveveld(row, typeMeta, typeMetaByTypenaam),
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
              const waarden = inhoudsvelden.map((v) => item[v.naam] != null ? String(item[v.naam]) : "").filter(Boolean).join(" | ");
              const label = item.rel_id ?? hub?.rel_id ?? idx + 1;
              return { label, waarden };
            }).filter((r) => r.waarden);
            if (regels.length === 0) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            // Enkelvoudig: alleen veldwaarden; meervoudig: rel_id: veldwaarden
            const tekst = regels.length === 1
              ? regels[0].waarden
              : regels.map((r) => `${r.label}: ${r.waarden}`).join("; ");
            const MAX = 60;
            return (
              <span title={tekst.length > MAX ? tekst : undefined}>
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
  }, [typeMeta, isEntiteit, typeMetaByTypenaam]);

  // Data ophalen — entiteiten via /full/ (met geneste GE's), overig via flat endpoint
  const fetchData = useCallback(async () => {
    if (!apiPath) return;
    setLoading(true);
    setError(null);
    try {
      const prefix = isEntiteit ? "full/" : "";
      const res = await fetch(`${baseUrl}/${prefix}${apiPath}?page=1&size=1000`);
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
