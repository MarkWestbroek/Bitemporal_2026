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
  isContainer,
  valideer,
} from "./layoutModel";

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
    const { root, selectieId, veldInfo } = get();
    const parentId = bepaalDoelContainer(root, selectieId);
    const el = nieuwElement("veld", { veld: ref.veldpad });
    get()._push(voegToe(root, parentId, el));
    // model-metadata onthouden voor preview/inspector
    set({
      veldInfo: {
        ...veldInfo,
        [ref.veldpad]: {
          veldnaam: ref.veldnaam,
          entiteit: ref.entiteit,
          datatype: ref.datatype || "",
          type: ref.type || "string",
          format: ref.format || "",
          enum: Array.isArray(ref.enum) ? ref.enum : [],
          ref: ref.ref || "",
        },
      },
      selectieId: el._id,
    });
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
    set({ root: nieuwFormulier(), selectieId: null, historie: [], toekomst: [] });
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
