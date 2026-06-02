/**
 * useSchemaModel — kleine hook die het canoniek model ophaalt via de schema-API
 * (/api/schema/model/code) en de platte types-lijst teruggeeft.
 *
 * De hook is bewust zelfstandig zodat de ModelPicker zowel in de bitemp-app
 * (waar al een SchemaProvider bestaat) als in een toekomstige process-engine-
 * frontend gebruikt kan worden. Geef je vooraf opgehaalde `injectedTypes` mee,
 * dan slaat de hook het netwerk-call over.
 */
import { useEffect, useState } from "react";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function useSchemaModel({ baseUrl = "", injectedTypes = null } = {}) {
  const [types, setTypes] = useState(() => safeArray(injectedTypes));
  const [loading, setLoading] = useState(!injectedTypes);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Vooraf geleverde types: geen fetch nodig.
    if (injectedTypes) {
      setTypes(safeArray(injectedTypes));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${baseUrl}/api/schema/model/code`)
      .then((res) => {
        if (!res.ok) throw new Error(`Schema HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setTypes(safeArray(data?.types));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, injectedTypes]);

  return { types, loading, error };
}
