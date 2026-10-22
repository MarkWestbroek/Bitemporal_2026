/**
 * VerwezenDoorPaneel — welke elementen klikken door naar dit diagram (Mark, 20-10: "een lijstje
 * 'naar verwezen door'"). De andere kant van `verwijst naar` en de gedragsverwijzing, over alle
 * profielen. Klik: open een diagram waarop dat element staat en zoek het in de projectboom.
 */
import React from "react";
import { getProfieltypen, getProfieltype } from "./profieltypeRegistry";
import { menuBus } from "./menuBus";
import { verwezenDoor, profielenUitRegistry, openVerwijzing } from "./doorklik.js";

/** Herteken als een element in welk profiel dan ook verandert (een verwijzing kan overal staan). */
function useAlleElementen() {
  const [, tik] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    const af = getProfieltypen()
      .map((p) => p.useStore?.subscribe?.((s, v) => s.elements !== v.elements && tik()))
      .filter(Boolean);
    return () => af.forEach((f) => f());
  }, []);
}

export default function VerwezenDoorPaneel({ profielId, diagramId }) {
  useAlleElementen();
  const lijst = verwezenDoor(profielId, diagramId, profielenUitRegistry());
  return (
    <div className="dc-inspector-sectie dc-gebruik" data-testid="verwezen-door">
      <div className="dc-inspector-sectie-titel">Verwezen door {lijst.length ? `(${lijst.length})` : ""}</div>
      {lijst.length === 0 ? (
        <p className="dc-gebruik-leeg">Geen element klikt door naar dit diagram.</p>
      ) : (
        lijst.map((r) => (
          <button
            key={`${r.profielId}::${r.elementId}`}
            type="button"
            className="dc-gebruik-diagram"
            title={r.diagrammen.length ? `Open "${r.diagrammen[0].naam}" en zoek ${r.naam} in de projectboom` : "Staat op geen diagram — zoek in de projectboom"}
            onClick={() => {
              if (r.diagrammen[0]) openVerwijzing({ profielId: r.profielId, diagramId: r.diagrammen[0].id });
              menuBus.emit("studio:zoek-in-boom", { profielId: r.profielId, elementId: r.elementId });
              // En selecteer het element op dat canvas (Mark, 22-10: "wordt niet geselecteerd").
              // De activiteit luistert op <menuPrefix>:selecteer-element; als de tab pas nu opent,
              // is die een tik later gemonteerd — daarom ook nog eens na een korte wacht.
              const prefix = getProfieltype(r.profielId)?.menuPrefix;
              if (prefix) {
                menuBus.emit(`${prefix}:selecteer-element`, r.elementId);
                setTimeout(() => menuBus.emit(`${prefix}:selecteer-element`, r.elementId), 120);
              }
            }}
          >
            {r.naam}
            <span className="dc-gebruik-aantal"> · {r.type}{r.diagrammen[0] ? ` · op ${r.diagrammen[0].naam}` : ""}</span>
          </button>
        ))
      )}
    </div>
  );
}
