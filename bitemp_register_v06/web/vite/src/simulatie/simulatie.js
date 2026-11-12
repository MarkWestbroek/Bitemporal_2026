// @ts-check
/**
 * simulatie — de interpreter: laat een token door een BPMN-proces lopen met
 * cm-objecten in een store. Ontwerp: docs/plans/2026-11-12 Simulatie van BPMN
 * en DMN met cm-objecten.
 *
 * Geen process engine: een denk- en demonstratiehulp. Geen timers en geen
 * eigen klok; de aanroeper bepaalt het tempo met `stap()`.
 *
 * Invoer:
 *   m1        {proces, beslissingen[], edienst?, cm?} - de M1-set (formaat.js)
 *   scenario  {start: {proces?, type, id?, object, variabelen?}, antwoorden?, vulwijze?, zaadje?}
 *
 * Eén afhandeling per simulatie: het startobject is de sleutel (in de stack
 * de business key van het dossier). Alle procesinstanties delen dat object en
 * de procesvariabelen; berichten tussen de eigen processen dragen een
 * referentie, geen kopie (ontwerp §3.2 en §3.3).
 *
 * Dekking (ontwerp §4): start- en eindevents (geen, bericht, terminate; fout,
 * escalatie en annulering breken af), tussen-events met een bericht, taken
 * (user, service, business rule, send, receive), exclusieve en parallelle
 * gateways, call activity en subproces als eigen instantie. Al het andere
 * (inclusieve gateway, boundary events, …) laat het token staan: de run
 * eindigt dan als vastgelopen, met de reden erbij.
 *
 * Puur: alle toestand staat in het log (store.js).
 */
import { legeToestand, pasToe, toestandUit, PROCESINSTANTIE } from "./store.js";
import { leesProcessen, gewoneStart, startOpBericht } from "./procesmodel.js";
import { rekenBeslissingUit, vindBeslissing, rekenCel, Onleesbaar } from "./beslistabel.js";
import { verwachtVoorFormulier, willekeurig, kiesWijze, antwoordUitFixture, toets } from "./gaten.js";
import { leesAlsCel, isJuel } from "../transformatie/celOmzetting.js";
import { zetLijst, berichtVariabele } from "../transformatie/bpmnXmlSchrijver.js";

