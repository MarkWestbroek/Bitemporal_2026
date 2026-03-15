export default function SchemaTijdlijnHeader({ schemaError, schema, entityTypes }) {
  return (
    <>
      <h1 className="page-title">Visualisatie tijdreizen (formele tijd) - schema-tijdslijn</h1>
      <p className="muted"><a className="muted" href="/viz/tijdlijn_oud.html">Open oude tijdslijn</a> | <a className="muted" href="/viz/react/">Open schema-index</a></p>
      <p className="muted">
        {schemaError
          ? `Schema niet geladen: ${schemaError}`
          : `Schema: ${schema?.versie || "-"} | entiteittypen: ${entityTypes.length}`}
      </p>
    </>
  );
}
