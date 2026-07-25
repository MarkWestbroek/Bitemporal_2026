/**
 * ToegangDiagram — read-only diagramweergave van een Toegangsbeleid (stap 2
 * van "2026-07-23 Toegangsregel-profiel (ontwerp)").
 *
 * Derde projectie van dezelfde AST — en sinds de vormentaal (ontwerp-antwoord
 * 2026-07-24) spreekt deze tab dezelfde taal als de motor-canvas: de weergave
 * rendert het adapter-profielmodel met de geregistreerde profiel-shapes
 * (kaft, regelkaart, badge, pijlblok, cilinder, poort, vergelijkingsstrook,
 * vaandel, tag). Eén vormenbron, twee plekken.
 *
 * v1 is tekst-first: hier alleen kijken; bewerken gebeurt in de Tekst-tab of
 * (na Publiceer naar Modelleren) op de motor-canvas.
 */
import React, { useMemo } from "react";
import { getShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { toegangsregelDiagramType } from "../../diagramprofielen/toegangsregel/index.js";
import { registreerToegangsregelShapes } from "../../diagramprofielen/toegangsregel/shapes.jsx";
import { beleidNaarDiagramModel } from "../../diagramprofielen/toegangsregel/adapter.js";

registreerToegangsregelShapes();

const ELEMENTTYPE = new Map(toegangsregelDiagramType.elementTypes.map((et) => [et.id, et]));

/** Breedte-schatting voor tekstdragende vormen (de canvas rekent zelf; hier schatten we). */
function breedte(tekst, { basis = 90, perTeken = 7.2, max = 560 } = {}) {
  return Math.min(max, Math.round(basis + String(tekst || "").length * perTeken));
}

/** Eén profiel-shape in een vaste maat (de shapes vullen hun container). */
function Vorm({ element, w, h, title }) {
  const elementType = ELEMENTTYPE.get(element.elementType);
  const Shape = getShape(elementType?.shape);
  if (!Shape) return <span title={title}>{element.naam}</span>;
  return (
    <div style={{ width: w, height: h, position: "relative", flexShrink: 0 }} title={title}>
      <Shape element={element} elementType={elementType} selected={false} />
    </div>
  );
}

function Pijl() {
  return <span className="trd-pijl">⟶</span>;
}

export default function ToegangDiagram({ beleid }) {
  const model = useMemo(() => beleidNaarDiagramModel(beleid), [beleid]);
  const elementen = useMemo(() => new Map(model.elementen.map((e) => [e.id, e])), [model]);
  const uit = (vanId, soort) =>
    model.connectoren.filter((c) => c.elementType === soort && c.van === vanId).map((c) => elementen.get(c.naar));

  const policy = model.elementen.find((e) => e.elementType === "policy");
  const begrippen = model.elementen.filter((e) => e.elementType === "begrip");
  const kaarten = model.elementen.filter((e) => e.elementType === "toegangsregel");

  const VoorwaardeBoom = ({ knoop }) => {
    if (!knoop) return null;
    if (knoop.elementType === "voorwaarde") {
      const d = knoop.data || {};
      const tekst = `${d.links || ""} ${d.vergelijking || ""} ${d.rechts || ""}`;
      return <Vorm element={knoop} w={breedte(tekst, { basis: 70 })} h={40} />;
    }
    return (
      <div className="trd-poort-blok">
        {/* De poort-shape hangt zijn soort-label onder de box; ruimte laten. */}
        <div style={{ marginBottom: 16 }}>
          <Vorm element={knoop} w={48} h={48} />
        </div>
        <div className="trd-takken">
          {uit(knoop.id, "tak").map((kind) => (
            <div key={kind.id} className="trd-tak">
              <VoorwaardeBoom knoop={kind} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const RegelBlok = ({ kaart }) => {
    const subject = uit(kaart.id, "wie")[0];
    const handeling = subject && uit(subject.id, "doet")[0];
    const gegevens = handeling && uit(handeling.id, "op")[0];
    const voorwaarden = uit(kaart.id, "als");
    const plichten = uit(kaart.id, "waarbij");
    const verwijzing = gegevens?.data?.verwijzingselement
      ? `${gegevens.data.verwijzingsprofiel} · ${gegevens.data.verwijzingselement}`
      : undefined;
    return (
      <section className="trd-kaart">
        <div className="trd-keten">
          <Vorm element={kaart} w={breedte(kaart.naam, { basis: 110 })} h={56} />
          {subject && (
            <>
              <Pijl />
              <Vorm element={subject} w={breedte(subject.naam, { basis: 70 })} h={48} />
            </>
          )}
          {handeling && (
            <>
              <Pijl />
              <Vorm element={handeling} w={breedte(handeling.naam, { basis: 66 })} h={44} />
            </>
          )}
          {gegevens && (
            <>
              <Pijl />
              <Vorm element={gegevens} w={breedte(gegevens.naam, { basis: 66 })} h={54} title={verwijzing} />
            </>
          )}
        </div>
        {voorwaarden.length > 0 && (
          <div className="trd-sectie">
            <span className="trd-sectie-label">als</span>
            <div>
              {voorwaarden.map((top) => (
                <VoorwaardeBoom key={top.id} knoop={top} />
              ))}
            </div>
          </div>
        )}
        {plichten.length > 0 && (
          <div className="trd-sectie">
            <span className="trd-sectie-label">waarbij</span>
            <div className="trd-plichten">
              {plichten.map((plicht) => (
                <Vorm key={plicht.id} element={plicht} w={breedte(plicht.naam, { basis: 70 })} h={44} title={plicht.data?.nlgov} />
              ))}
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="trd-root">
      {policy && <Vorm element={policy} w={breedte(policy.naam, { basis: 140 })} h={64} />}

      {begrippen.length > 0 && (
        <div className="trd-begrippen">
          {begrippen.map((begrip) => (
            <Vorm
              key={begrip.id}
              element={begrip}
              w={breedte(begrip.naam, { basis: 80 })}
              h={40}
              title={begrip.data?.definitie}
            />
          ))}
        </div>
      )}

      {kaarten.map((kaart) => (
        <RegelBlok key={kaart.id} kaart={kaart} />
      ))}

      <p className="trd-voetnoot">
        Read-only projectie met de vormentaal van het toegangsregel-profiel
        (zelfde vormen als de motor-canvas). Bewerken: in de Tekst-tab, of na
        “Publiceer naar Modelleren” sleepbaar op de canvas.
      </p>
    </div>
  );
}
