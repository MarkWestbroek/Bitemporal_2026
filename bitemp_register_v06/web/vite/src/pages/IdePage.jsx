/**
 * IdePage — Hoofd-IDE pagina met FlexLayout docking layout.
 *
 * Layout: ProjectBrowser (links) | DiagramCanvas (midden) | DetailsPanel (rechts)
 * Alle panels zijn verplaatsbaar, resizable en dockable (Eclipse-stijl).
 *
 * Laadt bij opstart het nieuwste V3 model uit de database (net als EditorV2Page)
 * en zet het om naar de Zustand store via v3ModelNaarStore().
 */
import { useEffect, useCallback, useRef, useState } from "react";
import * as FlexLayout from "flexlayout-react";

// FlexLayout theme CSS als URL (niet als side-effect import) — dynamisch gewisseld
import flexDarkUrl from "flexlayout-react/style/dark.css?url";
import flexLightUrl from "flexlayout-react/style/light.css?url";

import useModelStore from "../store/useModelStore";
import useUIStore from "../store/useUIStore";
import { v3ModelNaarStore, exportStoreAsJson, importStoreFromJson, storeNaarV3Model, filterStoreByDomein, mergeStoreDomein } from "../store/adapters";
import { validateV3Model } from "../validation/validateV3Model";
import { demoV3Model } from "../demoV3Model";
import {
  createLayoutModel,
  persistLayout,
  resetLayout,
  openDiagramTab,
  openBestandenTab,
  COMP_BROWSER,
  COMP_DIAGRAM,
  COMP_PROPERTIES,
  COMP_BESTANDEN,
} from "../ide/layoutConfig";
import ProjectBrowser from "../ide/ProjectBrowser";
import DiagramCanvas from "../ide/DiagramCanvas";
import DetailsPanel from "../ide/DetailsPanel";
import BestandenPanel from "../ide/BestandenPanel";
import UploadDialog from "../ide/UploadDialog";
import ExportDialog from "../ide/ExportDialog";
import ImportDialog from "../ide/ImportDialog";
import ActionDialog from "../ide/ActionDialog";
import ErrorBoundary from "../ide/ErrorBoundary";

const DEFAULT_MODEL_VERSIE = "v0.";
const DEFAULT_INDIENER = "MW";

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

