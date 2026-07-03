/**
 * profielActivity — "Profiel (0.5)": de meta-editor, trede 1 (plan §8.9).
 *
 * Bewerk een profiel-descriptor (de JSON-serialiseerbare Definitie-kern) en
 * registreer hem **live** als activiteit: de motor bewerkt zijn eigen
 * configuratie. Hooks verwijzen op id naar de HOOK_CATALOGUS
 * (profielGereedschap.js) — precies het koppelvlak dat het bitemporele
 * configuratie-register (fase 7) straks nodig heeft.
 *
 * Opgeslagen profielen (localStorage "studio05-profielen") worden bij het
 * laden van de Studio opnieuw geregistreerd, zodat dynamische activiteiten
 * een herlaad overleven.
 */
import { useCallback, useContext, useState, createContext } from "react";
import { IconReferentielijst, IconDiagram } from "../icons";
import { registreerActiviteit } from "../activityRegistry";
import useStudioStore from "../useStudioStore";
import { vervangDiagramType, valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import {
  HOOK_CATALOGUS,
  vertaalHooks,
  maakGeneriekeMaakElement,
  LEEG_SJABLOON,
  GRAAF_DEMO,
} from "./profielGereedschap.js";

const OPSLAG_SLEUTEL = "studio05-profielen";

function leesProfielen() {
  try {
    return JSON.parse(localStorage.getItem(OPSLAG_SLEUTEL) || "{}") || {};
  } catch {
    return {};
  }
}

function bewaarProfielen(profielen) {
  try {
    localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(profielen));
  } catch {
    /* opslag vol — niet kritisch */
  }
}

/**
 * Registreer een descriptor-kern als DiagramType + activiteit. Retourneert
 * het activiteit-id. Gooit bij validatie-/hookfouten.
 */
function registreerProfielAlsActiviteit(kern) {
  const descriptor = vertaalHooks(kern);
  vervangDiagramType(descriptor);
  const activiteitId = `dyn-${kern.id}`;
  registreerActiviteit(
    maakDiagramActiviteit({
      id: activiteitId,
      label: kern.label || kern.id,
      icon: <IconDiagram />,
      descriptor,
      maakElement: maakGeneriekeMaakElement(descriptor),
      persistKey: `studio05-dyn-${kern.id}`,
      taakbalkSleutel: `studio05-taakbalken-dyn-${kern.id}`,
      menuPrefix: `dyn-${kern.id}`,
      menuLabel: kern.label || kern.id,
      previewTekst: `Eigen profiel "${kern.label || kern.id}" — gemaakt met de meta-editor.`,
      devHookNaam: `__dyn_${kern.id.replace(/[^a-zA-Z0-9]/g, "_")}Store`,
    })
  );
  return activiteitId;
}

// Bij het laden van de Studio: opgeslagen profielen opnieuw registreren.
for (const [id, kern] of Object.entries(leesProfielen())) {
  try {
    registreerProfielAlsActiviteit(kern);
  } catch (e) {
    console.warn(`Opgeslagen profiel "${id}" niet geregistreerd:`, e?.message || e);
  }
}

const Ctx = createContext(null);

