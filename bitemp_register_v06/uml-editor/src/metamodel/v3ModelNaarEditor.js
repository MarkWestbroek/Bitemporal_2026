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
    verplicht: !(v3Veld.goType || "").startsWith("*"),
    autoIncrement: false,
    description: v3Veld.description || "",
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
      position: { x: 50 + i * 220, y: 550 },
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
      position: { x: 500 + i * 280, y: 650 },
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
      position: { x: entIdx * 500, y: 50 },
      data: {
        typenaam: ent.typenaam,
        description: ent.description || "",
        metatype: "entiteit",
        isMaterieel: ent.isMaterieel || false,
        kleur: ent.kleur || defaultKleur("entiteit"),
        velden: [],
      },
    });

    (ent.gegevenselementen || []).forEach((ge, geIdx) => {
      const geTypenaam = `${ent.typenaam}_${ge.naam}`;
      const velden = (ge.velden || []).map((v) => convertV3Veld(v, enumLookup, datatypeLookup));

      nodes.push({
        id: geTypenaam,
        type: "gegevenselement",
        position: {
          x: entIdx * 500 - 150 + geIdx * 250,
          y: 300,
        },
        data: {
          typenaam: geTypenaam,
          description: ge.description || "",
          metatype: "gegevenselement",
          isMaterieel: ge.isMaterieel || false,
          kleur: defaultKleur("gegevenselement"),
          velden,
        },
      });

      edges.push({
        id: `${ent.typenaam}->${geTypenaam}`,
        source: ent.typenaam,
        target: geTypenaam,
        type: "metamodel",
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
      });
    });

    (ent.relaties || []).forEach((rel) => {
      if (!nodes.find((n) => n.id === rel.naam)) {
        const velden = (rel.velden || []).map((v) => convertV3Veld(v, enumLookup, datatypeLookup));

        nodes.push({
          id: rel.naam,
          type: "relatie",
          position: {
            x: entIdx * 500 + 200,
            y: 170,
          },
          data: {
            typenaam: rel.naam,
            description: rel.description || "",
            metatype: "relatie",
            isMaterieel: rel.isMaterieel || false,
            kleur: defaultKleur("relatie"),
            velden,
            doelEntiteit: rel.doelEntiteit || "",
          },
        });
      }

      edges.push({
        id: `${ent.typenaam}->${rel.naam}`,
        source: ent.typenaam,
        target: rel.naam,
        type: "metamodel",
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
      });

      if (rel.doelEntiteit) {
        edges.push({
          id: `${rel.naam}->${rel.doelEntiteit}`,
          source: rel.naam,
          target: rel.doelEntiteit,
          type: "metamodel",
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
