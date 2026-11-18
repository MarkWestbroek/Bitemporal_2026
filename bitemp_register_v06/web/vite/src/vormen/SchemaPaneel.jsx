/**
 * SchemaPaneel — tekent een instellingenpaneel uit een JSON Schema en een waarde
 * (de boom komt uit `schemaPaneel.js`). Bedoeld voor de instellingen van een schrijver
 * (Transformaties) en later voor de vormConfig in de formuliereditor.
 *
 * Eén beschrijving, de waarden apart, de vorm hier: ja/nee is een schakelaar (SwitchKeuze), een
 * keuze een rij knoppen (ButtonGroupKeuze), een sjabloonwaarde tekst met gekleurde placeholders,
 * een tabel sleutel → waarde, een lijst een rij kaarten, een groep een kader.
 *
 * Nu **alleen-lezen**: je ziet de stand van de motor. Bewerken (één schrijfpad, een stand als
 * gedeeltelijke set waarden bovenop de standaard) is de volgende stap.
 *
 * Props: schema, waarde.
 */
import React from "react";
import SwitchKeuze from "./SwitchKeuze";
import ButtonGroupKeuze from "./ButtonGroupKeuze";
import { paneelBoom, sjabloonDelen, lijstAlsTabel, isWaardenlijst, celTekst } from "./schemaPaneel.js";

const gedempt = { color: "var(--s-fg-muted, #64748b)" };
const rand = "1px solid var(--s-border, #e2e8f0)";
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, wordBreak: "break-word" };

/** Tekst met de placeholders als gekleurde blokjes; een onbekende is rood. */
function Sjabloon({ tekst, placeholders = [] }) {
  const onbekend = new Set(placeholders.filter((p) => !p.bekend).map((p) => p.naam));
  return (
    <span style={mono}>
      {sjabloonDelen(String(tekst ?? "")).map((deel, i) =>
        deel.placeholder ? (
          <span
            key={i}
            data-placeholder={deel.naam}
            title={onbekend.has(deel.naam) ? "Onbekende placeholder" : `Wordt ingevuld: ${deel.naam}${deel.filter ? ` (${deel.filter})` : ""}`}
            style={{
              padding: "0 4px", borderRadius: 4, whiteSpace: "nowrap",
              background: onbekend.has(deel.naam) ? "rgba(220,38,38,0.18)" : "rgba(99,102,241,0.18)",
              color: onbekend.has(deel.naam) ? "#dc2626" : "inherit",
            }}
          >
            {deel.placeholder}
          </span>
        ) : (
          <React.Fragment key={i}>{deel.tekst}</React.Fragment>
        )
      )}
    </span>
  );
}

const kaal = (w) => (typeof w === "string" ? w : JSON.stringify(w));

