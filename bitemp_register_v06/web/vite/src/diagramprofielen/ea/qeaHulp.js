// @ts-check
/**
 * qeaHulp — pure parsers voor de tekstvelden in een Sparx EA-repository
 * (`.qea`/`.qeax` = SQLite; dezelfde kolommen als Postgres/MySQL/Jet).
 *
 * EA slaat veel structuur op als string-met-scheidingstekens; deze module
 * vertaalt die naar gewone JS-waarden. Geen sql.js, geen DOM: in node te
 * testen. Zie docs/plans/2026-10-07 Sparx EA-sync … §5 en §6.9.
 */

/**
 * Stereotypen uit `t_xref` (`Name='Stereotypes'`):
 * `@STEREO;Name=Objecttype;FQName=MIM::Objecttype;@ENDSTEREO;@STEREO;…`
 * Geeft de volledige namen (FQName, anders Name), in volgorde.
 * @param {string|null|undefined} description
 * @returns {string[]}
 */
export function stereotypenUitXref(description) {
  const uit = [];
  for (const blok of String(description || "").matchAll(/@STEREO;(.*?)@ENDSTEREO;/gs)) {
    const kv = sleutelWaarden(blok[1]);
    const naam = kv.FQName || kv.Name;
    if (naam) uit.push(naam);
  }
  return uit;
}

/**
 * CustomProperties uit `t_xref` (`Name='CustomProperties'`):
 * `@PROP=@NAME=kind@ENDNAME;@TYPE=ActionKind@ENDTYPE;@VALU=CallBehavior@ENDVALU;@PRMT=@ENDPRMT;@ENDPROP;`
 * @param {string|null|undefined} description
 * @returns {Record<string, string>} bv. `{ kind: "CallBehavior", isStream: "0" }`
 */
export function customPropertiesUitXref(description) {
  /** @type {Record<string, string>} */
  const uit = {};
  for (const m of String(description || "").matchAll(/@NAME=(.*?)@ENDNAME;.*?@VALU=(.*?)@ENDVALU;/gs)) {
    uit[m[1]] = m[2];
  }
  return uit;
}

/**
 * `a=1;b=x;` → `{a:"1", b:"x"}` (StyleEx, ObjectStyle, PDATA, Style van links).
 * @param {string|null|undefined} tekst
 * @returns {Record<string, string>}
 */
export function sleutelWaarden(tekst) {
  /** @type {Record<string, string>} */
  const uit = {};
  for (const deel of String(tekst || "").split(";")) {
    const i = deel.indexOf("=");
    if (i > 0) uit[deel.slice(0, i).trim()] = deel.slice(i + 1);
  }
  return uit;
}

/**
 * Knikpunten van een lijn (`t_diagramlinks.Path`): `x:y;x:y;` in EA-coördinaten
 * (y negatief). Terug in canvas-coördinaten (y gespiegeld).
 * @param {string|null|undefined} path
 * @param {number} [schaal] - vergrotingsfactor (zie `rechthoekNaarNode`)
 * @returns {{x:number,y:number}[]}
 */
export function knikkenUitPath(path, schaal = 1) {
  const uit = [];
  for (const deel of String(path || "").split(";")) {
    const [xs, ys] = deel.split(":");
    const x = Number(xs), y = Number(ys);
    if (deel && Number.isFinite(x) && Number.isFinite(y)) uit.push({ x: Math.round(x * schaal), y: Math.round(-y * schaal) });
  }
  return uit;
}

/**
 * Standaard vergrotingsfactor voor EA-lay-out. EA tekent bij 100 % met een
 * 8-punts letter in dozen van ~120×60; Omnium heeft een vaste, grotere letter
 * en een minimumbreedte van 180 px. Zonder schaal groeien de dozen wel maar
 * de afstanden niet, en loopt alles in elkaar (Mark, 08-10). 1,5 brengt de
 * verhoudingen terug: een EA-doos van 120×60 wordt 180×90.
 */
export const EA_SCHAAL = 1.5;

/**
 * EA-rechthoek (`RectLeft/RectTop/RectRight/RectBottom`, Top/Bottom negatief)
 * → positie en maat in canvas-coördinaten, vermenigvuldigd met `schaal`.
 * @param {{RectLeft:number,RectTop:number,RectRight:number,RectBottom:number}} r
 * @param {number} [schaal]
 */
export function rechthoekNaarNode(r, schaal = 1) {
  const left = Number(r.RectLeft) || 0;
  const top = Number(r.RectTop) || 0;
  const right = Number(r.RectRight) || 0;
  const bottom = Number(r.RectBottom) || 0;
  return {
    position: { x: Math.round(left * schaal), y: Math.round(-top * schaal) },
    size: {
      width: Math.round(Math.max(1, right - left) * schaal),
      height: Math.round(Math.max(1, top - bottom) * schaal),
    },
  };
}

/**
 * EA-kleur (BGR als integer; -1 = standaard) → `#rrggbb` of null.
 * @param {number|string|null|undefined} n
 */
