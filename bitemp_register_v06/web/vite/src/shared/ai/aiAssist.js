/**
 * aiAssist.js — de vraag voor de vorm `ai-assist`: een tekstvak met een assistent die een
 * VOORSTEL doet (inkorten, herschrijven, aanvullen, of een eigen opdracht). De invuller beslist:
 * overnemen, invoegen of weggooien. Puur (getest in aiAssist.test.js).
 */

export const ACTIES = [
  { id: "korter", label: "Korter", opdracht: "Maak deze tekst korter en krachtiger. Behoud alle feiten." },
  { id: "helder", label: "Helderder", opdracht: "Herschrijf deze tekst in heldere, eenvoudige taal (B1). Behoud de betekenis." },
  { id: "zakelijk", label: "Zakelijker", opdracht: "Herschrijf deze tekst zakelijker en neutraler van toon." },
  { id: "aanvullen", label: "Aanvullen", opdracht: "Vul deze tekst aan waar hij onvolledig is. Verzin geen feiten: markeer ontbrekende gegevens met [..]." },
  { id: "spelling", label: "Spelling", opdracht: "Verbeter alleen spelling, grammatica en interpunctie. Verander verder niets." },
];

/**
 * Systeemtekst + vraag. `context` (optioneel) is wat de assistent over het formulier mag weten:
 * de naam van het formulier, het veld en zijn beschrijving. Alleen dit en de tekst van het veld
 * gaan naar de dienst, niet de rest van het formulier.
 */
export function bouwVraag({ actie, eigenOpdracht = "", tekst = "", veldLabel = "", beschrijving = "", formulier = "" }) {
  const gekozen = ACTIES.find((a) => a.id === actie);
  const opdracht = (eigenOpdracht || "").trim() || gekozen?.opdracht || "";
  if (!opdracht) return null;
  const systeem = [
    "Je helpt iemand een veld in een formulier in te vullen. Schrijf in het Nederlands, tenzij de opdracht iets anders vraagt.",
    "Geef ALLEEN de nieuwe tekst voor het veld terug: geen inleiding, geen uitleg, geen aanhalingstekens eromheen.",
    "Verzin geen feiten, namen of cijfers. Als informatie ontbreekt, markeer dat met [..].",
  ].join(" ");
  const regels = [];
  if (formulier) regels.push(`Formulier: ${formulier}`);
  if (veldLabel) regels.push(`Veld: ${veldLabel}`);
  if (beschrijving) regels.push(`Uitleg bij het veld: ${beschrijving}`);
  regels.push(`Opdracht: ${opdracht}`);
  regels.push(tekst.trim() ? `Huidige tekst:\n<<<\n${tekst}\n>>>` : "Het veld is nog leeg.");
  return { systeem, vraag: regels.join("\n\n") };
}

/** Het voorstel invoegen: achter de bestaande tekst, met een witregel ertussen. */
export function voegVoorstelIn(tekst, voorstel) {
  const a = String(tekst || "").replace(/\s+$/, "");
  return a ? `${a}\n\n${voorstel}` : String(voorstel);
}
