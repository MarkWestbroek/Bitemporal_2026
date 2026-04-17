import { useAuth } from "../context/AuthContext";
import LoginPagina from "./LoginPagina";

/**
 * AuthBeschermd — wrapper die een pagina alleen toont als de gebruiker
 * is ingelogd met minimaal de vereiste rol.
 *
 * Als auth niet actief is (AUTH_ENABLED=false), wordt de pagina altijd getoond.
 *
 * Props:
 * - vereistRol: "viewer" | "editor" | "admin" (default: "viewer")
 * - children: de beschermde pagina-content
 */
const rolNiveaus = { viewer: 1, editor: 2, admin: 3 };

export default function AuthBeschermd({ vereistRol = "viewer", children }) {
  const { authEnabled, ingelogd, gebruiker, laden } = useAuth();

  // Auth niet actief → alles open
  if (!authEnabled) return children;

  // Nog aan het laden → toon laadindicator
  if (laden) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
        <span style={{ color: "#64748b", fontSize: "0.95rem" }}>Authenticatie controleren…</span>
      </div>
    );
  }

  // Niet ingelogd → toon loginformulier
  if (!ingelogd) {
    return <LoginPagina titel="Inloggen vereist" />;
  }

  // Rolcheck
  const huidigNiveau = rolNiveaus[gebruiker?.rol] || 0;
  const vereistNiveau = rolNiveaus[vereistRol] || 0;
  if (huidigNiveau < vereistNiveau) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "40vh",
        padding: "2rem",
      }}>
        <div className="cg-form-card" style={{ maxWidth: 480, padding: "2rem", textAlign: "center" }}>
          <h2 className="utrecht-heading-2" style={{ marginTop: 0, color: "#991b1b" }}>
            Onvoldoende rechten
          </h2>
          <p style={{ color: "#475569" }}>
            Deze pagina vereist de rol <strong>{vereistRol}</strong>.
            {" "}Je huidige rol is <strong>{gebruiker?.rol}</strong>.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
            Neem contact op met een beheerder als je toegang nodig hebt.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
