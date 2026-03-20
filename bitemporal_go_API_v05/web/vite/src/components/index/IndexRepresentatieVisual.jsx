/**
 * Formatteert een datum-string naar verkorte weergave: d/m/jj (bijv. "1/1/20").
 * Gebruikt voor de materiële-tijd "oortjes" boven entiteitskaarten.
 */
function korteDatumWeergave(datumStr) {
  if (!datumStr) return null;
  try {
    const d = new Date(datumStr);
    if (isNaN(d.getTime())) return null;
    const dag = d.getDate();
    const maand = d.getMonth() + 1;
    const jaar = String(d.getFullYear()).slice(-2);
    return `${dag}/${maand}/${jaar}`;
  } catch {
    return null;
  }
}

/**
 * SVG-pad voor een oortje-tab: afgeronde bovenkant, open onderkant.
 * Door het pad vóór de entity rect te tekenen bedekt die de onderrand automatisch (kaartlip-effect).
 */
function oortjePad(x, y, w, h, r = 7) {
  return `M ${x},${y + h} L ${x},${y + r} Q ${x},${y} ${x + r},${y} L ${x + w - r},${y} Q ${x + w},${y} ${x + w},${y + r} L ${x + w},${y + h}`;
}

// Stijl voor de materiële-tijd oortjes: handschrift-achtig lettertype voor visueel onderscheid.
const oortjeStyle = { fontSize: "11px", fontFamily: "'Caveat', cursive", fill: "#334155", fontWeight: 700 };

