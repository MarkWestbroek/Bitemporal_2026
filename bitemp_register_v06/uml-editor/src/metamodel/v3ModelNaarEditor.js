import { defaultKleur } from "./types";

function goTypeNaarVeldType(goType) {
  const t = goType.startsWith("*") ? goType.slice(1) : goType;
  switch (t) {
    case "string":
      return { type: "string", format: "" };
    case "int":
    case "int32":
    case "int64":
      return { type: "integer", format: "" };
    case "float32":
    case "float64":
      return { type: "number", format: "float64" };
    case "bool":
      return { type: "boolean", format: "" };
    case "Date":
      return { type: "string", format: "date" };
    case "time.Time":
      return { type: "string", format: "date-time" };
    default:
      return { type: "string", format: "" };
  }
}

function convertV3Veld(v3Veld, enumLookup, datatypeLookup) {
  const datatype = datatypeLookup[v3Veld.goType];
  const mapped = goTypeNaarVeldType(v3Veld.goType || "string");
  const type = datatype?.basistype || mapped.type;
  const format = datatype?.format || mapped.format;
  const enumWaarden = v3Veld.enum ? enumLookup[v3Veld.enum] || null : null;

  return {
    naam: v3Veld.naam,
    type,
    format,
    datatypeNaam: datatype?.naam || null,
    enum: enumWaarden,
    enumNaam: v3Veld.enum || null,
    refItemNaam: v3Veld.refItemNaam || null,
    verplicht: !(v3Veld.goType || "").startsWith("*"),
    autoIncrement: false,
    description: v3Veld.description || "",
    afgeleid: v3Veld.afgeleid || false,
    afleidingsregelTaal: v3Veld.afleidingsregelTaal || "cel",
    afleidingsregel: v3Veld.afleidingsregel || "",
  };
}

