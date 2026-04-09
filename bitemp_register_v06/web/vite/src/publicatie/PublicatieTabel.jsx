import { useState, useEffect, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useParams, useNavigate, Link } from "react-router";
import { useSchema } from "../context/SchemaContext";
import { useWeergaveDefinitie } from "../hooks/useWeergaveDefinitie";
import { safeArray, platSlaHubItems } from "../shared/schemaUtils";
import { bouwCelContext } from "../shared/celEvaluator";

/**
 * Resolvet een veldpad (bijv. "Naam.roepnaam") naar een waarde uit een full-entity object.
 *
 * Bouwt een CEL-context op uit de onderliggende GE's van de entiteit, zodat
 * veldpaden als "Naam.roepnaam" of "Bereikbaarheid.emailadres" een waarde opleveren.
 */
function resolveVeldpad(entity, veldpad, typeMeta, typeMetaByTypenaam) {
  if (!entity || !veldpad) return null;

  // Bouw CEL-context: { Naam: { roepnaam: "Jan", ... }, Bereikbaarheid: { ... } }
  const onderliggende = safeArray(typeMeta?.onderliggende);
  const childGroups = onderliggende.map((child) => {
    const childMeta = typeMetaByTypenaam?.[child.doeltype];
    const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
    const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
    return { doeltype: child.doeltype, rolnaam: child.rolnaam, items };
  });
  const ctx = bouwCelContext(childGroups, typeMetaByTypenaam);

  // Navigeer het pad: "Naam.roepnaam" → ctx["Naam"]["roepnaam"]
  const delen = veldpad.split(".");
  let huidig = ctx;
  for (const deel of delen) {
    if (huidig == null || typeof huidig !== "object") return null;
    huidig = huidig[deel];
  }
  return huidig ?? null;
}

/**
 * PublicatieTabel — configureerbare tabelweergave voor publicatie.
 *
 * Kolommen worden bepaald door de WeergaveDefinitie TabelConfig.
 * Als er geen WeergaveDefinitie is, wordt een fallback getoond met ID + alle GE-velden.
 */
