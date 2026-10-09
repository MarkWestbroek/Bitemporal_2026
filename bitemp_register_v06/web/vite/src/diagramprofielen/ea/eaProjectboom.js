// @ts-check
/**
 * eaProjectboom — de EA-boom als mappen in het project, als puur plan.
 *
 * Zet wat de EA-import in een profiel heeft gezet op zijn plek in de
 * projectboom, zoals EA het toont (Mark, 09-10): pakketten als mappen, en
 * daarbinnen de elementen die diagrammen "bezitten" (use case → activity)
 * óók als map — het diagram staat erin, met de knopen (acties, beslissingen)
 * ernaast. Elementen zonder zo'n eigenaar staan in de map van hun pakket.
 * Mappen worden hergebruikt (zelfde naam onder dezelfde ouder), dus een
 * tweede import maakt geen dubbele boom.
 *
 * Geen store, geen UI: de aanroeper (modellerenActivity in de browser, de
 * sidecar in node) voert `teMaken` (nieuweMappen) en `keysPerMap`
 * (plaatsPerMap) uit. Het `geheugen` reist over de profielen van één import
 * mee, zodat alle profielen dezelfde mappen delen.
 */

/** Sleutels in de projectboom (zoals modellerenActivity ze maakt). */
export const tabId = (profielId, diagramId) => `${profielId}::${diagramId}`;
export const elementKey = (profielId, elementId) => `el::${profielId}::${elementId}`;

/**
 * @param {string} profielId
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} model - de ingevoegde delen (definitieve ids)
 * @param {{bron: any, packageId: number, geheugen: Map<any, any>, doel: string|null,
 *          mappen: Record<string, {id:string, naam:string, ouderId?:string|null}>, nieuwMapId: () => string}} ctx
 * @returns {{teMaken: {naam:string, ouderId:string|null, mapId:string}[], keysPerMap: Record<string, string[]>}}
 */
