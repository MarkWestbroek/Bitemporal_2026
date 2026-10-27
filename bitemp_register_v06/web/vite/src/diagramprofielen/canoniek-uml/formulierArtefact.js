// @ts-check
/**
 * formulierArtefact — aansluiting "canoniek model + e-dienst → formulier-
 * artefact (Open Formulieren-export)" voor de inrichting van e-diensten
 * (docs/TRANSFORMATIES.md §11.6).
 *
 * Route:
 *
 *   V3-model ┐
 *   e-dienst ├─ formulierGraaf ─▶ graaf ─ formulierRegels ─▶ plan ─ openformsSchrijver ─▶ {bestand: inhoud}
 *   (M0)     ┘                                                                                 ─▶ artefact
 *
 * Zelfde artefactvorm als het objecttype (objecttypeArtefact.js): identificatie,
 * inhoud met payloadHash = sha256 over JCS(payload), herkomst, traceregels per
 * modelknoop. De payload is het JSON-object {bestandsnaam: inhoud} dat de
 * uitrol-adapter van FUNDAMENT aanneemt.
 *
 * **Aansluiting key ↔ property.** Het formulier registreert in het objecttype
 * waarvan het afhangt. Wordt dat objecttype-artefact meegegeven, dan toetst de
 * aansluiting per component of zijn modelknoop ook een property in het
 * objecttype is (via de traceregels van beide), en idem voor de vaste waarden
 * en de waarden uit de inlog. Een veld dat het objecttype niet kent is een
 * waarschuwing: het gegeven gaat bij de registratie verloren.
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { formulierGraaf } from "../../transformatie/formulierGraaf.js";
import { pasRegelsToe } from "../../transformatie/regels.js";
import { planNaarOpenforms, OF_RELEASE } from "../../transformatie/openformsSchrijver.js";
import { jcsHash } from "../../transformatie/jcs.js";
import { CANONIEK_NAAR_FORMULIER } from "./formulierRegels.js";

export const SCHRIJVER_ID = "openforms-schrijver@0.2.0";

const ACTIE = { gemaakt: "aangemaakt", genegeerd: "weggelaten", "geen-regel": "geen-regel", overgeslagen: "overgeslagen", opgegaan: "opgegaan", gezet: "gezet" };

/** Een uuid (vorm v5) uit een sha256-hex: deterministisch per formulier en deel. */
function alsUuid(hex) {
  const h = hex.slice(0, 32).split("");
  h[12] = "5";
  h[16] = "89ab"[parseInt(h[16], 16) % 4];
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand
 * @param {any} invoer.edienst
 * @param {string} invoer.identifier          - de slug van het formulier in het e-dienstmodel
 * @param {any[]} [invoer.datatypen]
 * @param {Record<string, any[]>} [invoer.referentielijsten] - M0-items per referentielijst (keuzelijsten)
 * @param {any} [invoer.objecttype]            - het objecttype-artefact waarin het formulier registreert (aansluiting)
 * @param {string|null} [invoer.peiltijdstip]
 * @param {string} [invoer.versienummer]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @param {any} [invoer.regelset]
 */
export async function maakFormulierArtefact({
  modelBestand,
  edienst,
  identifier,
  datatypen = [],
  referentielijsten = {},
  objecttype = null,
  peiltijdstip = null,
  versienummer,
  sha256Hex,
  regelset = CANONIEK_NAAR_FORMULIER,
}) {
  const model = modelBestand?.model || modelBestand;
  const keuzes = (edienst?.artefacten || []).find((a) => a.identifier === identifier);
  if (!keuzes) throw new Error(`Artefact "${identifier}" staat niet in het e-dienstmodel.`);
  if (keuzes.soort !== "formulier") throw new Error(`Artefact "${identifier}" is een ${keuzes.soort}, geen formulier.`);

  const diagnostics = [];
  const bronmodelHash = await jcsHash(model, sha256Hex);
  const verwacht = String(edienst?.bronmodel?.hash || "").replace(/^sha256:/, "");
  if (verwacht && verwacht !== bronmodelHash) {
    diagnostics.push({ severity: "warning", code: "ART-BRONMODEL", message: `Het model (sha256 ${bronmodelHash}) is niet de versie uit het e-dienstmodel (${verwacht})`, sourceId: null, path: null });
  }

  const graaf = formulierGraaf({ model, keuzes, datatypen, referentielijsten });
  for (const w of graaf.waarschuwingen) diagnostics.push({ severity: "warning", code: "FRM-LEZER", message: w.melding, sourceId: w.tekst || null, path: null });

  const plan = pasRegelsToe(graaf, regelset);
  diagnostics.push(...plan.diagnostics);

  // Deterministische uuid's: vooraf berekend, zodat de schrijver puur blijft.
  const delen = ["formulier", ...(keuzes.stappen || []).flatMap((s) => [`stap:${s.slug}`, `definitie:${s.slug}`])];
  const uuids = new Map();
  for (const deel of delen) uuids.set(deel, alsUuid(await sha256Hex(`omnium-inrichting:formulier:${keuzes.identifier}:${deel}`)));
  // Eerst de aansluiting: daaruit volgt de registratie naar het objecttype.
  const aansluiting = sluitAan({ graaf, keuzes, objecttype, diagnostics });
  const registratie = objecttype ? registratieUit(aansluiting, objecttype, diagnostics, keuzes.registratie?.bijlagen) : null;
  if (!objecttype) diagnostics.push({ severity: "info", code: "FRM-GEEN-REGISTRATIE", message: "Geen objecttype meegegeven: het formulier registreert nergens (registration_backends leeg)", sourceId: null, path: null });

  const geschreven = planNaarOpenforms(plan, { uuidVoor: (deel) => uuids.get(deel), ofRelease: keuzes.doelVersie || OF_RELEASE, registratie });
  diagnostics.push(...geschreven.diagnostics);
  if (!geschreven.bestanden) throw Object.assign(new Error("Geen formulier geschreven."), { diagnostics });

  const traceregels = plan.trace.map((spoor) => ({
    bronGE: spoor.bronId,
    regel: spoor.regel,
    doelPad: geschreven.paden.get(spoor.doel) ?? null,
    actie: ACTIE[spoor.actie] || spoor.actie,
  }));
  // De registratie hoort ook in de trace: per component de mapping, per vaste
  // waarde de variabele, en het pad voor de BSN uit de inlog.
  for (const r of registratie ? aansluiting.filter((a) => a.objectPad) : []) {
    const sleutel = { component: `mapping:${r.key}`, vasteWaarde: `vast:${r.variabele}`, uitOpenFormulieren: `of:${r.key}`, uitInlog: "auth" }[r.bron];
    const regel = {
      component: "Registratie: component → objecttype",
      vasteWaarde: "Registratie: vaste waarde (e-dienstmodel)",
      uitOpenFormulieren: "Registratie: variabele van Open Formulieren (e-dienstmodel)",
      uitInlog: "Registratie: waarde uit de inlog (e-dienstmodel)",
    }[r.bron];
    if (geschreven.paden.has(sleutel)) traceregels.push({ bronGE: r.modelknoop, regel, doelPad: geschreven.paden.get(sleutel), actie: "aangemaakt" });
  }

  const payload = geschreven.bestanden;
  const payloadHash = await jcsHash(payload, sha256Hex);
  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || `Formulier ${keuzes.identifier}`,
      versienummer: versienummer || keuzes.versienummer || edienst?.edienst?.versienummer || "0.1.0",
      ...(keuzes.doelVersieRange ? { doelVersieRange: keuzes.doelVersieRange } : {}),
    },
    artefactInhoud: { formaat: keuzes.formaat, payload, payloadHash },
    artefactHerkomst: {
      regelsetId: regelset.id,
      regelsetVersie: regelset.versie,
      bronmodelHash,
      bronmodelVersie: edienst?.bronmodel?.versie || null,
      schrijverId: SCHRIJVER_ID,
      peiltijdstip,
    },
    traceregels,
    edienstversie: { edienst: edienst?.edienst?.naam, versienummer: edienst?.edienst?.versienummer },
    doelcomponent: keuzes.doelcomponent,
    afhankelijkheden: (edienst?.afhankelijkheden || [])
      .filter((a) => a.artefact === keuzes.identifier)
      .map((a) => ({ identifier: a.afhankelijkVan, reden: a.reden })),
  };
  return { artefact, graaf, plan, aansluiting, diagnostics };
}

