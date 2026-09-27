/**
 * masker.js — de rekenkant van de vorm `masked`: een invoermasker zoals het datatype het
 * noemt (`weergave.inputMask`, bv. NLPostcode "0000 AA", BSN "000000000"). Puur.
 *
 * Maskertekens:
 *   0  een cijfer
 *   A  een letter (wordt hoofdletter)
 *   a  een letter (zoals getypt)
 *   *  een letter of cijfer (letters worden hoofdletter)
 *   \  het volgende teken letterlijk (bv. "\0")
 *   al het andere: letterlijk (spatie, koppelteken, punt, …); wordt automatisch ingevoegd.
 *
 * Opslag: standaard ZONDER de letterlijke tekens ("1234AB"), omdat patronen in het model die
 * vaak niet verwachten (IBAN). Met `keepLiterals` mét ("1234 AB").
 */

/** Masker → lijst posities: { soort: "0"|"A"|"a"|"*" } of { letterlijk: "x" }. */
export function leesMasker(masker) {
  const uit = [];
  const s = String(masker || "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) uit.push({ letterlijk: s[++i] });
    else if (c === "0" || c === "A" || c === "a" || c === "*") uit.push({ soort: c });
    else uit.push({ letterlijk: c });
  }
  return uit;
}

const pastOp = (soort, c) =>
  soort === "0" ? /\d/.test(c) : soort === "A" || soort === "a" ? /\p{L}/u.test(c) : /[\p{L}\d]/u.test(c);
const vorm = (soort, c) => (soort === "A" || soort === "*" ? c.toUpperCase() : c);

/**
 * Pas het masker toe op wat de gebruiker typte (of een opgeslagen waarde).
 * @returns {{ weergave: string, ruw: string, compleet: boolean }}
 *   weergave = met letterlijke tekens (voor het invoerveld), ruw = zonder, compleet = alle
 *   posities gevuld. Tekens die niet passen worden overgeslagen; letterlijke tekens die de
 *   gebruiker zelf typt ook.
 */
export function pasMaskerToe(invoer, masker) {
  const posities = leesMasker(masker);
  const tekens = [...String(invoer ?? "")];
  let weergave = "", ruw = "", t = 0, gevuld = 0;
  const invulbaar = posities.filter((p) => p.soort).length;
  for (const p of posities) {
    if (p.letterlijk !== undefined) {
      // Alleen invoegen als er nog iets volgt, zodat backspace over een spatie heen werkt.
      if (t < tekens.length) {
        weergave += p.letterlijk;
        if (tekens[t] === p.letterlijk) t++;
      }
      continue;
    }
    while (t < tekens.length && !pastOp(p.soort, tekens[t])) t++;
    if (t >= tekens.length) break;
    const c = vorm(p.soort, tekens[t++]);
    weergave += c;
    ruw += c;
    gevuld++;
  }
  return { weergave, ruw, compleet: invulbaar > 0 && gevuld === invulbaar };
}

/** De waarde die opgeslagen wordt. */
export function maskerWaarde(invoer, masker, keepLiterals = false) {
  const r = pasMaskerToe(invoer, masker);
  return keepLiterals ? r.weergave : r.ruw;
}

/** De placeholder uit het masker: "0000 AA" → "____ __". */
export function maskerPlaceholder(masker) {
  return leesMasker(masker).map((p) => (p.letterlijk !== undefined ? p.letterlijk : "_")).join("");
}
