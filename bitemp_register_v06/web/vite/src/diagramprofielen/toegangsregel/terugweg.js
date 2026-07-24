// @ts-check
/**
 * terugweg — diagram-model → Toegangsspraak-tekst (het sluitstuk van stap 4,
 * "2026-07-24 Toegangsregel-profiel (ontwerp)").
 *
 * De truc: de element-namen in het profielmodel zíjn al canonieke
 * taalfragmenten ("een schuldhulpverlener", "de inkomensgegevens",
 * 'het doel van de aanvraag is "schuldhulpverlening"'). De terugweg
 * reconstrueert daaruit de beleidstekst en laat de bestaande parser de
 * betekenis bewaken: wat op de canvas is bewerkt of bijgetekend, komt als
 * taal terug — en wat niet klopt (onbekende handeling, kapotte voorwaarde)
 * wordt een gewone parsefout in de teksteditor, precies waar de auteur hem
 * kan repareren.
 *
 * Best-effort met meldingen: onvolledige regels (kaart zonder subject,
 * handeling of gegevens) worden overgeslagen en gemeld, nooit half
 * uitgeschreven. Gebruikers-notities en losse elementen doen niet mee.
 */
import { isoNaarNlDatum } from "../../toegangsspraak/woorden.js";

const cap = (tekst) => (tekst ? tekst.charAt(0).toUpperCase() + tekst.slice(1) : tekst);

const KWANTOR_KOP = {
  "alle": "aan alle volgende voorwaarden is voldaan:",
  "ten minste één": "aan ten minste één van de volgende voorwaarden is voldaan:",
  "precies één": "aan precies één van de volgende voorwaarden is voldaan:",
};

function datumTekst(waarde) {
  return /^\d{4}-\d{2}-\d{2}$/.test(waarde || "") ? isoNaarNlDatum(waarde) : waarde;
}

/** Voorwaarde-element → stellingtekst; inspector-data wint van de naam. */
function voorwaardeTekst(element) {
  const d = element.data || {};
  if (d.links && (d.rechts || d.vergelijking)) {
    return [d.links, d.vergelijking || "is", d.rechts].filter(Boolean).join(" ");
  }
  return element.naam || "";
}

/**
 * Reconstrueer de Toegangsspraak-tekst uit de store-state van het
 * toegangsregel-profiel.
 *
 * @param {{ elements: Record<string, any> }} state — de motor-store-state
 * @returns {{ tekst: string|null, meldingen: string[] }}
 */
export function terugNaarTekst(state) {
  const alle = Object.values(state?.elements || {});
  const elementen = alle.filter((el) => !el.source && !el.target);
  const connectoren = alle.filter((el) => el.source && el.target);
  const perId = new Map(elementen.map((el) => [el.id, el]));
  const uit = (vanId, soort) =>
    connectoren.filter((c) => c.elementType === soort && c.source === vanId).map((c) => perId.get(c.target)).filter(Boolean);

  const meldingen = [];
  const policy = elementen.find((el) => el.elementType === "policy");
  if (!policy) {
    return { tekst: null, meldingen: ["Geen policy-element in het diagram-model — niets terug te lezen."] };
  }

  const blokken = [];
  const kop = [`Beleid "${policy.naam}".`];
  const pd = policy.data || {};
  if (pd.geldigVanaf) {
    kop.push(`  Geldig vanaf ${datumTekst(pd.geldigVanaf)}${pd.geldigTot ? ` tot ${datumTekst(pd.geldigTot)}` : ""}.`);
  }
  if (pd.grondslag) kop.push(`  Grondslag: ${pd.grondslag}.`);
  if (pd.doel) kop.push(`  Doel: "${pd.doel}".`);
  blokken.push(kop.join("\n"));

  const begrippen = elementen.filter((el) => el.elementType === "begrip");
  if (begrippen.length) {
    const regels = ["  Begrippen."];
    for (const begrip of begrippen) {
      const d = begrip.data || {};
      if (!d.definitie) {
        meldingen.push(`Begrip "${begrip.naam}" heeft geen definitie (eigenschap "definitie") — overgeslagen.`);
        continue;
      }
      const werkwoord = d.werkwoord || (String(d.definitie).startsWith("iemand") ? "is" : "zijn");
      const onderwerp = cap(d.lidwoord ? `${d.lidwoord} ${begrip.naam}` : begrip.naam);
      regels.push(`    ${onderwerp} ${werkwoord}: ${d.definitie}.`);
    }
    if (regels.length > 1) blokken.push(regels.join("\n"));
  }

  const boom = (knoop, diepte, regels) => {
    const inspring = " ".repeat(6 + diepte * 2);
    if (knoop.elementType === "voorwaarde") {
      regels.push(`${inspring}- ${voorwaardeTekst(knoop)};`);
      return;
    }
    const kopZin = KWANTOR_KOP[knoop.data?.soort] || KWANTOR_KOP["alle"];
    regels.push(`${inspring}- ${kopZin}`);
    for (const kind of uit(knoop.id, "tak")) boom(kind, diepte + 1, regels);
  };

  for (const kaart of elementen.filter((el) => el.elementType === "toegangsregel")) {
    const subject = uit(kaart.id, "wie")[0];
    const handeling = subject && uit(subject.id, "doet")[0];
    const gegevens = handeling && uit(handeling.id, "op")[0];
    if (!subject || !handeling || !gegevens) {
      const mist = [!subject && "subject (wie)", !handeling && "handeling (doet)", !gegevens && "gegevens (op)"]
        .filter(Boolean)
        .join(", ");
      meldingen.push(`Regel "${kaart.naam}" is onvolledig op de canvas (mist: ${mist}) — overgeslagen.`);
      continue;
    }
    const verbod = /niet|verbod/i.test(kaart.data?.modaliteit || "");
    const regels = [`  Regel "${kaart.naam}".`];
    regels.push(`    ${cap(subject.naam)} mag ${gegevens.naam}${verbod ? " niet" : ""} ${handeling.naam}`);

    const voorwaarden = uit(kaart.id, "als");
    for (const top of voorwaarden) {
      if (top.elementType === "voorwaarde" && voorwaarden.length === 1) {
        regels.push(`    als ${voorwaardeTekst(top)}`);
      } else {
        const kopZin = top.elementType === "voorwaarde" ? KWANTOR_KOP["alle"] : (KWANTOR_KOP[top.data?.soort] || KWANTOR_KOP["alle"]);
        regels.push(`    als ${kopZin}`);
        if (top.elementType === "voorwaarde") boom(top, 0, regels);
        else for (const kind of uit(top.id, "tak")) boom(kind, 0, regels);
      }
    }

    const plichten = uit(kaart.id, "waarbij");
    if (plichten.length) {
      regels.push(`    waarbij: ${plichten.map((p) => p.naam).join("; ")}.`);
    } else {
      const laatste = regels.length - 1;
      regels[laatste] = regels[laatste].endsWith(";")
        ? regels[laatste].slice(0, -1) + "."
        : regels[laatste] + ".";
    }
    blokken.push(regels.join("\n"));
  }

  if (blokken.length === 1 && !begrippen.length) {
    meldingen.push("Het diagram-model bevat geen (volledige) regels.");
  }
  return { tekst: blokken.join("\n\n") + "\n", meldingen };
}
