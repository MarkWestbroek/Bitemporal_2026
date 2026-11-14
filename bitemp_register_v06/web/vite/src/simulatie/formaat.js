// @ts-check
/**
 * formaat — M1-set, scenario en run als gescheiden JSON (ontwerp §3.5).
 *
 * Voorbereiding op het bewaren van simulaties; hier wordt niets bewaard.
 *
 *   M1-set    waar de simulatie op draait: cm, procesmodel, beslistabellen en
 *             e-dienstmodel, elk met naam en hash (sha256 over JCS, zoals de
 *             inrichtingsartefacten). M1.
 *   scenario  wat erin gaat: startobject, startvariabelen, antwoorden op de
 *             gaten, vulwijze, zaadje. Een fixture is een scenario. M0 (simulatie).
 *   run       wat eruit komt: het log, met het scenario en de hashes van de
 *             M1-set waarop gedraaid is. M0 (simulatie).
 *
 * Scenario:
 *   { versie, naam, start: { proces?, type, id?, object, variabelen? },
 *     vulwijze?: { standaard, perSoort?, perGat? }, antwoorden?: { <plek>: antwoord | antwoord[] }, zaadje? }
 * De plek van een antwoord is de bpmnId, de element-id of de naam van het
 * element; een lijst geeft één antwoord per bezoek (een lus).
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { jcsHash } from "../transformatie/jcs.js";

export const FORMAAT_VERSIE = "0.1";

/**
 * De beschrijving van een M1-set: per deel de rol, de naam en de hash.
 * @param {{cm?: any, proces: any, beslissingen?: any[], edienst?: any}} m1
 * @param {(tekst: string) => string | Promise<string>} sha256Hex
 */
export async function beschrijfM1Set(m1, sha256Hex) {
  const delen = [];
  const voegToe = async (rol, bestand) => {
    if (!bestand) return;
    delen.push({ rol, naam: bestand.model_naam || bestand.edienst?.naam || bestand.naam || rol, hash: await jcsHash(bestand.model || bestand, sha256Hex) });
  };
  await voegToe("cm", m1.cm);
  await voegToe("proces", m1.proces);
  for (const b of m1.beslissingen || []) await voegToe("beslissingen", b);
  await voegToe("edienst", m1.edienst);
  return { versie: FORMAAT_VERSIE, delen };
}

/**
 * De run van een simulatie.
 * @param {{scenario: any, m1set: any, simulatie: {log: any[], stand: () => any}}} invoer
 */
export function maakRun({ scenario, m1set, simulatie }) {
  return { versie: FORMAAT_VERSIE, scenario: scenario.naam || null, m1set, einde: simulatie.stand(), log: simulatie.log };
}

/**
 * Welke delen van de M1-set zijn anders dan bij een eerdere run? Leeg = de
 * run is te vergelijken.
 * @returns {string[]} de rollen (met naam) die verschillen
 */
export function verschilM1Set(toen, nu) {
  const sleutel = (d) => `${d.rol}: ${d.naam}`;
  const hashes = new Map((nu?.delen || []).map((d) => [sleutel(d), d.hash]));
  const anders = (toen?.delen || []).filter((d) => hashes.get(sleutel(d)) !== d.hash).map(sleutel);
  const oud = new Set((toen?.delen || []).map(sleutel));
  return [...anders, ...(nu?.delen || []).map(sleutel).filter((s) => !oud.has(s))];
}
