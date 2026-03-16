import { useId } from "react";

function isNumeriekSchemaType(type) {
  return type === "number" || type === "integer";
}

function stepVoorSchemaType(type) {
  if (type === "integer") {
    return "1";
  }
  if (type === "number") {
    return "any";
  }
  return undefined;
}

const DEFAULT_ACCENT = "#99f6e4";
const DEFAULT_ROW_ACCENT = "#d1fae5";

export function ActionTooltip({ text, placement = "above" }) {
  if (!text) {
    return null;
  }
  return (
    <span className={`action-tooltip-anchor action-tooltip-anchor--${placement}`}>
      <button type="button" className="action-tooltip-trigger" aria-label="toon toelichting" tabIndex={0}>
        i
      </button>
      <span className="action-tooltip-bubble" role="tooltip">{text}</span>
    </span>
  );
}

function isLegeWaarde(value) {
  return value === "" || value === null || value === undefined;
}

function enumOptiesVoorVeld(veld) {
  return Array.isArray(veld?.enum)
    ? veld.enum.map((waarde) => String(waarde || "")).filter(Boolean)
    : [];
}

function isGeldigDatumFormaat(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const datum = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(datum.getTime()) && datum.toISOString().slice(0, 10) === value;
}

function isGeldigDatumTijdFormaat(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return false;
  }
  const datum = new Date(value);
  return !Number.isNaN(datum.getTime());
}

export function validatieMeldingVoorVeld(rawValue, veld, veldLabel = null) {
  const label = veldLabel || veld?.naam || "veld";
  const type = String(veld?.type || "string");
  const format = String(veld?.format || "");
  const enumOpties = enumOptiesVoorVeld(veld);

  if (isLegeWaarde(rawValue)) {
    if (veld?.verplicht) {
      return `Veld ${label} is verplicht.`;
    }
    return "";
  }

  const normalized = String(rawValue).trim();
  if (normalized === "") {
    return veld?.verplicht ? `Veld ${label} is verplicht.` : "";
  }

  if (enumOpties.length > 0 && !enumOpties.includes(normalized)) {
    return `Veld ${label} moet een van deze waarden zijn: ${enumOpties.join(", ")}.`;
  }

  if (type === "integer") {
    if (!/^-?\d+$/.test(normalized)) {
      return `Veld ${label} moet een geheel getal zijn.`;
    }
    return "";
  }

  if (type === "number") {
    if (!/^-?(?:\d+|\d*\.\d+)$/.test(normalized)) {
      return `Veld ${label} moet een geldig getal zijn.`;
    }
    return "";
  }

  if (type === "boolean") {
    if (normalized !== "true" && normalized !== "false") {
      return `Veld ${label} moet true of false zijn.`;
    }
    return "";
  }

  if (type === "string" && format === "date") {
    if (!isGeldigDatumFormaat(normalized)) {
      return `Veld ${label} moet een datum zijn in formaat JJJJ-MM-DD.`;
    }
    return "";
  }

  if (type === "string" && format === "date-time") {
    if (!isGeldigDatumTijdFormaat(normalized)) {
      return `Veld ${label} moet een datum+tijd zijn.`;
    }
    return "";
  }

  return "";
}

export function coercedWaardeVoorVeld(rawValue, veld, veldLabel = null) {
  const foutmelding = validatieMeldingVoorVeld(rawValue, veld, veldLabel);
  if (foutmelding) {
    throw new Error(foutmelding);
  }

  if (isLegeWaarde(rawValue)) {
    return rawValue;
  }

  const normalized = String(rawValue).trim();
  const type = String(veld?.type || "string");

  if (type === "integer") {
    return Number.parseInt(normalized, 10);
  }
  if (type === "number") {
    return Number(normalized);
  }
  if (type === "boolean") {
    return normalized === "true" || rawValue === true;
  }
  return rawValue;
}

function inputTypeVoorVeld(veld) {
  const type = String(veld?.type || "string");
  const format = String(veld?.format || "");

  if (type === "string" && format === "date") {
    return "date";
  }
  if (type === "string" && format === "date-time") {
    return "datetime-local";
  }
  return "text";
}

