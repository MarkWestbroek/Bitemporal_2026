/**
 * FormulierInspector — Inspector-slot: eigenschappen van het geselecteerde
 * layout-element (of de definitie-metadata als niets geselecteerd is / de root).
 */
import React from "react";
import { useFormulierEditorStore } from "./useFormulierEditorStore";
import { vindElement } from "./layoutModel";

const veldStijl = {
  width: "100%", boxSizing: "border-box", padding: "4px 6px", fontSize: 13,
  border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 5,
  background: "var(--s-bg, #fff)", color: "inherit",
};
const labelStijl = { display: "block", fontSize: 11.5, color: "var(--s-fg-muted, #64748b)", margin: "10px 0 3px" };

function Regel({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStijl}>{label}</span>
      {children}
    </label>
  );
}

const BREEDTES = ["", "50%", "33%", "25%", "100%"];
const WIDGETS = ["", "json", "markdown"];
const CONDITIE_OPS = [
  { v: "nietleeg", t: "is ingevuld" },
  { v: "leeg", t: "is leeg" },
  { v: "==", t: "gelijk aan" },
  { v: "!=", t: "niet gelijk aan" },
];

export default function FormulierInspector() {
  const root = useFormulierEditorStore((s) => s.root);
  const selectieId = useFormulierEditorStore((s) => s.selectieId);
  const veldInfo = useFormulierEditorStore((s) => s.veldInfo);
  const meta = useFormulierEditorStore((s) => s.meta);
  const setMeta = useFormulierEditorStore((s) => s.setMeta);
  const update = useFormulierEditorStore((s) => s.update);

  const info = selectieId ? vindElement(root, selectieId) : null;
  const el = info?.element;

  // Geen selectie of root → definitie-metadata bewerken.
  if (!el || el.type === "formulier") {
    return (
      <div className="studio-inspector-pad">
        <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Formulierdefinitie</h3>
        <Regel label="Naam">
          <input style={veldStijl} value={meta.naam} onChange={(e) => setMeta({ naam: e.target.value })} placeholder="bv. Initiatief voorbeeldformulier" />
        </Regel>
        <Regel label="Doeltype (ENT)">
          <input style={veldStijl} value={meta.doeltype} onChange={(e) => setMeta({ doeltype: e.target.value })} placeholder="bv. Initiatief" />
        </Regel>
        <Regel label="Beschrijving">
          <textarea style={{ ...veldStijl, minHeight: 54 }} value={meta.beschrijving} onChange={(e) => setMeta({ beschrijving: e.target.value })} />
        </Regel>
        <Regel label="Definitie-versie">
          <input style={veldStijl} value={meta.definitieVersie} onChange={(e) => setMeta({ definitieVersie: e.target.value })} />
        </Regel>
        <p style={{ marginTop: 14, fontSize: 12, color: "var(--s-fg-muted, #94a3b8)" }}>
          Selecteer een element in de structuur om het te bewerken.
        </p>
      </div>
    );
  }

  return (
    <div className="studio-inspector-pad">
      <h3 style={{ margin: "0 0 2px", fontSize: 13, textTransform: "capitalize" }}>{el.type}</h3>

      {el.type === "groep" && (
        <>
          <Regel label="Label (heading)">
            <input style={veldStijl} value={el.label || ""} onChange={(e) => update(el._id, { label: e.target.value })} />
          </Regel>
          <Regel label="Pad-context (shorthand, optioneel)">
            <input style={veldStijl} value={el.context || ""} onChange={(e) => update(el._id, { context: e.target.value })} placeholder="bv. Initiatief.Product" />
          </Regel>
        </>
      )}

      {el.type === "veld" && (
        <>
          <Regel label="Veldpad (model-adres)">
            <input style={{ ...veldStijl, fontFamily: "monospace", color: "var(--s-fg-muted, #64748b)" }} value={el.veld || ""} readOnly />
          </Regel>
          <Regel label="Label (override, leeg = veldnaam)">
            <div style={{ display: "flex", gap: 4 }}>
              <input
                style={veldStijl}
                value={el.label || ""}
                onChange={(e) => update(el._id, { label: e.target.value })}
                placeholder={veldInfo[el.veld]?.veldnaam || ""}
                title="Ctrl+Spatie vult de veldnaam in"
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.code === "Space") {
                    e.preventDefault();
                    const naam = veldInfo[el.veld]?.veldnaam;
                    if (naam) update(el._id, { label: naam });
                  }
                }}
              />
              <button
                type="button"
                title="Vul de veldnaam in als label"
                onClick={() => { const naam = veldInfo[el.veld]?.veldnaam; if (naam) update(el._id, { label: naam }); }}
                style={{ flex: "0 0 auto", border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-bg, #fff)", color: "var(--s-fg, #1e293b)", borderRadius: 5, padding: "0 8px", cursor: "pointer", fontSize: 12 }}
              >
                naam
              </button>
            </div>
          </Regel>
          <Regel label="Breedte">
            <select style={veldStijl} value={el.breedte || ""} onChange={(e) => update(el._id, { breedte: e.target.value })}>
              {BREEDTES.map((b) => <option key={b} value={b}>{b || "auto (vol)"}</option>)}
            </select>
          </Regel>
          <Regel label="Widget (override)">
            <select style={veldStijl} value={el.widget || ""} onChange={(e) => update(el._id, { widget: e.target.value })}>
              {WIDGETS.map((w) => <option key={w} value={w}>{w || "default (datatype)"}</option>)}
            </select>
          </Regel>
          <Regel label="Beschrijving (helptekst)">
            <input style={veldStijl} value={el.beschrijving || ""} onChange={(e) => update(el._id, { beschrijving: e.target.value })} />
          </Regel>
          {veldInfo[el.veld] && (
            <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--s-fg-muted, #64748b)", lineHeight: 1.6 }}>
              <div>type: <b>{veldInfo[el.veld].type || "string"}</b>{veldInfo[el.veld].format ? ` (${veldInfo[el.veld].format})` : ""}</div>
              {veldInfo[el.veld].datatype && <div>datatype: <b>{veldInfo[el.veld].datatype}</b></div>}
              {veldInfo[el.veld].ref && <div>keuze uit referentielijst: <b>{veldInfo[el.veld].ref}</b></div>}
              {veldInfo[el.veld].enum?.length > 0 && <div>enum: {veldInfo[el.veld].enum.join(", ")}</div>}
            </div>
          )}
        </>
      )}

      {el.type === "conditioneel" && (
        <ConditieEditor el={el} update={update} veldInfo={veldInfo} />
      )}

      {el.type === "rij" && (
        <p style={{ fontSize: 12, color: "var(--s-fg-muted, #94a3b8)" }}>
          Een rij plaatst zijn velden naast elkaar. Zet per veld een breedte (bv. 50%).
        </p>
      )}

      {el.type === "lijst" && (
        <>
          <p style={{ fontSize: 12, color: "var(--s-fg-muted, #94a3b8)", margin: "2px 0 4px" }}>
            Herhaalbare sectie voor een <b>meervoudig</b> GE/relatie. De invuller kan 0..N items
            toevoegen. Velden hierbinnen adresseren relatief aan de bron.
          </p>
          <Regel label="Label">
            <input style={veldStijl} value={el.label || ""} onChange={(e) => update(el._id, { label: e.target.value })} />
          </Regel>
          <Regel label="Bron (ENT.GE — meervoudig pad)">
            <input style={{ ...veldStijl, fontFamily: "monospace" }} value={el.bron || ""} onChange={(e) => update(el._id, { bron: e.target.value })} placeholder="bv. Initiatief.bijdragen" />
          </Regel>
        </>
      )}
    </div>
  );
}

