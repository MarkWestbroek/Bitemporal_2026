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
        const y = 108 + index * 92;
        return (
          <g key={`vwz-${w.id || index}`}>
            <line className="edge" x1="290" y1="82" x2="290" y2={y - 12} />
            <path
              d={afgeknotteHoekPad(69, y, 442, 84, 10)}
              style={{ fill: `url(#${wijzigingPatroonId(w.wijzigingstype)})`, stroke: "#334155", strokeWidth: 1.2 }}
            />
            <line x1="216" y1={y} x2="216" y2={y + 84} stroke="#cbd5e1" strokeWidth="1" />
            <line x1="363" y1={y} x2="363" y2={y + 84} stroke="#cbd5e1" strokeWidth="1" />
            <text className="label label-left-lg" x="81" y={y + 46}>{w.wijzigingstype}</text>
            <text className="label" x="228" y={y + 46}>
              {"entiteit="}
              <tspan style={nadrukStyle}>{w.entiteitnaam}</tspan>
              {": "}
              <tspan style={nadrukStyle}>{w.entiteit_id}</tspan>
            </text>
            {!((w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "") && (w.representatie_id === null || w.representatie_id === undefined || w.representatie_id === "")) && (
              <text className="label" x="376" y={y + 46}>
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
          <line x1="70" y1="10" x2="510" y2={grootKruisEindY} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
          <line x1="510" y1="10" x2="70" y2={grootKruisEindY} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
        </>
      )}

      {visualWijzigingen.length === 0 && <text className="label" x="176" y="170">Geen wijzigingen onder deze registratie</text>}
    </svg>
  );
}
