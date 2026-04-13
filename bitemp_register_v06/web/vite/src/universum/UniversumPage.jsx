import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import * as THREE from "three";
import { schemaToGraph, extractDomains, NODE_RADIUS } from "./schemaToGraph";
import { evalueerCelExpressie } from "../shared/celEvaluator";
import * as sfx from "./sfx";
import {
  fetchInstancesGraphQL,
  fetchFullEntityGraphQL,
  flattenRecord,
  discoverReverseRelations,
} from "./graphqlFetcher";
import "./universum.css";

/* ── Singleton CSS2DRenderer ───────────────────────────────────────── */
const cssRenderer = new CSS2DRenderer();

/* ── Procedurele nebula-textuur (canvas) ───────────────────────────── */
function createNebulaTexture(width, height, hue, saturation, opacity) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const cx = canvas.getContext("2d");

  // Meerdere overlapping-radiale gradiënten voor "gaswolk" effect
  const blobs = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < blobs; i++) {
    const bx = width * (0.15 + Math.random() * 0.7);
    const by = height * (0.15 + Math.random() * 0.7);
    const r = Math.min(width, height) * (0.2 + Math.random() * 0.4);
    const g = cx.createRadialGradient(bx, by, 0, bx, by, r);
    const h = hue + (Math.random() - 0.5) * 40;
    const s = saturation + (Math.random() - 0.5) * 20;
    g.addColorStop(0, `hsla(${h}, ${s}%, 60%, ${opacity * 0.8})`);
    g.addColorStop(0.4, `hsla(${h}, ${s}%, 40%, ${opacity * 0.4})`);
    g.addColorStop(1, `hsla(${h}, ${s}%, 20%, 0)`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, width, height);
  }

  // Circulaire vignette zodat randen zacht wegsmelten (geen rechthoekige cutoff)
  cx.globalCompositeOperation = "destination-in";
  const vigR = Math.min(width, height) * 0.5;
  const vig = cx.createRadialGradient(width / 2, height / 2, vigR * 0.25,
                                       width / 2, height / 2, vigR);
  vig.addColorStop(0, "rgba(255,255,255,1)");
  vig.addColorStop(0.6, "rgba(255,255,255,0.7)");
  vig.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = vig;
  cx.fillRect(0, 0, width, height);
  cx.globalCompositeOperation = "source-over";

  return new THREE.CanvasTexture(canvas);
}

/* ── Space dragon: procedurele ruimtedraak ─────────────────────────── */
/*
 * Een raadselachtige, bioluminescente ruimtedraak die door het universum zweeft.
 * Opgebouwd uit gloeiende deeltjes (lichaam, vleugels, staart) als THREE.Points
 * met een golvende sinusbeweging. Spawnt samen met de spaceBird() audio.
 *
 * De draak is semi-transparant en ethereal — meer kwalachtig/aurora dan reptiel.
 * Vliegt van links naar rechts (of vice versa) op z ≈ camerazicht, tussen de objecten door.
 */
const activeDragons = [];

