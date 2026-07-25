/**
 * ModelPicker — herbruikbaar React-paneel dat het canoniek model (MetaRegistry /
 * V3 JSON) toont als boom Domein → Entiteit → GE → Veld, en velden laat kiezen
 * of slepen als FieldRef.
 *
 * Onderdeel van de "driehoek proces – regels – data": dit ene component wordt
 * gebruikt in de DMN-editor (input/output-binding), de BPMN-editor
 * (berichttype-samenstelling) en overal waar een veldreferentie nodig is.
 * Zie process_engine_v01/docs/driehoek-proces-regels-data.md.
 *
 * Datacontract: een FieldRef (zie modelTree.js → maakFieldRef).
 *
 * Gebruik (zelfstandig, haalt zelf het schema op):
 *   <ModelPicker baseUrl="http://localhost:8082" onPick={(ref) => ...} />
 *
 * Gebruik (met vooraf opgehaalde types, bv. uit SchemaContext):
 *   <ModelPicker injectedTypes={types} onPick={(ref) => ...} />
 *
 * Drag-and-drop: elk veld is een drag-source. De FieldRef wordt als JSON gezet
 * op MIME-type "application/x-canoniek-fieldref" (en als text/plain fallback).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSchemaModel } from "./useSchemaModel";
import { modelPickerConfig } from "./modelpicker.config.js";
import { bouwModelTree, filterTree, fieldRefKey, safeArray } from "./modelTree";
import "./modelpicker.css";

export const FIELDREF_MIME = "application/x-canoniek-fieldref";

function VeldRij({ knoop, geselecteerd, onPick, multiSelect, focus }) {
  const ref = knoop.ref;
  const rijRef = useRef(null);

  // Element-focus vanuit een editor ("toon in modelboom"): scroll in beeld.
  useEffect(() => {
    if (focus) rijRef.current?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  const onDragStart = (e) => {
    const payload = JSON.stringify(ref);
    e.dataTransfer.setData(FIELDREF_MIME, payload);
    e.dataTransfer.setData("text/plain", ref.veldpad);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      ref={rijRef}
      className={`mp-veld${geselecteerd ? " mp-selected" : ""}${focus ? " mp-focus" : ""}`}
      draggable
      onDragStart={onDragStart}
      title={knoop.afleidingsregel ? `${ref.veldpad}\n${knoop.afleidingsregelTaal}: ${knoop.afleidingsregel}` : ref.veldpad}
      onDoubleClick={() => onPick?.(ref)}
    >
      <span className={`mp-veld-naam${ref.afgeleid ? " mp-afgeleid" : ""}`}>
        {ref.afgeleid && <span className="mp-afgeleid-prefix">/</span>}
        {ref.veldnaam}
      </span>
      <span className="mp-badges">
        {ref.datatype && <span className="mp-badge mp-badge-datatype">{ref.datatype}</span>}
        {!ref.datatype && ref.type && <span className="mp-badge">{ref.type}</span>}
        {ref.format && <span className="mp-badge">{ref.format}</span>}
        {ref.ref && <span className="mp-badge mp-badge-ref">↗ {ref.ref}</span>}
        {safeArray(ref.enum).length > 0 && (
          <span className="mp-badge mp-badge-enum" title={ref.enum.join(", ")}>
            enum {ref.enum.length}
          </span>
        )}
        <span className="mp-badge mp-badge-dim">{ref.tDimensie === "materieel" ? "t_m" : "t_f"}</span>
        <button
          type="button"
          className="mp-pick-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPick?.(ref);
          }}
        >
          {multiSelect ? (geselecteerd ? "−" : "+") : "kies"}
        </button>
      </span>
    </div>
  );
}

function GERij({ ge, selectedKeys, onPick, multiSelect, focusVeldpad }) {
  const [open, setOpen] = useState(false);
  const heeftVelden = safeArray(ge.velden).length > 0;
  // Element-focus: klap open als het gefocuste veld (of deze GE als groep,
  // via het gepad) in deze tak zit; de rest van de boom blijft staan.
  const eigenFocus = !!focusVeldpad && safeArray(ge.velden)[0]?.ref?.gepad === focusVeldpad;
  const bevatFocus = !!focusVeldpad &&
    (eigenFocus || safeArray(ge.velden).some((knoop) => knoop.ref?.veldpad === focusVeldpad));
  useEffect(() => {
    if (bevatFocus && !eigenFocus) setOpen(true);
  }, [focusVeldpad]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mp-ge">
      <div className={`mp-row${eigenFocus ? " mp-focus" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span className="mp-caret">{heeftVelden ? (open ? "▾" : "▸") : "·"}</span>
        <span className="mp-ge-naam">{ge.rol}</span>
        <span className="mp-rol">
          {ge.metatype === "relatie" ? "relatie" : "GE"}
          {ge.momentvoorkomen ? ` · ${ge.momentvoorkomen}` : ""}
        </span>
      </div>
      {open && heeftVelden && (
        <div className="mp-children">
          {ge.velden.map((knoop) => (
            <VeldRij
              key={fieldRefKey(knoop.ref)}
              knoop={knoop}
              geselecteerd={selectedKeys.has(fieldRefKey(knoop.ref))}
              onPick={onPick}
              multiSelect={multiSelect}
              focus={knoop.ref?.veldpad === focusVeldpad}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function entiteitBevat(ent, focusVeldpad) {
  if (!focusVeldpad) return false;
  const typenaam = ent.type?.typenaam || "";
  return focusVeldpad === typenaam || focusVeldpad.startsWith(`${typenaam}.`);
}

function EntiteitRij({ ent, selectedKeys, onPick, multiSelect, defaultOpen, focusVeldpad }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const bevatFocus = entiteitBevat(ent, focusVeldpad);
  useEffect(() => {
    if (bevatFocus) setOpen(true);
  }, [focusVeldpad]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mp-entiteit">
      <div className="mp-row" onClick={() => setOpen((v) => !v)}>
        <span className="mp-caret">{open ? "▾" : "▸"}</span>
        <span className="mp-entiteit-naam">{ent.type.typenaam}</span>
        {ent.type.isMaterieel && <span className="mp-rol">materieel</span>}
      </div>
      {open && (
        <div className="mp-children">
          {ent.velden.map((knoop) => (
            <VeldRij
              key={fieldRefKey(knoop.ref)}
              knoop={knoop}
              geselecteerd={selectedKeys.has(fieldRefKey(knoop.ref))}
              onPick={onPick}
              multiSelect={multiSelect}
              focus={knoop.ref?.veldpad === focusVeldpad}
            />
          ))}
          {safeArray(ent.kinderen).map((ge) => (
            <GERij
              key={ge.type.typenaam + ":" + ge.rol}
              ge={ge}
              selectedKeys={selectedKeys}
              onPick={onPick}
              multiSelect={multiSelect}
              focusVeldpad={focusVeldpad}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DomeinRij({ domein, selectedKeys, onPick, multiSelect, defaultOpen, focusVeldpad }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const bevatFocus = !!focusVeldpad && domein.entiteiten.some((ent) => entiteitBevat(ent, focusVeldpad));
  useEffect(() => {
    if (bevatFocus) setOpen(true);
  }, [focusVeldpad]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mp-domein">
      <div className="mp-row" onClick={() => setOpen((v) => !v)}>
        <span className="mp-caret">{open ? "▾" : "▸"}</span>
        <span className="mp-domein-naam">{domein.naam}</span>
        <span className="mp-rol">{domein.entiteiten.length}</span>
      </div>
      {open && (
        <div className="mp-children">
          {domein.entiteiten.map((ent) => (
            <EntiteitRij
              key={ent.type.typenaam}
              ent={ent}
              selectedKeys={selectedKeys}
              onPick={onPick}
              multiSelect={multiSelect}
              defaultOpen={defaultOpen}
              focusVeldpad={focusVeldpad}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ModelPicker
 *
 * @param {object} props
 * @param {string}   [props.baseUrl=""]        basis-URL van het register (voor zelfstandige fetch)
 * @param {Array}    [props.injectedTypes]     vooraf opgehaalde types (slaat fetch over)
 * @param {(ref) => void} [props.onPick]       callback bij kiezen/dubbelklik/+ van een veld
 * @param {boolean}  [props.multiSelect=false] meervoudige selectie (voor berichttype-samenstelling)
 * @param {Array}    [props.selected=[]]       geselecteerde FieldRefs (controlled, alleen visueel)
 * @param {string}   [props.title="Canoniek model"] paneeltitel
 * @param {boolean}  [props.includeAfgeleid=true]   toon afgeleide velden
 * @param {boolean}  [props.expandDomeinen=false]   domeinen standaard uitgeklapt
 * @param {boolean}  [props.expandEntiteiten=false] entiteiten standaard uitgeklapt
 * @param {string[]} [props.hiddenDomains=[]]      domeinen die niet weergegeven mogen worden
 * @param {string}   [props.externeZoekterm]       zet de zoekterm van buitenaf (bv. "toon in
 *                                                 modelboom" vanuit een editor); de gebruiker
 *                                                 kan daarna gewoon verder typen/wissen
 * @param {string}   [props.focusVeldpad]          focus op één exact element ("Ent.rol.veld" of
 *                                                 "Ent.rol" voor een GE): de bevattende takken
 *                                                 klappen open, het element wordt gemarkeerd en
 *                                                 in beeld gescrold — de rest van de boom (en de
 *                                                 zoekterm) blijft staan, zodat de context
 *                                                 zichtbaar blijft
 */