function inputModeVoorVeld(veld) {
  const type = String(veld?.type || "string");
  if (type === "integer") {
    return "numeric";
  }
  if (type === "number") {
    return "decimal";
  }
  return undefined;
}

function placeholderVoorVeld(veld) {
  const type = String(veld?.type || "string");
  const format = String(veld?.format || "");
  if (type === "string" && format === "date") {
    return "YYYY-MM-DD";
  }
  if (type === "string" && format === "date-time") {
    return "YYYY-MM-DDThh:mm";
  }
  return undefined;
}

export function ActionBodyCard({ children, accentColor = DEFAULT_ACCENT, formRef = null }) {
  return (
    <div
      ref={formRef}
      style={{
        marginTop: 0,
        padding: "12px 16px",
        border: `1.5px dashed ${accentColor}`,
        borderRadius: 10,
        background: "#ffffff",
      }}
    >
      {children}
    </div>
  );
}

export function ActionTopFields({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export function ActionInlineField({ label, labelTitle = "", children }) {
  return (
    <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span className="action-field-label" style={{ whiteSpace: "nowrap" }}>
        <span>{label}</span>
        <ActionTooltip text={labelTitle} />
      </span>
      <span style={{ display: "flex", flex: 1, minWidth: 0 }}>{children}</span>
    </label>
  );
}

export function ActionFieldsGrid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
      {children}
    </div>
  );
}

