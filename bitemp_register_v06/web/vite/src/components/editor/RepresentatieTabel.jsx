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
 * Bouwt een CEL-context op uit de geneste GE-groepen in het full-entity object.
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
 * RepresentatieTabel — generiek tabel-component dat een typeMeta ontvangt
 * en dynamisch kolommen, data, paginering, sortering en filtering biedt.
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

      // Tellerkolommen per onderliggend GE/relatie (skip materiële plumbing)
      for (const child of safeArray(typeMeta?.onderliggende)) {
        const key = child.jsonRolnaam || child.rolnaam;
        if (!key) continue;
        // Skip aanvang/einde plumbing
        const childMeta = typeMetaByTypenaam?.[child.doeltype];
        if (childMeta?.ge_subtype === "aanvang" || childMeta?.ge_subtype === "einde") continue;
        cols.push({
          accessorKey: key,
          header: childMeta?.klassenaam || key,
          meta: { type: "count" },
          cell: ({ getValue }) => {
            const val = getValue();
            const n = Array.isArray(val) ? val.length : 0;
            return <span style={{ color: "var(--cg-donkergrijs)" }}>{n}</span>;
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
