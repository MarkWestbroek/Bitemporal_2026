import { useEffect, useMemo, useRef, useState } from "react";
import "../shared/schema-viz.css";
import "../styles/tijdlijn-schema.css";
import {
  safeArray,
  tUitRegistratieTijdstip,
  microsecondeIntVanTijdstip,
  wijzigingKleur,
  wijzigingPatroonId,
  isPrimitiveWaarde,
  veldEntries,
  korteSamenvatting,
  platSlaHubItems,
  donkerdereRandkleurVanHex,
  leidEntiteitTypeAfUitKolomnaam,
} from "../shared/schemaUtils";
import html2canvas from "html2canvas";
import SchemaTijdlijnHeader from "../components/tijdlijn/SchemaTijdlijnHeader";
import SchemaTijdlijnControls from "../components/tijdlijn/SchemaTijdlijnControls";
import TijdlijnRegistratiePaneel from "../components/tijdlijn/TijdlijnRegistratiePaneel";
import TijdlijnRepresentatiePaneel from "../components/tijdlijn/TijdlijnRepresentatiePaneel";
import { bepaalOortjesUitChildGroups } from "../shared/oortjesUtils";

function normInt(v, fallback = 0) {
        const n = Number.parseInt(String(v), 10);
        return Number.isNaN(n) ? fallback : Math.max(0, n);
      }

      async function fetchJson(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return await res.json();
      }

      function endpointSegmentForEntityType(typeName, entityTypes) {
        const gekozenType = String(typeName || "");
        const meta = safeArray(entityTypes).find((item) => String(item?.typenaam || "") === gekozenType) || null;
        const segment = String(meta?.padnaam || meta?.meervoud || "").trim();
        if (segment) {
          return segment;
        }
        return `${gekozenType.toLowerCase()}s`;
      }

      function normaliseerIdComponent(value) {
        return String(value ?? "")
          .trim()
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_\-]/g, "_");
      }

      function undoTargetEntId(regId, entiteitId) {
        return `undo-target-ent-${normaliseerIdComponent(regId)}-${normaliseerIdComponent(entiteitId)}`;
      }

      function undoTargetRepId(regId, representatieNaam, representatieId) {
        return `undo-target-rep-${normaliseerIdComponent(regId)}-${normaliseerIdComponent(String(representatieNaam || "").toUpperCase())}-${normaliseerIdComponent(representatieId)}`;
      }

      function doelRepNaamKandidaten(repNaam, typeMetaByTypenaam) {
        const naam = String(repNaam || "").trim();
        if (!naam) return [];
        const meta = typeMetaByTypenaam?.[naam] || null;
        const bovenliggend = String(meta?.bovenliggendTypenaam || meta?.bovenliggend_typenaam || "").trim();
        const dataTypenaam = String(meta?.dataTypenaam || meta?.data_typenaam || "").trim();
        const afgeleidBovenliggend = naam.replace(/_(DATA|AANVANG|EINDE)$/i, "");
        const kandidaten = [naam, bovenliggend, dataTypenaam, afgeleidBovenliggend]
          .map((v) => String(v || "").trim())
          .filter((v) => v.length > 0);
        return Array.from(new Set(kandidaten));
      }

      function repBasisNaam(naam) {
        return String(naam || "").trim().toUpperCase().replace(/_(DATA|AANVANG|EINDE)$/i, "");
      }

      async function fetchAlleRegistraties(baseUrl) {
        const size = 100;
        let page = 1;
        const result = [];
        for (let i = 0; i < 30; i += 1) {
          const json = await fetchJson(`${baseUrl}/full/registraties?page=${page}&size=${size}`);
          const batch = safeArray(json?.Registraties);
          result.push(...batch);
          if (!json?.has_more || batch.length === 0) break;
          page += 1;
        }
        return result;
      }

      async function fetchRegistratieById(baseUrl, registratieId) {
        if (registratieId === null || registratieId === undefined || registratieId === "") {
          return null;
        }
        const res = await fetch(`${baseUrl}/full/registraties/${encodeURIComponent(registratieId)}`);
        if (!res.ok) {
          return null;
        }
        const json = await res.json();
        return json.Registratie || json;
      }

      function snapshotEntiteitUitPayload(payload, typeName) {
        if (!payload || typeof payload !== "object") return null;
        const direct = payload?.[typeName] ?? payload?.[String(typeName || "").toLowerCase()];
        if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;
        if (Object.prototype.hasOwnProperty.call(payload, "id")) return payload;
        const eersteObject = Object.values(payload).find((value) => value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "id"));
        return eersteObject || null;
      }

      function childArrayVoorRol(snapshot, child) {
        const kandidaten = [child?.jsonRolnaam, child?.rolnaam]
          .filter(Boolean)
          .flatMap((naam) => [naam, String(naam).toLowerCase(), `${String(naam).toLowerCase()}s`]);
        for (const kandidaat of kandidaten) {
          const direct = snapshot?.[kandidaat];
          if (Array.isArray(direct)) return direct;
        }
        const fallbackKey = Object.keys(snapshot || {}).find((key) => Array.isArray(snapshot?.[key]) && String(key).replace(/s$/i, "").toLowerCase() === String(child?.doeltype || "").toLowerCase());
        return fallbackKey ? safeArray(snapshot?.[fallbackKey]) : [];
      }

      function buildChildGroups(snapshot, entityMeta, typeMetaByTypenaam) {
        if (!snapshot) return [];
        const skeleton = safeArray(entityMeta?.onderliggende).map((child) => ({
          rolnaam: child.rolnaam,
          jsonRolnaam: child.jsonRolnaam || "",
          doeltype: child.doeltype,
          typeMeta: typeMetaByTypenaam[child.doeltype] || null,
          items: childArrayVoorRol(snapshot, child),
        }));
        if (skeleton.length > 0) return skeleton;
        return Object.keys(snapshot)
          .filter((key) => Array.isArray(snapshot[key]))
          .map((key) => ({
            rolnaam: key,
            jsonRolnaam: key,
            doeltype: String(key).replace(/s$/i, "").toUpperCase(),
            typeMeta: null,
            items: safeArray(snapshot[key]),
          }));
      }

      // Filter plumbing types (materiële-tijd aanvang/einde) uit childNodes;
      // die verschijnen als oortjes op de entiteitskaart i.p.v. als aparte GE-kaarten.
      function isPlumbingGroup(group, typeMetaByTypenaam) {
        return !!typeMetaByTypenaam[group.doeltype]?.bovenliggendTypenaam;
      }

      function actieveDataVersieVanHubItem(hubItem, hubTypeMeta, typeMetaByTypenaam) {
        if (!hubItem || hubTypeMeta?.ge_subtype !== "hub") return null;
        for (const child of safeArray(hubTypeMeta?.onderliggende)) {
          const childMeta = typeMetaByTypenaam?.[child.doeltype];
          if (!childMeta || childMeta.ge_subtype !== "data") continue;
          const childArray = safeArray(hubItem?.[child.jsonRolnaam] || hubItem?.[child.rolnaam]);
          const actief = childArray.find((d) => !d?.afvoer) || childArray[0] || null;
          if (!actief) continue;
          if (actief.versie !== null && actief.versie !== undefined && String(actief.versie).trim() !== "") {
            return actief.versie;
          }
        }
        return null;
      }

      function buildChildNodes(snapshot, entityMeta, typeMetaByTypenaam, entityTypes) {
        const childGroups = buildChildGroups(snapshot, entityMeta, typeMetaByTypenaam);
        return childGroups
          .filter((group) => !isPlumbingGroup(group, typeMetaByTypenaam))
          .flatMap((group) => {
          const rawItems = safeArray(group.items);
          const items = group?.typeMeta?.ge_subtype === "hub"
            ? platSlaHubItems(rawItems, group.typeMeta, typeMetaByTypenaam)
            : rawItems;
          return items.map((childItem, childIndex) => {
          const enrichedItem = { ...childItem };
          if (group?.typeMeta?.ge_subtype === "hub"
            && (enrichedItem.versie === null || enrichedItem.versie === undefined || String(enrichedItem.versie).trim() === "")) {
            const afgeleideVersie = actieveDataVersieVanHubItem(rawItems[childIndex], group.typeMeta, typeMetaByTypenaam);
            if (afgeleideVersie !== null && afgeleideVersie !== undefined && String(afgeleideVersie).trim() !== "") {
              enrichedItem.versie = afgeleideVersie;
            }
          }
          const secondaireKolom = String(group?.typeMeta?.secondaireEntiteitIDKolom || "");
          const tweedeEntiteitID = secondaireKolom ? enrichedItem?.[secondaireKolom] : null;
          const tweedeEntiteitType = leidEntiteitTypeAfUitKolomnaam(secondaireKolom, entityTypes);
          const tweedeEntiteitKleur = tweedeEntiteitType ? String(typeMetaByTypenaam[tweedeEntiteitType]?.kleur || "") : "";
          const tweedeEntiteitRandkleur = tweedeEntiteitKleur ? donkerdereRandkleurVanHex(tweedeEntiteitKleur) : "#1e3a8a";
          return {
            group,
            item: enrichedItem,
            isRelatie: String(group?.typeMeta?.metatype || "").toLowerCase() === "relatie",
            tweedeEntiteitType,
            tweedeEntiteitIDTekst: (tweedeEntiteitID === null || tweedeEntiteitID === undefined || tweedeEntiteitID === "") ? "" : String(tweedeEntiteitID),
            tweedeEntiteitKleur,
            tweedeEntiteitRandkleur,
            key: `${group.rolnaam || group.doeltype || 'child'}-${enrichedItem.rel_id ?? enrichedItem.id ?? childIndex}`,
          };
          });
        });
      }

      // Bouw oortjes-data (aanvang/einde) voor een snapshot.
      function buildOortjes(snapshot, entityMeta, typeMetaByTypenaam) {
        if (!snapshot || !entityMeta?.isMaterieel) return { aanvang: null, einde: null };
        const childGroups = buildChildGroups(snapshot, entityMeta, typeMetaByTypenaam);
        return bepaalOortjesUitChildGroups(childGroups, typeMetaByTypenaam);
      }

      export default function TijdlijnSchemaPage() {
        const [baseUrl, setBaseUrl] = useState(import.meta.env.VITE_API_BASE_URL || window.location.origin);
        const [schema, setSchema] = useState(null);
        const [schemaError, setSchemaError] = useState("");
        const [entityType, setEntityType] = useState("A");
        const [entityId, setEntityId] = useState(1);
        const [loading, setLoading] = useState(false);
        const [exporting, setExporting] = useState(false);
        const [copying, setCopying] = useState(false);
        const [error, setError] = useState("");
        const [items, setItems] = useState([]);
        const [overlayArrows, setOverlayArrows] = useState([]);
        const [overlayDebug, setOverlayDebug] = useState({ requested: 0, resolved: 0, missing: 0, missingLinks: [] });
        const timelineRowRef = useRef(null);

        const entityTypes = useMemo(() => safeArray(schema?.types).filter((x) => String(x.metatype) === "entiteit"), [schema]);
        const typeMetaByTypenaam = useMemo(() => {
          const result = {};
          safeArray(schema?.types).forEach((typeMeta) => {
            if (typeMeta?.typenaam) result[typeMeta.typenaam] = typeMeta;
          });
          return result;
        }, [schema]);
        const selectedEntityMeta = typeMetaByTypenaam[entityType] || null;

        const uniformeRegViewBoxHeight = useMemo(() => {
          const maxWijzigingen = items.reduce((acc, item) => Math.max(acc, safeArray(item?.wijzigingen).length), 0);
          const laatsteRijOnderkant = maxWijzigingen > 0
            ? 64 + ((maxWijzigingen - 1) * 58) + 56
            : 52;
          return Math.max(220, laatsteRijOnderkant + 16);
        }, [items]);

        const uniformeRepViewBoxHeight = useMemo(() => {
          const entityY = 22;
          const entityH = 82;
          const geH = 52;
          const geBinnenGroepGap = 12;
          const geTussenGroepGap = 34;
          const geBinnenGroepStap = geH + geBinnenGroepGap;
          const geTussenGroepStap = geH + geTussenGroepGap;
          const entityBottomY = entityY + entityH;

          let maxHoogte = 240;
          items.forEach((item) => {
            const childNodes = buildChildNodes(item?.snapshot, selectedEntityMeta, typeMetaByTypenaam, entityTypes);
            const geNodes = childNodes.filter((node) => !node.isRelatie);
            const relatieNodes = childNodes.filter((node) => node.isRelatie);

            const geNodesMetLayout = [];
            let geCursorY = entityY;
            geNodes.forEach((node, index) => {
              const vorige = geNodes[index - 1] || null;
              const zelfType = String(node.group?.doeltype || node.group?.rolnaam || "");
              const vorigeType = String(vorige?.group?.doeltype || vorige?.group?.rolnaam || "");
              if (index > 0) {
                geCursorY += zelfType === vorigeType ? geBinnenGroepStap : geTussenGroepStap;
              }
              geNodesMetLayout.push({ ...node, y: geCursorY });
            });

            const geBottom = geNodesMetLayout.length > 0 ? geNodesMetLayout[geNodesMetLayout.length - 1].y + geH : entityBottomY;
            const relStartY = Math.max(entityBottomY + 46, geNodesMetLayout.length > 0 ? geBottom + 20 + geTussenGroepGap : entityBottomY + 46);
            const relStepY = 82;
            const relBottom = relatieNodes.length > 0 ? relStartY + ((relatieNodes.length - 1) * relStepY) + 32 : entityBottomY;
            const repViewBoxHeight = Math.max(240, geBottom + 18, relBottom + 24);
            maxHoogte = Math.max(maxHoogte, repViewBoxHeight);
          });

          return maxHoogte;
        }, [items, selectedEntityMeta, typeMetaByTypenaam, entityTypes]);

        const undoLinks = useMemo(() => {
          const links = [];
          for (const item of items) {
            if (!item?.isOngedaanmaking && !item?.isCorrectie) {
              continue;
            }

            const sourceRegId = item?.reg?.id;
            const targetRegId = item?.linkTargetRegistratieId ?? item?.visualRegistratie?.id;
            if (sourceRegId === null || sourceRegId === undefined || targetRegId === null || targetRegId === undefined) {
              continue;
            }

            const isCorrectieLink = Boolean(item?.isCorrectie);
            const groupedByBasis = new Map();

            safeArray(item?.wijzigingen).forEach((w, idx) => {
              const wijzigingstype = String(w?.wijzigingstype || "").toLowerCase();
              if (wijzigingstype !== "opvoer" && wijzigingstype !== "afvoer") {
                return;
              }
              if (isCorrectieLink && wijzigingstype !== "opvoer") {
                return;
              }

              const isUndoAfvoerHerstel = Boolean(item?.isOngedaanmaking && wijzigingstype === "afvoer");
              const targetRegIdVoorWijziging = isUndoAfvoerHerstel ? sourceRegId : targetRegId;

              const repNaam = String(w?.representatienaam || "").trim();
              const repId = String(w?.representatie_id ?? "").trim();
              const entId = String(w?.entiteit_id ?? "").trim();
              let targetId = "";
              let targetIds = [];

              if (repNaam && repId) {
                const repNaamKandidaten = doelRepNaamKandidaten(repNaam, typeMetaByTypenaam);
                targetIds = repNaamKandidaten.map((naamKandidaat) => undoTargetRepId(targetRegIdVoorWijziging, naamKandidaat, repId));
                targetId = targetIds[0] || "";
              } else if (entId) {
                targetId = undoTargetEntId(targetRegIdVoorWijziging, entId);
                targetIds = targetId ? [targetId] : [];
              }

              if (!targetId) {
                return;
              }

              const actionType = isCorrectieLink ? "correctie" : (isUndoAfvoerHerstel ? "herstel" : "ongedaanmaking");
              const basisKey = repNaam && repId
                ? `${sourceRegId}::${targetRegIdVoorWijziging}::${repBasisNaam(repNaam)}::${repId}::${wijzigingstype}`
                : `${sourceRegId}::${targetRegIdVoorWijziging}::ENT::${entId}::${wijzigingstype}`
              const rank = /_(DATA|AANVANG|EINDE)$/i.test(repNaam) ? 2 : 1;
              const kandidaat = {
                sourceId: `undo-src-${normaliseerIdComponent(sourceRegId)}-${idx}`,
                targetId,
                targetIds,
                wijzigingstype,
                actionType,
                sourceRegId,
                targetRegId: targetRegIdVoorWijziging,
                basisKey,
                rank,
              };

              if (!item?.isOngedaanmaking) {
                links.push(kandidaat);
                return;
              }

              const bestaand = groupedByBasis.get(basisKey);
              if (!bestaand || kandidaat.rank > bestaand.rank) {
                groupedByBasis.set(basisKey, kandidaat);
              }
            });

            if (item?.isOngedaanmaking) {
              links.push(...Array.from(groupedByBasis.values()));
            }
          }
          return links;
        }, [items, typeMetaByTypenaam]);

        const highlightPerRegId = useMemo(() => {
          const map = new Map();

          for (const item of items) {
            if (!item?.isOngedaanmaking && !item?.isCorrectie) {
              continue;
            }

            const isCorrectieLink = Boolean(item?.isCorrectie);

            const targetRegId = item?.linkTargetRegistratieId ?? item?.visualRegistratie?.id;
            if (targetRegId === null || targetRegId === undefined) {
              continue;
            }

            safeArray(item?.wijzigingen).forEach((w) => {
              const wijzigingstype = String(w?.wijzigingstype || "").toLowerCase();
              if (wijzigingstype !== "opvoer" && wijzigingstype !== "afvoer") {
                return;
              }
              if (isCorrectieLink && wijzigingstype !== "opvoer") {
                return;
              }

              const isUndoAfvoerHerstel = Boolean(item?.isOngedaanmaking && wijzigingstype === "afvoer");
              const targetRegIdVoorWijziging = isUndoAfvoerHerstel ? item?.reg?.id : targetRegId;
              const keyVoorWijziging = String(targetRegIdVoorWijziging ?? "");
              if (!keyVoorWijziging) {
                return;
              }

              const targetLijst = map.get(keyVoorWijziging) || [];

              const repNaam = String(w?.representatienaam || "").toUpperCase();
              const repId = String(w?.representatie_id ?? "");
              const entId = String(w?.entiteit_id ?? "");

              if (repNaam && repId) {
                targetLijst.push({ soort: "REP", repNaam, repId });
                map.set(keyVoorWijziging, targetLijst);
                return;
              }

              if (entId) {
                targetLijst.push({ soort: "ENT", entId });
                map.set(keyVoorWijziging, targetLijst);
              }
            });

          }

          return map;
        }, [items]);

        useEffect(() => {
          let cancelled = false;
          async function loadSchema() {
            setSchemaError("");
            try {
              const json = await fetchJson(`${baseUrl}/api/viz/schema`);
              if (!cancelled) {
                setSchema(json);
                const first = safeArray(json?.types).find((x) => String(x.metatype) === "entiteit");
                if (first) setEntityType((prev) => prev || first.typenaam);
              }
            } catch (err) {
              if (!cancelled) {
                setSchema(null);
                setSchemaError(err instanceof Error ? err.message : String(err));
              }
            }
          }
          loadSchema();
          return () => { cancelled = true; };
        }, [baseUrl]);

        useEffect(() => {
          const rowEl = timelineRowRef.current;
          if (!rowEl) {
            setOverlayArrows([]);
            setOverlayDebug({ requested: undoLinks.length, resolved: 0, missing: undoLinks.length, missingLinks: undoLinks.slice(0, 6) });
            return;
          }

          const kolomVoorRegId = (regId) => {
            const idTekst = String(regId ?? "").trim();
            if (!idTekst) return null;
            return rowEl.querySelector(`.timeline-column[data-reg-id="${idTekst}"]`)
              || rowEl.querySelector(`.timeline-column[data-visual-reg-id="${idTekst}"]`)
              || null;
          };

          const rowRect = rowEl.getBoundingClientRect();
          const arrows = [];
          const missingLinks = [];

          for (const link of undoLinks) {
            const sourceEl = document.getElementById(link.sourceId);
            const sourceFound = !!sourceEl;
            let targetEl = null;
            const targetIds = Array.isArray(link.targetIds) && link.targetIds.length > 0 ? link.targetIds : [link.targetId];
            for (const kandidaat of targetIds) {
              const el = document.getElementById(kandidaat);
              if (el) {
                targetEl = el;
                break;
              }
            }
            const targetFound = !!targetEl;
            if (!sourceEl || !targetEl) {
              missingLinks.push({ ...link, sourceFound, targetFound });
              continue;
            }

            const sourceRect = sourceEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const laneMatch = String(link.sourceId || "").match(/-(\d+)$/);
            const laneIdx = laneMatch ? Number.parseInt(laneMatch[1], 10) : 0;

            const sourceColEl = kolomVoorRegId(link.sourceRegId);
            const targetColEl = kolomVoorRegId(link.targetRegId);
            const sourceColRect = sourceColEl ? sourceColEl.getBoundingClientRect() : null;
            const targetColRect = targetColEl ? targetColEl.getBoundingClientRect() : null;

            const x1 = sourceRect.left + (sourceRect.width / 2) - rowRect.left;
            const y1 = sourceRect.top + (sourceRect.height / 2) - rowRect.top;
            const x2 = targetRect.left + (targetRect.width / 2) - rowRect.left;
            const y2 = targetRect.top - rowRect.top + 2;

            const actionType = link.actionType || "ongedaanmaking";
            const actionIsGroen = actionType === "correctie" || actionType === "herstel";

            const sCenter = sourceColRect ? (sourceColRect.left + (sourceColRect.width / 2) - rowRect.left) : x1;
            const tCenter = targetColRect ? (targetColRect.left + (targetColRect.width / 2) - rowRect.left) : x2;
            const mid = (sCenter + tCenter) / 2;
            const laneOffset = ((Number.isFinite(laneIdx) ? laneIdx : 0) % 3) * 12;
            const kleurOffset = actionIsGroen ? -34 : 34;
            const corridorX = (Math.abs(sCenter - tCenter) < 20)
              ? (sCenter + (actionIsGroen ? -74 : 74) + laneOffset)
              : (mid + kleurOffset + laneOffset);

            arrows.push({
              x1,
              y1,
              x2,
              y2,
              kleur: (link.actionType === "correctie" || link.actionType === "herstel") ? "rgba(22, 163, 74, 0.75)" : "rgba(220, 38, 38, 0.55)",
              markerId: (link.actionType === "correctie" || link.actionType === "herstel") ? "corrArrowSchema" : "undoArrowSchema",
              actionType: link.actionType,
              lane: Number.isNaN(laneIdx) ? 0 : laneIdx,
              sourceRegId: link.sourceRegId,
              corridorX,
            });
          }

          setOverlayArrows(arrows);
          setOverlayDebug({
            requested: undoLinks.length,
            resolved: arrows.length,
            missing: Math.max(0, undoLinks.length - arrows.length),
            missingLinks: missingLinks.slice(0, 6),
          });
        }, [undoLinks, items]);

        async function renderTimelineCanvas() {
          const rowEl = timelineRowRef.current;
          if (!rowEl) {
            throw new Error("Geen visualisatie beschikbaar om te exporteren.");
          }

          if (typeof html2canvas !== "function") {
            throw new Error("PNG-export niet beschikbaar: html2canvas niet geladen.");
          }

          return html2canvas(rowEl, {
            backgroundColor: "#f8fafc",
            useCORS: true,
            scale: 2,
            width: rowEl.scrollWidth,
            height: rowEl.scrollHeight,
            windowWidth: rowEl.scrollWidth,
            windowHeight: rowEl.scrollHeight,
            ignoreElements: (element) => element?.classList?.contains("export-exclude"),
          });
        }

        async function downloadTimelineAsPng() {
          setError("");
          setExporting(true);
          try {
            const canvas = await renderTimelineCanvas();
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `tijdlijn-schema-${String(entityType || 'entiteit').toLowerCase()}-${normInt(entityId, 0)}.png`;
            link.click();
          } catch (err) {
            setError(err?.message || "Onbekende fout bij PNG-export");
          } finally {
            setExporting(false);
          }
        }

        async function copyTimelineAsPng() {
          setError("");

          if (!navigator.clipboard || !window.ClipboardItem) {
            setError("Kopieren naar klembord wordt niet ondersteund in deze browser/context.");
            return;
          }

          setCopying(true);
          try {
            const canvas = await renderTimelineCanvas();
            const blob = await new Promise((resolve, reject) => {
              canvas.toBlob((result) => {
                if (result) {
                  resolve(result);
                  return;
                }
                reject(new Error("PNG-conversie naar blob mislukt."));
              }, "image/png");
            });

            await navigator.clipboard.write([
              new window.ClipboardItem({ "image/png": blob }),
            ]);
          } catch (err) {
            setError(err?.message || "Onbekende fout bij kopieren naar klembord");
          } finally {
            setCopying(false);
          }
        }

        async function loadTimeline() {
          setLoading(true);
          setError("");
          try {
            const registraties = await fetchAlleRegistraties(baseUrl);
            const seg = endpointSegmentForEntityType(entityType, entityTypes);
            const id = normInt(entityId, 0);
            const entityTypeUpper = String(entityType || "").toUpperCase();

            const verrijkt = [];
            for (const reg of registraties) {
              const isOngedaanmaking = String(reg?.registratietype || "").toLowerCase() === "ongedaanmaking";
              const isCorrectie = String(reg?.registratietype || "").toLowerCase() === "correctie";
              let visualRegistratie = reg;
              let visualWijzigingen = safeArray(reg?.wijzigingen);
              let linkTargetRegistratieId = null;

              if (isOngedaanmaking && reg?.maakt_ongedaan_registratie_id) {
                const doelRegistratie = await fetchRegistratieById(baseUrl, reg.maakt_ongedaan_registratie_id);
                if (doelRegistratie) {
                  visualRegistratie = doelRegistratie;
                  visualWijzigingen = safeArray(doelRegistratie?.wijzigingen);
                  linkTargetRegistratieId = doelRegistratie?.id ?? reg?.maakt_ongedaan_registratie_id;
                }
              }

              if (isCorrectie && reg?.corrigeert_registratie_id) {
                const doelRegistratie = await fetchRegistratieById(baseUrl, reg.corrigeert_registratie_id);
                if (doelRegistratie) {
                  visualRegistratie = doelRegistratie;
                  visualWijzigingen = safeArray(doelRegistratie?.wijzigingen);
                  linkTargetRegistratieId = doelRegistratie?.id ?? reg?.corrigeert_registratie_id;
                }
              }

              const relevanteWijzigingen = visualWijzigingen.filter((w) => {
                const entiteitNaam = String(w?.entiteitnaam || "").toUpperCase();
                return entiteitNaam === entityTypeUpper && String(w?.entiteit_id ?? "") === String(id);
              });

              if (relevanteWijzigingen.length === 0) {
                continue;
              }

              const t = tUitRegistratieTijdstip(reg?.tijdstip);
              let snapshot = null;
              if (t !== null) {
                const res = await fetch(`${baseUrl}/full/${seg}/${encodeURIComponent(id)}?t=${encodeURIComponent(t)}`);
                if (res.ok) {
                  snapshot = snapshotEntiteitUitPayload(await res.json(), entityType);
                }
              }
              verrijkt.push({ reg, visualRegistratie, wijzigingen: relevanteWijzigingen, t, snapshot, isOngedaanmaking, isCorrectie, linkTargetRegistratieId });
            }

            verrijkt.sort((a, b) => {
              const at = Date.parse(a.reg?.tijdstip || "");
              const bt = Date.parse(b.reg?.tijdstip || "");
              if (Number.isNaN(at) || Number.isNaN(bt)) return Number(a.reg?.id || 0) - Number(b.reg?.id || 0);
              if (at !== bt) return at - bt;
              return Number(a.reg?.id || 0) - Number(b.reg?.id || 0);
            });

            setItems(verrijkt);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setItems([]);
          } finally {
            setLoading(false);
          }
        }

        return (
          <div className="container">
            <SchemaTijdlijnHeader schemaError={schemaError} schema={schema} entityTypes={entityTypes} />

            <SchemaTijdlijnControls
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              entityType={entityType}
              setEntityType={setEntityType}
              entityTypes={entityTypes}
              entityId={entityId}
              setEntityId={setEntityId}
              loadTimeline={loadTimeline}
              loading={loading}
              downloadTimelineAsPng={downloadTimelineAsPng}
              exporting={exporting}
              items={items}
              copyTimelineAsPng={copyTimelineAsPng}
              copying={copying}
              error={error}
            />

            <div className="summary-strip" style={{ marginTop: 8 }}>
              <span className="chip">Undo links gevraagd: {overlayDebug.requested}</span>
              <span className="chip">Undo links getekend: {overlayDebug.resolved}</span>
              {overlayDebug.missing > 0 && (
                <span className="chip" style={{ background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>
                  Undo links missend: {overlayDebug.missing}
                </span>
              )}
            </div>
            {overlayDebug.missingLinks.length > 0 && (
              <details className="details-block" style={{ marginTop: 8 }}>
                <summary>Undo debug: missende source/target ankers</summary>
                <pre>{JSON.stringify(overlayDebug.missingLinks, null, 2)}</pre>
              </details>
            )}

            <div className="timeline-scroll">
              <div className="timeline-row" ref={timelineRowRef}>
                <svg className="timeline-overlay" width="100%" height="100%" preserveAspectRatio="none">
                  <defs>
                    <marker id="undoArrowSchema" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(220, 38, 38, 0.6)" />
                    </marker>
                    <marker id="corrArrowSchema" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(22, 163, 74, 0.75)" />
                    </marker>
                  </defs>
                  {overlayArrows.map((arrow, arrowIndex) => {
                    const lane = Number(arrow.lane || 0);
                    const c1x = Number(arrow.corridorX ?? arrow.x1);
                    const c2x = Number(arrow.corridorX ?? arrow.x2);
                    const c1y = arrow.y1 + 52 + ((lane % 2) * 8);
                    const c2y = arrow.y2 - 62 - ((lane % 2) * 8);
                    return (
                      <path
                        key={`overlay-arrow-schema-${arrowIndex}`}
                        d={`M ${arrow.x1} ${arrow.y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${arrow.x2} ${arrow.y2}`}
                        fill="none"
                        stroke={arrow.kleur || "rgba(220, 38, 38, 0.55)"}
                        strokeWidth="1.8"
                        markerEnd={`url(#${arrow.markerId || "undoArrowSchema"})`}
                      />
                    );
                  })}
                </svg>
                {items.map((item, idx) => {
                  const reg = item.reg || {};
                  const visualReg = item.visualRegistratie || reg;
                  const highlights = highlightPerRegId.get(String(visualReg.id ?? "")) || [];
                  const wijzigingen = safeArray(item.wijzigingen);
                  const registratieTitel = reg?.registratietype
                    ? reg.registratietype.charAt(0).toUpperCase() + reg.registratietype.slice(1)
                    : "Registratie";
                  const registratieOpmerking = typeof reg?.opmerking === "string" ? reg.opmerking : "";
                  const regViewBoxHeight = uniformeRegViewBoxHeight;
                  const repViewBoxHeight = uniformeRepViewBoxHeight;

                  return (
                    <div
                      className="timeline-column"
                      key={`col-${item.reg?.id || idx}`}
                      data-reg-id={String(reg?.id ?? "")}
                      data-visual-reg-id={String(visualReg?.id ?? "")}
                    >
                      <TijdlijnRegistratiePaneel
                        reg={reg}
                        visualReg={visualReg}
                        wijzigingen={wijzigingen}
                        registratieTitel={registratieTitel}
                        registratieOpmerking={registratieOpmerking}
                        regViewBoxHeight={regViewBoxHeight}
                        isOngedaanmaking={item.isOngedaanmaking}
                        isCorrectie={item.isCorrectie}
                        entityType={entityType}
                        typeMetaByTypenaam={typeMetaByTypenaam}
                        microsecondeIntVanTijdstip={microsecondeIntVanTijdstip}
                        wijzigingPatroonId={wijzigingPatroonId}
                        normaliseerIdComponent={normaliseerIdComponent}
                      />

                      <TijdlijnRepresentatiePaneel
                        item={item}
                        reg={reg}
                        visualReg={visualReg}
                        highlights={highlights}
                        entityType={entityType}
                        entityId={entityId}
                        selectedEntityMeta={selectedEntityMeta}
                        typeMetaByTypenaam={typeMetaByTypenaam}
                        entityTypes={entityTypes}
                        repViewBoxHeight={repViewBoxHeight}
                        buildChildNodes={buildChildNodes}
                        buildOortjes={buildOortjes}
                        microsecondeIntVanTijdstip={microsecondeIntVanTijdstip}
                        korteSamenvatting={korteSamenvatting}
                        normInt={normInt}
                        undoTargetEntId={undoTargetEntId}
                        undoTargetRepId={undoTargetRepId}
                      />

                      <div className="card export-exclude" style={{ padding: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <details className="details-block" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
                            <summary>Ruwe registratie-data</summary>
                            <pre>{JSON.stringify(reg, null, 2)}</pre>
                          </details>
                          <details className="details-block" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
                            <summary>Ruwe snapshot-data</summary>
                            <pre>{JSON.stringify(item.snapshot || null, null, 2)}</pre>
                          </details>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }
