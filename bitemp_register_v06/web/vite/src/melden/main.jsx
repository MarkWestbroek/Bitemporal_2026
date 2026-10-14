/**
 * melden.html — een bug, wens of vraag melden buiten de Studio (plan docs/plans/meldingen/,
 * Mark 14-10: "wat als de Studio hangt?"). Klein: alleen inloggen, het formulier en de eigen
 * meldingen; geen kader trekken (de bijlagen gaan via plakken, slepen of kiezen).
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "../context/AuthContext";
import LoginPagina from "../components/LoginPagina";
import MeldFormulier from "../meldingen/MeldFormulier.jsx";
import MijnMeldingen from "../meldingen/MijnMeldingen.jsx";
import { browserOmschrijving } from "../meldingen/meldingApi.js";

const pagina = {
  maxWidth: 720, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
  color: "#0f172a",
};

function Melden() {
  const { authEnabled, ingelogd, laden, gebruiker } = useAuth();
  const [weergave, setWeergave] = useState("formulier");
  const [openId, setOpenId] = useState(null);
  if (laden) return <p style={pagina}>Laden…</p>;
  if (authEnabled && !ingelogd) return <LoginPagina titel="Inloggen om te melden" />;
  const versie = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  return (
    <div style={pagina}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <strong style={{ flex: 1 }}>Omnium — melden</strong>
        {gebruiker?.gebruikersnaam && <span style={{ color: "#64748b", fontSize: 13 }}>{gebruiker.gebruikersnaam}</span>}
        <button type="button" className="mld-knop" onClick={() => setWeergave(weergave === "lijst" ? "formulier" : "lijst")}>
          {weergave === "lijst" ? "Nieuwe melding" : "Mijn meldingen"}
        </button>
        <a href="studio.html" className="mld-knop" style={{ textDecoration: "none" }}>Naar de Studio</a>
      </header>
      {weergave === "lijst" ? (
        <MijnMeldingen openId={openId} onNieuw={() => setWeergave("formulier")} />
      ) : (
        <MeldFormulier
          key={weergave}
          context={{ studioversie: `studio ${versie} (melden.html)`, browser: browserOmschrijving() }}
          onMijnMeldingen={(id) => { setOpenId(id); setWeergave("lijst"); }}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Melden />
    </AuthProvider>
  </React.StrictMode>
);
