/**
 * MarksPopup — de inhoud van een mark-teken op het canvas (Mark 18-11): hang je boven het ruitje
 * (rechtsboven op een element, of achter een veldnaam), dan verschijnt een klein kaartje met de
 * marks die daar gelden en uit welke laag ze komen. Een klik zet het kaartje vast, tot je ergens
 * anders klikt of Esc drukt.
 *
 * Eén per diagramactiviteit, naast het canvas. Luistert op het document en herkent de tekens aan
 * `[data-dc-mark]` (veld; de waarde is de veldsleutel "<compartiment>:<index>") en
 * `[data-testid="node-marks"]` (element). Het element volgt uit de React Flow-node eromheen.
 */
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMarksStore } from "./marksStore.js";
import { paneelVoorElement, schermContext } from "../marks/marksPaneel.js";
import { splitsVeldSleutel } from "../diagramcore/canvas/inlineNaam.js";

/** Het veld bij een veldsleutel "<compartiment>:<index>" (zoals de tekenaar hem zet). */
function veldBijSleutel(element, sleutel) {
  const { compartmentType, index } = splitsVeldSleutel(sleutel);
  const c = (element?.compartimenten || []).find((x) => String(x.compartmentType ?? x.id) === compartmentType);
  return c?.velden?.[index] || null;
}

const TEKEN = '[data-dc-mark], [data-testid="node-marks"]';

/**
 * @param {{profielId: string, descriptorId: string, elements: Record<string, any>, diagram: any}} props
 */
export default function MarksPopup({ profielId, descriptorId, elements, diagram }) {
  const lagen = useMarksStore((s) => s.lagen);
  const contexten = useMarksStore((s) => s.contexten);
  const marks = useMarksStore((s) => s.marks);
  const actieveContext = useMarksStore((s) => s.actieveContext);
  const soorten = useMarksStore((s) => s.soorten);
  /** @type {[null | {x: number, y: number, elementId: string, veld: string|null, vast: boolean}, Function]} */
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!marks.length) return undefined;
    const vak = () => document.querySelector(`.dc-canvasvlak[data-activiteit="${CSS.escape(profielId)}"]`);
    const doelVan = (e) => {
      const teken = e.target instanceof Element ? e.target.closest(TEKEN) : null;
      if (!teken || !vak()?.contains(teken)) return null;
      // Op een lijn draagt het teken zijn element zelf; op een vak volgt het uit de node eromheen.
      const opLijn = teken.getAttribute("data-mark-element");
      const nodeId = opLijn ? null : teken.closest(".react-flow__node")?.getAttribute("data-id");
      if (!opLijn && !nodeId) return null;
      const elementId = opLijn || (diagram?.nodes || []).find((n) => n.id === nodeId || n.elementId === nodeId)?.elementId || nodeId;
      const r = teken.getBoundingClientRect();
      const veld = opLijn ? null : teken.getAttribute("data-dc-mark");
      return { x: r.right + 6, y: r.top - 2, elementId, veld };
    };
    const over = (e) => {
      const d = doelVan(e);
      if (d) setOpen((nu) => (nu?.vast ? nu : { ...d, vast: false }));
    };
    const uit = (e) => {
      if (e.target instanceof Element && e.target.closest(TEKEN)) setOpen((nu) => (nu?.vast ? nu : null));
    };
    const klik = (e) => {
      const d = doelVan(e);
      if (d) return setOpen({ ...d, vast: true });
      // Op een lijn valt de klik op het hele label (het slepen van het label vangt de aanwijzer):
      // stond het kaartje van dat label al open, dan zet de klik het vast.
      const label = e.target instanceof Element ? e.target.closest(".dc-edge-label") : null;
      const opLabel = label?.querySelector("[data-mark-element]")?.getAttribute("data-mark-element");
      if (opLabel) return setOpen((nu) => (nu && nu.elementId === opLabel ? { ...nu, vast: true } : nu));
      if (!(e.target instanceof Element && e.target.closest(".studio-marks-popup"))) setOpen(null);
    };
    const toets = (e) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", uit);
    document.addEventListener("click", klik, true);
    document.addEventListener("keydown", toets);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", uit);
      document.removeEventListener("click", klik, true);
      document.removeEventListener("keydown", toets);
    };
  }, [profielId, diagram, marks.length]);

  const inhoud = useMemo(() => {
    const element = open ? elements[open.elementId] : null;
    if (!element) return null;
    const st = { lagen, contexten, marks };
    const p = paneelVoorElement({ st, context: schermContext(st, actieveContext), profielId, descriptorId, element });
    const geldt = (x) => x.eff && !x.eff.uit;
    const regel = (x) => ({ label: x.soort.label || x.soort.id, waarde: x.eff.waarde, laag: lagen.find((l) => l.id === x.eff.laag)?.naam || x.eff.laag, uitleg: x.soort.uitleg || "" });
    if (open.veld) {
      const naam = veldBijSleutel(element, open.veld)?.naam;
      const v = p.velden.find((x) => x.naam === naam);
      return v ? { titel: `${element.naam || element.id}.${naam}`, groepen: [{ regels: v.cellen.filter(geldt).map(regel) }] } : null;
    }
    const groepen = [{ regels: p.element.filter(geldt).map(regel) }, ...p.velden.map((v) => ({ kop: v.naam, regels: v.cellen.filter(geldt).map(regel) }))].filter((g) => g.regels.length);
    return { titel: element.naam || element.id, groepen };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, elements, lagen, contexten, marks, soorten, actieveContext, profielId, descriptorId]);

  if (!open || !inhoud || !inhoud.groepen.some((g) => g.regels.length)) return null;
  return createPortal(
    <div
      className={"studio-marks-popup" + (open.vast ? " is-vast" : "")}
      data-testid="marks-popup"
      style={{ left: Math.min(open.x, window.innerWidth - 260), top: Math.max(8, Math.min(open.y, window.innerHeight - 160)) }}
    >
      <div className="studio-marks-popup__titel">◆ {inhoud.titel}</div>
      {inhoud.groepen.map((g, i) => (
        <div key={g.kop || i}>
          {g.kop && <div className="studio-marks-popup__kop">{g.kop}</div>}
          {g.regels.map((r) => (
            <div key={r.label} className="studio-marks-popup__regel" title={r.uitleg}>
              <span>{r.label}{r.waarde === true ? "" : `: ${r.waarde}`}</span>
              <span className="studio-marks-popup__laag">{r.laag}</span>
            </div>
          ))}
        </div>
      ))}
    </div>,
    document.querySelector(".studio") || document.body
  );
}
