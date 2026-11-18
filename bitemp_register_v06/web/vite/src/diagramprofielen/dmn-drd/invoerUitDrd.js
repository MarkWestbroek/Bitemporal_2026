// @ts-check
/**
 * invoerUitDrd — de invoerkolommen van een beslistabel volgen uit het DRD (Mark 16-11).
 *
 * Het diagram is leidend: elke information requirement (pijl `infoReq`) naar een beslissing is
 * één bron van invoer.
 *   - Een **invoergegeven** levert één kolom. Wáár de waarde vandaan komt staat op het
 *     invoergegeven zelf (eigenschap `gegeven`, datatype "veld-verwijzing": een veld van een
 *     element in een taal die gegevens draagt), niet op de kolom. Eén invoergegeven dat bij twee
 *     beslissingen hoort, koppel je zo één keer.
 *   - Een **beslissing** (DMN: required decision) levert één kolom per uitvoer van haar
 *     beslistabel; zonder tabel één kolom met de naam van de beslissing.
 *
 * Een kolom uit het diagram draagt `bron: {soort, elementId, uitvoerId?}`. Kolommen zonder `bron`
 * zijn van vóór deze regel (de koppeling op de kolom zelf, `fieldRef`); die blijven staan en
 * werken zoals ze deden. Een kolom waarvan de bron uit het diagram verdween blijft ook staan
 * (met `bronWeg`), zodat ingevulde regels niet stil verdwijnen; weghalen doet de gebruiker.
 *
 * Puur en store-loos; de veldverwijzing oplossen naar een FieldRef van het canonieke model doet
 * de aanroeper (`losVeldOp`), omdat dat over profielen heen gaat.
 */

const INFO_REQ = "infoReq";

/** Sleutel van een bron: één per kolom. */
export const bronSleutel = (bron) => (bron ? `${bron.soort}:${bron.elementId}${bron.uitvoerId ? `:${bron.uitvoerId}` : ""}` : "");

/**
 * De bronnen van invoer van een beslissing, in een vaste volgorde (op naam).
 * @param {Record<string, any>} elements - de elementen van het DMN-model
 * @param {string} beslissingId
 * @returns {{soort: "invoer"|"beslissing", elementId: string, uitvoerId?: string, naam: string,
 *   gegeven?: any, type?: string, datatype?: string, enum?: string[]}[]}
 */
