import { useParams } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import RepresentatieFormulier from "./RepresentatieFormulier";
import NieuwEntiteitPagina from "./NieuwEntiteitPagina";

/**
 * NieuwRecordFormulier — formulier voor het aanmaken van een nieuwe entiteit/representatie.
 * Gerouteerd via /t/:typePad/nieuw.
 *
 * - Voor entiteiten met onderliggende GEs/relaties: NieuwEntiteitPagina
 *   (één registratie met entiteit + alle onderliggende GEs, net als IndexSchemaPage).
 * - Voor GEs, relaties en entiteiten zonder onderliggende: RepresentatieFormulier.
 */
export default function NieuwRecordFormulier() {
  const { typePad } = useParams();
  const { typeMetaByPadnaam } = useSchema();
  const typeMeta = typeMetaByPadnaam[typePad];

  if (!typeMeta) {
    return <div className="cg-feedback--fout">Onbekend type: {typePad}</div>;
  }

  // Entiteiten met onderliggende GEs/relaties: gebruik de rijke opvoerpagina.
  const heeftOnderliggende = typeMeta.metatype === "entiteit" &&
    safeArray(typeMeta?.onderliggende).filter((o) => {
      // Filter materiële plumbing-types (aanvang/einde) — die zijn al via isMaterieel zichtbaar
      return !o.doeltype?.endsWith("_Aanvang") && !o.doeltype?.endsWith("_Einde");
    }).length > 0;

  return (
    <div>
      <h2 className="utrecht-heading-2" style={{ marginBottom: "1rem" }}>
        Nieuwe entiteit {typeMeta.klassenaam || typeMeta.typenaam} opvoeren
      </h2>
      {heeftOnderliggende
        ? <NieuwEntiteitPagina typeMeta={typeMeta} />
        : <RepresentatieFormulier typeMeta={typeMeta} />
      }
    </div>
  );
}
