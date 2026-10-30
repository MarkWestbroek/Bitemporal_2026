/**
 * Exportstap "Inrichtingsartefacten" in het transformatiepaneel
 * (docs/TRANSFORMATIES.md §11.10): de artefacten van een e-dienst voor het
 * inrichting-register op Fundament, als zip. Vervangt de CLI
 * (scripts/maak_inrichtingsartefact.mjs) voor wie in de Studio werkt.
 *
 * Invoer:
 *   - model: het canonieke model in de bron-map (diagram05 → V3), of een
 *     gekozen V3-bestand (wint);
 *   - e-dienstmodel: een gekozen JSON-bestand (nog geen modeltaal, stap c);
 *   - referentielijsten: gekozen bestanden, anders het register, anders de
 *     eersteVulling in de e-dienst;
 *   - register-URL + token: optioneel; dan per artefact nieuw/gewijzigd/ongewijzigd.
 *
 * Registreren doet het script van FUNDAMENT met de zip; schrijven vanuit de
 * browser wacht op een token/service-account en CORS bij BACKEND.
 */
import { registreerTransformatie } from "./transformatieRegistry.js";
import { collectMapModel } from "./transformaties.js";
import { exporteerV3 } from "../../diagramprofielen/canoniek-uml/serialisatie.js";
import { getProfieltype } from "../profieltypeRegistry";
import { voerInrichtingsExportUit } from "../../transformatie/inrichtingsExport.js";
import { maakZip } from "../../transformatie/sjabloon/zip.js";

const CANONIEK = "diagram05";
export const STANDAARD_REGISTER = "https://omnium.fundament.common-ground-lab.nl";

async function sha256Hex(tekst) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function leesJson(bestand, wat) {
  try {
    return JSON.parse(bestand.tekst);
  } catch (e) {
    throw new Error(`${wat} (${bestand.naam}) is geen geldige JSON: ${e.message}`);
  }
}

/** Het canonieke model van de map als V3 (alleen wat in de map staat). */
function mapAlsV3(mapId) {
  const deel = collectMapModel(mapId)[CANONIEK];
  if (!deel || !Object.keys(deel.elements || {}).length) return null;
  const st = getProfieltype(CANONIEK)?.useStore.getState();
  return exporteerV3({ ...st, elements: deel.elements, diagrams: deel.diagrams }).v3;
}

/** GET op het register; met token als Bearer, anders met de sessiecookie. */
export function registerLezer(basis, token) {
  const wortel = String(basis || "").replace(/\/+$/, "");
  return async (pad) => {
    const res = await fetch(`${wortel}/${pad}`, {
      headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" },
      credentials: token ? "omit" : "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} op ${pad}`);
    return res.json();
  };
}

function download(naam, inhoud, type) {
  const url = URL.createObjectURL(new Blob([inhoud], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  a.click();
  URL.revokeObjectURL(url);
}

const veilig = (s) => String(s || "edienst").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

registreerTransformatie({
  id: "export-inrichtingsartefacten",
  label: "Inrichtingsartefacten (e-dienst → register op Fundament)",
  richting: "export",
  profielTypes: "*",
  toelichting:
    "Objecttype, formulier, zaaktype en dossierdelen van een e-dienst, als zip voor het inrichting-register. " +
    "Model uit deze map (canoniek) of een V3-bestand; met een register-URL zie je per artefact nieuw/gewijzigd/ongewijzigd.",
  opties: [
    { key: "edienst", label: "e-dienstmodel (JSON)", datatype: "bestand", accept: ".json", verplicht: true },
    { key: "model", label: "V3-model (leeg = canoniek model uit de map)", datatype: "bestand", accept: ".json" },
    { key: "referentielijsten", label: "referentielijsten (naam bevat de lijstnaam)", datatype: "bestanden", accept: ".json" },
    // BPMN-artefacten (§11.11) komen uit een BPMN-model; het artefact noemt het bestand in bron.model.
    { key: "bpmn", label: "BPMN-modellen (bestandsnaam = bron.model)", datatype: "bestanden", accept: ".json" },
    { key: "peiltijdstip", label: "peiltijdstip (leeg = nu)", datatype: "string" },
    { key: "vergelijk", label: "vergelijk met het inrichting-register", datatype: "boolean", default: false },
    { key: "register", label: "register-URL", datatype: "string", default: STANDAARD_REGISTER },
    { key: "token", label: "token (leeg = sessie)", datatype: "wachtwoord" },
  ],
  run: async ({ bronMap, opties = {} }) => {
    if (!opties.edienst) throw new Error("Kies een e-dienstmodel (JSON).");
    const edienst = leesJson(opties.edienst, "Het e-dienstmodel");
    const modelBestand = opties.model ? leesJson(opties.model, "Het V3-model") : mapAlsV3(bronMap);
    if (!modelBestand) throw new Error("Geen canoniek model in deze map; kies een V3-bestand.");
    const referentieBestanden = (opties.referentielijsten || []).map((b) => ({ naam: b.naam, inhoud: leesJson(b, "Referentielijst") }));
    const bpmnModellen = Object.fromEntries((opties.bpmn || []).map((b) => [b.naam, leesJson(b, "BPMN-model")]));
    const peiltijdstip = String(opties.peiltijdstip || "").trim() || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const haalJson = opties.vergelijk ? registerLezer(opties.register || STANDAARD_REGISTER, String(opties.token || "").trim()) : null;
    const { datatypes } = (await import("../../transformatie/gegevenstypen.snapshot.json")).default;

    const uit = await voerInrichtingsExportUit({ edienst, modelBestand, datatypen: datatypes, referentieBestanden, bpmnModellen, peiltijdstip, haalJson, sha256Hex });
    if (!opties.model) {
      // Bekend (30-10): de omzetting V3 ↔ canoniek profiel (store/adapters.js) kent de
      // nieuwere veldsleutels verplicht/uniek/type niet; required en codes vallen dan weg.
      uit.diagnostics.unshift({
        severity: "warning",
        code: "INR-MODEL-UIT-MAP",
        message: "Model uit de map: verplicht, uniek en type van velden gaan bij de omzetting naar V3 nog verloren (BACKLOG). Kies voorlopig het V3-bestand voor wat je registreert.",
        sourceId: null,
        path: null,
      });
    }
    const e = edienst.edienst || {};
    download(`inrichting-${veilig(e.naam)}-${e.versienummer || "0"}.zip`, maakZip(uit.bestanden), "application/zip");

    return {
      status: uit.diagnostics.some((d) => d.severity === "error" || d.severity === "warning") ? "warning" : "success",
      summary: uit.summary,
      diagnostics: uit.diagnostics,
      rapport: {
        kolommen: ["soort", "identifier", "payloadHash", "register"],
        rijen: uit.rijen.map((r) => [
          r.soort,
          r.identifier,
          r.artefact ? `${r.artefact.artefactInhoud.payloadHash.slice(0, 12)}…` : "—",
          r.fout ? "fout" : r.status || (uit.registerGelezen ? "—" : "niet vergeleken"),
        ]),
      },
    };
  },
});
