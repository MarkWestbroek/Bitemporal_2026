import { SvgPatternDefs } from "../../shared/SvgPatternDefs";

function splitLabelOverMeerdereRegels(label, maxRegelLengte = 12, maxRegels = 2) {
  const tekst = String(label || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
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
  isCorrectie,
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
  const heeftTerugVerwijslijnen = Boolean(isOngedaanmaking || isCorrectie);
  const wijzigingstypes = wijzigingen.map((w) => String(w?.wijzigingstype || "").toLowerCase());
  const alleenAfvoer = wijzigingstypes.length > 0 && wijzigingstypes.every((t) => t === "afvoer");
  const alleenOpvoer = wijzigingstypes.length > 0 && wijzigingstypes.every((t) => t === "opvoer");
  const kruisKleur = alleenAfvoer ? "#16a34a" : (alleenOpvoer ? "#dc2626" : "#64748b");

  const basisRepNaam = (value) => String(value || "").trim().toUpperCase().replace(/_(DATA|AANVANG|EINDE)$/i, "");
  const heeftPlumbingSuffix = (value) => /_(DATA|AANVANG|EINDE)$/i.test(String(value || "").trim());

  const relatieBoogjes = [];
  for (let i = 0; i < wijzigingen.length; i += 1) {
    const wi = wijzigingen[i] || {};
    const wiType = String(wi.wijzigingstype || "").toLowerCase();
    const wiNaam = String(wi.representatienaam || "").trim();
    const wiRepId = String(wi.representatie_id ?? "").trim();
    const wiEntId = String(wi.entiteit_id ?? "").trim();

    for (let j = i + 1; j < wijzigingen.length; j += 1) {
      const wj = wijzigingen[j] || {};
      const wjType = String(wj.wijzigingstype || "").toLowerCase();
      const wjNaam = String(wj.representatienaam || "").trim();
      const wjRepId = String(wj.representatie_id ?? "").trim();
      const wjEntId = String(wj.entiteit_id ?? "").trim();

      const zelfdeEntiteit = wiEntId !== "" && wiEntId === wjEntId;
      const zelfdeRepId = wiRepId !== "" && wiRepId === wjRepId;
      const zelfdeBasis = basisRepNaam(wiNaam) !== "" && basisRepNaam(wiNaam) === basisRepNaam(wjNaam);

      const isCorrectieBoog = isCorrectie && wiType === "afvoer" && wjType === "opvoer" && zelfdeEntiteit && (zelfdeRepId || zelfdeBasis);
      const isHubDataBoog = isOngedaanmaking && wiType === wjType && zelfdeEntiteit && zelfdeRepId && zelfdeBasis
        && ((heeftPlumbingSuffix(wiNaam) && !heeftPlumbingSuffix(wjNaam)) || (!heeftPlumbingSuffix(wiNaam) && heeftPlumbingSuffix(wjNaam)));

      if (!isCorrectieBoog && !isHubDataBoog) {
        continue;
      }

      const y1 = 64 + i * rijHoogte + 30;
      const y2 = 64 + j * rijHoogte + 30;
      relatieBoogjes.push({
        key: `boog-${i}-${j}`,
        x: 58,
        y1,
        y2,
        kleur: isCorrectieBoog
          ? "rgba(22, 163, 74, 0.72)"
          : (wiType === "afvoer" ? "rgba(22, 163, 74, 0.62)" : "rgba(220, 38, 38, 0.48)"),
      });
      break;
    }
  }

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

        {relatieBoogjes.map((boog) => (
          <path
            key={boog.key}
            d={`M ${boog.x} ${boog.y1} C ${boog.x - 16} ${boog.y1 + 10}, ${boog.x - 16} ${boog.y2 - 10}, ${boog.x} ${boog.y2}`}
            fill="none"
            stroke={boog.kleur}
            strokeWidth="2"
          />
        ))}

        {wijzigingen.map((w, i) => {
          const y = 64 + i * rijHoogte;
          const repLeeg = (w.representatienaam === null || w.representatienaam === undefined || w.representatienaam === "")
            && (w.representatie_id === null || w.representatie_id === undefined || w.representatie_id === "");
          const entiteitRegels = splitLabelOverMeerdereRegels(`${labelVoorTypeNaam(w.entiteitnaam, entityType || "E")}: ${w.entiteit_id ?? "-"}`, 13, 2);
          const repIdStr = w.versie != null ? `${w.representatie_id ?? "-"} v${w.versie}` : `${w.representatie_id ?? "-"}`;
          const repRegels = splitLabelOverMeerdereRegels(`${labelVoorTypeNaam(w.representatienaam, w.representatienaam)}: ${repIdStr}`, 13, 3);
          return (
            <g key={`w-${w.id || i}`}>
              <line className="edge" x1="160" y1="52" x2="160" y2={y - 2} />
              <rect className="node" x="14" y={y} rx="8" width="292" height="56" style={{ fill: `url(#${wijzigingPatroonId(w.wijzigingstype)})` }} />
              <line x1={eersteDividerX} y1={y} x2={eersteDividerX} y2={y + 56} stroke="var(--border-strong)" strokeWidth="1" />
              <line x1={tweedeDividerX} y1={y} x2={tweedeDividerX} y2={y + 56} stroke="var(--border-strong)" strokeWidth="1" />
              <text id={heeftTerugVerwijslijnen ? `undo-src-${normaliseerIdComponent(reg.id)}-${i}` : undefined} className="label" x="54" y={y + 33} textAnchor="middle"
                style={{ fontSize: "10px", fill: "#64748b", textTransform: "uppercase", letterSpacing: "0.9px", fontWeight: 600 }}>
                {w.wijzigingstype || "-"}
              </text>
              <text className="label" x="100" y={y + 18}>
                {entiteitRegels.map((regel, regelIndex) => (
                  <tspan key={`ent-${regelIndex}`} x="100" dy={regelIndex === 0 ? 0 : 12} style={{ fontWeight: 700, fontSize: "11px" }}>{regel}</tspan>
                ))}
              </text>
              {!repLeeg && (
                <text className="label" x="194" y={y + 16}>
                  {repRegels.map((regel, regelIndex) => (
                    <tspan key={`rep-${regelIndex}`} x="194" dy={regelIndex === 0 ? 0 : 12} style={{ fontWeight: 700, fontSize: "11px" }}>{regel}</tspan>
                  ))}
                </text>
              )}
            </g>
          );
        })}

        {isOngedaanmaking && (
          <>
            <line x1="14" y1="8" x2="306" y2={regViewBoxHeight - 6} stroke={kruisKleur} strokeWidth="3.2" strokeLinecap="round" />
            <line x1="306" y1="8" x2="14" y2={regViewBoxHeight - 6} stroke={kruisKleur} strokeWidth="3.2" strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}