export function kleurUitBgr(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  const b = (v >> 16) & 0xff, g = (v >> 8) & 0xff, r = v & 0xff;
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/**
 * EA-GUID `{6BF2F6D5-…}` → stabiel element-id `ea-6bf2f6d5-…`.
 * @param {string|null|undefined} guid
 */
export function idUitGuid(guid) {
  return "ea-" + String(guid || "").replace(/[{}]/g, "").toLowerCase();
}

/**
 * Kardinaliteit uit EA-grenzen (`LowerBound`/`UpperBound` op een attribuut).
 * `1..1` → null (standaard, niet tonen); `0..1`, `1..*`, `*` blijven.
 * @param {string|number|null|undefined} lower
 * @param {string|number|null|undefined} upper
 */
export function kardinaliteitUitGrenzen(lower, upper) {
  const l = lower == null || lower === "" ? null : String(lower);
  const u = upper == null || upper === "" ? null : String(upper);
  if (l == null && u == null) return null;
  if ((l ?? "1") === "1" && (u ?? "1") === "1") return null;
  if (l == null || l === u) return u;
  return `${l}..${u}`;
}

/**
 * Alle pakket-ids in de deelboom van `wortelId` (inclusief de wortel).
 * @param {{Package_ID:number, Parent_ID:number}[]} pakketten
 * @param {number} wortelId
 * @returns {number[]}
 */
export function deelboomPakketten(pakketten, wortelId) {
  /** @type {Map<number, number[]>} */
  const kinderen = new Map();
  for (const p of pakketten) {
    const lijst = kinderen.get(p.Parent_ID) || [];
    lijst.push(p.Package_ID);
    kinderen.set(p.Parent_ID, lijst);
  }
  const uit = [];
  const stapel = [wortelId];
  while (stapel.length) {
    const id = /** @type {number} */ (stapel.pop());
    uit.push(id);
    for (const k of kinderen.get(id) || []) stapel.push(k);
  }
  return uit;
}

/**
 * Pad van een pakket als tekst (`Model / Zandbak MW / Metametamodel`).
 * @param {{Package_ID:number, Parent_ID:number, Name:string}[]} pakketten
 * @param {number} id
 */
export function pakketPad(pakketten, id) {
  const perId = new Map(pakketten.map((p) => [p.Package_ID, p]));
  const delen = [];
  let huidig = perId.get(id);
  let stop = 0;
  while (huidig && stop++ < 100) {
    delen.unshift(huidig.Name || "");
    huidig = perId.get(huidig.Parent_ID);
  }
  return delen.join(" / ");
}

/**
 * Aanhechtpunt op de rand van een doos voor een lijn die naar `wp` loopt,
 * zoals EA het tekent bij "Orthogonal - Square" (TREE=OS): het eerste/laatste
 * stuk staat haaks op de rand. Ligt `wp` recht boven/onder de doos, dan is het
 * punt op de boven-/onderrand bij `wp.x`; ligt hij links/rechts ervan, op de
 * zijrand bij `wp.y`. Schuin (buiten beide stroken) → null: dan laat je de
 * motor zelf het snijpunt kiezen.
 * @param {{x:number,y:number,width:number,height:number}} rect  canvas-coördinaten
 * @param {{x:number,y:number}} wp
 * @returns {{x:number,y:number}|null}
 */
export function haaksAanhechtpunt(rect, wp, tolerantie = 0) {
  const links = rect.x, rechts = rect.x + rect.width, boven = rect.y, onder = rect.y + rect.height;
  const klem = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  // Kleine vaste vormen (ruit, stip): EA hecht in het midden van een zijde —
  // dat is de punt van de ruit. Snap dan naar het midden van de as.
  const klein = rect.width <= 40 || rect.height <= 40;
  const midX = rect.x + rect.width / 2, midY = rect.y + rect.height / 2;
  if (wp.x >= links - tolerantie && wp.x <= rechts + tolerantie && (wp.y < boven || wp.y > onder)) {
    return { x: klein ? midX : klem(wp.x, links, rechts), y: wp.y < boven ? boven : onder };
  }
  if (wp.y >= boven - tolerantie && wp.y <= onder + tolerantie && (wp.x < links || wp.x > rechts)) {
    return { x: wp.x < links ? links : rechts, y: klein ? midY : klem(wp.y, boven, onder) };
  }
  return null;
}

/**
 * Maak een reeks punten haaks: tussen twee punten die niet op één lijn liggen
 * komt een hoekpunt. De richting wisselt af, beginnend met `eersteRichting`
 * ("h" = eerst horizontaal, "v" = eerst verticaal); zonder voorkeur wordt
 * per stuk de grootste afstand eerst genomen.
 * @param {{x:number,y:number}[]} punten
 * @param {"h"|"v"|null} [eersteRichting]
 */
export function maakHaaks(punten, eersteRichting = null) {
  if (punten.length < 2) return punten.slice();
  const uit = [punten[0]];
  let richting = eersteRichting;
  for (let i = 1; i < punten.length; i++) {
    const p = uit[uit.length - 1], q = punten[i];
    const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
    if (dx > 0.5 && dy > 0.5) {
      const h = richting ? richting === "h" : dx >= dy;
      uit.push(h ? { x: q.x, y: p.y } : { x: p.x, y: q.y });
      richting = h ? "v" : "h"; // na een hoek loopt het volgende stuk haaks
    } else {
      richting = dx > 0.5 ? "v" : "h"; // dit stuk was horizontaal → volgende verticaal
    }
    uit.push(q);
  }
  return uit;
}
