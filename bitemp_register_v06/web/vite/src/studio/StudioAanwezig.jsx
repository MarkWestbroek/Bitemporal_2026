/**
 * StudioAanwezig — wie er nu in dit project zit (projectsync stap 2, onderdeel 7),
 * rechts in de menubalk naast de gebruiker. Komt uit het SSE-kanaal (event
 * `presence`); zonder verbonden kanaal of zonder anderen toont het niets.
 */
import React from "react";
import { useSyncStore, aanwezigSamengevat } from "./sync/verzender.js";

export default function StudioAanwezig() {
  const kanaal = useSyncStore((s) => s.kanaal);
  const aanwezig = useSyncStore((s) => s.aanwezig);
  if (kanaal !== "verbonden" || !aanwezig?.length) return null;
  const { personen, anderen } = aanwezigSamengevat();
  if (!anderen) return null;
  const titel = personen
    .map((p) => `${p.naam}${p.ik ? " (jij)" : ""}${p.tabs > 1 ? ` ×${p.tabs}` : ""}`)
    .join(", ");
  return (
    <span className="studio-menubar__aanwezig" title={`In dit project: ${titel}`}>
      <span className="studio-menubar__aanwezig-stip" aria-hidden="true" />
      {anderen === 1 ? "1 ander online" : `${anderen} anderen online`}
    </span>
  );
}