export default function ModelPicker({
  baseUrl = "",
  injectedTypes = null,
  onPick,
  multiSelect = false,
  selected = [],
  title = "Canoniek model",
  includeAfgeleid = true,
  expandDomeinen = modelPickerConfig.defaultExpandDomeinen,
  expandEntiteiten = modelPickerConfig.defaultExpandEntiteiten,
  hiddenDomains = modelPickerConfig.hiddenDomains,
  externeZoekterm = null,
  focusVeldpad = null,
}) {
  const { types, loading, error } = useSchemaModel({ baseUrl, injectedTypes });
  const [zoekterm, setZoekterm] = useState("");
  useEffect(() => {
    if (externeZoekterm != null) setZoekterm(externeZoekterm);
  }, [externeZoekterm]);
  const [tDimensie, setTDimensie] = useState("formeel");
  const [toonAfgeleid, setToonAfgeleid] = useState(includeAfgeleid);
  const [toonTechnisch, setToonTechnisch] = useState(false);

  const tree = useMemo(
    () => bouwModelTree(types, { includeAfgeleid: toonAfgeleid, includeTechnisch: toonTechnisch, tDimensie, hiddenDomains }),
    [types, toonAfgeleid, toonTechnisch, tDimensie, hiddenDomains]
  );
  const zichtbaar = useMemo(() => filterTree(tree, zoekterm), [tree, zoekterm]);

  const selectedKeys = useMemo(() => {
    const set = new Set();
    safeArray(selected).forEach((ref) => set.add(fieldRefKey(ref)));
    return set;
  }, [selected]);

  return (
    <div className="mp-root">
      <div className="mp-header">
        <span className="mp-title">{title}</span>
        <div className="mp-controls">
          <input
            className="mp-search"
            type="text"
            placeholder="Zoek veld, type of datatype…"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
          />
          <div className="mp-dim" title="Bitemporele dimensie voor gekozen velden">
            <button
              type="button"
              className={tDimensie === "formeel" ? "mp-dim-active" : ""}
              onClick={() => setTDimensie("formeel")}
            >
              t_f formeel
            </button>
            <button
              type="button"
              className={tDimensie === "materieel" ? "mp-dim-active" : ""}
              onClick={() => setTDimensie("materieel")}
            >
              t_m materieel
            </button>
          </div>
          <label className="mp-toggle">
            <input
              type="checkbox"
              checked={toonAfgeleid}
              onChange={(e) => setToonAfgeleid(e.target.checked)}
            />
            afgeleide velden
          </label>
          <label className="mp-toggle" title="Technische velden (id, rel_id, versie, FK's) — plumbing, standaard verborgen">
            <input
              type="checkbox"
              checked={toonTechnisch}
              onChange={(e) => setToonTechnisch(e.target.checked)}
            />
            technische velden
          </label>
        </div>
      </div>

      <div className="mp-body">
        {loading && <div className="mp-loading">Schema laden…</div>}
        {error && <div className="mp-error">Schema laden mislukt: {error}</div>}
        {!loading && !error && zichtbaar.length === 0 && (
          <div className="mp-empty">Geen velden gevonden.</div>
        )}
        {!loading &&
          !error &&
          zichtbaar.map((domein) => (
            <DomeinRij
              key={domein.naam}
              domein={domein}
              selectedKeys={selectedKeys}
              onPick={onPick}
              multiSelect={multiSelect}
              defaultOpen={expandEntiteiten || Boolean(zoekterm)}
              focusVeldpad={focusVeldpad}
            />
          ))}
      </div>
    </div>
  );
}
