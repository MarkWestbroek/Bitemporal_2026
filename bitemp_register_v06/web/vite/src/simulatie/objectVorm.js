// @ts-check
/**
 * objectVorm — een object van de run als een klein objectdiagram (Mark 16-11, ontwerp
 * Simulatie §12.6): de cm-vorm (`cmVorm.js`) omgezet naar losse objecten met lijnen.
 *
 * De regels, naar de weergave "neem op in Entiteit" van het cm, maar met waarden:
 *
 *   - Het **hoofdobject** is de entiteit: kop `naam : Type`, daaronder de enkelvoudige
 *     gegevenselementen genest (de naam, en ingesprongen `veld = waarde`). De gegevenselementen
 *     van de ouder en van het subtype staan samen in hetzelfde object.
 *   - Een **meervoudig gegevenselement** is als object lastig te nesten: elk voorkomen is een
 *     eigen object «gegevenselement», met een compositielijn naar het hoofdobject.
 *   - Een **relatie** met eigen velden is per voorkomen een object «relatie», met een lijn naar
 *     het hoofdobject en een pijl naar haar doel; het doel is een eigen object «entiteit». Een
 *     relatie zonder eigen velden is alleen de pijl naar het doel, met de naam erbij.
 *   - Een relatie binnen een gegevenselement (een referentielijst) is een waarde op het veld:
 *     `type = GPK (Gehandicaptenparkeerkaart)`.
 *   - Alleen velden met een waarde staan erin; een verplicht veld zonder waarde blijft staan als
 *     fout. Een gegevenselement, relatie of doel zonder iets erin komt er niet in.
 *
 * `:` wijst naar het type (alleen in de kop), `=` geeft de waarde (UML).
 *
 * Puur.
 */

const heeftWaarde = (w) => w !== undefined && w !== null && w !== "" && !(Array.isArray(w) && !w.length);

/**
 * @typedef {{naam: string, waarde: any, extra?: string, verplicht?: boolean, fout?: boolean, gewijzigd?: boolean}} ObjectVeld
 * @typedef {{naam: string, velden: ObjectVeld[]}} ObjectSectie
 * @typedef {{id: string, stereotype: string, kop: string, type: string, kolom: number, inspring?: boolean, velden: ObjectVeld[], secties: ObjectSectie[]}} ObjectDoos
 * @typedef {{van: string, naar: string, soort: "compositie"|"relatie"|"doel", label?: string}} ObjectLijn
 */

/**
 * @param {any} boom - de boom uit `cmVorm`
 * @param {Object} [opts]
 * @param {string} [opts.objectNaam] - de naam van het object (de sleutel in de run)
 * @param {string[]} [opts.fouten] - de paden van de fouten uit de toets van `cmVorm`
 * @param {Set<string>} [opts.gewijzigd] - de velden van de platte vorm die net veranderden
 * @returns {{objecten: ObjectDoos[], lijnen: ObjectLijn[]}}
 */