/**
 * Key ↔ property via dezelfde modelknoop. Geeft per component (en per vaste
 * waarde / inlogwaarde) het pad in het objecttype, of null.
 */
function sluitAan({ graaf, keuzes, objecttype, diagnostics }) {
  if (!objecttype) return [];
  const naarPad = new Map((objecttype.traceregels || []).filter((t) => t.bronGE && t.actie === "aangemaakt").map((t) => [t.bronGE, t.doelPad]));
  const naam = objecttype.artefactIdentificatie?.identifier || "het objecttype";
  if (keuzes.registratie?.objecttype && keuzes.registratie.objecttype !== naam) {
    diagnostics.push({ severity: "warning", code: "FRM-OBJECTTYPE", message: `Het formulier registreert in "${keuzes.registratie.objecttype}", maar het meegegeven objecttype is "${naam}"`, sourceId: null, path: null });
  }
  const regels = [
    ...graaf.knopen.map((k) => ({ bron: "component", key: k.eigenschappen.key, modelknoop: k.id })),
    ...Object.entries(keuzes.registratie?.vasteWaarden || {}).map(([pad, waarde]) => ({ bron: "vasteWaarde", key: null, modelknoop: pad, waarde })),
    ...Object.entries(keuzes.registratie?.uitInlog || {}).map(([pad, inlogVariabele]) => ({ bron: "uitInlog", key: null, modelknoop: pad, inlogVariabele })),
    // Waarden die Open Formulieren zelf kent: registratievariabele (public_reference) of statische variabele (now).
    ...Object.entries(keuzes.registratie?.uitOpenFormulieren || {}).map(([pad, variabele]) => ({ bron: "uitOpenFormulieren", key: variabele, modelknoop: pad })),
  ].map((r) => {
    const objecttypePad = naarPad.get(r.modelknoop) ?? null;
    const objectPad = objecttypePad ? objectPadUit(objecttypePad) : null;
    return { ...r, objecttypePad, objectPad, variabele: r.bron === "vasteWaarde" && objectPad ? `vast_${objectPad.join("_")}` : null };
  });
  for (const r of regels.filter((r) => !r.objecttypePad)) {
    diagnostics.push({
      severity: "warning",
      code: "FRM-AANSLUITING",
      message: `${r.key ? `Component "${r.key}"` : `Een ${{ uitInlog: "waarde uit de inlog", uitOpenFormulieren: "variabele van Open Formulieren", vasteWaarde: "vaste waarde" }[r.bron]}`} (${r.modelknoop}) heeft geen property in ${naam}`,
      sourceId: r.modelknoop,
      path: null,
    });
  }
  return regels;
}

