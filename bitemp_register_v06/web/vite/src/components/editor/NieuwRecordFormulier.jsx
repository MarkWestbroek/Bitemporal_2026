import { useParams, useSearchParams } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import { useFormulierDefinities } from "../../hooks/useFormulierDefinitie";
import RepresentatieFormulier from "./RepresentatieFormulier";
import NieuwEntiteitPagina from "./NieuwEntiteitPagina";
import NieuwFormulierPagina from "./NieuwFormulierPagina";

/**
 * NieuwRecordFormulier — formulier voor het aanmaken van een nieuwe entiteit/representatie.
 * Gerouteerd via /t/:typePad/nieuw (optioneel ?formulier=<FormulierDefinitie-id>).
 *
 * - Voor entiteiten met onderliggende GEs/relaties: NieuwEntiteitPagina
 *   (één registratie met entiteit + alle onderliggende GEs, net als IndexSchemaPage),
 *   of — als er actieve FormulierDefinities voor het doeltype zijn — een gekozen
 *   definitie in nieuw-modus (NieuwFormulierPagina).
 * - Voor GEs, relaties en entiteiten zonder onderliggende: RepresentatieFormulier.
 */
export default function NieuwRecordFormulier() {
  const { typePad } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { typeMetaByPadnaam } = useSchema();
  const typeMeta = typeMetaByPadnaam[typePad];
  const { definities } = useFormulierDefinities(typeMeta?.metatype === "entiteit" ? typeMeta?.typenaam : null);

  if (!typeMeta) {
    return <div className="cg-feedback--fout">Onbekend type: {typePad}</div>;
  }

  // Entiteiten met onderliggende GEs/relaties: gebruik de rijke opvoerpagina.
  const heeftOnderliggende = typeMeta.metatype === "entiteit" &&
    safeArray(typeMeta?.onderliggende).filter((o) => {
      // Filter materiële plumbing-types (aanvang/einde) — die zijn al via isMaterieel zichtbaar
      return !o.doeltype?.endsWith("_Aanvang") && !o.doeltype?.endsWith("_Einde");
    }).length > 0;

  const gekozenId = searchParams.get("formulier") || "";
  const gekozen = definities.find((d) => String(d.id) === gekozenId) || null;
  const kies = (id) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (id) next.set("formulier", id); else next.delete("formulier");
    return next;
  }, { replace: true });

  return (
    <div>
      <h2 className="utrecht-heading-2" style={{ marginBottom: "1rem" }}>
        Nieuwe entiteit {typeMeta.klassenaam || typeMeta.typenaam} opvoeren
      </h2>
      {heeftOnderliggende && definities.length > 0 && (
        <label className="utrecht-form-field" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <span className="utrecht-form-label">Invoer via</span>
          <select className="utrecht-select utrecht-select--html-select" value={gekozen ? String(gekozen.id) : ""} onChange={(e) => kies(e.target.value)}>
            <option value="">Standaard (alle gegevenselementen)</option>
            {definities.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.meta?.naam || `Formulier ${d.id}`}{d.isStandaard ? " (standaard)" : ""}</option>
            ))}
          </select>
        </label>
      )}
      {heeftOnderliggende
        ? (gekozen ? <NieuwFormulierPagina typeMeta={typeMeta} definitie={gekozen} /> : <NieuwEntiteitPagina typeMeta={typeMeta} />)
        : <RepresentatieFormulier typeMeta={typeMeta} />
      }
    </div>
  );
}