export default function IndexRepresentatieVisual({
  svgHoogte,
  geGroepenMetLayout,
  geNodesVoorGrafiek,
  geselecteerdeRep,
  registratieIDUitOpvoerTijdstip,
  selecteerRep,
  navigeerNaarRegistratieVanOpvoer,
  microsecondeIntVanTijdstip,
  labelVoorChildType,
  korteSamenvatting,
  nadrukStyle,
  entiteitActieOpen,
  openEntiteitActieBox,
  selectedEntiteitMeta,
  selectedA,
  entiteitType,
  centraleEntiteitLabelStyle,
  relatieNodesVoorGrafiek,
  entiteitOortjes,
}) {
  return (
    <svg className="graph" viewBox={`0 0 900 ${svgHoogte}`} preserveAspectRatio="xMidYMid meet">
      {geGroepenMetLayout.map((group) => {
        const minY = group.ys[0] || group.fromY;
        const maxY = group.ys[group.ys.length - 1] || group.fromY;
        const vertTop = Math.min(group.fromY, minY);
        const vertBottom = Math.max(group.fromY, maxY);
        const heeftTopKnik = group.sideIndex > 0;
        const trunkTop = Math.min(group.fromY, group.anchorY);
        const trunkBottom = Math.max(group.fromY, group.anchorY);

        return (
          <g key={`ge-conn-${group.key}`}>
            {heeftTopKnik && (
              <line x1={group.fromX} y1={trunkTop} x2={group.fromX} y2={trunkBottom} style={{ stroke: "#94a3b8", strokeWidth: 1.5 }} />
            )}
            <line x1={group.fromX} y1={group.fromY} x2={group.branchX} y2={group.fromY} style={{ stroke: "#94a3b8", strokeWidth: 1.5 }} />
            <line x1={group.branchX} y1={vertTop} x2={group.branchX} y2={vertBottom} style={{ stroke: "#94a3b8", strokeWidth: 1.5 }} />
            {group.ys.map((y, i) => (
              <line key={`ge-conn-${group.key}-${i}`} x1={group.branchX} y1={y} x2={group.targetX} y2={y} style={{ stroke: "#94a3b8", strokeWidth: 1.5 }} />
            ))}
          </g>
        );
      })}

      {geNodesVoorGrafiek.map((node) => {
        const x = node.side === "left" ? 30 : 690;
        const width = 180;
        const textX = node.side === "left" ? 42 : 700;
        const nodeFill = node.group?.kleur || "#ffffff";
        const isSelected = geselecteerdeRep?.item === node.item;
        const opvoerRegistratieID = registratieIDUitOpvoerTijdstip(node.item.opvoer);
        const opvoerKlikbaar = opvoerRegistratieID > 0;

        return (
          <g className="actionable-svg-target" key={node.key} onClick={() => selecteerRep(node.item, node.group)} style={{ cursor: "pointer" }}>
            {isSelected && <rect x={x - 3} y={node.y - 33} rx="10" width={width + 6} height={66} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
            <rect x={x} y={node.y - 30} rx="8" width={width} height="60" style={{ fill: nodeFill, stroke: "#334155", strokeWidth: 1.2 }} />
            <text
              className={`label label-lg ${opvoerKlikbaar ? "opv-link" : ""}`}
              x={x + width - 8}
              y={node.y - 16}
              textAnchor="end"
              onClick={opvoerKlikbaar ? (event) => navigeerNaarRegistratieVanOpvoer(event, node.item.opvoer) : undefined}
            >
              opv: {node.item.opvoer ? microsecondeIntVanTijdstip(node.item.opvoer) : "-"}
            </text>
            <text className="label label-lg" x={textX} y={node.y - 8}>
              <tspan style={nadrukStyle}>{labelVoorChildType(node.group.doeltype, node.group.rolnaam)}</tspan>
              {" rel_id="}
              <tspan style={nadrukStyle}>{node.item.rel_id ?? node.item.id ?? "-"}</tspan>
            </text>
            <text className="label label-lg" x={textX} y={node.y + 12}>{korteSamenvatting(node.item)}</text>
          </g>
        );
      })}

      {(() => {
        const entOpvoerRegID = selectedA.opvoer ? registratieIDUitOpvoerTijdstip(selectedA.opvoer) : 0;
        const entOpvoerKlikbaar = entOpvoerRegID > 0;
        // Oortje-dimensies: tab boven de entiteitskaart (entity rect y=40), onderkant overlapt zodat entity die bedekt.
        const OY = 17, OW = 76, OH = 28, OR = 7;
        const aanvangOortje = entiteitOortjes?.aanvang;
        const eindeOortje = entiteitOortjes?.einde;
        const aanvangTekst = korteDatumWeergave(aanvangOortje?.datum);
        const eindeTekst = korteDatumWeergave(eindeOortje?.datum);
        const entFill = selectedEntiteitMeta?.kleur || "#dbeafe";
        return (
          <>
            {/* Materiële-tijd oortjes: getekend VOOR de entity rect zodat die hun onderrand bedekt (kaartlip-effect).
                Klikbaar als GE: selecteerRep opent het bewerkformulier net als gewone gegevenselementen. */}
            {aanvangTekst && (
              <g className="actionable-svg-target" onClick={() => selecteerRep(aanvangOortje.item, aanvangOortje.group)} style={{ cursor: "pointer" }}>
                {geselecteerdeRep?.item === aanvangOortje.item && (
                  <rect x="334" y={OY - 4} rx={OR + 2} width={OW + 6} height={OH + 4} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2, strokeDasharray: "4,3" }} />
                )}
                <path d={oortjePad(337, OY, OW, OH, OR)} style={{ fill: entFill, stroke: "#334155", strokeWidth: 1.2 }} />
                <text x={375} y={OY + OH - 10} textAnchor="middle" style={oortjeStyle}>{aanvangTekst}</text>
              </g>
            )}
            {eindeTekst && (
              <g className="actionable-svg-target" onClick={() => selecteerRep(eindeOortje.item, eindeOortje.group)} style={{ cursor: "pointer" }}>
                {geselecteerdeRep?.item === eindeOortje.item && (
                  <rect x="487" y={OY - 4} rx={OR + 2} width={OW + 6} height={OH + 4} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2, strokeDasharray: "4,3" }} />
                )}
                <path d={oortjePad(490, OY, OW, OH, OR)} style={{ fill: entFill, stroke: "#334155", strokeWidth: 1.2 }} />
                <text x={528} y={OY + OH - 10} textAnchor="middle" style={oortjeStyle}>{eindeTekst}</text>
              </g>
            )}
            {/* Entiteitskaart: getekend NA de oortjes — bedekt hun onderrand voor het kaartlip-effect. */}
            <g className="actionable-svg-target" onClick={openEntiteitActieBox} style={{ cursor: "pointer" }}>
              {entiteitActieOpen && <rect x="327" y="37" rx="12" width="246" height="86" style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
              <rect className="node" x="330" y="40" rx="10" width="240" height="80" style={{ fill: entFill, strokeWidth: 2.8 }} />
              <text
                className={`label label-lg${entOpvoerKlikbaar ? " opv-link" : ""}`}
                x="562" y="56" textAnchor="end"
                onClick={entOpvoerKlikbaar ? (event) => navigeerNaarRegistratieVanOpvoer(event, selectedA.opvoer) : undefined}
              >opv: {selectedA.opvoer ? microsecondeIntVanTijdstip(selectedA.opvoer) : "-"}</text>
              <text className="label" x="345" y="74">
                <tspan style={centraleEntiteitLabelStyle}>{entiteitType || "E"}</tspan>
                {" id="}
                <tspan style={centraleEntiteitLabelStyle}>{selectedA.id}</tspan>
              </text>
            </g>
          </>
        );
      })()}

      {relatieNodesVoorGrafiek.length > 0 && (
        <>
          <line
            x1="362"
            y1="120"
            x2="362"
            y2={relatieNodesVoorGrafiek[relatieNodesVoorGrafiek.length - 1].y}
            style={{ stroke: "#334155", strokeWidth: 2.8 }}
          />
        </>
      )}

      {relatieNodesVoorGrafiek.map((node) => {
        const centraleEntiteitRechts = 570;
        const relW = 180;
        const relX = centraleEntiteitRechts - relW;
        const relH = 54;
        const relFill = node.group?.kleur || "#fff7ed";
        const secondBoxW = 84;
        const secondBoxH = 24;
        const secondBoxX = relX + relW - secondBoxW - 8;
        const secondBoxY = node.y + 18;
        const isRelSelected = geselecteerdeRep?.item === node.item;
        const opvoerRegistratieID = registratieIDUitOpvoerTijdstip(node.item.opvoer);
        const opvoerKlikbaar = opvoerRegistratieID > 0;
        return (
          <g className="actionable-svg-target" key={node.key} onClick={() => selecteerRep(node.item, node.group)} style={{ cursor: "pointer" }}>
            {isRelSelected && <rect x={relX - 3} y={node.y - 27} rx="10" width={relW + 6} height={relH + 6} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
            <line x1="362" y1={node.y} x2={relX} y2={node.y} style={{ stroke: "#334155", strokeWidth: 2.8 }} />
            <rect x={relX} y={node.y - 24} rx="8" width={relW} height={relH} style={{ fill: relFill, stroke: "#7c2d12", strokeWidth: 2.8 }} />
            <text
              className={`label ${opvoerKlikbaar ? "opv-link" : ""}`}
              x={relX + relW - 8}
              y={node.y - 10}
              textAnchor="end"
              onClick={opvoerKlikbaar ? (event) => navigeerNaarRegistratieVanOpvoer(event, node.item.opvoer) : undefined}
            >
              opv: {node.item.opvoer ? microsecondeIntVanTijdstip(node.item.opvoer) : "-"}
            </text>
            <text className="label label-lg" x={relX + 10} y={node.y - 6}>
              <tspan style={nadrukStyle}>{labelVoorChildType(node.group.doeltype, node.group.rolnaam)}</tspan>
              {" rel_id="}
              <tspan style={nadrukStyle}>{node.item.rel_id ?? node.item.id ?? "-"}</tspan>
            </text>
            <text className="label" x={relX + 10} y={node.y + 12}>{korteSamenvatting(node.item)}</text>
            {!!node.tweedeEntiteitLabel && (
              <>
                <rect x={secondBoxX} y={secondBoxY} rx="6" width={secondBoxW} height={secondBoxH} style={{ fill: node.tweedeEntiteitKleur || "#dbeafe", stroke: node.tweedeEntiteitRandkleur || "#1e3a8a", strokeWidth: 2 }} />
                <text className="label" x={secondBoxX + 6} y={secondBoxY + 16}>
                  <tspan style={nadrukStyle}>{node.tweedeEntiteitType || "Ent"}</tspan>
                  {" id="}
                  <tspan style={nadrukStyle}>{node.tweedeEntiteitIDTekst || "-"}</tspan>
                </text>
              </>
            )}
          </g>
        );
      })}

      {geNodesVoorGrafiek.length === 0 && relatieNodesVoorGrafiek.length === 0 && (
        <text className="label" x="300" y="240">Geen gegevenselementen of relaties onder deze entiteit</text>
      )}
    </svg>
  );
}
