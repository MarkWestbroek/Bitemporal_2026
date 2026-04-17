import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const AuthContext = createContext(null);

/**
 * detectApiBaseUrl — bepaalt het basis-URL voor de API.
 * Tijdens lokale Vite-dev (poort 5173-5175) wijst dit naar :8082;
 * anders naar de huidige origin (API serveert zelf de frontend).
 */
function detectApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const loc = window.location;
  if (["5173", "5174", "5175"].includes(loc.port)) {
    return `${loc.protocol}//${loc.hostname}:8082`;
  }
  return loc.origin;
}

/**
 * AuthProvider — beheert authenticatiestatus via de backend auth-API.
 *
 * Biedt:
 * - authEnabled: of het auth-systeem actief is (AUTH_ENABLED=true op backend)
 * - ingelogd: of er een geldige sessie is
 * - gebruiker: { gebruikersnaam, rol, email } of null
 * - laden: of de initiële status nog wordt opgehaald
 * - fout: eventuele foutmelding
 * - login(gebruikersnaam, wachtwoord): inloggen
 * - logout(): uitloggen
 * - verversStatus(): status opnieuw ophalen
 */
export function AuthProvider({ children }) {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [ingelogd, setIngelogd] = useState(false);
  const [gebruiker, setGebruiker] = useState(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);

  const baseUrl = useMemo(() => detectApiBaseUrl(), []);

  const verversStatus = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/auth/status`, { credentials: "include" });
      if (!res.ok) {
        // Backend niet bereikbaar of auth niet beschikbaar — behandel als auth-uit
        setAuthEnabled(false);
        setIngelogd(false);
        setGebruiker(null);
        return;
      }
      const data = await res.json();
      setAuthEnabled(!!data.auth_enabled);
      setIngelogd(!!data.ingelogd);
      if (data.ingelogd) {
        setGebruiker({
          gebruikersnaam: data.gebruikersnaam,
          rol: data.rol,
          email: data.email,
        });
      } else {
        setGebruiker(null);
      }
      setFout(null);
    } catch {
      // Netwerk/CORS-fout — auth-systeem niet beschikbaar
      setAuthEnabled(false);
      setIngelogd(false);
      setGebruiker(null);
    }
  }, [baseUrl]);

  // Bij mount: haal auth-status op
  useEffect(() => {
    setLaden(true);
    verversStatus().finally(() => setLaden(false));
  }, [verversStatus]);

  const login = useCallback(async (gebruikersnaam, wachtwoord) => {
    setFout(null);
    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gebruikersnaam, wachtwoord }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFout(data.error || "Inloggen mislukt.");
        return false;
      }
      // Ververs de volledige status na succesvol inloggen
      await verversStatus();
      return true;
    } catch {
      setFout("Kan geen verbinding maken met de server.");
      return false;
    }
  }, [baseUrl, verversStatus]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignoreer netwerk-fouten bij logout
    }
    setIngelogd(false);
    setGebruiker(null);
  }, [baseUrl]);

  const value = useMemo(() => ({
    authEnabled,
    ingelogd,
    gebruiker,
    laden,
    fout,
    login,
    logout,
    verversStatus,
  }), [authEnabled, ingelogd, gebruiker, laden, fout, login, logout, verversStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — hook om de auth-context te gebruiken.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth moet binnen een <AuthProvider> gebruikt worden.");
  }
  return ctx;
}
