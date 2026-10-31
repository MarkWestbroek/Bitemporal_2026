// @ts-check
/**
 * v3ImportProject — Modelleren → Bestand → "Importeer V3 in project…" (Mark, 31-10):
 * een V3-model uit een bestand of van de API als delta in de canoniek-uml-store van het
 * project. Review per regel (nieuw/gewijzigd aan, verdwenen uit), daarna toepassen met
 * behoud van ids — diagrammen, plaatsingen in mappen en verwijzingen blijven staan.
 * De logica zelf is puur: diagramprofielen/canoniek-uml/v3DeltaImport.js.
 */
import { getProfieltypen } from "../profieltypeRegistry.js";
import { vraagKeuze, vraagReview, toonMelding } from "../naamDialog.jsx";
import { apiBase } from "../../shared/apiBase.js";
import { planV3Import, bouwV3ReviewBoom, metVolgendeVerbindingen } from "../../diagramprofielen/canoniek-uml/v3DeltaImport.js";
import { pasPlanToe } from "../../diagramprofielen/ea/vergelijkImport.js";
import { bladSleutels } from "../../diagramprofielen/ea/reviewBoom.js";
/** Descriptor-id van canoniek-uml (zoals diagramprofielen/canoniek-uml/index.js). */
const CANONIEK_UML_ID = "canoniek-uml";

/** Het profiel in het project dat de canoniek-uml-descriptor draagt (activiteit "diagram05"). */
const canoniekProfiel = () => getProfieltypen().find((p) => p?.descriptor?.id === CANONIEK_UML_ID) || null;

/** Kies een .json-bestand; null = afgebroken. */
function kiesBestand() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then((tekst) => resolve({ tekst, naam: file.name }), () => resolve(null));
    };
    input.click();
  });
}

/** Bron kiezen en het V3-model ophalen. null = afgebroken. */
async function haalV3() {
  let versies = [];
  try {
    const r = await fetch(`${apiBase()}/api/schema/versies`);
    if (r.ok) versies = [...((await r.json()) || [])].sort((a, b) => b.id - a.id);
  } catch {
    // Geen API bereikbaar: alleen het bestand.
  }
  const keuze = await vraagKeuze({
    titel: "V3-model importeren in het project",
    label: "Bron — wat gewijzigd is zie je vóór er iets verandert",
    opties: [
      { waarde: "bestand", label: "Bestand (.json)…" },
      ...(versies.length ? [{ waarde: "actief", label: "API: het actieve model" }] : []),
      ...versies.map((v) => ({ waarde: String(v.id), label: `API: #${v.id} ${v.model_naam || "(naamloos)"} · v${v.model_versie || "?"}` })),
    ],
    bevestig: "Verder",
    zoekbaar: versies.length > 8,
  });
  const waarde = typeof keuze === "string" ? keuze : keuze?.waarde;
  if (!waarde) return null;
  if (waarde === "bestand") {
    const b = await kiesBestand();
    if (!b) return null;
    return { v3: JSON.parse(b.tekst), bron: b.naam };
  }
  const url = waarde === "actief" ? `${apiBase()}/api/schema/model` : `${apiBase()}/api/schema/model/${waarde}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return { v3: await r.json(), bron: waarde === "actief" ? "API (actief model)" : `API #${waarde}` };
}

export async function importeerV3InProject() {
  try {
    const gehaald = await haalV3();
    if (!gehaald) return;
    const profiel = canoniekProfiel();
    if (!profiel?.useStore) throw new Error(`profiel ${CANONIEK_UML_ID} is niet geregistreerd`);
    const st = profiel.useStore.getState();
    const { model, plan, meldingen, behoudData } = planV3Import(gehaald.v3, st);
    const naam = gehaald.v3?.model_naam || gehaald.v3?.model?.naam || gehaald.v3?.naam || "";
    const boom = bouwV3ReviewBoom(plan, model, st, naam ? `Canoniek model "${naam}"` : "Canoniek model");
    const waarschuwing = meldingen.length
      ? `\n\nLet op — naampaden moeten uniek zijn (artefacten verwijzen erop):\n• ${meldingen.join("\n• ")}`
      : "";
    if (!bladSleutels(boom).length) {
      await toonMelding({ titel: "Niets te importeren", tekst: `${gehaald.bron}: alles is gelijk aan het project.${waarschuwing}` });
      return;
    }
    const gekozen = await vraagReview({
      titel: "V3-import — wat gaat mee?",
      tekst:
        `${gehaald.bron}\nNieuw en gewijzigd staan aan; "verdwenen" (niet in de import) haal je alleen weg als je het aanvinkt. ` +
        `Diagrammen, mappen en wat alleen in de Studio bestaat blijven staan.${waarschuwing}`,
      boom,
      bevestig: "Importeer",
    });
    if (!gekozen) return;
    const aan = metVolgendeVerbindingen(plan, model, gekozen);
    const uit = pasPlanToe(profiel.useStore.getState(), model, plan, { aan, behoudData });
    const delen = [];
    if (uit.toegevoegd || uit.diagrammenToegevoegd) delen.push(`${uit.toegevoegd} elementen en ${uit.diagrammenToegevoegd} diagrammen nieuw`);
    if (uit.bijgewerkt || uit.diagrammenBijgewerkt) delen.push(`${uit.bijgewerkt + uit.diagrammenBijgewerkt} bijgewerkt`);
    if (uit.verwijderd) delen.push(`${uit.verwijderd} verwijderd`);
    await toonMelding({
      titel: "V3-model geïmporteerd",
      tekst: `${gehaald.bron}: ${delen.join(", ") || "niets"}. Ongedaan maken kan met Ctrl+Z (per stap).\nNieuwe diagrammen staan onder "Niet ingedeeld".`,
    });
  } catch (e) {
    await toonMelding({ titel: "Import mislukt", tekst: String(e?.message || e) });
  }
}
