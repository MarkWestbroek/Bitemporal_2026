import { SvgPatternDefs } from "../../shared/SvgPatternDefs";

function splitLabelOverMeerdereRegels(label, maxRegelLengte = 12, maxRegels = 2) {
  const tekst = String(label || "").trim();
  if (!tekst) return ["-"];
  if (tekst.length <= maxRegelLengte) return [tekst];

  const suffixMatch = tekst.match(/^(.*?)(:\s*[^:]+)$/);
  const basisTekst = suffixMatch ? suffixMatch[1] : tekst;
  const suffix = suffixMatch ? suffixMatch[2].trim() : "";
  const underscoreChunks = basisTekst
    .split("_")
    .filter((chunk, index, arr) => !(chunk === "" && index === arr.length - 1))
    .map((chunk, index, arr) => (index < arr.length - 1 ? `${chunk}_` : chunk))
    .filter(Boolean);

  if (underscoreChunks.length > 1) {
      const regels = [];
      const losseChunks = [...underscoreChunks];
      if (suffix) {
        losseChunks[losseChunks.length - 1] = `${losseChunks[losseChunks.length - 1]} ${suffix}`.trim();
      }
      while (losseChunks.length > 0 && regels.length < maxRegels - 1) {
        regels.push(losseChunks.shift());
      }
      if (losseChunks.length > 0) {
        regels.push(losseChunks.join(""));
      }
      return regels.filter(Boolean);
  }

  if (suffix && basisTekst.length <= maxRegelLengte) {
    return [basisTekst, suffix].filter(Boolean);
  }

  const breekIndexVoorLimiet = (() => {
    for (let index = Math.min(maxRegelLengte, tekst.length - 1); index >= 1; index -= 1) {
      const teken = tekst[index];
      if (teken === " ") return index;
    }
    return -1;
  })();

  if (breekIndexVoorLimiet > 0) {
    return [tekst.slice(0, breekIndexVoorLimiet), tekst.slice(breekIndexVoorLimiet).trimStart()].filter(Boolean);
  }

  const woorden = tekst.split(/\s+/).filter(Boolean);
  if (woorden.length === 1) {
    return [tekst.slice(0, maxRegelLengte), tekst.slice(maxRegelLengte)].filter(Boolean).slice(0, 2);
  }

  const regels = [];
  let huidig = "";
  for (const woord of woorden) {
    const kandidaat = huidig ? `${huidig} ${woord}` : woord;
    if (kandidaat.length <= maxRegelLengte || !huidig) {
      huidig = kandidaat;
      continue;
    }
    regels.push(huidig);
    huidig = woord;
    if (regels.length === 1) {
      continue;
    }
  }
  if (huidig) regels.push(huidig);
  if (regels.length <= 1) return regels;
  return [regels[0], regels.slice(1).join(" ")];
}

export default function TijdlijnRegistratiePaneel({
  reg,
  visualReg,
  wijzigingen,
  registratieTitel,
  registratieOpmerking,
  regViewBoxHeight,
  isOngedaanmaking,
  entityType,
  typeMetaByTypenaam,
  microsecondeIntVanTijdstip,
  wijzigingPatroonId,
  normaliseerIdComponent,
}) {
  const labelVoorTypeNaam = (typeNaam, fallback = "-") => {
    const naam = String(typeNaam || "").trim();
    if (!naam) return fallback;
    const meta = typeMetaByTypenaam?.[naam] || null;
    return String(meta?.klassenaam || meta?.typenaam || naam);
  };

  const eersteDividerX = 92;
  const tweedeDividerX = 186;
  const rijHoogte = 58;

  return (
    <div className="card">
      <h3 className="panel-title panel-title-row">
        <span className="panel-title-main">{`${registratieTitel} ${reg.id ?? "-"}`}</span>
        {!!registratieOpmerking && <span className="muted panel-title-remark" style={{ fontWeight: 400 }} title={registratieOpmerking}>{registratieOpmerking}</span>}
      </h3>
      <svg className="graph" viewBox={`0 0 320 ${regViewBoxHeight}`} preserveAspectRatio="xMidYMin meet" style={{ height: `${regViewBoxHeight}px` }}>
        <SvgPatternDefs includeRegistratie={true} />
        <rect className="node" x="40" y="8" rx="8" width="240" height="44" style={{ fill: "url(#pat-registratie)" }} />
        <text className="label" x="270" y="22" textAnchor="end">t: {microsecondeIntVanTijdstip(visualReg.tijdstip)}</text>
        <text className="label" x="52" y="36">
          <tspan className="label-strong">Reg</tspan>
          {" id="}
          <tspan className="label-strong">{visualReg.id ?? "-"}</tspan>
          {` | type=${visualReg.registratietype || reg.registratietype || "-"}`}
        </text>

        {wijzigingen.map((w, i) => {
          const y = 64 + i * rijHoogte;
          const repLeeg = (w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "")
            && (w.representatie_id === null || w.representatie_id === undefined || w.representatie_id === "");
          const entiteitRegels = splitLabelOverMeerdereRegels(`${labelVoorTypeNaam(w.entiteitnaam, entityType || "E")}: ${w.entiteit_id ?? "-"}`, 11, 2);
          const repRegels = splitLabelOverMeerdereRegels(`${labelVoorTypeNaam(w.representatienaam, w.representatienaam)}: ${w.representatie_id}`, 11, 3);
          return (
            <g key={`w-${w.id || i}`}>
              <line className="edge" x1="160" y1="52" x2="160" y2={y - 2} />
              <rect className="node" x="14" y={y} rx="8" width="292" height="56" style={{ fill: `url(#${wijzigingPatroonId(w.wijzigingstype)})` }} />
              <line x1={eersteDividerX} y1={y} x2={eersteDividerX} y2={y + 56} stroke="var(--border-strong)" strokeWidth="1" />
              <line x1={tweedeDividerX} y1={y} x2={tweedeDividerX} y2={y + 56} stroke="var(--border-strong)" strokeWidth="1" />
              <text id={isOngedaanmaking && String(w.wijzigingstype || "").toLowerCase() === "opvoer" ? `undo-src-${normaliseerIdComponent(reg.id)}-${i}` : undefined} className="label" x="22" y={y + 33}>{w.wijzigingstype || "-"}</text>
              <text className="label" x="100" y={y + 20}>
                {entiteitRegels.map((regel, regelIndex) => (
                  <tspan key={`ent-${regelIndex}`} x="100" dy={regelIndex === 0 ? 0 : 14} className="label-strong">{regel}</tspan>
                ))}
              </text>
              {!repLeeg && (
                <text className="label" x="194" y={y + 16}>
                  {repRegels.map((regel, regelIndex) => (
                    <tspan key={`rep-${regelIndex}`} x="194" dy={regelIndex === 0 ? 0 : 14} className="label-strong">{regel}</tspan>
                  ))}
                </text>
              )}
            </g>
          );
        })}

        {isOngedaanmaking && (
          <>
            <line x1="14" y1="8" x2="306" y2={regViewBoxHeight - 6} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
            <line x1="306" y1="8" x2="14" y2={regViewBoxHeight - 6} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}
