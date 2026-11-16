/**
 * BeslistabelEditor — PropertyTypeEditor voor datatype "beslistabel" (profiel dmn-drd, Mark 16-11).
 *
 * De beslistabel van een beslissing leeft in het project: `data.beslistabel` op het element, in
 * de vorm van dmn/dmnModel.js. De export naar DMN-XML (dmnArtefact) en de simulatie lezen hem
 * daar al; hiermee is hij ook in de Studio te bewerken en loopt hij mee met sync, branches en
 * export. De klassieke DMN-activiteit (dmn-js + losse tabel) is daarvoor niet meer nodig.
 *
 * De invoerkolommen volgen uit het DRD (16-11, diagramprofielen/dmn-drd/invoerUitDrd.js): elke
 * pijl naar de beslissing is een kolom, en het veld staat op het invoergegeven. In de dialoog
 * vul je regels en uitvoer in.
 *
 * In de inspector: een samenvatting en een knop. De knop opent een dialoog met links het
 * canonieke model van het project (ModelPicker) en rechts de tabel (DmnTableEditor, dezelfde als
 * in de klassieke activiteit). Bewerken gebeurt op een kopie; pas "Opslaan" schrijft de tabel
 * naar het element — één wijziging in het project, niet één per toetsaanslag.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ModelPicker } from "../modelpicker";
import DmnTableEditor from "../dmn/DmnTableEditor";
import { bindInput, bindOutput } from "../dmn/dmnModel";
import { useProjectTypes } from "./fieldRefBinding.js";
import { apiBase } from "./studioUtils";
import { vraagBevestiging } from "./naamDialog.jsx";
import { tabelVoorBewerken, tabelSamenvatting } from "./beslistabelRegels.js";
import { fieldRefsOpUuid } from "../modelpicker/modelTree.js";
import { resolveerVeldRef } from "./elementVerwijzing.jsx";
import { bronnenVan, metInvoerUitDrd, zonderKolom, invoerMeldingen } from "../diagramprofielen/dmn-drd/invoerUitDrd.js";

/** Veldverwijzing van een invoergegeven → FieldRef van het canonieke model (via de uuid), of null. */
function losVeldOpMet(types) {
  const index = types ? fieldRefsOpUuid(types) : new Map();
  return (gegeven) => {
    const uuid = resolveerVeldRef(gegeven)?.veld?.uuid || gegeven?.uuid;
    return (uuid && index.get(uuid)) || null;
  };
}

