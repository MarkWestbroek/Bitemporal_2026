/**
 * validatie — controleert of een V3-model te tekenen is.
 *
 * Bewust ruimer dan validateV3Model.js (die spiegelt de codegen-eisen zoals
 * PascalCase en snake_case): hier weigeren we alleen wat een tekening
 * onmogelijk of misleidend maakt. De eerste fout wordt een 422 die zegt wélk
 * element het is (`element`) en waar het staat (`pad`).
 */
import { ongeldigModel } from "./fout.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNaam = (v) => typeof v === "string" && v.trim() !== "";

function lijst(ouder, sleutel, pad, element) {
  const v = ouder[sleutel];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw ongeldigModel(`'${sleutel}' moet een lijst zijn.`, element, pad);
  return v;
}

export function valideerV3(model) {
  if (!isObject(model)) throw ongeldigModel("Het model ontbreekt of is geen JSON-object.", "", "");

  const entiteiten = lijst(model, "entiteiten", "entiteiten", model.naam || "model");
  if (entiteiten.length === 0) throw ongeldigModel("Het model bevat geen entiteiten.", model.naam || "model", "entiteiten");

  const typenamen = new Set();
  entiteiten.forEach((ent, i) => {
    const pad = `entiteiten[${i}]`;
    if (!isObject(ent)) throw ongeldigModel(`Entiteit ${i + 1} is geen object.`, pad, pad);
    if (!isNaam(ent.typenaam)) throw ongeldigModel(`Entiteit ${i + 1} heeft geen typenaam.`, pad, `${pad}.typenaam`);
    if (typenamen.has(ent.typenaam)) {
      throw ongeldigModel(`Entiteit '${ent.typenaam}' komt meer dan één keer voor.`, ent.typenaam, `${pad}.typenaam`);
    }
    typenamen.add(ent.typenaam);
  });

  entiteiten.forEach((ent, i) => {
    const pad = `entiteiten[${i}]`;
    if (ent.erft !== undefined && ent.erft !== "" && !typenamen.has(ent.erft)) {
      throw ongeldigModel(`Entiteit '${ent.typenaam}' erft van onbekende entiteit '${ent.erft}'.`, ent.typenaam, `${pad}.erft`);
    }
    lijst(ent, "gegevenselementen", `${pad}.gegevenselementen`, ent.typenaam).forEach((ge, j) => {
      const gpad = `${pad}.gegevenselementen[${j}]`;
      if (!isObject(ge) || !isNaam(ge.naam)) {
        throw ongeldigModel(`Gegevenselement ${j + 1} van '${ent.typenaam}' heeft geen naam.`, ent.typenaam, `${gpad}.naam`);
      }
      valideerVelden(ge, `${ent.typenaam}.${ge.naam}`, gpad);
    });
    lijst(ent, "relaties", `${pad}.relaties`, ent.typenaam).forEach((rel, j) => {
      const rpad = `${pad}.relaties[${j}]`;
      if (!isObject(rel) || !isNaam(rel.naam)) {
        throw ongeldigModel(`Relatie ${j + 1} van '${ent.typenaam}' heeft geen naam.`, ent.typenaam, `${rpad}.naam`);
      }
      if (isNaam(rel.doelEntiteit) && !typenamen.has(rel.doelEntiteit)) {
        throw ongeldigModel(
          `Relatie '${rel.naam}' van '${ent.typenaam}' verwijst naar onbekende entiteit '${rel.doelEntiteit}'.`,
          rel.naam,
          `${rpad}.doelEntiteit`,
        );
      }
      valideerVelden(rel, rel.naam, rpad);
    });
  });

  lijst(model, "enums", "enums", "enums").forEach((en, i) => {
    if (!isObject(en) || !isNaam(en.goType)) throw ongeldigModel(`Enumeratie ${i + 1} heeft geen goType.`, `enums[${i}]`, `enums[${i}].goType`);
    lijst(en, "waarden", `enums[${i}].waarden`, en.goType);
  });
  lijst(model, "datatypes", "datatypes", "datatypes").forEach((dt, i) => {
    if (!isObject(dt) || !isNaam(dt.naam)) throw ongeldigModel(`Datatype ${i + 1} heeft geen naam.`, `datatypes[${i}]`, `datatypes[${i}].naam`);
  });
  lijst(model, "diagrammen", "diagrammen", "diagrammen").forEach((d, i) => {
    const pad = `diagrammen[${i}]`;
    if (!isObject(d) || !isNaam(d.naam)) throw ongeldigModel(`Diagram ${i + 1} heeft geen naam.`, pad, `${pad}.naam`);
    lijst(d, "nodes", `${pad}.nodes`, d.naam).forEach((n, j) => {
      if (!isObject(n) || !isNaam(n.elementId)) {
        throw ongeldigModel(`Diagram '${d.naam}': node ${j + 1} heeft geen elementId.`, d.naam, `${pad}.nodes[${j}].elementId`);
      }
    });
  });
  lijst(model, "domeinen", "domeinen", "domeinen");
  lijst(model, "notities", "notities", "notities");
  lijst(model, "constraints", "constraints", "constraints");
}

function valideerVelden(ouder, element, pad) {
  lijst(ouder, "velden", `${pad}.velden`, element).forEach((v, k) => {
    if (!isObject(v) || !isNaam(v.naam)) throw ongeldigModel(`Veld ${k + 1} van '${element}' heeft geen naam.`, element, `${pad}.velden[${k}].naam`);
  });
}
