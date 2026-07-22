/**
 * odrl.js — Beleid-AST → ODRL JSON-LD (NLGov-subset).
 *
 * De afbeelding volgt docs/plans/ODRL-Register-Toegangsbeleid.md:
 *   mag / mag niet  → Permission / Prohibition
 *   wie             → assignee (PartyCollection met refinement)
 *   wat             → target (Asset / AssetCollection, nlgov:register-pad)
 *   als             → constraint (LogicalConstraint bij of/xof en nesting)
 *   waarbij         → duty
 *   Geldig vanaf/tot→ nlgov:geldigVanaf/geldigTot (transport naar de materiële
 *                     tijd van het bitemporele register, geen constraint)
 * Conflictregel vast: verbod gaat vóór toestemming, default deny.
 */
import { vindActie, vindOperator } from "./operatoren.js";
import { verwijzingNaarPad, verwijzingNaarGroepPad } from "./parser.js";
import { slug, woordenNaarVeldnaam } from "./woorden.js";

const NLGOV_CONTEXT = { nlgov: "https://standaarden.overheid.nl/odrl/terms/" };
const PROFIEL = "https://standaarden.overheid.nl/odrl/profile/toegangsbeleid";

/** Kern-ODRL-operatoren zonder prefix (zoals in de ODRL-voorbeelden), profieltermen mét. */
function operatorNaam(canoniek) {
  const op = vindOperator(canoniek);
  const odrl = op ? op.odrl : `nlgov:${canoniek}`;
  return odrl.startsWith("odrl:") ? odrl.slice(5) : odrl;
}

/** Keten (buiten-naar-binnen) → subpad "naam.achternaam". */
function ketenNaarSubpad(keten) {
  return keten
    .slice()
    .reverse()
    .map((groep) => woordenNaarVeldnaam(groep.woorden))
    .join(".");
}

/** Verwijzing → leftOperand-/operand-IRI. */
function operandId(verwijzing) {
  const { basis, keten } = verwijzing;
  if (basis.soort === "type") {
    // Een door metamodel.js geresolved pad (juiste casing, verkorte keten
    // aangevuld) wint van de naïeve afleiding.
    return `nlgov:veldwaarde:${verwijzing.pad || verwijzingNaarPad(verwijzing)}`;
  }
  const subpad = ketenNaarSubpad(keten);
  if (basis.anker === "aanvraag") {
    // Vaste contextbegrippen uit het NLGov-profiel.
    if (subpad === "doel") return "nlgov:doelbinding";
    if (subpad === "grondslag") return "nlgov:grondslag";
    if (subpad === "tijdstip") return "odrl:dateTime";
    return subpad ? `nlgov:aanvraag:${subpad}` : "nlgov:aanvraag";
  }
  const basisIri = { aanvrager: "nlgov:aanvrager", gegevens: "nlgov:veldwaarde", betrokkene: "nlgov:betrokkene" }[basis.anker];
  return subpad ? `${basisIri}:${subpad}` : basisIri;
}

function termNaarRechts(term) {
  if (term.soort === "literal") {
    if (term.type === "datum") return { "@value": term.waarde, "@type": "xsd:date" };
    return term.waarde;
  }
  return { "@id": operandId(term) };
}

function constraintVanVoorwaarde(v) {
  const constraint = {
    leftOperand: { "@id": operandId(v.links) },
    operator: operatorNaam(v.operator),
  };
  const op = vindOperator(v.operator);
  if (op?.unair) return constraint;
  if (op?.lijst) {
    constraint.rightOperand = v.lijst.map(termNaarRechts);
  } else if (op?.tussen) {
    constraint.rightOperand = [termNaarRechts(v.rechts), termNaarRechts(v.rechts2)];
  } else {
    constraint.rightOperand = termNaarRechts(v.rechts);
  }
  return constraint;
}

/** Genest blok → LogicalConstraint-object. */
function blokNaarLogical(blok) {
  const sleutel = { en: "and", of: "or", xof: "xone" }[blok.soort];
  return { [sleutel]: { "@list": blok.items.map(itemNaarConstraint) } };
}

function itemNaarConstraint(item) {
  return item.soort === "voorwaarde" ? constraintVanVoorwaarde(item) : blokNaarLogical(item);
}

/**
 * Topniveau: een en-blok wordt een platte constraint-array (ODRL: meerdere
 * constraints gelden allemaal); of/xof wordt één LogicalConstraint.
 */
