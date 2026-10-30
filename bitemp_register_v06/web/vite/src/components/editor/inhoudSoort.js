// @ts-check
/**
 * inhoudSoort — herkent wat er in een lange tekstwaarde staat, zodat de Inhoud
 * Editor hem leesbaar kan tonen (InhoudWeergave): JSON als gekleurde boom,
 * BPMN-XML als diagram. Puur en node-testbaar.
 *
 * Voorbeeld: de payload van een inrichtingsartefact (ArtefactInhoud.payload)
 * is een objecttype-JSON of een uitvoerbare BPMN.
 */

/**
 * @param {unknown} waarde
 * @returns {{ soort: "json", data: any } | { soort: "bpmn" | "xml", tekst: string } | null}
 */
export function herkenInhoud(waarde) {
  if (waarde != null && typeof waarde === "object") return { soort: "json", data: waarde };
  if (typeof waarde !== "string") return null;
  const tekst = waarde.trim();
  if (!tekst) return null;
  const eerste = tekst[0];
  if (eerste === "{" || eerste === "[") {
    try {
      return { soort: "json", data: JSON.parse(tekst) };
    } catch {
      return null;
    }
  }
  if (eerste === "<") {
    // BPMN 2.0: het definitions-element in de BPMN-model-namespace, met of zonder prefix.
    if (/<([\w-]+:)?definitions[\s>]/.test(tekst) && tekst.includes("http://www.omg.org/spec/BPMN/20100524/MODEL")) {
      return { soort: "bpmn", tekst };
    }
    return { soort: "xml", tekst };
  }
  return null;
}

/** Korte omschrijving voor in een tabelcel: "JSON-object · 12 sleutels · 4,2 kB". */
export function inhoudSamenvatting(waarde, herkend = herkenInhoud(waarde)) {
  if (!herkend) return null;
  const bytes = typeof waarde === "string" ? new TextEncoder().encode(waarde).length : JSON.stringify(waarde).length;
  const grootte = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} kB`;
  if (herkend.soort === "json") {
    const d = herkend.data;
    const vorm = Array.isArray(d) ? `JSON-lijst · ${d.length} items` : d && typeof d === "object" ? `JSON-object · ${Object.keys(d).length} sleutels` : "JSON";
    return `${vorm} · ${grootte}`;
  }
  if (herkend.soort === "bpmn") {
    const processen = (herkend.tekst.match(/<([\w-]+:)?process[\s>]/g) || []).length;
    return `BPMN · ${processen} ${processen === 1 ? "proces" : "processen"} · ${grootte}`;
  }
  return `XML · ${grootte}`;
}
