import { useMemo } from "react";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import { useFormulierDefinities } from "../../hooks/useFormulierDefinitie";
import { bouwCustomVeldMapping } from "./customFormMapping";
import CustomFormulierRenderer from "./CustomFormulierRenderer";

/**
 * NieuwSubFormulier — een ingebedde FormulierDefinitie voor een nieuwe doel-ENT vanuit een
 * relatieveld (`veld.nieuwFormulier`, plan 2026-09-22 §5.3, stap B). Rendert de layout van
 * de sub-FD zonder entiteit; de waarden leven in het ouderformulier als
 * `{ $nieuw: { volPad → waarde }, $formulier: <FD-id> }` en worden door
 * nieuwFormulierMapping als sub-registratie met een plaatshouder-id opgevoerd.
 *
 * Maak-diepte: `diepte` telt op; EntiteitCombobox biedt "nieuw" alleen op diepte 0 aan, dus
 * een ingebed formulier kan relaties kiezen maar niet zelf weer aanmaken (§5.3).
 *
 * Props: doelEntiteit, formulierId, values ({ volPad → waarde }), onChange(volPad, waarde),
 *        readOnly, diepte
 */
export default function NieuwSubFormulier({ doelEntiteit, formulierId, values, onChange, readOnly, diepte = 1 }) {
  const { typeMetaByTypenaam } = useSchema();
  const doelMeta = typeMetaByTypenaam?.[doelEntiteit];
  const { definities, loading, error } = useFormulierDefinities(doelEntiteit);
  const definitie = definities.find((d) => String(d.id) === String(formulierId)) || null;

  const onderliggende = useMemo(() => safeArray(doelMeta?.onderliggende).filter((child) => {
    const m = typeMetaByTypenaam?.[child.doeltype];
    return m && m.ge_subtype !== "aanvang" && m.ge_subtype !== "einde";
  }), [doelMeta, typeMetaByTypenaam]);

  const { customVelden } = useMemo(() => {
    if (!doelMeta || !definitie) return { customVelden: [] };
    return bouwCustomVeldMapping({ entity: {}, typeMeta: doelMeta, onderliggende, typeMetaByTypenaam });
  }, [doelMeta, definitie, onderliggende, typeMetaByTypenaam]);

  if (!doelMeta) return <div className="cg-feedback--fout">Onbekende doelentiteit: {doelEntiteit}</div>;
  if (loading) return <div style={{ color: "var(--cg-donkergrijs, #666)", fontSize: "0.875rem" }}>Formulier laden…</div>;
  if (error) return <div className="cg-feedback--fout">Formulierdefinitie laden mislukt: {error}</div>;
  if (!definitie) return <div className="cg-feedback--fout">Geen actieve formulierdefinitie {formulierId} voor {doelEntiteit}.</div>;

  return (
    <div style={{ border: "1px solid var(--cg-rand, #e2e8f0)", borderLeft: "3px solid var(--cg-accent, #0f766e)", borderRadius: 6, padding: "0.5rem 0.75rem", marginTop: "0.5rem" }}>
      <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.25rem" }}>
        Nieuwe {doelMeta.klassenaam || doelEntiteit} — {definitie.meta?.naam}
      </div>
      <CustomFormulierRenderer
        layout={definitie.layout}
        velden={customVelden}
        values={values || {}}
        onChange={onChange}
        readOnly={readOnly}
        typeMeta={doelMeta}
        diepte={diepte}
      />
    </div>
  );
}
