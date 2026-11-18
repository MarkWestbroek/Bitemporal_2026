// @ts-check
/**
 * marksStore — de marks van het project in de Studio (plan 2026-11-18 Marks, stap 3).
 *
 * De gedeelde lagen, contexten en marks staan in het werkbestand (`marks`, naast
 * `kruisverbanden`) en lopen mee in de projectsync: de netto wijziging gaat als één operatie
 * `marks/patchMarks` naar de server (zoals de kruisverbanden). De logica is puur
 * (marks/marks.js); deze store bewaart en meldt alleen.
 *
 * `actieveContext` is van jou en van dit apparaat (welke lagen je nu toepast, in welke
 * volgorde): niet in het werkbestand, niet in de sync. Een context-id, of een lijst laag-ids.
 *
 * Nog niet: eigen lagen in de werkruimte die je daarna deelt (zoals bundels); nu is elke laag
 * meteen van het project.
 */
import { create } from "zustand";
import { koppelStore, marksNet, MARKS_VELDEN } from "./sync/operaties.js";
import { sleutelIn } from "../diagramcore/model/opslagRuimte.js";
import { registreerMarksoorten, REGISTER_MARKSOORTEN } from "../marks/marksoorten.js";
import { leegMarks, normaliseerMarks, patchMarks, metLaag, zonderLaag, metContext, zonderContext, zetMark, wisMark } from "../marks/marks.js";

export const LS_MARKS = "studio-marks";

function leesOpslag() {
  try {
    const raw = globalThis.localStorage?.getItem(sleutelIn(LS_MARKS));
    if (raw) return JSON.parse(raw);
  } catch { /* geen opslag */ }
  return {};
}

function bewaar(s) {
  try {
    globalThis.localStorage?.setItem(sleutelIn(LS_MARKS), JSON.stringify({ lagen: s.lagen, contexten: s.contexten, marks: s.marks, actieveContext: s.actieveContext, werklaag: s.werklaag }));
  } catch { /* geen opslag */ }
}

const opgeslagen = leesOpslag();
const stand = (s) => ({ lagen: s.lagen, contexten: s.contexten, marks: s.marks });

export const useMarksStore = create((set) => {
  /** Zet de nieuwe stand (alleen de delen die veranderden krijgen een nieuwe referentie). */
  const naar = (bereken) =>
    set((s) => {
      const na = bereken(stand(s));
      const patch = {};
      for (const deel of MARKS_VELDEN) if (na[deel] !== s[deel]) patch[deel] = na[deel];
      bewaar({ ...s, ...patch });
      return patch;
    });
  return {
    ...leegMarks(),
    ...normaliseerMarks(opgeslagen),
    /** @type {string | string[] | null} context-id of een lijst laag-ids; alleen van deze gebruiker */
    actieveContext: opgeslagen.actieveContext ?? null,
    /** @type {string | null} de laag waarin het scherm schrijft; ook alleen van deze gebruiker */
    werklaag: opgeslagen.werklaag ?? null,

    zetLaag: (laag) => naar((st) => metLaag(st, laag)),
    wisLaag: (id) => naar((st) => zonderLaag(st, id)),
    zetContext: (context) => naar((st) => metContext(st, context)),
    wisContext: (id) => naar((st) => zonderContext(st, id)),
    zetMark: (mark) => naar((st) => zetMark(st, mark)),
    wisMark: (id) => naar((st) => wisMark(st, id)),

    /** Een pure bewerking op de hele stand (bv. zetEffect uit marks/marksPaneel.js). */
    werk: (bewerking) => naar(bewerking),

    /** Operatie van een ander (projectsync) of van het samenvoegen. */
    patchMarks: (patch) => naar((st) => patchMarks(st, patch)),
    /** Werkbestand laden: vervangt alles. */
    laadMarks: (ruw) => naar(() => normaliseerMarks(ruw)),

    zetActieveContext: (actieveContext) =>
      set((s) => {
        bewaar({ ...s, actieveContext });
        return { actieveContext };
      }),
    zetWerklaag: (werklaag) =>
      set((s) => {
        bewaar({ ...s, werklaag });
        return { werklaag };
      }),
  };
});

// De marksoorten van de transformaties die de Studio kent. Voorlopig hier; een regelset die er
// zelf declareert, registreert ze bij haar eigen code (marks/marksoorten.js).
registreerMarksoorten(REGISTER_MARKSOORTEN);

// Projectsync: de netto wijziging is de operatie (zoals bij de kruisverbanden).
koppelStore("marks", useMarksStore, { velden: MARKS_VELDEN, net: marksNet });

/** De marks van het project in de vorm van het werkbestand. */
export const marksVanProject = () => stand(useMarksStore.getState());
