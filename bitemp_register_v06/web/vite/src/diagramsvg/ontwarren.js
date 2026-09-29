/**
 * ontwarren — haal overlappende elementen na de autoLayout uit elkaar.
 *
 * autoLayout.js (Studio) is hiërarchisch en snel, maar garandeert geen
 * overlapvrijheid: relatiebadges op "halverwege" en notities "ernaast" kunnen
 * op een kaart landen. In de editor sleept de gebruiker dat recht; in een
 * statische figuur moet het vanzelf goed gaan.
 *
 * Deterministisch: vaste volgorde, geen toeval. Per overlappend paar schuift
 * het lichtste element (badge/anker/notitie vóór gegevenselement vóór
 * entiteit; bij gelijk gewicht het latere) over de kortste as weg.
 */

const GEWICHT = { entiteit: 3, gegevenselement: 2, enumeratie: 2, gegevenstype: 2, referentielijstInstantie: 2 };

function overlapt(a, b, t) {
  return a.x < b.x + b.w + t && b.x < a.x + a.w + t && a.y < b.y + b.h + t && b.y < a.y + a.h + t;
}

/**
 * Schuif `los` net voorbij `vast`, in de richting (rechts, onder, links,
 * boven) met de kleinste verplaatsing die nergens anders overlap geeft; lukt
 * dat in geen richting, dan de kleinste. Zo pendelt een badge niet eindeloos
 * tussen twee buren.
 */
function verschuif(los, vast, items, t) {
  const opties = [
    { dx: vast.x + vast.w + t - los.x, dy: 0 },
    { dx: 0, dy: vast.y + vast.h + t - los.y },
    { dx: vast.x - t - (los.x + los.w), dy: 0 },
    { dx: 0, dy: vast.y - t - (los.y + los.h) },
  ].map((o, i) => ({ ...o, i, afstand: Math.abs(o.dx) + Math.abs(o.dy) }));
  opties.sort((a, b) => a.afstand - b.afstand || a.i - b.i);
  const vrij = opties.find((o) => {
    const kandidaat = { x: los.x + o.dx, y: los.y + o.dy, w: los.w, h: los.h };
    return items.every((it) => it === los || !overlapt(kandidaat, it, t - 1));
  });
  const keuze = vrij || opties[0];
  los.x += keuze.dx;
  los.y += keuze.dy;
}

/**
 * @param items [{ id, type, x, y, w, h }] — wordt ter plekke aangepast
 */
export function haalUitElkaar(items, { tussenruimte = 20, maxRondes = 80 } = {}) {
  for (let ronde = 0; ronde < maxRondes; ronde++) {
    let verschoven = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i];
        const B = items[j];
        const ox = Math.min(A.x + A.w, B.x + B.w) + tussenruimte - Math.max(A.x, B.x);
        const oy = Math.min(A.y + A.h, B.y + B.h) + tussenruimte - Math.max(A.y, B.y);
        if (ox <= 0 || oy <= 0) continue;
        const gA = GEWICHT[A.type] || 1;
        const gB = GEWICHT[B.type] || 1;
        const [vast, los] = gB <= gA ? [A, B] : [B, A];
        verschuif(los, vast, items, tussenruimte);
        verschoven = true;
      }
    }
    if (!verschoven) return;
  }
}
