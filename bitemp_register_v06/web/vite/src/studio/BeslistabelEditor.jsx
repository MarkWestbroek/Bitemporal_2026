/**
 * BeslistabelEditor — PropertyTypeEditor voor datatype "beslistabel" (profiel dmn-drd, Mark 16-11).
 *
 * De beslistabel van een beslissing leeft in het project: `data.beslistabel` op het element, in
 * de vorm van dmn/dmnModel.js. De export naar DMN-XML (dmnArtefact) en de simulatie lezen hem
 * daar al; hiermee is hij ook in de Studio te bewerken en loopt hij mee met sync, branches en
 * export. De klassieke DMN-activiteit (dmn-js + losse tabel) is daarvoor niet meer nodig.
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
import { tabelVoorBewerken, tabelSamenvatting } from "./beslistabelRegels.js";

function BeslistabelDialoog({ naam, waarde, onOpslaan, onSluit }) {
  const projectTypes = useProjectTypes();
  // De beginstand één keer bepalen: de inspector hertekent vaker, en "gewijzigd" vergelijkt op
  // identiteit met deze kopie.
  const [begin] = useState(() => tabelVoorBewerken(waarde, naam));
  const [tabel, setTabel] = useState(begin);
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
                : "Sleep een veld op een kolomkop, of klik eerst “bind…” in de tabel."}
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
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function BeslistabelEditor({ waarde, onChange, element }) {
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
          onSluit={() => setOpen(false)}
          onOpslaan={(tabel) => {
            onChange(tabel);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