function createSpaceDragon() {
  const group = new THREE.Group();

  // Richting en startpositie
  const leftToRight = Math.random() > 0.5;
  const startX = leftToRight ? -350 : 350;
  const endX = leftToRight ? 350 : -350;
  const baseY = (Math.random() - 0.5) * 150;
  const baseZ = -30 + (Math.random() - 0.5) * 80;

  // Kleurenschema: bioluminescent blauw/groen/paars
  const hues = [0x00ffcc, 0x4488ff, 0xaa44ff, 0x00aaff, 0x66ffaa];
  const mainColor = hues[Math.floor(Math.random() * hues.length)];
  const trailColor = hues[Math.floor(Math.random() * hues.length)];

  // Lichaam: 30 deeltjes in een slangachtige rij
  const bodyCount = 30;
  const bodyGeo = new THREE.BufferGeometry();
  const bodyPos = new Float32Array(bodyCount * 3);
  const bodySizes = new Float32Array(bodyCount);
  for (let i = 0; i < bodyCount; i++) {
    bodyPos[i * 3] = (i / bodyCount) * 40 - 20;
    bodyPos[i * 3 + 1] = 0;
    bodyPos[i * 3 + 2] = 0;
    // Kop groot, staart dun
    const t = i / bodyCount;
    bodySizes[i] = t < 0.15 ? 3 + t * 15 : 5 * (1 - (t - 0.15) / 0.85);
  }
  bodyGeo.setAttribute("position", new THREE.BufferAttribute(bodyPos, 3));
  bodyGeo.setAttribute("size", new THREE.BufferAttribute(bodySizes, 1));
  const bodyMat = new THREE.PointsMaterial({
    color: mainColor, size: 4, transparent: true, opacity: 0.7,
    sizeAttenuation: true, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  group.add(new THREE.Points(bodyGeo, bodyMat));

  // Vleugels: twee sets van 15 deeltjes die zijwaarts uitsteken
  for (const side of [-1, 1]) {
    const wingCount = 15;
    const wingGeo = new THREE.BufferGeometry();
    const wingPos = new Float32Array(wingCount * 3);
    const wingSizes = new Float32Array(wingCount);
    for (let i = 0; i < wingCount; i++) {
      const t = i / wingCount;
      wingPos[i * 3] = -5 + t * 12;
      wingPos[i * 3 + 1] = side * (2 + t * 8);
      wingPos[i * 3 + 2] = t * 2;
      wingSizes[i] = 2 + (1 - t) * 3;
    }
    wingGeo.setAttribute("position", new THREE.BufferAttribute(wingPos, 3));
    wingGeo.setAttribute("size", new THREE.BufferAttribute(wingSizes, 1));
    const wingMat = new THREE.PointsMaterial({
      color: mainColor, size: 3, transparent: true, opacity: 0.4,
      sizeAttenuation: true, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false,
    });
    group.add(new THREE.Points(wingGeo, wingMat));
  }

  // Staart-trail: 40 deeltjes met afnemende opacity (via size)
  const trailCount = 40;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(trailCount * 3);
  const trailSizes = new Float32Array(trailCount);
  for (let i = 0; i < trailCount; i++) {
    trailPos[i * 3] = -20 - i * 2.5;
    trailPos[i * 3 + 1] = 0;
    trailPos[i * 3 + 2] = 0;
    trailSizes[i] = 3 * Math.pow(1 - i / trailCount, 1.5);
  }
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("size", new THREE.BufferAttribute(trailSizes, 1));
  const trailMat = new THREE.PointsMaterial({
    color: trailColor, size: 2.5, transparent: true, opacity: 0.35,
    sizeAttenuation: true, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  group.add(new THREE.Points(trailGeo, trailMat));

  // Glow core (kop): punt-licht-achtig
  const glowGeo = new THREE.SphereGeometry(2, 8, 6);
  const glowMat = new THREE.MeshBasicMaterial({
    color: mainColor, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(18, 0, 0);
  group.add(glow);

  group.position.set(startX, baseY, baseZ);

  const dur = 3 + Math.random() * 4;  // 3-7 sec fly-across
  const speed = (endX - startX) / dur;
  const waveFreq = 0.5 + Math.random() * 1.5;
  const waveAmp = 5 + Math.random() * 10;
  const yWaveFreq = 0.3 + Math.random();
  const yWaveAmp = 3 + Math.random() * 5;

  return {
    group, startTime: performance.now() / 1000, dur, startX, baseY, baseZ,
    speed, waveFreq, waveAmp, yWaveFreq, yWaveAmp, leftToRight,
  };
}

function updateDragons(t, scene) {
  for (let i = activeDragons.length - 1; i >= 0; i--) {
    const d = activeDragons[i];
    const elapsed = t - d.startTime;
    if (elapsed > d.dur + 1) {
      scene.remove(d.group);
      d.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      activeDragons.splice(i, 1);
      continue;
    }

    const progress = elapsed / d.dur;
    const x = d.startX + d.speed * elapsed;
    const sinWave = Math.sin(elapsed * d.waveFreq * Math.PI * 2) * d.waveAmp;
    const yWave = Math.sin(elapsed * d.yWaveFreq * Math.PI * 2) * d.yWaveAmp;

    d.group.position.set(x, d.baseY + yWave, d.baseZ + sinWave);

    // Ondulatie: lichte rotatie voor vloeiende slangenbeweging
    d.group.rotation.z = Math.sin(elapsed * d.waveFreq * Math.PI * 2) * 0.15;
    d.group.rotation.y = (d.leftToRight ? 0 : Math.PI) +
      Math.sin(elapsed * 0.8) * 0.1;

    // Vleugelklap-animatie: update wing Y-posities
    d.group.children.forEach((child, ci) => {
      if (ci === 1 || ci === 2) { // vleugels
        const side = ci === 1 ? -1 : 1;
        const posArr = child.geometry.attributes.position.array;
        for (let j = 0; j < posArr.length / 3; j++) {
          const wingT = j / (posArr.length / 3);
          const flap = Math.sin(elapsed * 3 + wingT * 2) * (3 + wingT * 5);
          posArr[j * 3 + 1] = side * (2 + wingT * 8 + flap);
        }
        child.geometry.attributes.position.needsUpdate = true;
      }
    });

    // Fade in/out
    const alpha = progress < 0.1 ? progress / 0.1
      : progress > 0.85 ? (1 - progress) / 0.15
      : 1;
    d.group.children.forEach((child) => {
      if (child.material && child.material.opacity !== undefined) {
        child.material.opacity = child.material.userData?.baseOpacity
          ? child.material.userData.baseOpacity * alpha
          : alpha * 0.6;
      }
    });
  }
}

/** Voeg ruimtelijke nevellagen + sterren + achtergrondnebula toe aan de scene.
 *  Retourneert een THREE.Group die meebeweegt met de camera voor stabiele achtergrond. */
function addSpaceEnvironment(scene) {
  // ── Fog voor dieptesuggestie ──────────────────────────────────────
  scene.fog = new THREE.FogExp2(0x0f172a, 0.0015);

  // Alles in een groep zodat we die aan de camera kunnen koppelen
  const envGroup = new THREE.Group();
  envGroup.name = "spaceEnvironment";

  // ── Sterrveld ─────────────────────────────────────────────────────
  const starCount = 3000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 300 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    starSizes[i] = 0.5 + Math.random() * 1.5;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));
  const starMat = new THREE.PointsMaterial({
    color: 0xccddff, size: 1.2, transparent: true, opacity: 0.8,
    sizeAttenuation: true, fog: false,
  });
  envGroup.add(new THREE.Points(starGeo, starMat));

  // ── Nevellagen: meer, groter, duidelijker ─────────────────────────
  const nebulaLayers = [
    { z: -60,  x: -40,  y: 20,   scale: 150, hue: 220, sat: 65, opacity: 0.18 },
    { z: -60,  x: 60,   y: -10,  scale: 130, hue: 200, sat: 55, opacity: 0.14 },
    { z: -180, x: -80,  y: -30,  scale: 300, hue: 260, sat: 55, opacity: 0.22 },
    { z: -180, x: 100,  y: 40,   scale: 260, hue: 250, sat: 50, opacity: 0.18 },
    { z: -320, x: 0,    y: 0,    scale: 450, hue: 280, sat: 45, opacity: 0.28 },
    { z: -320, x: -120, y: -40,  scale: 350, hue: 300, sat: 35, opacity: 0.20 },
    { z: -500, x: 60,   y: 20,   scale: 600, hue: 270, sat: 40, opacity: 0.30 },
    { z: 120,  x: -30,  y: 30,   scale: 200, hue: 205, sat: 60, opacity: 0.10 },
    { z: 120,  x: 50,   y: -20,  scale: 180, hue: 230, sat: 50, opacity: 0.08 },
  ];
  for (const layer of nebulaLayers) {
    const tex = createNebulaTexture(256, 256, layer.hue, layer.sat, layer.opacity);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: layer.opacity,
      depthWrite: false, fog: true, blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(layer.scale, layer.scale, 1);
    sprite.position.set(
      layer.x + (Math.random() - 0.5) * layer.scale * 0.3,
      layer.y + (Math.random() - 0.5) * layer.scale * 0.2,
      layer.z
    );
    envGroup.add(sprite);
  }

  // ── Achtergrond-nebula horizon: grote bol met inward-facing textuur ─
  const horizonTex = createNebulaTexture(512, 256, 240, 50, 0.4);
  horizonTex.wrapS = THREE.RepeatWrapping;
  horizonTex.wrapT = THREE.ClampToEdgeWrapping;
  const horizonGeo = new THREE.SphereGeometry(800, 32, 16);
  const horizonMat = new THREE.MeshBasicMaterial({
    map: horizonTex, side: THREE.BackSide, transparent: true,
    opacity: 0.5, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending,
  });
  envGroup.add(new THREE.Mesh(horizonGeo, horizonMat));

  scene.add(envGroup);
  return envGroup;
}

/** Verwijder alle labels uit de CSS2DRenderer DOM — nodig omdat de
 *  singleton niet automatisch opruimt bij ForceGraph3D remount.       */
function clearCSSLabels() {
  const el = cssRenderer.domElement;
  while (el.firstChild) el.removeChild(el.firstChild);
  orbitingScrolls.clear();
  openScrolls.length = 0;
}

const API_BASE = () =>
  window.location.port === "5174" ? "http://localhost:8082" : "";

/* ── Perkamentrol tracking ─────────────────────────────────────────── */
/** Set van { css2d, radius, phase } objecten voor 3D orbit animatie */
const orbitingScrolls = new Set();
/** Geordende array van open scroll DOM-elementen (max 3) */
const openScrolls = [];
const MAX_OPEN_SCROLLS = 3;

const SYSTEM_FIELDS = new Set([
  "id", "opvoer", "afvoer", "rel_id", "versie", "_weergavenaam",
]);

/* ── Helpers ────────────────────────────────────────────────────────── */

function berekenWeergavenaam(record, entityMeta, typesByTypenaam) {
  const afgeleide = entityMeta?.afgeleideVelden;
  if (!Array.isArray(afgeleide) || afgeleide.length === 0) return null;
  const weergave = afgeleide.find((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (!weergave?.afleidingsregel) return null;

  // Record is al geflattened: hub-data op hub-niveau, enkelvoudig als object
  const ctx = {};
  if (Array.isArray(entityMeta.onderliggende)) {
    for (const child of entityMeta.onderliggende) {
      const childMeta = typesByTypenaam?.[child.doeltype];
      const key =
        childMeta?.klassenaam || child.doeltype.replace(/^[^_]+_/, "");
      const raw = record?.[child.jsonRolnaam];
      // Enkelvoudig = object, meervoudig = array
      const actief = Array.isArray(raw)
        ? raw.find((r) => !r.afvoer) || raw[0]
        : raw;
      if (!actief) continue;
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
  // In geflattened formaat zijn hub-data velden al op het item-niveau
  const vals = [];
  for (const [k, v] of Object.entries(item)) {
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
      radius: 5,
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
 * Data is in geflattened formaat:
 * - Hub-data velden staan op hub-niveau (geen geneste "data" arrays)
 * - Enkelvoudige types zijn objecten (niet arrays)
 * - Aanvang/Einde worden als kleine "manen" dicht bij hun parent weergegeven
 *
 * @param {string}  label              Weergavenaam van de instantie
 * @param {object}  record             Het geflattende entity record
 * @param {object}  entityMeta         Schema metadata van het entiteitstype
 * @param {object}  typesByTypenaam    Alle type metadata, indexed op typenaam
 * @param {object}  secondaries        Map van relatieNodeId → { record, doeltype, doelMeta, label }
 * @param {object}  reverseEntities    Map van gqlFieldName → { items, bronTypenaam, bronMeta }
 */
function buildConcreteGraph(
  label, record, entityMeta, typesByTypenaam, secondaries = {}, reverseEntities = {}
) {
  const nodes = [
    {
      id: "__self__",
      label,
      color: entityMeta?.kleur || "#60a5fa",
      radius: 4,
      nodeType: "self",
    },
  ];
  const links = [];

  // Verzamel eerst de GE-nodes, zodat Aanvang/Einde als manen
  // aan hun parent-hub (of direct aan __self__) gehangen kunnen worden.
  // parentMap: geId van de hub → geId van de parent
  const moonTargets = {};

  for (const child of entityMeta?.onderliggende || []) {
    const childMeta = typesByTypenaam?.[child.doeltype];
    if (!childMeta) continue;

    const isMoon =
      child.doeltype.includes("Aanvang") || child.doeltype.includes("Einde");

    // Geflattened: enkelvoudig = object, meervoudig = array
    const raw = record?.[child.jsonRolnaam];
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (items.length === 0) continue;

    const active = items.filter((i) => !i.afvoer);
    const show = active.length > 0 ? active : [items[0]];

    for (let i = 0; i < show.length; i++) {
      const item = show[i];
      const geId = `ge::${child.doeltype}::${item.rel_id ?? item.versie ?? i}`;
      const klassenaam =
        childMeta.klassenaam || child.doeltype.replace(/^[^_]+_/, "");
      const display = extractGEDisplay(item, childMeta, typesByTypenaam);

      if (isMoon) {
        // Aanvang/Einde: kleine maan dicht bij de parent entiteit
        const moonColor = child.doeltype.includes("Aanvang")
          ? "#4ade80"   // groen voor aanvang
          : "#f87171";  // rood voor einde
        nodes.push({
          id: geId,
          label: klassenaam,
          displayData: display,
          color: moonColor,
          radius: 1.2,
          nodeType: "moon",
        });
        links.push({
          source: "__self__",
          target: geId,
          color: `${moonColor}55`,
          distance: 10,
        });
        continue;
      }

      let color = childMeta.kleur || "#a3e635";
      let nodeType = "ge_data";
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

      // ── Eventuele Aanvang/Einde manen op een hub ──────────────────
      if (childMeta.ge_subtype === "hub" && Array.isArray(childMeta.onderliggende)) {
        for (const hubChild of childMeta.onderliggende) {
          const hcMeta = typesByTypenaam?.[hubChild.doeltype];
          if (!hcMeta) continue;
          const isHubMoon =
            hubChild.doeltype.includes("Aanvang") ||
            hubChild.doeltype.includes("Einde");
          if (!isHubMoon) continue;

          const hubRaw = item[hubChild.jsonRolnaam];
          const hubItem = Array.isArray(hubRaw) ? hubRaw[0] : hubRaw;
          if (!hubItem) continue;

          const moonId = `moon::${hubChild.doeltype}::${item.rel_id ?? item.versie ?? i}`;
          const moonColor = hubChild.doeltype.includes("Aanvang")
            ? "#4ade80"
            : "#f87171";
          const moonDisplay = extractGEDisplay(hubItem, hcMeta, typesByTypenaam);
          nodes.push({
            id: moonId,
            label: hcMeta.klassenaam || hubChild.doeltype.replace(/^[^_]+_/, ""),
            displayData: moonDisplay,
            color: moonColor,
            radius: 1.0,
            nodeType: "moon",
          });
          links.push({
            source: geId,
            target: moonId,
            color: `${moonColor}44`,
            distance: 10,
          });
        }
      }

      // ── Secondaire entiteit via relatie ──────────────────────────
      const sec = secondaries[geId];
      if (sec) {
        const secEntityId = `sec::${sec.doeltype}::${sec.id}`;
        const secMeta = sec.doelMeta;
        const secLabel = sec.label || sec.doeltype;

        nodes.push({
          id: secEntityId,
          label: secLabel,
          color: secMeta?.kleur || "#60a5fa",
          radius: 5,
          nodeType: "sec_entity",
          entityTypenaam: sec.doeltype,
          entityPadnaam: secMeta?.padnaam,
          entityId: sec.id,
        });
        links.push({
          source: geId,
          target: secEntityId,
          color: `${color}88`,
        });

        // De GE's van de secondaire entiteit (ook geflattened)
        for (const secChild of secMeta?.onderliggende || []) {
          const scMeta = typesByTypenaam?.[secChild.doeltype];
          if (!scMeta) continue;

          const secIsMoon =
            secChild.doeltype.includes("Aanvang") ||
            secChild.doeltype.includes("Einde");

          const secRaw = sec.record?.[secChild.jsonRolnaam];
          const secItems = Array.isArray(secRaw) ? secRaw : secRaw ? [secRaw] : [];
          if (secItems.length === 0) continue;

          const secActive = secItems.filter((si) => !si.afvoer);
          const secShow = secActive.length > 0 ? secActive : [secItems[0]];

          for (let j = 0; j < secShow.length; j++) {
            const si = secShow[j];
            const secGeId = `sec-ge::${secChild.doeltype}::${si.rel_id ?? si.versie ?? j}`;
            const secKlass =
              scMeta.klassenaam || secChild.doeltype.replace(/^[^_]+_/, "");
            const secDisplay = extractGEDisplay(si, scMeta, typesByTypenaam);

            if (secIsMoon) {
              const moonColor = secChild.doeltype.includes("Aanvang")
                ? "#4ade80"
                : "#f87171";
              nodes.push({
                id: secGeId,
                label: secKlass,
                displayData: secDisplay,
                color: moonColor,
                radius: 0.8,
                nodeType: "moon",
              });
              links.push({
                source: secEntityId,
                target: secGeId,
                color: `${moonColor}33`,
                distance: 8,
              });
            } else {
              let secColor = scMeta.kleur || "#a3e635";
              let secNodeType = "ge_data";

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
  }

  // ── Reverse relaties: entiteiten die naar __self__ wijzen ─────────
  for (const [, revData] of Object.entries(reverseEntities)) {
    for (const item of revData.items) {
      const revId = `rev::${revData.bronTypenaam}::${item.id}`;
      const revLabel =
        item.weergavenaam ||
        berekenWeergavenaam(item, revData.bronMeta, typesByTypenaam) ||
        fallbackLabel(item);
      const revColor = revData.bronMeta?.kleur || "#fbbf24";

      nodes.push({
        id: revId,
        label: revLabel,
        color: revColor,
        radius: 4,
        nodeType: "rev_entity",
        entityTypenaam: revData.bronTypenaam,
        entityPadnaam: revData.bronMeta?.padnaam,
        entityId: item.id,
      });
      links.push({
        source: revId,
        target: "__self__",
        color: `${revColor}55`,
        distance: 80,
      });
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
  const [concreteReverseEntities, setConcreteReverseEntities] = useState({});

  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState("graphql"); // "rest" | "graphql"
  const lastClickRef = useRef({ time: 0, nodeId: null });
  const containerRef = useRef(null);

  /* ── Navigatiegeschiedenis ([ ] toetsen) ─────────────────────────── */
  const navHistoryRef = useRef([]);       // array van snapshots
  const navHistoryIdxRef = useRef(-1);    // huidige positie
  const isRestoringHistoryRef = useRef(false);

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
      concreteSecondaries,
      concreteReverseEntities
    );
  }, [focusedInstance, concreteRecord, concreteSecondaries, concreteReverseEntities, typesByTypenaam]);

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

  /* ── CSS2D label cleanup bij view-wissel ──────────────────────────── */
  // CSS2DRenderer houdt DOM-elements van vorige views niet bij;
  // bij wisselen van graphData blijven ze in de DOM hangen.
  // Daarom verwijderen we ze expliciet.

  useEffect(() => {
    const dom = cssRenderer.domElement;
    dom.querySelectorAll('.node-label').forEach((el) => el.remove());
  }, [viewMode]);

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

  /* ── Space-omgeving: fog, sterren, nevels ────────────────────────── */
  // Track welke scene al environment heeft; reset bij ForceGraph3D remount
  const envSceneRef = useRef(null);
  const envGroupRef = useRef(null);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const scene = fg.scene();
    if (!scene || scene === envSceneRef.current) return;
    envGroupRef.current = addSpaceEnvironment(scene);
    envSceneRef.current = scene;
  });

  /* ── Space bird fly-by + ruimtedraak (periodiek) ─────────────────── */
  const spawnDragon = useCallback(() => {
    const fg = fgRef.current;
    const scene = fg?.scene();
    if (!scene) return;
    sfx.spaceBird();
    const dragon = createSpaceDragon();
    scene.add(dragon.group);
    activeDragons.push(dragon);
  }, []);

  useEffect(() => {
    // Start random ruimtevogels+draken na 8-25 sec, dan elke 15-45 sec
    let timer;
    const scheduleNext = () => {
      const delay = (15 + Math.random() * 30) * 1000;
      timer = setTimeout(() => {
        spawnDragon();
        scheduleNext();
      }, delay);
    };
    // Eerste vogel+draak na 8-25 sec
    timer = setTimeout(() => {
      spawnDragon();
      scheduleNext();
    }, (8 + Math.random() * 17) * 1000);
    return () => clearTimeout(timer);
  }, [spawnDragon]);

  /* ── d3-force tuning ─────────────────────────────────────────────── */

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (viewMode === "instances") {
      fg.d3Force("charge")?.strength(-80);
      fg.d3Force("link")?.distance(50);
    } else if (viewMode === "concrete") {
      fg.d3Force("charge")?.strength(-100);
      // Per-link afstand: manen dichterbij hun parent
      fg.d3Force("link")?.distance((link) => link.distance || 60);
    } else {
      fg.d3Force("charge")?.strength(-120);
      fg.d3Force("link")?.distance(80);
    }

    // Camera resetten na view-wissel
    if (viewMode !== "meta") {
      const dist = viewMode === "instances" ? 250 : 200;
      setTimeout(() => {
        fg.cameraPosition(
          { x: 0, y: 0, z: dist },
          { x: 0, y: 0, z: 0 },
          800
        );
      }, 600);
    }
  }, [viewMode, graphData]);

  /* ── Animatieloop: orbit + zoom-scale perkamentrollen ───────────── */
  useEffect(() => {
    let animId;
    const ORBIT_SPEED = 0.15; // radialen per seconde
    const MIN_ORBIT_R = 8;    // minimum orbit-straal in scene-units
    const startTime = performance.now();

    const animate = () => {
      const fg = fgRef.current;
      const t = (performance.now() - startTime) / 1000;

      // Zoom-scale + camera-gevoeligheid mee laten schalen
      if (fg) {
        const cam = fg.camera();
        if (cam) {
          const dist = cam.position.length();
          const s = Math.max(0.3, Math.min(2.5, 180 / dist));
          document.documentElement.style.setProperty(
            "--scroll-scale", s.toFixed(3)
          );

          // Muisgevoeligheid: hoe dichter bij (kleiner dist), hoe trager
          const controls = fg.controls();
          if (controls) {
            const sensitivity = Math.max(0.08, Math.min(2.5, dist / 200));
            controls.rotateSpeed = sensitivity;
            if (controls.panSpeed !== undefined) controls.panSpeed = sensitivity;
          }

          // Achtergrond meelatenbewegen met camera → stabiele sterren/nevels
          const eg = envGroupRef.current;
          if (eg) eg.position.copy(cam.position);
        }
      }

      // Ruimtedraak-animatie (absoluut tijdstip, want dragon.startTime is absoluut)
      if (fg) {
        const scene = fg.scene();
        if (scene) updateDragons(performance.now() / 1000, scene);
      }

      // Orbit: update positie van elk perkamentrol CSS2DObject
      for (const entry of orbitingScrolls) {
        const angle = t * ORBIT_SPEED + entry.phase;
        const r = Math.max(MIN_ORBIT_R, entry.radius * 2.2);
        entry.css2d.position.set(
          Math.cos(angle) * r,
          -0.5,
          Math.sin(angle) * r
        );
      }

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [viewMode, graphData]);

  /* ── Auto-close scrolls bij camera-drag ─────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let startX = 0, startY = 0;
    const DRAG_THRESHOLD = 8; // pixels

    const onDown = (e) => { startX = e.clientX; startY = e.clientY; };
    const onUp = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD && openScrolls.length > 0) {
        const toClose = [...openScrolls];
        openScrolls.length = 0;
        toClose.forEach((el, i) => {
          setTimeout(() => {
            if (el.classList.contains("perkamentrol--open")) {
              el.classList.remove("perkamentrol--open");
              sfx.paperWhisper("close");
            }
          }, i * 180);
        });
      }
    };

    container.addEventListener("pointerdown", onDown, true);
    container.addEventListener("pointerup", onUp, true);
    return () => {
      container.removeEventListener("pointerdown", onDown, true);
      container.removeEventListener("pointerup", onUp, true);
    };
  }, []);

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
      clearCSSLabels();

      sfx.woosh("in");
      flyToNode(entityNode, 2);
      const wormholeTimer = setTimeout(() => setWormholeActive(true), 200);

      const base = API_BASE();
      const fetchPromise =
        dataSource === "graphql"
          ? fetchInstancesGraphQL(
              base,
              entityNode.padnaam,
              entityNode.id,
              typesByTypenaam,
              50
            )
          : fetch(`${base}/full/${entityNode.padnaam}?page=1&size=50`)
              .then((r) => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json();
              })
              .then((data) => {
                const key = Object.keys(data).find((k) =>
                  Array.isArray(data[k])
                );
                const records = key ? data[key] : [];
                // Normaliseer REST naar geflattened formaat
                const eMeta = typesByTypenaam[entityNode.id];
                return records.map((rec) => flattenRecord(rec, eMeta, typesByTypenaam));
              });

      fetchPromise
        .then((records) => {
          if (records.length === 0) {
            clearTimeout(wormholeTimer);
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
          clearTimeout(wormholeTimer);
          setWormholeActive(false);
          setLoading(false);
        });
    },
    [typesByTypenaam, flyToNode, dataSource]
  );

  /* ── Wormhole: instances → concreet ──────────────────────────────── */

  const enterConcrete = useCallback(
    (instanceNode, overrideEntity) => {
      // overrideEntity: optioneel { typenaam, padnaam, id, label, color }
      // voor drill-through vanuit concrete view (sec_entity / rev_entity)
      const entityInfo = overrideEntity || focusedEntity;
      const instId = overrideEntity?.id ?? instanceNode.instanceId;
      const instLabel = overrideEntity?.label ?? instanceNode.label;
      if (!entityInfo || !instId) return;

      setSelectedNode(null);
      setLoading(true);
      clearCSSLabels();

      sfx.woosh("in");
      flyToNode(instanceNode, 2);
      const wormholeTimer = setTimeout(() => setWormholeActive(true), 200);

      // Bij drill-through: concrete state wissen zodat oude nodes niet blijven plakken
      if (overrideEntity) {
        setConcreteRecord(null);
        setConcreteSecondaries({});
        setConcreteReverseEntities({});
        setFocusedEntity({
          typenaam: overrideEntity.typenaam,
          padnaam: overrideEntity.padnaam,
          label: overrideEntity.label || overrideEntity.typenaam,
          color: overrideEntity.color,
        });
      }

      const base = API_BASE();
      const entityPadnaam = entityInfo.padnaam;
      const entityTypenaam = entityInfo.typenaam;

      // Reverse relaties ontdekken (welke entiteiten wijzen naar dit type?)
      const reverseRels = discoverReverseRelations(entityTypenaam, typesByTypenaam);

      const entityFetchPromise =
        dataSource === "graphql"
          ? fetchFullEntityGraphQL(
              base,
              entityPadnaam,
              instId,
              entityTypenaam,
              typesByTypenaam,
              reverseRels
            )
          : fetch(`${base}/full/${entityPadnaam}/${instId}`).then((r) => {
              if (!r.ok) throw new Error(`${r.status}`);
              return r.json();
            }).then((rec) => {
              // Normaliseer REST naar geflattened formaat
              const eMeta = typesByTypenaam[entityTypenaam];
              return flattenRecord(rec, eMeta, typesByTypenaam);
            });

      entityFetchPromise
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

            // Geflattened: enkelvoudig = object, meervoudig = array
            const raw = record[child.jsonRolnaam];
            const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
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
                let secRecord;
                if (dataSource === "graphql") {
                  secRecord = await fetchFullEntityGraphQL(
                    base,
                    f.padnaam,
                    f.id,
                    f.doeltype,
                    typesByTypenaam
                  );
                  if (!secRecord) return;
                } else {
                  const r = await fetch(`${base}/full/${f.padnaam}/${f.id}`);
                  if (!r.ok) return;
                  secRecord = await r.json();
                  // Normaliseer REST naar geflattened formaat
                  secRecord = flattenRecord(secRecord, f.doelMeta, typesByTypenaam);
                }

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

          // ── Reverse relaties extraheren uit GQL response ────────────
          const revEnts = {};
          if (dataSource === "graphql") {
            for (const rev of reverseRels) {
              const items = record[rev.gqlFieldName];
              if (Array.isArray(items) && items.length > 0) {
                revEnts[rev.gqlFieldName] = {
                  items,
                  bronTypenaam: rev.bronTypenaam,
                  bronMeta: rev.bronMeta,
                  relatieTypenaam: rev.relatieTypenaam,
                };
              }
              // Verwijder gerelateerde_* van het record zodat buildConcreteGraph
              // het niet als GE-data probeert te renderen
              delete record[rev.gqlFieldName];
            }
          }

          setFocusedInstance({
            id: instId,
            label: instLabel,
            entityTypenaam,
          });
          setConcreteRecord(record);
          setConcreteSecondaries(secs);
          setConcreteReverseEntities(revEnts);
          setViewMode("concrete");

          setTimeout(() => {
            setWormholeActive(false);
            setLoading(false);
          }, 500);
        })
        .catch((err) => {
          console.error("Concreet laden mislukt:", err);
          clearTimeout(wormholeTimer);
          setWormholeActive(false);
          setLoading(false);
        });
    },
    [focusedEntity, typesByTypenaam, flyToNode, dataSource]
  );

  /* ── Terug-navigatie ─────────────────────────────────────────────── */

  const goBack = useCallback(() => {
    if (viewMode === "meta") return;
    sfx.woosh("out");
    setSelectedNode(null);
    setWormholeActive(true);
    clearCSSLabels();

    setTimeout(() => {
      if (viewMode === "concrete") {
        setFocusedInstance(null);
        setConcreteRecord(null);
        setConcreteSecondaries({});
        setConcreteReverseEntities({});
        // Na drill-through is er geen instances-lijst; ga dan naar meta
        if (instanceRecords.length === 0) {
          setFocusedEntity(null);
          setViewMode("meta");
        } else {
          setViewMode("instances");
        }
      } else {
        setFocusedEntity(null);
        setInstanceRecords([]);
        setViewMode("meta");
      }
      setTimeout(() => setWormholeActive(false), 400);
    }, 300);
  }, [viewMode, instanceRecords]);

  const goToMeta = useCallback(() => {
    if (viewMode === "meta") return;
    sfx.woosh("out");
    setSelectedNode(null);
    setWormholeActive(true);
    clearCSSLabels();

    setTimeout(() => {
      setFocusedInstance(null);
      setConcreteRecord(null);
      setConcreteSecondaries({});
      setConcreteReverseEntities({});
      setFocusedEntity(null);
      setInstanceRecords([]);
      setViewMode("meta");
      setTimeout(() => setWormholeActive(false), 400);
    }, 300);
  }, [viewMode]);

  /* ── Navigatiegeschiedenis: snapshot bij stabiele state ────────── */
  useEffect(() => {
    if (loading || wormholeActive) return;
    if (isRestoringHistoryRef.current) {
      isRestoringHistoryRef.current = false;
      return;
    }
    const snap = {
      viewMode, focusedEntity, instanceRecords,
      focusedInstance, concreteRecord, concreteSecondaries, concreteReverseEntities,
    };
    const history = navHistoryRef.current;
    const idx = navHistoryIdxRef.current;
    // Voorkom dubbele push voor zelfde positie
    if (idx >= 0 && history[idx]) {
      const prev = history[idx];
      if (prev.viewMode === snap.viewMode
        && prev.focusedEntity?.typenaam === snap.focusedEntity?.typenaam
        && prev.focusedInstance?.id === snap.focusedInstance?.id) return;
    }
    // Truncate vooruitgeschiedenis en push
    navHistoryRef.current = history.slice(0, idx + 1);
    navHistoryRef.current.push(snap);
    // Beperk tot 50 entries
    if (navHistoryRef.current.length > 50) {
      navHistoryRef.current = navHistoryRef.current.slice(-50);
    }
    navHistoryIdxRef.current = navHistoryRef.current.length - 1;
  }, [viewMode, focusedEntity, focusedInstance, concreteRecord, loading, wormholeActive]);

  const restoreSnapshot = useCallback((snap) => {
    isRestoringHistoryRef.current = true;
    clearCSSLabels();
    setSelectedNode(null);
    setViewMode(snap.viewMode);
    setFocusedEntity(snap.focusedEntity);
    setInstanceRecords(snap.instanceRecords);
    setFocusedInstance(snap.focusedInstance);
    setConcreteRecord(snap.concreteRecord);
    setConcreteSecondaries(snap.concreteSecondaries);
    setConcreteReverseEntities(snap.concreteReverseEntities);
  }, []);

  const historyBack = useCallback(() => {
    const idx = navHistoryIdxRef.current;
    if (idx <= 0) return;
    sfx.woosh("out");
    navHistoryIdxRef.current = idx - 1;
    restoreSnapshot(navHistoryRef.current[idx - 1]);
  }, [restoreSnapshot]);

  const historyForward = useCallback(() => {
    const idx = navHistoryIdxRef.current;
    if (idx >= navHistoryRef.current.length - 1) return;
    sfx.woosh("in");
    navHistoryIdxRef.current = idx + 1;
    restoreSnapshot(navHistoryRef.current[idx + 1]);
  }, [restoreSnapshot]);

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
        else if (
          viewMode === "concrete" &&
          (node.nodeType === "sec_entity" || node.nodeType === "rev_entity") &&
          node.entityTypenaam &&
          node.entityPadnaam &&
          node.entityId
        ) {
          // Drill-through: spring naar de concrete view van deze entiteit
          const meta = typesByTypenaam[node.entityTypenaam];
          enterConcrete(node, {
            typenaam: node.entityTypenaam,
            padnaam: node.entityPadnaam,
            id: node.entityId,
            label: meta?.klassenaam || node.entityTypenaam,
            color: meta?.kleur || node.color,
          });
        }
        return;
      }

      // Eerste klik op een drillable node in instances/meta: vlieg ernaartoe
      // Als de node al geselecteerd was (= al in beeld), drill direct
      if (
        viewMode === "meta" &&
        node.metatype === "entiteit" &&
        selectedNode?.id === node.id
      ) {
        lastClickRef.current = { time: 0, nodeId: null };
        enterInstances(node);
        return;
      }
      if (
        viewMode === "instances" &&
        node.nodeType === "instance" &&
        selectedNode?.id === node.id
      ) {
        lastClickRef.current = { time: 0, nodeId: null };
        enterConcrete(node);
        return;
      }

      lastClickRef.current = { time: now, nodeId: node.id };
      setSelectedNode(node);
      sfx.ping();

      // In concrete view: selecteren + vliegen naar sec/rev entiteiten
      if (viewMode === "concrete") {
        if (node.nodeType === "sec_entity" || node.nodeType === "rev_entity") {
          sfx.zoom();
          flyToNode(node, 60);
        }
        return;
      }

      sfx.zoom();
      const dist =
        node.nodeType === "instance" || node.nodeType === "ge_data" ? 80 : 120;
      flyToNode(node, dist);
    },
    [viewMode, selectedNode, enterInstances, enterConcrete, flyToNode, typesByTypenaam]
  );

  /* ── Keyboard ────────────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e) => {
      // Alt+pijl: navigatiegeschiedenis (voorkom ook browser back/forward)
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        if (e.key === "ArrowLeft") historyBack();
        else historyForward();
        return;
      }
      // [ en ] voor navigatiegeschiedenis
      if (e.key === "[" || e.key === "]") {
        if (e.key === "[") historyBack();
        else historyForward();
        return;
      }
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
        else if (
          viewMode === "concrete" &&
          (selectedNode.nodeType === "sec_entity" || selectedNode.nodeType === "rev_entity") &&
          selectedNode.entityTypenaam &&
          selectedNode.entityPadnaam &&
          selectedNode.entityId
        ) {
          const meta = typesByTypenaam[selectedNode.entityTypenaam];
          enterConcrete(selectedNode, {
            typenaam: selectedNode.entityTypenaam,
            padnaam: selectedNode.entityPadnaam,
            id: selectedNode.entityId,
            label: meta?.klassenaam || selectedNode.entityTypenaam,
            color: meta?.kleur || selectedNode.color,
          });
        }
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, selectedNode, goBack, enterInstances, enterConcrete, typesByTypenaam, historyBack, historyForward]);

  /* ── Ambient drone: start/stop + bewegingsdetectie ───────────────── */
  // De drone start bij eerste pointer-interactie (autoplay-policy) en
  // stopt bij unmount. Pointer-snelheid stuurt gain + filter aan.
  // We luisteren op window i.p.v. containerRef omdat bij eerste render
  // de ref nog null is (vroege return voor loading-state).

  useEffect(() => {
    let lastX = 0, lastY = 0, lastT = 0;
    let fadeTimer = null;
    let started = false;

    const onMove = (e) => {
      const now = performance.now();
      if (!started) {
        sfx.droneStart();
        started = true;
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
        return;
      }

      const dt = now - lastT;
      if (dt < 16) return;           // max ~60 fps
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const speed = Math.sqrt(dx * dx + dy * dy) / dt; // px/ms
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;

      // Map speed naar 0..1 (0..2 px/ms = normaal muisgebruik)
      const intensity = Math.min(1, speed / 2);
      sfx.droneMove(intensity);

      // Na 120ms geen beweging → fade naar idle
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => sfx.droneMove(0), 120);
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearTimeout(fadeTimer);
      sfx.droneStop();
    };
  }, []);

  /* ── Domain toggle ───────────────────────────────────────────────── */

  const toggleDomain = useCallback(
    (dom) => {
      setActiveDomains((prev) => {
        const cur = prev === null ? new Set(domains) : new Set(prev);
        const wasOn = cur.has(dom);
        if (wasOn) cur.delete(dom);
        else cur.add(dom);
        sfx.tick(!wasOn);
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
    const isRevEntity = node.nodeType === "rev_entity";
    const isMoon = node.nodeType === "moon";

    const geo = new THREE.SphereGeometry(radius, isMoon ? 12 : 20, isMoon ? 8 : 14);
    const mat = new THREE.MeshLambertMaterial({
      color: node.color || "#94a3b8",
      transparent: true,
      opacity: isCenter ? 0.35 : (isSecEntity || isRevEntity) ? 0.65 : isMoon ? 0.9 : 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);

    if (isCenter || isSecEntity || isRevEntity) {
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
    else if (node.nodeType === "rev_entity")
      cssClass += " node-label--rev-entity";
    else if (node.nodeType === "moon")
      cssClass += " node-label--moon";
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

      const text = node.displayData;
      const isLong = text.length > 80;

      if (isLong) {
        // Titel blijft in el (main label op de bol)
        // Perkamentrol als orbiterend satelliet-element
        // Wrapper div voor CSS2DObject (CSS2DRenderer overschrijft
        // inline transform op het element — wrapper vangt dit op
        // zodat de inner .perkamentrol eigen scale kan houden)
        const scrollWrapper = document.createElement("div");
        const scrollEl = document.createElement("div");
        scrollEl.className = "perkamentrol";
        scrollWrapper.appendChild(scrollEl);

        const topRoll = document.createElement("div");
        topRoll.className = "perkamentrol-roll perkamentrol-roll--top";
        scrollEl.appendChild(topRoll);

        const body = document.createElement("div");
        body.className = "perkamentrol-body";
        const data = document.createElement("div");
        data.className = "ge-label-data";
        data.textContent = text;
        body.appendChild(data);
        scrollEl.appendChild(body);

        const bottomRoll = document.createElement("div");
        bottomRoll.className = "perkamentrol-roll perkamentrol-roll--bottom";
        scrollEl.appendChild(bottomRoll);

        scrollEl.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = scrollEl.classList.toggle("perkamentrol--open");
          sfx.paperWhisper(isOpen ? "open" : "close");
          if (isOpen) {
            openScrolls.push(scrollEl);
            // Sluit oudste als we > MAX_OPEN_SCROLLS hebben
            while (openScrolls.length > MAX_OPEN_SCROLLS) {
              const oldest = openScrolls.shift();
              oldest.classList.remove("perkamentrol--open");
              sfx.paperWhisper("close");
            }
          } else {
            const idx = openScrolls.indexOf(scrollEl);
            if (idx !== -1) openScrolls.splice(idx, 1);
          }
        });

        const scrollLbl = new CSS2DObject(scrollWrapper);
        // Startpositie — wordt overschreven door orbit-animatie
        scrollLbl.position.set(radius + 4, -1, 0);
        mesh.add(scrollLbl);

        // Registreer voor orbit-animatie met random startfase
        const entry = { css2d: scrollLbl, radius, phase: Math.random() * Math.PI * 2 };
        orbitingScrolls.add(entry);
      } else {
        const data = document.createElement("div");
        data.textContent = text;
        data.className = "ge-label-data";
        el.appendChild(data);
      }
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
    <div className="universum-container" ref={containerRef}>
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

        {/* REST / GraphQL toggle */}
        <div className="datasource-toggle">
          <button
            className={`ds-btn${dataSource === "rest" ? " ds-active" : ""}`}
            onClick={() => setDataSource("rest")}
            title="Data ophalen via REST /full endpoints"
          >
            REST
          </button>
          <button
            className={`ds-btn${dataSource === "graphql" ? " ds-active" : ""}`}
            onClick={() => setDataSource("graphql")}
            title="Data ophalen via GraphQL"
          >
            GQL
          </button>
        </div>
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
          key={`${viewMode}::${focusedInstance?.id ?? ""}::${focusedInstance?.entityTypenaam ?? ""}`}
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
