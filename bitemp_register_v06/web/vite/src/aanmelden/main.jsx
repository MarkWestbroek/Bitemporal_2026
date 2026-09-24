import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { SchemaProvider, useSchema } from "../context/SchemaContext";
import { useFormulierDefinities } from "../hooks/useFormulierDefinitie";
import NieuwFormulierPagina from "../components/editor/NieuwFormulierPagina";
import { isEmbedModus } from "../publicatie/embed";

// Stijlen: dezelfde als de publicatiepagina, incl. de embed-stijl voor commonground.nl.
import "@utrecht/component-library-css";
import "@utrecht/design-tokens/dist/index.css";
import "../styles/common-ground-theme.css";
import "../publicatie/embed.css"; // alleen actief onder .cg-embed

/**
 * Aanmelden — standalone pagina met alleen een FormulierDefinitie in nieuw-modus
 * (aanmeldformulier stap C). Geen navigatie, geen login: de inzending gaat naar
 * `POST /aanmelding/:formulierId`, dat alleen openstaat voor formulieren in
 * OPENBARE_FORMULIEREN en zelf de vaste waarden afdwingt.
 *
 * URL: aanmelden.html?formulier=<FD-id>[&embed=1]   (querystring vóór een eventuele hash)
 * In een iframe (of met ?embed=1) verdwijnt de kop; zie publicatie/embed.js.
 */

function detectBaseUrl() {
  if (typeof window === "undefined") return "";
  const loc = window.location;
  if (["5173", "5174", "5175"].includes(loc.port)) return `${loc.protocol}//${loc.hostname}:8082`;
  return loc.origin;
}

function formulierIdUitUrl() {
  const p = new URLSearchParams(window.location.search).get("formulier");
  return p ? String(p) : "";
}

function Bedankt({ resultaat, naam, opnieuw }) {
  return (
    <div className="cg-form-card" style={{ maxWidth: 720 }}>
      <h2 className="utrecht-heading-2" style={{ marginTop: 0 }}>Bedankt voor je aanmelding</h2>
      <p>
        Je aanmelding via <strong>{naam}</strong> is ontvangen
        {resultaat?.entiteitId ? <> en geregistreerd onder nummer <strong>{resultaat.entiteitId}</strong></> : null}.
        Ze wordt eerst beoordeeld en is daarna zichtbaar in het portfolio.
      </p>
      <button type="button" className="utrecht-button utrecht-button--secondary-action" onClick={opnieuw}>
        Nog een aanmelding doen
      </button>
    </div>
  );
}

function AanmeldPagina() {
  const { typeMetaByTypenaam, loading, error } = useSchema();
  const formulierId = formulierIdUitUrl();
  const { definities, loading: fdLoading, error: fdError } = useFormulierDefinities("*");
  const [resultaat, setResultaat] = useState(null);
  const [ronde, setRonde] = useState(0);
  const isEmbed = isEmbedModus();

  if (loading || fdLoading) return <div style={{ padding: "1.5rem" }}>Formulier laden…</div>;
  if (error) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>Schema laden mislukt: {error}</div>;
  if (fdError) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>Formulier laden mislukt: {fdError}</div>;
  if (!formulierId) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>Geen formulier opgegeven (<code>?formulier=&lt;id&gt;</code>).</div>;

  const definitie = definities.find((d) => String(d.id) === formulierId) || null;
  if (!definitie) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>Formulier {formulierId} bestaat niet of is niet actief.</div>;
  const typeMeta = typeMetaByTypenaam?.[definitie.meta?.doeltype];
  if (!typeMeta) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>Onbekend doeltype: {definitie.meta?.doeltype}</div>;

  return (
    <div className={isEmbed ? "common-ground-theme cg-embed" : "common-ground-theme"} style={{ padding: isEmbed ? 0 : "1.5rem", maxWidth: 960, margin: "0 auto" }}>
      {!isEmbed && (
        <header style={{ marginBottom: "1rem" }}>
          <h1 className="utrecht-heading-1" style={{ margin: 0 }}>{definitie.meta?.naam || "Aanmelden"}</h1>
          {definitie.meta?.beschrijving && <p style={{ color: "var(--cg-donkergrijs, #666)" }}>{definitie.meta.beschrijving}</p>}
        </header>
      )}
      {resultaat ? (
        <Bedankt resultaat={resultaat} naam={definitie.meta?.naam} opnieuw={() => { setResultaat(null); setRonde((r) => r + 1); }} />
      ) : (
        <NieuwFormulierPagina
          key={ronde}
          typeMeta={typeMeta}
          definitie={definitie}
          openbaar
          onSuccess={(r) => { setResultaat(r); window.scrollTo?.(0, 0); }}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SchemaProvider baseUrl={detectBaseUrl()}>
      <HashRouter>
        <AanmeldPagina />
      </HashRouter>
    </SchemaProvider>
  </React.StrictMode>
);