function Waarde({ knoop }) {
  switch (knoop.soort) {
    case "ja_nee":
      return <SwitchKeuze waarde={String(knoop.waarde)} onChange={() => {}} readOnly />;
    case "keuze":
      return <ButtonGroupKeuze items={knoop.keuzes.map((k) => ({ value: String(k), label: String(k) }))} waarde={String(knoop.waarde)} onChange={() => {}} readOnly config={{ sort: "none" }} />;
    case "sjabloon":
      return <Sjabloon tekst={knoop.waarde} placeholders={knoop.placeholders} />;
    case "tabel":
      return knoop.rijen.length ? (
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            {knoop.rijen.map((rij) => (
              <tr key={rij.sleutel}>
                <td style={{ ...mono, padding: "2px 10px 2px 0", verticalAlign: "top", whiteSpace: "nowrap", ...gedempt }}>{rij.sleutel}</td>
                <td style={{ padding: "2px 0", verticalAlign: "top" }}><Sjabloon tekst={kaal(rij.waarde)} placeholders={rij.placeholders} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <span style={gedempt}>leeg</span>
      );
    default:
      return <span style={mono}>{kaal(knoop.waarde)}</span>;
  }
}

function Kop({ knoop }) {
  return (
    <div>
      <span style={{ fontWeight: 600 }}>{knoop.titel}</span>
      {knoop.titel !== knoop.sleutel && <span style={{ ...mono, ...gedempt, marginLeft: 6 }}>{knoop.sleutel}</span>}
      {knoop.onbeschreven && <span data-testid="onbeschreven" title="Niet in het schema beschreven" style={{ marginLeft: 6, padding: "0 5px", borderRadius: 4, fontSize: 11, background: "rgba(245,158,11,0.22)" }}>onbeschreven</span>}
      {knoop.afwijkend && <span title={`Standaard: ${kaal(knoop.standaard)}`} style={{ marginLeft: 6, fontSize: 11, ...gedempt }}>● afwijkend</span>}
      {knoop.omschrijving && <div style={{ fontSize: 12, ...gedempt }}>{knoop.omschrijving}</div>}
    </div>
  );
}

/** Een lijst van objecten als tabel: één regel per object. */
function LijstTabel({ knoop, tabel }) {
  const cel = { padding: "3px 10px 3px 0", verticalAlign: "top", borderTop: rand };
  return (
    <div data-pad={knoop.pad} data-soort="lijst" data-vorm="tabel" style={{ margin: "8px 0" }}>
      <Kop knoop={knoop} />
      <table style={{ borderCollapse: "collapse", marginTop: 4 }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={{ ...cel, borderTop: 0, ...gedempt, fontWeight: 400 }}>#</th>
            {tabel.kolommen.map((k) => <th key={k.sleutel} title={k.omschrijving} style={{ ...cel, borderTop: 0 }}>{k.titel}</th>)}
          </tr>
        </thead>
        <tbody>
          {tabel.rijen.map((rij, i) => (
            <tr key={i}>
              <td style={{ ...cel, ...gedempt }}>{i + 1}</td>
              {rij.map((c, j) => <td key={j} style={cel}>{c.placeholders.length ? <Sjabloon tekst={c.tekst} placeholders={c.placeholders} /> : c.tekst}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Knoop({ knoop, diepte = 0 }) {
  const tabel = lijstAlsTabel(knoop);
  if (tabel) return <LijstTabel knoop={knoop} tabel={tabel} />;
  if (isWaardenlijst(knoop)) {
    return (
      <div data-pad={knoop.pad} data-soort="lijst" data-vorm="waarden" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 30%) 1fr", gap: 12, padding: "6px 0", borderTop: diepte ? rand : 0, alignItems: "start" }}>
        <Kop knoop={knoop} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {knoop.kinderen.map((kind) => <span key={kind.pad} style={{ ...mono, padding: "1px 6px", borderRadius: 4, border: rand }}>{celTekst(kind.waarde)}</span>)}
        </div>
      </div>
    );
  }
  if (knoop.soort === "groep" || knoop.soort === "lijst") {
    const kaart = knoop.soort === "lijst";
    return (
      <div data-pad={knoop.pad} data-soort={knoop.soort} style={{ border: rand, borderRadius: 8, padding: "8px 10px", margin: "6px 0", background: diepte % 2 ? "transparent" : "var(--s-bg-zacht, rgba(148,163,184,0.06))" }}>
        <Kop knoop={knoop} />
        {(knoop.kinderen || []).length === 0 && <div style={{ ...gedempt, fontSize: 12 }}>leeg</div>}
        {(knoop.kinderen || []).map((kind) =>
          kaart ? (
            <div key={kind.pad} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ ...gedempt, fontSize: 12, paddingTop: 12 }}>{kind.sleutel}.</span>
              <div style={{ flex: 1 }}><Knoop knoop={{ ...kind, titel: "", sleutel: "" }} diepte={diepte + 1} /></div>
            </div>
          ) : (
            <Knoop key={kind.pad} knoop={kind} diepte={diepte + 1} />
          )
        )}
      </div>
    );
  }
  return (
    <div data-pad={knoop.pad} data-soort={knoop.soort} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 30%) 1fr", gap: 12, padding: "6px 0", borderTop: diepte ? rand : 0, alignItems: "start" }}>
      <Kop knoop={knoop} />
      <div><Waarde knoop={knoop} /></div>
    </div>
  );
}

export default function SchemaPaneel({ schema, waarde }) {
  const { groepen, onbeschreven } = paneelBoom(schema, waarde);
  return (
    <div data-testid="schema-paneel" style={{ fontSize: 13 }}>
      {onbeschreven.length > 0 && (
        <p role="status" style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(245,158,11,0.18)" }}>
          {onbeschreven.length} instelling{onbeschreven.length === 1 ? "" : "en"} zonder beschrijving in het schema: {onbeschreven.join(", ")}.
        </p>
      )}
      {groepen.map((groep) => (
        <section key={groep.naam} data-groep={groep.naam} style={{ margin: "0 0 16px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", ...gedempt }}>{groep.naam}</h4>
          {groep.knopen.map((knoop) => <Knoop key={knoop.pad} knoop={knoop} />)}
        </section>
      ))}
    </div>
  );
}