function voorwaardenNaarConstraints(voorwaarden) {
  if (!voorwaarden) return [];
  if (voorwaarden.soort === "voorwaarde") return [constraintVanVoorwaarde(voorwaarden)];
  if (voorwaarden.soort === "en") return voorwaarden.items.map(itemNaarConstraint);
  return [blokNaarLogical(voorwaarden)];
}

function kenmerkenNaarRefinement(kenmerken) {
  return kenmerken.map((k) => ({
    leftOperand: { "@id": `nlgov:${woordenNaarVeldnaam(k.kenmerk.split(" "))}` },
    operator: "eq",
    rightOperand: k.waarde,
  }));
}

function watNaarTarget(wat, watBegrippen) {
  if (wat.soort === "begrip") {
    return watBegrippen.get(wat.naam.toLowerCase()) || null;
  }
  if (wat.soort === "alle") {
    const pad = wat.verwijzing.pad || verwijzingNaarGroepPad(wat.verwijzing);
    // Anker-basis ("alle gegevens van de betrokkene") heeft geen registerpad.
    const uid = pad ? `nlgov:register:${pad}` : `nlgov:${wat.verwijzing.basis.anker}`;
    return { "@type": "Asset", uid };
  }
  return { "@type": "Asset", uid: `nlgov:register:${wat.pad || verwijzingNaarPad(wat)}` };
}

function wieNaarAssignee(wie, wieBegrippen) {
  if (wie.soort === "iemand") {
    return { "@type": "PartyCollection", refinement: kenmerkenNaarRefinement(wie.kenmerken) };
  }
  const bekend = wieBegrippen.get(wie.naam.toLowerCase());
  if (bekend) return bekend;
  // Niet gedefinieerd begrip = impliciete rol met dezelfde naam.
  return {
    "@type": "PartyCollection",
    uid: `urn:nlgov:rolgroep:${slug(wie.naam)}`,
    refinement: [{ leftOperand: { "@id": "nlgov:rol" }, operator: "eq", rightOperand: wie.naam }],
  };
}

/** Beleid-AST → ODRL JSON-LD document (NLGov-profiel). */
export function naarOdrl(beleid) {
  const wieBegrippen = new Map();
  const watBegrippen = new Map();
  for (const begrip of beleid.begrippen) {
    if (begrip.soort === "wie") {
      wieBegrippen.set(begrip.naam.toLowerCase(), {
        "@type": "PartyCollection",
        uid: `urn:nlgov:rolgroep:${slug(begrip.naam)}`,
        refinement: kenmerkenNaarRefinement(begrip.kenmerken),
      });
    } else {
      const basis = watNaarTarget(begrip.wat, watBegrippen);
      const collectie = {
        "@type": "AssetCollection",
        uid: `urn:nlgov:gegevens:${slug(begrip.naam)}`,
        source: basis?.uid || null,
      };
      if (begrip.waarvan) collectie.refinement = [constraintVanVoorwaarde(begrip.waarvan)];
      watBegrippen.set(begrip.naam.toLowerCase(), collectie);
    }
  }

  const doc = {
    "@context": ["http://www.w3.org/ns/odrl.jsonld", NLGOV_CONTEXT],
    "@type": "Set",
    uid: `urn:nlgov:beleid:${slug(beleid.naam)}`,
    profile: PROFIEL,
    conflict: "prohibit",
    "dc:description": beleid.naam,
  };
  if (beleid.geldigVanaf) doc["nlgov:geldigVanaf"] = beleid.geldigVanaf;
  if (beleid.geldigTot) doc["nlgov:geldigTot"] = beleid.geldigTot;
  if (beleid.grondslag) doc["nlgov:grondslag"] = beleid.grondslag;
  if (beleid.doel) doc["nlgov:doelbinding"] = beleid.doel;

  const permissions = [];
  const prohibitions = [];
  for (const regel of beleid.regels) {
    const entry = {
      "nlgov:regelnaam": regel.naam,
      target: watNaarTarget(regel.wat, watBegrippen),
      assignee: wieNaarAssignee(regel.wie, wieBegrippen),
      action: { "@id": vindActie(regel.actie)?.nlgov || `nlgov:${regel.actie}` },
    };
    const constraints = voorwaardenNaarConstraints(regel.voorwaarden);
    if (constraints.length) entry.constraint = constraints;
    if (regel.plichten.length) {
      entry.duty = regel.plichten.map((p) => ({ action: { "@id": p.nlgov } }));
    }
    (regel.verbod ? prohibitions : permissions).push(entry);
  }
  if (permissions.length) doc.permission = permissions;
  if (prohibitions.length) doc.prohibition = prohibitions;
  return doc;
}
