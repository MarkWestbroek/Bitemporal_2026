import { korteDatumWeergave, oortjePad, oortjeStyleNarrow } from "../../shared/oortjesUtils";
import { evalueerWeergaveVeldenVoorItem, evalueerCelExpressie } from "../../shared/celEvaluator";

export default function TijdlijnRepresentatiePaneel({
  item,
  reg,
  visualReg,
  highlights,
  entityType,
  entityId,
  selectedEntityMeta,
  typeMetaByTypenaam,
  entityTypes,
  repViewBoxHeight,
  buildChildNodes,
  buildOortjes,
  microsecondeIntVanTijdstip,
  korteSamenvatting,
  normInt,
  undoTargetEntId,
  undoTargetRepId,
}) {
  const entityX = 16;
  const entityY = 22;
  const entityW = 132;
  const entityH = 82;
  const childNodes = buildChildNodes(item.snapshot, selectedEntityMeta, typeMetaByTypenaam, entityTypes);
  // Materiële-tijd oortjes: aanvang/einde boven de entiteitskaart (compact formaat voor tijdlijn).
  const oortjes = buildOortjes(item.snapshot, selectedEntityMeta, typeMetaByTypenaam);

  // Weergavevelden entiteit: evalueer CEL-expressies op entiteit-niveau (alleen isWeergaveVeld=true).
  const entWeergaveTekst = (() => {
    const defs = (selectedEntityMeta?.afgeleideVelden || []).filter((av) => av.isWeergaveVeld || av.weergaveVeld);
    if (defs.length === 0 || !item.snapshot) return "";
    // Bouw childGroups-achtige context uit childNodes
    const groupMap = {};
    for (const cn of childNodes) {
      const key = cn.group?.doeltype || cn.group?.rolnaam;
      if (key && !groupMap[key]) groupMap[key] = cn;
    }
    const ctx = {};
    for (const [key, cn] of Object.entries(groupMap)) {
      const meta = typeMetaByTypenaam?.[key];
      const klassenaam = meta?.klassenaam || key;
      ctx[klassenaam] = cn.item;
    }
    return defs
      .map((av) => (av.afleidingsregelTaal === "cel" && av.afleidingsregel)
        ? evalueerCelExpressie(av.afleidingsregel, ctx) : null)
      .filter((v) => v != null && String(v).trim() !== "")
      .map(String)
      .join(" | ");
  })();
  const aanvangTekst = korteDatumWeergave(oortjes?.aanvang?.datum);
  const eindeTekst = korteDatumWeergave(oortjes?.einde?.datum);
  const oortjeTextYOffset = -3; // Optische correctie: iets hoger dan geometrisch midden i.v.m. overlap met entiteitskaart.
  // Oortje-dimensies (compact): smallere tabs die binnen 132px entiteitskaart passen.
  const OW = 62, OH = 26, OR = 7, OY = entityY - OH + 7;
  const geNodes = childNodes.filter((node) => !node.isRelatie);
  const relatieNodes = childNodes.filter((node) => node.isRelatie);
  const geW = 114;
  const geH = 52;
  const geBinnenGroepGap = 12;
  const geTussenGroepGap = 34;
  const geBinnenGroepStap = geH + geBinnenGroepGap;
  const geTussenGroepStap = geH + geTussenGroepGap;
  const geNodesMetLayout = [];
  let geCursorY = entityY;
  geNodes.forEach((node, index) => {
    const vorige = geNodes[index - 1] || null;
    const zelfType = String(node.group?.doeltype || node.group?.rolnaam || "");
    const vorigeType = String(vorige?.group?.doeltype || vorige?.group?.rolnaam || "");
    if (index > 0) {
      geCursorY += zelfType === vorigeType ? geBinnenGroepStap : geTussenGroepStap;
    }
    geNodesMetLayout.push({ ...node, y: geCursorY });
  });
  const entityRight = entityX + entityW;
  const entityTopLineY = entityY + 26;
  const entityBottomY = entityY + entityH;
  const geBranchX = 166;
  const geX = 192;
  const relTrunkX = 42;
  const relX = 78;
  const relW = 152;
  const relH = 52;
  const geBottom = geNodesMetLayout.length > 0 ? geNodesMetLayout[geNodesMetLayout.length - 1].y + geH : entityBottomY;
  const relStartY = Math.max(entityBottomY + 46, geNodesMetLayout.length > 0 ? geBottom + 20 + geTussenGroepGap : entityBottomY + 46);
  const relStepY = 82;

  return (
    <div className="card">
      <h3 className="panel-title">Representaties</h3>
      {!item.snapshot ? (
        <svg className="graph graph-rep" viewBox={`0 0 320 ${repViewBoxHeight}`} preserveAspectRatio="xMidYMin meet" style={{ height: `${repViewBoxHeight}px` }}>
          <text className="label" x="160" y={Math.max(24, Math.round(repViewBoxHeight / 2))} textAnchor="middle" fill="var(--muted)">Geen snapshot beschikbaar.</text>
        </svg>
      ) : (
        <svg className="graph graph-rep" viewBox={`0 0 320 ${repViewBoxHeight}`} preserveAspectRatio="xMidYMin meet" style={{ height: `${repViewBoxHeight}px` }}>
          <g>
            {/* Materiële-tijd oortjes: tab-vormige badges boven de entiteitskaart (kaartlip-effect). */}
            {aanvangTekst && (
              <g>
                <path d={oortjePad(entityX, OY, OW, OH, OR)} style={{ fill: selectedEntityMeta?.kleur || "var(--entity-fill)", stroke: "#334155", strokeWidth: 0.8 }} />
                <text x={entityX + OW / 2} y={OY + OH / 2 + oortjeTextYOffset} textAnchor="middle" dominantBaseline="central" style={oortjeStyleNarrow}>{aanvangTekst}</text>
              </g>
            )}
            {eindeTekst && (
              <g>
                <path d={oortjePad(entityX + entityW - OW, OY, OW, OH, OR)} style={{ fill: selectedEntityMeta?.kleur || "var(--entity-fill)", stroke: "#334155", strokeWidth: 0.8 }} />
                <text x={entityX + entityW - OW / 2} y={OY + OH / 2 + oortjeTextYOffset} textAnchor="middle" dominantBaseline="central" style={oortjeStyleNarrow}>{eindeTekst}</text>
              </g>
            )}
            <rect className="node" x={entityX} y={entityY} rx="10" width={entityW} height={entityH} style={{ fill: selectedEntityMeta?.kleur || "var(--entity-fill)", strokeWidth: 2.8 }} />
            {highlights.some((h) => h.soort === "ENT" && String(item.snapshot.id ?? normInt(entityId, 0)) === String(h.entId)) && (
              <ellipse cx={entityX + (entityW / 2)} cy={entityY + (entityH / 2)} rx="78" ry="50" fill="rgba(220, 38, 38, 0.18)" stroke="#dc2626" strokeWidth="2" />
            )}
            <text className="label" x={entityX + entityW - 8} y={entityY + 18} textAnchor="end">opv: {item.snapshot.opvoer ? microsecondeIntVanTijdstip(item.snapshot.opvoer) : "-"}</text>
            <text id={undoTargetEntId(visualReg.id, item.snapshot.id ?? normInt(entityId, 0))} className="label" x={entityX + 14} y={entityY + 30}>
              <tspan className="label-strong" style={{ fontSize: 18, fontWeight: 800 }}>{entityType || "E"}</tspan>
              {" id="}
              <tspan className="label-strong" style={{ fontSize: 18, fontWeight: 800 }}>{item.snapshot.id ?? normInt(entityId, 0)}</tspan>
            </text>
            <text className="label" x={entityX + 14} y={entityY + 54}>{korteSamenvatting(item.snapshot)}</text>
            {entWeergaveTekst && (
              <text className="label" x={entityX + 14} y={entityY + 70}
                style={{ fontStyle: "italic", fontSize: "10px", fill: "#334155" }}>
                {entWeergaveTekst}
              </text>
            )}
          </g>

          {geNodesMetLayout.length > 0 && (
            <>
              <line className="edge" x1={entityRight} y1={entityTopLineY} x2={geBranchX} y2={entityTopLineY} style={{ stroke: "var(--edge)", strokeWidth: 1.8 }} />
              <line className="edge" x1={geBranchX} y1={entityTopLineY} x2={geBranchX} y2={geNodesMetLayout[geNodesMetLayout.length - 1].y + 26} style={{ stroke: "var(--edge)", strokeWidth: 1.8 }} />
            </>
          )}

          {relatieNodes.length > 0 && (
            <>
              <line className="edge" x1={relTrunkX} y1={entityBottomY} x2={relTrunkX} y2={relStartY + ((relatieNodes.length - 1) * relStepY) + 8} style={{ stroke: "var(--stroke)", strokeWidth: 2.8 }} />
              <line className="edge" x1={relTrunkX} y1={entityBottomY} x2={entityX + 40} y2={entityBottomY} style={{ stroke: "var(--stroke)", strokeWidth: 2.8 }} />
            </>
          )}

          {geNodesMetLayout.map((childNode) => {
            const y = childNode.y;
            const { group, item: childItem } = childNode;
            const doelLabel = group.typeMeta?.klassenaam || group.doeltype || group.rolnaam || "-";
            const nodeFill = group.typeMeta?.kleur || "var(--neutral-fill)";
            const isHighlighted = highlights.some((h) => h.soort === "REP"
              && String(h.repNaam || "").toUpperCase() === String(doelLabel || "").toUpperCase()
              && String(h.repId) === String(childItem.rel_id ?? childItem.id ?? ""));
            return (
              <g key={childNode.key}>
                <line className="edge" x1={geBranchX} y1={y + 26} x2={geX} y2={y + 26} style={{ stroke: "var(--edge)", strokeWidth: 1.8 }} />
                <rect className="node" x={geX} y={y} rx="8" width={geW} height={geH} style={{ fill: nodeFill, stroke: "var(--stroke)", strokeWidth: 2.2 }} />
                {isHighlighted && <ellipse cx={geX + (geW / 2)} cy={y + (geH / 2)} rx="66" ry="34" fill="rgba(220, 38, 38, 0.18)" stroke="#dc2626" strokeWidth="2" />}
                <text className="label" x={geX + geW - 8} y={y + 14} textAnchor="end">opv: {childItem.opvoer ? microsecondeIntVanTijdstip(childItem.opvoer) : "-"}</text>
                <text id={undoTargetRepId(visualReg.id, doelLabel, childItem.rel_id ?? childItem.id ?? "")} className="label" x={geX + 8} y={y + 22}>
                  <tspan className="label-strong">{doelLabel}</tspan>
                  {` #${childItem.rel_id ?? childItem.id ?? "-"}`}
                </text>
                <text className="label" x={geX + 8} y={y + 40}>{korteSamenvatting(childItem)}</text>
                {(() => {
                  const wv = evalueerWeergaveVeldenVoorItem(group.typeMeta?.afgeleideVelden, childItem, group.typeMeta, typeMetaByTypenaam);
                  return wv.length > 0 ? (
                    <text className="label" x={geX + 8} y={y + 50}
                      style={{ fontStyle: "italic", fontSize: "9px", fill: "#334155" }}>
                      {wv.join(" | ")}
                    </text>
                  ) : null;
                })()}
              </g>
            );
          })}

          {relatieNodes.map((childNode, groupIndex) => {
            const y = relStartY + (groupIndex * relStepY);
            const { group, item: childItem } = childNode;
            const doelLabel = group.typeMeta?.klassenaam || group.doeltype || group.rolnaam || "-";
            const isHighlighted = highlights.some((h) => h.soort === "REP"
              && String(h.repNaam || "").toUpperCase() === String(doelLabel || "").toUpperCase()
              && String(h.repId) === String(childItem.rel_id ?? childItem.id ?? ""));
            const secondBoxW = 72;
            const secondBoxH = 24;
            const secondBoxX = relX + relW - secondBoxW - 10;
            const secondBoxY = y + 16;
            return (
              <g key={childNode.key}>
                <line className="edge" x1={relTrunkX} y1={y + 8} x2={relX} y2={y + 8} style={{ stroke: "var(--stroke)", strokeWidth: 2.8 }} />
                <rect className="node" x={relX} y={y - 20} rx="8" width={relW} height={relH} style={{ fill: group.typeMeta?.kleur || "#fff7ed", stroke: "#7c2d12", strokeWidth: 2.8 }} />
                {isHighlighted && <ellipse cx={relX + (relW / 2)} cy={y + 6} rx="82" ry="34" fill="rgba(220, 38, 38, 0.18)" stroke="#dc2626" strokeWidth="2" />}
                <text className="label" x={relX + relW - 8} y={y - 6} textAnchor="end">opv: {childItem.opvoer ? microsecondeIntVanTijdstip(childItem.opvoer) : "-"}</text>
                <text id={undoTargetRepId(visualReg.id, doelLabel, childItem.rel_id ?? childItem.id ?? "")} className="label" x={relX + 12} y={y + 2}>
                  <tspan className="label-strong">{doelLabel}</tspan>
                  {` rel_id=${childItem.rel_id ?? childItem.id ?? "-"}`}
                </text>
                <text className="label" x={relX + 12} y={y + 22}>{korteSamenvatting(childItem)}</text>
                {(() => {
                  const wv = evalueerWeergaveVeldenVoorItem(group.typeMeta?.afgeleideVelden, childItem, group.typeMeta, typeMetaByTypenaam);
                  return wv.length > 0 ? (
                    <text className="label" x={relX + 12} y={y + 32}
                      style={{ fontStyle: "italic", fontSize: "9px", fill: "#334155" }}>
                      {wv.join(" | ")}
                    </text>
                  ) : null;
                })()}
                {!!childNode.tweedeEntiteitIDTekst && (
                  <>
                    <rect x={secondBoxX} y={secondBoxY} rx="6" width={secondBoxW} height={secondBoxH} style={{ fill: childNode.tweedeEntiteitKleur || "var(--entity-fill)", stroke: childNode.tweedeEntiteitRandkleur || "#1e3a8a", strokeWidth: 2 }} />
                    <text className="label" x={secondBoxX + 6} y={secondBoxY + 16}>
                      <tspan className="label-strong">{childNode.tweedeEntiteitType || "Ent"}</tspan>
                      {" id="}
                      <tspan className="label-strong">{childNode.tweedeEntiteitIDTekst}</tspan>
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
