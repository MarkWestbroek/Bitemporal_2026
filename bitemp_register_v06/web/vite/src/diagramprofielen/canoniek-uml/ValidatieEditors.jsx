/**
 * ValidatieEditors — PropertyTypeEditors voor de datatypes "validatieregels"
 * en "weergaveregels" van het gegevenstype-ElementType (plan §2: widget volgt
 * uit de datatype-registry, net als "cel-expressie").
 *
 * Tegenhanger van GegevenstypeEditor in de oude IDE (ide/DetailsPanel.jsx):
 * pattern + lengtes (string) of bereik/veelvoud (numeriek), foutmelding,
 * voorbeelden en checksum-achtige regels; weergave: placeholder, invoermasker,
 * prefix en suffix. Welke velden getoond worden hangt af van het basistype
 * van het element (eigenschappen-compartiment, met de bron-spiegel als
 * terugval).
 */

/** Basistype van een gegevenstype-element (voor conditionele velden). */
function basistypeVan(element) {
  const eigenschappen = (element?.compartimenten || []).find(
    (c) => c.compartmentType === "eigenschappen"
  );
  const veld = (eigenschappen?.velden || []).find((v) => v.naam === "basistype");
  return veld?.data?.typeLabel || element?.data?.bron?.basistype || "string";
}

const RIJ = { display: "flex", alignItems: "center", gap: 6 };
const LABEL = { width: 86, flexShrink: 0, fontSize: 11, color: "var(--s-fg-muted, #64748b)" };
const INPUT = { flex: 1, minWidth: 0 };

function Rij({ label, children }) {
  return (
    <div style={RIJ}>
      <span style={LABEL}>{label}</span>
      {children}
    </div>
  );
}

function TekstRij({ label, waarde, onChange, placeholder }) {
  return (
    <Rij label={label}>
      <input
        type="text"
        style={INPUT}
        value={waarde ?? ""}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </Rij>
  );
}

function GetalRij({ label, waarde, onChange }) {
  return (
    <Rij label={label}>
      <input
        type="number"
        style={INPUT}
        value={waarde ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </Rij>
  );
}

/** Zet/verwijder een sleutel in een regels-object ("" en null vallen weg). */
function zetSleutel(obj, sleutel, waarde) {
  const volgende = { ...(obj || {}) };
  if (waarde === "" || waarde === null || waarde === undefined) delete volgende[sleutel];
  else volgende[sleutel] = waarde;
  return volgende;
}

export function ValidatieRegelsEditor({ waarde, onChange, element }) {
  const v = waarde || {};
  const basistype = basistypeVan(element);
  const isString = basistype === "string";
  const isNumeriek = basistype === "integer" || basistype === "number";
  const zet = (sleutel, w) => onChange(zetSleutel(v, sleutel, w));

  const regels = v.regels || [];
  const zetRegel = (i, deel) =>
    zet("regels", regels.map((r, j) => (j === i ? { ...r, ...deel } : r)));

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <TekstRij label="pattern" waarde={v.pattern} onChange={(w) => zet("pattern", w)} placeholder="^regex$" />
      {isString && (
        <>
          <GetalRij label="min. lengte" waarde={v.minLength} onChange={(w) => zet("minLength", w)} />
          <GetalRij label="max. lengte" waarde={v.maxLength} onChange={(w) => zet("maxLength", w)} />
        </>
      )}
      {isNumeriek && (
        <>
          <GetalRij label="minimum" waarde={v.minimum} onChange={(w) => zet("minimum", w)} />
          <GetalRij label="maximum" waarde={v.maximum} onChange={(w) => zet("maximum", w)} />
          <GetalRij label="veelvoud van" waarde={v.multipleOf} onChange={(w) => zet("multipleOf", w)} />
        </>
      )}
      <TekstRij
        label="foutmelding"
        waarde={v.foutmelding}
        onChange={(w) => zet("foutmelding", w)}
        placeholder="Voer een geldige waarde in"
      />
      <TekstRij
        label="voorbeelden"
        waarde={(v.voorbeelden || []).join(", ")}
        onChange={(w) => zet("voorbeelden", w ? w.split(",").map((s) => s.trim()).filter(Boolean) : null)}
        placeholder="waarde1, waarde2"
      />

      {regels.map((r, i) => (
        <div key={i} style={RIJ}>
          <input
            type="text"
            style={{ width: 86, flexShrink: 0 }}
            value={r?.naam || ""}
            placeholder="regelnaam"
            onChange={(e) => zetRegel(i, { naam: e.target.value })}
          />
          <input
            type="text"
            style={INPUT}
            value={r?.expressie || ""}
            placeholder="expressie"
            onChange={(e) => zetRegel(i, { expressie: e.target.value })}
          />
          <button
            className="dc-mini-knop"
            title="Regel verwijderen"
            onClick={() => zet("regels", regels.filter((_, j) => j !== i).length ? regels.filter((_, j) => j !== i) : null)}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="dc-mini-knop"
        style={{ alignSelf: "flex-start" }}
        onClick={() => zet("regels", [...regels, { naam: "", type: "checksum", expressie: "" }])}
      >
        + regel
      </button>
    </div>
  );
}

export function WeergaveRegelsEditor({ waarde, onChange }) {
  const v = waarde || {};
  const zet = (sleutel, w) => onChange(zetSleutel(v, sleutel, w));
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <TekstRij label="placeholder" waarde={v.placeholder} onChange={(w) => zet("placeholder", w)} />
      <TekstRij label="invoermasker" waarde={v.inputMask} onChange={(w) => zet("inputMask", w)} placeholder="0000 AA" />
      <TekstRij label="prefix" waarde={v.prefix} onChange={(w) => zet("prefix", w)} placeholder="€" />
      <TekstRij label="suffix" waarde={v.suffix} onChange={(w) => zet("suffix", w)} placeholder="%" />
    </div>
  );
}
