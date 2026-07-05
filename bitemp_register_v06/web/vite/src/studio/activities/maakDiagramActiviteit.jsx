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
import { verbindingsregelsVan } from "../../diagramcore/types/typeRegistry.js";
import { UITLIJN_ICONEN } from "../../diagramcore/taskbar/uitlijnIcons.jsx";
import { Taskbar, useTaakbalkVoorkeuren, leesTaakbalkVoorkeuren } from "../../diagramcore/taskbar/Taskbar.jsx";
import ElementInspector from "../../diagramcore/inspector/ElementInspector.jsx";
import { TypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";
import { registreerIconenVocabulaire } from "../../diagramcore/shapes/iconenVocabulaire.jsx";

const DiagramCanvas = lazy(() => import("../../diagramcore/canvas/DiagramCanvas.jsx"));

// De integrale iconenset (vormgevingssessie §8.6a) — één keer registreren,
// vóór de eerste TypeIcoon-render; alle 0.5-activiteiten lopen langs deze
// fabriek, dus dit dekt taakbalken, elementen-browser én profiel-ontwerper.
registreerIconenVocabulaire();

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
    // Activiteit-eigen menu-acties bovenin het hoofdmenu:
    // [{id, label, run(useStore)}] — bv. "Activeer profiel…" (trede 2).
    hoofdmenuExtra = [],
    // Zelfde vorm, maar dan in het rechtsklik-menu op een leeg stuk canvas.
    canvasMenuExtra = [],
    // Hoe heet een "diagram" in deze activiteit? De profiel-ontwerper zegt
    // bv. "profiel" — elk diagram stelt daar een profiel voor.
    diagramTerm = "diagram",
  } = opties;

  const ev = (naam) => `${menuPrefix}:${naam}`;
  const diagramTermMv = diagramTerm === "diagram" ? "diagrammen" : `${diagramTerm}en`;

  const useStore = createDiagramStore({ persistKey });
  if (devHookNaam && typeof window !== "undefined" && import.meta.env && import.meta.env.DEV) {
    window[devHookNaam] = useStore;
  }

  const fieldTypesById = Object.fromEntries((descriptor.fieldTypes || []).map((ft) => [ft.id, ft]));
  const elementTypesById = Object.fromEntries(descriptor.elementTypes.map((et) => [et.id, et]));
  // Containertypen ("slepen in een package"): ElementType.containerVoor wijst
  // naar het connectortype dat het lidmaatschap vastlegt (bv. "bevat").
  const containerConnectorIds = new Set(
    descriptor.elementTypes.filter((et) => et.containerVoor).map((et) => et.containerVoor)
  );

  /**
   * Verhang een element naar een container (of maak het los met
   * containerId = null): verwijder bestaande lidmaatschaps-connectoren en
   * leg zo nodig een nieuwe. Met cycle-guard (package in zichzelf).
   */
  function verhangNaarContainer(useStoreRef, elementId, containerId) {
    const s = useStoreRef.getState();
    const el = s.elements[elementId];
    if (!el || elementId === containerId) return;
    const bestaande = Object.values(s.elements).filter(
      (c) => containerConnectorIds.has(c.elementType) && c.target === elementId
    );
    if (containerId) {
      const container = s.elements[containerId];
      const ct = elementTypesById[elementTypesById[container?.elementType]?.containerVoor];
      if (!ct) return;
      // Verbindingsregels respecteren (bv. geen notitie in een package).
      const mag = verbindingsregelsVan(ct).some(
        (r) => r.bron.includes(container.elementType) && r.doel.includes(el.elementType)
      );
      if (!mag) return;
      // Cycle-guard: containerId mag niet (indirect) ín elementId zitten.
      let cursor = containerId;
      for (let i = 0; i < 50 && cursor; i += 1) {
        if (cursor === elementId) return;
        const ouderConn = Object.values(s.elements).find(
          (c) => containerConnectorIds.has(c.elementType) && c.target === cursor
        );
        cursor = ouderConn?.source || null;
      }
      if (bestaande.some((c) => c.source === containerId)) return; // zit er al in
      for (const c of bestaande) s.deleteElement(c.id);
      _connTeller += 1;
      s.addElement({
        id: `bev_${Date.now()}_${_connTeller}`,
        naam: "",
        elementType: ct.id,
        source: containerId,
        target: elementId,
        compartimenten: [],
        data: {},
      });
    } else {
      for (const c of bestaande) s.deleteElement(c.id);
    }
  }

  let _connTeller = 0;
  let _plaatsTeller = 0;

  const Ctx = createContext(null);

  function Provider({ children }) {
    const [selectieId, setSelectieId] = useState(null);
    const [verbindingsType, setVerbindingsType] = useState(null);
    // Werkbestand-import met keuze: het gelezen bestand wacht hier tot de
    // gebruiker kiest (over huidig diagram / ernaast / alles vervangen).
    const [importWacht, setImportWacht] = useState(null);
    // Export-keuzedialoog: {naam} zolang de gebruiker bereik/naam kiest.
    const [exportWacht, setExportWacht] = useState(null);
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
          const naam = window.prompt(`Naam van het nieuwe ${diagramTerm}:`, `Nieuw ${diagramTerm}`);
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
          const basis = s.diagrams[s.actiefDiagramId]?.naam || Object.values(s.diagrams)[0]?.naam || id;
          setExportWacht({
            naam: `${basis.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-05`,
          });
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
                // Keuzedialoog: over het huidige diagram heen, ernaast, of
                // alles vervangen (zie de import-helpers hieronder).
                setImportWacht(inhoud);
                return;
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
      // Profiel-eigen bestandsexport (bv. coreModel → OAS 3.1 YAML).
      if (koppeling?.exportBestand) {
        af.push(
          menuBus.on(ev("export-bestand"), () => {
            const staat = useStore.getState();
            let tekst;
            try {
              tekst = koppeling.exportBestand.maak(staat);
            } catch (e) {
              window.alert(`Export mislukt: ${e?.message || e}`);
              return;
            }
            const blob = new Blob([tekst], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = koppeling.exportBestand.bestandsnaam?.(staat) || "export.txt";
            a.click();
            URL.revokeObjectURL(url);
          })
        );
      }
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

    /** Import-keuze: toevoegen náást de bestaande diagrammen (id-remap). */
    const importErnaast = useCallback((inhoud) => {
      const s = useStore.getState();
      const ts = Date.now();
      const idMap = new Map(
        Object.keys(inhoud.elements || {}).map((oudId) => [
          oudId,
          s.elements[oudId] ? `imp${ts}_${oudId}` : oudId,
        ])
      );
      const her = (x) => idMap.get(x) || x;
      const nieuweEls = {};
      for (const [oudId, el] of Object.entries(inhoud.elements || {})) {
        nieuweEls[her(oudId)] = {
          ...el,
          id: her(oudId),
          ...(el.source ? { source: her(el.source) } : {}),
          ...(el.target ? { target: her(el.target) } : {}),
        };
      }
      const bestaande = Object.fromEntries(
        Object.entries(s.diagrams).map(([dk, d]) => [
          dk,
          { ...d, ...(s.viewports?.[dk] ? { viewport: s.viewports[dk] } : {}) },
        ])
      );
      let eersteNieuw = null;
      for (const [dk, d] of Object.entries(inhoud.diagrams || {})) {
        const nieuwDk = bestaande[dk] ? `imp${ts}_${dk}` : dk;
        if (!eersteNieuw) eersteNieuw = nieuwDk;
        bestaande[nieuwDk] = {
          ...d,
          id: nieuwDk,
          nodes: (d.nodes || []).map((n) => ({ ...n, elementId: her(n.elementId) })),
          edges: (d.edges || []).map((e) => ({ ...e, source: her(e.source), target: her(e.target) })),
        };
      }
      s.laadModel({
        diagramTypeId: descriptor.id,
        elements: { ...s.elements, ...nieuweEls },
        diagrams: bestaande,
        meta: s.meta || inhoud.meta || null,
        actiefDiagramId: eersteNieuw || s.actiefDiagramId,
      });
      useStore.temporal.getState().clear();
      setSelectieId(null);
    }, []);

    /**
     * Import-keuze: over het huidige diagram heen — bv. een eerdere layout
     * terughalen. Vervangt alleen het actieve diagram (nodes/edges/viewport)
     * door het overeenkomstige diagram uit het bestand; onbekende elementen
     * worden toegevoegd, bestaande element-data blijft ongemoeid.
     */
    const importOverHuidig = useCallback((inhoud) => {
      const s = useStore.getState();
      const actief = s.actiefDiagramId;
      if (!actief) return;
      const bronDiag =
        (inhoud.diagrams || {})[actief] || Object.values(inhoud.diagrams || {})[0];
      if (!bronDiag) {
        window.alert("Het werkbestand bevat geen diagram.");
        return;
      }
      const elements = { ...s.elements };
      // Alleen elementen die bij het gekozen diagram horen: een werkbestand
      // met meerdere diagrammen sleepte anders tientallen zwevende elementen
      // mee de sandbox in (boom vol schuingedrukte rijen met ＋-knoppen).
      const opBron = new Set((bronDiag.nodes || []).map((n) => n.elementId));
      for (const [eid, el] of Object.entries(inhoud.elements || {})) {
        if (elements[eid]) continue;
        const hoortErbij =
          opBron.has(eid) ||
          (el.source && el.target && opBron.has(el.source) && opBron.has(el.target));
        if (hoortErbij) elements[eid] = el;
      }
      const diagrams = Object.fromEntries(
        Object.entries(s.diagrams).map(([dk, d]) => [
          dk,
          { ...d, ...(s.viewports?.[dk] ? { viewport: s.viewports[dk] } : {}) },
        ])
      );
      diagrams[actief] = {
        ...bronDiag,
        id: actief,
        naam: s.diagrams[actief]?.naam || bronDiag.naam,
        nodes: (bronDiag.nodes || []).filter((n) => elements[n.elementId]),
      };
      s.laadModel({
        diagramTypeId: descriptor.id,
        elements,
        diagrams,
        meta: s.meta || inhoud.meta || null,
        actiefDiagramId: actief,
      });
      useStore.temporal.getState().clear();
      setSelectieId(null);
    }, []);

    /** Import-keuze: alles vervangen door het werkbestand. */
    const importVervangAlles = useCallback((inhoud) => {
      useStore.getState().laadModel({
        diagramTypeId: descriptor.id,
        elements: inhoud.elements || {},
        diagrams: inhoud.diagrams || {},
        meta: inhoud.meta || null,
      });
      useStore.temporal.getState().clear();
      setSelectieId(null);
    }, []);

    /** Bouw en download het 0.5-werkbestand (alleen het huidige diagram, of alles). */
    const voerExportUit = useCallback((naam, alleenHuidig) => {
      const s = useStore.getState();
      let elements = s.elements;
      let diagramIds = Object.keys(s.diagrams);
      if (alleenHuidig && s.actiefDiagramId) {
        diagramIds = [s.actiefDiagramId];
        const opDiag = new Set(
          (s.diagrams[s.actiefDiagramId]?.nodes || []).map((n) => n.elementId)
        );
        elements = Object.fromEntries(
          Object.entries(s.elements).filter(
            ([eid, el]) =>
              opDiag.has(eid) ||
              (el.source && el.target && opDiag.has(el.source) && opDiag.has(el.target))
          )
        );
      }
      const diagrams = Object.fromEntries(
        diagramIds.map((did) => [
          did,
          { ...s.diagrams[did], ...(s.viewports?.[did] ? { viewport: s.viewports[did] } : {}) },
        ])
      );
      const inhoud = {
        formaat: "studio05-diagram",
        versie: 1,
        diagramType: descriptor.id,
        geexporteerd: new Date().toISOString(),
        elements,
        diagrams,
        meta: s.meta || null,
      };
      const blob = new Blob([JSON.stringify(inhoud, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(naam || "diagram").trim().replace(/\.json$/i, "") || "diagram"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }, []);

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
        {importWacht && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
            onClick={(e) => e.target === e.currentTarget && setImportWacht(null)}
          >
            <div
              style={{
                background: "var(--s-panel, #fff)",
                color: "var(--s-fg, #1e293b)",
                border: "1px solid var(--s-border, #cbd5e1)",
                borderRadius: 10,
                boxShadow: "0 12px 40px rgba(15, 23, 42, 0.25)",
                width: 420,
                maxWidth: "92vw",
                padding: "14px 16px",
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <strong>Werkbestand importeren — hoe?</strong>
              <span style={{ color: "var(--s-fg-muted, #64748b)", fontSize: 12 }}>
                De sandbox bevat al inhoud. Kies wat er met het werkbestand moet gebeuren.
              </span>
              <button
                className="dc-mini-knop"
                onClick={() => {
                  importOverHuidig(importWacht);
                  setImportWacht(null);
                }}
              >
                Over het huidige {diagramTerm} heen (layout terughalen)
              </button>
              <button
                className="dc-mini-knop"
                onClick={() => {
                  importErnaast(importWacht);
                  setImportWacht(null);
                }}
              >
                Ernaast toevoegen (als extra {diagramTermMv})
              </button>
              <button
                className="dc-mini-knop is-gevaar"
                onClick={() => {
                  if (window.confirm("Alles vervangen? Je huidige sandbox gaat verloren.")) {
                    importVervangAlles(importWacht);
                    setImportWacht(null);
                  }
                }}
              >
                Alles vervangen
              </button>
              <button className="dc-mini-knop" onClick={() => setImportWacht(null)}>
                Annuleren
              </button>
            </div>
          </div>
        )}
        {exportWacht && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
            onClick={(e) => e.target === e.currentTarget && setExportWacht(null)}
          >
            <div
              style={{
                background: "var(--s-panel, #fff)",
                color: "var(--s-fg, #1e293b)",
                border: "1px solid var(--s-border, #cbd5e1)",
                borderRadius: 10,
                boxShadow: "0 12px 40px rgba(15, 23, 42, 0.25)",
                width: 420,
                maxWidth: "92vw",
                padding: "14px 16px",
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <strong>Werkbestand exporteren</strong>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Bestandsnaam
                <input
                  type="text"
                  autoFocus
                  value={exportWacht.naam}
                  onChange={(e) => setExportWacht({ naam: e.target.value })}
                  style={{
                    font: "inherit",
                    fontSize: 13,
                    padding: "4px 8px",
                    border: "1px solid var(--s-border, #cbd5e1)",
                    borderRadius: 6,
                    background: "transparent",
                    color: "var(--s-fg)",
                  }}
                />
              </label>
              <button
                className="dc-mini-knop"
                onClick={() => {
                  voerExportUit(exportWacht.naam, true);
                  setExportWacht(null);
                }}
              >
                Alleen dit {diagramTerm}
              </button>
              <button
                className="dc-mini-knop"
                onClick={() => {
                  voerExportUit(exportWacht.naam, false);
                  setExportWacht(null);
                }}
              >
                Alles (alle {diagramTermMv})
              </button>
              <button className="dc-mini-knop" onClick={() => setExportWacht(null)}>
                Annuleren
              </button>
            </div>
          </div>
        )}
      </Ctx.Provider>
    );
  }

  /**
   * Elementen-browser (plan §8.8): alle model-elementen, gegroepeerd per
   * elementtype — óók wat op geen enkel diagram staat (na een import het
   * grootste gat). Klik = selecteren in de inspector; ＋ = toevoegen aan
   * het actieve diagram (in het zichtbare viewport-midden).
   */
  function ElementenBrowser() {
    const elements = useStore((s) => s.elements);
    const diagrams = useStore((s) => s.diagrams);
    const actiefDiagram = useStore((s) => s.actiefDiagramId);
    const { selectieId, setSelectieId, layoutApiRef } = useContext(Ctx);
    const [zoek, setZoek] = useState("");
    const [dicht, setDicht] = useState({});
    // Drag & drop in de boom (vgl. IDE-ProjectBrowser): element op een
    // container (package) slepen = verhangen; op de achtergrond = losmaken.
    const [sleepDoel, setSleepDoel] = useState(null);
    const SLEEP_MIME = "application/studio05-element";
    const sleepProps = (el, et) => ({
      draggable: !et?.isConnector,
      onDragStart: (e) => {
        e.dataTransfer.setData(SLEEP_MIME, JSON.stringify({ elementId: el.id }));
        e.dataTransfer.setData("text/plain", el.naam || el.id);
        // Les uit de IDE: alléén "move" laat sommige browsers geen
        // drop-event vuren — copyMove houdt beide routes open.
        e.dataTransfer.effectAllowed = "copyMove";
      },
      ...(et?.containerVoor
        ? {
            onDragOver: (e) => {
              if (![...e.dataTransfer.types].includes(SLEEP_MIME)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setSleepDoel(el.id);
            },
            onDragLeave: (e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setSleepDoel((v) => (v === el.id ? null : v));
              }
            },
            onDrop: (e) => {
              e.preventDefault();
              e.stopPropagation();
              setSleepDoel(null);
              const rauw = e.dataTransfer.getData(SLEEP_MIME);
              if (!rauw) return;
              try {
                const { elementId } = JSON.parse(rauw);
                if (elementId) verhangNaarContainer(useStore, elementId, el.id);
              } catch {
                /* geen geldig sleep-pakketje */
              }
            },
          }
        : {}),
    });

    const opDiagram = new Set(
      (diagrams[actiefDiagram]?.nodes || []).map((n) => n.elementId)
    );
    const term = zoek.trim().toLowerCase();
    // E01/P02: met één of meer hierarchie-connectortypen in de descriptor
    // nesten we de niet-connector-elementen als boom (zoeken → plat).
    // Meerdere typen (bv. ["bevat", "compositie"]): de paren stapelen.
    const hierIds = [].concat(descriptor.hierarchie || []);
    const boomModus = hierIds.length > 0 && !term;
    const kinderenVan = new Map();
    const heeftOuder = new Set();
    if (boomModus) {
      const voegPaar = (ouder, kind) => {
        // Zelf-verwijzing (bv. een recursief OAS-schema) zou het element uit
        // de wortels halen én alleen onder zichzelf tonen — overslaan.
        if (ouder === kind) return;
        if (!elements[ouder] || !elements[kind]) return;
        if (!kinderenVan.has(ouder)) kinderenVan.set(ouder, []);
        if (!kinderenVan.get(ouder).includes(kind)) kinderenVan.get(ouder).push(kind);
        heeftOuder.add(kind);
      };
      for (const el of Object.values(elements)) {
        if (!hierIds.includes(el.elementType) || !el.source || !el.target) continue;
        voegPaar(el.source, el.target);
      }
      // Profiel-hook voor extra paren (bv. canoniek-uml: gespiegelde
      // composities zijn presentatie-edges, geen connector-elementen).
      for (const [ouder, kind] of descriptor.hooks?.hierarchieParen?.({ elements, diagrams }) || []) {
        voegPaar(ouder, kind);
      }
    }
    const sorteer = (lijst) => lijst.sort((a, b) => (a.naam || a.id).localeCompare(b.naam || b.id));
    const wortels = boomModus
      ? sorteer(
          Object.values(elements).filter((el) => {
            const et = elementTypesById[el.elementType];
            return et && !et.isConnector && !heeftOuder.has(el.id);
          })
        )
      : [];
    const groepen = descriptor.elementTypes
      .filter((et) => !boomModus || et.isConnector)
      .map((et) => ({
        et,
        items: Object.values(elements)
          .filter((el) => el.elementType === et.id)
          // Naamloze connectoren ("(oascon_ref_32)" enz.) zijn ruis in de
          // browser: ze zijn via hun uiteinden op de canvas te vinden.
          .filter((el) => !et.isConnector || (el.naam || "").trim())
          .filter((el) => !term || (el.naam || el.id).toLowerCase().includes(term))
          .sort((a, b) => (a.naam || a.id).localeCompare(b.naam || b.id)),
      }))
      .filter((g) => g.items.length > 0);

    const voegToe = (el) => {
      const midden = layoutApiRef.current?.viewportMidden?.() || { x: 200, y: 160 };
      useStore.getState().addElementToDiagram(actiefDiagram, el.id, {
        x: midden.x - 90,
        y: midden.y - 50,
      });
      setSelectieId(el.id);
    };

    const Rij = (el, diepte = 0) => {
      const et = elementTypesById[el.elementType];
      const zichtbaar = opDiagram.has(el.id);
      return (
        <div key={el.id}>
          <div
            {...sleepProps(el, et)}
            onClick={() => {
              setSelectieId(el.id);
              if (zichtbaar) layoutApiRef.current?.focusNode?.(el.id);
            }}
            title={zichtbaar ? el.naam || el.id : `${el.naam || el.id} — niet op dit diagram`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: `2px 6px 2px ${20 + diepte * 14}px`,
              borderRadius: 6,
              cursor: "pointer",
              color: zichtbaar ? "var(--s-fg)" : "var(--s-fg-muted)",
              background: el.id === selectieId ? "var(--s-hover)" : "transparent",
              outline: sleepDoel === el.id ? "1px dashed var(--s-accent, #6366f1)" : "none",
            }}
          >
            <TypeIcoon elementType={et} maat={11} />
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontStyle: zichtbaar ? undefined : "italic",
              }}
            >
              {el.naam || `(${el.id})`}
            </span>
            {!zichtbaar && !et?.isConnector && actiefDiagram && (
              <button
                className="dc-mini-knop"
                title="Toevoegen aan het huidige diagram"
                onClick={(e) => {
                  e.stopPropagation();
                  voegToe(el);
                }}
              >
                ＋
              </button>
            )}
          </div>
          {diepte < 8 &&
            sorteer((kinderenVan.get(el.id) || []).map((kid) => elements[kid]).filter(Boolean)).map(
              (kind) => Rij(kind, diepte + 1)
            )}
        </div>
      );
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <div
          style={{
            padding: "6px 8px",
            borderTop: "1px solid var(--s-border)",
            borderBottom: "1px solid var(--s-border)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--s-fg-muted)" }}>
            ELEMENTEN
          </span>
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="zoek…"
            style={{
              flex: 1,
              minWidth: 0,
              font: "inherit",
              fontSize: 12,
              padding: "2px 6px",
              border: "1px solid var(--s-border)",
              borderRadius: 6,
              background: "var(--s-panel, transparent)",
              color: "var(--s-fg)",
            }}
          />
        </div>
        <div
          style={{ flex: 1, overflow: "auto", padding: 6 }}
          onDragOver={(e) => {
            if ([...e.dataTransfer.types].includes(SLEEP_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(e) => {
            const rauw = e.dataTransfer.getData(SLEEP_MIME);
            if (!rauw) return;
            e.preventDefault();
            setSleepDoel(null);
            try {
              const { elementId } = JSON.parse(rauw);
              if (elementId) verhangNaarContainer(useStore, elementId, null);
            } catch {
              /* geen geldig sleep-pakketje */
            }
          }}
        >
          {groepen.length === 0 && wortels.length === 0 && (
            <p style={{ margin: 8, color: "var(--s-fg-muted)" }}>Geen elementen{term ? " gevonden" : ""}.</p>
          )}
          {boomModus && wortels.map((el) => Rij(el))}
          {groepen.map(({ et, items }) => (
            <div key={et.id} style={{ marginBottom: 2 }}>
              <div
                onClick={() => setDicht((v) => ({ ...v, [et.id]: !v[et.id] }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 6px",
                  cursor: "pointer",
                  color: "var(--s-fg-muted)",
                  fontSize: 11,
                  fontWeight: 600,
                  userSelect: "none",
                }}
              >
                <span style={{ width: 10 }}>{dicht[et.id] ? "▸" : "▾"}</span>
                <TypeIcoon elementType={et} maat={12} />
                <span style={{ flex: 1 }}>{et.label || et.id}</span>
                <span>{items.length}</span>
              </div>
              {!dicht[et.id] &&
                items.map((el) => {
                  const zichtbaar = opDiagram.has(el.id);
                  return (
                    <div
                      key={el.id}
                      {...sleepProps(el, et)}
                      onClick={() => {
                        setSelectieId(el.id);
                        if (zichtbaar) layoutApiRef.current?.focusNode?.(el.id);
                      }}
                      title={zichtbaar ? el.naam || el.id : `${el.naam || el.id} — niet op dit diagram`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "2px 6px 2px 20px",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: zichtbaar ? "var(--s-fg)" : "var(--s-fg-muted)",
                        background: el.id === selectieId ? "var(--s-hover)" : "transparent",
                        outline: sleepDoel === el.id ? "1px dashed var(--s-accent, #6366f1)" : "none",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontStyle: zichtbaar ? undefined : "italic",
                        }}
                      >
                        {el.naam || `(${el.id})`}
                      </span>
                      {!zichtbaar && !et.isConnector && actiefDiagram && (
                        <button
                          className="dc-mini-knop"
                          title="Toevoegen aan het huidige diagram"
                          onClick={(e) => {
                            e.stopPropagation();
                            voegToe(el);
                          }}
                        >
                          ＋
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
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
            ＋ Nieuw {diagramTerm}
          </button>
        </div>
        <div style={{ maxHeight: "40%", overflow: "auto", padding: 6, flexShrink: 0 }}>
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
        <ElementenBrowser />
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
      ({ selectieAantal, connectorId, nodeId }) => [
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
        // Rechtsklik op een element-node: z-order (L01) en gelijke maat (L02).
        ...(nodeId
          ? (() => {
              const s = useStore.getState();
              const zOrdes = Object.values(s.elements)
                .map((el) => el.data?.zOrde || 0);
              const items = [
                { sep: true },
                { kop: true, label: "Element" },
                {
                  id: "naar-voren",
                  label: "Naar voorgrond",
                  icoon: "⬆",
                  onClick: () =>
                    useStore.getState().updateElement(nodeId, {
                      data: { zOrde: Math.max(0, ...zOrdes) + 1 },
                    }),
                },
                {
                  id: "naar-achteren",
                  label: "Naar achtergrond",
                  icoon: "⬇",
                  onClick: () =>
                    useStore.getState().updateElement(nodeId, {
                      data: { zOrde: Math.min(0, ...zOrdes) - 1 },
                    }),
                },
              ];
              if (selectieAantal >= 2) {
                items.push({
                  id: "gelijke-maat",
                  label: "Zelfde maat als dit element",
                  icoon: "⧉",
                  onClick: () => layoutApiRef.current?.maakGelijkeMaat(nodeId),
                });
              }
              return items;
            })()
          : []),
        // Rechtsklik op een connector: lijnvorm per connector (§8.5c).
        ...(connectorId
          ? (() => {
              const huidig = useStore.getState().elements[connectorId]?.data?.vorm || "bezier";
              return [
                { sep: true },
                // Knikpunten: toevoegen gaat met ctrl-klik óp de lijn; hier
                // alleen het wissen.
                ...(() => {
                  const knikken = useStore.getState().elements[connectorId]?.data?.knikken || [];
                  return knikken.length
                    ? [
                        {
                          id: "knikken-wissen",
                          label: `Knikpunten wissen (${knikken.length})`,
                          onClick: () =>
                            useStore.getState().updateElement(connectorId, { data: { knikken: [] } }),
                        },
                      ]
                    : [];
                })(),
                { kop: true, label: "Lijnvorm" },
                ...[
                  ["bezier", "Kromme (bezier)", "∿"],
                  ["hoekig", "Hoekig", "⌐"],
                  ["recht", "Recht", "—"],
                ].map(([vorm, vormLabel, icoon]) => ({
                  id: `vorm-${vorm}`,
                  label: vormLabel + (huidig === vorm ? "  ✓" : ""),
                  icoon,
                  onClick: () =>
                    useStore.getState().updateElement(connectorId, {
                      data: { vorm: vorm === "bezier" ? null : vorm },
                    }),
                })),
                // L03: uiteinden vastzetten (wint van de kortste weg; "auto"
                // geeft het uiteinde weer vrij — normaliseren doet dat ook).
                ...(() => {
                  const conn = useStore.getState().elements[connectorId];
                  const zijden = [
                    ["top", "boven"],
                    ["bottom", "onder"],
                    ["left", "links"],
                    ["right", "rechts"],
                    [null, "automatisch"],
                  ];
                  const sectie = (kant, veld, prefix) => [
                    { kop: true, label: `${kant}-uiteinde vastzetten` },
                    ...zijden.map(([zijde, zijdeLabel]) => {
                      const waarde = zijde ? `${prefix}-${zijde}` : null;
                      const actief = (conn?.data?.[veld] || null) === waarde;
                      return {
                        id: `${veld}-${zijde || "auto"}`,
                        label: zijdeLabel + (actief ? "  ✓" : ""),
                        onClick: () =>
                          useStore.getState().updateElement(connectorId, {
                            data: { [veld]: waarde },
                          }),
                      };
                    }),
                  ];
                  return [
                    { sep: true },
                    ...sectie("Bron", "sourceHandle", "source"),
                    { sep: true },
                    ...sectie("Doel", "targetHandle", "target"),
                  ];
                })(),
              ];
            })()
          : []),
        // Rechtsklik op een node: losmaken uit zijn container (package).
        ...(nodeId && !connectorId
          ? (() => {
              const s = useStore.getState();
              const lidmaatschappen = Object.values(s.elements).filter(
                (c) => containerConnectorIds.has(c.elementType) && c.target === nodeId
              );
              if (!lidmaatschappen.length) return [];
              const containerNaam = s.elements[lidmaatschappen[0].source]?.naam || "package";
              return [
                { sep: true },
                {
                  id: "uit-container",
                  label: `Losmaken uit "${containerNaam}"`,
                  onClick: () => verhangNaarContainer(useStore, nodeId, null),
                },
              ];
            })()
          : []),
        // Rechtsklik op leeg canvas: activiteit-eigen acties (bv. "Activeer
        // profiel…") + exporteren zonder eerst naar het menu te hoeven.
        ...(!nodeId && !connectorId
          ? [
              { sep: true },
              ...canvasMenuExtra.map((m) => ({
                id: m.id,
                label: m.label,
                onClick: () => m.run(useStore),
              })),
              {
                id: "ctx-export-05",
                label: "Exporteer 0.5-werkbestand…",
                onClick: () => menuBus.emit(ev("exporteer-05")),
              },
            ]
          : []),
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
            icoon: (
              <span className="dc-taakbalk-icoonlabel">
                <TypeIcoon elementType={et} />
                {et.kort}
              </span>
            ),
            titel: `Nieuw: ${et.label}`,
            onClick: () => plaatsNieuwElement(et.id),
          }));
      } else if (balk.acties === "connectorTypes") {
        acties = descriptor.elementTypes
          .filter((et) => et.isConnector)
          .map((et) => ({
            id: et.id,
            label: `${et.kort} ${et.label}`,
            icoon: (
              <span className="dc-taakbalk-icoonlabel">
                <TypeIcoon elementType={et} />
                {`${et.kort} ${et.label}`}
              </span>
            ),
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
        {/* Eigen canvas (geen third-party zoals bpmn/dmn-js) → volgt het
            studio-thema via dc-canvasvlak, i.p.v. het vaste witte papier. */}
        <div className="dc-canvasvlak" style={{ flex: 1, minHeight: 0, position: "relative" }}>
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
                  onKnikken={(connectorId, lijst) =>
                    useStore.getState().updateElement(connectorId, { data: { knikken: lijst } })
                  }
                  onContainerDrop={(elementId, containerId) =>
                    verhangNaarContainer(useStore, elementId, containerId)
                  }
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
            ]
          : []),
        ...(koppeling?.exportBestand
          ? [
              {
                id: `${menuPrefix}-export-bestand`,
                label: koppeling.exportBestand.label || "Exporteer bestand…",
                onClick: () => menuBus.emit(ev("export-bestand")),
              },
            ]
          : []),
        ...(koppeling?.importBestand || koppeling?.exportBestand ? [{ type: "separator" }] : []),
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
        ...hoofdmenuExtra.map((actie) => ({
          id: `${menuPrefix}-${actie.id}`,
          label: actie.label,
          onClick: () => actie.run(useStore),
        })),
        ...(hoofdmenuExtra.length ? [{ type: "separator" }] : []),
        { id: `${menuPrefix}-nieuw-diagram`, label: `Nieuw ${diagramTerm}…`, onClick: () => menuBus.emit(ev("nieuw-diagram")) },
        ...(koppeling?.herlaadUitModel
          ? [{ id: `${menuPrefix}-herlaad`, label: koppeling.herlaadLabel || "Herlaad uit UML-model…", onClick: () => menuBus.emit(ev("herlaad")) }]
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
