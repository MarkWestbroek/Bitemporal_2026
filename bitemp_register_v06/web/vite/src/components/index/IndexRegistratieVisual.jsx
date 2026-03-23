import { SvgPatternDefs } from "../../shared/SvgPatternDefs";

function splitLabelOverMeerdereRegels(label, maxRegelLengte = 16, maxRegels = 2) {
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

export default function IndexRegistratieVisual({
  registratieSvgHoogte,
  registratieActieOpen,
  openRegistratieActieBox,
  afgeknotteHoekPad,
  microsecondeIntVanTijdstip,
  visualRegistratie,
  nadrukStyleLinks,
  visualWijzigingen,
  wijzigingPatroonId,
  nadrukStyle,
  isOngedaanmaking,
  grootKruisEindY,
  typeMetaByTypenaam,
}) {
  const labelVoorTypeNaam = (typeNaam, fallback = "-") => {
    const naam = String(typeNaam || "").trim();
    if (!naam) return fallback;
    const meta = typeMetaByTypenaam?.[naam] || null;
    return String(meta?.klassenaam || meta?.typenaam || naam);
  };

  const eersteDividerX = 180;
  const tweedeDividerX = 341;

  return (
    <svg className="graph reg-graph" viewBox={`0 0 580 ${registratieSvgHoogte}`} preserveAspectRatio="xMidYMid meet">
      <SvgPatternDefs includeRegistratie={true} registratieFill="#f1f8ff" />
      <g className="actionable-svg-target" onClick={openRegistratieActieBox} style={{ cursor: "pointer" }}>
        {registratieActieOpen && <rect x="166" y="7" rx="8" width="249" height="80" style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
        <path
          d={afgeknotteHoekPad(168, 10, 244, 72, 10)}
          style={{ fill: "url(#pat-registratie)", stroke: "#334155", strokeWidth: 1.2 }}
        />
        <text className="label" x="406" y="26" textAnchor="end">t: {microsecondeIntVanTijdstip(visualRegistratie.tijdstip)}</text>
        <text className="label" x="180" y="37">
          <tspan style={nadrukStyleLinks}>Reg</tspan>
          {" id="}
          <tspan style={nadrukStyleLinks}>{visualRegistratie.id}</tspan>
        </text>
      </g>

      {visualWijzigingen.map((w, index) => {
        const rijHoogte = 96;
        const rijStap = 104;
        const y = 108 + index * rijStap;
        const entiteitLabel = `${labelVoorTypeNaam(w.entiteitnaam, w.entiteitnaam)}: ${w.entiteit_id ?? "-"}`;
        const repLabel = `${labelVoorTypeNaam(w.representatienaam, w.representatienaam || "-")}: ${w.representatie_id || "-"}`;
        const entiteitRegels = splitLabelOverMeerdereRegels(entiteitLabel, 18, 2);
        const repRegels = splitLabelOverMeerdereRegels(repLabel, 18, 3);
        return (
          <g key={`vwz-${w.id || index}`}>
            <line className="edge" x1="290" y1="82" x2="290" y2={y - 12} />
            <path
              d={afgeknotteHoekPad(69, y, 442, rijHoogte, 10)}
              style={{ fill: `url(#${wijzigingPatroonId(w.wijzigingstype)})`, stroke: "#334155", strokeWidth: 1.2 }}
            />
            <line x1={eersteDividerX} y1={y} x2={eersteDividerX} y2={y + rijHoogte} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={tweedeDividerX} y1={y} x2={tweedeDividerX} y2={y + rijHoogte} stroke="#cbd5e1" strokeWidth="1" />
            <text className="label label-left-lg" x="81" y={y + 52}>{w.wijzigingstype}</text>
            <text className="label" x="192" y={y + 30}>
              {entiteitRegels.map((regel, regelIndex) => (
                <tspan key={`ent-${regelIndex}`} x="192" dy={regelIndex === 0 ? 0 : 16} style={nadrukStyle}>{regel}</tspan>
              ))}
            </text>
            {!((w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "") && (w.representatie_id === null || w.representatie_id === undefined || w.representatie_id === "")) && (
              <text className="label" x="353" y={y + 24}>
                {repRegels.map((regel, regelIndex) => (
                  <tspan key={`rep-${regelIndex}`} x="353" dy={regelIndex === 0 ? 0 : 16} style={(w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "") ? undefined : nadrukStyle}>{regel}</tspan>
                ))}
              </text>
            )}
          </g>
        );
      })}

      {isOngedaanmaking && (
        <>
          <line x1="70" y1="10" x2="510" y2={grootKruisEindY} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
          <line x1="510" y1="10" x2="70" y2={grootKruisEindY} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
        </>
      )}

      {visualWijzigingen.length === 0 && <text className="label" x="176" y="170">Geen wijzigingen onder deze registratie</text>}
    </svg>
  );
}
