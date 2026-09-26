import { useState } from "react";
import { createRoot } from "react-dom/client";
import { VORMEN, INVOERSOORT, valideerVormConfig, splitsLijst, voegLijstSamen } from "../vormen";
import ImageMapKeuze from "../ImageMapKeuze";
import ButtonGroupKeuze from "../ButtonGroupKeuze";
import MatrixKeuze from "../MatrixKeuze";
import SwitchKeuze from "../SwitchKeuze";
import RangeKeuze from "../RangeKeuze";
import RotaryKeuze from "../RotaryKeuze";
import StepperKeuze from "../StepperKeuze";
import CardsKeuze from "../CardsKeuze";
import ChipsWeergave from "../ChipsWeergave";
import DragSortKeuze from "../DragSortKeuze";
import ScaleBarsWeergave from "../ScaleBarsWeergave";
import PeriodKeuze from "../PeriodKeuze";
import AddressSearch from "../AddressSearch";
import NlMapKeuze from "../NlMapKeuze";
import * as D from "./voorbeelddata";

import "@utrecht/component-library-css";
import "@utrecht/design-tokens/dist/index.css";
import "../../styles/common-ground-theme.css";

/**
 * Vormenbibliotheek (vormen.html) — elke vorm in invoer- en weergavestand, met wat er
 * werkelijk wordt OPGESLAGEN (de inhoud) en de vormConfig, gecontroleerd tegen het schema.
 * Losse pagina zonder API (alleen de adreszoeker praat met PDOK). Om te bekijken, te testen
 * en om naar een vormenmodel te abstraheren (ontwerp §9b).
 */