export default function PublicatieTabel() {
  const { typePad } = useParams();
  const navigate = useNavigate();
  const { baseUrl, allTypes: types, typeMetaByTypenaam } = useSchema();

  // Zoek de typeMeta voor het gegeven pad
  const typeMeta = useMemo(() => {
    return (types || []).find(
      (t) => (t.padnaam || t.meervoud || t.veldnaam) === typePad && t.metatype === "entiteit"
    );
  }, [types, typePad]);

  const { tabelConfig, detailTemplate, loading: wdLoading, error: wdError } =
    useWeergaveDefinitie(typeMeta?.typenaam);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [serverPage, setServerPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;
  const serverPageSize = tabelConfig?.rijenPerPagina || 50;

  // Data ophalen: server-side paginering
  const fetchData = useCallback(async () => {
    if (!apiPath || !baseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${baseUrl}/full/${apiPath}?page=${serverPage}&size=${serverPageSize}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const key = typeMeta?.meervoud || Object.keys(json).find((k) => Array.isArray(json[k]));
      setData(safeArray(json[key] || json));
      setTotalCount(json.total_count ?? 0);
      setHasMore(json.has_more ?? false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, apiPath, typeMeta, serverPage, serverPageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Kolommen: uit WeergaveDefinitie of fallback
  const columns = useMemo(() => {
    if (!typeMeta) return [];

    // Als er een tabelConfig is, gebruik die kolommen
    if (tabelConfig?.kolommen?.length > 0) {
      return tabelConfig.kolommen.map((kol) => ({
        id: kol.veldpad,
        header: kol.label || kol.veldpad,
        accessorFn: (row) => resolveVeldpad(row, kol.veldpad, typeMeta, typeMetaByTypenaam),
        cell: ({ getValue }) => {
          const val = getValue();
          if (val == null) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
          return String(val);
        },
        enableSorting: kol.sorteerbaar !== false,
        enableColumnFilter: kol.filterbaar !== false,
        size: kol.breedte ? parseInt(kol.breedte, 10) || undefined : undefined,
      }));
    }

    // Fallback: ID + klassenaam per onderliggend GE
    const cols = [];
    const idKolom = typeMeta.idKolom || "id";
    cols.push({
      accessorKey: idKolom,
      header: idKolom,
      cell: ({ getValue }) => String(getValue() ?? "—"),
    });

    for (const child of safeArray(typeMeta?.onderliggende)) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      if (childMeta?.ge_subtype === "aanvang" || childMeta?.ge_subtype === "einde") continue;

      const dataChild = safeArray(childMeta?.onderliggende).find((c) => {
        const cm = typeMetaByTypenaam?.[c.doeltype];
        return cm?.ge_subtype === "data";
      });
      const veldenBron = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : childMeta;
      const overTeSlaan = new Set(["id", "rel_id", "opvoer", "afvoer", "versie"]);
      if (childMeta?.idKolom) overTeSlaan.add(String(childMeta.idKolom).toLowerCase());
      if (childMeta?.entiteitIDKolom) overTeSlaan.add(String(childMeta.entiteitIDKolom).toLowerCase());

      const inhoudsvelden = safeArray(veldenBron?.velden).filter((v) => {
        const n = String(v.naam || "").toLowerCase();
        return !overTeSlaan.has(n) && !v.autoIncrement;
      });

      for (const veld of inhoudsvelden.slice(0, 3)) {
        const klassenaam = childMeta?.klassenaam || child.doeltype;
        cols.push({
          id: `${klassenaam}.${veld.naam}`,
          header: `${klassenaam} · ${veld.naam}`,
          accessorFn: (row) =>
            resolveVeldpad(row, `${klassenaam}.${veld.naam}`, typeMeta, typeMetaByTypenaam),
          cell: ({ getValue }) => {
            const val = getValue();
            if (val == null) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            return String(val);
          },
        });
      }
    }

    return cols;
  }, [typeMeta, typeMetaByTypenaam, tabelConfig]);

  // Initiële sortering uit tabelConfig
  const initialSorting = useMemo(() => {
    if (!tabelConfig?.standaardSortering?.veldpad) return [];
    return [
      {
        id: tabelConfig.standaardSortering.veldpad,
        desc: tabelConfig.standaardSortering.richting === "desc",
      },
    ];
  }, [tabelConfig]);

  useEffect(() => {
    if (initialSorting.length > 0) setSorting(initialSorting);
  }, [initialSorting]);

  const pageSize = tabelConfig?.rijenPerPagina || 25;

  const totalServerPages = Math.max(1, Math.ceil(totalCount / serverPageSize));

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  function handleRijKlik(row) {
    const idKolom = typeMeta?.idKolom || "id";
    const idWaarde = row.original[idKolom];
    if (idWaarde != null) {
      navigate(`/t/${typePad}/${idWaarde}`);
    }
  }

  if (!typeMeta) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Type &ldquo;{typePad}&rdquo; niet gevonden.</p>
        <Link to="/">← Terug</Link>
      </div>
    );
  }

  if (error || wdError) {
    return <div className="cg-feedback--fout">Fout: {error || wdError}</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <Link to="/" style={{ color: "var(--cg-blauw)", textDecoration: "none" }}>
          ← Terug
        </Link>
        <h2 className="utrecht-heading-2" style={{ margin: 0 }}>
          {typeMeta.klassenaam || typeMeta.typenaam}
        </h2>
      </div>

      {/* Zoekbalk */}
      <div style={{ marginBottom: "0.75rem" }}>
        <input
          type="search"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Zoeken in alle kolommen…"
          className="utrecht-textbox"
          style={{ maxWidth: 400, width: "100%" }}
        />
      </div>

      {(loading || wdLoading) && (
        <div style={{ padding: "0.5rem 0", color: "var(--cg-donkergrijs)" }}>Laden…</div>
      )}

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
                      width: header.column.getSize() !== 150 ? header.column.getSize() : undefined,
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && (
                      <span className="cg-sort-indicator">▲</span>
                    )}
                    {header.column.getIsSorted() === "desc" && (
                      <span className="cg-sort-indicator">▼</span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
            {/* Filter rij per kolom */}
            <tr>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={`filter-${header.id}`}
                  style={{ padding: "4px 6px", background: "var(--cg-lichtgrijs)" }}
                >
                  {header.column.getCanFilter() ? (
                    <input
                      type="text"
                      value={header.column.getFilterValue() ?? ""}
                      onChange={(e) =>
                        header.column.setFilterValue(e.target.value || undefined)
                      }
                      placeholder="Filter…"
                      style={{ width: "100%", fontSize: "0.8125rem", padding: "2px 4px" }}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    textAlign: "center",
                    padding: "1rem",
                    color: "var(--cg-donkergrijs)",
                  }}
                >
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRijKlik(row);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="utrecht-table__cell"
                    style={{ padding: "0.5rem 0.75rem" }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Server-side paginering */}
      <div className="cg-pagination">
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => setServerPage((p) => Math.max(1, p - 1))}
          disabled={serverPage <= 1 || loading}
        >
          ← Vorige
        </button>
        <span style={{ fontSize: "0.875rem", color: "var(--cg-donkergrijs)" }}>
          Pagina {serverPage} van {totalServerPages}
          {" "}({totalCount} records totaal, {table.getFilteredRowModel().rows.length} op deze pagina)
        </span>
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => setServerPage((p) => p + 1)}
          disabled={!hasMore || loading}
        >
          Volgende →
        </button>
      </div>
    </div>
  );
}
