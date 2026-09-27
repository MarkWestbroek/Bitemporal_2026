import { useState, useEffect } from "react";
import { useSchema } from "../context/SchemaContext";
import { safeArray } from "../shared/schemaUtils";
import { naarLijstDefinities, gekozenLijst } from "../shared/lijstDefinities";

export { gekozenLijst };

/**
 * useLijstDefinities — de actieve LijstDefinities voor een doeltype (de lijstkant van wat een
 * FormulierDefinitie voor het detail is). Een LijstDefinitie bepaalt de kolommen van het
 * inhoud-overzicht (zelfde formaat als de tabelconfig van een WeergaveDefinitie) en met welk
 * formulier een rij opent.
 *
 * @returns {{ definities: Array<{ id, code, meta, config, formulier, formulierKiesbaar, isStandaard }>, loading, error }}
 */
export function useLijstDefinities(doeltype) {
  const { baseUrl } = useSchema();
  const [definities, setDefinities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doeltype || !baseUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${baseUrl}/full/lijst_definities?size=1000`) // standaard is een pagina van 20
      .then((res) => {
        // Een API zonder LijstDefinitie (ouder model) = geen lijsten, geen fout.
        if (res.status === 404) return {};
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((lijst) => {
        if (cancelled) return;
        setDefinities(naarLijstDefinities(safeArray(lijst?.["lijst definities"]), doeltype));
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [doeltype, baseUrl]);

  return { definities, loading, error };
}