function Kaart({ naam, invoersoort, config, opgeslagen, invoer, weergave, noot }) {
  const v = VORMEN[naam];
  const fouten = config ? valideerVormConfig(naam, config) : [];
  const labelId = `lbl-${naam}`;
  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: 10 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <h2 id={labelId} style={{ margin: 0, fontSize: "1.1rem" }}>{v?.label || naam} <code style={{ fontSize: "0.8rem", color: "#6366f1" }}>{naam}</code></h2>
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
          {invoersoort} · {v?.modi.join(" + ")} · v{v?.version}
        </span>
      </header>
      <p style={{ margin: 0, fontSize: "0.9rem", color: "#475569" }}>{v?.help}{noot ? ` ${noot}` : ""}</p>
      {invoer && (<div><Kop>Invoer</Kop>{invoer(labelId)}</div>)}
      {weergave && (<div><Kop>Weergave</Kop>{weergave(labelId)}</div>)}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: "0.78rem" }}>
        <div style={{ flex: "1 1 220px", background: "#f8fafc", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
          <strong>Opgeslagen (inhoud)</strong>
          <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(opgeslagen, null, 1)}</pre>
        </div>
        {config && (
          <details style={{ flex: "1 1 220px", background: "#f8fafc", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
            <summary style={{ cursor: "pointer" }}><strong>vormConfig</strong> {fouten.length ? <span style={{ color: "#dc2626" }}>· {fouten.length} fout(en)</span> : <span style={{ color: "#16a34a" }}>· volgens schema</span>}</summary>
            <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>{JSON.stringify(config, null, 1)}</pre>
            {fouten.map((f) => <div key={f} style={{ color: "#dc2626" }}>{f}</div>)}
          </details>
        )}
      </div>
    </section>
  );
}
const Kop = ({ children }) => <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", fontWeight: 700, margin: "4px 0 6px" }}>{children}</div>;

function Showcase() {
  const [lagen, setLagen] = useState("Laag 2;Laag 1");
  const [api, setApi] = useState(["1", "7", "28"]);
  const [type, setType] = useState("Toepassing");
  const [matrix, setMatrix] = useState({ Wendbaarheid: "Schaal 3", Dienstverlening: "Schaal 1" });
  const [noten] = useState({ Wendbaarheid: "Minder maatwerk per koppeling.", Dienstverlening: "Eerste stap; inwoners merken het nog weinig." });
  const [sorteer, setSorteer] = useState({ 1: "nu", 2: "nu", 6: "gepland" });
  const [vervangt, setVervangt] = useState("true");
  const [schaal, setSchaal] = useState("Schaal 3");
  const [tevreden, setTevreden] = useState("7");
  const [fase, setFase] = useState(D.FASEN[2].value);
  const [periode, setPeriode] = useState({ begin: "2026-03-01", einde: "2027-06-30" });
  const [adres, setAdres] = useState({});
  const [gemeenten, setGemeenten] = useState(["GM0344", "GM1959", "GM1900"]);

  const lagenItems = D.LAGEN.map((v) => ({ value: v, label: v }));
  const sorteerRijen = D.API_STANDAARDEN.slice(0, 8);
  const manden = [{ value: "nu", label: "Gebruikt nu", color: "#22c55e" }, { value: "gepland", label: "Gepland", color: "#f59e0b" }, { value: "niet", label: "Niet van toepassing", color: "#94a3b8" }];
  const apiItems = D.API_STANDAARDEN;
  const rangeConfig = { colors: D.SCHAAL_KLEUREN };
  const rotaryConfig = { min: 1, max: 10, step: 1 };

  const kaarten = [
    <Kaart key="im" naam="image-map" invoersoort="meer uit een lijst (één veld, EnumLijst)" config={D.LAGEN_CONFIG}
      opgeslagen={{ CG_laag: lagen }}
      invoer={(l) => <ImageMapKeuze config={D.LAGEN_CONFIG} opties={D.LAGEN} meervoudig waarde={splitsLijst(lagen)} onChange={(s) => setLagen(voegLijstSamen(s, ";", D.LAGEN))} labelId={l} />}
      weergave={() => <ImageMapKeuze config={{ ...D.LAGEN_CONFIG, maxWidth: "240px", legend: false }} opties={D.LAGEN} meervoudig waarde={splitsLijst(lagen)} onChange={() => {}} readOnly />} />,
    <Kaart key="bg" naam="button-group" invoersoort="meer uit een lijst (rijen)" config={{ sort: "alpha", sortToggle: true, orderLabel: "Volgorde van registratie" }}
      opgeslagen={{ initiatief_api_standaarden: api.map((id) => ({ apistandaard_id: id })) }}
      invoer={(l) => <ButtonGroupKeuze items={apiItems} config={{ sort: "alpha", sortToggle: true, orderLabel: "Volgorde van registratie" }} meervoudig waarde={api} onChange={setApi} labelId={l} />}
      weergave={() => <ChipsWeergave items={apiItems.filter((i) => api.includes(i.value))} />} noot="Weergave: als labels (chips)." />,
    <Kaart key="cards" naam="cards" invoersoort="één uit een lijst" config={D.PRODUCTTYPE_KAARTEN}
      opgeslagen={{ "producten.type": type }}
      invoer={(l) => <CardsKeuze items={D.PRODUCTTYPEN} config={D.PRODUCTTYPE_KAARTEN} waarde={type} onChange={setType} labelId={l} />}
      weergave={() => <CardsKeuze items={D.PRODUCTTYPEN.filter((i) => i.value === type)} config={{ ...D.PRODUCTTYPE_KAARTEN, columns: 1 }} waarde={type} readOnly onChange={() => {}} />} />,
    <Kaart key="rg" naam="rating-grid" invoersoort="één uit een lijst per rij" config={{ rows: D.BIJDRAGEN.map(({ value, description }) => ({ value, description })), columns: D.SCHAAL.map((c, i) => ({ ...c, color: D.SCHAAL_KLEUREN[i] })) }}
      opgeslagen={{ bijdragen: Object.entries(matrix).map(([t, s]) => ({ type_bijdrage: t, schaal: s })) }}
      invoer={(l) => <MatrixKeuze rows={D.BIJDRAGEN} columns={D.SCHAAL.map((c, i) => ({ ...c, color: D.SCHAAL_KLEUREN[i] }))} waarden={matrix} onChange={(r, k) => setMatrix((m) => ({ ...m, [r]: k }))} hoekLabel="Doel" kolomLabel="Schaal" labelId={l} />} />,
    <Kaart key="sb" naam="scale-bars" invoersoort="één uit een lijst per rij (weergave)" config={{ noteField: "toelichting" }}
      opgeslagen={{ bijdragen: Object.entries(matrix).map(([t, s]) => ({ type_bijdrage: t, schaal: s, toelichting: noten[t] || "" })) }}
      weergave={() => <ScaleBarsWeergave rows={D.BIJDRAGEN} columns={D.SCHAAL.map((c, i) => ({ ...c, color: D.SCHAAL_KLEUREN[i] }))} waarden={matrix} notities={noten} />}
      noot="Dezelfde data als de matrix hierboven; pas de matrix aan en deze balken volgen." />,
    <Kaart key="ds" naam="drag-sort" invoersoort="één uit een lijst per rij" config={{ columns: manden, stockLabel: "Nog te sorteren" }}
      opgeslagen={{ rijen: Object.entries(sorteer).map(([id, mand]) => ({ apistandaard_id: id, status: mand })) }}
      invoer={(l) => <DragSortKeuze rows={sorteerRijen} columns={manden} waarden={sorteer} onChange={(r, k) => setSorteer((s) => { const n = { ...s }; if (k) n[r] = k; else delete n[r]; return n; })} labelId={l} />}
      weergave={() => <DragSortKeuze rows={sorteerRijen} columns={manden} waarden={sorteer} readOnly onChange={() => {}} />}
      noot="Zelfde inhoud als de matrix: per ding één mand. Slepen, of klikken op een kaart en dan op een mand." />,
    <Kaart key="sw" naam="switch" invoersoort="ja/nee" config={{ onLabel: "Vervangt een ouder product", offLabel: "Nieuw product" }}
      opgeslagen={{ "producten.vervangt_ouder_product": vervangt }}
      invoer={(l) => <SwitchKeuze waarde={vervangt} onChange={setVervangt} labelId={l} config={{ onLabel: "Vervangt een ouder product", offLabel: "Nieuw product" }} />}
      weergave={() => <SwitchKeuze waarde={vervangt} readOnly onChange={() => {}} config={{ onLabel: "Vervangt een ouder product", offLabel: "Nieuw product" }} />} />,
    <Kaart key="ra" naam="range" invoersoort="één uit een geordende lijst" config={rangeConfig}
      opgeslagen={{ schaal }}
      invoer={(l) => <RangeKeuze items={D.SCHAAL} config={rangeConfig} waarde={schaal} onChange={setSchaal} labelId={l} />}
      weergave={() => <RangeKeuze items={D.SCHAAL} config={rangeConfig} waarde={schaal} readOnly onChange={() => {}} />} />,
    <Kaart key="ro" naam="rotary" invoersoort="getal (1–10)" config={rotaryConfig}
      opgeslagen={{ tevredenheid: tevreden }}
      invoer={(l) => <RotaryKeuze config={rotaryConfig} waarde={tevreden} onChange={setTevreden} labelId={l} />}
      weergave={() => <RotaryKeuze config={{ ...rotaryConfig, size: 64 }} waarde={tevreden} readOnly onChange={() => {}} />}
      noot="Omhoog slepen, scrollen of pijltjes. Ook voor een geordende lijst (bijv. de schaal)." />,
    <Kaart key="st" naam="stepper" invoersoort="één uit een geordende lijst" config={{ labels: D.FASE_LABELS }}
      opgeslagen={{ "planningen.fase": fase }}
      invoer={(l) => <StepperKeuze items={D.FASEN} config={{ labels: D.FASE_LABELS }} waarde={fase} onChange={setFase} labelId={l} />}
      weergave={() => <StepperKeuze items={D.FASEN} config={{ labels: D.FASE_LABELS }} waarde={fase} readOnly />} />,
    <Kaart key="pe" naam="period" invoersoort="samengesteld (begin + einde)" config={{ startField: "Initiatief.planningen.startdatum", endField: "Initiatief.planningen.ready_for_use", startLabel: "Start", endLabel: "Ready for use" }}
      opgeslagen={{ "planningen.startdatum": periode.begin, "planningen.ready_for_use": periode.einde }}
      invoer={(l) => <PeriodKeuze begin={periode.begin} einde={periode.einde} onChange={setPeriode} labelId={l} config={{ startLabel: "Start", endLabel: "Ready for use" }} />}
      weergave={() => <PeriodKeuze begin={periode.begin} einde={periode.einde} readOnly />} />,
    <Kaart key="ad" naam="address-search" invoersoort="samengesteld (adres)" config={{ fields: D.ADRES_VELDEN }}
      opgeslagen={adres}
      invoer={(l) => <AddressSearch waarden={adres} onChange={(w) => setAdres((a) => ({ ...a, ...w }))} labelId={l} config={{ fields: D.ADRES_VELDEN }} />}
      weergave={() => <AddressSearch waarden={adres} readOnly config={{ fields: D.ADRES_VELDEN }} onChange={() => {}} />}
      noot="Praat met de PDOK Locatieserver (open data). Probeer: Oudegracht 1 Utrecht." />,
    <Kaart key="nl" naam="nl-map" invoersoort="meer uit een lijst (referentielijst Gemeente)" config={{ places: true }}
      opgeslagen={{ initiatief_gemeenten: gemeenten.map((code) => ({ gemeente: code })) }}
      invoer={(l) => <NlMapKeuze items={D.GEMEENTEN} meervoudig waarde={gemeenten} onChange={setGemeenten} labelId={l} />}
      weergave={() => <NlMapKeuze items={D.GEMEENTEN.filter((g) => gemeenten.includes(g.value))} meervoudig waarde={gemeenten} readOnly config={{ maxWidth: 260 }}
        groepen={[{ label: "Realiseert", color: "#e11d48", waarden: gemeenten.slice(0, 1) }, { label: "Maakt gebruik van", color: "#2563eb", waarden: gemeenten.slice(1) }]} />}
      noot="Wijs een stip aan: de woonplaatsen van die gemeente." />,
  ];

  const aantal = Object.keys(VORMEN).length;
  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "1.5rem 1rem 3rem", fontFamily: "var(--utrecht-document-font-family, system-ui)" }}>
      <h1 style={{ margin: "0 0 0.25rem", background: "linear-gradient(90deg, #60a5fa, #6366f1, #22d3ee)", WebkitBackgroundClip: "text", color: "transparent" }}>Vormenbibliotheek</h1>
      <p style={{ marginTop: 0, color: "#475569", maxWidth: 820 }}>
        {aantal} vormen voor {Object.keys(INVOERSOORT).length} invoersoorten. Een vorm verandert nooit de data: onder elke vorm staat wat er
        werkelijk wordt opgeslagen. Ontwerp: <code>docs/plans/2026-09-26 Invoersoort en vorm (ontwerp).md</code>.
      </p>
      <Matrix />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 560px), 1fr))", gap: 16, marginTop: 16 }}>{kaarten}</div>
    </main>
  );
}

/** De matrix inhoud × vorm: welke vorm welke invoersoort bedient (invoer ● / alleen weergave ○). */
function Matrix() {
  const soorten = Object.values(INVOERSOORT);
  return (
    <details open style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "0.75rem 1rem" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Inhoud × vorm</summary>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", marginTop: 8 }}>
          <thead><tr><th style={{ textAlign: "left", padding: 4 }}>vorm</th>{soorten.map((s) => <th key={s} style={{ padding: "4px 6px", writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: 600 }}>{s}</th>)}</tr></thead>
          <tbody>
            {Object.entries(VORMEN).map(([naam, v]) => (
              <tr key={naam} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "3px 8px 3px 4px", whiteSpace: "nowrap" }}>{v.label} <code style={{ color: "#6366f1" }}>{naam}</code></td>
                {soorten.map((s) => <td key={s} style={{ textAlign: "center", color: v.modi.includes("invoer") ? "#1d4ed8" : "#94a3b8" }}>{v.invoersoorten.includes(s) ? (v.modi.includes("invoer") ? "●" : "○") : ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

createRoot(document.getElementById("root")).render(<Showcase />);
