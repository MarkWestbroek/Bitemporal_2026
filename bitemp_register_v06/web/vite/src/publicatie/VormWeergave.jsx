import ImageMapKeuze from "../vormen/ImageMapKeuze";
import ButtonGroupKeuze from "../vormen/ButtonGroupKeuze";
import CardsKeuze from "../vormen/CardsKeuze";
import ChipsWeergave from "../vormen/ChipsWeergave";
import StepperKeuze from "../vormen/StepperKeuze";
import ScaleBarsWeergave from "../vormen/ScaleBarsWeergave";
import MatrixKeuze from "../vormen/MatrixKeuze";
import DragSortKeuze from "../vormen/DragSortKeuze";
import PeriodKeuze from "../vormen/PeriodKeuze";
import SwitchKeuze from "../vormen/SwitchKeuze";
import RangeKeuze from "../vormen/RangeKeuze";
import RotaryKeuze from "../vormen/RotaryKeuze";
import NlMapKeuze from "../vormen/NlMapKeuze";
import MaskedInvoer from "../vormen/MaskedInvoer";
import PartialDateInvoer from "../vormen/PartialDateInvoer";
import DurationInvoer from "../vormen/DurationInvoer";
import NumberStepper from "../vormen/NumberStepper";
import { ruweWaarde, alsSleutels, cbsGemeentecode, telSleutels } from "./vormBlokken";

/**
 * VormWeergave — één vormblok uit een detail-template ({{#vorm naam pad}}config{{/vorm}},
 * vormBlokken.js) als weergave: dezelfde vormen als in de formulieren, alleen-lezen, met de
 * waarde uit het record (ctx). De config volgt het configSchema van de vorm, plus paden
 * (…Field relatief aan de items, …Path vanaf het record, groups[].filter).
 *
 * Props: blok { naam, pad, config, fout }, ctx (het record, zoals voor {{…}})
 */
const niets = () => {};
const opties = (lijst) => (lijst || []).map((o) => (typeof o === "object" ? { value: String(o.value), label: o.label || String(o.value), ...o } : { value: String(o), label: String(o) }));

