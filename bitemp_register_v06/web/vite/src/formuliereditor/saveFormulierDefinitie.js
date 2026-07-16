/**
 * saveFormulierDefinitie — schrijft de huidige editor-definitie weg als een
 * nieuwe `FormulierDefinitie` (bitemporeel, configuratie-domein) via één
 * registratie-aanroep.
 *
 * Patroon (zoals nieuwe entiteiten elders in de inhoud-editor):
 *   1. `nextId` ophalen via /api/viz/entiteit/FormulierDefinitie/max-id
 *   2. POST /registratie/ met opvoer-wijzigingen per onderliggend GE.
 *
 * De GE-veldnamen (`formulierdefinitie_meta`, `layout`, `formulierdefinitie_aanvang`)
 * volgen de bestaande replay-definitie (replay files/…-formulierdefinitie-…json).
 *
 * N.B. Dit maakt telkens een *nieuwe* definitie. "Nieuwe versie van een bestaande
 * definitie" (zelfde formulierdefinitie_id, nieuwe Layout-versie) is een follow-up
 * zodra de editor definities uit de DB kan laden.
 */

function vandaagISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function saveFormulierDefinitie(baseUrl, { meta, layoutJson, geladen = null }) {
  const naam = String(meta?.naam || "").trim();
  const doeltype = String(meta?.doeltype || "").trim();
  if (!naam) throw new Error("Geef de definitie eerst een naam (inspector).");
  if (!doeltype) throw new Error("Kies eerst een doeltype (ENT) in de inspector.");
  if (!layoutJson || layoutJson === '{"type":"formulier","elementen":[]}') {
    throw new Error("Het formulier is nog leeg.");
  }

  const status = String(meta?.status || "concept");
  const isStandaard = meta?.isStandaard === true;
  const versie = String(meta?.definitieVersie || "0.1");
  // TODO: update-in-place (nieuwe versie van een geladen definitie) vergt exact
  // dezelfde versioning-payload als RepresentatieFormulier (incl. de eigen idKolom
  // van het meta/layout-record, niet alleen rel_id). Zonder dat ontstaan dubbele
  // hubs → voorlopig altijd een nieuwe definitie aanmaken (veilig).
  const bijwerken = false && geladen?.id != null;

  let doelId;
  let wijzigingen;

  if (bijwerken) {
    // Bestaande definitie bijwerken → nieuwe versie van meta + layout (zelfde id).
    doelId = geladen.id;
    const metaPayload = { formulierdefinitie_id: doelId, naam, beschrijving: String(meta?.beschrijving || ""), doeltype, status, is_standaard: isStandaard };
    if (geladen.metaRelId != null) metaPayload.rel_id = geladen.metaRelId;
    const layoutPayload = { formulierdefinitie_id: doelId, layout_json: layoutJson, definitie_versie: versie };
    if (geladen.layoutRelId != null) layoutPayload.rel_id = geladen.layoutRelId;
    wijzigingen = [
      { opvoer: { formulierdefinitie_meta: metaPayload } },
      { opvoer: { layout: layoutPayload } },
    ];
  } else {
    // Nieuwe definitie aanmaken.
    const idRes = await fetch(`${baseUrl}/api/viz/entiteit/FormulierDefinitie/max-id`);
    if (!idRes.ok) throw new Error(`Kon nieuw ID niet ophalen (HTTP ${idRes.status}).`);
    const { nextId } = await idRes.json();
    if (!nextId) throw new Error("Ongeldig nieuw ID ontvangen.");
    doelId = nextId;
    wijzigingen = [
      { opvoer: { formulierdefinitie: { id: doelId } } },
      { opvoer: { formulierdefinitie_meta: { formulierdefinitie_id: doelId, naam, beschrijving: String(meta?.beschrijving || ""), doeltype, status, is_standaard: isStandaard } } },
      { opvoer: { layout: { formulierdefinitie_id: doelId, layout_json: layoutJson, definitie_versie: versie } } },
      { opvoer: { formulierdefinitie_aanvang: { formulierdefinitie_id: doelId, datum: vandaagISO() } } },
    ];
  }

  const res = await fetch(`${baseUrl}/registratie/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registratie: { registratietype: "registratie", opmerking: `FormulierDefinitie ${naam}` },
      wijzigingen,
    }),
  });
  if (!res.ok) {
    const tekst = await res.text().catch(() => "");
    throw new Error(`Opslaan mislukt (HTTP ${res.status}): ${tekst.slice(0, 300)}`);
  }

  // Max. 1 actieve standaard per doeltype: degradeer andere actieve standaarden.
  let gedegradeerd = 0;
  if (isStandaard && status === "actief") {
    gedegradeerd = await degradeerAndereStandaarden(baseUrl, doeltype, doelId).catch(() => 0);
  }
  return { id: doelId, gedegradeerd, bijgewerkt: bijwerken };
}

/** Actueel (niet-afgevoerd) meta-record + rel_id uit een full-definitie. */
function actueleMeta(full) {
  for (const hub of Array.isArray(full?.formulier_definitie_metas) ? full.formulier_definitie_metas : []) {
    const relId = hub?.rel_id;
    const data = Array.isArray(hub?.data) ? hub.data : [];
    const actueel = data.find((d) => d?.opvoer && !d?.afvoer) || data[data.length - 1];
    if (actueel) return { ...actueel, rel_id: actueel.rel_id ?? relId };
  }
  return null;
}

/**
 * Zet is_standaard=false op alle ANDERE actieve standaard-definities voor
 * hetzelfde doeltype (behalve `behoudId`). Retourneert het aantal gedegradeerd.
 */
export async function degradeerAndereStandaarden(baseUrl, doeltype, behoudId) {
  const res = await fetch(`${baseUrl}/full/formulier_definities`);
  if (!res.ok) return 0;
  const lijst = await res.json();
  const items = Array.isArray(lijst?.["formulier definities"]) ? lijst["formulier definities"] : [];
  const wijzigingen = [];
  for (const full of items) {
    if (full.id === behoudId || full.afvoer) continue; // sla afgevoerde over
    const m = actueleMeta(full);
    if (!m) continue;
    const std = m.is_standaard === true || m.is_standaard === "true";
    if (m.doeltype === doeltype && m.status === "actief" && std) {
      const payload = {
        formulierdefinitie_id: full.id,
        naam: m.naam,
        beschrijving: m.beschrijving || "",
        doeltype: m.doeltype,
        status: m.status,
        is_standaard: false,
      };
      if (m.rel_id != null) payload.rel_id = m.rel_id;
      wijzigingen.push({ opvoer: { formulierdefinitie_meta: payload } });
    }
  }
  if (wijzigingen.length === 0) return 0;
  const post = await fetch(`${baseUrl}/registratie/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registratie: { registratietype: "registratie", opmerking: "Degradeer eerdere standaardformulieren" },
      wijzigingen,
    }),
  });
  return post.ok ? wijzigingen.length : 0;
}
