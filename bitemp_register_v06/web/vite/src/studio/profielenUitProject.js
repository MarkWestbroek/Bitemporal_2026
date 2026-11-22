// @ts-check
/**
 * profielenUitProject — de profielen (M2) uit het sidecar-project in de draaiende tool laden
 * (PROF-1 stap d, eerste deel; volgorde akkoord Mark 19-11).
 *
 * Het sidecar-project draagt elk profiel volledig: gegevens in de M3-taal, code op id
 * (codeRegister.js); de rondreis is exact. Dit bestand doet de laatste stap: van de diagrammen in
 * de M3-taal weer profielen maken en die **in de tool** zetten.
 *
 * - Een profiel dat de tool al kent, wordt **op zijn plek** vervangen: het geregistreerde
 *   descriptor-object krijgt de nieuwe inhoud. De activiteiten houden dat object vast, dus zij
 *   tekenen voortaan met het profiel uit het project (bij hun volgende render).
 * - Een profiel dat de tool niet kent, komt terug als kern; de Studio registreert het als eigen
 *   profiel (een activiteit erbij, zoals *Activeer profiel*).
 * - Een profiel dat niet te bouwen of niet geldig is, wordt niet geladen en komt terug als fout.
 *   Een code-id die deze tool niet kent, is zo'n fout.
 *
 * Nog een opt-in (een menu-actie in Profiel (M3)): de tool start nog met de profielen uit de code.
 *
 * Puur genoeg voor Node; de Studio-kant staat in m3ProfielActivity.jsx.
 */
import { bouwProfielUitOntwerp, slug, PROFIEL_ONTWERP_ID } from "./activities/profielOntwerp.js";
import { vertaalHooks } from "./activities/profielGereedschap.js";
import { getDiagramType, valideerDiagramType, vervangDiagramType } from "../diagramcore/types/typeRegistry.js";
import { kopieVoorNormalisatie } from "../diagramcore/types/erfenis.js";

/**
 * De kernen van alle diagrammen in de M3-taal.
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} inhoud - de profielinhoud (`profielen.m3Profiel05`, of de store)
 * @returns {{diagramId: string, naam: string, kern: any|null, fout: string|null}[]}
 */
export function kernenUitProject(inhoud) {
  const uit = [];
  for (const diagram of Object.values(inhoud?.diagrams || {})) {
    if (diagram.diagramType && diagram.diagramType !== PROFIEL_ONTWERP_ID) continue;
    // Een leeg diagram is (nog) geen profiel: overslaan in plaats van als fout melden.
    if (!(diagram.nodes || []).length) continue;
    const op = new Set((diagram.nodes || []).map((n) => n.elementId));
    const elements = Object.fromEntries(Object.entries(inhoud.elements || {}).filter(([id, el]) => op.has(id) || (op.has(el.source) && op.has(el.target))));
    const id = diagram.m3Profiel?.["m3:id"] || slug(diagram.naam);
    try {
      const kern = bouwProfielUitOntwerp({ elements, shapeSets: diagram.shapeSets, typeWeergave: diagram.typeWeergave, m3Profiel: diagram.m3Profiel }, { id, label: diagram.naam });
      uit.push({ diagramId: diagram.id, naam: diagram.naam, kern, fout: null });
    } catch (fout) {
      uit.push({ diagramId: diagram.id, naam: diagram.naam, kern: null, fout: String(fout?.message || fout) });
    }
  }
  return uit;
}

/**
 * Laad de kernen in de tool.
 * @param {{naam: string, kern: any|null, fout: string|null}[]} kernen
 * @returns {{vervangen: string[], nieuw: any[], fouten: string[]}} `nieuw`: kernen van profielen die de tool niet kent
 */
export function laadKernen(kernen) {
  const vervangen = [];
  const nieuw = [];
  const fouten = [];
  for (const { naam, kern, fout } of kernen) {
    if (!kern) {
      fouten.push(`${naam}: ${fout}`);
      continue;
    }
    // De M3-taal en het profiel Transformatie zijn de talen van het project zelf: niet vervangen.
    if (kern.id === PROFIEL_ONTWERP_ID || kern.id === "transformatie") continue;
    let descriptor;
    try {
      descriptor = kopieVoorNormalisatie(vertaalHooks(kern));
    } catch (e) {
      fouten.push(`${naam}: ${e?.message || e}`);
      continue;
    }
    const geldig = valideerDiagramType(descriptor);
    if (geldig.length) {
      fouten.push(`${naam}: ${geldig.join("; ")}`);
      continue;
    }
    const oud = getDiagramType(kern.id);
    if (!oud) {
      nieuw.push(kern);
      continue;
    }
    // Op zijn plek: de activiteiten houden dit object vast. Ook de verborgen vlaggen van de vorige
    // registratie (`_superprofielToegevoegd` is niet-opsombaar) moeten weg, anders vult de
    // registratie het superprofiel niet opnieuw aan.
    for (const k of Object.getOwnPropertyNames(oud)) delete oud[k];
    Object.assign(oud, descriptor);
    vervangDiagramType(oud);
    vervangen.push(kern.id);
  }
  return { vervangen, nieuw, fouten };
}
