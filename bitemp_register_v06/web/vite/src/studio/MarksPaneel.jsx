/**
 * MarksPaneel — de marks van het geselecteerde element in Eigenschappen (plan 2026-11-18 Marks,
 * stap 6 en 7).
 *
 * Toont wat er geldt in de gekozen context (welke lagen meedoen, in welke volgorde) en schrijft
 * in de **werklaag**. Voor het element zelf een regel per marksoort; voor zijn velden een tabel
 * velden × soorten (de meeste marks staan op een veld, bv. `register.zoeksleutel`). Een vinkje
 * dat uit een andere laag komt toont die laag; uitvinken in een hogere laag zet de mark daar uit
 * en laat de onderliggende laag met rust (marks/marksPaneel.js `zetEffect`).
 *
 * Het teken op het canvas (ElementNode, `data._marks`) stuurt bij een klik de gebeurtenis
 * `omnium:marks-toon`; het paneel schuift dan in beeld.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMarksStore } from "./marksStore.js";
import { paneelVoorElement, schermContext, zetEffect, bestaatIn } from "../marks/marksPaneel.js";
import { wezen, doelSleutel, projectSoortId } from "../marks/marks.js";
import { getMarksoort, alleMarksoorten, naamruimteVan } from "../marks/marksoorten.js";
import { getProfieltypen } from "./profieltypeRegistry.js";
import { vraagNaam, vraagBevestiging } from "./naamDialog.jsx";

const stand = (s) => ({ lagen: s.lagen, contexten: s.contexten, marks: s.marks });
const labelsTekst = (labels) => (labels || []).map((l) => `${l.soort}=${l.waarde}`).join("; ");
const labelsUit = (tekst) =>
  String(tekst || "")
    .split(/[;\n]/)
    .map((d) => d.split("="))
    .filter(([s]) => s && s.trim())
    .map(([s, ...w]) => ({ soort: s.trim(), waarde: w.join("=").trim() }));

/** Een id uit een naam, uniek binnen `bestaand`. */
function nieuwId(naam, bestaand) {
  const basis = String(naam).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "laag";
  let id = basis;
  for (let i = 2; bestaand.has(id); i++) id = `${basis}-${i}`;
  return id;
}

/** De werklaag: de gekozen, als die meedoet; anders de laatste laag van de context. */
function werklaagVan(st, context, gekozen) {
  return context.includes(gekozen) ? gekozen : context[context.length - 1] || null;
}

function Waarde({ soort, eff, onZet }) {
  const waarde = eff && !eff.uit ? eff.waarde : undefined;
  const dt = soort.datatype || "boolean";
  if (dt === "boolean") {
    return <input type="checkbox" checked={waarde === true} onChange={(e) => onZet(e.target.checked ? true : undefined)} data-testid={`mark-${soort.id}`} />;
  }
  if (dt === "keuze") {
    return (
      <select value={waarde ?? ""} onChange={(e) => onZet(e.target.value || undefined)} data-testid={`mark-${soort.id}`}>
        <option value="">—</option>
        {(soort.opties || []).map((o) => (
          <option key={o.waarde} value={o.waarde}>{o.label || o.waarde}</option>
        ))}
      </select>
    );
  }
  if (dt === "onbekend") {
    return (
      <span className="studio-marks__onbekend">
        {JSON.stringify(waarde)}{" "}
        <button type="button" className="dc-mini-knop" title="Deze mark weghalen" onClick={() => onZet(undefined)}>✕</button>
      </span>
    );
  }
  return (
    <input
      type={dt === "getal" ? "number" : "text"}
      value={waarde ?? ""}
      data-testid={`mark-${soort.id}`}
      onChange={(e) => onZet(e.target.value === "" ? undefined : dt === "getal" ? Number(e.target.value) : e.target.value)}
    />
  );
}

/** Uit welke laag komt dit, als dat niet de werklaag is. */
function herkomst(eff, werklaag, laagNaam) {
  if (!eff) return "";
  if (eff.uit) return `uitgezet in ${laagNaam(eff.laag)}`;
  return eff.laag === werklaag ? "" : laagNaam(eff.laag);
}

/**
 * @param {{profielId: string, descriptorId: string, element: any}} props
 */
