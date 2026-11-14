// @ts-check
/**
 * weergave — wat het scherm van de simulatie tekent, afgeleid uit toestand en
 * log (ontwerp fase 2). Puur, zodat het los van React te toetsen is.
 *
 * Het token staat op het diagram zonder dat de motor ervan weet: het paneel
 * zet een stijlblok neer dat de canvas-nodes aanwijst op hun element-id
 * (`.react-flow__node[data-id=…]`). Een node met een token krijgt een rand en
 * een bolletje met het aantal tokens; waar het token geweest is blijft een
 * dunne rand staan.
 */

/** Hoe een token erbij staat, van meest naar minst dringend. */
const VOLGORDE = ["vast", "gat", "klaar", "wacht"];

/**
 * @param {any} toestand - de toestand van de simulatie (store.js)
 * @param {any[]} log
 * @returns {{plekken: Record<string, {aantal: number, status: string}>, bezocht: string[], flows: string[]}}
 */
export function tokenBeeld(toestand, log) {
  /** @type {Record<string, {aantal: number, status: string}>} */
  const plekken = {};
  for (const k of Object.values(toestand?.tokens || {})) {
    const status = k.status === "klaar" ? "klaar" : k.wachtOp?.soort === "gat" ? "gat" : k.wachtOp?.soort === "vast" ? "vast" : "wacht";
    const p = plekken[k.plek] || (plekken[k.plek] = { aantal: 0, status });
    p.aantal += 1;
    if (VOLGORDE.indexOf(status) < VOLGORDE.indexOf(p.status)) p.status = status;
  }
  const bezocht = new Set();
  const flows = new Set();
  for (const regel of log || []) {
    if (regel.plek) bezocht.add(regel.plek);
    for (const m of regel.wijzigingen || []) if (m.soort === "token" && m.via) flows.add(m.via);
  }
  return { plekken, bezocht: [...bezocht].filter((id) => !plekken[id]), flows: [...flows] };
}

/** De kleuren per status; cyaan en indigo uit de gradient van Omnium Studio. */
export const TOKEN_KLEUR = { klaar: "#6366f1", gat: "#f59e0b", wacht: "#22d3ee", vast: "#ef4444" };

const sel = (soort, id) => `.react-flow__${soort}[data-id=${JSON.stringify(String(id))}]`;

/**
 * Het stijlblok voor de canvas.
 * @param {ReturnType<typeof tokenBeeld>} beeld
 */
export function tokenCss(beeld) {
  const r = [
    "@keyframes sim-token-puls { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.25); } }",
  ];
  for (const id of beeld.bezocht) {
    r.push(`${sel("node", id)} { outline: 2px solid rgba(34, 211, 238, 0.55); outline-offset: 3px; border-radius: 8px; }`);
  }
  for (const id of beeld.flows) {
    r.push(`${sel("edge", id)} path.react-flow__edge-path { stroke: #22d3ee !important; stroke-width: 2.5px !important; }`);
  }
  for (const [id, p] of Object.entries(beeld.plekken)) {
    const kleur = TOKEN_KLEUR[p.status] || TOKEN_KLEUR.klaar;
    r.push(`${sel("node", id)} { outline: 3px solid ${kleur}; outline-offset: 4px; border-radius: 8px; z-index: 1000 !important; }`);
    r.push(
      `${sel("node", id)}::after { content: ${JSON.stringify(p.aantal > 1 ? String(p.aantal) : "")}; position: absolute; top: -14px; right: -14px; ` +
        `width: 20px; height: 20px; border-radius: 50%; background: ${kleur}; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); ` +
        `color: #fff; font: 700 11px/20px system-ui, sans-serif; text-align: center; pointer-events: none; ` +
        `${p.status === "klaar" ? "animation: sim-token-puls 1.2s ease-in-out infinite;" : ""} }`,
    );
  }
  return r.join("\n");
}

/** De stand van de run in gewone woorden. */
export function standTekst(stand) {
  switch (stand?.soort) {
    case "niet-gestart":
      return "Nog niet gestart.";
    case "loopt":
      return "Loopt: er kan een stap gezet worden.";
    case "gat":
      return `Wacht op invoer: ${stand.gaten.map((g) => g.naam).join(", ")}.`;
    case "uitkomst":
      return `Klaar. ${stand.eindes.map((e) => `${e.proces}: ${e.einde || "einde"}`).join("; ")}.`;
    case "uitzondering":
      return `Afgebroken bij ${stand.bij.join(", ")}.`;
    case "vastgelopen":
      return `Vastgelopen: ${stand.tokens.map((k) => `${k.naam} (${k.wachtOp?.reden || (k.wachtOp?.soort === "bericht" ? `wacht op bericht ${k.wachtOp.naam}` : k.wachtOp?.soort === "signaal" ? `wacht op signaal ${k.wachtOp.naam}` : k.wachtOp?.soort === "samenkomst" ? "de samenkomst wordt niet compleet" : "wacht")})`).join("; ")}.`;
    default:
      return "";
  }
}

/** Eén mutatie uit het log in gewone woorden. */
export function mutatieTekst(m) {
  const w = (x) => (typeof x === "string" ? x : JSON.stringify(x));
  switch (m.soort) {
    case "maak":
      return `maak ${m.type} ${m.id}`;
    case "zet":
      return `zet ${m.id}: ${Object.entries(m.velden).map(([k, v]) => `${k} = ${w(v)}`).join(", ")}`;
    case "overgang":
      return `overgang ${m.id}.${m.veld}: ${w(m.van)} → ${w(m.naar)}`;
    case "verbind":
      return `verbind ${m.van} – ${m.naar}${m.rol ? ` (${m.rol})` : ""}`;
    case "ontbind":
      return `ontbind ${m.van} – ${m.naar}`;
    case "extern":
      return `buiten het cm: ${m.actie}${m.doel ? ` ${m.doel}` : ""} → ${m.verwijzing}`;
    case "variabele":
      return `variabele ${m.naam} = ${w(m.waarde)}`;
    case "gat":
      return m.open ? `gat open: ${m.naam}` : m.vervallen ? "gat vervallen" : `gat gevuld (${m.wijze}): ${w(m.waarde)}`;
    case "bericht":
      return m.weg ? `bericht ${m.naam} opgehaald` : `bericht ${m.naam} wacht op een ontvanger`;
    default:
      return null; // token: staat op het diagram
  }
}
