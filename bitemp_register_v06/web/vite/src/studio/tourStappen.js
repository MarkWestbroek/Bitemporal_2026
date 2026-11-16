// @ts-check
/**
 * tourStappen — de kennismakingstour van de Studio (HELP-2, 14-10), naar het model van de
 * MusicBrain-editor (`editor/src/modular-mb/recipe/Tour.tsx`): eigen spotlight, geen library.
 *
 * Een stap:
 *   anker   data-tour-waarde (bv. "activiteiten") of een CSS-selector (begint met [ . #);
 *           zonder anker: midden in beeld
 *   titel, tekst
 *   actie   {label, emit}: een knop die een menuBus-event stuurt (bv. het palet openen)
 *   klaar   (start, nu) => boolean: de tour gaat vanzelf door als je het gedaan hebt
 *   overslaan  () => boolean: niet van toepassing (anker ontbreekt en de stap heeft het nodig)
 *
 * `start` en `nu` zijn tellingen {diagrammen, elementen} over alle profielen (telStand).
 * "Al gezien" per browser: localStorage `studio05-tour-v1`.
 */

export const TOUR_SLEUTEL = "studio05-tour-v1";

/** Zoek het anker van een stap in de pagina. */
export function zoekAnker(anker, doc = globalThis.document) {
  if (!anker || !doc) return null;
  const selector = /^[[.#]/.test(anker) ? anker : `[data-tour="${anker}"]`;
  return doc.querySelector(selector);
}

export const TOUR_STAPPEN = [
  {
    titel: "Welkom in Omnium Studio",
    tekst:
      "Een korte rondleiding. Hier modelleer je informatievoorziening in verschillende talen " +
      "(UML, use cases, BPMN, ArchiMate, …) in één project. Pijltjes of Enter gaan verder, Esc sluit.",
  },
  {
    anker: "activiteiten",
    titel: "Activiteiten",
    tekst:
      "Links staan de hoofdfuncties: Modelleren (waar je nu bent), en verder onder meer Gebruikers en " +
      "Instellingen. Alles wat niet in de balk staat, vind je via Ga naar.",
  },
  {
    anker: "paneel-left",
    titel: "Het project",
    tekst:
      "De projectboom. Bovenaan staan de bundels: een bundel is een benoemde set diagrammen die je in één " +
      "keer opent (rechtsklik op een tab → Bewaar open tabs als bundel; 👥 = gedeeld met het project). " +
      "Daaronder mappen, diagrammen en per taal (profiel) de elementen. Rechtsklik geeft de acties; " +
      "een element sleep je zo naar een diagram.",
  },
  {
    // HELP-uitbreiding 16-11 (Mark): het servermechanisme, de assistent, melden, de Labs-activiteiten.
    anker: "menu-project",
    titel: "Projecten op de server",
    tekst:
      "Project → Van server ophalen… toont de projecten waar je bij mag, met eigenaar, versie en grootte. " +
      "Ophalen vervangt het project in deze browser: bewaar het huidige eerst via Nieuw project… (parkeren) " +
      "of Exporteer project…. Naar server sturen bewaart je werk daar; met Live synchroniseren zie je de " +
      "wijzigingen van anderen meteen. Om te proberen: haal Omnium demo — gemeente Waterstede op, een verzonnen " +
      "evenementenvergunning in alle talen.",
  },
  {
    anker: "nieuw-diagram",
    titel: "Begin met een diagram",
    tekst: "Kies een taal en geef het diagram een naam. Probeer bijvoorbeeld Use case.",
    klaar: (start, nu) => nu.diagrammen > start.diagrammen,
    overslaan: () => !zoekAnker("nieuw-diagram"),
  },
  {
    anker: '[data-balk-id="maken"]',
    titel: "Elementen maken",
    tekst:
      "De taakbalk Maken toont wat deze taal kent. Klik er een aan: het verschijnt op het canvas. " +
      "Verbinden doe je door van een bolletje aan de rand naar een ander element te slepen.",
    klaar: (start, nu) => nu.elementen > start.elementen,
    overslaan: () => !zoekAnker('[data-balk-id="maken"]'),
  },
  {
    anker: "paneel-right",
    titel: "Eigenschappen",
    tekst:
      "Rechts staan de eigenschappen van wat je selecteert: naam, beschrijving, velden en onder Relaties " +
      "alles wat ermee verbonden is.",
  },
  {
    anker: "paneel-left",
    titel: "De AI-assistent",
    tekst:
      "Rechtsklik op een map → ✨ Vraag de assistent…, en beschrijf wat je wilt (bijvoorbeeld \"een use case " +
      "voor een parkeervergunning, met het proces eronder\"). Je krijgt eerst een voorstel en past het pas toe " +
      "als je op Toepassen klikt. De eerste keer kies je hoe: met een eigen API-sleutel (Claude of DeepSeek; " +
      "die blijft in je browser) of met een toegangscode van de beheerder.",
  },
  {
    anker: "activiteiten",
    titel: "Experimenteel: Toegangverlening en Simulatie",
    tekst:
      "Twee activiteiten in aanbouw. Toegangverlening: schrijf toegangsbeleid in klare taal (Toegangsspraak), " +
      "als diagram en als ODRL. Simulatie: doorloop een BPMN-proces met zijn beslistabellen stap voor stap, " +
      "met een object uit het model. Staan ze niet in de balk? Zet Labs aan onder Instellingen, of gebruik Ga naar. " +
      "Kies in Simulatie onder Voorbeeldscenario kiezen… bijvoorbeeld het Waterstede-buurtfeest.",
  },
  {
    titel: "Zoek elke opdracht",
    tekst: "Weet je niet waar iets zit? Ctrl+K opent het opdrachtenpalet: typ wat je wilt doen.",
    actie: { label: "Open het opdrachtenpalet", emit: "palette:open" },
  },
  {
    anker: "menu-help",
    titel: "Iets melden",
    tekst:
      "Een bug, een vraag of een idee? Help → Melden… (Alt+M). Met F8 trek je eerst een kader om wat je wilt " +
      "laten zien: dat gaat als schermafbeelding mee. Onder Mijn meldingen volg je de status en het antwoord.",
  },
  {
    anker: "menu-help",
    titel: "Help",
    tekst:
      "Onder Help vind je deze rondleiding terug, de sneltoetsen, de tips en de documentatie. Veel plezier!",
  },
];

/** Volgende (of vorige) stap die niet overgeslagen wordt; -1 = einde. */
export function volgendeStap(stappen, vanaf, richting = 1) {
  for (let i = vanaf + richting; i >= 0 && i < stappen.length; i += richting) {
    if (!stappen[i].overslaan?.()) return i;
  }
  return richting > 0 ? -1 : vanaf;
}

export function tourGezien() {
  try {
    return globalThis.localStorage?.getItem(TOUR_SLEUTEL) === "gezien";
  } catch {
    return true; // geen opslag: niet elke keer opdringen
  }
}

export function markeerTourGezien() {
  try {
    globalThis.localStorage?.setItem(TOUR_SLEUTEL, "gezien");
  } catch {
    /* opslag uit */
  }
}

/** Ballonpositie: onder het anker als er plaats is, anders erboven, anders ernaast; altijd in beeld. */
export function ballonPositie(rect, ballon, venster, marge = 12) {
  if (!rect) {
    return { left: Math.max(marge, (venster.w - ballon.w) / 2), top: Math.max(marge, (venster.h - ballon.h) / 2) };
  }
  const klem = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  const links = klem(rect.left, marge, venster.w - ballon.w - marge);
  if (rect.bottom + marge + ballon.h <= venster.h) return { left: links, top: rect.bottom + marge };
  if (rect.top - marge - ballon.h >= 0) return { left: links, top: rect.top - marge - ballon.h };
  // Hoog anker (bv. een paneel): ernaast, rechts als het past, anders links.
  const top = klem(rect.top + 40, marge, venster.h - ballon.h - marge);
  if (rect.right + marge + ballon.w <= venster.w) return { left: rect.right + marge, top };
  return { left: klem(rect.left - marge - ballon.w, marge, venster.w - ballon.w - marge), top };
}
