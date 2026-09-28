/**
 * useUitleggen — de actieve uitleg (entiteit Uitleg) als index op code, één keer per
 * pagina opgehaald en gedeeld door alle (i)-rondjes. Zie shared/uitleg.js.
 * Alleen ophalen als er iets naar de lijst verwijst (`nodig`), zodat formulieren zonder
 * uitleg geen extra verzoek doen. Een fout (bv. een oudere backend zonder Uitleg) = lege index.
 */
import { useEffect, useState } from "react";
import { indexeerUitleggen } from "../shared/uitleg.js";

const cache = new Map(); // baseUrl → Promise<index>

export function haalUitleggen(baseUrl = "") {
  if (!cache.has(baseUrl)) {
    cache.set(baseUrl, fetch(`${baseUrl}/full/uitleggen?size=1000`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => indexeerUitleggen(d?.uitleggen || (d && Object.values(d).find(Array.isArray)) || []))
      .catch(() => ({})));
  }
  return cache.get(baseUrl);
}

export default function useUitleggen(baseUrl, nodig) {
  const [index, setIndex] = useState({});
  useEffect(() => {
    if (!nodig) return undefined;
    let weg = false;
    haalUitleggen(baseUrl).then((i) => { if (!weg) setIndex(i); });
    return () => { weg = true; };
  }, [baseUrl, nodig]);
  return index;
}