export default function IdePage() {
  const loadModel = useModelStore((s) => s.loadModel);
  const addDiagram = useModelStore((s) => s.addDiagram);
  const modelMeta = useModelStore((s) => s.modelMeta);
  const elements = useModelStore((s) => s.elements);
  const isDirty = useModelStore((s) => s.isDirty);
  const markSaved = useModelStore((s) => s.markSaved);
  const domains = useModelStore((s) => s.domains);
  const domainMeta = useModelStore((s) => s.domainMeta);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const [layoutModel] = useState(() => createLayoutModel());
  const [status, setStatus] = useState("laden…");
  const [toast, setToast] = useState(null); // { message, type: "success"|"error"|"info", stappen? }
  const toastTimerRef = useRef(null);
  const loadedRef = useRef(false);

  // ── Toast helper: toont een prominente melding die na delay verdwijnt ──
  const showToast = useCallback((message, type = "info", extra = {}) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type, ...extra });
    const delay = type === "error" ? 12000 : 6000;
    toastTimerRef.current = setTimeout(() => setToast(null), delay);
  }, []);

  // ── Theme: sync data-ide-theme op body + FlexLayout stylesheet ──
  useEffect(() => {
    document.body.setAttribute("data-ide-theme", theme);
    return () => document.body.removeAttribute("data-ide-theme");
  }, [theme]);

  useEffect(() => {
    const id = "flexlayout-theme-css";
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = theme === "dark" ? flexDarkUrl : flexLightUrl;
  }, [theme]);

  // ── Upload Dialog state ──────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);

  // ── Export Dialog state ──────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPrefillDomein, setExportPrefillDomein] = useState(undefined);

  // ── Import Dialog state ─────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importPrefillDomein, setImportPrefillDomein] = useState(undefined);

  // ── Action Dialog state ──────────────────────────────────
  const [dialogType, setDialogType] = useState(null); // "publish" | "rebuild" | "publishAndRebuild" | "diff" | null
  const [dialogValues, setDialogValues] = useState({});
  const [validationResult, setValidationResult] = useState({ errors: [], warnings: [] });
  const [diffResult, setDiffResult] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const openDialog = useCallback((type) => {
    const domains = useModelStore.getState().domains || [];
    const domainMeta = useModelStore.getState().domainMeta || {};
    const meta = useModelStore.getState().modelMeta || {};
    const actiefDomein = useUIStore.getState().actiefDomein || "";
    const base = apiBase();

    // Pre-validatie: bouw V3 model en valideer naamconventies
    const state = useModelStore.getState();
    const v3 = storeNaarV3Model(state);
    setValidationResult(validateV3Model(v3.model || v3));

    // Reset diff-state bij nieuw dialoog
    setDiffResult(null);
    setDiffLoading(false);

    setDialogValues({
      versie: meta.versie || DEFAULT_MODEL_VERSIE,
      naam: actiefDomein || "",
      indiener: meta.indiener || DEFAULT_INDIENER,
      apiBase: base || "http://localhost:8082",
      rebuildApiBase: base || "http://localhost:8082",
      opmerking: "",
      bron: "editor",
      wachtwoord: "1234",
      schemaVersieID: "",
      diffBron: "actief",
      diffSchemaVersieID: "",
      diffDomein: "",
      beschikbareDomeinen: domains.map((d) => ({
        naam: d,
        prefix: domainMeta[d]?.prefix || "",
        mode: "register",
        geselecteerd: true,
      })),
    });
    setDialogType(type);
  }, []);

  const handleDialogChange = useCallback((key, value) => {
    setDialogValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Bij opstart: laad model ──────────────────────────────
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // Als er al data in de store zit (via persist), gebruik die
    const current = useModelStore.getState();
    if (current.elements && Object.keys(current.elements).length > 0) {
      setStatus(`Hersteld uit lokale opslag (${Object.keys(current.elements).length} elementen)`);
      return;
    }

    // Probeer nieuwste model uit DB
    const base = apiBase();
    fetch(`${base}/api/schema/versies`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((versies) => {
        if (!Array.isArray(versies) || versies.length === 0) {
          throw new Error("Geen versies in database");
        }
        const nieuwste = versies[0];
        return fetch(`${base}${nieuwste.model_url}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
      })
      .then((response) => {
        const storeData = v3ModelNaarStore(response);
        loadModel(storeData);
        const id = response?.id || "?";
        setStatus(`Geladen uit DB (model #${id}, ${Object.keys(storeData.elements).length} elementen)`);
      })
      .catch((err) => {
        console.warn("DB niet bereikbaar, laad demo-model:", err.message);
        const storeData = v3ModelNaarStore(demoV3Model);
        loadModel(storeData);
        setStatus(`Demo-model (${Object.keys(storeData.elements).length} elementen)`);
      });
  }, [loadModel]);

  // ── Herlaad model uit DB (forceert verse fetch) ──────────
  const handleHerlaad = useCallback(() => {
    const base = apiBase();
    setStatus("Herladen…");
    fetch(`${base}/api/schema/versies`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((versies) => {
        if (!Array.isArray(versies) || versies.length === 0) throw new Error("Geen versies");
        const nieuwste = versies[0];
        return fetch(`${base}${nieuwste.model_url}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
      })
      .then((response) => {
        const storeData = v3ModelNaarStore(response);
        loadModel(storeData);
        const id = response?.id || "?";
        setStatus(`Herlaad uit DB (model #${id}, ${Object.keys(storeData.elements).length} elementen)`);
      })
      .catch((err) => {
        console.warn("Herlaad mislukt:", err.message);
        const storeData = v3ModelNaarStore(demoV3Model);
        loadModel(storeData);
        setStatus(`Demo-model (herlaad, ${Object.keys(storeData.elements).length} elementen)`);
      });
  }, [loadModel]);

  // ── Layout persistentie ──────────────────────────────────
  const handleLayoutChange = useCallback(
    (_action) => {
      persistLayout(layoutModel);
    },
    [layoutModel]
  );

  // ── Nieuw diagram aanmaken ───────────────────────────────
  /**
   * Nieuw diagram aanmaken.
   * @param {string} [voorgesteldeNaam] - Vooraf ingevulde naam in de prompt.
   * @param {string|null} [domein] - Domein waaronder het diagram valt (uit PB-boom rechtsklik).
   */
  const handleNieuwDiagram = useCallback(
    (voorgesteldeNaam, domein) => {
      const standaardNaam = domein ? `${domein} — Nieuw diagram` : "Nieuw diagram";
      const naam = window.prompt("Naam van het nieuwe diagram:", voorgesteldeNaam || standaardNaam);
      if (!naam) return;

      const bestaand = useModelStore.getState().diagrams || {};
      const basisId = maakDiagramId(naam);
      let diagramId = basisId;
      let teller = 2;
      while (bestaand[diagramId]) {
        diagramId = `${basisId}_${teller}`;
        teller += 1;
      }

      addDiagram({
        id: diagramId,
        naam,
        domein: domein || null,
        nodes: [],
        edges: [],
        viewport: null,
      });
      openDiagramTab(layoutModel, diagramId, naam);
      setStatus(`Nieuw diagram aangemaakt: ${naam}${domein ? ` (domein: ${domein})` : ""}`);
    },
    [addDiagram, layoutModel]
  );

  // ── Diagram tab openen (vanuit ProjectBrowser) ───────────
  const handleOpenDiagram = useCallback(
    (diagramId, naam) => {
      openDiagramTab(layoutModel, diagramId, naam);
    },
    [layoutModel]
  );

  // ── Export (via ExportDialog) ────────────────────────────
  const handleExportDialog = useCallback(async (format, filename, domein, bestemming, extra) => {
    const state = useModelStore.getState();
    let json;
    if (format === "ide") {
      json = exportStoreAsJson(state);
    } else {
      json = storeNaarV3Model(state);
    }

    // Domein-filter toepassen op V3 export
    if (domein && format !== "ide" && json?.model?.entiteiten) {
      json.model.entiteiten = json.model.entiteiten.filter((e) => e.domein === domein);
      json.model.enums = (json.model.enums || []).filter((e) => e.domein === domein || !e.domein);
      json.model.datatypes = (json.model.datatypes || []).filter((dt) => dt.domein === domein || !dt.domein);
    }

    const jsonStr = JSON.stringify(json, null, 2);
    const finalFilename = filename || `export-${new Date().toISOString().slice(0, 10)}.json`;

    if (bestemming === "database") {
      // ── Database export via IdeBestand upload ──
      try {
        const formData = new FormData();
        const blob = new Blob([jsonStr], { type: "application/json" });
        formData.append("file", blob, finalFilename);
        formData.append("naam", finalFilename);
        formData.append("beschrijving", extra?.beschrijving || "");
        formData.append("categorie", format === "ide" ? "ide_snapshot" : "model_snapshot");
        formData.append("bestandsformaat", "json");
        formData.append("tags", extra?.tags || "");
        formData.append("versie_label", extra?.versie || "");
        const resp = await fetch(`${apiBase()}/api/bestanden/upload`, {
          method: "POST",
          body: formData,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
        showToast(`Opgeslagen in database: ${finalFilename}`, "success");
      } catch (err) {
        console.error("Database export mislukt:", err);
        showToast(`Database export mislukt: ${err.message}`, "error");
      }
    } else {
      // ── Lokaal bestand download ──
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = finalFilename;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportOpen(false);
    setExportPrefillDomein(undefined);
  }, [showToast]);

  const handleExportUpdateVersie = useCallback((domein, versie) => {
    useModelStore.getState().updateDomainMeta(domein, { versie });
  }, []);

  // ── Publiceer naar API (proposed schema versie) ────────────
  const handlePubliceer = useCallback(() => {
    openDialog("publish");
  }, [openDialog]);

  // ── Rebuild (devloop: codegen + herstart) ─────────────────
  const handleRebuild = useCallback(() => {
    openDialog("rebuild");
  }, [openDialog]);

  // ── Publiceer + Rebuild gecombineerd ──────────────────────
  const handlePublishAndRebuild = useCallback(() => {
    openDialog("publishAndRebuild");
  }, [openDialog]);

  // ── Delta-analyse (standalone) ────────────────────────────
  const handleDiff = useCallback(() => {
    openDialog("diff");
  }, [openDialog]);

  // ── Bestanden tab openen ─────────────────────────────────
  const handleOpenBestanden = useCallback(() => {
    openBestandenTab(layoutModel);
  }, [layoutModel]);

  // ── Diff helper: voert delta-analyse uit via API ─────────
  const doDiff = useCallback(async (vals, bron, domein) => {
    const base = vals.rebuildApiBase || vals.apiBase || apiBase();
    const wachtwoord = vals.wachtwoord || "1234";
    const state = useModelStore.getState();
    const v3 = storeNaarV3Model(state);

    const body = {
      model: v3.model,
      bron: bron || vals.diffBron || "actief",
      domein: domein || vals.diffDomein || "",
    };
    if (body.bron === "id" && vals.diffSchemaVersieID) {
      body.schema_versie_id = parseInt(vals.diffSchemaVersieID, 10);
    }

    setDiffLoading(true);
    setDiffResult(null);
    try {
      const resp = await fetch(`${base}/admin/diff/${encodeURIComponent(wachtwoord)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await resp.json();
      setDiffResult(result);
      return result;
    } catch (err) {
      const errorResult = { status: "fout", error: `Verbinding mislukt: ${err.message}` };
      setDiffResult(errorResult);
      return errorResult;
    } finally {
      setDiffLoading(false);
    }
  }, []);

  // ── Dialog submit: voert de actie uit op basis van dialogType ──
  const handleDialogSubmit = useCallback(async () => {
    const type = dialogType;
    const vals = dialogValues;

    // Bij diff: voer analyse uit maar sluit dialoog niet
    if (type === "diff") {
      await doDiff(vals);
      return;
    }

    setDialogType(null);

    const base = vals.apiBase || apiBase();
    const state = useModelStore.getState();
    const v3 = storeNaarV3Model(state);

    // ── Publiceer ──
    if (type === "publish" || type === "publishAndRebuild") {
      setStatus("Publiceren…");
      try {
        const queryParams = vals.opmerking ? `?opmerking=${encodeURIComponent(vals.opmerking)}` : "";
        const body = {
          bron: vals.indiener || DEFAULT_INDIENER,
          indiener: vals.indiener || DEFAULT_INDIENER,
          model: { ...v3.model, versie: vals.versie || DEFAULT_MODEL_VERSIE, naam: vals.naam || "" },
        };
        const resp = await fetch(`${base}/api/schema/model${queryParams}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
        }
        const result = await resp.json();
        markSaved();
        setStatus(`Gepubliceerd ✓ (versie #${result.id}, status: ${result.status})`);
        showToast(`Gepubliceerd ✓ (versie #${result.id})`, "success");

        // Bij publishAndRebuild: ga door met rebuild
        if (type === "publishAndRebuild") {
          await doRebuild(vals, result.id);
        }
      } catch (err) {
        console.error("Publiceer fout:", err);
        setStatus(`Publicatie mislukt: ${err.message}`);
        showToast(`Publicatie mislukt: ${err.message}`, "error");
      }
      return;
    }

    // ── Alleen Rebuild ──
    if (type === "rebuild") {
      await doRebuild(vals);
    }
  }, [dialogType, dialogValues, markSaved, doDiff]);

  // ── Pre-flight diff bij rebuild: gebruikt "actief" als bron ──
  const handlePreFlightDiff = useCallback(async () => {
    await doDiff(dialogValues, "actief", "");
  }, [dialogValues, doDiff]);

  // ── Rebuild helper ────────────────────────────────────────
  const doRebuild = useCallback(async (vals, schemaVersieID) => {
    const rebuildBase = vals.rebuildApiBase || vals.apiBase || apiBase();
    const wachtwoord = vals.wachtwoord || "1234";
    const state = useModelStore.getState();
    const v3 = storeNaarV3Model(state);

    // Bouw domeinen-payload
    const geselecteerdeDomeinen = (vals.beschikbareDomeinen || [])
      .filter((d) => d.geselecteerd)
      .map((d) => ({ domein: d.naam, prefix: d.prefix || "", mode: d.mode || "register" }));

    const body = {
      model: v3.model,
      domeinen: geselecteerdeDomeinen.length > 0 ? geselecteerdeDomeinen : [{ domein: "register", prefix: "", mode: "register" }],
    };
    if (schemaVersieID) body.schemaVersieID = schemaVersieID;

    setStatus("Rebuilden…");
    try {
      const resp = await fetch(`${rebuildBase}/admin/rebuild/${encodeURIComponent(wachtwoord)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error("Rebuild response:", text);
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 2000)}`);
      }
      const result = await resp.json();
      if (result.status === "succesvol") {
        markSaved();
        const stappenTekst = (result.stappen || []).join("\n• ");
        console.info("Rebuild succesvol — stappen:\n•", stappenTekst);
        setStatus(`Rebuild ✓ (${(result.stappen || []).length} stappen)`);
        showToast(`Rebuild succesvol (${(result.stappen || []).length} stappen)`, "success", { stappen: result.stappen });
      } else {
        setStatus(`Rebuild fout: ${result.error || "onbekend"}`);
        showToast(`Rebuild fout: ${result.error || "onbekend"}`, "error", { stappen: result.stappen });
      }
    } catch (err) {
      console.error("Rebuild fout:", err);
      setStatus(`Rebuild mislukt: ${err.message}`);
      showToast(`Rebuild mislukt: ${err.message}`, "error");
    }
  }, [markSaved]);

  // ── Import: open de ImportDialog ────────────────────────
  const handleImport = useCallback(() => {
    setImportPrefillDomein(undefined);
    setImportOpen(true);
  }, []);

  /**
   * Verwerk het resultaat van de ImportDialog.
   * Ondersteunt V3 en IDE-v1 formaten, domein-vervang en merge modus.
   * Maakt automatisch een diagram aan bij import met posities uit het V3-model.
   */
  const handleImportResult = useCallback((data, meta) => {
    try {
      let storeData;
      const isIDE = meta.format === "ide";

      if (isIDE) {
        storeData = importStoreFromJson(data);
      } else {
        storeData = v3ModelNaarStore(data);
      }

      // Domein-specifiek: filter en/of merge
      if (meta.domein) {
        if (meta.modus === "merge") {
          const gefilterd = filterStoreByDomein(storeData, meta.domein);
          const gemerged = mergeStoreDomein(useModelStore.getState(), gefilterd, meta.domein);
          loadModel(gemerged);
        } else {
          // Vervang: huidige state mergen met gefilterd domein uit import
          const gefilterd = filterStoreByDomein(storeData, meta.domein);
          const gemerged = mergeStoreDomein(useModelStore.getState(), gefilterd, meta.domein);
          loadModel(gemerged);
        }
      } else {
        // Alles vervangen
        loadModel(storeData);
      }

      // ── Auto-diagram: maak een import-diagram aan met posities ──
      const diagramNaam = meta.bronLabel || `Import ${new Date().toISOString().slice(0, 10)}`;
      const basisId = maakDiagramId(diagramNaam);
      const bestaand = useModelStore.getState().diagrams || {};
      let diagramId = basisId;
      let teller = 2;
      while (bestaand[diagramId]) {
        diagramId = `${basisId}_${teller}`;
        teller += 1;
      }

      // Haal posities uit het overzicht-diagram (aangemaakt door v3ModelNaarStore)
      // of uit de bestaande diagrammen in geval van IDE-import
      const bron = useModelStore.getState().diagrams;
      const overzicht = bron?.overzicht;
      const importNodes = overzicht?.nodes || [];
      const importEdges = overzicht?.edges || [];

      // Filter nodes op het domeinfilter als dat actief is
      let diagramNodes = importNodes;
      let diagramEdges = importEdges;
      if (meta.domein) {
        const domeinElementIds = new Set();
        const els = useModelStore.getState().elements || {};
        for (const [id, el] of Object.entries(els)) {
          if (el.domein === meta.domein) domeinElementIds.add(id);
        }
        diagramNodes = importNodes.filter((n) => domeinElementIds.has(n.elementId));
        const nodeElIds = new Set(diagramNodes.map((n) => n.elementId));
        diagramEdges = importEdges.filter(
          (e) => nodeElIds.has(e.source) && nodeElIds.has(e.target)
        );
      }

      addDiagram({
        id: diagramId,
        naam: diagramNaam,
        domein: meta.domein || null,
        nodes: diagramNodes,
        edges: diagramEdges,
        viewport: null,
      });
      openDiagramTab(layoutModel, diagramId, diagramNaam);

      const elCount = Object.keys(useModelStore.getState().elements || {}).length;
      setStatus(`Import "${diagramNaam}" (${elCount} elementen)`);
      showToast(`Import geslaagd: ${diagramNaam}`, "success");
      setImportOpen(false);
    } catch (err) {
      console.error("Import fout:", err);
      showToast(`Import mislukt: ${err.message}`, "error");
    }
  }, [loadModel, addDiagram, layoutModel, showToast]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+S → Publiceer dialoog
      if (ctrl && e.key === "s") {
        e.preventDefault();
        handlePubliceer();
        return;
      }

      // Ctrl+Z → Undo
      if (ctrl && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        useModelStore.temporal.getState().undo();
        return;
      }

      // Ctrl+Shift+Z of Ctrl+Y → Redo
      if ((ctrl && e.shiftKey && e.key === "Z") || (ctrl && e.key === "y")) {
        e.preventDefault();
        useModelStore.temporal.getState().redo();
        return;
      }

      // F2 → Rename geselecteerd element of actief diagram
      if (e.key === "F2") {
        const selId = useUIStore.getState().selectedElementId;
        if (selId) {
          const el = useModelStore.getState().elements[selId];
          if (el) {
            e.preventDefault();
            const nieuweNaam = window.prompt("Element hernoemen:", el.naam);
            if (nieuweNaam && nieuweNaam !== el.naam) {
              useModelStore.getState().updateElement(selId, { naam: nieuweNaam, data: { klassenaam: nieuweNaam } });
            }
            return;
          }
        }
        // Geen element geselecteerd → probeer actief diagram te hernoemen
        const activeDiagram = useUIStore.getState().activeDiagramId;
        if (activeDiagram) {
          const diag = useModelStore.getState().diagrams[activeDiagram];
          if (diag) {
            e.preventDefault();
            const nieuweNaam = window.prompt("Diagram hernoemen:", diag.naam || activeDiagram);
            if (nieuweNaam && nieuweNaam !== diag.naam) {
              useModelStore.getState().renameDiagram(activeDiagram, nieuweNaam);
            }
          }
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePubliceer]);

  // ── Rechtsklik domein → import/export ─────────────────────
  const handleImportDomein = useCallback((domein) => {
    setImportPrefillDomein(domein);
    setImportOpen(true);
  }, []);

  const handleExportDomein = useCallback((domein) => {
    setExportPrefillDomein(domein);
    setExportOpen(true);
  }, []);

  // ── Factory: bepaalt welk component in welke tab ─────────
  const factory = useCallback(
    (node) => {
      const component = node.getComponent();
      const config = node.getConfig() || {};

      switch (component) {
        case COMP_BROWSER:
          return (
            <ErrorBoundary label="ProjectBrowser">
              <ProjectBrowser
                onOpenDiagram={handleOpenDiagram}
                onCreateDiagram={handleNieuwDiagram}
                onImportDomein={handleImportDomein}
                onExportDomein={handleExportDomein}
              />
            </ErrorBoundary>
          );
        case COMP_DIAGRAM:
          return <ErrorBoundary label="DiagramCanvas"><DiagramCanvas diagramId={config.diagramId || "overzicht"} /></ErrorBoundary>;
        case COMP_PROPERTIES:
          return <ErrorBoundary label="DetailsPanel"><DetailsPanel /></ErrorBoundary>;
        case COMP_BESTANDEN:
          return <ErrorBoundary label="BestandenPanel"><BestandenPanel /></ErrorBoundary>;
        default:
          return <div style={{ padding: 16 }}>Onbekend component: {component}</div>;
      }
    },
    [handleNieuwDiagram, handleOpenDiagram, handleImportDomein, handleExportDomein]
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ide-body-bg, #1e1e1e)",
        color: "var(--ide-body-color, #ccc)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 12px",
          background: theme === "dark" ? "#2d2d2d" : "#e8e8e8",
          borderBottom: `1px solid ${theme === "dark" ? "#444" : "#ccc"}`,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <strong style={{ color: "#8cb4ff" }}>🏗 IDE</strong>
        <span style={{ color: theme === "dark" ? "#888" : "#999" }}>|</span>
        <span style={{ color: theme === "dark" ? "#aaa" : "#555" }}>{status}</span>
        {isDirty && <span style={{ color: "#f5c542", fontSize: 11, fontWeight: 600 }} title="Onopgeslagen wijzigingen">● Gewijzigd</span>}
        <span style={{ flex: 1 }} />
        <button onClick={toggleTheme} style={toolbarBtn} title={`Wissel naar ${theme === "dark" ? "licht" : "donker"} thema`}>
          {theme === "dark" ? "☀️ Licht" : "🌙 Donker"}
        </button>
        <span style={{ color: theme === "dark" ? "#555" : "#ccc" }}>|</span>
        <button onClick={() => useModelStore.temporal.getState().undo()} style={toolbarBtn} title="Ongedaan maken (Ctrl+Z)">
          ↩ Undo
        </button>
        <button onClick={() => useModelStore.temporal.getState().redo()} style={toolbarBtn} title="Opnieuw (Ctrl+Y)">
          ↪ Redo
        </button>
        <span style={{ color: theme === "dark" ? "#555" : "#ccc" }}>|</span>
        <button onClick={() => handleNieuwDiagram()} style={toolbarBtn}>
          ➕ Diagram
        </button>
        <button onClick={handleHerlaad} style={toolbarBtn}>
          🔄 Herlaad
        </button>
        <button onClick={handleImport} style={toolbarBtn}>
          📂 Importeer
        </button>
        <button onClick={() => setExportOpen(true)} style={toolbarBtn}>
          💾 Exporteer
        </button>
        <span style={{ color: theme === "dark" ? "#555" : "#ccc" }}>|</span>
        <button onClick={handleOpenBestanden} style={toolbarBtn} title="Bestanden bekijken en beheren">
          🗄 Bestanden
        </button>
        <button onClick={() => setUploadOpen(true)} style={toolbarBtn} title="Bestand uploaden">
          ⬆ Upload
        </button>
        <span style={{ color: theme === "dark" ? "#555" : "#ccc" }}>|</span>
        <button onClick={handlePubliceer} style={toolbarBtnAccent}>
          🚀 Publiceer
        </button>
        <button onClick={handleDiff} style={toolbarBtn} title="Delta-analyse: vergelijk editormodel met referentie">
          🔍 Delta
        </button>
        <button onClick={handleRebuild} style={toolbarBtnDanger}>
          ⚙️ Rebuild
        </button>
        <button onClick={handlePublishAndRebuild} style={toolbarBtnDanger}>
          🚀⚙️ Pub+Rebuild
        </button>
      </div>

      {/* FlexLayout */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Toast melding */}
        {toast && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              maxWidth: "80%",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              cursor: "pointer",
              background:
                toast.type === "success" ? "#1b5e20" :
                toast.type === "error" ? "#b71c1c" : "#1565c0",
              color: "#fff",
              border: `1px solid ${
                toast.type === "success" ? "#4caf50" :
                toast.type === "error" ? "#ef5350" : "#42a5f5"
              }`,
            }}
            onClick={() => setToast(null)}
            title="Klik om te sluiten"
          >
            <div>{toast.type === "success" ? "✅ " : toast.type === "error" ? "❌ " : "ℹ️ "}{toast.message}</div>
            {toast.stappen && toast.stappen.length > 0 && (
              <details style={{ marginTop: 6, fontSize: 12, fontWeight: 400, opacity: 0.9 }}>
                <summary style={{ cursor: "pointer" }}>{toast.stappen.length} stappen — klik voor details</summary>
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {toast.stappen.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
        <FlexLayout.Layout
          model={layoutModel}
          factory={factory}
          onModelChange={handleLayoutChange}
        />
      </div>

      {/* ActionDialog modal */}
      {dialogType && (
        <ActionDialog
          type={dialogType}
          values={dialogValues}
          validationErrors={validationResult.errors}
          validationWarnings={validationResult.warnings}
          diffResult={diffResult}
          diffLoading={diffLoading}
          onChange={handleDialogChange}
          onClose={() => { setDialogType(null); setDiffResult(null); setDiffLoading(false); }}
          onSubmit={handleDialogSubmit}
          onDiff={(dialogType === "rebuild" || dialogType === "publishAndRebuild") ? handlePreFlightDiff : undefined}
        />
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setStatus("Bestand geüpload ✓")}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportOpen}
        domains={domains || []}
        domainMeta={domainMeta || {}}
        modelVersie={modelMeta?.versie || ""}
        onExport={handleExportDialog}
        onUpdateVersie={handleExportUpdateVersie}
        onClose={() => { setExportOpen(false); setExportPrefillDomein(undefined); }}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importOpen}
        domains={domains || []}
        domainMeta={domainMeta || {}}
        prefillDomein={importPrefillDomein}
        onImport={handleImportResult}
        onClose={() => { setImportOpen(false); setImportPrefillDomein(undefined); }}
      />
    </div>
  );
}

function maakDiagramId(naam) {
  return (
    String(naam || "diagram")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "diagram"
  );
}

const toolbarBtn = {
  background: "var(--ide-controls-bg, #3c3c3c)",
  color: "var(--ide-controls-color, #ccc)",
  border: "1px solid var(--ide-controls-border, #555)",
  borderRadius: 3,
  padding: "3px 10px",
  cursor: "pointer",
  fontSize: 12,
};

const toolbarBtnAccent = {
  ...toolbarBtn,
  background: "#1a4a2e",
  color: "#8dff8d",
  border: "1px solid #3a7a4a",
};

const toolbarBtnDanger = {
  ...toolbarBtn,
  background: "#4a1a1a",
  color: "#ff8d8d",
  border: "1px solid #7a3a3a",
};