function ProfielProvider({ children }) {
  const [profielen, setProfielen] = useState(leesProfielen);
  const [actiefId, setActiefId] = useState(() => Object.keys(leesProfielen())[0] || null);
  const [tekst, setTekst] = useState(() => {
    const eerste = Object.values(leesProfielen())[0];
    return eerste ? JSON.stringify(eerste, null, 2) : JSON.stringify(LEEG_SJABLOON, null, 2);
  });
  const [melding, setMelding] = useState(null); // {soort: "ok"|"fout", tekst}

  const kies = useCallback(
    (id) => {
      const kern = profielen[id];
      if (!kern) return;
      setActiefId(id);
      setTekst(JSON.stringify(kern, null, 2));
      setMelding(null);
    },
    [profielen]
  );

  const nieuwVanSjabloon = useCallback((sjabloon) => {
    setActiefId(null);
    setTekst(JSON.stringify(sjabloon, null, 2));
    setMelding({ soort: "ok", tekst: "Sjabloon geladen — pas aan en kies 'Opslaan & registreren'." });
  }, []);

  const verwijder = useCallback(
    (id) => {
      if (!window.confirm(`Profiel "${id}" uit de opslag verwijderen?\n(De activiteit verdwijnt na een pagina-herlaad.)`)) return;
      const volgende = { ...leesProfielen() };
      delete volgende[id];
      bewaarProfielen(volgende);
      setProfielen(volgende);
      if (actiefId === id) setActiefId(null);
    },
    [actiefId]
  );

  /** Parse + valideer; retourneert kern of zet een foutmelding. */
  const parseKern = useCallback(() => {
    let kern;
    try {
      kern = JSON.parse(tekst);
    } catch (e) {
      setMelding({ soort: "fout", tekst: `Geen geldige JSON: ${e.message}` });
      return null;
    }
    try {
      const descriptor = vertaalHooks(kern);
      const fouten = valideerDiagramType(descriptor);
      if (fouten.length) {
        setMelding({ soort: "fout", tekst: `Ongeldig profiel:\n- ${fouten.join("\n- ")}` });
        return null;
      }
    } catch (e) {
      setMelding({ soort: "fout", tekst: e.message });
      return null;
    }
    return kern;
  }, [tekst]);

  const valideer = useCallback(() => {
    const kern = parseKern();
    if (kern) setMelding({ soort: "ok", tekst: `Profiel "${kern.id}" is geldig ✓` });
  }, [parseKern]);

  const setActieveActiviteit = useStudioStore((s) => s.setActief);

  const opslaanEnRegistreer = useCallback(() => {
    const kern = parseKern();
    if (!kern) return;
    try {
      const activiteitId = registreerProfielAlsActiviteit(kern);
      // Synchroon bewaren, vóór de state-updates: setActieveActiviteit
      // unmountt deze Provider direct, waardoor een side-effect ín de
      // setState-updater nooit meer zou draaien.
      const volgende = { ...leesProfielen(), [kern.id]: kern };
      bewaarProfielen(volgende);
      setProfielen(volgende);
      setActiefId(kern.id);
      setMelding({
        soort: "ok",
        tekst: `Geregistreerd ✓ — "${kern.label || kern.id}" staat in de activity bar.`,
      });
      // Direct naar de nieuwe activiteit springen maakt het effect zichtbaar.
      setActieveActiviteit(activiteitId);
    } catch (e) {
      setMelding({ soort: "fout", tekst: e.message });
    }
  }, [parseKern, setActieveActiviteit]);

  return (
    <Ctx.Provider
      value={{
        profielen,
        actiefId,
        tekst,
        setTekst,
        melding,
        kies,
        nieuwVanSjabloon,
        verwijder,
        valideer,
        opslaanEnRegistreer,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

function ProfielSidebar() {
  const { profielen, actiefId, kies, nieuwVanSjabloon, verwijder } = useContext(Ctx);
  const lijst = Object.values(profielen);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13 }}>
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--s-border)", display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="dc-mini-knop" onClick={() => nieuwVanSjabloon(LEEG_SJABLOON)}>
          ＋ Nieuw (leeg sjabloon)
        </button>
        <button className="dc-mini-knop" onClick={() => nieuwVanSjabloon(GRAAF_DEMO)}>
          ＋ Graaf-demo (bol-shape)
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {lijst.length === 0 && (
          <p style={{ margin: 8, color: "var(--s-fg-muted)" }}>
            Nog geen eigen profielen — begin met een sjabloon.
          </p>
        )}
        {lijst.map((kern) => (
          <div
            key={kern.id}
            onClick={() => kies(kern.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              marginBottom: 2,
              borderRadius: 6,
              cursor: "pointer",
              color: "var(--s-fg)",
              background: kern.id === actiefId ? "var(--s-hover)" : "transparent",
              border: `1px solid ${kern.id === actiefId ? "var(--s-border)" : "transparent"}`,
            }}
          >
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ⚙ {kern.label || kern.id}
            </span>
            {kern.id === actiefId && (
              <button
                className="dc-mini-knop is-gevaar"
                title="Verwijderen uit opslag"
                onClick={(e) => {
                  e.stopPropagation();
                  verwijder(kern.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfielMain() {
  const { tekst, setTekst, melding, valideer, opslaanEnRegistreer } = useContext(Ctx);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="dc-preview-strook">
        <span className="dc-preview-badge">meta-editor</span>
        <span>
          Bewerk de profiel-descriptor (Definitie-kern, JSON) en registreer hem live als
          activiteit — trede 1 van plan §8.9.
        </span>
      </div>
      <div style={{ padding: "8px 10px", display: "flex", gap: 8, borderBottom: "1px solid var(--s-border)" }}>
        <button className="dc-mini-knop" onClick={valideer}>Valideer</button>
        <button className="dc-mini-knop" onClick={opslaanEnRegistreer} style={{ fontWeight: 600 }}>
          Opslaan &amp; registreren
        </button>
      </div>
      {melding && (
        <div
          style={{
            padding: "6px 10px",
            fontSize: 12,
            whiteSpace: "pre-wrap",
            color: melding.soort === "fout" ? "var(--s-danger, #dc2626)" : "var(--s-success, #16a34a)",
            borderBottom: "1px solid var(--s-border)",
          }}
        >
          {melding.tekst}
        </div>
      )}
      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          resize: "none",
          border: "none",
          outline: "none",
          padding: 12,
          font: "12px/1.5 ui-monospace, 'Cascadia Code', Consolas, monospace",
          background: "var(--s-panel, #fff)",
          color: "var(--s-fg, #1e293b)",
          tabSize: 2,
        }}
      />
    </div>
  );
}

function ProfielInspector() {
  const hookRegels = Object.entries(HOOK_CATALOGUS).flatMap(([soort, per]) =>
    Object.keys(per).map((hookId) => `${soort}: "${hookId}"`)
  );
  const blok = { margin: "0 0 10px", fontSize: 12, lineHeight: 1.5, color: "var(--s-fg-muted)" };
  return (
    <div className="studio-inspector-pad" style={{ fontSize: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>Bouwstenen</h3>
      <p style={blok}>
        <strong>Shapes:</strong> class-box, bol, note, rounded, boundary
      </p>
      <p style={blok}>
        <strong>Veld-viewers:</strong> naam-type, waarde, tekst
      </p>
      <p style={blok}>
        <strong>Property-datatypes:</strong> string, tekst, boolean, colour (+
        profiel-registraties zoals cel-expressie)
      </p>
      <p style={blok}>
        <strong>Edge-presentatie:</strong> lijn (solid/dash-6-3/dash-4-3/dash-4-4), vorm
        (bezier/hoekig/recht), markerStart (ruit/ruit-open), markerEnd (driehoek/pijl-open)
      </p>
      <p style={blok}>
        <strong>Hooks (op id, uit de catalogus):</strong>
        <br />
        {hookRegels.map((r) => (
          <span key={r}>
            · {r}
            <br />
          </span>
        ))}
      </p>
      <p style={blok}>
        Een connector is een ElementType met <code>isConnector: true</code> plus{" "}
        <code>bron</code>/<code>doel</code>-regels; geef hem compartimenten en hij
        materialiseert als associatieklasse (ASOC).
      </p>
    </div>
  );
}

export default {
  id: "profiel05",
  label: "Profiel (0.5)",
  icon: <IconReferentielijst />,
  groep: "modelleren",
  status: "preview",
  Provider: ProfielProvider,
  Sidebar: ProfielSidebar,
  Main: ProfielMain,
  Inspector: ProfielInspector,
  sidebarLabel: "Profielen",
  inspectorLabel: "Bouwstenen",
};
