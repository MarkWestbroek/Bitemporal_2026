import { useState, useEffect, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useParams, useNavigate, Link } from "react-router";
import { useSchema } from "../context/SchemaContext";
import { useWeergaveDefinitie } from "../hooks/useWeergaveDefinitie";
import { safeArray, platSlaHubItems } from "../shared/schemaUtils";
import { evalueerCelExpressie } from "../shared/celEvaluator";

/**
 * Resolvet een veldpad (bijv. "namen.data.roepnaam" of "id") naar een waarde
 * uit een full-entity object.
 *
 * Ondersteunt drie patronen:
 *   - Direct entity-veld:       "id" → entity.id
 *   - Genest GE-veld:           "namen.data.roepnaam" → zoek in onderliggende GE "namen",
 *     neem het actuele (platgeslagen) item, en lees "roepnaam".
 *   - Meervoudig GE-veld:       "initiatief_domeinen.weergavenaam" → bij meervoudig
 *     momentvoorkomen worden ALLE actieve items verzameld en de waarden
 *     gejoined met ", ".
 *
 * Het segment ".data." in het pad wordt overgeslagen omdat platSlaHubItems de hub
 * al heeft platgeslagen naar directe veldwaarden.
 *
 * De lookup werkt op zowel jsonRolnaam (snake_case) als klassenaam (PascalCase).
 */
function resolveVeldpad(entity, veldpad, typeMeta, typeMetaByTypenaam) {
  if (!entity || !veldpad) return null;

  // 1) Directe entity-velden (bijv. "id", "opvoer")
  if (!veldpad.includes(".")) {
    return entity[veldpad] ?? null;
  }

  // 2) Genest veldpad: splits op "." en verwijder "data" segmenten
  const delen = veldpad.split(".").filter((d) => d !== "data");
  if (delen.length < 2) return entity[delen[0]] ?? null;

  const [geKey, ...restDelen] = delen;

  // Zoek het onderliggende GE op basis van jsonRolnaam, rolnaam, doeltype of klassenaam.
  // Klassenaam-matching (bijv. "Adres") is nodig voor fallback-kolommen die het pad
  // opbouwen via childMeta.klassenaam (PascalCase) i.p.v. jsonRolnaam (snake_case).
  const onderliggende = safeArray(typeMeta?.onderliggende);
  const child = onderliggende.find(
    (c) =>
      c.jsonRolnaam === geKey ||
      c.rolnaam === geKey ||
      c.doeltype === geKey ||
      typeMetaByTypenaam?.[c.doeltype]?.klassenaam === geKey
  );
  if (!child) return null;

  // Haal de items op uit de entity (via jsonRolnaam of rolnaam)
  const childMeta = typeMetaByTypenaam?.[child.doeltype];
  const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
  const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);

  // Bepaal of het meervoudig is (meerdere items per entiteit)
  const isMeervoudig = child.momentvoorkomen === "meervoudig";

  if (isMeervoudig) {
    // Verzamel waarden van ALLE actieve items en join met ", "
    const actieveItems = items.filter((item) => !item.afvoer);
    if (actieveItems.length === 0) return null;

    const waarden = actieveItems
      .map((item) => {
        let huidig = item;
        for (const deel of restDelen) {
          if (huidig == null || typeof huidig !== "object") return null;
          huidig = huidig[deel];
        }
        return huidig ?? null;
      })
      .filter((v) => v != null);

    return waarden.length > 0 ? waarden.join(", ") : null;
  }

  // Enkelvoudig: neem het eerste actieve item (zonder afvoer)
  const actiefItem = items.find((item) => !item.afvoer) || items[0] || null;
  if (!actiefItem) return null;

  // Navigeer de resterende delen
  let huidig = actiefItem;
  for (const deel of restDelen) {
    if (huidig == null || typeof huidig !== "object") return null;
    huidig = huidig[deel];
  }
  return huidig ?? null;
}

/**
 * Vervangt punten in een veldpad door dubbel-underscore, zodat TanStack Table
 * het als een eenvoudige string-sleutel kan gebruiken (geen nested-path
 * interpretatie, geen problemen in _getAllFlatColumnsById).
 */