export default function MarksPaneel({ profielId, descriptorId, element }) {
  const lagen = useMarksStore((s) => s.lagen);
  const contexten = useMarksStore((s) => s.contexten);
  const marks = useMarksStore((s) => s.marks);
  const actieveContext = useMarksStore((s) => s.actieveContext);
  const gekozenWerklaag = useMarksStore((s) => s.werklaag);
  const soorten = useMarksStore((s) => s.soorten); // eigen soorten van het project
  const [beheer, setBeheer] = useState(false);
  const ref = useRef(null);

  const st = useMemo(() => ({ lagen, contexten, marks }), [lagen, contexten, marks]);
  const context = useMemo(() => schermContext(st, actieveContext), [st, actieveContext]);
  const werklaag = werklaagVan(st, context, gekozenWerklaag);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paneel = useMemo(() => paneelVoorElement({ st, context, profielId, descriptorId, element }), [st, context, profielId, descriptorId, element, soorten]);
  const laagNaam = (id) => lagen.find((l) => l.id === id)?.naam || id;

  useEffect(() => {
    const toon = () => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    window.addEventListener("omnium:marks-toon", toon);
    return () => window.removeEventListener("omnium:marks-toon", toon);
  }, []);

  // Niets te markeren op dit element en ook niets gezet: het paneel zwijgt.
  if (!paneel.element.length && !paneel.velden.length) return null;

  const zet = (soort, doel) => (waarde) => useMarksStore.getState().werk((s) => zetEffect(s, { laag: werklaag, soort: soort.id, doel, waarde, context }));
  const eersteLaag = () => {
    const s = useMarksStore.getState();
    s.zetLaag({ id: "algemeen", naam: "Algemeen", labels: [] });
    s.zetWerklaag("algemeen");
  };

  return (
    <div className="dc-inspector-sectie studio-marks" data-testid="marks-paneel" ref={ref}>
      <div className="dc-inspector-sectie-titel studio-marks__kop">
        <span>Marks {paneel.aantal ? `(${paneel.aantal})` : ""}</span>
        <span style={{ flex: 1 }} />
        {lagen.length > 0 && (
          <button type="button" className="dc-mini-knop" data-testid="marks-lagen" title="Lagen beheren en kiezen welke meedoen" onClick={() => setBeheer(true)}>
            Lagen…
          </button>
        )}
      </div>
      {lagen.length === 0 ? (
        <p className="studio-marks__leeg">
          Een mark is een aanwijzing voor een transformatie, los van het model. Marks staan in lagen.{" "}
          <button type="button" className="dc-mini-knop" data-testid="marks-eerste-laag" onClick={eersteLaag}>Eerste laag maken</button>
        </p>
      ) : (
        <>
          <label className="studio-marks__werklaag">
            schrijft in{" "}
            <select value={werklaag || ""} data-testid="marks-werklaag" onChange={(e) => useMarksStore.getState().zetWerklaag(e.target.value)}>
              {context.map((id) => (
                <option key={id} value={id}>{laagNaam(id)}</option>
              ))}
            </select>
          </label>
          {paneel.element.map((r) => (
            <div key={r.soort.id} className="studio-marks__rij" title={r.soort.uitleg || r.soort.id}>
              <span className="studio-marks__label">{r.soort.label || r.soort.id}</span>
              <Waarde soort={r.soort} eff={r.eff} onZet={zet(r.soort, r.doel)} />
              <span className="studio-marks__herkomst">{herkomst(r.eff, werklaag, laagNaam)}</span>
            </div>
          ))}
          {paneel.velden.length > 0 && (
            <table className="studio-marks__tabel" data-testid="marks-velden">
              <thead>
                <tr>
                  <th />
                  {paneel.veldSoorten.map((s) => (
                    <th key={s.id} title={s.uitleg || s.id}>{s.label || s.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paneel.velden.map((v) => (
                  <tr key={v.naam} data-veld={v.naam}>
                    <td className="studio-marks__veld">{v.naam}</td>
                    {v.cellen.map((c) => {
                      const van = herkomst(c.eff, werklaag, laagNaam);
                      return (
                        <td key={c.soort.id} className={van ? "is-geerfd" : ""} title={van || c.soort.uitleg || ""}>
                          <Waarde soort={c.soort} eff={c.eff} onZet={zet(c.soort, v.doel)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {beheer && <MarksLagenDialoog onSluit={() => setBeheer(false)} />}
    </div>
  );
}

/**
 * Lagen beheren (naam, labels) en kiezen welke meedoen, in welke volgorde. Die keuze is van
 * jou (`actieveContext`); met "Bewaar als context" wordt ze een gedeelde, benoemde context.
 */
export function MarksLagenDialoog({ onSluit }) {
  const lagen = useMarksStore((s) => s.lagen);
  const contexten = useMarksStore((s) => s.contexten);
  const marks = useMarksStore((s) => s.marks);
  const actieveContext = useMarksStore((s) => s.actieveContext);
  const st = { lagen, contexten, marks };
  const mee = schermContext(st, actieveContext);
  const store = () => useMarksStore.getState();
  // Volgorde in de dialoog: eerst wat meedoet (in die volgorde), dan de rest.
  const rij = [...mee, ...lagen.map((l) => l.id).filter((id) => !mee.includes(id))];
  const zetMee = (ids) => store().zetActieveContext(ids);
  const schuif = (id, d) => {
    const i = mee.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= mee.length) return;
    const nieuw = [...mee];
    [nieuw[i], nieuw[j]] = [nieuw[j], nieuw[i]];
    zetMee(nieuw);
  };
  const nieuweLaag = async () => {
    const naam = await vraagNaam({ titel: "Nieuwe laag", label: "Naam", waarde: "", bevestig: "Maken" });
    if (!naam) return;
    const id = nieuwId(naam, new Set(lagen.map((l) => l.id)));
    store().zetLaag({ id, naam, labels: [] });
    zetMee([...mee, id]);
  };
  const wis = async (laag) => {
    const n = marks.filter((m) => m.laag === laag.id).length;
    const ok = !n || (await vraagBevestiging({ titel: "Laag weghalen", tekst: `Laag "${laag.naam}" weghalen, met ${n} mark${n === 1 ? "" : "s"}? Ongedaan maken kan niet.`, bevestig: "Weghalen", gevaar: true }));
    if (ok) store().wisLaag(laag.id);
  };
  // Marks waarvan het doel niet meer bestaat (element of veld verwijderd). Ze blijven staan tot
  // je ze weghaalt: zo raakt een mark niet stil kwijt.
  const verweesd = useMemo(
    () => wezen(st, bestaatIn(getProfieltypen().filter((p) => p.useStore).map((p) => ({ id: p.id, elements: p.useStore.getState().elements || {} })))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marks]
  );
  const ruimOp = async () => {
    const ok = await vraagBevestiging({ titel: "Marks zonder doel weghalen", tekst: `${verweesd.length} mark${verweesd.length === 1 ? "" : "s"} weghalen waarvan het element of veld niet meer bestaat?`, bevestig: "Weghalen", gevaar: true });
    if (ok) store().patchMarks({ marks: { zet: [], wis: verweesd.map((m) => m.id) } });
  };
  // Eigen marksoorten van het project (zoals koppelsoorten): naam, soort waarde, waarop hij mag.
  const soorten = useMarksStore((s) => s.soorten);
  const nieuweSoort = async () => {
    const naam = await vraagNaam({ titel: "Nieuwe marksoort", label: "Naam", waarde: "", bevestig: "Maken" });
    if (!naam) return;
    store().zetSoort({ id: projectSoortId(naam, soorten), label: naam, datatype: "boolean", doelen: ["element"] });
  };
  const wisSoort = async (soort) => {
    const n = marks.filter((m) => m.soort === soort.id).length;
    const ok = !n || (await vraagBevestiging({ titel: "Marksoort weghalen", tekst: `Marksoort "${soort.label}" weghalen? Er staan ${n} mark${n === 1 ? "" : "s"} van deze soort; die blijven staan en zijn daarna alleen nog weg te halen.`, bevestig: "Weghalen", gevaar: true }));
    if (ok) store().wisSoort(soort.id);
  };
  const wisselDoel = (soort, doel) => {
    const heeft = soort.doelen.includes(doel);
    const doelen = heeft ? soort.doelen.filter((d) => d !== doel) : [...soort.doelen, doel];
    if (doelen.length) store().zetSoort({ ...soort, doelen });
  };
  const bewaarContext = async () => {
    const naam = await vraagNaam({ titel: "Bewaar als context", label: "Naam van de context", waarde: "", bevestig: "Bewaren" });
    if (!naam) return;
    const id = nieuwId(naam, new Set(contexten.map((c) => c.id)));
    store().zetContext({ id, naam, lagen: mee });
  };

  return createPortal(
    <div className="studio-beslistabel__achtergrond" role="dialog" aria-modal="true" data-testid="marks-lagen-dialoog" onClick={(e) => e.target === e.currentTarget && onSluit()}>
      <div className="studio-marks__dialoog">
        <div className="studio-beslistabel__kop">
          <strong>Marks: lagen en eigen soorten</strong>
          <span style={{ flex: 1 }} />
          <button type="button" className="dc-mini-knop" onClick={onSluit}>Sluiten</button>
        </div>
        <div className="studio-marks__dialoog-inhoud">
          <h4 className="studio-marks__tussenkop" style={{ marginTop: 0 }}>Lagen</h4>
          <p className="studio-marks__uitleg">
            Een mark staat altijd in een laag: een stapel marks met een naam, bijvoorbeeld Algemeen of Waterstede. Zo kan
            hetzelfde model voor verschillende situaties andere marks dragen.
            {lagen.length > 1 ? (
              <> Vink aan welke lagen nu meedoen en zet ze in volgorde: zetten twee lagen dezelfde mark anders, dan wint de
              onderste. Die keuze is van jou; de lagen zelf zijn van het project. Labels (waar de laag voor is) schrijf je
              als <code>gemeente=Waterstede; domein=parkeren</code>.</>
            ) : (
              <> Met één laag hoef je hier niets te doen. Een tweede laag maak je voor een tweede situatie; dan kies je
              hier welke meedoen en welke wint.</>
            )}
          </p>
          <table className="studio-marks__lagen">
            <thead>
              <tr><th>doet mee</th><th>laag</th><th>labels</th><th>marks</th><th /></tr>
            </thead>
            <tbody>
              {rij.map((id) => {
                const laag = lagen.find((l) => l.id === id);
                const doetMee = mee.includes(id);
                return (
                  <tr key={id} data-laag={id}>
                    <td>
                      <input type="checkbox" checked={doetMee} title="Doet mee in jouw context" onChange={(e) => zetMee(e.target.checked ? [...mee, id] : mee.filter((x) => x !== id))} />
                      <button type="button" className="dc-mini-knop" disabled={!doetMee || mee.indexOf(id) === 0} title="Eerder (zwakker)" onClick={() => schuif(id, -1)}>↑</button>
                      <button type="button" className="dc-mini-knop" disabled={!doetMee || mee.indexOf(id) === mee.length - 1} title="Later (sterker)" onClick={() => schuif(id, 1)}>↓</button>
                    </td>
                    <td><input type="text" value={laag.naam} onChange={(e) => store().zetLaag({ ...laag, naam: e.target.value })} /></td>
                    <td><input type="text" defaultValue={labelsTekst(laag.labels)} placeholder="soort=waarde; …" onBlur={(e) => store().zetLaag({ ...laag, labels: labelsUit(e.target.value) })} /></td>
                    <td>{marks.filter((m) => m.laag === id).length}</td>
                    <td><button type="button" className="dc-mini-knop is-gevaar" title="Laag weghalen" onClick={() => wis(laag)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="studio-marks__acties">
            <button type="button" className="dc-mini-knop" data-testid="marks-nieuwe-laag" onClick={nieuweLaag}>＋ laag</button>
            <span style={{ flex: 1 }} />
            <select value="" title="Een bewaarde context toepassen" onChange={(e) => { const c = contexten.find((x) => x.id === e.target.value); if (c) zetMee(c.lagen); }}>
              <option value="">Context toepassen…</option>
              {contexten.map((c) => (
                <option key={c.id} value={c.id}>{c.naam}</option>
              ))}
            </select>
            <button type="button" className="dc-mini-knop" onClick={bewaarContext}>Bewaar als context…</button>
          </div>
          <h4 className="studio-marks__tussenkop">Soorten van transformaties</h4>
          <p className="studio-marks__uitleg">
            Deze soorten brengt een transformatie mee: zij leest ze en bepaalt wat ze betekenen. Je kunt ze hier niet
            wijzigen.
          </p>
          <table className="studio-marks__lagen" data-testid="marks-transformatiesoorten">
            <thead>
              <tr><th>soort</th><th>transformatie</th><th>waarde</th><th>op</th><th>wat het doet</th></tr>
            </thead>
            <tbody>
              {alleMarksoorten().filter((s) => naamruimteVan(s.id) !== "project").map((s) => (
                <tr key={s.id}>
                  <td title={s.id}>{s.label || s.id}</td>
                  <td>{naamruimteVan(s.id)}</td>
                  <td>{s.datatype === "boolean" ? "ja/nee" : s.datatype}</td>
                  <td>{(s.doelen || []).join(", ") || "alles"}</td>
                  <td style={{ whiteSpace: "normal" }}>{s.uitleg || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 className="studio-marks__tussenkop">Eigen marksoorten van dit project</h4>
          <p className="studio-marks__uitleg">
            Naast de soorten die een transformatie meebrengt (zoals zoeksleutel) maak je hier je eigen soorten. Ze
            gelden in elke taal, op wat je aanvinkt.
          </p>
          {soorten.length > 0 && (
            <table className="studio-marks__lagen" data-testid="marks-soorten">
              <thead>
                <tr><th>soort</th><th>waarde</th><th>keuzes</th><th>element</th><th>veld</th><th>relatie</th><th /></tr>
              </thead>
              <tbody>
                {soorten.map((s) => (
                  <tr key={s.id} data-soort={s.id}>
                    <td><input type="text" value={s.label} title={s.id} onChange={(e) => store().zetSoort({ ...s, label: e.target.value })} /></td>
                    <td>
                      <select value={s.datatype} onChange={(e) => store().zetSoort({ ...s, datatype: e.target.value })}>
                        <option value="boolean">ja/nee</option>
                        <option value="string">tekst</option>
                        <option value="getal">getal</option>
                        <option value="keuze">keuze</option>
                      </select>
                    </td>
                    <td>
                      {s.datatype === "keuze" && (
                        <input
                          type="text"
                          defaultValue={(s.opties || []).map((o) => o.waarde).join("; ")}
                          placeholder="laag; midden; hoog"
                          onBlur={(e) => store().zetSoort({ ...s, opties: e.target.value.split(";").map((w) => w.trim()).filter(Boolean).map((waarde) => ({ waarde })) })}
                        />
                      )}
                    </td>
                    {["element", "veld", "relatie"].map((d) => (
                      <td key={d}><input type="checkbox" checked={s.doelen.includes(d)} title={`Mag op een ${d}`} onChange={() => wisselDoel(s, d)} /></td>
                    ))}
                    <td><button type="button" className="dc-mini-knop is-gevaar" title="Marksoort weghalen" onClick={() => wisSoort(s)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="studio-marks__acties">
            <button type="button" className="dc-mini-knop" data-testid="marks-nieuwe-soort" onClick={nieuweSoort}>＋ soort</button>
          </div>
          {verweesd.length > 0 && (
            <div className="studio-marks__wezen" data-testid="marks-wezen">
              <strong>{verweesd.length} mark{verweesd.length === 1 ? "" : "s"} zonder doel</strong> (het element of veld bestaat niet meer):
              <ul>
                {verweesd.slice(0, 8).map((m) => (
                  <li key={m.id}>{getMarksoort(m.soort)?.label || m.soort} — laag {lagen.find((l) => l.id === m.laag)?.naam || m.laag} — {doelSleutel(m.doel)}</li>
                ))}
                {verweesd.length > 8 && <li>en nog {verweesd.length - 8}</li>}
              </ul>
              <button type="button" className="dc-mini-knop is-gevaar" data-testid="marks-wezen-weg" onClick={ruimOp}>Weghalen…</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.querySelector(".studio") || document.body
  );
}

/** De stand uit de store, voor wie hem buiten React nodig heeft (canvas-teken). */
export const marksStand = () => stand(useMarksStore.getState());
