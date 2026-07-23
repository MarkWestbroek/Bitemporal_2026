/**
 * ToegangDiagram — read-only diagramweergave van een Toegangsbeleid (stap 2
 * van "2026-07-24 Toegangsregel-profiel (ontwerp)").
 *
 * Derde projectie van dezelfde AST: beleid = diagram, regel = kaart. De
 * kleuren komen uit het toegangsregel-profiel (= het ontleding-palet), de
 * teksthulpen uit de adapter — de weergave en het profielmodel delen dus één
 * bron. v1 is tekst-first: hier alleen kijken; bewerken gebeurt in de
 * Tekst-tab. Slepen/schalen komt met de integratie op de generieke motor.
 *
 * Toegankelijkheid: modaliteit wordt nooit alléén met kleur uitgedrukt — de
 * band draagt ook het label "mag" / "mag niet ⃠" (kleurenblind-veilig).
 */
import React from "react";
import { KLEUREN } from "../../diagramprofielen/toegangsregel/index.js";
import {
  wieTekst, watTekst, termTekst, operatorZin, KWANTOR_LABEL, watVerwijzing,
} from "../../diagramprofielen/toegangsregel/adapter.js";
import { isoNaarNlDatum } from "../../toegangsspraak/woorden.js";

function Chip({ kleur, children, title, gestippeld }) {
  return (
    <span className="trd-chip" title={title} style={{ background: kleur, borderStyle: gestippeld ? "dashed" : "solid" }}>
      {children}
    </span>
  );
}

function Pijl({ label }) {
  return <span className="trd-pijl">—{label}→</span>;
}

function TermChip({ term }) {
  if (!term) return null;
  const isVerwijzing = term.soort === "verwijzing";
  return <Chip kleur={isVerwijzing ? KLEUREN.gegevens : KLEUREN.waarde}>{termTekst(term)}</Chip>;
}

function VoorwaardeRij({ voorwaarde }) {
  return (
    <div className="trd-voorwaarde">
      <TermChip term={voorwaarde.links} />
      <Chip kleur={KLEUREN.operator}>{operatorZin(voorwaarde.operator)}</Chip>
      {voorwaarde.lijst ? (
        <Chip kleur={KLEUREN.waarde}>({voorwaarde.lijst.map(termTekst).join(", ")})</Chip>
      ) : voorwaarde.rechts2 ? (
        <>
          <TermChip term={voorwaarde.rechts} />
          <span className="trd-pijl">en</span>
          <TermChip term={voorwaarde.rechts2} />
        </>
      ) : (
        <TermChip term={voorwaarde.rechts} />
      )}
    </div>
  );
}

function VoorwaardeBoom({ knoop }) {
  if (knoop.soort === "voorwaarde") return <VoorwaardeRij voorwaarde={knoop} />;
  return (
    <div className="trd-poort-blok">
      <Chip kleur={KLEUREN.operator}>◇ {KWANTOR_LABEL[knoop.soort]}</Chip>
      <div className="trd-takken">
        {knoop.items.map((item, i) => (
          <div key={i} className="trd-tak">
            <VoorwaardeBoom knoop={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RegelKaart({ regel }) {
  const verbod = regel.verbod;
  const bandKleur = verbod ? KLEUREN.verbod : KLEUREN.toestemming;
  const verwijzing = watVerwijzing(regel.wat);
  return (
    <section className="trd-kaart" style={{ borderLeft: `6px solid ${bandKleur}` }}>
      <header className="trd-kaart-kop">
        <span className="trd-kaart-naam">Regel “{regel.naam}”</span>
        <span className="trd-modaliteit" style={{ color: bandKleur, borderColor: bandKleur }}>
          {verbod ? "mag niet ⃠" : "mag"}
        </span>
      </header>
      <div className="trd-keten">
        <Chip kleur={KLEUREN.subject}>{wieTekst(regel.wie)}</Chip>
        <Pijl label={verbod ? "mag niet" : "mag"} />
        <Chip kleur={KLEUREN.actie}>{regel.actie}</Chip>
        <Pijl label="op" />
        <Chip
          kleur={KLEUREN.gegevens}
          title={verwijzing ? `${verwijzing.verwijzingsprofiel} · ${verwijzing.verwijzingselement}` : undefined}
        >
          {watTekst(regel.wat)}
          {verwijzing && <span className="trd-verwijs-badge" title="cross-profiel verwijzing">▦</span>}
        </Chip>
      </div>
      {regel.voorwaarden && (
        <div className="trd-sectie">
          <span className="trd-sectie-label">als</span>
          <VoorwaardeBoom knoop={regel.voorwaarden} />
        </div>
      )}
      {regel.plichten.length > 0 && (
        <div className="trd-sectie">
          <span className="trd-sectie-label">waarbij</span>
          <div className="trd-plichten">
            {regel.plichten.map((plicht, i) => (
              <Chip key={i} kleur={KLEUREN.plicht} title={plicht.nlgov}>⚑ {plicht.zin}</Chip>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ToegangDiagram({ beleid }) {
  return (
    <div className="trd-root">
      <header className="trd-beleid-kop">
        <h2 className="trd-beleid-naam">Beleid “{beleid.naam}”</h2>
        <div className="trd-beleid-meta">
          {beleid.geldigVanaf && (
            <Chip kleur="#f1f5f9">
              Geldig vanaf {isoNaarNlDatum(beleid.geldigVanaf)}
              {beleid.geldigTot ? ` tot ${isoNaarNlDatum(beleid.geldigTot)}` : ""}
            </Chip>
          )}
          {beleid.grondslag && <Chip kleur="#f1f5f9" title="grondslag (→ ArchiMate Constraint)">§ {beleid.grondslag}</Chip>}
          {beleid.doel && <Chip kleur="#f1f5f9" title="doelbinding (→ ArchiMate Goal)">doel: “{beleid.doel}”</Chip>}
        </div>
      </header>

      {beleid.begrippen.length > 0 && (
        <div className="trd-begrippen">
          {beleid.begrippen.map((begrip, i) => (
            <Chip
              key={i}
              kleur={KLEUREN.begrip}
              gestippeld
              title={begrip.soort === "wie" ? "rolgroep-begrip" : "gegevens-begrip"}
            >
              <b>{begrip.naam}</b>
              {" = "}
              {begrip.soort === "wie"
                ? `iemand met ${begrip.kenmerken.map((k) => `${k.kenmerk} "${k.waarde}"`).join(" en ")}`
                : watTekst(begrip.wat)}
            </Chip>
          ))}
        </div>
      )}

      {beleid.regels.map((regel, i) => (
        <RegelKaart key={i} regel={regel} />
      ))}

      <p className="trd-voetnoot">
        Read-only projectie van dezelfde regels als de tekst (tekst-first, v1).
        Slepen, schalen en bewerken volgen met de integratie op de generieke
        diagram-motor.
      </p>
    </div>
  );
}
