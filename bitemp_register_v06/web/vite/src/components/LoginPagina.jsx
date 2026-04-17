import { useState } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * LoginPagina — inlogformulier in Common Ground / Utrecht stijl.
 *
 * Props:
 * - onSucces: callback na succesvol inloggen (optioneel)
 * - titel: optionele pagina-titel
 */
export default function LoginPagina({ onSucces, titel }) {
  const { login, fout } = useAuth();
  const [gebruikersnaam, setGebruikersnaam] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [lokaalFout, setLokaalFout] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gebruikersnaam || !wachtwoord) {
      setLokaalFout("Vul gebruikersnaam en wachtwoord in.");
      return;
    }
    setLokaalFout(null);
    setBezig(true);
    try {
      const ok = await login(gebruikersnaam, wachtwoord);
      if (ok && onSucces) onSucces();
    } finally {
      setBezig(false);
    }
  };

  const foutMelding = lokaalFout || fout;

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "60vh",
      padding: "2rem",
    }}>
      <div className="cg-form-card" style={{
        maxWidth: 400,
        width: "100%",
        padding: "2rem",
      }}>
        <h2 className="utrecht-heading-2" style={{ marginTop: 0, marginBottom: "1.5rem", textAlign: "center" }}>
          {titel || "Inloggen"}
        </h2>

        {foutMelding && (
          <div className="cg-feedback--fout" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6 }}>
            {foutMelding}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="login-gebruikersnaam"
              style={{ display: "block", marginBottom: "0.375rem", fontWeight: 600 }}
            >
              Gebruikersnaam
            </label>
            <input
              id="login-gebruikersnaam"
              type="text"
              className="utrecht-textbox"
              autoComplete="username"
              autoFocus
              value={gebruikersnaam}
              onChange={(e) => setGebruikersnaam(e.target.value)}
              disabled={bezig}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="login-wachtwoord"
              style={{ display: "block", marginBottom: "0.375rem", fontWeight: 600 }}
            >
              Wachtwoord
            </label>
            <input
              id="login-wachtwoord"
              type="password"
              className="utrecht-textbox"
              autoComplete="current-password"
              value={wachtwoord}
              onChange={(e) => setWachtwoord(e.target.value)}
              disabled={bezig}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            className="utrecht-button utrecht-button--primary-action"
            disabled={bezig}
            style={{ width: "100%", padding: "0.625rem" }}
          >
            {bezig ? "Bezig met inloggen…" : "Inloggen"}
          </button>
        </form>
      </div>
    </div>
  );
}