function ConditieEditor({ el, update, veldInfo }) {
  // Migreer een oude string-`als` naar een conditie-object bij eerste bewerking.
  const conditie = el.conditie || { veld: "", op: "nietleeg", waarde: "" };
  const zet = (patch) => update(el._id, { conditie: { ...conditie, ...patch }, als: undefined });
  const padOpties = Object.keys(veldInfo);
  const toonWaarde = conditie.op === "==" || conditie.op === "!=";

  return (
    <>
      <p style={{ fontSize: 12, color: "var(--s-fg-muted, #94a3b8)", margin: "2px 0 4px" }}>
        Toon de inhoud alleen als de conditie waar is.
      </p>
      <Regel label="Veld">
        <input style={{ ...veldStijl, fontFamily: "monospace" }} list="cond-paden" value={conditie.veld || ""} onChange={(e) => zet({ veld: e.target.value })} placeholder="ENT.GE.veld" />
        <datalist id="cond-paden">{padOpties.map((p) => <option key={p} value={p} />)}</datalist>
      </Regel>
      <Regel label="Operator">
        <select style={veldStijl} value={conditie.op || "nietleeg"} onChange={(e) => zet({ op: e.target.value })}>
          {CONDITIE_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
      </Regel>
      {toonWaarde && (
        <Regel label="Waarde">
          <input style={veldStijl} value={conditie.waarde || ""} onChange={(e) => zet({ waarde: e.target.value })} />
        </Regel>
      )}
    </>
  );
}
