/**
 * projectZicht — de activiteiten **Profielen** en **Transformaties** als zicht op één project (plan
 * "Sidecar-project" §9, stap 9 deel 2; Mark 22-11).
 *
 * Mark: "In plaats van die twee [de JSON-editor en het Profiel-ontwerp] en de transformaties-
 * activiteit zou één profielen- en transformatieproject moeten staan. Het zijn functioneel wel
 * andere dingen, dus de scheiding kan blijven bestaan. De profielen-activiteit filtert dan de
 * M2-mappen met diagram(men) en elementen. De transformaties-activiteit filtert de t's."
 *
 * Beide zijn dus de Modelleren-host (zelfde tabs, canvas, eigenschappen en menu's) met een
 * gefilterde projectboom (boomZicht.js): Profielen toont alleen de taal Profiel (M3), Transformaties
 * alleen de taal Transformatie. Er is geen eigen opslag: het project is het project dat in
 * Modelleren open is. Is dat niet het profielen- en transformatieproject, dan zegt de kop dat, met
 * een knop om het te openen (als eigen project, nooit in het open project; Mark 22-11).
 */
import React from "react";
import modelleren, { useModellerenStore } from "./modellerenActivity.jsx";
import { IconProfielOntwerp05, IconTransformatie } from "../icons";
import { M3_PROFIEL_ID } from "./m3Profiel.js";
import { TRANSFORMATIE_ACTIVITEIT_ID } from "../sidecarProject.js";
import { soortVan, SOORT_PROFIELEN } from "../projectGebruik.js";
import { getProfieltype } from "../profieltypeRegistry.js";
import useStudioStore from "../useStudioStore";
import { laadProfielenVanDeTool, laadInDeTool } from "./m3ProfielActivity.jsx";

const gedempt = { color: "var(--s-fg-muted, #64748b)" };
const knop = {
  font: "inherit", fontSize: 12, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
  border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-bg, transparent)", color: "inherit",
};

const m3Store = () => getProfieltype(M3_PROFIEL_ID)?.useStore;

/** De kop boven de gefilterde boom: welk project, en de acties van dit zicht. */
function ZichtKop({ id, titel, acties }) {
  const project = useModellerenStore((s) => s.project);
  const isProfielenProject = soortVan(project) === SOORT_PROFIELEN;
  return (
    <div data-testid={`zicht-${id}`} style={{ padding: "6px 8px", borderBottom: "1px solid var(--s-border, #e2e8f0)", fontSize: 12 }}>
      <div style={gedempt}>
        {titel} in <strong style={{ color: "inherit" }}>{project?.naam || "(geen project)"}</strong>
        {project?.versie ? ` · ${project.versie}` : ""}
      </div>
      {!isProfielenProject && (
        <div data-testid="zicht-geen-profielenproject" style={{ marginTop: 4 }}>
          Dit is geen profielen- en transformatieproject; de boom toont alleen wat er hier van {titel.toLowerCase()} in staat.{" "}
          <button type="button" style={knop} onClick={() => laadProfielenVanDeTool(m3Store())}>
            Open het profielen- en transformatieproject
          </button>
        </div>
      )}
      {isProfielenProject && acties?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {acties.map((a) => (
            <button key={a.label} type="button" style={knop} title={a.uitleg} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Een zicht: de Modelleren-host met een boom die alleen `talen` toont.
 * @param {{id: string, label: string, icon: any, talen: string[], titel: string, acties?: {label: string, uitleg?: string, run: () => void}[]}} opties
 */
export function maakProjectZicht({ id, label, icon, talen, titel, acties = [] }) {
  const ModSidebar = modelleren.Sidebar;
  function Sidebar() {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <ZichtKop id={id} titel={titel} acties={acties} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <ModSidebar talen={talen} />
        </div>
      </div>
    );
  }
  return {
    ...modelleren,
    id,
    label,
    icon,
    groep: "beheer",
    Sidebar,
    sidebarLabel: label,
  };
}

export const profielenZicht = maakProjectZicht({
  id: "profielenZicht",
  label: "Profielen",
  icon: <IconProfielOntwerp05 />,
  talen: [M3_PROFIEL_ID],
  titel: "Profielen",
  acties: [
    {
      label: "Laad in de tool",
      uitleg: "De profielen uit dit project in de tool laden (tot een herlaad), om ze uit te proberen",
      run: () => laadInDeTool(m3Store()),
    },
  ],
});

export const transformatiesZicht = maakProjectZicht({
  id: "transformatiesZicht",
  label: "Transformaties",
  icon: <IconTransformatie />,
  talen: [TRANSFORMATIE_ACTIVITEIT_ID],
  titel: "Transformaties",
  acties: [
    {
      label: "Proefdraaien…",
      uitleg: "De regelsets van de tool lezen en proefdraaien tegen een proefbron",
      run: () => useStudioStore.getState().setActief("transformaties"),
    },
  ],
});
