import { useAuth } from "../context/AuthContext";

/**
 * GebruikerBadge — toont ingelogde gebruiker + rol + uitlogknop.
 * Ontworpen voor gebruik in de cg-editor-nav header bars.
 *
 * Toont niets als auth niet actief is of gebruiker niet ingelogd.
 */
export default function GebruikerBadge() {
  const { authEnabled, ingelogd, gebruiker, logout } = useAuth();

  if (!authEnabled || !ingelogd || !gebruiker) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      marginLeft: "auto",
      fontSize: "0.875rem",
      color: "inherit",
    }}>
      <span style={{ opacity: 0.9 }}>
        {gebruiker.gebruikersnaam}
      </span>
      <span style={{
        background: "rgba(255,255,255,0.2)",
        padding: "0.125rem 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        {gebruiker.rol}
      </span>
      <button
        type="button"
        onClick={logout}
        style={{
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "inherit",
          padding: "0.25rem 0.625rem",
          borderRadius: "0.25rem",
          cursor: "pointer",
          fontSize: "0.8125rem",
        }}
        title="Uitloggen"
      >
        Uitloggen
      </button>
    </div>
  );
}
