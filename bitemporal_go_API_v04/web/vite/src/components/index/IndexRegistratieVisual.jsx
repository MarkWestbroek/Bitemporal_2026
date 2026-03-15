import { SvgPatternDefs } from "../../shared/SvgPatternDefs";

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
}) {
  return (
    <svg className="graph" viewBox={`0 0 760 ${registratieSvgHoogte}`} preserveAspectRatio="xMidYMid meet">
      <SvgPatternDefs includeRegistratie={true} registratieFill="#f1f8ff" />
      <g className="actionable-svg-target" onClick={openRegistratieActieBox} style={{ cursor: "pointer" }}>
        {registratieActieOpen && <rect x="217" y="7" rx="8" width="326" height="80" style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
        <path
          d={afgeknotteHoekPad(220, 10, 320, 72, 10)}
          style={{ fill: "url(#pat-registratie)", stroke: "#334155", strokeWidth: 1.2 }}
        />
        <text className="label" x="532" y="26" textAnchor="end">t: {microsecondeIntVanTijdstip(visualRegistratie.tijdstip)}</text>
        <text className="label label-left-lg" x="236" y="37">
          <tspan style={nadrukStyleLinks}>Reg</tspan>
          {" id="}
          <tspan style={nadrukStyleLinks}>{visualRegistratie.id}</tspan>
          {` | type=${visualRegistratie.registratietype}`}
        </text>
      </g>

      {visualWijzigingen.map((w, index) => {
        const y = 108 + index * 92;
        return (
          <g key={`vwz-${w.id || index}`}>
            <line className="edge" x1="380" y1="82" x2="380" y2={y - 12} />
            <path
              d={afgeknotteHoekPad(90, y, 580, 84, 10)}
              style={{ fill: `url(#${wijzigingPatroonId(w.wijzigingstype)})`, stroke: "#334155", strokeWidth: 1.2 }}
            />
            <line x1="283" y1={y} x2="283" y2={y + 84} stroke="#cbd5e1" strokeWidth="1" />
            <line x1="476" y1={y} x2="476" y2={y + 84} stroke="#cbd5e1" strokeWidth="1" />
            <text className="label label-left-lg" x="106" y={y + 46}>{w.wijzigingstype}</text>
            <text className="label" x="299" y={y + 46}>
              {"entiteit="}
              <tspan style={nadrukStyle}>{w.entiteitnaam}</tspan>
              {": "}
              <tspan style={nadrukStyle}>{w.entiteit_id}</tspan>
            </text>
            {!((w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "") && (w.representatie_id === null || w.representatie_id === undefined || w.representatie_id === "")) && (
              <text className="label" x="492" y={y + 46}>
                {"rep="}
                <tspan style={(w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "") ? undefined : nadrukStyle}>
                  {w.representatienaam || "-"}
                </tspan>
                {": "}
                <tspan style={(w.representatie_id === null || w.representatie_id === undefined || w.representatie_id === "") ? undefined : nadrukStyle}>
                  {w.representatie_id || "-"}
                </tspan>
              </text>
            )}
          </g>
        );
      })}

      {isOngedaanmaking && (
        <>
          <line x1="92" y1="10" x2="668" y2={grootKruisEindY} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
          <line x1="668" y1="10" x2="92" y2={grootKruisEindY} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
        </>
      )}

      {visualWijzigingen.length === 0 && <text className="label" x="230" y="170">Geen wijzigingen onder deze registratie</text>}
    </svg>
  );
}
