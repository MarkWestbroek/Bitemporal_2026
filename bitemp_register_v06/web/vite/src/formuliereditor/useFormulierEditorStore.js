/**
 * useFormulierEditorStore — Zustand-store voor de visuele FormulierDefinitie-editor.
 *
 * Houdt de layout-boom, de selectie en per-veldpad de model-metadata (`veldInfo`)
 * bij die uit de palette (ModelPicker FieldRefs) komt. `veldInfo` voedt de
 * live-preview en de inspector (widget-defaults, datatype, ref-lijst).
 *
 * Undo/redo via snapshot-stacks (serialiseerbare JSON van de boom).
 */
import { create } from "zustand";
import {
  nieuwFormulier,
  nieuwElement,
  parseLayout,
  serializeLayout,
  serializeLayoutJson,
  voegToe,
  verwijder,
  updateElement,
  verplaats,
  vindElement,
  vindLijstMetBron,
  isContainer,
  valideer,
} from "./layoutModel";
import { saveFormulierDefinitie } from "./saveFormulierDefinitie";

const MAX_HISTORIE = 50;

export const useFormulierEditorStore = create((set, get) => ({
  root: nieuwFormulier(),
  selectieId: null,
  /** map veldpad → FieldRef-achtige metadata { veldnaam, datatype, type, format, enum, ref, entiteit } */
  veldInfo: {},
  /** metadata van de definitie zelf */
  meta: { naam: "", doeltype: "", beschrijving: "", definitieVersie: "0.1" },
  historie: [],
  toekomst: [],
  saveBusy: false,
  saveResultaat: null, // { type: "succes"|"fout", text }

  // ── interne helper: snapshot vóór wijziging ──
  _push(nieuweRoot) {
    const { root, historie } = get();
    const nieuweHist = [...historie, serializeLayout(root)].slice(-MAX_HISTORIE);
    set({ root: nieuweRoot, historie: nieuweHist, toekomst: [] });
  },

  setMeta(patch) {
    set((s) => ({ meta: { ...s.meta, ...patch } }));
  },

  /** Vervang de hele layout (bv. bij laden/importeren). */
  laadLayout(input, veldInfo = null) {
    const { root, fout } = parseLayout(input);
    if (fout || !root) return { fout };
    set({
      root,
      selectieId: null,
      historie: [],
      toekomst: [],
      ...(veldInfo ? { veldInfo } : {}),
    });
    return { fout: null };
  },

  selecteer(id) {
    set({ selectieId: id });
  },

  /**
   * Voeg een veld toe uit een FieldRef (palette-pick).
   * Plaatst het in het geselecteerde container-element, of aan de root.
   */
  voegVeldToe(ref) {
    if (!ref?.veldpad) return;
    const { root, selectieId, veldInfo, meta } = get();
    // Doeltype automatisch afleiden uit het eerste gekozen veld (nodig bij opslaan).
    if (!meta.doeltype && ref.entiteit) set({ meta: { ...meta, doeltype: ref.entiteit } });
    const infoEntry = {
      veldnaam: ref.veldnaam,
      entiteit: ref.entiteit,
      datatype: ref.datatype || "",
      type: ref.type || "string",
      format: ref.format || "",
      enum: Array.isArray(ref.enum) ? ref.enum : [],
      ref: ref.ref || "",
      momentvoorkomen: ref.momentvoorkomen || "",
    };

    // 1) Pick van het collectie-veld zelf (array-typed entiteitveld, bv.
    //    "bijdragen") → maak/selecteer een lege `lijst` met dit pad als bron.
    if (ref.format === "array" && ref.veldpad) {
      const bestaand = vindLijstMetBron(root, ref.veldpad);
      if (bestaand) {
        set({ selectieId: bestaand._id });
        return;
      }
      const lijst = nieuwElement("lijst", { bron: ref.veldpad, label: ref.veldnaam });
      get()._push(voegToe(root, bepaalDoelContainer(root, selectieId), lijst));
      set({ selectieId: lijst._id });
      return;
    }

    let nieuweRoot;
    let nieuweSelectie;

    // 2) Blad-veld uit een meervoudig GE → in een `lijst` gebonden aan het GE
    //    (bron = entiteit.rol). Binnen de lijst adresseren velden RELATIEF
    //    (alleen de veldnaam); de veldInfo blijft op het volle pad gekeyed.
    if (ref.momentvoorkomen === "meervoudig" && ref.gepad) {
      const veldEl = nieuwElement("veld", { veld: ref.veldnaam });
      const bestaand = vindLijstMetBron(root, ref.gepad);
      if (bestaand) {
        nieuweRoot = voegToe(root, bestaand._id, veldEl);
      } else {
        const lijst = nieuwElement("lijst", { bron: ref.gepad, label: ref.gepad.split(".").pop() });
        lijst.elementen.push(veldEl);
        nieuweRoot = voegToe(root, bepaalDoelContainer(root, selectieId), lijst);
      }
      nieuweSelectie = veldEl._id;
    } else {
      // 3) Enkelvoudig veld → plat op het volle pad.
      const el = nieuwElement("veld", { veld: ref.veldpad });
      nieuweRoot = voegToe(root, bepaalDoelContainer(root, selectieId), el);
      nieuweSelectie = el._id;
    }

    get()._push(nieuweRoot);
    set({ veldInfo: { ...veldInfo, [ref.veldpad]: infoEntry }, selectieId: nieuweSelectie });
  },

  /** Voeg een groep/rij/conditioneel toe (leeg). */
  voegContainerToe(type) {
    const { root, selectieId } = get();
    const parentId = bepaalDoelContainer(root, selectieId);
    const extra = type === "groep" ? { label: "Nieuwe groep" } : {};
    const el = nieuwElement(type, extra);
    get()._push(voegToe(root, parentId, el));
    set({ selectieId: el._id });
  },

  update(id, patch) {
    get()._push(updateElement(get().root, id, patch));
  },

  verwijderElement(id) {
    const { root, selectieId } = get();
    get()._push(verwijder(root, id));
    if (selectieId === id) set({ selectieId: null });
  },

  schuif(id, richting) {
    get()._push(verplaats(get().root, id, richting));
  },

  undo() {
    const { historie, toekomst, root } = get();
    if (historie.length === 0) return;
    const vorige = historie[historie.length - 1];
    const { root: vorigeRoot } = parseLayout(vorige);
    set({
      root: vorigeRoot,
      historie: historie.slice(0, -1),
      toekomst: [serializeLayout(root), ...toekomst].slice(0, MAX_HISTORIE),
      selectieId: null,
    });
  },

  redo() {
    const { historie, toekomst, root } = get();
    if (toekomst.length === 0) return;
    const volgende = toekomst[0];
    const { root: volgendeRoot } = parseLayout(volgende);
    set({
      root: volgendeRoot,
      historie: [...historie, serializeLayout(root)].slice(-MAX_HISTORIE),
      toekomst: toekomst.slice(1),
      selectieId: null,
    });
  },

  reset() {
    set({ root: nieuwFormulier(), selectieId: null, historie: [], toekomst: [], saveResultaat: null });
  },

  /** Sla de definitie op als nieuwe FormulierDefinitie in het register. */
  async saveNaarRegister(baseUrl) {
    const { meta, saveBusy } = get();
    if (saveBusy) return;
    set({ saveBusy: true, saveResultaat: null });
    try {
      const { id } = await saveFormulierDefinitie(baseUrl, { meta, layoutJson: get().json(false) });
      set({ saveResultaat: { type: "succes", text: `Opgeslagen als FormulierDefinitie #${id}` } });
    } catch (e) {
      set({ saveResultaat: { type: "fout", text: e.message } });
    } finally {
      set({ saveBusy: false });
    }
  },

  // ── afgeleiden ──
  json(ingesprongen = true) {
    return serializeLayoutJson(get().root, ingesprongen);
  },
  meldingen() {
    const { root, veldInfo } = get();
    const bekend = new Set(Object.keys(veldInfo));
    return valideer(root, bekend);
  },
}));

/**
 * Bepaal in welk container-element een nieuw element moet komen op basis van
 * de huidige selectie. Selectie = container → daarin; selectie = niet-container
 * → in de parent; geen selectie → root.
 */
function bepaalDoelContainer(root, selectieId) {
  if (!selectieId) return root._id;
  const info = vindElement(root, selectieId);
  if (!info) return root._id;
  if (isContainer(info.element)) return info.element._id;
  return info.parent ? info.parent._id : root._id;
}
