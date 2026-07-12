/**
 * ActivityBar — verticale iconenbalk links (VS Code-stijl).
 *
 * Leest uitsluitend uit het activityRegistry, dus volledig uitbreidbaar: een nieuwe
 * functie verschijnt automatisch zodra ze geregistreerd is. Gegroepeerd via
 * descriptor.groep (scheidingslijn tussen groepen); de "beheer"-groep staat
 * onderaan, gescheiden door een flexibele ruimte (zoals het tandwiel in VS Code).
 *
 * Wat de balk toont is configureerbaar (consolidatieplan fase 1, instellingen
 * in Studio-instellingen → Activiteiten); álles blijft bereikbaar via menu
 * Ga naar en het opdrachtenpalet. Niet in de balk:
 *  - status "concept" (nog te maken — een lege pagina hoort niet in de
 *    primaire navigatie) en verborgenInBalk: true (descriptor);
 *  - door de gebruiker verborgen activiteiten (balkVerborgen);
 *  - bij Labs uit: preview-activiteiten (tenzij favoriet).
 * Favorieten (gepind) staan bovenin, in pinvolgorde, en niet nóg eens in hun
 * eigen groep.
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

function ActiviteitKnop({ activiteit, actief, favoriet, onClick }) {
  const tooltip =
    activiteit.label +
    (activiteit.status ? ` (${activiteit.status})` : "") +
    (favoriet ? " — favoriet" : activiteit.groep ? ` — ${groepLabel(activiteit.groep)}` : "");
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
  const balkVerborgen = useStudioStore((s) => s.balkVerborgen);
  const labsAan = useStudioStore((s) => s.labsAan);
  const favorieten = useStudioStore((s) => s.favorieten);

  const favorietenSet = new Set(favorieten);
  const zichtbaar = activiteiten.filter(
    (a) =>
      a.status !== "concept" &&
      !a.verborgenInBalk &&
      !balkVerborgen[a.id] &&
      (labsAan || a.status !== "preview" || favorietenSet.has(a.id))
  );

  // Favorieten bovenin (pinvolgorde); de rest gegroepeerd, zonder dubbelingen.
  const byId = new Map(zichtbaar.map((a) => [a.id, a]));
  const favActiviteiten = favorieten.map((id) => byId.get(id)).filter(Boolean);
  const rest = zichtbaar.filter((a) => !favorietenSet.has(a.id));
  const groepen = groepeer(rest);
  const boven = groepen.filter((g) => g.groep !== "beheer");
  const onder = groepen.filter((g) => g.groep === "beheer");

  const knop = (a, favoriet = false) => (
    <ActiviteitKnop
      key={a.id}
      activiteit={a}
      actief={a.id === activeId}
      favoriet={favoriet}
      onClick={() => setActief(a.id)}
    />
  );

  const renderGroep = (g, i, eersteVanSectie) => (
    <React.Fragment key={`groep-${g.groep ?? i}`}>
      {!eersteVanSectie && <div className="studio-activitybar__sep" />}
      {g.activiteiten.map((a) => knop(a))}
    </React.Fragment>
  );

  return (
    <nav className="studio-activitybar" aria-label="Hoofdfuncties">
      {favActiviteiten.length > 0 && (
        <>
          {favActiviteiten.map((a) => knop(a, true))}
          <div className="studio-activitybar__sep studio-activitybar__sep--fav" />
        </>
      )}
      {boven.map((g, i) => renderGroep(g, i, i === 0 && favActiviteiten.length === 0))}
      {onder.length > 0 && <div className="studio-activitybar__spacer" />}
      {onder.map((g, i) => renderGroep(g, i, true))}
    </nav>
  );
}