/**
 * Pad in het JSON-schema (trace van het objecttype) → padsegmenten in het
 * object, zoals de registratie van Open Formulieren ze wil:
 * "/jsonSchema/properties/partijen/items/properties/partijrol" →
 * ["partijen", 0, "partijrol"]. Een lijst wordt het eerste item: het formulier
 * levert één voorkomen (de aanvrager, de pasfoto).
 */
function objectPadUit(schemaPad) {
  const delen = schemaPad.replace(/^\/jsonSchema/, "").split("/").slice(1).map((d) => d.replace(/~1/g, "/").replace(/~0/g, "~"));
  const uit = [];
  for (let i = 0; i < delen.length; i += 1) {
    if (delen[i] === "properties") uit.push(delen[++i]);
    else if (delen[i] === "items") uit.push(0);
  }
  return uit;
}

/**
 * Open Formulieren schrijft een indexpad (["partijen", 0, "partijrol"]) alleen
 * goed in een lijst die al bestaat; anders wordt "0" een sleutel en weigert
 * Open Object het object ("is not of type 'array'", FUNDAMENT 27-10). Daarom per
 * lijst een gebruikersvariabele `vast_<lijst>` met één item als aanzet: de
 * vaste waarden van dat item plus lege objecten op de tussenliggende paden.
 * Een vaste waarde in een lijst wordt geen eigen variabele; de trace wijst naar
 * de aanzet.
 */