export function plaatsEaInProjectboomPlan(profielId, model, ctx) {
  const { bron, packageId, geheugen, doel, mappen, nieuwMapId } = ctx;
  const pakketPerId = new Map((bron.t_package || []).map((p) => [p.Package_ID, p]));
  const objectPerId = new Map((bron.t_object || []).map((o) => [o.Object_ID, o]));
  const objectPerGuid = new Map((bron.t_object || []).map((o) => [o.ea_guid, o]));
  const diagramPerGuid = new Map((bron.t_diagram || []).map((d) => [String(d.ea_guid || "").replace(/[{}]/g, "").toLowerCase(), d]));
  const inBereik = new Set();
  const stapel = [packageId];
  while (stapel.length) {
    const id = stapel.pop();
    inBereik.add(id);
    for (const p of pakketPerId.values()) if (p.Parent_ID === id) stapel.push(p.Package_ID);
  }

  /**
   * Map zoeken of maken: zelfde naam onder dezelfde ouder = dezelfde map.
   * Nieuwe mappen worden verzameld en in één stap gemaakt — het id is al
   * bekend, zodat kinderen ernaar kunnen wijzen.
   */
  const bestaandeMappen = Object.values(mappen || {});
  const teMaken = [];
  const mapVoor = (naam, ouderId) => {
    const sleutel = `map|${ouderId || ""}|${naam}`;
    if (geheugen.has(sleutel)) return geheugen.get(sleutel);
    const bestaand = bestaandeMappen.find((m) => m.naam === naam && (m.ouderId || null) === (ouderId || null));
    const id = bestaand ? bestaand.id : nieuwMapId();
    if (!bestaand) teMaken.push({ naam, ouderId: ouderId || null, mapId: id });
    geheugen.set(sleutel, id);
    return id;
  };
  /** Map van een EA-pakket (recursief tot het gekozen pakket; daarbuiten = wortel). */
  const mapVanPakket = (pid) => {
    if (!inBereik.has(pid)) return null;
    const sleutel = `pkg|${pid}`;
    if (geheugen.has(sleutel)) return geheugen.get(sleutel);
    const p = pakketPerId.get(pid);
    // Het gekozen pakket komt in de gekozen doelmap (of de wortel).
    const ouder = p && pid !== packageId ? mapVanPakket(p.Parent_ID) : doel || null;
    const id = mapVoor(p?.Name || `Pakket ${pid}`, ouder);
    geheugen.set(sleutel, id);
    return id;
  };
  // Alleen elementen die een diagram "bezitten" (t_diagram.ParentID: de
  // activity, en via ParentID de use case erboven) worden een map — niet elke
  // actie met een pin eraan.
  const eigenaars = new Set();
  for (const d of bron.t_diagram || []) {
    let cursor = d.ParentID, n = 0;
    while (cursor && objectPerId.has(cursor) && n++ < 20) {
      eigenaars.add(cursor);
      cursor = objectPerId.get(cursor).ParentID;
    }
  }
  /** Map van een "eigenaar"-element (use case, activity): via ParentID omhoog tot het pakket. */
  const mapVanEigenaar = (objectId, diepte = 0) => {
    const o = objectPerId.get(objectId);
    if (!o || diepte > 20) return null;
    // Geen eigenaar van een diagram: de dichtstbijzijnde eigenaar erboven, anders het pakket.
    if (!eigenaars.has(objectId)) return o.ParentID ? mapVanEigenaar(o.ParentID, diepte + 1) : mapVanPakket(o.Package_ID);
    const sleutel = `obj|${objectId}`;
    if (geheugen.has(sleutel)) return geheugen.get(sleutel);
    const ouder = o.ParentID ? mapVanEigenaar(o.ParentID, diepte + 1) : mapVanPakket(o.Package_ID);
    const stereo = o.Stereotype ? `«${o.Stereotype}» ` : "";
    const id = mapVoor(`${stereo}${o.Name || o.Object_Type}`, ouder);
    geheugen.set(sleutel, id);
    return id;
  };

  const keys = new Map(); // mapId → keys
  const zet = (key, mapId) => {
    if (!mapId) return;
    if (!keys.has(mapId)) keys.set(mapId, []);
    keys.get(mapId).push(key);
  };
  // Diagrammen: in de map van hun eigenaar-element, anders van hun pakket.
  for (const d of Object.values(model.diagrams || {})) {
    const guid = (String(d.id).match(/ead-([0-9a-f-]{36})/) || [])[1];
    const rij = guid ? diagramPerGuid.get(guid) : null;
    if (!rij) continue;
    const mapId = rij.ParentID ? mapVanEigenaar(rij.ParentID) : mapVanPakket(rij.Package_ID);
    zet(tabId(profielId, d.id), mapId);
  }
  // Elementen (geen connectoren, geen naamloze notities/teksten): bij hun
  // eigenaar (ParentID) of in hun pakket.
  for (const el of Object.values(model.elements || {})) {
    if (el.source || el.target || !el.data?.eaGuid) continue;
    if (!el.naam && el.elementType !== "begin") continue;
    const o = objectPerGuid.get(el.data.eaGuid);
    if (!o || o.Object_Type === "Package") continue;
    const mapId = o.ParentID && objectPerId.has(o.ParentID) ? mapVanEigenaar(o.ParentID) : mapVanPakket(o.Package_ID);
    zet(elementKey(profielId, el.id), mapId);
  }
  return { teMaken, keysPerMap: Object.fromEntries(keys) };
}

/**
 * Een mappad ("Import / GGM") zoeken of aanmaken, van de wortel af; de
 * ontbrekende schakels komen in `teMaken` (ouders eerst). Leeg pad = wortel.
 * @returns {{mapId: string|null, teMaken: {naam:string, ouderId:string|null, mapId:string}[]}}
 */
export function mapPadPlan(mappen, pad, nieuwMapId) {
  const delen = String(pad || "").split("/").map((s) => s.trim()).filter(Boolean);
  const teMaken = [];
  let ouder = null;
  for (const naam of delen) {
    const bestaand = Object.values(mappen || {}).find((m) => m.naam === naam && (m.ouderId || null) === ouder) || teMaken.find((m) => m.naam === naam && m.ouderId === ouder);
    if (bestaand) {
      ouder = bestaand.mapId || bestaand.id;
      continue;
    }
    const mapId = nieuwMapId();
    teMaken.push({ naam, ouderId: ouder, mapId });
    ouder = mapId;
  }
  return { mapId: ouder, teMaken };
}
