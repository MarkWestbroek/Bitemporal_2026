/**
 * ActivityBar — verticale iconenbalk links (VS Code-stijl).
 *
 * Leest uitsluitend uit het activityRegistry, dus volledig uitbreidbaar: een nieuwe
 * functie verschijnt automatisch zodra ze geregistreerd is. Gegroepeerd via
 * descriptor.groep (scheidingslijn tussen groepen); de "beheer"-groep staat
 * onderaan, gescheiden door een flexibele ruimte (zoals het tandwiel in VS Code).
 *
 * Niet in de balk (wel in menu Ga naar): activiteiten met status "concept"
 * (nog te maken — een lege pagina hoort niet in de primaire navigatie) en
 * activiteiten met verborgenInBalk: true.
 */
import React from "react";
import useStudioStore from "./useStudioStore";
import { groepLabel } from "./activityRegistry";

/** Groepeer met behoud van volgorde: [{ groep, activiteiten: [...] }]. */
function groepeer(activiteiten) {
  const groepen = [];
  for (const a of activiteiten) {
    const laatste = groepen[groepen.length - 1];
    if (laatste && laatste.groep === a.groep) laatste.activiteiten.push(a);
    else groepen.push({ groep: a.groep, activiteiten: [a] });
  }
  return groepen;
}

function ActiviteitKnop({ activiteit, actief, onClick }) {
  const tooltip =
    activiteit.label +
    (activiteit.status ? ` (${activiteit.status})` : "") +
    (activiteit.groep ? ` — ${groepLabel(activiteit.groep)}` : "");
  return (
    <button
      type="button"
      className={"studio-activitybar__btn" + (actief ? " is-actief" : "")}
      title={tooltip}
      aria-pressed={actief}
      onClick={onClick}
    >
      <span className="studio-activitybar__icon">{activiteit.icon}</span>
      {activiteit.status && (
        <span
          className={`studio-activitybar__badge studio-activitybar__badge--${activiteit.status}`}
          aria-hidden
        />
      )}
    </button>
  );
}

export default function ActivityBar({ activiteiten }) {
  const activeId = useStudioStore((s) => s.activeId);
  const setActief = useStudioStore((s) => s.setActief);

  const zichtbaar = activiteiten.filter(
    (a) => a.status !== "concept" && !a.verborgenInBalk
  );
  const groepen = groepeer(zichtbaar);
  const boven = groepen.filter((g) => g.groep !== "beheer");
  const onder = groepen.filter((g) => g.groep === "beheer");

  const renderGroep = (g, i, eersteVanSectie) => (
    <React.Fragment key={`groep-${g.groep ?? i}`}>
      {!eersteVanSectie && <div className="studio-activitybar__sep" />}
      {g.activiteiten.map((a) => (
        <ActiviteitKnop
          key={a.id}
          activiteit={a}
          actief={a.id === activeId}
          onClick={() => setActief(a.id)}
        />
      ))}
    </React.Fragment>
  );

  return (
    <nav className="studio-activitybar" aria-label="Hoofdfuncties">
      {boven.map((g, i) => renderGroep(g, i, i === 0))}
      {onder.length > 0 && <div className="studio-activitybar__spacer" />}
      {onder.map((g, i) => renderGroep(g, i, true))}
    </nav>
  );
}
