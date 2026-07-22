/**
 * renderer.js — AST → canonieke Toegangsspraak-tekst.
 *
 * De renderer is de omgekeerde afbeelding van de parser en levert de canonieke
 * schrijfwijze (van-vorm, vaste insprong, vaste interpunctie). Round-trip-eis:
 *   renderBeleid(parseBeleid(t).beleid) is de canonieke schrijfwijze van t, en
 *   parseBeleid(renderBeleid(b)).beleid is structureel gelijk aan b.
 */
import { vindOperator } from "./operatoren.js";
import { isoNaarNlDatum } from "./woorden.js";

const KWANTOR_KOP = {
  en: "aan alle volgende voorwaarden is voldaan:",
  of: "aan ten minste één van de volgende voorwaarden is voldaan:",
  xof: "aan precies één van de volgende voorwaarden is voldaan:",
};

function cap(tekst) {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

function renderGroep(groep) {
  return `${groep.lidwoord} ${groep.woorden.join(" ")}`;
}

/** Verwijzing-AST → van-vorm: "de achternaam van de naam van een natuurlijk persoon". */
export function renderVerwijzing(verwijzing) {
  const delen = verwijzing.keten.map(renderGroep);
  const basis = verwijzing.basis;
  delen.push(
    basis.soort === "anker"
      ? `${basis.lidwoord} ${basis.anker}`
      : renderGroep(basis)
  );
  return delen.join(" van ");
}

function renderKenmerken(kenmerken) {
  return kenmerken.map((k) => `${k.kenmerk} "${k.waarde}"`).join(" en ");
}

function renderWie(wie) {
  if (wie.soort === "iemand") return `iemand met ${renderKenmerken(wie.kenmerken)}`;
  return `${wie.lidwoord} ${wie.naam}`;
}

function renderWat(wat) {
  if (wat.soort === "begrip") return wat.lidwoord ? `${wat.lidwoord} ${wat.naam}` : wat.naam;
  if (wat.soort === "alle") return `alle gegevens van ${renderVerwijzing(wat.verwijzing)}`;
  return renderVerwijzing(wat);
}

function renderTerm(term) {
  if (term.soort === "literal") {
    if (term.type === "tekst") return `"${term.waarde}"`;
    if (term.type === "datum") return isoNaarNlDatum(term.waarde);
    return String(term.waarde);
  }
  return renderVerwijzing(term);
}

/**
 * Voorwaarde → tekst, in twee woordvolgordes:
 *   "stelling" (opsommingen): de taal van een trefwoord is niet "nl"
 *   "bijzin"   (na als/waarvan): de taal van een trefwoord niet "nl" is
 * In de bijzinsvorm schuift het werkwoord (eerste woord van de operator-zin)
 * naar het einde — correcte Nederlandse bijzinsvolgorde.
 */
export function renderVoorwaarde(voorwaarde, vorm = "stelling") {
  const op = vindOperator(voorwaarde.operator);
  const zin = op ? op.zin : voorwaarde.operator;
  const links = renderTerm(voorwaarde.links);
  const rechtsdelen = op?.lijst
    ? `(${voorwaarde.lijst.map(renderTerm).join(", ")})`
    : op?.tussen
      ? `${renderTerm(voorwaarde.rechts)} en ${renderTerm(voorwaarde.rechts2)}`
      : op?.unair
        ? ""
        : renderTerm(voorwaarde.rechts);

  if (vorm === "bijzin" && op) {
    const [werkwoord, ...rest] = zin.split(" ");
    return [links, ...rest, rechtsdelen, werkwoord].filter(Boolean).join(" ");
  }
  return [links, zin, rechtsdelen].filter(Boolean).join(" ");
}

/**
 * Voorwaardeblok → regels tekst. `indent` is de insprong van de bullets;
 * geneste blokken springen twee spaties verder in.
 */
function renderBlok(blok, indent, regels) {
  for (const item of blok.items) {
    if (item.soort === "voorwaarde") {
      regels.push(`${" ".repeat(indent)}- ${renderVoorwaarde(item)};`);
    } else {
      regels.push(`${" ".repeat(indent)}- ${KWANTOR_KOP[item.soort]}`);
      renderBlok(item, indent + 2, regels);
    }
  }
}

function renderRegel(regel) {
  const rgls = [];
  rgls.push(`  Regel "${regel.naam}".`);
  const kern = `${cap(renderWie(regel.wie))} mag ${renderWat(regel.wat)}${regel.verbod ? " niet" : ""} ${regel.actie}`;
  rgls.push(`    ${kern}`);

  if (regel.voorwaarden) {
    if (regel.voorwaarden.soort === "voorwaarde") {
      rgls.push(`    als ${renderVoorwaarde(regel.voorwaarden, "bijzin")}`);
    } else {
      rgls.push(`    als ${KWANTOR_KOP[regel.voorwaarden.soort]}`);
      renderBlok(regel.voorwaarden, 6, rgls);
    }
  }
  if (regel.plichten.length) {
    rgls.push(`    waarbij: ${regel.plichten.map((p) => p.zin).join("; ")}.`);
  } else {
    // De afsluitende punt komt op de laatste inhoudelijke regel.
    const laatste = rgls.length - 1;
    rgls[laatste] = rgls[laatste].endsWith(";")
      ? rgls[laatste].slice(0, -1) + "."
      : rgls[laatste] + ".";
  }
  return rgls.join("\n");
}

function renderBegrip(begrip) {
  // Onbepaalde termen ("Mail", "Inkomensgegevens") hebben geen lidwoord.
  const onderwerp = cap(begrip.lidwoord ? `${begrip.lidwoord} ${begrip.naam}` : begrip.naam);
  if (begrip.soort === "wie") {
    return `    ${onderwerp} is: iemand met ${renderKenmerken(begrip.kenmerken)}.`;
  }
  const waarvan = begrip.waarvan ? ` waarvan ${renderVoorwaarde(begrip.waarvan, "bijzin")}` : "";
  return `    ${onderwerp} ${begrip.werkwoord}: ${renderWat(begrip.wat)}${waarvan}.`;
}

/** Beleid-AST → canonieke Toegangsspraak-tekst. */
export function renderBeleid(beleid) {
  const blokken = [];

  const kop = [`Beleid "${beleid.naam}".`];
  if (beleid.geldigVanaf) {
    const tot = beleid.geldigTot ? ` tot ${isoNaarNlDatum(beleid.geldigTot)}` : "";
    kop.push(`  Geldig vanaf ${isoNaarNlDatum(beleid.geldigVanaf)}${tot}.`);
  }
  if (beleid.grondslag) kop.push(`  Grondslag: ${beleid.grondslag}.`);
  if (beleid.doel) kop.push(`  Doel: "${beleid.doel}".`);
  blokken.push(kop.join("\n"));

  if (beleid.begrippen.length) {
    blokken.push(["  Begrippen.", ...beleid.begrippen.map(renderBegrip)].join("\n"));
  }

  for (const regel of beleid.regels) {
    blokken.push(renderRegel(regel));
  }

  return blokken.join("\n\n") + "\n";
}
