// @ts-check
/**
 * adapter — Toegangsspraak-AST → toegangsregel-profielmodel (stap 2).
 *
 * Deterministische afbeelding: hetzelfde beleid geeft hetzelfde model
 * (stabiele ids op volgorde, geen klok of random), zodat de projectie
 * testbaar is en de diagram-weergave — en straks de motor — er direct op
 * kunnen draaien. Naar het voorbeeld van diagramprofielen/formulier/adapter.
 *
 * Cross-profiel: gegevensselecties en begrippen dragen hun verwijzing als
 * paar { verwijzingsprofiel, verwijzingselement } — canoniek model is de
 * default (PROFIEL_CANONIEK), niet hardgecodeerd.
 */
import {
  renderVerwijzing, renderVoorwaarde, verwijzingNaarPad, verwijzingNaarGroepPad,
  geefActies, geefOperatoren,
} from "../../toegangsspraak/index.js";

export const PROFIEL_CANONIEK = "canoniek-model";

// ── Teksthulpen (gedeeld met de diagram-weergave) ────────────────────────────

export function wieTekst(wie) {
  if (wie.soort === "iemand") {
    return `iemand met ${wie.kenmerken.map((k) => `${k.kenmerk} "${k.waarde}"`).join(" en ")}`;
  }
  return wie.lidwoord ? `${wie.lidwoord} ${wie.naam}` : wie.naam;
}

export function watTekst(wat) {
  if (wat.soort === "begrip") return wat.lidwoord ? `${wat.lidwoord} ${wat.naam}` : wat.naam;
  if (wat.soort === "alle") return `alle gegevens van ${renderVerwijzing(wat.verwijzing)}`;
  return renderVerwijzing(wat);
}

export function termTekst(term) {
  if (!term) return "";
  if (term.soort === "literal") return term.type === "tekst" ? `"${term.waarde}"` : String(term.waarde);
  return renderVerwijzing(term);
}

export function operatorZin(canoniek) {
  return geefOperatoren().find((op) => op.canoniek === canoniek)?.zin || canoniek;
}

export const KWANTOR_LABEL = { en: "alle", of: "ten minste één", xof: "precies één" };

/** Verwijzing van een wat-slot → (profiel, element); null zonder registerpad. */
export function watVerwijzing(wat) {
  const pad =
    wat.soort === "alle"
      ? wat.verwijzing.pad || verwijzingNaarGroepPad(wat.verwijzing)
      : wat.soort === "verwijzing"
        ? wat.pad || verwijzingNaarPad(wat)
        : null;
  return pad ? { verwijzingsprofiel: PROFIEL_CANONIEK, verwijzingselement: pad } : null;
}

// ── AST → profielmodel ───────────────────────────────────────────────────────

/**
 * @returns {{ elementen: Array, connectoren: Array }} elementen/connectoren in
 * de vocabulaire van het toegangsregel-profiel (elementType-ids uit index.js).
 */
