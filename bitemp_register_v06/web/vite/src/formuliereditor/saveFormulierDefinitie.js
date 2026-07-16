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

export async function saveFormulierDefinitie(baseUrl, { meta, layoutJson }) {
  const naam = String(meta?.naam || "").trim();
  const doeltype = String(meta?.doeltype || "").trim();
  if (!naam) throw new Error("Geef de definitie eerst een naam (inspector).");
  if (!doeltype) throw new Error("Kies eerst een doeltype (ENT) in de inspector.");
  if (!layoutJson || layoutJson === '{"type":"formulier","elementen":[]}') {
    throw new Error("Het formulier is nog leeg.");
  }

  const idRes = await fetch(`${baseUrl}/api/viz/entiteit/FormulierDefinitie/max-id`);
  if (!idRes.ok) throw new Error(`Kon nieuw ID niet ophalen (HTTP ${idRes.status}).`);
  const { nextId } = await idRes.json();
  if (!nextId) throw new Error("Ongeldig nieuw ID ontvangen.");

  const wijzigingen = [
    { opvoer: { formulierdefinitie: { id: nextId } } },
    { opvoer: { formulierdefinitie_meta: {
      formulierdefinitie_id: nextId,
      naam,
      beschrijving: String(meta?.beschrijving || ""),
      doeltype,
      status: "actief",
      is_standaard: true,
    } } },
    { opvoer: { layout: {
      formulierdefinitie_id: nextId,
      layout_json: layoutJson,
      definitie_versie: String(meta?.definitieVersie || "0.1"),
    } } },
    { opvoer: { formulierdefinitie_aanvang: {
      formulierdefinitie_id: nextId,
      datum: vandaagISO(),
    } } },
  ];

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
  return { id: nextId };
}