export function ActionSection({ title, titleTooltip = "", children, onAdd, disabled, accentColor = DEFAULT_ACCENT }) {
  return (
    <div style={{ border: `1px solid ${accentColor}`, borderRadius: 10, padding: 10, marginBottom: 10, background: "#ffffff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong className="action-section-title" style={{ fontSize: 14 }}>
          <span>{title}</span>
          <ActionTooltip text={titleTooltip} />
        </strong>
        {onAdd ? (
          <button
            onClick={onAdd}
            aria-label="voeg regel toe"
            title="voeg regel toe"
            disabled={disabled}
            style={{ background: "transparent", color: "#0f766e", border: `1px solid ${accentColor}`, padding: "1px 8px", fontWeight: 700 }}
          >
            +
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ActionRowCard({ children, onRemove, disabled, rowAccentColor = DEFAULT_ROW_ACCENT }) {
  return (
    <div style={{ border: `1px solid ${rowAccentColor}`, borderRadius: 8, padding: 10, marginBottom: 8, background: "#f8fffd" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
        {children}
        {onRemove ? (
          <button
            onClick={onRemove}
            aria-label="haal weg"
            title="haal weg"
            disabled={disabled}
            style={{ background: "#475569", alignSelf: "start", padding: "3px 10px" }}
          >
            -
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ActionFieldControl({ veld, value, onChange, secondaireInfo, secondaireKolom }) {
  const booleanGroupId = useId();
  const controlStyle = { flex: 1, minWidth: 0 };
  const foutmelding = validatieMeldingVoorVeld(value, veld);
  const enumOpties = enumOptiesVoorVeld(veld);

  if (veld.naam === secondaireKolom) {
    if (secondaireInfo?.loading) {
      return <input style={controlStyle} value="Laden..." readOnly />;
    }
    if (Array.isArray(secondaireInfo?.ids) && secondaireInfo.ids.length > 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <select style={controlStyle} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
            <option value="">(kies id)</option>
            {secondaireInfo.ids.map((idOptie) => (
              <option key={idOptie} value={String(idOptie)}>{String(idOptie)}</option>
            ))}
          </select>
          {secondaireInfo?.error ? <span style={{ fontSize: 11, color: "#b45309" }}>{secondaireInfo.error}</span> : null}
          {foutmelding ? <span style={{ fontSize: 11, color: "#dc2626" }}>{foutmelding}</span> : null}
        </div>
      );
    }
  }

  if (veld.type === "boolean") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", minHeight: 32 }}>
          {[
            { value: "", label: "leeg" },
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ].map((optie) => (
            <label key={`${booleanGroupId}-${optie.label}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#111827" }}>
              <input
                type="radio"
                name={`boolean-${booleanGroupId}`}
                checked={String(value ?? "") === optie.value}
                onChange={() => onChange(optie.value)}
              />
              <span>{optie.label}</span>
            </label>
          ))}
        </div>
        {foutmelding ? <span style={{ fontSize: 11, color: "#dc2626" }}>{foutmelding}</span> : null}
      </div>
    );
  }

  if (enumOpties.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
        <select style={controlStyle} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">{veld?.verplicht ? "(kies waarde)" : "(leeg)"}</option>
          {enumOpties.map((optie) => (
            <option key={optie} value={optie}>{optie}</option>
          ))}
        </select>
        {foutmelding ? <span style={{ fontSize: 11, color: "#dc2626" }}>{foutmelding}</span> : null}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <input
        style={controlStyle}
        type={inputTypeVoorVeld(veld)}
        inputMode={inputModeVoorVeld(veld)}
        step={inputTypeVoorVeld(veld) === "text" ? undefined : stepVoorSchemaType(veld.type)}
        placeholder={placeholderVoorVeld(veld)}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      />
      {foutmelding ? <span style={{ fontSize: 11, color: "#dc2626" }}>{foutmelding}</span> : null}
    </div>
  );
}

export function ActionLabeledEditorField({ veldnaam, beschrijving = "", children }) {
  return (
    <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span className="action-field-label" style={{ whiteSpace: "nowrap" }}>
        <span>{veldnaam}</span>
        <ActionTooltip text={beschrijving} />
      </span>
      {children}
    </label>
  );
}

export function ActionGroupedSections({
  opties,
  rows,
  titlePrefix,
  accentColor = DEFAULT_ACCENT,
  rowAccentColor = DEFAULT_ROW_ACCENT,
  onAddRow,
  onUpdateField,
  onRemoveRow,
  busy,
  isMeervoudigOptie,
  secondaryOptionsByGroupKey = {},
}) {
  return opties.map((optie) => {
    const sectionRows = rows.filter((row) => row.groupKey === optie.groupKey);
    const isMeervoudig = isMeervoudigOptie(optie);

    return (
      <ActionSection
        key={`${titlePrefix}-${optie.groupKey}`}
        title={`${titlePrefix}: ${optie.label}`}
        titleTooltip={String(optie?.group?.typeMeta?.description || "")}
        accentColor={accentColor}
        onAdd={() => onAddRow(optie.groupKey)}
        disabled={busy || (!isMeervoudig && sectionRows.length >= 1)}
      >
        {sectionRows.length === 0 ? <p className="muted" style={{ margin: 0, fontSize: 12 }}>Geen regels.</p> : null}
        {sectionRows.map((row) => {
          const secondaireInfo = secondaryOptionsByGroupKey[row.groupKey] || { loading: false, ids: [], error: "" };
          const velden = Array.isArray(optie?.veldDefinities) ? optie.veldDefinities : [];

          return (
            <ActionRowCard
              key={`${titlePrefix}-${row.id}`}
              onRemove={() => onRemoveRow(row.id)}
              disabled={busy}
              rowAccentColor={rowAccentColor}
            >
              <ActionFieldsGrid>
                {velden.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>Geen veldinformatie beschikbaar.</span> : null}
                {velden.map((veld) => (
                  <ActionLabeledEditorField key={`${row.id}-${veld.naam}`} veldnaam={veld.naam} beschrijving={String(veld?.description || "")}>
                    <ActionFieldControl
                      veld={veld}
                      value={row?.values?.[veld.naam] ?? ""}
                      onChange={(waarde) => onUpdateField(row.id, veld.naam, waarde)}
                      secondaireInfo={secondaireInfo}
                      secondaireKolom={optie?.secondaireEntiteitIDKolom}
                    />
                  </ActionLabeledEditorField>
                ))}
              </ActionFieldsGrid>
            </ActionRowCard>
          );
        })}
      </ActionSection>
    );
  });
}