export function beleidNaarDiagramModel(beleid) {
  const elementen = [];
  const connectoren = [];
  let n = 0;
  const nieuw = (elementType, naam, data = {}) => {
    n += 1;
    const element = { id: `trg_${n}`, elementType, naam, data };
    elementen.push(element);
    return element;
  };
  const verbind = (elementType, van, naar) => {
    connectoren.push({
      id: `trg_c${connectoren.length + 1}`,
      elementType,
      van: van.id,
      naar: naar.id,
    });
  };

  // Top-level: de policy zelf. Regels hangen eraan met "omvat" (aggregatie) —
  // herbruikbaar over policies, geen compositie.
  const policy = nieuw("policy", beleid.naam, {
    geldigVanaf: beleid.geldigVanaf || "",
    geldigTot: beleid.geldigTot || "",
    grondslag: beleid.grondslag || "",
    doel: beleid.doel || "",
  });

  // Begrippen — herbruikbare definitie-elementen.
  const begripPerNaam = new Map();
  for (const begrip of beleid.begrippen) {
    const data = { soort: begrip.soort };
    if (begrip.soort === "wie") {
      data.definitie = `iemand met ${begrip.kenmerken.map((k) => `${k.kenmerk} "${k.waarde}"`).join(" en ")}`;
    } else {
      data.definitie = watTekst(begrip.wat);
      Object.assign(data, watVerwijzing(begrip.wat) || {});
    }
    const element = nieuw("begrip", begrip.naam, data);
    begripPerNaam.set(begrip.naam.toLowerCase(), element);
  }

  const voorwaardeBoom = (knoop, ouder, connector) => {
    if (knoop.soort === "voorwaarde") {
      const element = nieuw("voorwaarde", renderVoorwaarde(knoop), {
        links: termTekst(knoop.links),
        vergelijking: operatorZin(knoop.operator),
        rechts: knoop.lijst
          ? `(${knoop.lijst.map(termTekst).join(", ")})`
          : knoop.rechts2
            ? `${termTekst(knoop.rechts)} en ${termTekst(knoop.rechts2)}`
            : termTekst(knoop.rechts),
      });
      verbind(connector, ouder, element);
      return;
    }
    const poort = nieuw("voorwaardepoort", KWANTOR_LABEL[knoop.soort], { soort: KWANTOR_LABEL[knoop.soort] });
    verbind(connector, ouder, poort);
    for (const item of knoop.items) voorwaardeBoom(item, poort, "tak");
  };

  for (const regel of beleid.regels) {
    const kaart = nieuw("toegangsregel", regel.naam, {
      modaliteit: regel.verbod ? "mag niet" : "mag",
    });
    verbind("omvat", policy, kaart);

    const subject = nieuw("subject", wieTekst(regel.wie), regel.wie.soort === "iemand"
      ? { kenmerken: regel.wie.kenmerken.map((k) => `${k.kenmerk}="${k.waarde}"`).join(", ") }
      : { rol: regel.wie.naam });
    verbind("wie", kaart, subject);
    const wieBegrip = regel.wie.soort === "begrip" && begripPerNaam.get(regel.wie.naam.toLowerCase());
    if (wieBegrip) verbind("verwijst-naar", subject, wieBegrip);

    const nlgov = geefActies().find((a) => a.woord === regel.actie)?.nlgov || "";
    const handeling = nieuw("handeling", regel.actie, { nlgov });
    verbind("doet", subject, handeling);

    const gegevens = nieuw("gegevensselectie", watTekst(regel.wat), watVerwijzing(regel.wat) || {});
    verbind("op", handeling, gegevens);
    const watBegrip = regel.wat.soort === "begrip" && begripPerNaam.get(regel.wat.naam.toLowerCase());
    if (watBegrip) verbind("verwijst-naar", gegevens, watBegrip);

    if (regel.voorwaarden) voorwaardeBoom(regel.voorwaarden, kaart, "als");
    for (const plicht of regel.plichten) {
      const element = nieuw("plicht", plicht.zin, { nlgov: plicht.nlgov });
      verbind("waarbij", kaart, element);
    }
  }

  return { elementen, connectoren };
}

// ── Kruisverbanden (stap 3, v0) ──────────────────────────────────────────────

/**
 * De cross-profiel verwijzingen van een profielmodel als kruisverband-links
 * in het formaat van de Koppelingen-activiteit: rij = het toegangsregel-
 * element (onderliggend), kolom = het element in het andere profiel
 * (bovenliggend), soort "komt voort uit". elementIds zijn leesbaar (naam
 * resp. registerpad); resolutie naar echte projectboom-elementen volgt
 * wanneer het profiel in de boom landt.
 */
export function kruisverbandenUit(model) {
  const links = [];
  const gezien = new Set();
  for (const element of model.elementen) {
    const { verwijzingsprofiel, verwijzingselement } = element.data || {};
    if (!verwijzingsprofiel || !verwijzingselement) continue;
    const sleutel = `${element.naam}##${verwijzingsprofiel}::${verwijzingselement}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    links.push({
      rij: { profielId: "toegangsregel", elementId: element.naam },
      kolom: { profielId: verwijzingsprofiel, elementId: verwijzingselement },
      soort: "komt voort uit",
    });
  }
  return links;
}