function BeslistabelDialoog({ naam, waarde, bronnen, onOpslaan, onWis, onSluit }) {
  const projectTypes = useProjectTypes();
  // De beginstand één keer bepalen: de inspector hertekent vaker, en "gewijzigd" vergelijkt op
  // identiteit met deze kopie. De invoerkolommen komen uit het diagram (invoerUitDrd.js); wijkt
  // dat af van wat er stond, dan is de tabel meteen "gewijzigd" en kun je hem zo opslaan.
  const [begin] = useState(() => tabelVoorBewerken(waarde, naam, { leeg: true }));
  const [tabel, setTabel] = useState(() => metInvoerUitDrd(begin, bronnen, losVeldOpMet(projectTypes)));
  const [bindDoel, setBindDoel] = useState(null);
  const gewijzigd = tabel !== begin;

  // Escape sluit alleen zolang er niets gewijzigd is; daarna kies je zelf Opslaan of Annuleren.
  useEffect(() => {
    const opToets = (e) => {
      if (e.key !== "Escape") return;
      if (bindDoel) setBindDoel(null);
      else if (!gewijzigd) onSluit();
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [bindDoel, gewijzigd, onSluit]);

  const onPick = useCallback(
    (ref) => {
      if (!bindDoel) return;
      setTabel((t) => (bindDoel.kant === "input" ? bindInput(t, bindDoel.clauseId, ref) : bindOutput(t, bindDoel.clauseId, ref)));
      setBindDoel(null);
    },
    [bindDoel]
  );

  return createPortal(
    <div className="studio-beslistabel__achtergrond" role="dialog" aria-modal="true" data-testid="beslistabel-dialoog">
      <div className="studio-beslistabel">
        <div className="studio-beslistabel__kop">
          <strong>Beslistabel — {naam || "beslissing"}</strong>
          <span style={{ flex: 1 }} />
          {/* Wissen (Mark 16-11): een oude tabel helemaal weg, om opnieuw te beginnen. De invoer
              komt daarna weer uit het diagram; weghalen van één invoerkolom kan niet, die volgt de pijl. */}
          {waarde && (
            <button
              type="button"
              className="dc-mini-knop is-gevaar"
              data-testid="beslistabel-wissen"
              title="De hele beslistabel van deze beslissing weghalen"
              onClick={async () => {
                const ja = await vraagBevestiging({
                  titel: "Beslistabel wissen",
                  tekst: `De beslistabel van "${naam || "deze beslissing"}" met alle regels weghalen? Met Maken… begin je daarna opnieuw; de invoer komt dan weer uit het diagram. Ongedaan maken kan met Ctrl+Z.`,
                  bevestig: "Wissen",
                  gevaar: true,
                });
                if (ja) onWis();
              }}
            >
              Tabel wissen…
            </button>
          )}
          <button type="button" className="dc-mini-knop" onClick={onSluit}>
            Annuleren
          </button>
          <button
            type="button"
            className="dc-mini-knop"
            data-testid="beslistabel-opslaan"
            disabled={!gewijzigd}
            onClick={() => onOpslaan(tabel)}
          >
            Opslaan
          </button>
        </div>
        <div className="studio-beslistabel__inhoud">
          <div className="studio-beslistabel__model">
            <p className="studio-beslistabel__hint" style={bindDoel ? { color: "#3b82f6" } : undefined}>
              {bindDoel
                ? `Kies een veld voor de ${bindDoel.kant === "input" ? "invoer" : "uitvoer"}kolom (Esc = stoppen).`
                : "Voor de uitvoer: sleep een veld op een kolomkop, of klik eerst “bind…” in de tabel."}
            </p>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ModelPicker injectedTypes={projectTypes} baseUrl={apiBase()} onPick={onPick} expandEntiteiten />
            </div>
          </div>
          {/* Lichte "papier"-ondergrond: de tabelstijl (dmntable.css) kent geen donker thema. */}
          <div className="studio-beslistabel__tabel studio-paper">
            <DmnTableEditor
              table={tabel}
              onChange={setTabel}
              onRequestBind={(clauseId, kant) => setBindDoel({ clauseId, kant })}
              toonNaam={false}
              invoerUitDiagram
              onVerwijderKolom={(kolomId, kant) => setTabel((t) => zonderKolom(t, kolomId, kant))}
              extraMeldingen={invoerMeldingen(tabel)}
            />
          </div>
        </div>
      </div>
    </div>,
    // In de Studio-shell, niet in body: daar hangt ook de bevestigingsdialoog (NaamDialogHost,
    // z-index 10001), zodat "Tabel wissen…" er bovenop komt; en het thema van de shell geldt.
    document.querySelector(".studio") || document.body
  );
}

export default function BeslistabelEditor({ waarde, onChange, element, context }) {
  const [open, setOpen] = useState(false);
  const heeft = !!waarde && typeof waarde === "object";
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, opacity: heeft ? 1 : 0.7 }} data-testid="beslistabel-samenvatting">
        {tabelSamenvatting(waarde)}
      </span>
      <button type="button" className="dc-mini-knop" data-testid="beslistabel-bewerken" title="Beslistabel bewerken" onClick={() => setOpen(true)}>
        {heeft ? "✎ Bewerken…" : "＋ Maken…"}
      </button>
      {open && (
        <BeslistabelDialoog
          naam={element?.naam}
          waarde={waarde}
          bronnen={bronnenVan(context?.elements || {}, element?.id)}
          onSluit={() => setOpen(false)}
          onOpslaan={(tabel) => {
            onChange(tabel);
            setOpen(false);
          }}
          onWis={() => {
            onChange(undefined);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
