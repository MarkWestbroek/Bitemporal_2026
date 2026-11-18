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
import { registreerMarksoorten, zetProjectsoorten, REGISTER_MARKSOORTEN } from "../marks/marksoorten.js";
import { leegMarks, normaliseerMarks, patchMarks, metLaag, zonderLaag, metContext, zonderContext, zetMark, wisMark, metSoort, zonderSoort, zonderEigen, alleenEigen, metEigen, deelLaag } from "../marks/marks.js";

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
    globalThis.localStorage?.setItem(sleutelIn(LS_MARKS), JSON.stringify({ lagen: s.lagen, contexten: s.contexten, marks: s.marks, soorten: s.soorten, actieveContext: s.actieveContext, werklaag: s.werklaag }));
  } catch { /* geen opslag */ }
}

const opgeslagen = leesOpslag();
const stand = (s) => ({ lagen: s.lagen, contexten: s.contexten, marks: s.marks, soorten: s.soorten });

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
    /** Eigen marksoorten van het project (zoals koppelsoorten). */
    zetSoort: (soort) => naar((st) => metSoort(st, soort)),
    wisSoort: (id) => naar((st) => zonderSoort(st, id)),
    zetMark: (mark) => naar((st) => zetMark(st, mark)),
    wisMark: (id) => naar((st) => wisMark(st, id)),

    /** Een pure bewerking op de hele stand (bv. zetEffect uit marks/marksPaneel.js). */
    werk: (bewerking) => naar(bewerking),

    /** Operatie van een ander (projectsync) of van het samenvoegen. */
    patchMarks: (patch) => naar((st) => patchMarks(st, patch)),
    /** Werkbestand laden: vervangt wat van het project is; de eigen lagen blijven. */
    laadMarks: (ruw) => naar((st) => metEigen(normaliseerMarks(ruw), alleenEigen(st))),
    /** Werkruimte laden (ander apparaat): vervangt de eigen lagen. */
    laadEigen: (eigen) => naar((st) => metEigen(st, eigen)),
    /** Een eigen laag delen met het project. */
    deelLaag: (id) => naar((st) => deelLaag(st, id)),

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

// De eigen soorten van het project in de registry, ook na elke wijziging (lokaal of van een ander).
zetProjectsoorten(useMarksStore.getState().soorten);
useMarksStore.subscribe((s, vorig) => {
  if (s.soorten !== vorig?.soorten) zetProjectsoorten(s.soorten);
});

// Projectsync: de netto wijziging is de operatie (zoals bij de kruisverbanden).
koppelStore("marks", useMarksStore, { velden: MARKS_VELDEN, net: marksNet });

/** De marks van het project in de vorm van het werkbestand (zonder de eigen lagen). */
export const marksVanProject = () => zonderEigen(stand(useMarksStore.getState()));

/**
 * Wat van de gebruiker is, voor de werkruimte (reist mee naar een ander apparaat): de eigen lagen
 * met hun marks, en welke lagen hij toepast en waarin hij schrijft. `null` als er niets is.
 */
export function marksVoorWerkruimte() {
  const s = useMarksStore.getState();
  const eigen = alleenEigen(stand(s));
  if (!eigen.lagen.length && !s.actieveContext && !s.werklaag) return null;
  return { ...eigen, actieveContext: s.actieveContext ?? null, werklaag: s.werklaag ?? null };
}

/** De werkruimte van een ander apparaat overnemen. */
export function laadMarksUitWerkruimte(w) {
  const s = useMarksStore.getState();
  s.laadEigen(w || null);
  if (w && "actieveContext" in w) s.zetActieveContext(w.actieveContext ?? null);
  if (w && "werklaag" in w) s.zetWerklaag(w.werklaag ?? null);
}

/** Meld wijzigingen in wat van de gebruiker is (de werkruimte schrijft dan weg). */
export function opEigenWijziging(fn) {
  let vorig = JSON.stringify(marksVoorWerkruimte());
  return useMarksStore.subscribe(() => {
    const nu = JSON.stringify(marksVoorWerkruimte());
    if (nu !== vorig) {
      vorig = nu;
      fn();
    }
  });
}
