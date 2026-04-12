import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import * as THREE from "three";
import { schemaToGraph, extractDomains, NODE_RADIUS } from "./schemaToGraph";
import { evalueerCelExpressie } from "../shared/celEvaluator";
import "./universum.css";

/* ── Singleton CSS2DRenderer ───────────────────────────────────────── */
const cssRenderer = new CSS2DRenderer();

const API_BASE = () =>
  window.location.port === "5174" ? "http://localhost:8082" : "";

const SYSTEM_FIELDS = new Set([
  "id", "opvoer", "afvoer", "rel_id", "versie", "_weergavenaam",
]);

/* ── Helpers ────────────────────────────────────────────────────────── */

function berekenWeergavenaam(record, entityMeta, typesByTypenaam) {
  const afgeleide = entityMeta?.afgeleideVelden;
  if (!Array.isArray(afgeleide) || afgeleide.length === 0) return null;
  const weergave = afgeleide.find((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (!weergave?.afleidingsregel) return null;

  const ctx = {};
  if (Array.isArray(entityMeta.onderliggende)) {
    for (const child of entityMeta.onderliggende) {
      const childMeta = typesByTypenaam?.[child.doeltype];
      const key =
        childMeta?.klassenaam || child.doeltype.replace(/^[^_]+_/, "");
      const items = record?.[child.jsonRolnaam] || [];
      const actief = items.find((r) => !r.afvoer) || items[0];
      if (!actief) continue;

      if (
        childMeta?.ge_subtype === "hub" &&
        Array.isArray(childMeta.onderliggende)
      ) {
        const dataChild = childMeta.onderliggende.find((c) => {
          const cm = typesByTypenaam?.[c.doeltype];
          return cm?.ge_subtype === "data";
        });
        if (dataChild) {
          const dataItems = actief[dataChild.jsonRolnaam] || [];
          const actiefData = dataItems.find((d) => !d.afvoer) || dataItems[0];
          if (actiefData) {
            ctx[key] = { ...actief, ...actiefData };
            continue;
          }
        }
      }
      ctx[key] = actief;
    }
  }

  try {
    const result = evalueerCelExpressie(weergave.afleidingsregel, ctx);
    if (result != null && String(result).trim() !== "") return String(result);
  } catch {
    /* CEL mislukt → fallback */
  }
  return null;
}

function fallbackLabel(record) {
  const vals = [];
  for (const [k, v] of Object.entries(record)) {
    if (SYSTEM_FIELDS.has(k) || v == null || typeof v === "object") continue;
    vals.push(String(v));
    if (vals.length >= 3) break;
  }
  return vals.length > 0 ? vals.join(" · ") : `#${record.id ?? "?"}`;
}

function extractGEDisplay(item, childMeta, typesByTypenaam) {
  let data = { ...item };
  if (
    childMeta?.ge_subtype === "hub" &&
    Array.isArray(childMeta.onderliggende)
  ) {
    const dataChild = childMeta.onderliggende.find((c) => {
      const cm = typesByTypenaam?.[c.doeltype];
      return cm?.ge_subtype === "data";
    });
    if (dataChild) {
      const dataItems = item[dataChild.jsonRolnaam] || [];
      const actiefData = dataItems.find((d) => !d.afvoer) || dataItems[0];
      if (actiefData) data = { ...item, ...actiefData };
    }
  }

  const vals = [];
  for (const [k, v] of Object.entries(data)) {
    if (
      SYSTEM_FIELDS.has(k) || v == null || typeof v === "object" ||
      k.endsWith("_id")
    )
      continue;
    vals.push(String(v));
    if (vals.length >= 4) break;
  }
  return vals.join(" · ") || "—";
}

/* ── Graph-builders ────────────────────────────────────────────────── */

function buildInstancesGraph(entity, records) {
  const nodes = [
    {
      id: "__center__",
      label: entity.label,
      color: entity.color || "#60a5fa",
      radius: 10,
      nodeType: "entity_center",
    },
  ];
  const links = [];
  for (const rec of records) {
    const nid = `inst::${rec.id}`;
    nodes.push({
      id: nid,
      label: rec._weergavenaam || fallbackLabel(rec),
      color: entity.color || "#60a5fa",
      radius: 3,
      nodeType: "instance",
      instanceId: rec.id,
    });
    links.push({
      source: "__center__",
      target: nid,
      color: "rgba(251,191,36,0.30)",
    });
  }
  return { nodes, links };
}

/**
 * Bouwt het concrete universum: instantie als centrum, GE-data eromheen,
 * en secondaire entiteiten via relaties (bijv. Bereikbaarheid → Locatie).
 *
 * @param {string}  label              Weergavenaam van de instantie
 * @param {object}  record             Het /full/{padnaam}/:id response
 * @param {object}  entityMeta         Schema metadata van het entiteitstype
 * @param {object}  typesByTypenaam    Alle type metadata, indexed op typenaam
 * @param {object}  secondaries        Map van relatieNodeId → { record, doeltype, doelMeta, label }
 */
function buildConcreteGraph(
  label, record, entityMeta, typesByTypenaam, secondaries = {}
) {
  const nodes = [
    {
      id: "__self__",
      label,
      color: entityMeta?.kleur || "#60a5fa",
      radius: 7,
      nodeType: "self",
    },
  ];
  const links = [];

  for (const child of entityMeta?.onderliggende || []) {
    const childMeta = typesByTypenaam?.[child.doeltype];
    if (!childMeta) continue;

    const items = record?.[child.jsonRolnaam] || [];
    if (items.length === 0) continue;

    const active = items.filter((i) => !i.afvoer);
    const show = active.length > 0 ? active : [items[0]];

    for (let i = 0; i < show.length; i++) {
      const item = show[i];
      const geId = `ge::${child.doeltype}::${item.rel_id ?? item.versie ?? i}`;
      const klassenaam =
        childMeta.klassenaam || child.doeltype.replace(/^[^_]+_/, "");
      const display = extractGEDisplay(item, childMeta, typesByTypenaam);

      let color = childMeta.kleur || "#a3e635";
      let nodeType = "ge_data";
      if (
        child.doeltype.includes("Aanvang") ||
        child.doeltype.includes("Einde")
      ) {
        color = childMeta.kleur || "#67e8f9";
        nodeType = "materieel";
      }
      if (childMeta.metatype === "relatie") {
        color = childMeta.kleur || "#f472b6";
        nodeType = "relatie_data";
      }

      nodes.push({
        id: geId,
        label: klassenaam,
        displayData: display,
        color,
        radius: 3,
        nodeType,
      });
      links.push({
        source: "__self__",
        target: geId,
        color: `${color}55`,
      });

      // ── Secondaire entiteit via relatie ──────────────────────────
      const sec = secondaries[geId];
      if (sec) {
        const secEntityId = `sec::${sec.doeltype}::${sec.id}`;
        const secMeta = sec.doelMeta;
        const secLabel = sec.label || sec.doeltype;

        // De secondaire entiteit als bol
        nodes.push({
          id: secEntityId,
          label: secLabel,
          color: secMeta?.kleur || "#60a5fa",
          radius: 5,
          nodeType: "sec_entity",
        });
        links.push({
          source: geId,
          target: secEntityId,
          color: `${color}88`,
        });

        // De GE's van de secondaire entiteit
        for (const secChild of secMeta?.onderliggende || []) {
          const scMeta = typesByTypenaam?.[secChild.doeltype];
          if (!scMeta) continue;

          const secItems = sec.record?.[secChild.jsonRolnaam] || [];
          if (secItems.length === 0) continue;

          const secActive = secItems.filter((si) => !si.afvoer);
          const secShow = secActive.length > 0 ? secActive : [secItems[0]];

          for (let j = 0; j < secShow.length; j++) {
            const si = secShow[j];
            const secGeId = `sec-ge::${secChild.doeltype}::${si.rel_id ?? si.versie ?? j}`;
            const secKlass =
              scMeta.klassenaam || secChild.doeltype.replace(/^[^_]+_/, "");
            const secDisplay = extractGEDisplay(si, scMeta, typesByTypenaam);

            let secColor = scMeta.kleur || "#a3e635";
            let secNodeType = "ge_data";
            if (
              secChild.doeltype.includes("Aanvang") ||
              secChild.doeltype.includes("Einde")
            ) {
              secColor = scMeta.kleur || "#67e8f9";
              secNodeType = "materieel";
            }

            nodes.push({
              id: secGeId,
              label: secKlass,
              displayData: secDisplay,
              color: secColor,
              radius: 2,
              nodeType: secNodeType,
            });
            links.push({
              source: secEntityId,
              target: secGeId,
              color: `${secColor}44`,
            });
          }
        }
      }
    }
  }
  return { nodes, links };
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function UniversumPage() {
  const fgRef = useRef();
  const [rawSchema, setRawSchema] = useState(null);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const [viewMode, setViewMode] = useState("meta");
  const [activeDomains, setActiveDomains] = useState(null);
  const [wormholeActive, setWormholeActive] = useState(false);

  const [focusedEntity, setFocusedEntity] = useState(null);
  const [instanceRecords, setInstanceRecords] = useState([]);

  const [focusedInstance, setFocusedInstance] = useState(null);
  const [concreteRecord, setConcreteRecord] = useState(null);
  const [concreteSecondaries, setConcreteSecondaries] = useState({});

  const [loading, setLoading] = useState(false);
  const lastClickRef = useRef({ time: 0, nodeId: null });

  const domains = useMemo(() => extractDomains(rawSchema), [rawSchema]);

  const typesByTypenaam = useMemo(() => {
    if (!rawSchema?.types) return {};
    const m = {};
    for (const t of rawSchema.types) m[t.typenaam] = t;
    return m;
  }, [rawSchema]);

  /* ── Graph data ──────────────────────────────────────────────────── */

  // Meta: altijd ALLE nodes; filtering via visibility
  const metaGraphData = useMemo(() => {
    if (!rawSchema) return null;
    return schemaToGraph(rawSchema);
  }, [rawSchema]);

  const instancesGraphData = useMemo(() => {
    if (!focusedEntity || instanceRecords.length === 0) return null;
    return buildInstancesGraph(focusedEntity, instanceRecords);
  }, [focusedEntity, instanceRecords]);

  const concreteGraphData = useMemo(() => {
    if (!focusedInstance || !concreteRecord) return null;
    const meta = typesByTypenaam[focusedInstance.entityTypenaam];
    return buildConcreteGraph(
      focusedInstance.label,
      concreteRecord,
      meta,
      typesByTypenaam,
      concreteSecondaries
    );
  }, [focusedInstance, concreteRecord, concreteSecondaries, typesByTypenaam]);

  const graphData =
    viewMode === "concrete"
      ? concreteGraphData
      : viewMode === "instances"
        ? instancesGraphData
        : metaGraphData;

  /* ── Schema ophalen ──────────────────────────────────────────────── */

  useEffect(() => {
    const base = API_BASE();
    fetch(`${base}/api/schema/model/code`)
      .then((r) => {
        if (!r.ok) throw new Error(`Schema-API ${r.status}`);
        return r.json();
      })
      .then(setRawSchema)
      .catch((e) => setError(e.message));
  }, []);

  /* ── Domeinfilter: mesh + CSS2D visibility ───────────────────────── */
  // CSS2DRenderer's traverseVisible skips hidden subtrees, maar
  // laat eerder-zichtbare CSS2D-elements met display:"" staan.
  // Daarom zetten we display expliciet op elke CSS2DObject.

  const isDomainVisible = useCallback(
    (node) =>
      activeDomains === null || !node.domein || activeDomains.has(node.domein),
    [activeDomains]
  );

  useEffect(() => {
    if (viewMode !== "meta" || !metaGraphData) return;

    for (const node of metaGraphData.nodes) {
      const visible = isDomainVisible(node);
      const obj = node.__threeObj;
      if (!obj) continue;

      // Stel mesh-visibility in
      obj.visible = visible;

      // Stel CSS2DObject-visibility + display in
      obj.traverse((child) => {
        if (child.isCSS2DObject) {
          child.visible = visible;
          if (child.element) {
            child.element.style.display = visible ? "" : "none";
          }
        }
      });
    }
  }, [viewMode, metaGraphData, isDomainVisible]);

  /* ── d3-force tuning ─────────────────────────────────────────────── */

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (viewMode === "instances") {
      fg.d3Force("charge")?.strength(-30);
      fg.d3Force("link")?.distance(25);
    } else if (viewMode === "concrete") {
      fg.d3Force("charge")?.strength(-60);
      fg.d3Force("link")?.distance(40);
    } else {
      fg.d3Force("charge")?.strength(-120);
      fg.d3Force("link")?.distance(80);
    }
  }, [viewMode, graphData]);

  /* ── Camera ──────────────────────────────────────────────────────── */

  const flyToNode = useCallback((node, distance = 120) => {
    const fg = fgRef.current;
    if (!fg) return;
    const x = node.x || 0,
      y = node.y || 0,
      z = node.z || 0;
    const r = Math.hypot(x, y, z) || 1;
    const ratio = 1 + distance / r;
    fg.cameraPosition(
      { x: x * ratio, y: y * ratio, z: z * ratio },
      { x, y, z },
      1200
    );
  }, []);

  /* ── Wormhole: meta → instances ──────────────────────────────────── */

  const enterInstances = useCallback(
    (entityNode) => {
      if (entityNode.metatype !== "entiteit" || !entityNode.padnaam) return;
      setSelectedNode(null);
      setLoading(true);

      flyToNode(entityNode, 2);
      setTimeout(() => setWormholeActive(true), 200);

      const base = API_BASE();
      fetch(`${base}/full/${entityNode.padnaam}?page=1&size=50`)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        })
        .then((data) => {
          const key = Object.keys(data).find((k) => Array.isArray(data[k]));
          const records = key ? data[key] : [];
          if (records.length === 0) {
            setWormholeActive(false);
            setLoading(false);
            return;
          }

          const eMeta = typesByTypenaam[entityNode.id];
          const enriched = records.map((rec) => ({
            ...rec,
            _weergavenaam: berekenWeergavenaam(rec, eMeta, typesByTypenaam),
          }));

          setFocusedEntity({
            typenaam: entityNode.id,
            padnaam: entityNode.padnaam,
            label: entityNode.label,
            color: entityNode.color,
          });
          setInstanceRecords(enriched);
          setViewMode("instances");

          setTimeout(() => {
            setWormholeActive(false);
            setLoading(false);
          }, 500);
        })
        .catch((err) => {
          console.error("Instances laden mislukt:", err);
          setWormholeActive(false);
          setLoading(false);
        });
    },
    [typesByTypenaam, flyToNode]
  );

  /* ── Wormhole: instances → concreet ──────────────────────────────── */

  const enterConcrete = useCallback(
    (instanceNode) => {
      if (!focusedEntity || !instanceNode.instanceId) return;
      setSelectedNode(null);
      setLoading(true);

      flyToNode(instanceNode, 2);
      setTimeout(() => setWormholeActive(true), 200);

      const base = API_BASE();
      const entityPadnaam = focusedEntity.padnaam;
      const entityTypenaam = focusedEntity.typenaam;
      const instId = instanceNode.instanceId;

      fetch(`${base}/full/${entityPadnaam}/${instId}`)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        })
        .then(async (record) => {
          // ── Secondaire entiteiten ophalen via relaties ───────────
          const entityMeta = typesByTypenaam[entityTypenaam];
          const secFetches = [];

          for (const child of entityMeta?.onderliggende || []) {
            const childMeta = typesByTypenaam[child.doeltype];
            if (childMeta?.metatype !== "relatie" || !childMeta.doelEntiteit)
              continue;

            const doelMeta = typesByTypenaam[childMeta.doelEntiteit];
            if (!doelMeta?.padnaam) continue;

            // ID-kolom: uit schema of afgeleid uit doelEntiteit naam
            const idField =
              childMeta.secondaireEntiteitIDKolom ||
              `${childMeta.doelEntiteit.toLowerCase()}_id`;

            const items = record[child.jsonRolnaam] || [];
            const actief = items.filter((i) => !i.afvoer);
            const show = actief.length > 0 ? actief : items.slice(0, 1);

            for (let i = 0; i < show.length; i++) {
              const item = show[i];
              const secId = item[idField];
              if (!secId) continue;

              const relatieNodeId = `ge::${child.doeltype}::${item.rel_id ?? item.versie ?? i}`;
              secFetches.push({
                relatieNodeId,
                doeltype: childMeta.doelEntiteit,
                doelMeta,
                padnaam: doelMeta.padnaam,
                id: secId,
              });
            }
          }

          // Fetch secondaire entiteiten parallel
          const secs = {};
          await Promise.all(
            secFetches.map(async (f) => {
              try {
                const r = await fetch(`${base}/full/${f.padnaam}/${f.id}`);
                if (!r.ok) return;
                const secRecord = await r.json();

                // Weergavenaam van de secondaire entiteit
                const secDisplayName =
                  berekenWeergavenaam(secRecord, f.doelMeta, typesByTypenaam) ||
                  fallbackLabel(secRecord);

                secs[f.relatieNodeId] = {
                  record: secRecord,
                  doeltype: f.doeltype,
                  doelMeta: f.doelMeta,
                  id: f.id,
                  label: secDisplayName,
                };
              } catch {
                /* secondaire niet beschikbaar */
              }
            })
          );

          setFocusedInstance({
            id: instId,
            label: instanceNode.label,
            entityTypenaam,
          });
          setConcreteRecord(record);
          setConcreteSecondaries(secs);
          setViewMode("concrete");

          setTimeout(() => {
            setWormholeActive(false);
            setLoading(false);
          }, 500);
        })
        .catch((err) => {
          console.error("Concreet laden mislukt:", err);
          setWormholeActive(false);
          setLoading(false);
        });
    },
    [focusedEntity, typesByTypenaam, flyToNode]
  );

  /* ── Terug-navigatie ─────────────────────────────────────────────── */

  const goBack = useCallback(() => {
    if (viewMode === "meta") return;
    setSelectedNode(null);
    setWormholeActive(true);

    setTimeout(() => {
      if (viewMode === "concrete") {
        setFocusedInstance(null);
        setConcreteRecord(null);
        setConcreteSecondaries({});
        setViewMode("instances");
      } else {
        setFocusedEntity(null);
        setInstanceRecords([]);
        setViewMode("meta");
      }
      setTimeout(() => setWormholeActive(false), 400);
    }, 300);
  }, [viewMode]);

  const goToMeta = useCallback(() => {
    if (viewMode === "meta") return;
    setSelectedNode(null);
    setWormholeActive(true);

    setTimeout(() => {
      setFocusedInstance(null);
      setConcreteRecord(null);
      setConcreteSecondaries({});
      setFocusedEntity(null);
      setInstanceRecords([]);
      setViewMode("meta");
      setTimeout(() => setWormholeActive(false), 400);
    }, 300);
  }, [viewMode]);

  /* ── Click + dubbelklik ──────────────────────────────────────────── */

  const handleNodeClick = useCallback(
    (node) => {
      const now = Date.now();
      const last = lastClickRef.current;

      if (last.nodeId === node.id && now - last.time < 400) {
        lastClickRef.current = { time: 0, nodeId: null };
        if (viewMode === "meta" && node.metatype === "entiteit")
          enterInstances(node);
        else if (viewMode === "instances" && node.nodeType === "instance")
          enterConcrete(node);
        return;
      }

      lastClickRef.current = { time: now, nodeId: node.id };
      setSelectedNode(node);
      const dist =
        node.nodeType === "instance" || node.nodeType === "ge_data" ? 50 : 100;
      flyToNode(node, dist);
    },
    [viewMode, enterInstances, enterConcrete, flyToNode]
  );

  /* ── Keyboard ────────────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (viewMode !== "meta") goBack();
        else setSelectedNode(null);
        return;
      }
      if (e.key === "Backspace" && viewMode !== "meta") {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.key === "Enter" && selectedNode) {
        if (viewMode === "meta" && selectedNode.metatype === "entiteit")
          enterInstances(selectedNode);
        else if (
          viewMode === "instances" &&
          selectedNode.nodeType === "instance"
        )
          enterConcrete(selectedNode);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, selectedNode, goBack, enterInstances, enterConcrete]);

  /* ── Domain toggle ───────────────────────────────────────────────── */

  const toggleDomain = useCallback(
    (dom) => {
      setActiveDomains((prev) => {
        const cur = prev === null ? new Set(domains) : new Set(prev);
        if (cur.has(dom)) cur.delete(dom);
        else cur.add(dom);
        return cur.size === domains.length ? null : cur;
      });
    },
    [domains]
  );

  /* ── Link visibility (domeinfilter) ──────────────────────────────── */

  const linkVisibility = useCallback(
    (link) => {
      if (viewMode !== "meta" || activeDomains === null) return true;
      const s = typeof link.source === "object" ? link.source : null;
      const t = typeof link.target === "object" ? link.target : null;
      if (!s || !t) return true;
      const sVis = !s.domein || activeDomains.has(s.domein);
      const tVis = !t.domein || activeDomains.has(t.domein);
      return sVis && tVis;
    },
    [viewMode, activeDomains]
  );

  /* ── Node rendering ──────────────────────────────────────────────── */

  const nodeThreeObject = useCallback((node) => {
    const radius = node.radius || NODE_RADIUS[node.metatype] || 2;
    const isCenter =
      node.nodeType === "entity_center" || node.nodeType === "self";
    const isSecEntity = node.nodeType === "sec_entity";

    const geo = new THREE.SphereGeometry(radius, 20, 14);
    const mat = new THREE.MeshLambertMaterial({
      color: node.color || "#94a3b8",
      transparent: true,
      opacity: isCenter ? 0.35 : isSecEntity ? 0.65 : 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);

    if (isCenter || isSecEntity) {
      const ring = new THREE.RingGeometry(radius + 1, radius + 2, 32);
      const rMat = new THREE.MeshBasicMaterial({
        color: node.color || "#60a5fa",
        transparent: true,
        opacity: isCenter ? 0.15 : 0.1,
        side: THREE.DoubleSide,
      });
      mesh.add(new THREE.Mesh(ring, rMat));
    }

    const el = document.createElement("div");
    let cssClass = "node-label";
    if (node.nodeType === "entity_center") cssClass += " node-label--entiteit";
    else if (node.nodeType === "instance") cssClass += " node-label--instance";
    else if (node.nodeType === "self") cssClass += " node-label--self";
    else if (node.nodeType === "sec_entity")
      cssClass += " node-label--sec-entity";
    else if (
      node.nodeType === "ge_data" ||
      node.nodeType === "materieel" ||
      node.nodeType === "relatie_data"
    )
      cssClass += " node-label--ge-data";
    else if (node.metatype) cssClass += ` node-label--${node.metatype}`;

    el.className = cssClass;

    if (node.displayData) {
      const title = document.createElement("div");
      title.textContent = node.label;
      title.className = "ge-label-title";
      el.appendChild(title);
      const data = document.createElement("div");
      data.textContent = node.displayData;
      data.className = "ge-label-data";
      el.appendChild(data);
    } else {
      el.textContent = node.label;
    }

    const lbl = new CSS2DObject(el);
    lbl.position.set(0, radius + 3, 0);
    mesh.add(lbl);
    return mesh;
  }, []);

  /* ── Render ──────────────────────────────────────────────────────── */

  if (error) {
    return (
      <div className="universum-container">
        <div className="universum-loading">Fout: {error}</div>
      </div>
    );
  }
  if (!graphData && !loading) {
    return (
      <div className="universum-container">
        <div className="universum-loading">Schema laden…</div>
      </div>
    );
  }

  return (
    <div className="universum-container">
      <div className={`wormhole-overlay${wormholeActive ? " active" : ""}`} />

      {/* Toolbar + breadcrumb */}
      <div className="universum-toolbar">
        <a href="/viz/react/">← Terug</a>
        <h1>3D Data Universum</h1>

        <nav className="breadcrumb">
          <span
            className={`bc-item${viewMode === "meta" ? " bc-active" : " bc-link"}`}
            onClick={viewMode !== "meta" ? goToMeta : undefined}
          >
            🌌 Meta
          </span>
          {focusedEntity && (
            <>
              <span className="bc-sep">›</span>
              <span
                className={`bc-item${viewMode === "instances" ? " bc-active" : " bc-link"}`}
                onClick={viewMode === "concrete" ? goBack : undefined}
              >
                {focusedEntity.label}
              </span>
            </>
          )}
          {focusedInstance && (
            <>
              <span className="bc-sep">›</span>
              <span className="bc-item bc-active">
                {focusedInstance.label}
              </span>
            </>
          )}
        </nav>

        {viewMode !== "meta" && (
          <button className="collapse-btn" onClick={goBack}>
            ← Terug
          </button>
        )}

        <span className="universum-hint">
          {viewMode === "meta"
            ? "Dubbelklik entiteit = wormhole · Esc = reset"
            : viewMode === "instances"
              ? "Dubbelklik instantie = concreet universum · Esc = terug"
              : "Esc / Backspace = terug"}
        </span>
      </div>

      {/* Domeinfilter (alleen meta) */}
      {viewMode === "meta" && domains.length > 1 && (
        <div className="universum-domains">
          {domains.map((dom) => {
            const on = activeDomains === null || activeDomains.has(dom);
            return (
              <button
                key={dom}
                className={`domain-btn${on ? "" : " domain-btn--off"}`}
                onClick={() => toggleDomain(dom)}
              >
                {dom}
              </button>
            );
          })}
        </div>
      )}

      {/* 3D Graaf */}
      {graphData && (
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          extraRenderers={[cssRenderer]}
          onNodeClick={handleNodeClick}
          linkVisibility={linkVisibility}
          linkColor={(l) => l.color || "rgba(148,163,184,0.4)"}
          linkWidth={1}
          linkOpacity={0.6}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => "rgba(148,163,184,0.7)"}
          backgroundColor="#0f172a"
          showNavInfo={false}
        />
      )}

      {/* Info-panel */}
      {selectedNode && (
        <div className="universum-info">
          <h3 style={{ color: selectedNode.color }}>{selectedNode.label}</h3>
          {selectedNode.displayData && (
            <p className="info-data">{selectedNode.displayData}</p>
          )}
          {selectedNode.domein && (
            <p>
              Domein: <strong>{selectedNode.domein}</strong>
            </p>
          )}
          {selectedNode.description && <p>{selectedNode.description}</p>}

          {viewMode === "meta" && selectedNode.metatype === "entiteit" && (
            <p className="drill-hint">
              Enter of dubbelklik → duik het type in
            </p>
          )}
          {viewMode === "instances" &&
            selectedNode.nodeType === "instance" && (
              <p className="drill-hint">
                Enter of dubbelklik → concreet universum
              </p>
            )}
        </div>
      )}

      {loading && (
        <div className="universum-loading wormhole-text">✦ Wormhole…</div>
      )}
    </div>
  );
}
