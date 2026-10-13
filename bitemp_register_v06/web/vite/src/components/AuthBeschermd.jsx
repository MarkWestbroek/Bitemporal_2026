import { useAuth } from "../context/AuthContext";
import LoginPagina from "./LoginPagina";
import { rolNiveau } from "../shared/rollen.js";

/**
 * AuthBeschermd — wrapper die een pagina alleen toont als de gebruiker
 * is ingelogd met minimaal de vereiste rol.
 *
 * Als auth niet actief is (AUTH_ENABLED=false), wordt de pagina altijd getoond.
 *
 * Props:
 * - vereistRol: een rol uit shared/rollen.js (lezer … beheerder, of de oude namen
 *   viewer/editor/admin); default "viewer"
 * - children: de beschermde pagina-content
 */

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
  const huidigNiveau = rolNiveau(gebruiker?.rol);
  const vereistNiveau = rolNiveau(vereistRol);
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
