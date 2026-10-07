/**
 * NaamEditor — het inline tekstveld van de canvas (F2 / klik op de naam, op
 * een veldregel of op een relatienaam). Gedeeld door ElementNode (nodes) en
 * ConnectorEdge (lijnen).
 *
 * Plaatsing: met `vindDoel(wrapper)` zoekt het veld het tekst-element van de
 * shape op (de naam `data-dc-naam`/`.dc-naam`, of een veldregel) en legt
 * zich daaroverheen: links uitgelijnd op links uitgelijnde tekst (attributen
 * in een klasse), gecentreerd op gecentreerde tekst (ellips, actor), binnen
 * de node geklemd zolang het tekst-element zelf binnen de node ligt (een
 * actornaam mag breder zijn dan de strekfiguur). Maat en letter volgen dat
 * element, zodat het als inline bewerken voelt. Zonder doel valt het terug
 * op de plaats-klasse (midden/boven/buiten) of op een meegegeven `stijl`
 * (lijnen: het veld staat dan in een EdgeLabelRenderer op de labelplek).
 *
 * Enter bevestigt, Escape annuleert, focus verliezen bevestigt ook;
 * `klaar(null)` = niets veranderd/geannuleerd, `klaar(tekst)` = nieuwe naam.
 */
import { useLayoutEffect, useRef, useState } from "react";

export default function NaamEditor({ waarde: begin, vindDoel, plaats = "midden", stijl, klaar }) {
  const [waarde, setWaarde] = useState(begin || "");
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const afgerondRef = useRef(false);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    const wrapper = vindDoel ? input.closest(".react-flow__node") : null;
    const doel = wrapper ? vindDoel(wrapper) : null;
    if (wrapper && doel) {
      const w = wrapper.getBoundingClientRect();
      const d = doel.getBoundingClientRect();
      // Schermpixels → node-pixels (de canvas is gezoomd).
      const zoom = wrapper.offsetWidth ? w.width / wrapper.offsetWidth : 1;
      if (zoom > 0 && d.width > 0) {
        const cs = getComputedStyle(doel);
        const dw = d.width / zoom;
        const dh = d.height / zoom;
        const nodeBreedte = w.width / zoom;
        const centreer = cs.textAlign === "center";
        let breedte = Math.max(dw + 14, 96);
        const hoogte = Math.max(dh + 4, 22);
        let left = (d.left - w.left) / zoom - (centreer ? (breedte - dw) / 2 : 7);
        const top = (d.top - w.top) / zoom - (hoogte - dh) / 2;
        // Klemmen binnen de node, maar alleen als het tekst-element zelf
        // binnen de node ligt (een buitenlabel/actornaam steekt bewust uit).
        const binnen = d.left >= w.left - 1 && d.right <= w.right + 1;
        if (binnen) {
          breedte = Math.min(breedte, nodeBreedte - 4);
          left = Math.max(2, Math.min(left, nodeBreedte - breedte - 2));
        }
        setPos({
          left,
          top,
          width: breedte,
          height: hoogte,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          fontStyle: cs.fontStyle,
          textAlign: centreer ? "center" : "left",
          transform: "none",
        });
      }
    }
    input.focus();
    input.select();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rond = (nieuw) => {
    if (afgerondRef.current) return;
    afgerondRef.current = true;
    klaar(nieuw);
  };
  const bevestig = () => {
    const schoon = waarde.trim();
    rond(schoon && schoon !== (begin || "") ? schoon : null);
  };
  const eigen = pos || stijl || null;
  return (
    <input
      ref={ref}
      className={`dc-naam-editor nodrag nopan nowheel is-${eigen ? "doel" : plaats}`}
      style={eigen || undefined}
      value={waarde}
      aria-label="Naam"
      onChange={(e) => setWaarde(e.target.value)}
      onBlur={bevestig}
      // De canvas-sneltoetsen (Delete, Escape, F2, Ctrl+Z) horen niet te
      // reageren op toetsen in dit veld.
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key !== "Enter" && e.key !== "Escape") return;
        e.preventDefault();
        // Focus terug naar de node (of het canvas-vlak bij een lijn), zodat
        // een volgende F2/Delete meteen landt — niet bij blur (dan klikte de
        // gebruiker bewust elders).
        const doel =
          e.currentTarget.closest(".react-flow__node") ||
          e.currentTarget.closest(".react-flow")?.querySelector(".react-flow__pane");
        if (doel) setTimeout(() => doel.focus?.({ preventScroll: true }), 0);
        if (e.key === "Enter") bevestig();
        else rond(null);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
