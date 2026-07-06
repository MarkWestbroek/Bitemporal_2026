/**
 * ConnectorEdge — dé generieke React Flow-edge van de diagramcore.
 *
 * Volledig declaratief: rendert wat er in `data.presentatie` staat en kent
 * géén elementtypen. De classificatie (compositie/associatie/dependency/…)
 * gebeurt in het profiel (adapter of connector-materialisatie) dat de
 * presentatie berekent. Dit is de kern van de core/profiel-splitsing voor
 * edges (plan §4.4).
 *
 * data.presentatie:
 *   lijn:        "solid" | "dash-6-3" | "dash-4-3" | "dash-4-4"
 *   vorm:        "bezier" (default) | "hoekig" (orthogonaal) | "recht" |
 *                "boom" (EA tree style: dwarslat op vaste afstand van de
 *                ouder, zodat alle kinderen één hark delen)
 *                — de route van de lijn (§8.5c-familie); UML oogt
 *                herkenbaarder hoekig, grafen juist met krommen
 *   kleur:       basiskleur (selected → accent, tenzij `vasteKleur`)
 *   opacity?:    number
 *   markerStart: "ruit" | "ruit-open" | null — compositie- (◆) of
 *                aggregatie-ruit (◇) aan de bronzijde
 *   markerEnd:   "pijl-open" | "driehoek" | "pijl-dicht" | "bol" | null
 *                — driehoek = open (canvas-gevuld, generalisatie ▷);
 *                pijl-dicht = gevulde driehoek (DMN information requirement);
 *                bol = gevulde stip (DMN authority requirement)
 *   labels: [ { zijde: "bron"|"doel"|"midden", offset?: {x,y},
 *               delen: [ { tekst, soort: "rolnaam"|"kardinaliteit"|"constraint"|"naam", kleur? } ] } ]
 */
import { useLayoutEffect, useRef, useState } from "react";
import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  EdgeLabelRenderer,
  BaseEdge,
  useStore,
} from "@xyflow/react";

const DASHES = {
  "dash-6-3": "6 3",
  "dash-4-3": "4 3",
  "dash-4-4": "4 4",
};

const SOORT_KLASSE = {
  rolnaam: "dc-edge-rolnaam",
  kardinaliteit: "dc-edge-kardinaliteit",
  constraint: "dc-edge-constraint",
  naam: "dc-edge-naam",
};

function ConnectorEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) {
  const p = data?.presentatie || {};
  const padArgs = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  // Zelf-verwijzing (source == target): een "oortje" buitenom de node —
  // anders valt het pad samen met één punt en is de connector onzichtbaar
  // (bv. de ENT→ENT-verbindingsregels in de profiel-ontwerper). De lus volgt
  // de gekozen handles: de controlepunten steken uit in de richting van elk
  // uiteinde, zodat boven→rechts óm de hoek gaat i.p.v. onderlangs.
  const isLus = source && source === target;
  const lusPad = () => {
    const UIT = {
      top: { x: 0, y: -1 },
      bottom: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const nS = UIT[sourcePosition] || UIT.right;
    const nT = UIT[targetPosition] || UIT.right;
    const L = 56;
    // Hoekige lus (contextmenu → Lijnvorm): rechte segmenten buitenom, in
    // dezelfde geest als getSmoothStepPath maar dan om de node heen.
    if (p.vorm === "hoekig") {
      const p1 = { x: sourceX + nS.x * L, y: sourceY + nS.y * L };
      const p2 = { x: targetX + nT.x * L, y: targetY + nT.y * L };
      const sVert = nS.x === 0;
      const tVert = nT.x === 0;
      let pts = null;
      if (sVert !== tVert) {
        // Haaks op elkaar (bv. boven→rechts): één hoekpunt buitenom.
        pts = [p1, sVert ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y }, p2];
      } else if (nS.x === nT.x && nS.y === nT.y) {
        const t = { x: -nS.y, y: nS.x };
        if (Math.abs(sourceX - targetX) < 1 && Math.abs(sourceY - targetY) < 1) {
          // Beide uiteinden op hetzelfde punt: klein rechthoekig oor.
          pts = [
            p1,
            { x: p1.x + t.x * 34, y: p1.y + t.y * 34 },
            { x: sourceX + t.x * 34, y: sourceY + t.y * 34 },
          ];
        } else if (sVert) {
          // Zelfde zijde (boven/onder): buitenom langs de verste uitsteek.
          const yUit = nS.y < 0 ? Math.min(p1.y, p2.y) : Math.max(p1.y, p2.y);
          pts = [{ x: sourceX, y: yUit }, { x: targetX, y: yUit }];
        } else {
          const xUit = nS.x < 0 ? Math.min(p1.x, p2.x) : Math.max(p1.x, p2.x);
          pts = [{ x: xUit, y: sourceY }, { x: xUit, y: targetY }];
        }
      }
      // Tegenover elkaar (boven↔onder): geen nette orthogonale route — val
      // terug op de kromme lus hieronder.
      if (pts) {
        const pad = [`M ${sourceX} ${sourceY}`, ...pts.map((q) => `L ${q.x} ${q.y}`), `L ${targetX} ${targetY}`].join(" ");
        const apex = pts[Math.floor((pts.length - 1) / 2)];
        return [pad, apex.x, apex.y];
      }
    }
    let c1 = { x: sourceX + nS.x * L, y: sourceY + nS.y * L };
    let c2 = { x: targetX + nT.x * L, y: targetY + nT.y * L };
    if (Math.abs(c1.x - c2.x) < 8 && Math.abs(c1.y - c2.y) < 8) {
      // Beide uiteinden op (vrijwel) hetzelfde punt: spreid de controle-
      // punten haaks op de uitrichting, anders is de lus plat.
      const t = { x: -nS.y, y: nS.x };
      c1 = { x: c1.x + t.x * 34, y: c1.y + t.y * 34 };
      c2 = { x: c2.x - t.x * 34, y: c2.y - t.y * 34 };
    }
    return [
      `M ${sourceX} ${sourceY} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${targetX} ${targetY}`,
      (c1.x + c2.x) / 2,
      (c1.y + c2.y) / 2,
    ];
  };
  // Knikpunten (ctrl-klik op de lijn): het pad loopt als polylijn door de
  // punten in data.knikken — de gebruiker "rekt" de lijn met de hand.
  const [sleepKnik, setSleepKnik] = useState(null); // {index, x, y} tijdens slepen
  // Segment-slepen (duwen/trekken van haakse lijnen): tijdens de sleep staat
  // hier de volledige tussenpunten-lijst als voorbeeld.
  const [sleepSegment, setSleepSegment] = useState(null); // {interieur: [{x,y}]}
  const knikkenBasis = Array.isArray(data?.knikken) && data.knikken.length ? data.knikken : null;
  const knikken = sleepSegment
    ? sleepSegment.interieur
    : knikkenBasis
      ? knikkenBasis.map((k, i) => (sleepKnik?.index === i ? { x: sleepKnik.x, y: sleepKnik.y } : k))
      : null;
  const knikPad = () => {
    const pts = [{ x: sourceX, y: sourceY }, ...knikken, { x: targetX, y: targetY }];
    const pad = pts.map((q, i) => `${i ? "L" : "M"} ${q.x} ${q.y}`).join(" ");
    const midI = Math.floor(pts.length / 2);
    return [pad, (pts[midI - 1].x + pts[midI].x) / 2, (pts[midI - 1].y + pts[midI].y) / 2];
  };
  // Boomstijl (EA "tree style"): korte stam uit de ouder, één dwarslat op
  // váste afstand van de ouder-handle, en per kind een rechte poot. Doordat
  // de lat-positie alleen van de bron afhangt, delen alle kinderen van
  // dezelfde ouder één lat — óók als ze op ongelijke hoogtes staan.
  const boomPad = () => {
    const LAT = 40;
    if (sourcePosition === "left" || sourcePosition === "right") {
      const latX = sourceX + (sourcePosition === "right" ? LAT : -LAT);
      return [
        `M ${sourceX} ${sourceY} L ${latX} ${sourceY} L ${latX} ${targetY} L ${targetX} ${targetY}`,
        latX,
        (sourceY + targetY) / 2,
      ];
    }
    const latY = sourceY + (sourcePosition === "top" ? -LAT : LAT);
    return [
      `M ${sourceX} ${sourceY} L ${sourceX} ${latY} L ${targetX} ${latY} L ${targetX} ${targetY}`,
      (sourceX + targetX) / 2,
      latY,
    ];
  };
  const [edgePath, labelX, labelY] = knikken
    ? knikPad()
    : isLus
      ? lusPad()
      : p.vorm === "boom"
        ? boomPad()
        : p.vorm === "hoekig"
          ? getSmoothStepPath({ ...padArgs, borderRadius: 4 })
          : p.vorm === "recht"
            ? getStraightPath(padArgs)
            : getBezierPath(padArgs);

  const kleur = selected && !p.vasteKleur
    ? "var(--dc-selectie, #2563eb)"
    : p.kleur || "var(--dc-lijn, #64748b)";
  const pijlId = `dc-pijl-${id}`;
  const driehoekId = `dc-driehoek-${id}`;
  const pijlDichtId = `dc-pijl-dicht-${id}`;
  const bolId = `dc-bol-${id}`;

  // Sleepbare labels (vgl. editor 0.2): pointer-drag in flow-coördinaten
  // (schermafstand gedeeld door de zoom); bij loslaten meldt de edge de
  // nieuwe offset per zijde via data.onLabelOffset — de activiteit bewaart
  // hem op het connector-element (data.labelOffsets).
  const zoom = useStore((s) => s.transform[2]) || 1;
  const vlak = useStore((s) => s.domNode); // React Flow-container (voor ctrl-klik → flow-coördinaten)
  const verschuifX = useStore((s) => s.transform[0]);
  const verschuifY = useStore((s) => s.transform[1]);
  const [sleep, setSleep] = useState(null); // {index, x, y} tijdens het slepen
  const magSlepen = typeof data?.onLabelOffset === "function";
  const startLabelSleep = (e, index, label) => {
    if (!magSlepen || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const doelEl = e.currentTarget;
    doelEl.setPointerCapture?.(e.pointerId);
    const basis = label.offset || { x: 0, y: 0 };
    const startX = e.clientX;
    const startY = e.clientY;
    let laatste = { x: basis.x || 0, y: basis.y || 0 };
    const beweeg = (ev) => {
      laatste = {
        x: (basis.x || 0) + (ev.clientX - startX) / zoom,
        y: (basis.y || 0) + (ev.clientY - startY) / zoom,
      };
      setSleep({ index, ...laatste });
    };
    const klaar = () => {
      doelEl.removeEventListener("pointermove", beweeg);
      doelEl.removeEventListener("pointerup", klaar);
      setSleep(null);
      data.onLabelOffset(label.zijde || "midden", {
        x: Math.round(laatste.x),
        y: Math.round(laatste.y),
      });
    };
    doelEl.addEventListener("pointermove", beweeg);
    doelEl.addEventListener("pointerup", klaar);
  };

  // ── Knikpunten: ctrl-klik voegt toe, slepen verplaatst, dubbelklik wist.
  // Ook op zelf-lussen (oortjes): zo kun je het oor vrij vervormen. ──
  const magKnikken = typeof data?.onKnikken === "function";

  /**
   * Polylijn van het huidige pad (alleen haakse vormen). Basis voor
   * segment-slepen: M/L-punten plus Q-eindpunten (smoothstep-bochtjes),
   * daarna vereenvoudigd (dubbele/collineaire punten weg).
   */
  const huidigePolyline = () => {
    if (knikkenBasis) {
      return [{ x: sourceX, y: sourceY }, ...knikkenBasis, { x: targetX, y: targetY }];
    }
    if (/C/.test(edgePath)) return null; // bezier-krommen: niet segmenteerbaar
    const pts = [];
    const re = /([MLQ])\s*([-\d.]+)[ ,]+([-\d.]+)(?:[ ,]+([-\d.]+)[ ,]+([-\d.]+))?/g;
    let m;
    while ((m = re.exec(edgePath))) {
      if (m[1] === "Q" && m[4] !== undefined) pts.push({ x: +m[4], y: +m[5] });
      else pts.push({ x: +m[2], y: +m[3] });
    }
    if (pts.length < 3) return null;
    const uit = [pts[0]];
    for (let i = 1; i < pts.length - 1; i += 1) {
      const a = uit[uit.length - 1];
      const b = pts[i];
      const c = pts[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 2) continue;
      const kruis = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(kruis) < 0.5) continue; // collineair: overslaan
      uit.push(b);
    }
    uit.push(pts[pts.length - 1]);
    return uit.length >= 3 ? uit : null;
  };

  const netGesleeptRef = useRef(false);
  /**
   * Duwen/trekken van een haaks segment: pak de lijn vast en beweeg haaks op
   * het segment. De vorm wordt bij loslaten als knikpunten vastgelegd, dus
   * daarna blijft hij zo staan (en is hij verder te verfijnen).
   */
  const startSegmentSleep = (e) => {
    if (!magKnikken || e.ctrlKey || e.button !== 0) return;
    const basisPts = huidigePolyline();
    if (!basisPts) return;
    const rect = vlak?.getBoundingClientRect?.();
    if (!rect) return;
    const naarFlow = (ev) => ({
      x: (ev.clientX - rect.left - verschuifX) / zoom,
      y: (ev.clientY - rect.top - verschuifY) / zoom,
    });
    const start = naarFlow(e);
    // Dichtstbijzijnde (grijpbare) segment: mini-hoekjes overslaan.
    let beste = -1;
    let besteAfstand = Infinity;
    for (let i = 0; i < basisPts.length - 1; i += 1) {
      const a = basisPts[i];
      const b = basisPts[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 14) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((start.x - a.x) * dx + (start.y - a.y) * dy) / l2));
      const afstand = Math.hypot(start.x - (a.x + t * dx), start.y - (a.y + t * dy));
      if (afstand < besteAfstand) {
        besteAfstand = afstand;
        beste = i;
      }
    }
    if (beste < 0) return;
    const a = basisPts[beste];
    const b = basisPts[beste + 1];
    const horizontaal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    // Interieur-lijst met het gepakte segment volledig binnenin: grenst het
    // aan een uiteinde, voeg dan een hoekpunt op het uiteinde toe zodat de
    // stomp haaks blijft (EA-gedrag).
    let interieur = basisPts.slice(1, -1).map((q) => ({ ...q }));
    let ia = beste - 1; // index van punt a binnen interieur
    if (beste === 0) {
      interieur = [{ x: basisPts[0].x, y: basisPts[0].y }, ...interieur];
      ia = 0;
    }
    const ib = ia + 1;
    if (ib > interieur.length - 1) {
      interieur = [
        ...interieur,
        { x: basisPts[basisPts.length - 1].x, y: basisPts[basisPts.length - 1].y },
      ];
    }
    const doelEl = e.currentTarget;
    let begonnen = false;
    const beweeg = (ev) => {
      const nu = naarFlow(ev);
      const dx = nu.x - start.x;
      const dy = nu.y - start.y;
      if (!begonnen && Math.hypot(dx, dy) < 4) return; // klik is geen sleep
      if (!begonnen) {
        begonnen = true;
        doelEl.setPointerCapture?.(ev.pointerId);
      }
      const volgende = interieur.map((q, i) =>
        i === ia || i === ib
          ? horizontaal
            ? { x: q.x, y: q.y + dy }
            : { x: q.x + dx, y: q.y }
          : q
      );
      setSleepSegment({ interieur: volgende });
    };
    const klaar = (ev) => {
      doelEl.removeEventListener("pointermove", beweeg);
      doelEl.removeEventListener("pointerup", klaar);
      if (!begonnen) return;
      const nu = naarFlow(ev);
      const dx = nu.x - start.x;
      const dy = nu.y - start.y;
      const eind = interieur.map((q, i) =>
        i === ia || i === ib
          ? horizontaal
            ? { x: Math.round(q.x), y: Math.round(q.y + dy) }
            : { x: Math.round(q.x + dx), y: Math.round(q.y) }
          : { x: Math.round(q.x), y: Math.round(q.y) }
      );
      setSleepSegment(null);
      netGesleeptRef.current = true;
      data.onKnikken(eind);
    };
    doelEl.addEventListener("pointermove", beweeg);
    doelEl.addEventListener("pointerup", klaar);
  };
  const klikVoegKnik = (e) => {
    if (!magKnikken || !e.ctrlKey || e.button !== 0) return;
    e.stopPropagation();
    const rect = vlak?.getBoundingClientRect?.();
    if (!rect) return;
    const punt = {
      x: Math.round((e.clientX - rect.left - verschuifX) / zoom),
      y: Math.round((e.clientY - rect.top - verschuifY) / zoom),
    };
    // Invoegen op het dichtstbijzijnde segment, zodat de polylijn zijn
    // volgorde houdt.
    const pts = [{ x: sourceX, y: sourceY }, ...(knikkenBasis || []), { x: targetX, y: targetY }];
    const afstandTot = (a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((punt.x - a.x) * dx + (punt.y - a.y) * dy) / l2));
      return Math.hypot(punt.x - (a.x + t * dx), punt.y - (a.y + t * dy));
    };
    let beste = 0;
    let besteAfstand = Infinity;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const d = afstandTot(pts[i], pts[i + 1]);
      if (d < besteAfstand) {
        besteAfstand = d;
        beste = i;
      }
    }
    const nieuw = [...(knikkenBasis || [])];
    nieuw.splice(beste, 0, punt);
    data.onKnikken(nieuw);
  };
  const startKnikSleep = (e, index) => {
    if (!magKnikken || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const doelEl = e.currentTarget;
    doelEl.setPointerCapture?.(e.pointerId);
    const basis = knikkenBasis[index];
    const startX = e.clientX;
    const startY = e.clientY;
    let laatste = { ...basis };
    const beweeg = (ev) => {
      laatste = { x: basis.x + (ev.clientX - startX) / zoom, y: basis.y + (ev.clientY - startY) / zoom };
      setSleepKnik({ index, ...laatste });
    };
    const klaar = () => {
      doelEl.removeEventListener("pointermove", beweeg);
      doelEl.removeEventListener("pointerup", klaar);
      setSleepKnik(null);
      data.onKnikken(
        knikkenBasis.map((k, i) => (i === index ? { x: Math.round(laatste.x), y: Math.round(laatste.y) } : k))
      );
    };
    doelEl.addEventListener("pointermove", beweeg);
    doelEl.addEventListener("pointerup", klaar);
  };

  // Compositie- (◆, gevuld) of aggregatie-ruit (◇, open): de hoekpunten
  // liggen óp het pad zelf (punt-op-lengte 0, ½L en L, dwarsas loodrecht op
  // de raaklijn in het midden), zodat de ruit met de kromming van de curve
  // meebuigt — onder elke hoek.
  const heeftRuit = p.markerStart === "ruit" || p.markerStart === "ruit-open";
  // Open ruit: gevuld met de canvaskleur (--dc-marker-vulling, tokens v2) —
  // net als de generalisatie-driehoek. Zo blijft ◇ ook in het donkere thema
  // duidelijk te onderscheiden van de gevulde compositie-ruit ◆.
  const ruitVulling = p.markerStart === "ruit-open" ? "var(--dc-marker-vulling, #ffffff)" : kleur;
  const meetRef = useRef(null);
  const [ruitPunten, setRuitPunten] = useState(null);
  useLayoutEffect(() => {
    if (!heeftRuit) return;
    const pad = meetRef.current;
    if (!pad) return;
    try {
      const totaal = pad.getTotalLength();
      const L = Math.min(RUIT_LENGTE, Math.max(8, totaal - 2));
      const p0 = pad.getPointAtLength(0);
      const pm = pad.getPointAtLength(L / 2);
      const p1 = pad.getPointAtLength(L);
      // Normaal op de raaklijn in het midden van de ruit
      const ta = pad.getPointAtLength(Math.max(L / 2 - 1, 0));
      const tb = pad.getPointAtLength(Math.min(L / 2 + 1, totaal));
      let nx = -(tb.y - ta.y);
      let ny = tb.x - ta.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx = (nx / nl) * (RUIT_BREEDTE / 2);
      ny = (ny / nl) * (RUIT_BREEDTE / 2);
      setRuitPunten(
        `${p0.x},${p0.y} ${pm.x + nx},${pm.y + ny} ${p1.x},${p1.y} ${pm.x - nx},${pm.y - ny}`
      );
    } catch {
      setRuitPunten(null);
    }
  }, [heeftRuit, edgePath]);
  // Fallback (eerste render, vóór de meting): richting van de handle-zijde.
  const fallbackHoek = { right: 0, left: 180, top: -90, bottom: 90 }[sourcePosition] ?? 0;

  // Labelposities: 70% richting doel resp. bron (zelfde heuristiek als de
  // umleditor-edge, voor visuele pariteit).
  const posities = {
    midden: { x: labelX, y: labelY },
    doel: { x: labelX + (targetX - labelX) * 0.7, y: labelY + (targetY - labelY) * 0.7 },
    bron: { x: labelX + (sourceX - labelX) * 0.7, y: labelY + (sourceY - labelY) * 0.7 },
  };

  return (
    <>
      <defs>
        {p.markerEnd === "pijl-open" && (
          <marker id={pijlId} markerWidth="12" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M 1 2 L 9 5 L 1 8" fill="none" stroke={kleur} strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        )}
        {p.markerEnd === "driehoek" && (
          <marker id={driehoekId} markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="strokeWidth">
            <path d="M 1 1 L 13 7 L 1 13 Z" fill="var(--dc-marker-vulling, #ffffff)" stroke={kleur} strokeWidth="1.2" />
          </marker>
        )}
        {p.markerEnd === "pijl-dicht" && (
          <marker id={pijlDichtId} markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
            <path d="M 1 1.5 L 10.5 6 L 1 10.5 Z" fill={kleur} stroke="none" />
          </marker>
        )}
        {p.markerEnd === "bol" && (
          <marker id={bolId} markerWidth="10" markerHeight="10" refX="7.6" refY="5" orient="auto" markerUnits="strokeWidth">
            <circle cx="5" cy="5" r="3" fill={kleur} />
          </marker>
        )}
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={
          p.markerEnd === "pijl-open" ? `url(#${pijlId})`
          : p.markerEnd === "driehoek" ? `url(#${driehoekId})`
          : p.markerEnd === "pijl-dicht" ? `url(#${pijlDichtId})`
          : p.markerEnd === "bol" ? `url(#${bolId})`
          : undefined
        }
        style={{
          stroke: kleur,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: DASHES[p.lijn] || undefined,
          strokeLinejoin: "round",
          opacity: p.opacity,
        }}
      />

      {heeftRuit && (
        <>
          {/* Onzichtbaar meetpad voor de curve-geometrie */}
          <path ref={meetRef} d={edgePath} fill="none" stroke="none" style={{ pointerEvents: "none" }} />
          {ruitPunten ? (
            <polygon points={ruitPunten} fill={ruitVulling} stroke={kleur} strokeWidth="1.2" strokeLinejoin="round" />
          ) : (
            <g transform={`translate(${sourceX} ${sourceY}) rotate(${fallbackHoek})`}>
              <polygon
                points={`0,0 ${RUIT_LENGTE / 2},${-RUIT_BREEDTE / 2} ${RUIT_LENGTE},0 ${RUIT_LENGTE / 2},${RUIT_BREEDTE / 2}`}
                fill={ruitVulling}
                stroke={kleur}
                strokeWidth="1.2"
              />
            </g>
          )}
        </>
      )}

      {(() => {
        // Meerdere labels op dezelfde zijde (bv. kardinaliteit + {ordered})
        // zouden exact stapelen; zonder eigen offset schuiven volgende
        // labels 18px omlaag zodat ze naast elkaar leesbaar blijven.
        const stapel = {};
        return (p.labels || []).map((label, i) => {
        const basis = posities[label.zijde] || posities.midden;
        const zijdeKey = label.zijde || "midden";
        const stapelIdx = (stapel[zijdeKey] = (stapel[zijdeKey] ?? -1) + 1);
        // Stapeling komt bóvenop een (gesleepte) offset: offsets gelden per
        // zijde en zijn dus voor alle labels op die zijde gelijk — zonder
        // stapel-bijdrage vielen ze na één keer slepen weer samen.
        const basisOff = sleep?.index === i ? sleep : label.offset || { x: 0, y: 0 };
        const off = { x: basisOff.x || 0, y: (basisOff.y || 0) + stapelIdx * 18 };
        const alleenNaam = label.delen?.length === 1 && label.delen[0].soort === "naam";
        return (
          <EdgeLabelRenderer key={i}>
            <div
              className={alleenNaam ? undefined : "dc-edge-label"}
              onPointerDown={(e) => startLabelSleep(e, i, label)}
              title={magSlepen ? "Sleep om het label te verplaatsen" : undefined}
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${basis.x + (off.x || 0)}px, ${basis.y + (off.y || 0)}px)`,
                pointerEvents: "all",
                userSelect: "none",
                cursor: magSlepen ? "move" : undefined,
              }}
            >
              {label.delen.map((deel, j) => (
                <span key={j} className={SOORT_KLASSE[deel.soort] || undefined} style={deel.kleur ? { color: deel.kleur } : undefined}>
                  {deel.tekst}
                </span>
              ))}
            </div>
          </EdgeLabelRenderer>
        );
        });
      })()}

      {/* Breed onzichtbaar klikpad voor ctrl-klik (knikpunt toevoegen);
          zonder ctrl bubbelt de klik door naar de gewone edge-selectie. */}
      {magKnikken && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={18}
          onPointerDown={startSegmentSleep}
          onClick={(e) => {
            if (netGesleeptRef.current) {
              // Na een segment-sleep geen selectie-klik laten doorbubbelen.
              netGesleeptRef.current = false;
              e.stopPropagation();
              return;
            }
            klikVoegKnik(e);
          }}
          style={{ pointerEvents: "stroke", cursor: "default" }}
        />
      )}
      {magKnikken && knikken && selected && (
        <EdgeLabelRenderer>
          {knikken.map((k, i) => (
            <div
              key={i}
              className="dc-knik"
              title="Sleep om de knik te verplaatsen; dubbelklik om hem te wissen"
              onPointerDown={(e) => startKnikSleep(e, i)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                data.onKnikken(knikkenBasis.filter((_, j) => j !== i));
              }}
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${k.x}px, ${k.y}px)`,
                pointerEvents: "all",
              }}
            />
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** Ruit-maat: lange as langs de lijn, dunne as dwars erop. */
const RUIT_LENGTE = 22;
const RUIT_BREEDTE = 16;

export default ConnectorEdge;
