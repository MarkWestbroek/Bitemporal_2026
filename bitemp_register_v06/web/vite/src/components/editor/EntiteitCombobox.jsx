import { useEffect, useMemo, useState } from "react";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import { berekenWeergaveveld } from "../../shared/celEvaluator";

const PAGINA_GROOTTE = 100;
const MAX_PAGINAS = 20;

/**
 * EntiteitCombobox — keuze van een bestaande (gewone) entiteit als secundaire id van
 * een relatie, bv. `organisatie_id` → Organisatie. Tegenhanger van RefCombobox, die
 * alleen referentielijst-items kent (server-side zoeken). Hier laden we de /full-lijst
 * (gepagineerd, zoals NieuwEntiteitPagina) en berekenen het label met het weergaveveld.
 *
 * Bewust alleen kiezen uit bestaande records: een nieuwe doel-ENT aanmaken vanuit het
 * formulier is stap B (`veld.nieuwFormulier`, plan 2026-09-22 §5.3).
 *
 * Props: doelEntiteit (typenaam), value (id), onChange(id|""), readOnly
 */
export default function EntiteitCombobox({ doelEntiteit, value, onChange, readOnly }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const doelMeta = typeMetaByTypenaam?.[doelEntiteit];
  const [opties, setOpties] = useState([]);
  const [status, setStatus] = useState("idle");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!doelMeta?.padnaam || !baseUrl) return;
    let cancelled = false;
    setStatus("laden");
    (async () => {
      const items = [];
      try {
        for (let page = 1; page <= MAX_PAGINAS; page++) {
          const res = await fetch(`${baseUrl}/full/${doelMeta.padnaam}?page=${page}&size=${PAGINA_GROOTTE}`);
          if (!res.ok) break;
          const json = await res.json();
          const pagina = Array.isArray(json) ? json : safeArray(json?.[doelMeta.padnaam] || json?.items || json?.data);
          items.push(...pagina);
          if (pagina.length < PAGINA_GROOTTE) break;
        }
      } catch {
        // stil falen: lege lijst met status "fout"
        if (!cancelled) setStatus("fout");
        return;
      }
      if (cancelled) return;
      const idKolom = doelMeta.idKolom || "id";
      const lijst = items
        .filter((it) => it && !it.afvoer)
        .map((it) => {
          const id = String(it[idKolom] ?? "");
          const label = berekenWeergaveveld(it, doelMeta, typeMetaByTypenaam) || "";
          return { id, label: label ? `${label} (${id})` : id, zoek: `${label} ${id}`.toLowerCase() };
        })
        .sort((a, b) => a.label.localeCompare(b.label, "nl"));
      setOpties(lijst);
      setStatus("klaar");
    })();
    return () => { cancelled = true; };
  }, [doelMeta, baseUrl, typeMetaByTypenaam]);

  const zichtbaar = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const basis = f ? opties.filter((o) => o.zoek.includes(f)) : opties;
    // De gekozen waarde blijft altijd zichtbaar, ook als het filter hem wegfiltert.
    if (value && !basis.some((o) => o.id === String(value))) {
      const gekozen = opties.find((o) => o.id === String(value));
      return gekozen ? [gekozen, ...basis] : basis;
    }
    return basis;
  }, [opties, filter, value]);

  if (!doelMeta) return <span style={{ color: "var(--cg-fout, red)" }}>Onbekende doelentiteit: {doelEntiteit}</span>;

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <input
        type="search"
        className="utrecht-textbox utrecht-textbox--html-input"
        style={{ flex: "1 1 10rem", minWidth: 0 }}
        placeholder={status === "laden" ? "Laden…" : `Zoek ${doelMeta.klassenaam || doelEntiteit}…`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        disabled={readOnly || status === "laden"}
        aria-label={`Zoek ${doelMeta.klassenaam || doelEntiteit}`}
      />
      <select
        className="utrecht-select utrecht-select--html-select"
        style={{ flex: "2 1 14rem", minWidth: 0 }}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
      >
        <option value="">{status === "fout" ? "(laden mislukt)" : "(kies)"}</option>
        {zichtbaar.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
