import { defaultKleur } from "./types.js";

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
  // Explicit datatype reference (schema:"datatype:NLPostcode") heeft voorrang op goType lookup
  const datatype = v3Veld.datatype
    ? datatypeLookup[v3Veld.datatype]
    : datatypeLookup[v3Veld.goType];
  const mapped = goTypeNaarVeldType(v3Veld.goType || "string");
  const type = datatype?.basistype || mapped.type;
  const format = datatype?.format || mapped.format;
  const enumWaarden = v3Veld.enum ? enumLookup[v3Veld.enum] || null : null;
  // $ref naar referentielijst-items type (schema:"ref:LandenlijstLand"), analoog aan OAS 3.1 $ref
  const refNaam = v3Veld["$ref"] || null;

  return {
    naam: v3Veld.naam,
    type,
    format,
    datatypeNaam: v3Veld.datatype || datatype?.naam || null,
    enum: enumWaarden,
    enumNaam: v3Veld.enum || null,
    refNaam,
    refItemNaam: v3Veld["$ref"] || v3Veld.refItemNaam || null,
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
  const inferredEnumDomein = {};
  const noteEnumDomein = (enumNaam, domeinKandidaat) => {
    if (!enumNaam) return;
    const domein = String(domeinKandidaat || "").trim();
    if (!domein) return;
    const bestaand = inferredEnumDomein[enumNaam] || "";
    if (!bestaand || (bestaand === "register" && domein !== "register")) {
      inferredEnumDomein[enumNaam] = domein;
    }
  };
  (v3Model.entiteiten || []).forEach((ent) => {
    const entDomein = ent?.domein || "";
    (ent?.gegevenselementen || []).forEach((ge) => {
      const geDomein = ge?.domein || entDomein;
      (ge?.velden || []).forEach((v) => noteEnumDomein(v?.enum, geDomein));
    });
    (ent?.relaties || []).forEach((rel) => {
      const relDomein = rel?.domein || entDomein;
      (rel?.velden || []).forEach((v) => noteEnumDomein(v?.enum, relDomein));
    });
  });
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
        domein: e.domein || inferredEnumDomein[e.goType] || "",
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
        domein: dt.domein || "",
        basistype: dt.basistype || "string",
        format: dt.format || "",
        validatie: dt.validatie || {},
        normalisatie: dt.normalisatie || "",
        weergave: dt.weergave || {},
      },
    });
  });

  const entiteiten = v3Model.entiteiten || [];

  // Referentielijst-instanties → eigen node-type
  (v3Model.referentielijstInstanties || []).forEach((ri, i) => {
    nodes.push({
      id: `refinstantie_${ri.systeemnaam}`,
      type: "referentielijstInstantie",
      position: ri.positie
        ? { x: ri.positie.x, y: ri.positie.y }
        : { x: 800 + i * 280, y: 50 },
      data: {
        id: `refinstantie_${ri.systeemnaam}`,
        systeemnaam: ri.systeemnaam || "",
        naam: ri.naam || "",
        omschrijving: ri.omschrijving || "",
      },
    });
  });

  entiteiten.forEach((ent, entIdx) => {
    nodes.push({
      id: ent.typenaam,
      type: "entiteit",
      position: ent.positie ? { x: ent.positie.x, y: ent.positie.y } : { x: entIdx * 500, y: 50 },
      data: {
        typenaam: ent.typenaam,
        klassenaam: ent.typenaam,
        description: ent.description || "",
        domein: ent.domein || "",
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
          domein: ge.domein || ent.domein || "",
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

      // Lookup voor «use» dependency edge handles (enum/datatype/ref)
      const useEdgeMap = Object.fromEntries(
        (ge.useEdges || []).map((ue) => [ue.doel, ue])
      );

      (ge.velden || []).forEach((v) => {
        if (v.enum) {
          const ue = useEdgeMap[v.enum];
          edges.push({
            id: ue?.id || `${geTypenaam}-->${v.enum}`,
            source: geTypenaam,
            target: `enum_${v.enum}`,
            type: "metamodel",
            sourceHandle: ue?.sourceHandle || null,
            targetHandle: ue?.targetHandle || null,
            hidden: ue?.hidden || false,
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
        // Dependency edge naar gegevenstype node
        // Backward compat: oudere DB-modellen hebben geen v.datatype maar goType=datatypeNaam
        const dtNaam = v.datatype || (datatypeLookup[v.goType] ? v.goType : null);
        if (dtNaam) {
          const ue = useEdgeMap[dtNaam];
          edges.push({
            id: ue?.id || `${geTypenaam}--dt-->${dtNaam}`,
            source: geTypenaam,
            target: `dt_${dtNaam}`,
            type: "metamodel",
            sourceHandle: ue?.sourceHandle || null,
            targetHandle: ue?.targetHandle || null,
            hidden: ue?.hidden || false,
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
        // Dependency edge naar referentielijst-items relatie (via $ref)
        const geRefNaam = v["$ref"] || v.refItemNaam || null;
        if (geRefNaam) {
          const ue = useEdgeMap[geRefNaam];
          edges.push({
            id: ue?.id || `${geTypenaam}--ref-->${geRefNaam}`,
            source: geTypenaam,
            target: geRefNaam,
            type: "metamodel",
            sourceHandle: ue?.sourceHandle || null,
            targetHandle: ue?.targetHandle || null,
            hidden: ue?.hidden || false,
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
            domein: rel.domein || ent.domein || "",
            meervoud: rel.meervoud || "",
            metatype: "relatie",
            isMaterieel: rel.isMaterieel || false,
            // Referentielijst-subtypes (zie Referentielijsten.md)
            relatieSubtype: rel.relatieSubtype || "",
            referentielijstInstantie: rel.referentielijstInstantie || "",
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

      // Lookup voor «use» dependency edge handles (enum/datatype/ref)
      const relUseEdgeMap = Object.fromEntries(
        (rel.useEdges || []).map((ue) => [ue.doel, ue])
      );

      (rel.velden || []).forEach((v) => {
        if (v.enum) {
          const ue = relUseEdgeMap[v.enum];
          edges.push({
            id: ue?.id || `${rel.naam}-->${v.enum}`,
            source: rel.naam,
            target: `enum_${v.enum}`,
            type: "metamodel",
            sourceHandle: ue?.sourceHandle || null,
            targetHandle: ue?.targetHandle || null,
            hidden: ue?.hidden || false,
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
        // Dependency edge naar gegevenstype node
        const relDtNaam = v.datatype || (datatypeLookup[v.goType] ? v.goType : null);
        if (relDtNaam) {
          const ue = relUseEdgeMap[relDtNaam];
          edges.push({
            id: ue?.id || `${rel.naam}--dt-->${relDtNaam}`,
            source: rel.naam,
            target: `dt_${relDtNaam}`,
            type: "metamodel",
            sourceHandle: ue?.sourceHandle || null,
            targetHandle: ue?.targetHandle || null,
            hidden: ue?.hidden || false,
            data: {
              isDependency: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            },
          });
        }
        // Dependency edge naar referentielijst-items relatie (via $ref)
        const relRefNaam = v["$ref"] || v.refItemNaam || null;
        if (relRefNaam) {
          const ue = relUseEdgeMap[relRefNaam];
          edges.push({
            id: ue?.id || `${rel.naam}--ref-->${relRefNaam}`,
            source: rel.naam,
            target: relRefNaam,
            type: "metamodel",
            sourceHandle: ue?.sourceHandle || null,
            targetHandle: ue?.targetHandle || null,
            hidden: ue?.hidden || false,
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

      // Binding edge: items-relatie → referentielijst-instantie
      if (rel.referentielijstInstantie) {
        const instantieNodeId = `refinstantie_${rel.referentielijstInstantie}`;
        edges.push({
          id: rel.instantieId || `${rel.naam}-->instantie_${rel.referentielijstInstantie}`,
          source: instantieNodeId,
          target: rel.naam,
          type: "metamodel",
          sourceHandle: rel.instantieSourceHandle || null,
          targetHandle: rel.instantieTargetHandle || null,
          data: {
            isDependency: true,
            rolnaam: `⇢ ${rel.referentielijstInstantie}`,
            jsonRolnaam: "",
            momentvoorkomen: "",
            kardinaliteit: "",
          },
        });
      }
    });
  });

  return { nodes, edges };
}
