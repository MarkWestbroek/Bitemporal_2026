/**
 * studioInstellingenActivity — "Studio-instellingen": globale, profiel-
 * overstijgende instellingen (het Style-domein leeft globaal, niet per
 * profiel). Twee onderdelen:
 *
 *   1. Galerij (read-only): de gedeelde shape- en icoon-registry's, elk met
 *      live preview — dezelfde shapes/icons die álle profielen gebruiken.
 *   2. Eigen vormen: een editor voor **data-shapes** (vorm als data), die
 *      git-persistent zijn en overal bruikbaar worden (galerij, PE-kiezers,
 *      shape-sets) — zonder code te schrijven.
 */
import { useEffect, useRef, useState } from "react";
import { IconInstellingen } from "../icons";
// Side-effect: registreert alle basis-shapes én de data-shapes in de registry,
// zodat de galerij de volledige registry toont ook zonder geopende canvas.
import "../../diagramcore/shapes/basisShapes.jsx";
import { alleShapeIds, getShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { alleIcoonIds, TypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";
import { maakDataShapeComponent } from "../../diagramcore/shapes/dataShape.jsx";
import { leesVormen, bewaarVorm, verwijderVorm } from "./vormenRegistratie.js";
import { maakDataIcoonComponent } from "../../diagramcore/shapes/dataIcoon.jsx";
import { leesIconen, bewaarIcoon, verwijderIcoon } from "./iconenRegistratie.js";
import SilhouetTekenaar, { polygonNaarPunten, puntenNaarPad } from "./silhouetTekenaar.jsx";
import { extraheerSilhouet } from "./silhouetExtractie.js";

const METHOD_DRAW_URL = `${import.meta.env.BASE_URL}method-draw/index.html`;

const kaartStijl = {
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 8,
  background: "var(--s-panel, #fff)",
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignItems: "center",
};

/** Preview-box: rendert een shape-component op ware grootte, geschaald. */
function ShapePreviewBox({ Shape, naam = "Aa", kleur, schaal = 1 }) {
  const element = { naam, data: {}, compartimenten: [] };
  const elementType = { kleur: kleur || "#e2e8f0", compartments: [] };
  return (
    <div style={{ width: 150 * schaal, height: 74 * schaal, overflow: "hidden", position: "relative", pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 150, height: 74, transform: `scale(${schaal})`, transformOrigin: "top left" }}>
        {Shape ? (
          <Shape element={element} elementType={elementType} selected={false} fieldTypesById={{}} compartmentTypesById={{}} />
        ) : (
          <span style={{ color: "var(--s-fg-muted)" }}>—</span>
        )}
      </div>
    </div>
  );
}

const invoer = {
  font: "inherit",
  fontSize: 12,
  padding: "3px 6px",
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 6,
  background: "var(--s-panel, #fff)",
  color: "var(--s-fg, #1e293b)",
};
const GRONDVORMEN = ["rechthoek", "afgerond", "stadium", "chip", "zeshoek", "afgeknipt"];

// Leeg canvas om Method Draw mee te openen (voorkomt dat een oude tekening uit
// MD's eigen localStorage blijft staan bij een nieuwe/lege vorm of icoon).
const LEEG_LAAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="320" viewBox="0 0 420 320"></svg>';

/**
 * Normaliseer een laad-SVG voor Method Draw: schaal de inhoud naar een werkbare
 * canvasmaat (~420px) via een `<g transform>`, zodat width/height én viewBox
 * consistent blijven (MD weigert een width/height die niet met de viewBox
 * klopt) en een klein icoon (bv. viewBox 0 0 24 24) niet als spikkeltje buiten
 * beeld belandt. De inhoud wordt niet herschreven, alleen geschaald/verschoven.
 */
function normaliseerLaadSvg(svgString, doelMax = 420) {
  try {
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg || doc.querySelector("parsererror")) return svgString;
    let w = parseFloat(svg.getAttribute("width"));
    let h = parseFloat(svg.getAttribute("height"));
    let vbx = 0;
    let vby = 0;
    const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if (vb.length === 4) {
      vbx = vb[0];
      vby = vb[1];
      if (!w || !h) {
        w = vb[2];
        h = vb[3];
      }
    }
    if (!w || !h) {
      w = 100;
      h = 100;
    }
    const S = doelMax / Math.max(w, h);
    const W = Math.round(w * S);
    const H = Math.round(h * S);
    const inner = [...svg.childNodes].map((n) => (n.nodeType === 1 ? new XMLSerializer().serializeToString(n) : "")).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g transform="scale(${S}) translate(${-vbx} ${-vby})">${inner}</g></svg>`;
  } catch {
    return svgString;
  }
}

/** {inner, box} → volledige SVG-string om terug in Method Draw te laden. */
function silhouetNaarSvg(sil) {
  if (!sil?.inner || !Array.isArray(sil.box)) return null;
  const [x, y, w, h] = sil.box;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${sil.inner}</svg>`;
}

/** CSS polygon-clip (%) → SVG-pad op een 100×100-box, om in Method Draw te bewerken. */
function polygonClipNaarSvg(clipPath) {
  const pts = polygonNaarPunten(clipPath);
  if (pts.length < 3) return null;
  const d = "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="${d}" fill="black"/></svg>`;
}

/**
 * MethodDrawModal — ruime modal met de gevendorde Method Draw SVG-editor in een
 * iframe. Generiek: `startSvg` wordt bij openen in de editor geladen, en
 * "Gebruik" levert de rauwe SVG-string (`svgCanvas.getSvgString()`) aan de
 * aanroeper, die er zelf een silhouet of icoon van maakt.
 */
function MethodDrawModal({ startSvg, onGebruik, onSluiten, titel = "Tekenen — Method Draw", knopLabel = "Gebruik" }) {
  const iframeRef = useRef(null);
  const [klaar, setKlaar] = useState(false);

  // Escape sluit; achtergrond-scroll blokkeren zolang de modal open is.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onSluiten();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSluiten]);

  // Wacht tot Method Draw's svgCanvas beschikbaar is (scripts laden async) en
  // laad dan de meegegeven tekening (silhouet/polygon/icoon) terug in de editor.
  const bijLaden = () => {
    let pogingen = 0;
    const tik = () => {
      const win = iframeRef.current?.contentWindow;
      if (win && win.svgCanvas) {
        setKlaar(true);
        // Altijd zetten (ook leeg), zodat MD's eigen localStorage-herstel niet
        // een vorige tekening laat staan.
        try {
          win.svgCanvas.setSvgString(startSvg ? normaliseerLaadSvg(startSvg) : LEEG_LAAD_SVG);
        } catch {
          /* niet fataal: begin dan met leeg canvas */
        }
      } else if (pogingen++ < 40) {
        setTimeout(tik, 100);
      }
    };
    tik();
  };

  const gebruik = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !win.svgCanvas) return;
    onGebruik(win.svgCanvas.getSvgString());
  };

  return (
    <div
      onClick={onSluiten}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", flexDirection: "column", padding: "2.5vh 2.5vw" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--s-panel, #fff)", borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--s-border, #e2e8f0)" }}>
          <strong style={{ fontSize: 13 }}>{titel}</strong>
          <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>{klaar ? "" : "editor laadt…"}</span>
          <button className="dc-mini-knop" style={{ marginLeft: "auto" }} onClick={gebruik} disabled={!klaar}>{knopLabel}</button>
          <button className="dc-mini-knop" onClick={onSluiten} title="Sluit zonder de tekening toe te passen">Annuleren</button>
        </div>
        <iframe
          ref={iframeRef}
          src={METHOD_DRAW_URL}
          title="Method Draw"
          onLoad={bijLaden}
          style={{ border: 0, flex: 1, width: "100%", background: "#fff" }}
        />
      </div>
    </div>
  );
}