function sanitizeKolId(veldpad) {
  return (veldpad || "").replace(/\./g, "__");
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
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  // Cache voor ref-FK weergavenamen: { "TypeNaam": { "363": "Amsterdam (0363)" } }
  const [refNaamCache, setRefNaamCache] = useState({});

  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;

  // Data ophalen: alles in één keer, zodat filter + sortering over de volledige
  // dataset werken. Client-side paginering via TanStack getPaginationRowModel.
  const fetchData = useCallback(async () => {
    if (!apiPath || !baseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${baseUrl}/full/${apiPath}?page=1&size=9999`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const key = typeMeta?.meervoud || Object.keys(json).find((k) => Array.isArray(json[k]));
      setData(safeArray(json[key] || json));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, apiPath, typeMeta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pre-fetch weergavenamen voor ref-FK velden (bijv. gemeente → "Amsterdam (0363)").
  // Bepaalt welke ref-types nodig zijn op basis van de GE-velden van dit entiteittype.
  useEffect(() => {
    if (!typeMeta || !baseUrl) return;
    const toFetch = new Set();
    for (const child of safeArray(typeMeta?.onderliggende)) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      if (!childMeta) continue;
      const dataChild = safeArray(childMeta?.onderliggende).find(
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
    ).then((entries) => setRefNaamCache(Object.fromEntries(entries)));
  }, [typeMeta, typeMetaByTypenaam, baseUrl]);


  // Elke rij krijgt naast de originele entity-velden ook voor elke kolom een
  // gesaniteerde sleutel (punten → __), zodat TanStack de waarde direct kan
  // opzoeken via een simpele accessorKey-string zonder dots.
  const resolvedData = useMemo(() => {
    if (!typeMeta || !tabelConfig?.kolommen?.length) return data;
    return data.map((entity) => {
      const row = { ...entity };
      for (const kol of tabelConfig.kolommen) {
        row[sanitizeKolId(kol.veldpad)] = resolveVeldpad(
          entity,
          kol.veldpad,
          typeMeta,
          typeMetaByTypenaam
        ) ?? null;
      }
      return row;
    });
  }, [data, tabelConfig, typeMeta, typeMetaByTypenaam]);

  // Kolommen: uit WeergaveDefinitie of fallback
  const columns = useMemo(() => {
    if (!typeMeta) return [];

    // Als er een tabelConfig is, gebruik die kolommen.
    // accessorKey leest direct uit resolvedData[sanitizeKolId(veldpad)].
    // Geen dots in de key → geen TanStack nested-path interpretatie.
    if (tabelConfig?.kolommen?.length > 0) {
      return tabelConfig.kolommen.map((kol) => {
        const key = sanitizeKolId(kol.veldpad);
        return {
          id: key,
          header: kol.label || kol.veldpad,
          accessorFn: (row) => row[key] ?? null,
          cell: ({ getValue }) => {
            const val = getValue();
            if (val == null) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            return String(val);
          },
          enableSorting: kol.sorteerbaar !== false,
          enableColumnFilter: kol.filterbaar !== false,
          filterFn: "includesString",
          size: kol.breedte ? parseInt(kol.breedte, 10) || undefined : undefined,
        };
      });
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
        const refType = veld.ref || null;
        cols.push({
          id: `${klassenaam}.${veld.naam}`,
          header: `${klassenaam} · ${veld.naam}`,
          accessorFn: (row) =>
            resolveVeldpad(row, `${klassenaam}.${veld.naam}`, typeMeta, typeMetaByTypenaam),
          cell: ({ getValue }) => {
            const val = getValue();
            if (val == null) return <span style={{ color: "var(--cg-donkergrijs)" }}>—</span>;
            if (refType) {
              const label = refNaamCache[refType]?.[String(val)];
              if (label) return label;
            }
            return String(val);
          },
        });
      }
    }

    return cols;
  }, [typeMeta, typeMetaByTypenaam, tabelConfig, refNaamCache]);

  // Initiële sortering uit tabelConfig
  const initialSorting = useMemo(() => {
    // standaardSortering kan "veldpad" of "veld" hebben (backward compat)
    const vp = tabelConfig?.standaardSortering?.veldpad || tabelConfig?.standaardSortering?.veld;
    if (!vp) return [];
    return [
      {
        // Gebruik dezelfde gesaniteerde sleutel als in de kolom-definitie
        id: sanitizeKolId(vp),
        desc: tabelConfig.standaardSortering.richting === "desc",
      },
    ];
  }, [tabelConfig]);

  useEffect(() => {
    if (initialSorting.length > 0) setSorting(initialSorting);
  }, [initialSorting]);

  // Pas paginagrootte aan als tabelConfig geladen is
  useEffect(() => {
    const ps = tabelConfig?.rijenPerPagina || 25;
    setPagination((p) => ({ ...p, pageSize: ps, pageIndex: 0 }));
  }, [tabelConfig]);

  // Reset naar pagina 1 zodra filter/sortering verandert
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [globalFilter, columnFilters, sorting]);

  const table = useReactTable({
    data: resolvedData,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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

      {/* Client-side paginering */}
      <div className="cg-pagination">
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage() || loading}
        >
          ← Vorige
        </button>
        <span style={{ fontSize: "0.875rem", color: "var(--cg-donkergrijs)" }}>
          Pagina {table.getState().pagination.pageIndex + 1} van {table.getPageCount()}
          {" "}({table.getFilteredRowModel().rows.length} van {data.length} records)
        </span>
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage() || loading}
        >
          Volgende →
        </button>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) =>
            setPagination((p) => ({ ...p, pageSize: Number(e.target.value), pageIndex: 0 }))
          }
          style={{ fontSize: "0.875rem", padding: "2px 6px" }}
          aria-label="Rijen per pagina"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} per pagina</option>
          ))}
        </select>
      </div>
    </div>
  );
}