export function bronnenVan(elements, beslissingId) {
  const uit = [];
  const gezien = new Set();
  for (const conn of Object.values(elements || {})) {
    if (conn?.elementType !== INFO_REQ || conn.target !== beslissingId || gezien.has(conn.source)) continue;
    const bron = elements[conn.source];
    if (!bron) continue;
    gezien.add(conn.source);
    if (bron.elementType === "inputData") {
      uit.push({ soort: "invoer", elementId: bron.id, naam: bron.naam || bron.id, gegeven: bron.data?.gegeven || null });
    } else if (bron.elementType === "decision") {
      const uitvoer = bron.data?.beslistabel?.outputs || [];
      if (!uitvoer.length) uit.push({ soort: "beslissing", elementId: bron.id, naam: bron.naam || bron.id });
      for (const o of uitvoer) {
        const naam = o.naam || o.fieldRef?.veldnaam || bron.naam || bron.id;
        uit.push({
          soort: "beslissing",
          elementId: bron.id,
          uitvoerId: o.id,
          // Eén uitvoer: de kolom heet naar de beslissing; meer: "Beslissing.uitvoer".
          naam: uitvoer.length === 1 ? bron.naam || naam : `${bron.naam || bron.id}.${naam}`,
          type: o.type || "",
          datatype: o.datatype || "",
          enum: Array.isArray(o.enum) ? o.enum : [],
        });
      }
    }
  }
  return uit.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

const gelijk = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Breng de invoerkolommen van een tabel in lijn met de bronnen uit het diagram. Dezelfde tabel
 * terug (identiteit) als er niets verandert.
 * @param {any} tabel
 * @param {ReturnType<typeof bronnenVan>} bronnen
 * @param {(gegeven: any, bestaand: any) => any} [losVeldOp] - veldverwijzing → FieldRef van het
 *   canonieke model, of null; `bestaand` is de kolom zoals ze er stond
 * @param {{alleenBestaand?: boolean}} [opties] - alleenBestaand: geen kolommen erbij en geen oude
 *   overnemen, alleen bijwerken wat al een bron heeft (de export: die voegt niets toe)
 */
export function metInvoerUitDrd(tabel, bronnen, losVeldOp = () => null, { alleenBestaand = false } = {}) {
  const perSleutel = new Map(bronnen.map((b) => [bronSleutel(b), b]));
  const gebruikt = new Set();
  let anders = false;
  let inputs = (tabel.inputs || []).map((c) => {
    if (!c.bron) return c;
    const sleutel = bronSleutel(c.bron);
    const b = perSleutel.get(sleutel);
    if (!b) {
      if (c.bronWeg) return c;
      anders = true;
      return { ...c, bronWeg: true };
    }
    gebruikt.add(sleutel);
    const nieuw = kolomVoor(b, losVeldOp, c);
    if (gelijk(nieuw, c)) return c;
    anders = true;
    return nieuw;
  });
  if (alleenBestaand) return anders ? { ...tabel, inputs } : tabel;
  // Een kolom van vóór deze regel (koppeling op de kolom zelf) die bij een invoergegeven hoort,
  // gaat over op dat invoergegeven: zelfde veld (uuid), of zelfde naam. Ze houdt haar id en dus
  // haar cellen; zolang het invoergegeven zelf geen veld heeft, blijft het veld van de kolom staan.
  for (const b of bronnen) {
    if (b.soort !== "invoer" || gebruikt.has(bronSleutel(b))) continue;
    const i = inputs.findIndex((c) => !c.bron && ((b.gegeven?.uuid && c.fieldRef?.uuid === b.gegeven.uuid) || (c.naam || c.fieldRef?.veldnaam) === b.naam));
    if (i < 0) continue;
    gebruikt.add(bronSleutel(b));
    anders = true;
    inputs = inputs.map((c, j) => (j === i ? kolomVoor(b, losVeldOp, c) : c));
  }
  const erbij = bronnen.filter((b) => !gebruikt.has(bronSleutel(b))).map((b) => kolomVoor(b, losVeldOp, null));
  if (!erbij.length && !anders) return tabel;
  return {
    ...tabel,
    inputs: [...inputs, ...erbij],
    rules: (tabel.rules || []).map((r) => {
      if (!erbij.length) return r;
      const inputEntries = { ...(r.inputEntries || {}) };
      for (const k of erbij) inputEntries[k.id] = "";
      return { ...r, inputEntries };
    }),
  };
}

/** De kolom bij een bron; met `bestaand` blijven id en eigen toevoegingen (expressie) staan. */
function kolomVoor(b, losVeldOp, bestaand) {
  const basis = { ...(bestaand || {}) };
  delete basis.bronWeg;
  const bron = { soort: b.soort, elementId: b.elementId, ...(b.uitvoerId ? { uitvoerId: b.uitvoerId } : {}) };
  const id = bestaand?.id || `in_${bronSleutel(bron).replace(/[^A-Za-z0-9_]/g, "_")}`;
  if (b.soort === "invoer") {
    // Zonder veld op het invoergegeven blijft de koppeling van de kolom zelf (als die er was) staan.
    const fieldRef = b.gegeven ? losVeldOp(b.gegeven, bestaand) || null : bestaand?.fieldRef || null;
    return {
      ...basis,
      id,
      bron,
      naam: b.naam,
      label: b.naam,
      fieldRef,
      // Zonder FieldRef (een veld buiten het canonieke model, of nog niet gekozen): de naam van het veld.
      veldNaam: b.gegeven?.veldNaam || "",
      type: fieldRef?.type || "",
      datatype: fieldRef?.datatype || "",
      enum: Array.isArray(fieldRef?.enum) ? fieldRef.enum : [],
    };
  }
  return { ...basis, id, bron, naam: b.naam, label: b.naam, fieldRef: null, type: b.type || "", datatype: b.datatype || "", enum: b.enum || [] };
}

/** Haal een kolom weg, met haar cellen. */
export function zonderKolom(tabel, kolomId, kant = "input") {
  const lijst = kant === "input" ? "inputs" : "outputs";
  const cellen = kant === "input" ? "inputEntries" : "outputEntries";
  return {
    ...tabel,
    [lijst]: (tabel[lijst] || []).filter((c) => c.id !== kolomId),
    rules: (tabel.rules || []).map((r) => {
      const rest = { ...(r[cellen] || {}) };
      delete rest[kolomId];
      return { ...r, [cellen]: rest };
    }),
  };
}

/**
 * Meldingen bij de invoerkolommen (in plaats van de invoerregel van valideerTabel in dmnModel,
 * die alleen de koppeling op de kolom zelf kent).
 * @returns {{niveau: "fout"|"info", tekst: string}[]}
 */
export function invoerMeldingen(tabel) {
  const uit = [];
  for (const c of tabel.inputs || []) {
    if (!c.bron) {
      uit.push({ niveau: "info", tekst: `Kolom "${c.label || c.naam || c.fieldRef?.veldpad || c.id}" komt niet uit het diagram. Teken er een invoergegeven met een pijl voor, of haal de kolom weg.` });
    } else if (c.bronWeg) {
      uit.push({ niveau: "fout", tekst: `De bron van kolom "${c.naam}" staat niet meer in het diagram (geen pijl meer naar deze beslissing).` });
    } else if (c.bron.soort === "invoer" && !c.fieldRef && !c.veldNaam) {
      uit.push({ niveau: "info", tekst: `Invoergegeven "${c.naam}" wijst nog niet naar een veld (eigenschap "gegeven").` });
    }
  }
  return uit;
}