/** Editor voor één data-shape-concept (live preview + opslaan/verwijderen). */
function VormEditor({ start, onOpslaan, onVerwijderen, onSluiten }) {
  const [def, setDef] = useState(start);
  const [teken, setTeken] = useState(!!(start.silhouet?.punten || start.clipPath));
  const [mdOpen, setMdOpen] = useState(false);
  const zet = (patch) => setDef((d) => ({ ...d, ...patch }));
  const Preview = maakDataShapeComponent(def);
  const heeftSilhouet = !!def.silhouet?.inner;
  const rij = (label, node) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ width: 120, color: "var(--s-fg-muted, #64748b)" }}>{label}</span>
      {node}
    </label>
  );
  return (
    <div style={{ ...kaartStijl, alignItems: "stretch", gap: 10, maxWidth: 520 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {rij("naam", <input style={{ ...invoer, flex: 1 }} value={def.label || ""} onChange={(e) => zet({ label: e.target.value })} />)}
          {rij(
            "grondvorm",
            <select style={{ ...invoer, flex: 1 }} value={def.grondvorm || "rechthoek"} onChange={(e) => zet({ grondvorm: e.target.value })}>
              {GRONDVORMEN.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
          {rij("hoekradius", <input type="number" style={{ ...invoer, width: 80 }} value={def.hoekRadius ?? ""} placeholder="auto" onChange={(e) => zet({ hoekRadius: e.target.value === "" ? undefined : Number(e.target.value) })} />)}
          {rij(
            "rand",
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select style={invoer} value={def.randStijl || "solid"} onChange={(e) => zet({ randStijl: e.target.value })}>
                <option value="solid">doorgetrokken</option>
                <option value="dashed">gestippeld</option>
              </select>
              <input type="number" style={{ ...invoer, width: 56 }} value={def.randDikte ?? 2} onChange={(e) => zet({ randDikte: Number(e.target.value) || 0 })} title="dikte (px)" />
            </span>
          )}
          {rij("vulling", <input type="color" value={def.vulling || "#e2e8f0"} onChange={(e) => zet({ vulling: e.target.value })} style={{ width: 40, height: 24, padding: 0, border: "1px solid var(--s-border)", borderRadius: 6, cursor: "pointer" }} />)}
          {rij("clip-path", <input style={{ ...invoer, flex: 1, fontFamily: "monospace", fontSize: 11 }} value={def.clipPath || ""} placeholder="(eigen polygon/path — wint van grondvorm)" onChange={(e) => zet({ clipPath: e.target.value || undefined })} />)}
          {rij(
            "silhouet",
            <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button className="dc-mini-knop" onClick={() => setTeken((v) => !v)}>{teken ? "verberg tekenaar" : "✏ tekenaar"}</button>
              <button className="dc-mini-knop" onClick={() => setMdOpen(true)} title="Vrij tekenen met béziers in Method Draw">✎ Method Draw</button>
              {heeftSilhouet && (
                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--s-accent, #6366f1)" }}>● silhouet</span>
                  <select
                    style={{ ...invoer, fontSize: 11 }}
                    title="Verhouding behouden (gecentreerd) of uitrekken tot de node-box"
                    value={def.silhouet.passen === false ? "vullen" : "passen"}
                    onChange={(e) => zet({ silhouet: { ...def.silhouet, passen: e.target.value === "passen" } })}
                  >
                    <option value="passen">verhouding behouden</option>
                    <option value="vullen">uitrekken (vullen)</option>
                  </select>
                  <button className="dc-mini-knop is-gevaar" title="Silhouet wissen" onClick={() => zet({ silhouet: undefined })}>×</button>
                </span>
              )}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>preview</span>
          <ShapePreviewBox Shape={Preview} naam={def.label || def.id} kleur={def.vulling} />
          <code style={{ fontSize: 10, color: "var(--s-fg-muted, #64748b)" }}>{def.id}</code>
        </div>
      </div>
      {teken && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 4, borderTop: "1px solid var(--s-border, #e2e8f0)" }}>
          <SilhouetTekenaar
            initieel={def.silhouet?.punten || polygonNaarPunten(def.clipPath)}
            onChange={(pts) => {
              const pad = puntenNaarPad(pts);
              // Tekenaar-silhouet vult standaard de node-box (passen:false), net als
              // de oude polygon-clip; bestaande vullen/passen-keuze blijft behouden.
              zet({
                silhouet: pad
                  ? { inner: `<path d="${pad}"/>`, box: [0, 0, 100, 100], passen: def.silhouet?.passen ?? false, punten: pts }
                  : undefined,
                clipPath: undefined,
              });
            }}
          />
          <p style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", maxWidth: 200, margin: 0 }}>
            Teken de omtrek op de 0–100-box. <strong>Klik een punt</strong> om het rond of
            hoekig te maken (krommen). Het resultaat wordt het silhouet en wint van de
            grondvorm. Minstens 3 punten voor een vlak.
          </p>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="dc-mini-knop" onClick={() => onOpslaan(def)}>Opslaan</button>
        <button className="dc-mini-knop" onClick={onSluiten}>Annuleren</button>
        {onVerwijderen && (
          <button className="dc-mini-knop is-gevaar" style={{ marginLeft: "auto" }} onClick={onVerwijderen}>Verwijderen</button>
        )}
      </div>
      {mdOpen && (
        <MethodDrawModal
          titel="Silhouet tekenen — Method Draw"
          knopLabel="Gebruik als silhouet"
          startSvg={silhouetNaarSvg(def.silhouet) || polygonClipNaarSvg(def.clipPath)}
          onGebruik={(svgString) => {
            const sil = extraheerSilhouet(svgString);
            if (!sil) {
              alert("Geen tekenbare vorm op het canvas gevonden. Teken eerst een vorm (pad, rechthoek, cirkel …).");
              return;
            }
            // behoud de bestaande vullen/passen-keuze bij het opnieuw tekenen
            zet({ silhouet: { ...sil, passen: def.silhouet?.passen } });
            setMdOpen(false);
          }}
          onSluiten={() => setMdOpen(false)}
        />
      )}
    </div>
  );
}

/** Import-/bewerk-editor voor één data-icoon (SVG plakken of een .svg-bestand). */
function IcoonEditor({ start, onOpslaan, onVerwijderen, onSluiten }) {
  const [def, setDef] = useState(start);
  const [mdOpen, setMdOpen] = useState(false);
  const zet = (patch) => setDef((d) => ({ ...d, ...patch }));
  const Preview = def.svg ? maakDataIcoonComponent(def) : null;
  const kiesBestand = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((tekst) => {
      const naam = file.name.replace(/\.svg$/i, "");
      zet({ svg: tekst, label: def.label || naam });
    });
  };
  return (
    <div style={{ ...kaartStijl, alignItems: "stretch", gap: 10, maxWidth: 560 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 90, color: "var(--s-fg-muted, #64748b)" }}>naam</span>
            <input style={{ ...invoer, flex: 1 }} value={def.label || ""} onChange={(e) => zet({ label: e.target.value })} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 90, color: "var(--s-fg-muted, #64748b)" }}>bestand</span>
            <input type="file" accept=".svg,image/svg+xml" onChange={kiesBestand} style={{ fontSize: 11 }} />
            <button className="dc-mini-knop" onClick={() => setMdOpen(true)} title="Teken/bewerk dit icoon in Method Draw">✎ Method Draw</button>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 90, color: "var(--s-fg-muted, #64748b)" }}>volg tekstkleur</span>
            <input type="checkbox" checked={!!def.monochroom} onChange={(e) => zet({ monochroom: e.target.checked })} title="currentColor" />
            <span style={{ color: "var(--s-fg-muted, #64748b)" }}>(monochroom / currentColor)</span>
          </label>
          <textarea
            rows={5}
            style={{ ...invoer, fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
            placeholder="<svg viewBox=…>…</svg> — plak hier je SVG"
            value={def.svg || ""}
            onChange={(e) => zet({ svg: e.target.value })}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>preview</span>
          <span style={{ color: "var(--s-fg)" }}>{Preview ? <Preview maat={40} /> : <span style={{ color: "var(--s-fg-muted)" }}>—</span>}</span>
          <code style={{ fontSize: 10, color: "var(--s-fg-muted, #64748b)" }}>{def.id}</code>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="dc-mini-knop" disabled={!def.svg} onClick={() => onOpslaan(def)}>Opslaan</button>
        <button className="dc-mini-knop" onClick={onSluiten}>Annuleren</button>
        {onVerwijderen && <button className="dc-mini-knop is-gevaar" style={{ marginLeft: "auto" }} onClick={onVerwijderen}>Verwijderen</button>}
      </div>
      {mdOpen && (
        <MethodDrawModal
          titel="Icoon tekenen — Method Draw"
          knopLabel="Gebruik als icoon"
          startSvg={def.svg || null}
          onGebruik={(svgString) => {
            zet({ svg: svgString });
            setMdOpen(false);
          }}
          onSluiten={() => setMdOpen(false)}
        />
      )}
    </div>
  );
}

function Main() {
  const [versie, setVersie] = useState(0);
  const [bewerk, setBewerk] = useState(null); // data-shape-concept in bewerking, of null
  const [icoonBewerk, setIcoonBewerk] = useState(null); // data-icoon-concept, of null
  const ververs = () => setVersie((v) => v + 1);

  const eigenVormen = leesVormen();
  const eigenIds = new Set(Object.keys(eigenVormen));
  const shapeIds = alleShapeIds().filter((id) => id !== "anker");
  const icoonIds = alleIcoonIds();
  const eigenIconen = leesIconen();
  const eigenIcoonIds = new Set(Object.keys(eigenIconen));

  const nieuwIcoon = () => {
    const naam = window.prompt("Naam van het nieuwe icoon:", "Mijn icoon");
    if (!naam) return;
    const id = naam.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "icoon";
    setIcoonBewerk({ id, label: naam, monochroom: true, svg: "" });
  };
  const opslaanIcoon = (def) => {
    bewaarIcoon(def);
    setIcoonBewerk(null);
    ververs();
  };
  const verwijderenIcoon = (def) => {
    if (!window.confirm(`Icoon "${def.label || def.id}" verwijderen?`)) return;
    verwijderIcoon(def.id);
    setIcoonBewerk(null);
    ververs();
  };

  const nieuweVorm = () => {
    const naam = window.prompt("Naam van de nieuwe vorm:", "Mijn vorm");
    if (!naam) return;
    const id = naam.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "vorm";
    setBewerk({ id, label: naam, grondvorm: "afgerond", randDikte: 2, vulling: "#e2e8f0" });
  };
  const opslaan = (def) => {
    bewaarVorm(def);
    setBewerk(null);
    ververs();
  };
  const verwijderen = (def) => {
    if (!window.confirm(`Vorm "${def.label || def.id}" verwijderen?`)) return;
    verwijderVorm(def.id);
    setBewerk(null);
    ververs();
  };

  const sectie = { padding: "12px 16px" };
  const grid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 10, marginTop: 8 });

  return (
    <div style={{ height: "100%", overflow: "auto", color: "var(--s-fg)" }}>
      <div style={{ padding: "12px 16px 0" }}>
        <h2 style={{ margin: "0 0 2px" }}>Vormen &amp; iconen</h2>
        <p style={{ margin: 0, color: "var(--s-fg-muted, #64748b)", fontSize: 13 }}>
          De gedeelde registry's — dezelfde shapes en iconen die álle profielen gebruiken.
        </p>
      </div>

      {/* Eigen vormen (data-shapes): maken/bewerken. */}
      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)", display: "flex", alignItems: "center", gap: 10 }}>
          Eigen vormen ({eigenIds.size})
          <button className="dc-mini-knop" onClick={nieuweVorm}>＋ nieuwe vorm</button>
        </h3>
        {bewerk && (
          <div style={{ marginTop: 8 }}>
            <VormEditor
              key={bewerk.id}
              start={bewerk}
              onOpslaan={opslaan}
              onVerwijderen={eigenIds.has(bewerk.id) ? () => verwijderen(bewerk) : null}
              onSluiten={() => setBewerk(null)}
            />
          </div>
        )}
        {eigenIds.size > 0 && (
          <div style={grid(170)}>
            {Object.values(eigenVormen).map((def) => (
              <div key={def.id} style={{ ...kaartStijl, cursor: "pointer" }} onClick={() => setBewerk(def)} title="Klik om te bewerken">
                <ShapePreviewBox Shape={getShape(def.id)} naam={def.label} kleur={def.vulling} />
                <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>{def.id} ✎</code>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)" }}>Ingebouwde shapes ({shapeIds.length})</h3>
        <div style={grid(170)}>
          {shapeIds.map((id) => (
            <div key={id} style={kaartStijl}>
              <ShapePreviewBox Shape={getShape(id)} naam={id} />
              <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>{id}{eigenIds.has(id) ? " (eigen)" : ""}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Eigen iconen (data-iconen): SVG importeren/plakken. */}
      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)", display: "flex", alignItems: "center", gap: 10 }}>
          Eigen iconen ({eigenIcoonIds.size})
          <button className="dc-mini-knop" onClick={nieuwIcoon}>＋ nieuw icoon</button>
        </h3>
        {icoonBewerk && (
          <div style={{ marginTop: 8 }}>
            <IcoonEditor
              key={icoonBewerk.id}
              start={icoonBewerk}
              onOpslaan={opslaanIcoon}
              onVerwijderen={eigenIcoonIds.has(icoonBewerk.id) ? () => verwijderenIcoon(icoonBewerk) : null}
              onSluiten={() => setIcoonBewerk(null)}
            />
          </div>
        )}
        {eigenIcoonIds.size > 0 && (
          <div style={grid(96)}>
            {Object.values(eigenIconen).map((def) => (
              <div key={def.id} style={{ ...kaartStijl, padding: "10px 6px", cursor: "pointer" }} onClick={() => setIcoonBewerk(def)} title="Klik om te bewerken">
                <span style={{ color: "var(--s-fg)" }}>
                  <TypeIcoon elementType={{ icoon: def.id, shape: "class-box" }} maat={28} />
                </span>
                <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", textAlign: "center" }}>{def.id} ✎</code>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)" }}>Alle iconen ({icoonIds.length})</h3>
        <div style={grid(96)}>
          {icoonIds.map((id) => (
            <div key={id} style={{ ...kaartStijl, padding: "10px 6px" }}>
              <span style={{ color: "var(--s-fg)" }}>
                <TypeIcoon elementType={{ icoon: id, shape: "class-box" }} maat={28} />
              </span>
              <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", textAlign: "center" }}>{id}{eigenIcoonIds.has(id) ? " (eigen)" : ""}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default {
  id: "studio-instellingen",
  label: "Studio-instellingen",
  icon: <IconInstellingen />,
  groep: "beheer",
  fullMain: true,
  Main,
};
