import { safeArray } from "../../shared/schemaUtils";

export default function SchemaIndexHeader({ schemaError, vizSchema }) {
  return (
    <>
      <h1 className="page-title">Visualisatie tijdreizen (formele tijd)</h1>
      <p style={{ margin: "0 0 8px" }}>
        <a className="muted" href="/viz/react/tijdlijn.html">Open schema-tijdslijnvisualisatie</a>
        {" | "}
        <a className="muted" href="/viz/react/registraties.html">Open registraties replay</a>
      </p>
      <p className="muted">
        Kies registratie-id of peilmoment, en volg desgewenst een specifieke entiteit.
        Tip: gebruik de pijltjestoetsen voor navigatie (links/rechts = registratie-id, omhoog/omlaag = peilmoment t).
      </p>
      <p className="muted" style={{ marginTop: 0 }}>
        {schemaError
          ? `Schema niet geladen: ${schemaError}`
          : `Schema: ${vizSchema?.versie || "-"} | types: ${safeArray(vizSchema?.types).length}`}
      </p>
    </>
  );
}