export default function VormWeergave({ blok, ctx }) {
  const { naam, pad, config = {}, fout } = blok;
  if (fout) return <div className="cg-feedback--fout" style={{ fontSize: "0.85rem" }}>{naam}: {fout}</div>;
  const waarde = pad ? ruweWaarde(ctx, pad) : null;
  const sleutels = alsSleutels(waarde);
  const stijl = { margin: "0.75rem 0" };

  switch (naam) {
    case "image-map":
      return <div style={stijl}><ImageMapKeuze config={{ legend: false, ...config }} meervoudig waarde={sleutels} readOnly onChange={niets} /></div>;
    case "chips":
      // Over een lijst (bv. de fasen van alle initiatieven van een organisatie) komen waarden
      // vaker voor: één chip per waarde, met `count: true` het aantal erachter.
      return <div style={stijl}><ChipsWeergave items={telSleutels(sleutels).map(({ sleutel, n }) => ({ value: sleutel, label: `${config.labels?.[sleutel] || sleutel}${config.count && n > 1 ? ` · ${n}` : ""}` }))} config={config} /></div>;
    case "button-group": {
      const items = config.options ? opties(config.options) : sleutels.map((s) => ({ value: s, label: s }));
      return <div style={stijl}><ButtonGroupKeuze items={items} config={config} meervoudig waarde={sleutels} readOnly onChange={niets} /></div>;
    }
    case "cards": {
      const items = config.options ? opties(config.options) : sleutels.map((s) => ({ value: s, label: s }));
      return <div style={stijl}><CardsKeuze items={items} config={config} meervoudig waarde={sleutels} readOnly onChange={niets} /></div>;
    }
    case "stepper": {
      const items = config.options ? opties(config.options) : Object.keys(config.labels || {}).map((v) => ({ value: v, label: v }));
      return <div style={stijl}><StepperKeuze items={items} config={config} waarde={sleutels[0] ?? ""} readOnly /></div>;
    }
    case "switch":
      return <div style={stijl}><SwitchKeuze waarde={waarde === true ? "true" : waarde === false ? "false" : String(waarde ?? "")} readOnly onChange={niets} config={config} /></div>;
    case "range":
    case "rotary": {
      const C = naam === "range" ? RangeKeuze : RotaryKeuze;
      const items = config.options ? opties(config.options) : undefined;
      return <div style={stijl}><C items={items} config={config} waarde={sleutels[0] ?? ""} readOnly onChange={niets} /></div>;
    }
    case "masked":
    case "partial-date":
    case "duration":
    case "number-stepper": {
      // Eén waarde, als leesbare tekst: "1234 AB", "juni 1975", "1 jaar en 2 maanden", "3 personen".
      const C = { masked: MaskedInvoer, "partial-date": PartialDateInvoer, duration: DurationInvoer, "number-stepper": NumberStepper }[naam];
      return <div style={stijl}><C waarde={Array.isArray(waarde) ? waarde[0] ?? "" : waarde ?? ""} readOnly onChange={niets} config={config} /></div>;
    }
    case "period":
      return <div style={stijl}><PeriodKeuze begin={ruweWaarde(ctx, config.startPath) ?? ""} einde={ruweWaarde(ctx, config.endPath) ?? ""} readOnly config={config} /></div>;
    case "scale-bars":
    case "rating-grid":
    case "drag-sort": {
      const rijen = Array.isArray(waarde) ? waarde : waarde ? [waarde] : [];
      const rowField = config.rowField || "type", columnField = config.columnField || "waarde";
      const waarden = {}, notities = {};
      for (const r of rijen) {
        const k = String(ruweWaarde(r, rowField) ?? "");
        if (!k || k in waarden) continue;
        waarden[k] = String(ruweWaarde(r, columnField) ?? "");
        if (config.noteField) notities[k] = ruweWaarde(r, config.noteField) || "";
      }
      const rows = config.rows ? opties(config.rows) : Object.keys(waarden).map((v) => ({ value: v, label: v }));
      const columns = opties(config.columns);
      if (naam === "scale-bars") return <div style={stijl}><ScaleBarsWeergave rows={rows} columns={columns} waarden={waarden} notities={notities} /></div>;
      if (naam === "rating-grid") return <div style={stijl}><MatrixKeuze rows={rows} columns={columns} waarden={waarden} readOnly required onChange={niets} /></div>;
      return <div style={stijl}><DragSortKeuze rows={rows} columns={columns} waarden={waarden} readOnly onChange={niets} /></div>;
    }
    case "nl-map": {
      // Items onder het pad (bv. initiatief_gemeenten), elk met een CBS-code en een naam; groepen
      // (bv. Realiseert / Maakt gebruik van) als kleuren.
      const items = Array.isArray(waarde) ? waarde : waarde ? [waarde] : [];
      const codeVan = (it) => [].concat((typeof it === "object" ? ruweWaarde(it, config.codeField || "code") : it) ?? []).map(cbsGemeentecode).filter(Boolean);
      const naamVan = (it) => (typeof it === "object" ? ruweWaarde(it, config.labelField || "naam") : it);
      const uniek = new Map();
      for (const it of items) {
        const code = [].concat(codeVan(it) ?? [])[0];
        if (code && !uniek.has(code)) uniek.set(code, { value: code, code, label: [].concat(naamVan(it) ?? [code])[0] });
      }
      const groepen = Array.isArray(config.groups) ? config.groups.map((g) => ({
        label: g.label, color: g.color || "#e11d48",
        waarden: items.filter((it) => Object.entries(g.filter || {}).every(([k, v]) => String(ruweWaarde(it, k) ?? "") === String(v))).map((it) => [].concat(codeVan(it) ?? [])[0]).filter(Boolean),
      })) : null;
      return <div style={stijl}><NlMapKeuze items={[...uniek.values()]} meervoudig waarde={[...uniek.keys()]} readOnly groepen={groepen} config={config} /></div>;
    }
    default:
      return <div className="cg-feedback--fout" style={{ fontSize: "0.85rem" }}>Onbekende weergavevorm: {naam}</div>;
  }
}