export function objectVorm(boom, { objectNaam = "", fouten = [], gewijzigd = new Set() } = {}) {
  /** @type {ObjectDoos[]} */
  const objecten = [];
  /** @type {ObjectLijn[]} */
  const lijnen = [];
  if (!boom) return { objecten, lijnen };

  const doos = (id, stereotype, type, kolom, naam = "") => ({ id, stereotype, kop: `${naam} : ${type}`.trim(), type, kolom, velden: [], secties: [] });
  const leeg = (d) => !d.velden.length && !d.secties.length;

  /** @returns {ObjectVeld|null} */
  const veldUit = (k, pad) => {
    const fout = fouten.includes(`${pad}.${k.naam}`);
    if (!heeftWaarde(k.waarde) && !fout) return null;
    return { naam: k.naam, waarde: k.waarde, ...(k.verplicht ? { verplicht: true } : {}), ...(fout ? { fout: true } : {}), ...(k.platSleutel && gewijzigd.has(k.platSleutel) ? { gewijzigd: true } : {}) };
  };

  /** Alle velden met een waarde onder een knoop, in de volgorde van het model. */
  const bladeren = (kinderen) => kinderen.flatMap((c) => (c.soort === "veld" ? (heeftWaarde(c.waarde) ? [c] : []) : c.voorkomens.flatMap(bladeren)));

  /** De velden van een gegevenselement: zijn eigen velden, en wat erin genest is plat erbij. */
  function vulSectie(sectie, kinderen, pad) {
    for (const c of kinderen) {
      if (c.soort === "veld") {
        const v = veldUit(c, pad);
        if (v) sectie.velden.push(v);
      } else if (c.soort === "relatie") {
        // Een relatie binnen een gegevenselement (referentielijst): de waarde op het veld.
        const perVoorkomen = c.voorkomens.map(bladeren).filter((b) => b.length);
        if (!perVoorkomen.length) continue;
        const tekst = (b) => String(b[0].waarde);
        const eerste = perVoorkomen[0];
        sectie.velden.push({
          naam: c.naam,
          waarde: perVoorkomen.length > 1 ? perVoorkomen.map(tekst) : eerste[0].waarde,
          ...(perVoorkomen.length === 1 && eerste.length > 1 ? { extra: eerste.slice(1).map((v) => String(v.waarde)).join(", ") } : {}),
          ...(c.verplicht ? { verplicht: true } : {}),
          ...(perVoorkomen.flat().some((v) => v.platSleutel && gewijzigd.has(v.platSleutel)) ? { gewijzigd: true } : {}),
        });
      } else {
        c.voorkomens.forEach((kind, i) => vulSectie(sectie, kind, c.meervoudig ? `${pad}.${c.naam}[${i}]` : `${pad}.${c.naam}`));
      }
    }
  }

  /** Vult een object met de kinderen van een entiteit (of ouder, of doel). */
  function vul(d, kinderen, pad) {
    for (const c of kinderen) {
      if (c.soort === "veld") {
        const v = veldUit(c, pad);
        if (v) d.velden.push(v);
        continue;
      }
      const hier = `${pad}.${c.naam}`;
      if (c.soort === "ge" && !c.meervoudig) {
        const sectie = { naam: c.naam, velden: [] };
        vulSectie(sectie, c.voorkomens[0] || [], hier);
        if (sectie.velden.length) d.secties.push(sectie);
      } else if (c.soort === "ge") {
        c.voorkomens.forEach((kind, i) => {
          const los = doos(`ge:${c.id}#${i}`, "gegevenselement", c.naam, d.kolom + 1);
          vulSectie(los, kind, `${hier}[${i}]`);
          if (leeg(los)) return;
          objecten.push(los);
          lijnen.push({ van: d.id, naar: los.id, soort: "compositie" });
        });
      } else if (c.soort === "relatie") {
        c.voorkomens.forEach((kind, i) => {
          const vPad = c.meervoudig ? `${hier}[${i}]` : hier;
          const eigen = kind.filter((x) => x.soort === "veld").map((x) => veldUit(x, vPad)).filter(Boolean);
          const doelen = kind
            .filter((x) => x.soort !== "veld")
            .map((x) => {
              // Het doel staat in dezelfde kolom, onder zijn relatie en iets ingesprongen.
              const b = { ...doos(`doel:${x.id}#${i}`, "entiteit", x.naam, d.kolom + 1), ...(eigen.length ? { inspring: true } : {}) };
              vul(b, x.voorkomens[0] || [], `${vPad}.${x.naam}`);
              return b;
            })
            .filter((b) => !leeg(b));
          if (!eigen.length && !doelen.length) return;
          if (eigen.length) {
            const r = doos(`rel:${c.id}#${i}`, "relatie", c.naam, d.kolom + 1);
            r.velden = /** @type {ObjectVeld[]} */ (eigen);
            objecten.push(r, ...doelen);
            lijnen.push({ van: d.id, naar: r.id, soort: "relatie" }, ...doelen.map((b) => /** @type {ObjectLijn} */ ({ van: r.id, naar: b.id, soort: "doel" })));
          } else {
            objecten.push(...doelen);
            lijnen.push(...doelen.map((b) => /** @type {ObjectLijn} */ ({ van: d.id, naar: b.id, soort: "doel", label: c.naam })));
          }
        });
      } else {
        // Een ouder (overerving): zijn gegevenselementen horen bij dit object.
        vul(d, c.voorkomens[0] || [], hier);
      }
    }
  }

  const hoofd = doos("hoofd", "entiteit", boom.naam, 0, objectNaam);
  objecten.push(hoofd);
  vul(hoofd, boom.voorkomens[0] || [], boom.naam);
  return { objecten, lijnen };
}