export function v3ModelNaarEditor(v3Model) {
  const nodes = [];
  const edges = [];

  const enumLookup = {};
  (v3Model.enums || []).forEach((e) => {
    enumLookup[e.goType] = (e.waarden || []).map((w) => w.waarde);
  });

  const datatypeLookup = {};
  (v3Model.datatypes || []).forEach((dt) => {
    datatypeLookup[dt.naam] = dt;
  });

  (v3Model.enums || []).forEach((e, i) => {
    nodes.push({
      id: `enum_${e.goType}`,
      type: "enumeratie",
      position: e.positie ? { x: e.positie.x, y: e.positie.y } : { x: 50 + i * 220, y: 550 },
      data: {
        naam: e.goType,
        baseType: e.baseType || "string",
        waarden: (e.waarden || []).map((w) => w.waarde),
      },
    });
  });

  (v3Model.datatypes || []).forEach((dt, i) => {
    nodes.push({
      id: `dt_${dt.naam}`,
      type: "gegevenstype",
      position: dt.positie ? { x: dt.positie.x, y: dt.positie.y } : { x: 500 + i * 280, y: 650 },
      data: {
        naam: dt.naam,
        description: dt.description || "",
        basistype: dt.basistype || "string",
        format: dt.format || "",
        validatie: dt.validatie || {},
        normalisatie: dt.normalisatie || "",
        weergave: dt.weergave || {},
      },
    });
  });

  const entiteiten = v3Model.entiteiten || [];

  entiteiten.forEach((ent, entIdx) => {
    nodes.push({
      id: ent.typenaam,
      type: "entiteit",
      position: ent.positie ? { x: ent.positie.x, y: ent.positie.y } : { x: entIdx * 500, y: 50 },
      data: {
        typenaam: ent.typenaam,
        klassenaam: ent.typenaam,
        description: ent.description || "",
        meervoud: ent.meervoud || "",
        metatype: "entiteit",
        isMaterieel: ent.isMaterieel || false,
        // Referentielijst-subtypes (zie Referentielijsten.md)
        entiteitSubtype: ent.entiteitSubtype || "",
        kleur: ent.kleur || defaultKleur("entiteit", ent.entiteitSubtype || ""),
        velden: [],
        afgeleideVelden: (ent.afgeleideVelden || []).map((av) => ({
          naam: av.naam || "",
          description: av.description || "",
          goType: av.goType || "string",
          afleidingsregelTaal: av.afleidingsregelTaal || "cel",
          afleidingsregel: av.afleidingsregel || "",
          isWeergaveVeld: av.isWeergaveVeld || av.weergaveVeld || false,
        })),
      },
    });

    (ent.gegevenselementen || []).forEach((ge, geIdx) => {
      const geTypenaam = `${ent.typenaam}_${ge.naam}`;
      const velden = (ge.velden || []).map((v) => convertV3Veld(v, enumLookup, datatypeLookup));

      nodes.push({
        id: geTypenaam,
        type: "gegevenselement",
        position: ge.positie
          ? { x: ge.positie.x, y: ge.positie.y }
          : { x: entIdx * 500 - 150 + geIdx * 250, y: 300 },
        data: {
          typenaam: geTypenaam,
          klassenaam: ge.naam,
          description: ge.description || "",
          meervoud: ge.meervoud || "",
          metatype: "gegevenselement",
          isMaterieel: ge.isMaterieel || false,
          kleur: defaultKleur("gegevenselement"),
          velden,
          afgeleideVelden: (ge.afgeleideVelden || []).map((av) => ({
            naam: av.naam || "",
            description: av.description || "",
            goType: av.goType || "string",
            afleidingsregelTaal: av.afleidingsregelTaal || "cel",
            afleidingsregel: av.afleidingsregel || "",
            isWeergaveVeld: av.isWeergaveVeld || av.weergaveVeld || false,
          })),
        },
      });

      edges.push({
        id: ge.id || `${ent.typenaam}->${geTypenaam}`,
        source: ent.typenaam,
        target: geTypenaam,
        type: "metamodel",
        sourceHandle: ge.sourceHandle || null,
        targetHandle: ge.targetHandle || null,
        data: {
          rolnaam: ge.naam,
          jsonRolnaam: ge.meervoud || ge.naam.toLowerCase(),
          momentvoorkomen: ge.momentvoorkomen || "enkelvoudig",
          kardinaliteit: ge.momentvoorkomen === "meervoudig" ? "0..*" : "0..1",
        },
      });

      (ge.velden || []).forEach((v) => {
        if (v.enum) {
          edges.push({
            id: `${geTypenaam}-->${v.enum}`,
            source: geTypenaam,
            target: `enum_${v.enum}`,
            type: "metamodel",
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
        // Dependency edge naar referentielijst_item entiteit
        if (v.refItemNaam) {
          edges.push({
            id: `${geTypenaam}-->${v.refItemNaam}`,
            source: geTypenaam,
            target: v.refItemNaam,
            type: "metamodel",
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
      });
    });

    (ent.relaties || []).forEach((rel) => {
      if (!nodes.find((n) => n.id === rel.naam)) {
        const velden = (rel.velden || []).map((v) => convertV3Veld(v, enumLookup, datatypeLookup));

        nodes.push({
          id: rel.naam,
          type: "relatie",
          position: rel.positie
            ? { x: rel.positie.x, y: rel.positie.y }
            : { x: entIdx * 500 + 200, y: 170 },
          data: {
            typenaam: rel.naam,
            klassenaam: rel.naam,
            description: rel.description || "",
            meervoud: rel.meervoud || "",
            metatype: "relatie",
            isMaterieel: rel.isMaterieel || false,
            // Referentielijst-subtypes (zie Referentielijsten.md)
            relatieSubtype: rel.relatieSubtype || "",
            kleur: defaultKleur("relatie", rel.relatieSubtype || ""),
            velden,
            afgeleideVelden: (rel.afgeleideVelden || []).map((av) => ({
              naam: av.naam || "",
              description: av.description || "",
              goType: av.goType || "string",
              afleidingsregelTaal: av.afleidingsregelTaal || "cel",
              afleidingsregel: av.afleidingsregel || "",
              isWeergaveVeld: av.isWeergaveVeld || av.weergaveVeld || false,
            })),
            doelEntiteit: rel.doelEntiteit || "",
          },
        });
      }

      edges.push({
        id: rel.id || `${ent.typenaam}->${rel.naam}`,
        source: ent.typenaam,
        target: rel.naam,
        type: "metamodel",
        sourceHandle: rel.sourceHandle || null,
        targetHandle: rel.targetHandle || null,
        data: {
          rolnaam: rel.naam,
          jsonRolnaam: rel.meervoud || rel.naam.toLowerCase(),
          momentvoorkomen: rel.momentvoorkomen || "meervoudig",
          kardinaliteit: rel.momentvoorkomen === "meervoudig" ? "0..*" : "0..1",
        },
      });

      (rel.velden || []).forEach((v) => {
        if (v.enum) {
          edges.push({
            id: `${rel.naam}-->${v.enum}`,
            source: rel.naam,
            target: `enum_${v.enum}`,
            type: "metamodel",
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
        // Dependency edge naar referentielijst_item entiteit
        if (v.refItemNaam) {
          edges.push({
            id: `${rel.naam}-->${v.refItemNaam}`,
            source: rel.naam,
            target: v.refItemNaam,
            type: "metamodel",
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
      });

      if (rel.doelEntiteit) {
        edges.push({
          id: rel.doelId || `${rel.naam}->${rel.doelEntiteit}`,
          source: rel.naam,
          target: rel.doelEntiteit,
          type: "metamodel",
          sourceHandle: rel.doelSourceHandle || null,
          targetHandle: rel.doelTargetHandle || null,
          data: {
            rolnaam: `→ ${rel.doelEntiteit}`,
            jsonRolnaam: rel.doelEntiteit.toLowerCase(),
            momentvoorkomen: "meervoudig",
            kardinaliteit: "0..*",
          },
        });
      }
    });
  });

  return { nodes, edges };
}
