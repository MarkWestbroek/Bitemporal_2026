import VormWeergave from "./VormWeergave";
import WeergaveKiezer from "./WeergaveKiezer";
import { splitsVormBlokken } from "./vormBlokken";
import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router";
import { isEmbedModus } from "./embed";
import { useSchema } from "../context/SchemaContext";
import { useWeergaveDefinitie } from "../hooks/useWeergaveDefinitie";
import { safeArray, platSlaHubItems } from "../shared/schemaUtils";
import {
  parseSegment,
  segmentNaarString,
  resolveVeldpadUitContext,
  buildGraphQLQuery,
  verwerkVoorwaarden,
} from "./publicatieUtils";
import { escapeHtml, markdownNaarHtml } from "./markdown.js";
import {
  INTROSPECTIE_QUERY,
  bouwSchemaIndex,
  rootTypeVoor,
  normaliseerTemplatePaden,
} from "./graphqlPaden";
import { haalDetailViaDocument } from "./publicatieData.js";

// Het GraphQL-schema verandert niet tijdens een bezoek: één introspectie per pagina.
let schemaIndexBelofte = null;
function haalSchemaIndex(baseUrl) {
  if (!schemaIndexBelofte) {
    schemaIndexBelofte = fetch(`${baseUrl}/graphql/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: INTROSPECTIE_QUERY }),
    })
      .then((res) => res.json())
      .then((json) => bouwSchemaIndex(json?.data))
      .catch(() => null); // zonder schema: template ongewijzigd gebruiken
  }
  return schemaIndexBelofte;
}

/**
 * Vult een detail-template: eerst de voorwaardelijke blokken ({{#if veldpad}} … {{/if}},
 * zie verwerkVoorwaarden), dan alle {{veldpad}} placeholders met waarden uit de context.
 */
function renderTemplate(template, ctx) {
  if (!template) return "";
  return verwerkVoorwaarden(template, ctx).replace(/\{\{([^}]+)\}\}/g, (_, veldpad) => {
    const waarde = resolveVeldpadUitContext(ctx, veldpad.trim());
    if (waarde == null) return "";
    // Escape pipes zodat ze markdown-tabellen niet breken
    return String(waarde).replace(/\|/g, "\\|");
  });
}

/**
 * PublicatieDetail — read-only detailpagina voor een entiteit, gerenderd via
 * een WeergaveDefinitie template met {{veldpad}} inserts.
 *
 * Als er een detailTemplate is, wordt data opgehaald via GraphQL (ondersteunt
 * diepe navigatie via forward FK relaties). Zonder template: REST fallback.
 */
export default function PublicatieDetail() {
  const { typePad, id } = useParams();
  const { baseUrl, allTypes: types, typeMetaByTypenaam } = useSchema();

  const typeMeta = useMemo(() => {
    return (types || []).find(
      (t) => (t.padnaam || t.meervoud || t.veldnaam) === typePad && t.metatype === "entiteit"
    );
  }, [types, typePad]);

  const wd = useWeergaveDefinitie(typeMeta?.typenaam);
  const { detailTemplate: ruwTemplate, tabelConfig, loading: wdLoading, error: wdError } = wd;
  // Opgeslagen document voor het detail (QueryDefinitie met $id), zie publicatieData.js.
  const detailDocument = tabelConfig?.detailQuery || null;

  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;

  // Veldpaden in het template afstemmen op het GraphQL-schema (klassenamen, overgeslagen
  // stappen, onbekende paden; zie graphqlPaden.js). Query en weergave gebruiken daarna
  // allebei het genormaliseerde template. { bron, template }: bron = het ruwe template
  // waarvoor de normalisatie klaar is.
  const [genormaliseerd, setGenormaliseerd] = useState({ bron: null, template: null });
  useEffect(() => {
    if (!ruwTemplate || !baseUrl || !apiPath) return;
    let weg = false;
    haalSchemaIndex(baseUrl).then((index) => {
      if (weg) return;
      const { template, onbekend } = normaliseerTemplatePaden(
        ruwTemplate,
        index,
        rootTypeVoor(index, apiPath)
      );
      if (onbekend.length > 0) {
        console.warn("[PublicatieDetail] veldpaden niet in het GraphQL-schema, blijven leeg:", onbekend);
      }
      setGenormaliseerd({ bron: ruwTemplate, template });
    });
    return () => {
      weg = true;
    };
  }, [ruwTemplate, baseUrl, apiPath]);
  const templateKlaar = !ruwTemplate || genormaliseerd.bron === ruwTemplate;
  const detailTemplate = ruwTemplate && templateKlaar ? genormaliseerd.template : null;

  // Haal de full entity op.
  // Met detailQuery → het opgeslagen document (documentId + $id): de selectie van velden
  //   ligt vast in de QueryDefinitie, die dus alle paden van het template moet bevatten.
  // Met detailTemplate → ad-hoc GraphQL, opgebouwd uit de template-paden.
  // Zonder template → REST /full/ (fallback voor generieke weergave).
  useEffect(() => {
    if (!apiPath || !baseUrl || !id || wdLoading || !templateKlaar) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (detailDocument && detailTemplate) {
      haalDetailViaDocument({ baseUrl, documentId: detailDocument, id })
        .then((rec) => {
          if (cancelled) return;
          if (!rec) setError("Niet gevonden of niet beschikbaar.");
          else setEntity(rec);
          setLoading(false);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err.message);
            setLoading(false);
          }
        });
    } else if (detailTemplate) {
      // GraphQL: bouw query op basis van template veldpaden
      const query = buildGraphQLQuery(detailTemplate, apiPath, id);
      fetch(`${baseUrl}/graphql/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          if (json.errors) {
            setError(json.errors.map((e) => e.message).join(", "));
          } else {
            setEntity(json.data?.[`full_${apiPath}`] || null);
          }
          setLoading(false);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err.message);
            setLoading(false);
          }
        });
    } else {
      // REST fallback
      fetch(`${baseUrl}/full/${apiPath}/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json) => {
          if (!cancelled) {
            setEntity(json);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err.message);
            setLoading(false);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [baseUrl, apiPath, id, detailTemplate, detailDocument, wdLoading, templateKlaar]);

  // Bouw CEL-context uit de entity data.
  // GraphQL: response is al geflattend — direct als context.
  // REST: bouw context met hub-flattening en klassenaam-mapping.
  const celContext = useMemo(() => {
    if (!entity || !typeMeta) return {};

    // GraphQL-response: al geflattend, direct als context gebruiken.
    // resolveVeldpadUitContext handelt 'data'-segmenten transparant af.
    if (detailTemplate) {
      return entity;
    }

    // REST fallback: bestaande hub-flattening + klassenaam-mapping
    const onderliggende = safeArray(typeMeta?.onderliggende);
    const ctx = {};

    // Voeg direct entity-velden toe (bijv. id)
    for (const key of Object.keys(entity)) {
      if (typeof entity[key] !== "object" || entity[key] === null) {
        ctx[key] = entity[key];
      }
    }

    for (const child of onderliggende) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
      const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
      const actieveItems = items.filter((item) => !item.afvoer);
      if (actieveItems.length === 0 && items.length === 0) continue;

      const klassenaam = childMeta?.klassenaam || child.doeltype;
      const isMeervoudig = child.momentvoorkomen === "meervoudig";

      if (isMeervoudig) {
        const arr = actieveItems.length > 0 ? actieveItems : items;
        ctx[klassenaam] = arr;
        if (child.jsonRolnaam && child.jsonRolnaam !== klassenaam) {
          ctx[child.jsonRolnaam] = arr;
        }
      } else {
        const actiefItem = actieveItems[0] || items[0] || null;
        if (!actiefItem) continue;
        ctx[klassenaam] = actiefItem;
        if (child.jsonRolnaam && child.jsonRolnaam !== klassenaam) {
          ctx[child.jsonRolnaam] = { ...actiefItem, data: actiefItem };
        }
      }
    }
    return ctx;
  }, [entity, typeMeta, typeMetaByTypenaam, detailTemplate]);

  // Render het template in stukken: tekst (Markdown met {{…}}) en weergavevormen
  // ({{#vorm naam pad}}config{{/vorm}}, vormBlokken.js). Zonder template: de fallback.
  const stukken = useMemo(() => {
    if (!entity) return [];
    if (!detailTemplate) return [{ soort: "html", html: fallbackHtml(celContext) }];
    return splitsVormBlokken(verwerkVoorwaarden(detailTemplate, celContext)).map((s) =>
      s.soort === "tekst" ? { soort: "html", html: markdownNaarHtml(renderTemplate(s.tekst, celContext)) } : s);
  }, [entity, detailTemplate, celContext]);

  if (!typeMeta) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Type &ldquo;{typePad}&rdquo; niet gevonden.</p>
        <Link to="/">← Terug</Link>
      </div>
    );
  }

  if (error || wdError) {
    return <div className="cg-feedback--fout">Fout: {error || wdError}</div>;
  }

  if (loading || wdLoading || !templateKlaar) {
    return <div style={{ padding: "2rem", color: "var(--cg-donkergrijs)" }}>Laden…</div>;
  }

  // In embed-modus (iframe) geen eigen titel: het detail-template heeft er zelf een.
  const isEmbed = isEmbedModus();

  return (
    <div className="cg-publicatie-detail">
      <div className="cg-publicatie-detail__kop">
        <Link to={`/t/${typePad}`} className="cg-publicatie-detail__terug">
          ← Terug naar lijst
        </Link>
        {!isEmbed && (
          <h2 className="utrecht-heading-2" style={{ margin: 0 }}>
            {typeMeta.klassenaam || typeMeta.typenaam} #{id}
          </h2>
        )}
        <WeergaveKiezer alternatieven={wd.alternatieven} huidigId={wd.weergaveDefinitie?.id} />
      </div>

      <div className="cg-form-card cg-publicatie-detail__inhoud">
        {stukken.map((s, i) => (s.soort === "html"
          ? <div key={i} dangerouslySetInnerHTML={{ __html: s.html }} />
          : <VormWeergave key={i} blok={s} ctx={celContext} />))}
      </div>
    </div>
  );
}

/** Fallback HTML: toon alle GE-velden als een beschrijvingslijst. */
function fallbackHtml(ctx) {
  const delen = [];
  const overTeSlaan = new Set([
    "id", "rel_id", "opvoer", "afvoer", "versie", "_data_versie",
  ]);

  for (const [groepNaam, groepData] of Object.entries(ctx)) {
    if (groepData == null || typeof groepData !== "object") continue;
    delen.push(`<h3>${escapeHtml(groepNaam)}</h3>`);
    delen.push("<dl>");
    for (const [veld, waarde] of Object.entries(groepData)) {
      if (overTeSlaan.has(veld)) continue;
      if (waarde == null || (typeof waarde === "object" && !Array.isArray(waarde))) continue;
      delen.push(
        `<dt><strong>${escapeHtml(veld)}</strong></dt><dd>${escapeHtml(String(waarde))}</dd>`
      );
    }
    delen.push("</dl>");
  }

  return delen.join("\n") || "<p>Geen gegevens beschikbaar.</p>";
}
