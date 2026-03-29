import { useParams } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import RepresentatieFormulier from "./RepresentatieFormulier";

/**
 * NieuwRecordFormulier — formulier voor het aanmaken van een nieuwe entiteit/representatie.
 * Gerouteerd via /t/:typePad/nieuw.
 */
export default function NieuwRecordFormulier() {
  const { typePad } = useParams();
  const { typeMetaByPadnaam } = useSchema();
  const typeMeta = typeMetaByPadnaam[typePad];

  if (!typeMeta) {
    return <div className="cg-feedback--fout">Onbekend type: {typePad}</div>;
  }

  return (
    <div>
      <h2 className="utrecht-heading-2" style={{ marginBottom: "1rem" }}>
        Nieuw: {typeMeta.klassenaam || typeMeta.typenaam}
      </h2>
      <RepresentatieFormulier typeMeta={typeMeta} />
    </div>
  );
}
