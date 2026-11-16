// 03b — de beslistabellen op de beslissingen Risicoklasse en Leges. Een plan kent alleen platte
// eigenschappen; de tabel (kolommen en regels) gaat daarom als rechtstreekse operatie.
// Vorm: dmn/dmnModel.js (zoals fixtures/cg-test/gpk-beslissingen.dmn-model.json). De invoerkolommen
// binden aan velden van de cm-entiteit Evenementaanvraag (fieldRef); een cel is een waarde, een
// vergelijking (>= 5000) of leeg (elke waarde).
const veld = (naam) => ({ veldpad: `Evenementaanvraag.Evenementgegevens.${naam}`, veldnaam: naam });

const RISICO = {
  naam: "Risicoklasse",
  hitPolicy: "FIRST",
  inputs: [
    { id: "in_bezoekers", naam: "verwachtAantalBezoekers", label: "Verwacht aantal bezoekers", type: "number", fieldRef: veld("verwachtAantalBezoekers") },
    { id: "in_weg", naam: "wegafsluiting", label: "Wegafsluiting", type: "boolean", fieldRef: veld("wegafsluiting") },
    { id: "in_alcohol", naam: "alcohol", label: "Alcohol", type: "boolean", fieldRef: veld("alcohol") },
    { id: "in_geluid", naam: "versterktGeluid", label: "Versterkt geluid", type: "boolean", fieldRef: veld("versterktGeluid") },
  ],
  outputs: [
    { id: "out_klasse", naam: "risicoklasse", label: "Risicoklasse", type: "string", adhoc: true },
    { id: "out_route", naam: "route", label: "Behandelroute", type: "string", adhoc: true },
  ],
  rules: [
    { id: "r_groot", toelichting: "Een groot evenement vraagt altijd advies van brandweer en politie.", inputEntries: { in_bezoekers: ">= 5000" }, outputEntries: { out_klasse: '"C"', out_route: '"vergunning met veiligheidsadvies"' } },
    { id: "r_druk_alcohol", toelichting: "Veel bezoekers en alcohol: verhoogd risico.", inputEntries: { in_bezoekers: ">= 2000", in_alcohol: "true" }, outputEntries: { out_klasse: '"C"', out_route: '"vergunning met veiligheidsadvies"' } },
    { id: "r_weg", toelichting: "Een wegafsluiting raakt de openbare orde en het verkeer.", inputEntries: { in_weg: "true" }, outputEntries: { out_klasse: '"B"', out_route: '"reguliere vergunning"' } },
    { id: "r_middel", toelichting: "Vanaf 250 bezoekers is een vergunning nodig.", inputEntries: { in_bezoekers: ">= 250" }, outputEntries: { out_klasse: '"B"', out_route: '"reguliere vergunning"' } },
    { id: "r_alcohol", toelichting: "Alcohol schenken buiten een horecabedrijf.", inputEntries: { in_alcohol: "true" }, outputEntries: { out_klasse: '"B"', out_route: '"reguliere vergunning"' } },
    { id: "r_klein", toelichting: "Klein evenement: een melding volstaat (APV art. 2:25 lid 2).", inputEntries: {}, outputEntries: { out_klasse: '"A"', out_route: '"melding"' } },
  ],
};

const LEGES = {
  naam: "Leges",
  hitPolicy: "UNIQUE",
  inputs: [
    { id: "in_klasse", naam: "risicoklasse", label: "Risicoklasse", type: "string" },
    { id: "in_commercieel", naam: "commercieel", label: "Commercieel", type: "boolean", fieldRef: veld("commercieel") },
  ],
  outputs: [{ id: "out_leges", naam: "leges", label: "Leges (euro)", type: "number", adhoc: true }],
  rules: [
    { id: "l_melding", toelichting: "Een melding is gratis.", inputEntries: { in_klasse: '"A"' }, outputEntries: { out_leges: "0" } },
    { id: "l_b", toelichting: "Reguliere vergunning, niet commercieel.", inputEntries: { in_klasse: '"B"', in_commercieel: "false, null" }, outputEntries: { out_leges: "75" } },
    { id: "l_b_comm", toelichting: "Reguliere vergunning, commercieel.", inputEntries: { in_klasse: '"B"', in_commercieel: "true" }, outputEntries: { out_leges: "150" } },
    { id: "l_c", toelichting: "Vergunning met advies, niet commercieel.", inputEntries: { in_klasse: '"C"', in_commercieel: "false, null" }, outputEntries: { out_leges: "350" } },
    { id: "l_c_comm", toelichting: "Vergunning met advies, commercieel.", inputEntries: { in_klasse: '"C"', in_commercieel: "true" }, outputEntries: { out_leges: "900" } },
  ],
};

export default (proj, { zoek }) => {
  const zet = {};
  for (const [naam, tabel] of [["Risicoklasse", RISICO], ["Leges", LEGES]]) {
    const el = zoek("dmnDrd05", naam, "decision");
    zet[el.id] = { ...el, data: { ...el.data, beslistabel: tabel } };
  }
  return [{ store: "model:dmnDrd05", op: "patchElementen", args: [{ zet, wis: [] }] }];
};