/** GZAC leest een veld van het dossier: `${documentDelegateService.findValueByJsonPointer…("/veld", …)}` (ontwerp §8 vraag 11). */
const DOSSIERVELD = /^\s*\$\{\s*documentDelegateService\.findValueByJsonPointer(?:OrDefault)?\(\s*["']\/([A-Za-z0-9_/]+)["']/;

const AFBREKEND = new Set(["fout", "escalatie", "annulering"]);

/**
 * @param {Object} invoer
 * @param {{proces: any, beslissingen?: any[], edienst?: any, cm?: any}} invoer.m1
 * @param {any} invoer.scenario
 */
export function maakSimulatie({ m1, scenario }) {
  const { elementen, processen } = leesProcessen(m1.proces, m1.edienst);
  const procesVan = (id) => processen.find((p) => p.id === id);
  const procesMet = (elementId) => processen.find((p) => p.elementen.has(elementId));
  /** @type {any[]} */
  let log = [];
  let t = legeToestand();
  /** De logregel van de lopende stap. */
  let regel = null;
  let sleutel = null;

  const doe = (mutatie) => {
    regel.wijzigingen.push(pasToe(t, mutatie));
  };
  const nieuweRegel = (wat, plek = null, instantie = null) => {
    regel = { nr: log.length + 1, wat, ...(plek ? { plek } : {}), ...(instantie ? { instantie } : {}), wijzigingen: [] };
    log.push(regel);
    return regel;
  };
  const nieuwId = (soort) => `${soort}-${regel.nr}-${regel.wijzigingen.length + 1}`;
  const object = () => t.objecten[sleutel];
  const context = () => ({ ...(object()?.data || {}), ...t.variabelen });
  const tokensVan = (instantie) => Object.values(t.tokens).filter((k) => k.instantie === instantie);

  // ── Instanties en tokens ────────────────────────────────────────────

  function startInstantie(proces, startElement, ouderToken = null) {
    const id = nieuwId("instantie");
    doe({ soort: "maak", id, type: PROCESINSTANTIE, data: { proces: proces.id, naam: proces.naam, sleutel, state: "lopend", ...(ouderToken ? { ouderToken } : {}) } });
    doe({ soort: "token", id: nieuwId("token"), instantie: id, plek: startElement.id, status: "klaar" });
    return id;
  }

  const wacht = (token, wachtOp) => doe({ soort: "token", id: token.id, instantie: token.instantie, plek: token.plek, status: "wacht", wachtOp });

  /** Het token verlaat zijn element langs de uitgaande flows. */
  function verder(token) {
    const proces = procesMet(token.plek);
    const uit = proces?.uit.get(token.plek) || [];
    if (!uit.length) return verbruik(token, null);
    uit.forEach((flow, i) => {
      doe({ soort: "token", id: i ? nieuwId("token") : token.id, instantie: token.instantie, plek: flow.target, via: flow.id, status: "klaar", wachtOp: null });
    });
  }

  const langs = (token, flow) => doe({ soort: "token", id: token.id, instantie: token.instantie, plek: flow.target, via: flow.id, status: "klaar", wachtOp: null });

  /** Haalt een token weg dat niet meer verder gaat; een gat dat erop wachtte vervalt. */
  function ruimOp(token) {
    if (token.wachtOp?.soort === "gat" && t.gaten[token.wachtOp.id]?.open) doe({ soort: "gat", id: token.wachtOp.id, open: false, vervallen: true });
    doe({ soort: "token", id: token.id, plek: null });
  }

  /** Het token is op; is de instantie daarmee klaar, dan gaat de ouder verder. */
  function verbruik(token, einde) {
    doe({ soort: "token", id: token.id, plek: null });
    rondAf(token.instantie, einde);
  }

  function rondAf(instantieId, einde, afgebroken = false) {
    const instantie = t.objecten[instantieId];
    if (instantie.data.state !== "lopend") return;
    if (afgebroken) for (const k of tokensVan(instantieId)) ruimOp(k);
    if (tokensVan(instantieId).length) return;
    doe({ soort: "overgang", id: instantieId, veld: "state", naar: afgebroken ? "afgebroken" : "klaar", ...(einde ? { bij: einde } : {}) });
    if (einde) doe({ soort: "zet", id: instantieId, velden: { einde } });
    const ouder = instantie.data.ouderToken && t.tokens[instantie.data.ouderToken];
    if (!ouder) return;
    if (afgebroken) rondAf(ouder.instantie, einde, true);
    else verder(ouder);
  }

  // ── Gaten ───────────────────────────────────────────────────────────

  /**
   * Opent een gat op de plek van het token en vult het meteen als de vulwijze
   * dat toelaat (fixture met een antwoord, of willekeurig).
   */
  function openGat(token, el, soort, velden, extra = {}) {
    const sleutels = [el.data?.bpmnId, el.id, el.naam].filter(Boolean);
    const bezoek = Object.values(t.gaten).filter((g) => g.plek === el.id).length + 1;
    const gat = { id: nieuwId("gat"), aard: soort, plek: el.id, naam: el.naam || el.data?.bpmnId || el.id, sleutels, bezoek, velden, token: token.id, ...extra };
    const wijze = kiesWijze(scenario.vulwijze, gat);
    doe({ soort: "gat", ...gat, open: true });
    wacht(token, { soort: "gat", id: gat.id });
    let waarde;
    if (wijze === "fixture") waarde = antwoordUitFixture(scenario.antwoorden, gat);
    else if (wijze === "willekeurig") waarde = willekeurig(velden, `${scenario.zaadje ?? 0}/${sleutels[0]}/${bezoek}`);
    if (waarde !== undefined) vulGat(t.gaten[gat.id], waarde, wijze);
  }

  function vulGat(gat, waarde, wijze) {
    const bezwaren = toets(gat.velden, waarde);
    if (bezwaren.length) throw new Error(`Gat "${gat.naam}": ${bezwaren.join("; ")}`);
    doe({ soort: "gat", id: gat.id, open: false, waarde, wijze });
    const token = t.tokens[gat.token];
    const el = elementen[gat.plek];
    if (gat.aard === "dienst") {
      const items = gat.voor?.length ? gat.voor : [null];
      items.forEach((item, i) => {
        doe({ soort: "extern", actie: gat.actie, ...(gat.doel ? { doel: gat.doel } : {}), element: gat.naam, ...(item !== null ? { voor: item } : {}), verwijzing: items.length > 1 ? `${waarde.verwijzing}/${i + 1}` : waarde.verwijzing });
      });
    } else if (gat.kiest === "pad") {
      const flow = (procesMet(el.id)?.uit.get(el.id) || []).find((f) => f.id === waarde.pad || f.naam === waarde.pad);
      if (!flow) throw new Error(`Gat "${gat.naam}": het pad "${waarde.pad}" bestaat niet`);
      return langs(token, flow);
    } else if (gat.kiest === "variabelen") {
      for (const [naam, w] of Object.entries(waarde)) doe({ soort: "variabele", naam, waarde: w });
    } else if (gat.kiest === "resultaat") {
      doe({ soort: "variabele", naam: gat.resultaat, waarde });
    } else {
      // taak of partner: wat is ingevuld komt bij het object van de afhandeling.
      const velden = Object.fromEntries(Object.entries(waarde || {}).filter(([, w]) => w !== undefined));
      if (Object.keys(velden).length) doe({ soort: "zet", id: sleutel, velden });
    }
    verder(token);
  }

  // ── Berichten ───────────────────────────────────────────────────────

  /** Werpt een bericht. Geeft false als het token moet wachten (een gat). */
  function werp(token, el) {
    let naam = el.data?.bericht || "";
    const variabele = berichtVariabele(naam);
    if (variabele) {
      naam = variabele.naam ? t.variabelen[variabele.naam] : null;
      if (!naam) {
        wacht(token, { soort: "vast", reden: `de berichtnaam ${el.data.bericht} is niet te bepalen` });
        return false;
      }
    }
    if (!naam) return true;
    regel.bericht = naam;
    // Een lopend proces van deze afhandeling wacht erop: wekken.
    const wachtend = Object.values(t.tokens).find((k) => k.status === "wacht" && k.wachtOp?.soort === "bericht" && k.wachtOp.naam === naam);
    if (wachtend) {
      verder(wachtend);
      return true;
    }
    const doel = startOpBericht(processen, elementen, naam);
    if (doel) {
      startInstantie(doel.proces, doel.start);
      return true;
    }
    // Niemand luistert nu: het bericht blijft liggen tot een vangend event het ophaalt.
    doe({ soort: "bericht", naam });
    return true;
  }

  // ── De regels per elementtype ───────────────────────────────────────

  function voerTaak(token, el) {
    const d = el.data || {};
    const proces = procesMet(el.id);
    if (d.aangeroepenProces) {
      const kind = procesVan(d.aangeroepenProces);
      const start = kind && gewoneStart(kind, elementen);
      if (!start) return wacht(token, { soort: "vast", reden: `het aangeroepen proces "${d.aangeroepenProces}" is niet gevonden` });
      wacht(token, { soort: "kind" });
      return void startInstantie(kind, start, token.id);
    }
    const soort = d.taakSoort || "";
    if (soort === "businessRule") {
      const gevonden = vindBeslissing(m1.beslissingen, d.beslissing, m1.edienst);
      const resultaat = d.resultaat || d.beslissing;
      try {
        if (!gevonden) throw new Onleesbaar(`de beslistabel "${d.beslissing}" is niet gevonden`);
        const uit = rekenBeslissingUit(gevonden, { object: object()?.data || {}, variabelen: t.variabelen });
        regel.beslissing = { tabel: d.beslissing, regel: uit.regel, invoer: uit.invoer };
        doe({ soort: "variabele", naam: resultaat, waarde: uit.uitkomst });
        return verder(token);
      } catch (e) {
        if (!(e instanceof Onleesbaar)) throw e;
        const velden = (gevonden?.beslissing.data?.beslistabel?.outputs || []).map((k) => ({ naam: k.naam, type: k.type || "string" }));
        return openGat(token, el, "expressie", velden, { kiest: "resultaat", resultaat, reden: e.message });
      }
    }
    if (soort === "service") {
      if (d.dossierstatus) doe({ soort: "overgang", id: sleutel, veld: "status", naar: d.dossierstatus });
      const onleesbaar = [];
      for (const { naam, waarde } of zetLijst(d.zetVariabelen)) {
        const veld = DOSSIERVELD.exec(waarde);
        if (veld) doe({ soort: "variabele", naam, waarde: veld[1].split("/").reduce((o, k) => o?.[k], object()?.data) ?? null });
        else if (isJuel(waarde)) {
          try {
            doe({ soort: "variabele", naam, waarde: rekenCel(leesAlsCel(waarde), context()) });
          } catch (e) {
            if (!(e instanceof Onleesbaar)) throw e;
            onleesbaar.push({ naam, type: "string" });
          }
        } else doe({ soort: "variabele", naam, waarde });
      }
      if (d.actie) {
        // Een actie buiten het cm (zaak, rol, document, status in de Zaken API): een stub geeft een verwijzing.
        const lijst = d.meervoudig ? context()[d.lusVerzameling] : null;
        return openGat(token, el, "dienst", [{ naam: "verwijzing", type: "url", verplicht: true }], { actie: d.actie, ...(d.actieDoel ? { doel: d.actieDoel } : {}), ...(Array.isArray(lijst) ? { voor: lijst } : {}) });
      }
      if (onleesbaar.length) return openGat(token, el, "expressie", onleesbaar, { kiest: "variabelen", reden: "de waarde is niet te lezen" });
      return verder(token);
    }
    const partner = proces?.partner.get(el.id) || (d.actie === "portaaltaakAanmaken" ? "de klant (portaal)" : null);
    if (soort === "user" || soort === "receive" || (soort === "send" && partner)) {
      const formulier = d.formulier ? verwachtVoorFormulier(m1.edienst, d.formulier) : { velden: [], gevonden: false };
      return openGat(token, el, partner || soort === "receive" ? "partner" : "taak", formulier.velden, {
        ...(d.formulier ? { formulier: d.formulier, formulierBekend: formulier.gevonden } : {}),
        ...(partner ? { partner } : {}),
      });
    }
    return verder(token);
  }

  function voerExclusief(token, el) {
    const uit = procesMet(el.id)?.uit.get(el.id) || [];
    if (uit.length <= 1) return verder(token);
    const keuze = (reden) => openGat(token, el, "expressie", [{ naam: "pad", verplicht: true, keuzes: uit.map((f) => f.naam || f.id) }], { kiest: "pad", reden });
    for (const flow of uit) {
      if (flow.data?.standaard || !flow.data?.conditie) continue;
      let waar;
      try {
        waar = rekenCel(leesAlsCel(flow.data.conditie), context());
      } catch (e) {
        if (!(e instanceof Onleesbaar)) throw e;
        return keuze(e.message);
      }
      if (waar) {
        regel.conditie = flow.data.conditie;
        return langs(token, flow);
      }
    }
    const standaard = uit.find((f) => f.data?.standaard) || uit.find((f) => !f.data?.conditie);
    if (standaard) return langs(token, standaard);
    return wacht(token, { soort: "vast", reden: "geen conditie is waar en er is geen standaardpad" });
  }

  function voerParallel(token, el) {
    const proces = procesMet(el.id);
    const inkomend = proces?.in.get(el.id) || [];
    if (inkomend.length > 1) {
      wacht(token, { soort: "samenkomst" });
      const hier = tokensVan(token.instantie).filter((k) => k.plek === el.id && k.wachtOp?.soort === "samenkomst");
      const perFlow = inkomend.map((f) => hier.find((k) => k.via === f.id));
      if (perFlow.some((k) => !k)) return;
      const [eerste, ...rest] = perFlow;
      for (const k of rest) doe({ soort: "token", id: k.id, plek: null });
      return verder(t.tokens[eerste.id]);
    }
    return verder(token);
  }

  function voer(token) {
    const el = elementen[token.plek];
    const soort = el.data?.soort || "";
    switch (el.elementType) {
      case "start-event":
        return verder(token);
      case "taak":
        return voerTaak(token, el);
      case "exclusief":
        return voerExclusief(token, el);
      case "parallel":
        return voerParallel(token, el);
      case "tussen-event": {
        if (soort !== "bericht") return verder(token); // timer, signaal, …: niet nagespeeld
        if (el.data?.richting === "werpt") return werp(token, el) ? verder(t.tokens[token.id]) : undefined;
        if (t.berichten.some((b) => b.naam === el.data?.bericht)) {
          doe({ soort: "bericht", naam: el.data.bericht, weg: true });
          return verder(token);
        }
        return wacht(token, { soort: "bericht", naam: el.data?.bericht });
      }
      case "eind-event": {
        if (soort === "bericht" && !werp(token, el)) return;
        if (AFBREKEND.has(soort)) return rondAf(token.instantie, el.naam || soort, true);
        if (soort === "terminate") for (const k of tokensVan(token.instantie)) if (k.id !== token.id) ruimOp(k);
        return verbruik(token, el.naam || "einde");
      }
      case "subproces": {
        const kind = processen.find((p) => p.diagramId === el.data?.gedragDiagramId);
        const start = kind && gewoneStart(kind, elementen);
        if (!start) return verder(token);
        wacht(token, { soort: "kind" });
        return void startInstantie(kind, start, token.id);
      }
      default:
        return wacht(token, { soort: "vast", reden: `"${el.elementType}" speelt de simulatie niet na` });
    }
  }

  // ── De buitenkant ───────────────────────────────────────────────────

  /**
   * Waar staat de run: loopt (er kan een stap), gat (wacht op invoer), of een
   * van de drie einden (ontwerp §2.2).
   */
  function stand() {
    const tokens = Object.values(t.tokens);
    if (!log.length) return { soort: "niet-gestart" };
    if (tokens.some((k) => k.status === "klaar")) return { soort: "loopt" };
    const open = Object.values(t.gaten).filter((g) => g.open);
    if (open.length) return { soort: "gat", gaten: open };
    const instanties = Object.values(t.objecten).filter((o) => o.type === PROCESINSTANTIE);
    if (tokens.length) {
      return {
        soort: "vastgelopen",
        tokens: tokens.map((k) => ({ id: k.id, plek: k.plek, naam: elementen[k.plek]?.naam || k.plek, wachtOp: k.wachtOp })),
      };
    }
    const afgebroken = instanties.filter((i) => i.data.state === "afgebroken");
    if (afgebroken.length) return { soort: "uitzondering", bij: afgebroken.map((i) => i.data.einde) };
    return { soort: "uitkomst", eindes: instanties.map((i) => ({ proces: i.data.proces, einde: i.data.einde })) };
  }

  /** Zet het startobject klaar en start het proces. */
  function start() {
    if (log.length) throw new Error("De simulatie is al gestart");
    const s = scenario.start || {};
    const proces = s.proces ? procesVan(s.proces) || processen.find((p) => p.naam === s.proces) : processen.find((p) => gewoneStart(p, elementen));
    const startEvent = proces && gewoneStart(proces, elementen);
    if (!startEvent) throw new Error(`Geen proces met een startevent gevonden${s.proces ? ` voor "${s.proces}"` : ""}`);
    sleutel = s.id || "startobject";
    nieuweRegel(`Start: ${s.type || "object"} bij "${startEvent.naam || proces.naam}"`, startEvent.id);
    doe({ soort: "maak", id: sleutel, type: s.type || "Object", data: s.object || {} });
    for (const [naam, waarde] of Object.entries(s.variabelen || {})) doe({ soort: "variabele", naam, waarde });
    regel.instantie = startInstantie(proces, startEvent);
    return regel;
  }

  /** Zet één stap: het eerste token dat kan bewegen voert de regel van zijn element uit. */
  function stap() {
    if (!log.length) return start();
    const token = Object.values(t.tokens).find((k) => k.status === "klaar");
    if (!token) return null;
    const el = elementen[token.plek];
    nieuweRegel(el.naam || el.data?.bpmnId || el.elementType, el.id, token.instantie);
    regel.elementType = el.elementType;
    voer(token);
    return regel;
  }

  /** Loopt door tot een gat of een einde. */
  function loop(maximum = 10000) {
    let n = 0;
    while ((stand().soort === "loopt" || stand().soort === "niet-gestart") && n++ < maximum) stap();
    return stand();
  }

  /** Vult een open gat met de hand. */
  function vul(gatId, waarde) {
    const gat = t.gaten[gatId];
    if (!gat?.open) throw new Error(`Gat "${gatId}" staat niet open`);
    const bezwaren = toets(gat.velden, waarde);
    if (bezwaren.length) throw new Error(`Gat "${gat.naam}": ${bezwaren.join("; ")}`);
    nieuweRegel(`Gat gevuld: ${gat.naam}`, gat.plek, t.tokens[gat.token]?.instantie);
    vulGat(gat, waarde, "hand");
    return regel;
  }

  /** Spoelt terug tot na logregel `nr` (0 = vóór de start). */
  function spoelTerug(nr) {
    log = log.slice(0, nr);
    t = toestandUit(log);
    regel = null;
  }

  return {
    processen,
    start,
    stap,
    loop,
    vul,
    stand,
    spoelTerug,
    /** De toestand nu, of na logregel `nr`. */
    toestand: (nr) => (nr === undefined ? t : toestandUit(log, nr)),
    get log() {
      return log;
    },
  };
}
