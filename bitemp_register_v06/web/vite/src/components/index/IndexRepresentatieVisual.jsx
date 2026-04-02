import { korteDatumWeergave, oortjePad, oortjeStyle, bepaalHubOortjes } from "../../shared/oortjesUtils";

function schatSvgTekstBreedte(tekst, fontSizePx = 12, extraPadding = 24) {
  const inhoud = String(tekst || "").trim();
  if (!inhoud) return 0;
  return Math.ceil((inhoud.length * fontSizePx * 0.58) + extraPadding);
}

function bepaalKaartBreedte(teksten, minBreedte = 240, maxBreedte = 380) {
  const lijst = Array.isArray(teksten) ? teksten : [teksten];
  const breedte = lijst.reduce((max, entry) => {
    const tekst = typeof entry === "string" ? entry : entry?.tekst;
    const fontSize = typeof entry === "string" ? 12 : (entry?.fontSize ?? 12);
    const padding = typeof entry === "string" ? 24 : (entry?.padding ?? 24);
    return Math.max(max, schatSvgTekstBreedte(tekst, fontSize, padding));
  }, minBreedte);
  return Math.max(minBreedte, Math.min(maxBreedte, breedte));
}

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
  typeMetaByTypenaam,
  navigeerNaarSecondaireEntiteit,
  afgeleideVeldWaarden,
  entiteitWeergaveVeldTekst,
  evalueerWeergaveVeldenVoorItem,
}) {
  const centraleWeergaveTekst = String(entiteitWeergaveVeldTekst || "");
  const centraleWeergaveFontSize =
    centraleWeergaveTekst.length > 42 ? "15px" :
    centraleWeergaveTekst.length > 32 ? "16px" :
    centraleWeergaveTekst.length > 24 ? "17px" :
    "19px";

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
        const width = 194;
        const textX = node.side === "left" ? 42 : 700;
        const nodeFill = node.group?.kleur || "#ffffff";
        const isSelected = geselecteerdeRep?.item === node.item;
        const opvoerRegistratieID = registratieIDUitOpvoerTijdstip(node.item.opvoer);
        const opvoerKlikbaar = opvoerRegistratieID > 0;
        // Materiële-tijd mini-oortjes op hub-niveau GE's
        const hubMeta = typeMetaByTypenaam?.[node.group?.doeltype];
        const isMaterieleHub = hubMeta?.isMaterieel && hubMeta?.ge_subtype === "hub";
        const hubOortjes = isMaterieleHub ? bepaalHubOortjes(node.item) : null;
        const aanvangTekst = hubOortjes ? korteDatumWeergave(hubOortjes.aanvangDatum) : null;
        const eindeTekst = hubOortjes ? korteDatumWeergave(hubOortjes.eindeDatum) : null;
        // Mini-oortje dimensies: kleiner dan entiteits-oortjes, met lichte overlap zodat
        // het oortje visueel vastzit aan de kaart, ook als de kaart iets naar beneden schuift.
        const mOW = 72, mOH = 20, mOR = 5;
        const boxH = 66;
        const boxY = node.y - (boxH / 2);
        const mOY = boxY - mOH + 6;

        return (
          <g className="actionable-svg-target" key={node.key} onClick={() => selecteerRep(node.item, node.group)} style={{ cursor: "pointer" }}>
            {isSelected && <rect x={x - 3} y={boxY - 3 - (aanvangTekst || eindeTekst ? 18 : 0)} rx="10" width={width + 6} height={boxH + 6 + (aanvangTekst || eindeTekst ? 18 : 0)} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
            {/* Materiële-tijd mini-oortjes boven de GE-card */}
            {aanvangTekst && (
              <g>
                <path d={oortjePad(x, mOY, mOW, mOH, mOR)} style={{ fill: nodeFill, stroke: "#334155", strokeWidth: 0.8 }} />
                <text x={x + mOW / 2} y={mOY + mOH - 6} textAnchor="middle" style={{ ...oortjeStyle, fontSize: "9.5px" }}>{aanvangTekst}</text>
              </g>
            )}
            {eindeTekst && (
              <g>
                <path d={oortjePad(x + width - mOW, mOY, mOW, mOH, mOR)} style={{ fill: nodeFill, stroke: "#334155", strokeWidth: 0.8 }} />
                <text x={x + width - mOW / 2} y={mOY + mOH - 6} textAnchor="middle" style={{ ...oortjeStyle, fontSize: "9.5px" }}>{eindeTekst}</text>
              </g>
            )}
            <rect x={x} y={boxY} rx="8" width={width} height={boxH} style={{ fill: nodeFill, stroke: "#334155", strokeWidth: 1.2 }} />
            <text
              className={`label label-lg ${opvoerKlikbaar ? "opv-link" : ""}`}
              x={x + width - 8}
              y={boxY + 14}
              textAnchor="end"
              onClick={opvoerKlikbaar ? (event) => navigeerNaarRegistratieVanOpvoer(event, node.item.opvoer) : undefined}
            >
              opv: {node.item.opvoer ? microsecondeIntVanTijdstip(node.item.opvoer) : "-"}
            </text>
            <text className="label" x={textX} y={boxY + 24}>
              <tspan style={{ fontWeight: 700, fontSize: "13px" }}>{labelVoorChildType(node.group.doeltype, node.group.rolnaam, node.group.typeMeta?.klassenaam)}</tspan>
              <tspan style={{ fontSize: "10.5px", fill: "#64748b" }}>{" "}rel_id={node.item.rel_id ?? node.item.id ?? "-"}</tspan>
            </text>
            {(() => {
              const hubMeta2 = typeMetaByTypenaam?.[node.group?.doeltype];
              const wvTeksten = evalueerWeergaveVeldenVoorItem(hubMeta2?.afgeleideVelden, node.item, hubMeta2, typeMetaByTypenaam);
              if (wvTeksten.length > 0) {
                return (
                  <text className="label" x={textX} y={boxY + 44}
                    style={{ fontWeight: 600, fontSize: "12.5px", fill: "#1e293b" }}>
                    {wvTeksten.join(" | ")}
                  </text>
                );
              }
              const entIDKol = String(node.group?.typeMeta?.entiteitIDKolom || '').toLowerCase();
              const secIDKol = String(node.group?.typeMeta?.secondaireEntiteitIDKolom || '').toLowerCase();
              const extraSkip = new Set([entIDKol, secIDKol].filter(Boolean));
              return (
                <text className="label" x={textX} y={boxY + 44}
                  style={{ fontSize: "12px", fill: "#475569" }}>
                  {korteSamenvatting(node.item, extraSkip)}
                </text>
              );
            })()}
          </g>
        );
      })}

      {(() => {
        const entOpvoerRegID = selectedA.opvoer ? registratieIDUitOpvoerTijdstip(selectedA.opvoer) : 0;
        const entOpvoerKlikbaar = entOpvoerRegID > 0;
        // Oortje-dimensies: tab boven de entiteitskaart (entity rect y=40), onderkant overlapt zodat entity die bedekt.
        // OW=94 past een volledige NL-datum (d-m-jjjj) zoals "31-12-1979".
        const OY = 17, OW = 94, OH = 28, OR = 7;
        const aanvangOortje = entiteitOortjes?.aanvang;
        const eindeOortje = entiteitOortjes?.einde;
        const aanvangTekst = korteDatumWeergave(aanvangOortje?.datum);
        const eindeTekst = korteDatumWeergave(eindeOortje?.datum);
        const entFill = selectedEntiteitMeta?.kleur || "#dbeafe";
        const entityW = entiteitWeergaveVeldTekst
          ? bepaalKaartBreedte([
              { tekst: entiteitWeergaveVeldTekst, fontSize: Number.parseFloat(centraleWeergaveFontSize) || 19, padding: 56 },
              { tekst: `${entiteitType || "E"} · id ${selectedA.id}`, fontSize: 11.5, padding: 36 },
            ], 240, 380)
          : 240;
        const entityX = Math.round(450 - (entityW / 2));
        const entityRight = entityX + entityW;
        return (
          <>
            {/* Materiële-tijd oortjes: getekend VOOR de entity rect zodat die hun onderrand bedekt (kaartlip-effect).
                Klikbaar als GE: selecteerRep opent het bewerkformulier net als gewone gegevenselementen. */}
            {/* Materiële-tijd oortjes: aanvang links, einde rechts, beide boven de entiteitskaart. */}
            {aanvangTekst && (
              <g className="actionable-svg-target" onClick={() => selecteerRep(aanvangOortje.item, aanvangOortje.group)} style={{ cursor: "pointer" }}>
                {geselecteerdeRep?.item === aanvangOortje.item && (
                  <rect x={entityX - 2} y={OY - 4} rx={OR + 2} width={OW + 6} height={OH + 4} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2, strokeDasharray: "4,3" }} />
                )}
                <path d={oortjePad(entityX + 1, OY, OW, OH, OR)} style={{ fill: entFill, stroke: "#334155", strokeWidth: 1.2 }} />
                <text x={entityX + 1 + OW / 2} y={OY + OH - 10} textAnchor="middle" style={oortjeStyle}>{aanvangTekst}</text>
              </g>
            )}
            {eindeTekst && (
              <g className="actionable-svg-target" onClick={() => selecteerRep(eindeOortje.item, eindeOortje.group)} style={{ cursor: "pointer" }}>
                {geselecteerdeRep?.item === eindeOortje.item && (
                  <rect x={entityRight - OW - 4} y={OY - 4} rx={OR + 2} width={OW + 6} height={OH + 4} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2, strokeDasharray: "4,3" }} />
                )}
                <path d={oortjePad(entityRight - OW - 1, OY, OW, OH, OR)} style={{ fill: entFill, stroke: "#334155", strokeWidth: 1.2 }} />
                <text x={entityRight - OW - 1 + OW / 2} y={OY + OH - 10} textAnchor="middle" style={oortjeStyle}>{eindeTekst}</text>
              </g>
            )}
            {/* Entiteitskaart: getekend NA de oortjes — bedekt hun onderrand voor het kaartlip-effect. */}
            <g className="actionable-svg-target" onClick={openEntiteitActieBox} style={{ cursor: "pointer" }}>
              {entiteitActieOpen && <rect x={entityX - 3} y="37" rx="12" width={entityW + 6} height="86" style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
              <rect className="node" x={entityX} y="40" rx="10" width={entityW} height="80" style={{ fill: entFill, strokeWidth: 2.8 }} />
              <text
                className={`label label-lg${entOpvoerKlikbaar ? " opv-link" : ""}`}
                x={entityRight - 8} y="56" textAnchor="end"
                onClick={entOpvoerKlikbaar ? (event) => navigeerNaarRegistratieVanOpvoer(event, selectedA.opvoer) : undefined}
              >opv: {selectedA.opvoer ? microsecondeIntVanTijdstip(selectedA.opvoer) : "-"}</text>
              {entiteitWeergaveVeldTekst ? (
                <>
                  <text className="label" x="450" y="76" textAnchor="middle"
                    style={{ fontWeight: 700, fontSize: centraleWeergaveFontSize, fill: "#0f172a" }}>
                    {entiteitWeergaveVeldTekst}
                  </text>
                  <text className="label" x="450" y="98" textAnchor="middle"
                    style={{ fontSize: "11.5px", fill: "#64748b", letterSpacing: "0.3px" }}>
                    {entiteitType || "E"} · id {selectedA.id}
                  </text>
                </>
              ) : (
                <text className="label" x={entityX + 15} y="82">
                  <tspan style={centraleEntiteitLabelStyle}>{entiteitType || "E"}</tspan>
                  {" id="}
                  <tspan style={centraleEntiteitLabelStyle}>{selectedA.id}</tspan>
                </text>
              )}
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
        const relW = 194;
        const relX = centraleEntiteitRechts - relW;
        const relH = 58;
        const relFill = node.group?.kleur || "#fff7ed";
        const secondBoxW = 84;
        const secondBoxH = 24;
        const secondBoxX = relX + relW - secondBoxW - 8;
        const secondBoxY = node.y + 18;
        const isRelSelected = geselecteerdeRep?.item === node.item;
        const opvoerRegistratieID = registratieIDUitOpvoerTijdstip(node.item.opvoer);
        const opvoerKlikbaar = opvoerRegistratieID > 0;
        // Materiële-tijd mini-oortjes op hub-niveau RELs
        const relHubMeta = typeMetaByTypenaam?.[node.group?.doeltype];
        const isMaterieleRel = relHubMeta?.isMaterieel && relHubMeta?.ge_subtype === "hub";
        const relHubOortjes = isMaterieleRel ? bepaalHubOortjes(node.item) : null;
        const relAanvangTekst = relHubOortjes ? korteDatumWeergave(relHubOortjes.aanvangDatum) : null;
        const relEindeTekst = relHubOortjes ? korteDatumWeergave(relHubOortjes.eindeDatum) : null;
        const rOY = node.y - 42, rOW = 72, rOH = 20, rOR = 5;

        return (
          <g className="actionable-svg-target" key={node.key} onClick={() => selecteerRep(node.item, node.group)} style={{ cursor: "pointer" }}>
            {isRelSelected && <rect x={relX - 3} y={node.y - 27 - (relAanvangTekst || relEindeTekst ? 18 : 0)} rx="10" width={relW + 6} height={relH + 6 + (relAanvangTekst || relEindeTekst ? 18 : 0)} style={{ fill: "none", stroke: "#1d4ed8", strokeWidth: 2.5, strokeDasharray: "5,3" }} />}
            {/* Materiële-tijd mini-oortjes boven de REL-card */}
            {relAanvangTekst && (
              <g>
                <path d={oortjePad(relX, rOY, rOW, rOH, rOR)} style={{ fill: relFill, stroke: "#7c2d12", strokeWidth: 0.8 }} />
                <text x={relX + rOW / 2} y={rOY + rOH - 6} textAnchor="middle" style={{ ...oortjeStyle, fontSize: "9.5px" }}>{relAanvangTekst}</text>
              </g>
            )}
            {relEindeTekst && (
              <g>
                <path d={oortjePad(relX + relW - rOW, rOY, rOW, rOH, rOR)} style={{ fill: relFill, stroke: "#7c2d12", strokeWidth: 0.8 }} />
                <text x={relX + relW - rOW / 2} y={rOY + rOH - 6} textAnchor="middle" style={{ ...oortjeStyle, fontSize: "9.5px" }}>{relEindeTekst}</text>
              </g>
            )}
            <line x1="362" y1={node.y} x2={relX} y2={node.y} style={{ stroke: "#334155", strokeWidth: 2.8 }} />
            <rect x={relX} y={node.y - 24} rx="8" width={relW} height={relH} style={{ fill: relFill, stroke: "#7c2d12", strokeWidth: 2.8 }} />
            <text
              className={`label ${opvoerKlikbaar ? "opv-link" : ""}`}
              x={relX + relW - 8}
              y={node.y - 8}
              textAnchor="end"
              onClick={opvoerKlikbaar ? (event) => navigeerNaarRegistratieVanOpvoer(event, node.item.opvoer) : undefined}
            >
              opv: {node.item.opvoer ? microsecondeIntVanTijdstip(node.item.opvoer) : "-"}
            </text>
            <text className="label" x={relX + 10} y={node.y - 2}>
              <tspan style={{ fontWeight: 700, fontSize: "13px" }}>{labelVoorChildType(node.group.doeltype, node.group.rolnaam, node.group.typeMeta?.klassenaam)}</tspan>
              <tspan style={{ fontSize: "10.5px", fill: "#64748b" }}>{" "}rel_id={node.item.rel_id ?? node.item.id ?? "-"}</tspan>
            </text>
            {(() => {
              const relMeta2 = typeMetaByTypenaam?.[node.group?.doeltype];
              const wvTeksten = evalueerWeergaveVeldenVoorItem(relMeta2?.afgeleideVelden, node.item, relMeta2, typeMetaByTypenaam);
              if (wvTeksten.length > 0) {
                return (
                  <text className="label" x={relX + 10} y={node.y + 14}
                    style={{ fontWeight: 600, fontSize: "12px", fill: "#1e293b" }}>
                    {wvTeksten.join(" | ")}
                  </text>
                );
              }
              const relEntIDKol = String(node.group?.typeMeta?.entiteitIDKolom || '').toLowerCase();
              const relSecIDKol = String(node.group?.typeMeta?.secondaireEntiteitIDKolom || '').toLowerCase();
              const relExtraSkip = new Set([relEntIDKol, relSecIDKol].filter(Boolean));
              const relSamenvatting = korteSamenvatting(node.item, relExtraSkip);
              return relSamenvatting !== "-" ? (
                <text className="label" x={relX + 10} y={node.y + 14}
                  style={{ fontSize: "11.5px", fill: "#475569" }}>
                  {relSamenvatting}
                </text>
              ) : null;
            })()}
            {!!node.tweedeEntiteitLabel && (
              <g
                style={{ cursor: 'pointer' }}
                onClick={(e) => navigeerNaarSecondaireEntiteit(e, node.tweedeEntiteitType, node.tweedeEntiteitIDTekst)}
              >
                <rect x={secondBoxX} y={secondBoxY} rx="6" width={secondBoxW} height={secondBoxH} style={{ fill: node.tweedeEntiteitKleur || "#dbeafe", stroke: node.tweedeEntiteitRandkleur || "#1e3a8a", strokeWidth: 2 }} />
                <text className="label" x={secondBoxX + 6} y={secondBoxY + 16}>
                  <tspan style={nadrukStyle}>{node.tweedeEntiteitType || "Ent"}</tspan>
                  {" id="}
                  <tspan style={nadrukStyle}>{node.tweedeEntiteitIDTekst || "-"}</tspan>
                </text>
              </g>
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
