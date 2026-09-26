/**
 * buttonGroup.js — sortering van de knoppen van de vorm `button-group`. Puur (buttonGroup.test.js).
 *
 *  - "alpha": op label, hoofdletterongevoelig en met getallen op waarde ("OAS 2" vóór "OAS 10");
 *  - "order": op `order` (bv. het id = volgorde van registratie); items zonder order achteraan;
 *  - "none":  zoals aangeleverd.
 * Echt historisch sorteren (oudste standaard eerst) vraagt een datum of jaar in het model;
 * dat is dan gewoon een `order`.
 */
const vergelijker = new Intl.Collator("nl", { sensitivity: "base", numeric: true });

export function sorteerKnoppen(items, sortering = "alpha") {
  const lijst = [...(items || [])];
  if (sortering === "alpha") return lijst.sort((a, b) => vergelijker.compare(String(a.label ?? ""), String(b.label ?? "")));
  if (sortering === "order") {
    const o = (x) => (x.order === undefined || x.order === null || x.order === "" ? Infinity : Number(x.order));
    return lijst.sort((a, b) => o(a) - o(b));
  }
  return lijst;
}

/** Opties uit een enum (strings) of een referentielijst ({ id, label }) → knoppen. */
export function knoppenUitOpties(opties) {
  return (opties || []).filter((o) => o != null && o !== "").map((o) => (typeof o === "object"
    ? { value: String(o.id ?? o.value), label: o.label || String(o.id ?? o.value), order: o.order ?? (Number.isFinite(Number(o.id)) ? Number(o.id) : undefined) }
    : { value: String(o), label: String(o) }));
}
