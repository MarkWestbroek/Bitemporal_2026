/**
 * LegeCanvas — de lege staat van een diagram (ontwerp docs/plans/2026-09-10 Begeleiding in
 * de Studio §2.1): zegt wat je hier kunt maken en geeft twee à drie startacties. Verdwijnt
 * zodra er een element op staat. Alles wat er staat, komt uit het profiel (de descriptor),
 * dus het klopt per taal zonder losse teksten.
 *
 * Ligt over het canvas maar blokkeert niets: alleen de knoppen vangen klikken, zodat slepen
 * uit de boom of de taakbalk gewoon op het canvas landt, ook midden op de kaart. Tijdens
 * slepen verdwijnt hij helemaal (anders kan een drop op een knop vallen).
 */
import React, { useEffect, useRef } from "react";
import { menuBus } from "../menuBus";
import { profielInhoud, opsomming } from "../hints.js";

export default function LegeCanvas({ descriptor, diagramTerm = "diagram", plaatsNieuwElement, startActies = [], useStore }) {
  const ref = useRef(null);
  // Synchroon via de DOM (niet via state): de dragover/drop volgt direct op dragstart.
  useEffect(() => {
    const zet = (zichtbaar) => () => {
      if (ref.current) ref.current.style.display = zichtbaar ? "" : "none";
    };
    const weg = zet(false);
    const terug = zet(true);
    document.addEventListener("dragstart", weg, true);
    document.addEventListener("dragend", terug, true);
    document.addEventListener("drop", terug);
    return () => {
      document.removeEventListener("dragstart", weg, true);
      document.removeEventListener("dragend", terug, true);
      document.removeEventListener("drop", terug);
    };
  }, []);
  const { elementen, relaties } = profielInhoud(descriptor);
  // Snelle start: de eerste typen die ook in de Maken-taakbalk staan.
  const snel = (descriptor?.elementTypes || []).filter((et) => !et.isConnector && et.kort && !et.isAbstract && et.inPalet !== false).slice(0, 3);
  return (
    <div className="dc-leeg" data-testid="lege-canvas" ref={ref}>
      <div className="dc-leeg__kaart">
        <div className="dc-leeg__titel">Dit {diagramTerm} is nog leeg</div>
        {elementen.length > 0 && (
          <p>
            Hier maak je {opsomming(elementen)}
            {relaties.length > 0 ? <>, verbonden met {opsomming(relaties, 4)}</> : null}.
          </p>
        )}
        <ul>
          <li>Kies een element in de taakbalk <em>Maken</em>; het verschijnt op het canvas.</li>
          <li>Of sleep een bestaand element uit de projectboom hierheen.</li>
          <li>Verbinden: sleep van een bolletje aan de rand naar een ander element.</li>
        </ul>
        <div className="dc-leeg__acties">
          {snel.map((et) => (
            <button key={et.id} type="button" className="studio-hint__knop" onClick={() => plaatsNieuwElement?.(et.id)}>
              + {et.label}
            </button>
          ))}
          {startActies.map((a) => (
            <button key={a.id || a.label} type="button" className="studio-hint__knop" onClick={() => a.run?.(useStore)}>
              {a.label}
            </button>
          ))}
          <button type="button" className="studio-hint__knop studio-hint__knop--zacht" onClick={() => menuBus.emit("palette:open")}>
            Alle opdrachten (Ctrl+K)
          </button>
        </div>
      </div>
    </div>
  );
}
