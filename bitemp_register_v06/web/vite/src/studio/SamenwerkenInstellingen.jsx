/**
 * SamenwerkenInstellingen — voorkeuren voor de projectsync (plan 2026-10-07):
 * het poll-interval van de terugval als het SSE-kanaal er niet is. De
 * standaard komt van de instantie (admin, env STUDIO_SYNC_POLL_MS); hier
 * kies je per browser een afwijking (localStorage "studio-sync-poll-ms").
 */
import React, { useEffect, useState } from "react";
import { haalStudioInstellingenOp } from "./activities/projectSync.js";
import { POLL_INTERVAL, pollIntervalMs, herstartPoll, useSyncStore } from "./sync/verzender.js";

const LS = "studio-sync-poll-ms";
const KEUZES = [1000, 2000, 5000, 15000, 30000];

const rij = { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13, flexWrap: "wrap" };
const label = { width: 110, color: "var(--s-fg-muted, #64748b)", flex: "0 0 auto" };
const knop = (actief) => ({
  font: "inherit",
  fontSize: 12,
  padding: "3px 10px",
  borderRadius: 6,
  border: `1px solid ${actief ? "var(--s-accent, #4f46e5)" : "var(--s-border, #cbd5e1)"}`,
  background: actief ? "var(--s-hover)" : "transparent",
  color: "var(--s-fg)",
  fontWeight: actief ? 600 : 400,
  cursor: "pointer",
});

function leesOverride() {
  try {
    const n = Number(localStorage.getItem(LS));
    return n >= 500 ? n : null;
  } catch {
    return null;
  }
}

export default function SamenwerkenInstellingen() {
  const [override, setOverride] = useState(leesOverride());
  const [serverMs, setServerMs] = useState(null);
  const kanaal = useSyncStore((s) => s.kanaal);
  const stand = useSyncStore((s) => s.stand);
  useEffect(() => {
    haalStudioInstellingenOp()
      .then((inst) => setServerMs(inst?.poll_ms || POLL_INTERVAL))
      .catch(() => setServerMs(null));
  }, []);

  const kies = (ms) => {
    try {
      if (ms == null) localStorage.removeItem(LS);
      else localStorage.setItem(LS, String(ms));
    } catch {
      /* geen opslag */
    }
    setOverride(ms);
    herstartPoll();
  };
  const sec = (ms) => (ms % 1000 ? `${ms / 1000} s` : `${ms / 1000} s`);

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={rij}>
        <span style={label}>Poll-interval</span>
        <button type="button" style={knop(override == null)} onClick={() => kies(null)} title="Standaard van deze instantie (admin: STUDIO_SYNC_POLL_MS)">
          Standaard{serverMs ? ` (${sec(serverMs)})` : ""}
        </button>
        {KEUZES.map((ms) => (
          <button key={ms} type="button" style={knop(override === ms)} onClick={() => kies(ms)}>
            {sec(ms)}
          </button>
        ))}
      </div>
      <p style={{ margin: "4px 0 0", color: "var(--s-fg-muted, #64748b)", fontSize: 12 }}>
        Hoe vaak deze browser de server vraagt om wijzigingen van anderen als het live-kanaal (SSE) er
        niet is. Met een verbonden kanaal komen wijzigingen direct binnen en is dit alleen de terugval.
        Nu effectief: {sec(pollIntervalMs())}
        {stand === "uit" ? " · sync staat uit (project niet op de server of live-sync uit)" : kanaal === "verbonden" ? " · live-kanaal verbonden" : " · poll actief"}.
        Instantiebreed zet een beheerder dit met <code>STUDIO_SYNC_POLL_MS</code>.
      </p>
    </div>
  );
}