function lijstAanzetten(metPad, diagnostics) {
  const perLijst = new Map();
  const binnenLijst = new Set();
  for (const a of metPad) {
    const i = a.objectPad.findIndex((d) => typeof d === "number");
    if (i < 0) continue;
    const rest = a.objectPad.slice(i + 1);
    if (rest.some((d) => typeof d === "number")) {
      diagnostics.push({ severity: "warning", code: "FRM-LIJST", message: `Lijst in een lijst (${a.objectPad.join(".")}): alleen de buitenste lijst krijgt een aanzet`, sourceId: a.modelknoop, path: null });
    }
    const pad = a.objectPad.slice(0, i);
    const sleutel = `vast_${pad.join("_")}`;
    if (!perLijst.has(sleutel)) perLijst.set(sleutel, { key: sleutel, waarde: [{}], target_path: pad });
    let doel = perLijst.get(sleutel).waarde[0];
    for (const d of rest.slice(0, -1)) doel = doel[d] ??= {};
    if (a.bron === "vasteWaarde") {
      doel[rest[rest.length - 1]] = a.waarde;
      a.variabele = sleutel;
      binnenLijst.add(a);
    }
  }
  return { aanzetten: [...perLijst.values()], binnenLijst };
}

/** De registratie voor de schrijver: mapping per component, vaste waarden, BSN-pad. */
function registratieUit(aansluiting, objecttype, diagnostics, bijlagen) {
  const metPad = aansluiting.filter((a) => a.objectPad);
  const inlog = metPad.filter((a) => a.bron === "uitInlog");
  if (inlog.length > 1) diagnostics.push({ severity: "warning", code: "FRM-INLOG", message: "Meer dan één waarde uit de inlog; Open Formulieren kent één auth_attribute_path, alleen de eerste telt", sourceId: inlog[1].modelknoop, path: null });
  const { aanzetten, binnenLijst } = lijstAanzetten(metPad, diagnostics);
  return {
    objecttype: objecttype.artefactIdentificatie?.identifier,
    mapping: metPad.filter((a) => a.bron === "component").map((a) => ({ variable_key: a.key, target_path: a.objectPad })),
    // Eerst de lijst-aanzetten (met de vaste waarden van hun item), dan de vaste waarden buiten een lijst.
    vast: [
      ...aanzetten,
      ...metPad.filter((a) => a.bron === "vasteWaarde" && !binnenLijst.has(a)).map((a) => ({ key: a.variabele, waarde: a.waarde, target_path: a.objectPad })),
    ],
    // De statische variabele met het BSN; de e-dienst noemt hem ("auth_bsn (DigiD)").
    authVariabele: (String(inlog[0]?.inlogVariabele || "").match(/^auth_\w+/) || ["auth_bsn"])[0],
    uitOF: metPad.filter((a) => a.bron === "uitOpenFormulieren").map((a) => ({ variable_key: a.key, target_path: a.objectPad })),
    authPad: inlog[0]?.objectPad || null,
    // Bestanden naar de Documenten API onder dit informatieobjecttype (omschrijving).
    iotBijlagen: bijlagen?.informatieobjecttype || null,
  };
}
