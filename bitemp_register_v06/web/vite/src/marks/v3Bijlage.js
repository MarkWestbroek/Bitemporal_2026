// @ts-check
/**
 * v3Bijlage — de marks als bijlage bij een V3-export (plan 2026-11-18 Marks, stap 5; besluit
 * Mark 18-11: naast het model, niet op het element).
 *
 *   { "model": { … }, "marks": { "context": [laag-id, …], "marks": [{doel, soort, waarde}, …] } }
 *
 * Alleen wat geldt in de context, en alleen marks waarvan het doel met zijn uuid in dit V3-model
 * staat (een mark op een BPMN-taak hoort hier niet). Zonder zulke marks blijft het bestand zoals
 * het was: geen sleutel `marks`. De codegen zoekt per mark het veld of element op de uuid.
 *
 * Puur.
 */
import { marksBijlage, contextLagen } from "./marks.js";

/** Alle uuid's in een V3-model (elk `uuid`-veld, op elke diepte). */
export function uuidsIn(v3) {
  const uit = new Set();
  const loop = (x) => {
    if (Array.isArray(x)) return x.forEach(loop);
    if (!x || typeof x !== "object") return;
    if (typeof x.uuid === "string" && x.uuid) uit.add(x.uuid);
    for (const v of Object.values(x)) loop(v);
  };
  loop(v3);
  return uit;
}

/**
 * @param {any} v3 - het V3-bestand (`{model: …}`)
 * @param {any} st - de marks van het project (`{lagen, contexten, marks}`)
 * @param {string | string[] | {lagen: string[]} | null} [context] - welke lagen, in volgorde;
 *   zonder (of leeg): alle lagen van het project in hun volgorde
 * @returns {any} het V3-bestand, met `marks` erbij als er iets geldt
 */
export function metMarksBijlage(v3, st, context = null) {
  if (!st?.marks?.length) return v3;
  const gekozen = context ? contextLagen(st, context) : [];
  const lagen = gekozen.length ? gekozen : st.lagen.map((l) => l.id);
  const uuids = uuidsIn(v3?.model ?? v3);
  const bijlage = marksBijlage(st, lagen, { bestaat: (doel) => !!doel?.uuid && uuids.has(doel.uuid) });
  return bijlage.marks.length ? { ...v3, marks: bijlage } : v3;
}
