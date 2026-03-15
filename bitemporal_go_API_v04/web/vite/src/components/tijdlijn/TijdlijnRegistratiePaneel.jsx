import { SvgPatternDefs } from "../../shared/SvgPatternDefs";

export default function TijdlijnRegistratiePaneel({
  reg,
  visualReg,
  wijzigingen,
  registratieTitel,
  registratieOpmerking,
  regViewBoxHeight,
  isOngedaanmaking,
  entityType,
  microsecondeIntVanTijdstip,
  wijzigingPatroonId,
  normaliseerIdComponent,
}) {
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
          const y = 64 + i * 56;
          const repLeeg = (w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "")
            && (w.representatie_id === null || w.representatie_id === undefined || w.representatie_id === "");
          return (
            <g key={`w-${w.id || i}`}>
              <line className="edge" x1="160" y1="52" x2="160" y2={y - 2} />
              <rect className="node" x="14" y={y} rx="8" width="292" height="44" style={{ fill: `url(#${wijzigingPatroonId(w.wijzigingstype)})` }} />
              <line x1="111" y1={y} x2="111" y2={y + 44} stroke="var(--border-strong)" strokeWidth="1" />
              <line x1="208" y1={y} x2="208" y2={y + 44} stroke="var(--border-strong)" strokeWidth="1" />
              <text id={isOngedaanmaking && String(w.wijzigingstype || "").toLowerCase() === "opvoer" ? `undo-src-${normaliseerIdComponent(reg.id)}-${i}` : undefined} className="label" x="24" y={y + 27}>{w.wijzigingstype || "-"}</text>
              <text className="label" x="120" y={y + 27}>
                <tspan className="label-strong">{w.entiteitnaam || entityType || "E"}</tspan>
                {": "}
                <tspan className="label-strong">{w.entiteit_id ?? "-"}</tspan>
              </text>
              {!repLeeg && (
                <text className="label" x="218" y={y + 27}>
                  <tspan className="label-strong">{w.representatienaam}</tspan>
                  {": "}
                  <tspan className="label-strong">{w.representatie_id}</tspan>
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
