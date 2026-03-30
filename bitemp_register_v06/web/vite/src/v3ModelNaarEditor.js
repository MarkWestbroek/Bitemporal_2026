/**
 * V3 Model → Editor converter
 *
 * Converteert een V3Model (van /api/schema/model) naar React Flow nodes + edges.
 *
 * Verschil met schemaResponseNaarEditor (v1):
 * - Input is hiërarchisch (entiteiten bevatten GEs en relaties)
 * - Geen plumbing-velden (geen a_id, rel_id, b_id, versie, opvoer, afvoer)
 * - Velden gebruiken goType i.p.v. OAS type+format
 * - Enums zijn top-level objecten, niet inline
 * - DoelEntiteit is direct beschikbaar (geen secondaireEntiteitIDKolom)
 */
import { defaultKleur } from "@editor/metamodel/types";

// ── Go type → editor veldtype mapping ──────────────────────────

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
      return { type: "string", format: "" }; // enum of custom type
  }
}

function convertV3Veld(v3Veld, enumLookup, datatypeLookup) {
  // Explicit datatype reference (schema:"datatype:NLPostcode") heeft voorrang op goType lookup
  const datatype = v3Veld.datatype
    ? datatypeLookup[v3Veld.datatype]
    : datatypeLookup[v3Veld.goType];
  const mapped = goTypeNaarVeldType(v3Veld.goType);
  const type = datatype?.basistype || mapped.type;
  const format = datatype?.format || mapped.format;
  const enumWaarden = v3Veld.enum
    ? enumLookup[v3Veld.enum] || null
    : null;
  // $ref naar referentielijst-items type (schema:"ref:LandenlijstLand"), analoog aan OAS 3.1 $ref
  // Backward compat: oudere DB-opgeslagen modellen gebruiken "refItemNaam" i.p.v. "$ref"
  const refNaam = v3Veld["$ref"] || v3Veld.refItemNaam || null;

  return {
    naam: v3Veld.naam,
    type,
    format,
    datatypeNaam: v3Veld.datatype || datatype?.naam || null,
    enum: enumWaarden,
    enumNaam: v3Veld.enum || null,
    refNaam,
    verplicht: !v3Veld.goType.startsWith("*"),
    autoIncrement: false,
    description: v3Veld.description || "",
    // Afgeleide velden: zie afgeleide-velden.md voor documentatie en CEL-voorbeelden
    afgeleid: v3Veld.afgeleid || false,
    afleidingsregelTaal: v3Veld.afleidingsregelTaal || "cel",
    afleidingsregel: v3Veld.afleidingsregel || "",
  };
}

// ── Hoofdconversie ─────────────────────────────────────────────

/**
 * Converteer een V3Model naar editor nodes + edges.
 * @param {object} v3Model - het V3Model object (niet de wrapper)
 * @returns {{ nodes: Array, edges: Array }}
 */
export function v3ModelNaarEditor(v3Model) {
  const nodes = [];
  const edges = [];

  // Bouw enum lookup: goType → [waarde, ...]
  const enumLookup = {};
  (v3Model.enums || []).forEach((e) => {
    enumLookup[e.goType] = e.waarden.map((w) => w.waarde);
  });

  const datatypeLookup = {};
  const uniekeDatatypes = [];
  const gezienDatatypeNamen = new Set();
  (v3Model.datatypes || []).forEach((dt) => {
    if (!dt?.naam) return;
    // Defensief: dubbele datatypenamen geven dubbele node-ids (dt_<naam>) in de editor.
    // We houden daarom de eerste entry per naam aan.
    if (gezienDatatypeNamen.has(dt.naam)) return;
    gezienDatatypeNamen.add(dt.naam);
    datatypeLookup[dt.naam] = dt;
    uniekeDatatypes.push(dt);
  });

  // ── Enum nodes ───────────────────────────────────────────────
  (v3Model.enums || []).forEach((e, i) => {
    nodes.push({
      id: `enum_${e.goType}`,
      type: "enumeratie",
      position: e.positie ? { x: e.positie.x, y: e.positie.y } : { x: 50 + i * 220, y: 550 },
      data: {
        naam: e.goType,
        baseType: e.baseType || "string",
        waarden: e.waarden.map((w) => w.waarde),
      },
    });
  });

  // ── Datatype nodes ───────────────────────────────────────────
  uniekeDatatypes.forEach((dt, i) => {
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

  // ── Entiteiten + onderliggende GE's en relaties ──────────────
  const entiteiten = v3Model.entiteiten || [];

  entiteiten.forEach((ent, entIdx) => {
    // Entiteit node — geen velden (id is plumbing)
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
        kleur: ent.kleur || defaultKleur("entiteit"),
        velden: [],
        // Entiteit-niveau afgeleide velden (bijv. weergavenaam): zie afgeleide-velden.md
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

    // Gegevenselementen
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
        },
      });

      // Edge: entiteit → GE
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
          kardinaliteit:
            ge.momentvoorkomen === "meervoudig" ? "0..*" : "0..1",
        },
      });

      // Enum dependency edges voor GE-velden
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
        // Dependency edge naar gegevenstype node
        // Backward compat: oudere DB-modellen hebben geen v.datatype maar goType=datatypeNaam
        const dtNaam = v.datatype || (datatypeLookup[v.goType] ? v.goType : null);
        if (dtNaam) {
          edges.push({
            id: `${geTypenaam}--dt-->${dtNaam}`,
            source: geTypenaam,
            target: `dt_${dtNaam}`,
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
        // Dependency edge naar referentielijst-items relatie (via $ref)
        const geRefNaam = v["$ref"] || v.refItemNaam || null;
        if (geRefNaam) {
          edges.push({
            id: `${geTypenaam}--ref-->${geRefNaam}`,
            source: geTypenaam,
            target: geRefNaam,
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

    // Relaties
    (ent.relaties || []).forEach((rel) => {
      // Relatie-node alleen aanmaken als die nog niet bestaat
      if (!nodes.find((n) => n.id === rel.naam)) {
        const velden = (rel.velden || []).map((v) =>
          convertV3Veld(v, enumLookup, datatypeLookup)
        );

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
            kleur: defaultKleur("relatie"),
            velden,
            doelEntiteit: rel.doelEntiteit || "",
          },
        });
      }

      // Edge: entiteit → relatie
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
          kardinaliteit:
            rel.momentvoorkomen === "meervoudig" ? "0..*" : "0..1",
        },
      });

      // Enum dependency edges voor relatie-velden
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
        // Dependency edge naar gegevenstype node
        const relDtNaam = v.datatype || (datatypeLookup[v.goType] ? v.goType : null);
        if (relDtNaam) {
          edges.push({
            id: `${rel.naam}--dt-->${relDtNaam}`,
            source: rel.naam,
            target: `dt_${relDtNaam}`,
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
        // Dependency edge naar referentielijst-items relatie (via $ref)
        const relRefNaam = v["$ref"] || v.refItemNaam || null;
        if (relRefNaam) {
          edges.push({
            id: `${rel.naam}--ref-->${relRefNaam}`,
            source: rel.naam,
            target: relRefNaam,
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

      // Edge: relatie → doelentiteit
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
