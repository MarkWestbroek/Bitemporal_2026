/**
 * maakDiagramActiviteit — fabriek voor diagramcore-activiteiten (fase 5).
 *
 * Alles wat "Diagrammen (0.5)" kan (bewerkbare sandbox met eigen persistente
 * store, taakbalken, gegenereerde inspector, layout, undo/redo, contextmenu)
 * maar geparametriseerd op een DiagramType-descriptor — dé lakmoesproef van
 * het plan (§7, fase 5): een tweede profiel mag géén core- of shell-wijziging
 * vragen, alleen een tweede aanroep van deze fabriek.
 *
 * @param {Object} opties
 * @param {string} opties.id                - activiteit-id ("diagram05")
 * @param {string} opties.label             - activity-bar-label
 * @param {import("react").ReactNode} opties.icon
 * @param {Object} opties.descriptor        - DiagramType-descriptor (geregistreerd)
 * @param {(elementTypeId: string) => Object|null} opties.maakElement
 * @param {string} opties.persistKey        - localStorage-sleutel van de store
 * @param {string} opties.taakbalkSleutel   - localStorage-sleutel taakbalk-voorkeuren
 * @param {Object} [opties.taakbalkDefaults]
 * @param {string} opties.menuPrefix        - menuBus-eventprefix ("d05")
 * @param {string} opties.menuLabel         - hoofdmenu-label ("Diagram (0.5)")
 * @param {string} [opties.previewTekst]
 * @param {string} [opties.status]          - "preview" (default)
 * @param {string} [opties.devHookNaam]     - window-hook voor e2e (alleen dev)
 * @param {Object} [opties.koppeling]       - optionele model-koppeling:
 *   {herlaadUitModel?, zetTerugNaarModel?, exporteerV3?, importeerV3?,
 *    DialogenComponent?, importBestand?} — zonder koppeling start de
 *   activiteit leeg en ontbreken de bijbehorende Bestand-menu-items.
 *   importBestand = {label, accept, verwerk(tekst, bestandsnaam) → coreModel}
 *   voor profiel-eigen bestandsformaten (bv. OAS 3.1 YAML).
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { menuBus } from "../menuBus";
import useUIStore from "../../store/useUIStore";
import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import { UITLIJN_MODES } from "../../diagramcore/layout/uitlijnen.js";
import { ANKER_PREFIX } from "../../diagramcore/canvas/materialiseerConnectoren.js";
import { UITLIJN_ICONEN } from "../../diagramcore/taskbar/uitlijnIcons.jsx";
import { Taskbar, useTaakbalkVoorkeuren, leesTaakbalkVoorkeuren } from "../../diagramcore/taskbar/Taskbar.jsx";
import ElementInspector from "../../diagramcore/inspector/ElementInspector.jsx";

const DiagramCanvas = lazy(() => import("../../diagramcore/canvas/DiagramCanvas.jsx"));

const STANDAARD_TAAKBALK_DEFAULTS = {
  maken: { zichtbaar: true, positie: { x: 12, y: 12 } },
  verbinding: { zichtbaar: true, positie: { x: 12, y: 300 } },
  "auto-layout": { zichtbaar: true, positie: { x: 150, y: 12 } },
  uitlijnen: { zichtbaar: true, positie: { x: 12, y: 430 } },
};

export function maakDiagramActiviteit(opties) {
  const {
    id,
    label,
    icon,
    descriptor,
    maakElement,
    persistKey,
    taakbalkSleutel,
    taakbalkDefaults = STANDAARD_TAAKBALK_DEFAULTS,
    menuPrefix,
    menuLabel,
    previewTekst = "Bewerkbare sandbox — wijzigingen blijven lokaal.",
    status = "preview",
    devHookNaam,
    koppeling = null,
  } = opties;

  const ev = (naam) => `${menuPrefix}:${naam}`;

  const useStore = createDiagramStore({ persistKey });
  if (devHookNaam && typeof window !== "undefined" && import.meta.env && import.meta.env.DEV) {
    window[devHookNaam] = useStore;
  }

  const fieldTypesById = Object.fromEntries((descriptor.fieldTypes || []).map((ft) => [ft.id, ft]));
  const elementTypesById = Object.fromEntries(descriptor.elementTypes.map((et) => [et.id, et]));

  let _connTeller = 0;
  let _plaatsTeller = 0;

  const Ctx = createContext(null);

  function Provider({ children }) {
    const [selectieId, setSelectieId] = useState(null);
    const [verbindingsType, setVerbindingsType] = useState(null);
    // Imperatieve layout-API van de canvas (uitlijnen/snap/auto-layout/viewport).
    const layoutApiRef = useRef(null);

    /** Spiegel het gekoppelde model in de sandbox (vervangt alles). */
    const herlaad = useCallback((vraagBevestiging = true) => {
      if (!koppeling?.herlaadUitModel) return;
      const s = useStore.getState();
      const heeftInhoud = Object.keys(s.elements).length > 0;
      if (vraagBevestiging && heeftInhoud && s.isDirty) {
        const ok = window.confirm(
          "Herladen vervangt de hele sandbox door het actuele model.\nJe lokale wijzigingen gaan verloren. Doorgaan?"
        );
        if (!ok) return;
      }
      s.laadModel(koppeling.herlaadUitModel());
      useStore.temporal.getState().clear();
      setSelectieId(null);
    }, []);

    // Eerste keer: alleen laden als de (persistente) sandbox nog leeg is.
    // Daarna altijd de undo-history wissen: de persist-rehydratie telt anders
    // als eerste undo-stap, waardoor ver terug-undo'en het canvas leegmaakte.
    useEffect(() => {
      if (koppeling?.herlaadUitModel && Object.keys(useStore.getState().elements).length === 0) {
        herlaad(false);
      }
      useStore.temporal.getState().clear();
    }, [herlaad]);

    // Menubalk-acties via de menuBus.
    useEffect(() => {
      const af = [
        menuBus.on(ev("undo"), () => useStore.temporal.getState().undo()),
        menuBus.on(ev("redo"), () => useStore.temporal.getState().redo()),
        menuBus.on(ev("nieuw-diagram"), () => {
          const naam = window.prompt("Naam van het nieuwe diagram:", "Nieuw diagram");
          if (!naam) return;
          useStore.getState().addDiagram({
            id: `${menuPrefix}_${Date.now()}`,
            naam,
            diagramType: descriptor.id,
          });
        }),
      ];
      if (koppeling?.herlaadUitModel) {
        af.push(menuBus.on(ev("herlaad"), () => herlaad(true)));
      }
      // Fase 4B: terugschrijven — de sandbox vervangt het gekoppelde model.
      if (koppeling?.zetTerugNaarModel) {
        af.push(
          menuBus.on(ev("zet-terug"), () => {
            const ok = window.confirm(
              "Dit vervangt het model in de klassieke UML-activiteit door de sandbox.\n" +
                "Het oude model in die activiteit gaat verloren (de API blijft onaangeroerd). Doorgaan?"
            );
            if (!ok) return;
            const overgeslagen = koppeling.zetTerugNaarModel(useStore.getState());
            if (overgeslagen?.length) {
              window.alert(
                `Niet meegenomen (geen tegenhanger in het oude model):\n• ${overgeslagen.join("\n• ")}`
              );
            }
          })
        );
      }
      // Fase 4: V3-serialisatie (spiegel + delta) via de profiel-helpers.
      if (koppeling?.exporteerV3) {
        af.push(
          menuBus.on(ev("exporteer-v3"), () => {
            const { v3, overgeslagen } = koppeling.exporteerV3(useStore.getState());
            const naam = (v3.model?.naam || "model").toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const blob = new Blob([JSON.stringify(v3, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${naam}-v3.json`;
            a.click();
            URL.revokeObjectURL(url);
            if (overgeslagen.length) {
              window.alert(
                `Niet meegenomen in de V3-export (geen V3-tegenhanger):\n• ${overgeslagen.join("\n• ")}`
              );
            }
          })
        );
      }
      if (koppeling?.importeerV3) {
        af.push(
          menuBus.on(ev("importeer-v3"), () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json,application/json";
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              file.text().then((tekst) => {
                let v3;
                try {
                  v3 = JSON.parse(tekst);
                } catch {
                  window.alert("Dit bestand is geen geldige JSON.");
                  return;
                }
                const s = useStore.getState();
                if (Object.keys(s.elements).length > 0) {
                  const ok = window.confirm(
                    "Importeren vervangt de hele sandbox door het gekozen V3-model.\nJe lokale wijzigingen gaan verloren. Doorgaan?"
                  );
                  if (!ok) return;
                }
                try {
                  s.laadModel(koppeling.importeerV3(v3));
                } catch (e) {
                  window.alert(`Import mislukt: ${e?.message || e}`);
                  return;
                }
                useStore.temporal.getState().clear();
                setSelectieId(null);
              });
            };
            input.click();
          })
        );
      }
      // 0.5-werkbestand: het eigen formaat integraal (elements + diagrammen
      // incl. viewports + meta) — voor élk profiel beschikbaar, zodat een
      // zorgvuldig geschoven view niet in localStorage gevangen zit.
      af.push(
        menuBus.on(ev("exporteer-05"), () => {
          const s = useStore.getState();
          const diagrams = Object.fromEntries(
            Object.entries(s.diagrams).map(([did, d]) => [
              did,
              { ...d, ...(s.viewports?.[did] ? { viewport: s.viewports[did] } : {}) },
            ])
          );
          const inhoud = {
            formaat: "studio05-diagram",
            versie: 1,
            diagramType: descriptor.id,
            geexporteerd: new Date().toISOString(),
            elements: s.elements,
            diagrams,
            meta: s.meta || null,
          };
          const naam = (Object.values(s.diagrams)[0]?.naam || id)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
          const blob = new Blob([JSON.stringify(inhoud, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${naam}-05.json`;
          a.click();
          URL.revokeObjectURL(url);
        })
      );
      af.push(
        menuBus.on(ev("importeer-05"), () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".json,application/json";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            file.text().then((tekst) => {
              let inhoud;
              try {
                inhoud = JSON.parse(tekst);
              } catch {
                window.alert("Dit bestand is geen geldige JSON.");
                return;
              }
              if (inhoud?.formaat !== "studio05-diagram") {
                window.alert("Dit is geen 0.5-werkbestand (formaat-veld ontbreekt).");
                return;
              }
              if (inhoud.diagramType !== descriptor.id) {
                window.alert(
                  `Dit werkbestand hoort bij het profiel "${inhoud.diagramType}" — open het in die activiteit.`
                );
                return;
              }
              const s = useStore.getState();
              if (Object.keys(s.elements).length > 0) {
                const ok = window.confirm(
                  "Importeren vervangt de hele sandbox door het gekozen werkbestand.\nJe lokale wijzigingen gaan verloren. Doorgaan?"
                );
                if (!ok) return;
              }
              s.laadModel({
                diagramTypeId: descriptor.id,
                elements: inhoud.elements || {},
                diagrams: inhoud.diagrams || {},
                meta: inhoud.meta || null,
              });
              useStore.temporal.getState().clear();
              setSelectieId(null);
            });
          };
          input.click();
        })
      );
      // Profiel-eigen bestandsformaat (bv. OAS 3.1 YAML → coreModel).
      if (koppeling?.importBestand) {
        af.push(
          menuBus.on(ev("import-bestand"), () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = koppeling.importBestand.accept || "";
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              file.text().then((tekst) => {
                let model;
                try {
                  model = koppeling.importBestand.verwerk(tekst, file.name);
                } catch (e) {
                  window.alert(`Import mislukt: ${e?.message || e}`);
                  return;
                }
                const s = useStore.getState();
                if (Object.keys(s.elements).length > 0) {
                  const ok = window.confirm(
                    "Importeren vervangt de hele sandbox door het gekozen bestand.\nJe lokale wijzigingen gaan verloren. Doorgaan?"
                  );
                  if (!ok) return;
                }
                s.laadModel(model);
                useStore.temporal.getState().clear();
                setSelectieId(null);
              });
            };
            input.click();
          })
        );
      }
      return () => af.forEach((off) => off());
    }, [herlaad]);

    /** Nieuw element plaatsen op het actieve diagram (cascade rond het zwaartepunt). */
    const plaatsNieuwElement = useCallback((elementTypeId) => {
      const el = maakElement(elementTypeId);
      if (!el) return;
      const s = useStore.getState();
      const dId = s.actiefDiagramId;
      if (!dId) return;
      _plaatsTeller += 1;
      // Plaats in het midden van wat de gebruiker nu ziet (kleine cascade zodat
      // opeenvolgende elementen elkaar niet exact bedekken).
      const midden = layoutApiRef.current?.viewportMidden?.();
      const cascade = (_plaatsTeller % 4) * 28;
      const positie = midden
        ? { x: midden.x - 90 + cascade, y: midden.y - 50 + cascade }
        : { x: 120 + cascade, y: 120 + cascade };
      s.addElement(el);
      s.addElementToDiagram(dId, el.id, positie);
      setSelectieId(el.id);
    }, []);

    /** Nieuwe connector (edge-drag op de canvas, regels al gecheckt). */
    const verbind = useCallback(({ connectorType, source, target, sourceHandle, targetHandle }) => {
      _connTeller += 1;
      useStore.getState().addElement({
        id: `conn_${Date.now()}_${_connTeller}`,
        naam: "",
        elementType: connectorType.id,
        source,
        target,
        compartimenten: [],
        data: { sourceHandle, targetHandle },
      });
    }, []);

    const Dialogen = koppeling?.DialogenComponent || null;

    return (
      <Ctx.Provider
        value={{
          selectieId,
          setSelectieId,
          verbindingsType,
          setVerbindingsType,
          herlaad,
          heeftKoppeling: !!koppeling?.herlaadUitModel,
          plaatsNieuwElement,
          verbind,
          layoutApiRef,
        }}
      >
        {children}
        {Dialogen && <Dialogen store={useStore} onGeladen={() => setSelectieId(null)} />}
      </Ctx.Provider>
    );
  }

  function Sidebar() {
    const diagrams = useStore((s) => s.diagrams);
    const actief = useStore((s) => s.actiefDiagramId);
    const setActief = useStore((s) => s.setActiefDiagram);
    const elements = useStore((s) => s.elements);
    const { herlaad, heeftKoppeling } = useContext(Ctx);
    const lijst = Object.values(diagrams);

    const hernoem = (d) => {
      const naam = window.prompt("Nieuwe naam:", d.naam);
      if (naam) useStore.getState().renameDiagram(d.id, naam);
    };
    const verwijder = (d) => {
      if (window.confirm(`Diagram "${d.naam}" verwijderen? (Elementen blijven in het model.)`)) {
        useStore.getState().deleteDiagram(d.id);
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13 }}>
        <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--s-border)" }}>
          <button
            className="dc-mini-knop"
            style={{ width: "100%" }}
            onClick={() => menuBus.emit(ev("nieuw-diagram"))}
          >
            ＋ Nieuw diagram
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
          {lijst.length === 0 && (
            <p style={{ margin: 8, color: "var(--s-fg-muted)" }}>
              Nog geen diagrammen — maak er een met ＋{heeftKoppeling ? ", of haal het UML-model op via ⟳" : ""}.
            </p>
          )}
          {lijst.map((d) => (
            <div
              key={d.id}
              onClick={() => setActief(d.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                marginBottom: 2,
                borderRadius: 6,
                cursor: "pointer",
                color: "var(--s-fg)",
                background: d.id === actief ? "var(--s-hover)" : "transparent",
                border: `1px solid ${d.id === actief ? "var(--s-border)" : "transparent"}`,
              }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📐 {d.naam}
              </span>
              <span style={{ color: "var(--s-fg-muted)", fontSize: 11 }}>{d.nodes.length}</span>
              {d.id === actief && (
                <>
                  <button className="dc-mini-knop" title="Hernoemen" onClick={(e) => { e.stopPropagation(); hernoem(d); }}>
                    ✎
                  </button>
                  <button className="dc-mini-knop is-gevaar" title="Verwijderen" onClick={(e) => { e.stopPropagation(); verwijder(d); }}>
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderTop: "1px solid var(--s-border)",
            color: "var(--s-fg-muted)",
            fontSize: 11,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{Object.keys(elements).length} elementen</span>
          {heeftKoppeling && (
            <button
              className="dc-mini-knop"
              onClick={() => herlaad(true)}
              title="Herlaad uit UML-model (vervangt de sandbox)"
            >
              ⟳ herlaad
            </button>
          )}
        </div>
      </div>
    );
  }

  /** Vers uit localStorage, zodat menu-checkmarks kloppen bij elke menu-opbouw. */
  const taakbalkZichtbaar = (balkId) =>
    leesTaakbalkVoorkeuren(taakbalkSleutel, taakbalkDefaults)[balkId]?.zichtbaar ?? true;

  function Main() {
    const { selectieId, setSelectieId, verbindingsType, setVerbindingsType, plaatsNieuwElement, verbind, layoutApiRef } =
      useContext(Ctx);
    const theme = useUIStore((s) => s.theme);

    // Spiegel het studio-thema naar body[data-ide-theme] zolang deze activiteit
    // actief is: hergebruikte umleditor-componenten (o.a. de CEL-ExpressieEditor)
    // hebben hun licht-thema-overrides op dat attribuut.
    useEffect(() => {
      document.body.setAttribute("data-ide-theme", theme);
    }, [theme]);
    const elements = useStore((s) => s.elements);
    const diagrams = useStore((s) => s.diagrams);
    const viewports = useStore((s) => s.viewports);
    const actief = useStore((s) => s.actiefDiagramId);
    const isDirty = useStore((s) => s.isDirty);
    // Fallback: na undo van "nieuw diagram" kan het actieve id verdwenen zijn.
    const diagram = (actief && diagrams[actief]) || Object.values(diagrams)[0] || null;

    const { voorkeuren, zetZichtbaar, zetPositie, zetBreedte } = useTaakbalkVoorkeuren(
      taakbalkSleutel,
      taakbalkDefaults
    );

    // Menubalk → layout-acties.
    useEffect(() => {
      const af = [
        menuBus.on(ev("layout"), (mode) => {
          if (mode === "snap") layoutApiRef.current?.snapRaster();
          else layoutApiRef.current?.lijnUit(mode);
        }),
        menuBus.on(ev("auto-layout"), ({ id: stratId, selectie } = {}) => {
          const strategie = (descriptor.layouts || []).find(
            (l) => l.id === (stratId || descriptor.layouts?.[0]?.id)
          );
          if (strategie) layoutApiRef.current?.voerLayoutUit(strategie, !!selectie);
        }),
        menuBus.on(ev("normaliseer"), (connectorIds = null) => {
          // Normaliseren = kortste weg: wis expliciete handles op de
          // connector(en) én de anker-positie(s).
          const s = useStore.getState();
          if (!s.actiefDiagramId) return;
          const doelwit =
            connectorIds ||
            Object.values(s.elements)
              .filter((el) => el.source && el.target && elementTypesById[el.elementType]?.isConnector)
              .map((el) => el.id);
          for (const cid of doelwit) {
            s.updateElement(cid, { data: { sourceHandle: null, targetHandle: null } });
          }
          s.resetAnkerPositions(s.actiefDiagramId, connectorIds);
          if (!connectorIds) s.resetEdgeHandles(s.actiefDiagramId);
        }),
      ];
      return () => af.forEach((off) => off());
    }, [layoutApiRef]);

    // Rechtsklik-contextmenu: zelfde acties als taakbalken/menu.
    const bouwContextMenu = useCallback(
      ({ selectieAantal }) => [
        { kop: true, label: "Uitlijnen" },
        ...UITLIJN_MODES.flatMap((m, i) => {
          const item = {
            id: m.mode,
            label: m.titel,
            icoon: UITLIJN_ICONEN[m.mode],
            disabled: selectieAantal < 2,
            onClick: () => layoutApiRef.current?.lijnUit(m.mode),
          };
          return i === 3 || i === 6 ? [{ sep: true }, item] : [item];
        }),
        { sep: true },
        ...(descriptor.layouts?.length
          ? [{ id: "auto", label: "Auto-layout (alles)", icoon: "🎯", onClick: () => menuBus.emit(ev("auto-layout"), { selectie: false }) }]
          : []),
        { id: "normaliseer", label: "Normaliseer relaties", icoon: "↔", onClick: () => menuBus.emit(ev("normaliseer")) },
        { id: "snap", label: "Snap nodes naar grid", icoon: UITLIJN_ICONEN.snap, onClick: () => layoutApiRef.current?.snapRaster() },
      ],
      [layoutApiRef]
    );

    // Taakbalk-toggles vanuit het menu.
    useEffect(() => {
      return menuBus.on(ev("taakbalk-toggle"), (balkId) => {
        zetZichtbaar(balkId, !(voorkeuren[balkId]?.zichtbaar ?? true));
        setTimeout(() => menuBus.emit("menu:ververs"), 0);
      });
    }, [voorkeuren, zetZichtbaar]);

    // Sneltoetsen: Ctrl+Z / Ctrl+Y (Delete doet React Flow zelf).
    useEffect(() => {
      const onKey = (e) => {
        const doel = e.target;
        if (doel && (doel.tagName === "INPUT" || doel.tagName === "TEXTAREA" || doel.isContentEditable)) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          useStore.temporal.getState().undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
          e.preventDefault();
          useStore.temporal.getState().redo();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Taakbalken uit de DiagramType-descriptor (§4.6): acties afgeleid.
    const taakbalken = (descriptor.taakbalken || []).map((balk) => {
      let acties = [];
      if (balk.acties === "elementTypes") {
        acties = descriptor.elementTypes
          .filter((et) => !et.isConnector && et.kort)
          .map((et) => ({
            id: et.id,
            label: et.kort,
            titel: `Nieuw: ${et.label}`,
            onClick: () => plaatsNieuwElement(et.id),
          }));
      } else if (balk.acties === "connectorTypes") {
        acties = descriptor.elementTypes
          .filter((et) => et.isConnector)
          .map((et) => ({
            id: et.id,
            label: `${et.kort} ${et.label}`,
            titel: `Verbindingsmodus: ${et.label} (klik nogmaals voor automatisch)`,
            actief: verbindingsType === et.id,
            onClick: () => setVerbindingsType(verbindingsType === et.id ? null : et.id),
          }));
      } else if (balk.acties === "layouts") {
        acties = (descriptor.layouts || []).map((strategie) => ({
          id: strategie.id,
          label: strategie.label,
          titel: `${strategie.label} (heel diagram)`,
          onClick: () => layoutApiRef.current?.voerLayoutUit(strategie, false),
        }));
      }
      return { ...balk, actieLijst: acties };
    });

    // Core-taakbalk "Uitlijnen": pure geometrie, bij élk diagramtype.
    taakbalken.push({
      id: "uitlijnen",
      label: "Uitlijnen",
      actieLijst: UITLIJN_MODES.flatMap((m, i) => {
        const knop = {
          id: m.mode,
          label: m.label,
          icoon: UITLIJN_ICONEN[m.mode],
          titel: `${m.titel} (selectie — Ctrl+klik)`,
          onClick: () => layoutApiRef.current?.lijnUit(m.mode),
        };
        return i === 3 || i === 6 ? [{ id: `sep-${i}`, sep: true }, knop] : [knop];
      }).concat([
        { id: "snap", label: "▦", icoon: UITLIJN_ICONEN.snap, titel: "Alles op raster", onClick: () => layoutApiRef.current?.snapRaster() },
        { id: "sep-norm", sep: true },
        { id: "normaliseer", label: "↔", titel: "Normaliseer relaties (kortste weg)", onClick: () => menuBus.emit(ev("normaliseer")) },
      ]),
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="dc-preview-strook">
          <span className="dc-preview-badge">0.5 preview</span>
          <span>
            {previewTekst}
            {isDirty ? " ●" : ""}
          </span>
          <span style={{ marginLeft: "auto" }}>{diagram?.naam || ""}</span>
        </div>
        <div className="studio-paper" style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {diagram ? (
            <>
              <Suspense fallback={<div style={{ padding: 16, color: "#64748b" }}>Canvas laden…</div>}>
                <DiagramCanvas
                  diagramType={descriptor}
                  elements={elements}
                  diagram={diagram}
                  viewport={viewports[diagram.id] || null}
                  bewerkbaar
                  verbindingsType={verbindingsType}
                  selectieId={selectieId}
                  onSelectElement={(el) => setSelectieId(el?.id || null)}
                  onNodePositie={(elementId, positie) => {
                    const s = useStore.getState();
                    if (elementId.startsWith(ANKER_PREFIX)) {
                      s.updateAnkerPosition(diagram.id, elementId.slice(ANKER_PREFIX.length), positie);
                    } else if (!s.diagrams[diagram.id]?.nodes.some((n) => n.elementId === elementId)) {
                      s.addElementToDiagram(diagram.id, elementId, positie);
                    } else {
                      s.updateNodePosition(diagram.id, elementId, positie);
                    }
                  }}
                  onNodePosities={(posities) => {
                    const s = useStore.getState();
                    const leden = new Set(
                      (s.diagrams[diagram.id]?.nodes || []).map((n) => n.elementId)
                    );
                    const rest = {};
                    for (const [pid, pos] of Object.entries(posities)) {
                      if (pid.startsWith(ANKER_PREFIX)) {
                        s.updateAnkerPosition(diagram.id, pid.slice(ANKER_PREFIX.length), pos);
                      } else if (!leden.has(pid)) {
                        // Auto-geplaatste connector-box in een multi-drag:
                        // eerst lidmaatschap aanmaken, anders is de positie
                        // niet persistent (zelfde regel als onNodePositie).
                        s.addElementToDiagram(diagram.id, pid, pos);
                      } else {
                        rest[pid] = pos;
                      }
                    }
                    if (Object.keys(rest).length) s.updateNodePositions(diagram.id, rest);
                  }}
                  layoutApiRef={layoutApiRef}
                  onNodeSize={(elementId, size) =>
                    useStore.getState().updateNodeSize(diagram.id, elementId, size)
                  }
                  onVerbind={verbind}
                  onVerwijder={(ids) => {
                    const s = useStore.getState();
                    ids.forEach((did) => {
                      if (did.startsWith(ANKER_PREFIX)) {
                        s.deleteElement(did.slice(ANKER_PREFIX.length));
                        return;
                      }
                      const el = s.elements[did];
                      if (el && elementTypesById[el.elementType]?.isConnector) {
                        s.deleteElement(did);
                      } else {
                        s.removeElementFromDiagram(diagram.id, did);
                      }
                    });
                  }}
                  onVerwijderConnectoren={(connectorIds) =>
                    connectorIds.forEach((cid) => useStore.getState().deleteElement(cid))
                  }
                  onNormaliseer={(connectorIds) => menuBus.emit(ev("normaliseer"), connectorIds)}
                  onLabelOffset={(connectorId, zijde, offset) => {
                    const s = useStore.getState();
                    const el = s.elements[connectorId];
                    if (!el) return;
                    s.updateElement(connectorId, {
                      data: { labelOffsets: { ...(el.data?.labelOffsets || {}), [zijde]: offset } },
                    });
                  }}
                  bouwContextMenu={bouwContextMenu}
                  onViewport={(vp) => useStore.getState().updateDiagramViewport(diagram.id, vp)}
                />
              </Suspense>
              {taakbalken
                .filter((b) => voorkeuren[b.id]?.zichtbaar ?? true)
                .map((b) => (
                  <Taskbar
                    key={b.id}
                    label={b.label || b.id}
                    acties={b.actieLijst}
                    positie={voorkeuren[b.id]?.positie || { x: 12, y: 12 }}
                    breedte={voorkeuren[b.id]?.breedte}
                    onPositie={(p) => zetPositie(b.id, p)}
                    onBreedte={(breedte) => zetBreedte(b.id, breedte)}
                  />
                ))}
            </>
          ) : (
            <div style={{ padding: 24, color: "#64748b" }}>
              Geen diagram geselecteerd — kies of maak er een in het linkerpaneel.
            </div>
          )}
        </div>
      </div>
    );
  }

  function Inspector() {
    const { selectieId, setSelectieId } = useContext(Ctx);
    const element = useStore((s) => (selectieId ? s.elements[selectieId] : null));
    const actief = useStore((s) => s.actiefDiagramId);
    const elements = useStore((s) => s.elements);
    const diagrams = useStore((s) => s.diagrams);
    const editorContext = React.useMemo(() => ({ elements, diagrams }), [elements, diagrams]);

    // Kandidaten via de ReferenceResolvers van het profiel (plan §4.5b).
    const kandidatenVoor = useCallback(
      (referenceTypeIds) => {
        const resolvers = descriptor.referenceResolvers || {};
        return (referenceTypeIds || []).flatMap((rid) =>
          resolvers[rid] ? resolvers[rid]({ elements }) : []
        );
      },
      [elements]
    );

    if (!element) {
      return (
        <div className="studio-inspector-pad" style={{ color: "var(--s-fg-muted)", fontSize: 13 }}>
          Selecteer een element op het canvas om het te bewerken. Nieuwe elementen maak je met de
          &ldquo;Maken&rdquo;-taakbalk; verbindingen sleep je tussen de aansluitpunten (kies eventueel
          eerst een type in &ldquo;Verbinding&rdquo;).
        </div>
      );
    }

    const elementType = elementTypesById[element.elementType];
    return (
      <div className="studio-inspector-pad">
        <ElementInspector
          element={element}
          elementType={elementType}
          fieldTypesById={fieldTypesById}
          kandidatenVoor={kandidatenVoor}
          editorContext={editorContext}
          bewerkbaar
          onUpdate={(patch) => useStore.getState().updateElement(element.id, patch)}
          onVerwijderVanDiagram={() => {
            if (actief) useStore.getState().removeElementFromDiagram(actief, element.id);
            setSelectieId(null);
          }}
          onVerwijderUitModel={() => {
            if (window.confirm(`"${element.naam || element.id}" uit het hele model verwijderen?`)) {
              useStore.getState().deleteElement(element.id);
              setSelectieId(null);
            }
          }}
        />
      </div>
    );
  }

  /** Geen dubbele/voorloop-separators als koppeling-onderdelen ontbreken. */
  const schoonSeparators = (items) =>
    items.filter(
      (it, i, arr) => !(it.type === "separator" && (i === 0 || arr[i - 1]?.type === "separator"))
    );

  const menus = () => [
    // Eigen Bestand-menu (overschrijft de standaard op ankerplek "bestand",
    // zelfde patroon als umlActivity). Het 0.5-werkbestand is er altijd;
    // API/V3/profielformaat alleen per koppeling-onderdeel.
    {
      id: "bestand",
      label: "Bestand",
      items: schoonSeparators([
        ...(koppeling?.DialogenComponent
          ? [
              { id: `${menuPrefix}-api-laden`, label: "Laden vanaf API…", onClick: () => menuBus.emit(ev("api-laden")) },
              { id: `${menuPrefix}-api-publiceer`, label: "Publiceer naar API…", onClick: () => menuBus.emit(ev("api-publiceer")) },
              { type: "separator" },
            ]
          : []),
        ...(koppeling?.importBestand
          ? [
              {
                id: `${menuPrefix}-import-bestand`,
                label: koppeling.importBestand.label || "Importeer bestand…",
                onClick: () => menuBus.emit(ev("import-bestand")),
              },
              { type: "separator" },
            ]
          : []),
        ...(koppeling?.importeerV3
          ? [{ id: `${menuPrefix}-import-v3`, label: "Importeer V3 JSON…", onClick: () => menuBus.emit(ev("importeer-v3")) }]
          : []),
        ...(koppeling?.exporteerV3
          ? [{ id: `${menuPrefix}-export-v3`, label: "Exporteer V3 JSON…", onClick: () => menuBus.emit(ev("exporteer-v3")) }]
          : []),
        { type: "separator" },
        { id: `${menuPrefix}-import-05`, label: "Importeer 0.5-werkbestand…", onClick: () => menuBus.emit(ev("importeer-05")) },
        { id: `${menuPrefix}-export-05`, label: "Exporteer 0.5-werkbestand…", onClick: () => menuBus.emit(ev("exporteer-05")) },
        { type: "separator" },
        {
          id: "index",
          label: "Overzicht (index)…",
          onClick: () => {
            window.location.href = window.location.pathname.replace(/[^/]*$/, "") || "/";
          },
        },
        { id: "herlaad-pagina", label: "Pagina herladen", shortcut: "F5", onClick: () => window.location.reload() },
      ]),
    },
    {
      id: "bewerken",
      label: "Bewerken",
      items: [
        { id: `${menuPrefix}-undo`, label: "Ongedaan maken", shortcut: "Ctrl+Z", onClick: () => menuBus.emit(ev("undo")) },
        { id: `${menuPrefix}-redo`, label: "Opnieuw", shortcut: "Ctrl+Y", onClick: () => menuBus.emit(ev("redo")) },
      ],
    },
    {
      id: `${menuPrefix}-hoofdmenu`,
      label: menuLabel,
      items: [
        { id: `${menuPrefix}-nieuw-diagram`, label: "Nieuw diagram…", onClick: () => menuBus.emit(ev("nieuw-diagram")) },
        ...(koppeling?.herlaadUitModel
          ? [{ id: `${menuPrefix}-herlaad`, label: "Herlaad uit UML-model…", onClick: () => menuBus.emit(ev("herlaad")) }]
          : []),
        ...(koppeling?.zetTerugNaarModel
          ? [{ id: `${menuPrefix}-zet-terug`, label: "Zet terug naar UML-model…", onClick: () => menuBus.emit(ev("zet-terug")) }]
          : []),
        { type: "separator" },
        ...(descriptor.layouts?.length
          ? [
              { id: `${menuPrefix}-auto`, label: "Auto-layout (heel diagram)", onClick: () => menuBus.emit(ev("auto-layout"), { selectie: false }) },
              { id: `${menuPrefix}-auto-sel`, label: "Auto-layout (selectie)", onClick: () => menuBus.emit(ev("auto-layout"), { selectie: true }) },
            ]
          : []),
        { id: `${menuPrefix}-snap`, label: "Uitlijnen op raster", onClick: () => menuBus.emit(ev("layout"), "snap") },
        { id: `${menuPrefix}-normaliseer`, label: "Normaliseer relaties", onClick: () => menuBus.emit(ev("normaliseer")) },
        {
          id: `${menuPrefix}-uitlijnen`,
          label: "Uitlijnen (selectie)",
          items: [
            { id: `${menuPrefix}-align-left`, label: "Links", onClick: () => menuBus.emit(ev("layout"), "left") },
            { id: `${menuPrefix}-align-right`, label: "Rechts", onClick: () => menuBus.emit(ev("layout"), "right") },
            { id: `${menuPrefix}-align-top`, label: "Boven", onClick: () => menuBus.emit(ev("layout"), "top") },
            { id: `${menuPrefix}-align-bottom`, label: "Onder", onClick: () => menuBus.emit(ev("layout"), "bottom") },
            { type: "separator" },
            { id: `${menuPrefix}-align-ch`, label: "Horizontaal centreren", onClick: () => menuBus.emit(ev("layout"), "center-h") },
            { id: `${menuPrefix}-align-cv`, label: "Verticaal centreren", onClick: () => menuBus.emit(ev("layout"), "center-v") },
            { type: "separator" },
            { id: `${menuPrefix}-dist-h`, label: "Horizontaal verdelen", onClick: () => menuBus.emit(ev("layout"), "distribute-h") },
            { id: `${menuPrefix}-dist-v`, label: "Verticaal verdelen", onClick: () => menuBus.emit(ev("layout"), "distribute-v") },
          ],
        },
        { type: "separator" },
        {
          id: `${menuPrefix}-taakbalken`,
          label: "Taakbalken",
          items: [
            ...(descriptor.taakbalken || []).map((b) => [b.id, b.label || b.id]),
            ["uitlijnen", "Uitlijnen"],
          ].map(([balkId, balkLabel]) => ({
            id: `${menuPrefix}-tb-${balkId}`,
            label: balkLabel,
            checked: taakbalkZichtbaar(balkId),
            onClick: () => menuBus.emit(ev("taakbalk-toggle"), balkId),
          })),
        },
      ],
    },
  ];

  return {
    id,
    label,
    icon,
    groep: "modelleren",
    status,
    Provider,
    Sidebar,
    Main,
    Inspector,
    sidebarLabel: "Diagrammen",
    inspectorLabel: "Element",
    menus,
  };
}
