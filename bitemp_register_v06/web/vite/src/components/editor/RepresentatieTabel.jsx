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
import { safeArray } from "../../shared/schemaUtils";

const PAGE_SIZE = 20;

/**
 * RepresentatieTabel — generiek tabel-component dat een typeMeta ontvangt
 * en dynamisch kolommen, data, paginering, sortering en filtering biedt.
 */
export default function RepresentatieTabel({ typeMeta }) {
  const { baseUrl } = useSchema();
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const isEntiteit = typeMeta?.metatype === "entiteit";
  // API-pad: meervoud komt overeen met Go's Padnaam (URL-registratie)
  const apiPath = typeMeta?.meervoud || typeMeta?.veldnaam;

  // Velden → kolommen: skip array-velden (geneste GE's), voeg telkolommen toe voor entiteiten
  const columns = useMemo(() => {
    const velden = safeArray(typeMeta?.velden);
    // Directe (scalaire) velden
    const cols = velden
      .filter((veld) => veld.format !== "array")
      .map((veld) => ({
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
      }));

    // Entiteiten: telkolommen per onderliggend GE/relatie
    if (isEntiteit) {
      for (const child of safeArray(typeMeta?.onderliggende)) {
        const key = child.jsonRolnaam || child.rolnaam;
        if (!key) continue;
        cols.push({
          accessorKey: key,
          header: key,
          meta: { type: "count" },
          cell: ({ getValue }) => {
            const val = getValue();
            const n = Array.isArray(val) ? val.length : 0;
            return <span style={{ color: "var(--cg-donkergrijs)" }}>{n}</span>;
          },
        });
      }
    }

    return cols;
  }, [typeMeta, isEntiteit]);

  // Data ophalen — entiteiten via /full/ (met geneste GE's), overig via flat endpoint
  const fetchData = useCallback(async () => {
    if (!apiPath) return;
    setLoading(true);
    setError(null);
    try {
      const prefix = isEntiteit ? "full/" : "";
      const res = await fetch(`${baseUrl}/api/${prefix}${apiPath}?page=1&size=1000`);
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
      navigate(`/t/${typeMeta.meervoud || typeMeta.veldnaam}/${idWaarde}`);
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
