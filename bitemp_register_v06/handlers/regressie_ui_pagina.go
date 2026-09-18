//go:build devtools

// regressie_ui_pagina.go — HTML/JS van de suite-editor (inline, geen CDN, geen build-stap).
// Let op bij bewerken: dit is een Go raw string, dus géén backticks in de JavaScript.
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func regressiePagina(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(regressiePaginaHTML))
}

const regressiePaginaHTML = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Testsuite np-loc</title>
<style>
  :root { color-scheme: light dark; --ok:#16a34a; --fail:#dc2626; --skip:#d97706; --blauw:#2563eb; --muted:#6b7280; --line:#d1d5db; --vlak:#80808014; }
  * { box-sizing: border-box; }
  body { font: 14px/1.45 system-ui, sans-serif; margin: 0; padding: 18px 22px 60px; max-width: 1280px; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 16px; margin: 0 0 8px; } h3 { font-size: 13px; margin: 14px 0 4px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .sub { color: var(--muted); margin: 2px 0 12px; }
  .rij { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
  .groei { flex: 1 1 auto; }
  input[type=text], input[type=password], input[type=number], select, textarea { padding: 5px 7px; border: 1px solid var(--line); border-radius: 6px; font: inherit; background: transparent; color: inherit; }
  textarea { width: 100%; font: 12px/1.4 ui-monospace, Consolas, monospace; }
  textarea.fout, input.fout { border-color: var(--fail); outline: 1px solid var(--fail); }
  button { padding: 5px 11px; border-radius: 6px; border: 1px solid var(--line); cursor: pointer; background: var(--vlak); color: inherit; font: inherit; }
  button.primair { background: var(--blauw); color: #fff; border-color: var(--blauw); }
  button.gevaar { color: var(--fail); } button.mini { padding: 1px 6px; font-size: 12px; } button:disabled { opacity: .45; cursor: default; }
  table { border-collapse: collapse; width: 100%; } th, td { text-align: left; padding: 5px 7px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 12px; color: var(--muted); font-weight: 600; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; background: var(--muted); white-space: nowrap; }
  .pass { background: var(--ok); } .fail { background: var(--fail); } .skip { background: var(--skip); } .bezig { background: var(--blauw); }
  .chip { display: inline-block; font-size: 11px; border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; margin: 0 3px 2px 0; color: var(--muted); }
  .chip.dekt { border-color: var(--blauw); color: var(--blauw); } .chip.uit { border-color: var(--skip); color: var(--skip); }
  pre { font-size: 12px; background: var(--vlak); padding: 8px; border-radius: 6px; max-height: 320px; overflow: auto; white-space: pre-wrap; margin: 4px 0 0; }
  details > summary { cursor: pointer; color: var(--muted); font-size: 12px; }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin: 14px 0 10px; }
  .tabs button { border: none; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 6px 12px; }
  .tabs button.actief { border-bottom-color: var(--blauw); color: var(--blauw); font-weight: 600; }
  .paneel { border: 1px solid var(--line); border-radius: 8px; padding: 14px; margin: 12px 0; background: var(--vlak); }
  .stap { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin: 6px 0; background: Canvas; }
  .stap.uit { opacity: .55; } .stap .kop { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .nr { font-weight: 700; color: var(--muted); min-width: 22px; }
  .melding { color: var(--fail); } .melding.ok { color: var(--ok); }
  .samenvatting { font-weight: 600; }
  label.veld { display: flex; flex-direction: column; font-size: 12px; color: var(--muted); gap: 2px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px 12px; }
  .rechts { text-align: right; white-space: nowrap; } .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<div class="rij">
  <h1>Testsuite np-loc</h1>
  <span class="groei"></span>
  <label>DSN <input type="text" id="dsn" style="min-width:330px" placeholder="postgres://…/bitemp_regressie_np_loc"></label>
  <label>Wachtwoord <input type="password" id="pw" placeholder="DEVLOOP_PASSWORD" style="width:140px"></label>
  <label title="Draai de suite met -tags devtools (mét /admin/*-routes)"><input type="checkbox" id="devtools"> devtools-build</label>
</div>
<div class="sub">Regressie, load en traceability op één plek. Scenario's staan als JSON in <code id="declmap">regressie/scenarios</code>; alleen 00 (DB-reset + seed) is Go. Elke run bouwt de database opnieuw op.</div>

<div class="rij">
  <button class="primair" data-actie="run-alles">▶ Alles afspelen</button>
  <button data-actie="run-selectie">▶ Selectie afspelen</button>
  <button data-actie="selectie-wissen">selectie wissen</button>
  <span style="width:14px"></span>
  <button data-actie="nieuw">+ Nieuw scenario</button>
  <button data-actie="import-open">⇪ Replay importeren als scenario</button>
  <span class="groei"></span>
  <span class="samenvatting" id="samenvatting"></span>
</div>
<div class="melding" id="melding"></div>

<div id="importpaneel" class="paneel" style="display:none">
  <h2>Replay-bestand importeren als bewerkbaar scenario</h2>
  <div class="sub">Elke entry wordt een request-stap (method, pad, body, verwachte status) die je daarna vrij kunt bewerken, herordenen en aanvullen met controles.</div>
  <div class="rij">
    <select id="imp-bestand" style="min-width:420px"></select>
    <label>Id <input type="text" id="imp-id" style="width:70px" placeholder="40"></label>
    <label>Naam <input type="text" id="imp-naam" style="min-width:240px" placeholder="(standaard: bestandsnaam)"></label>
    <button class="primair" data-actie="import-doe">Importeren</button>
    <button data-actie="import-sluit">Annuleren</button>
  </div>
</div>

<div id="editor"></div>

<div class="tabs">
  <button data-tab="suite" class="actief">Suite</button>
  <button data-tab="dekking">Dekking</button>
  <button data-tab="load">Load &amp; performance</button>
  <button data-tab="help">Formaat</button>
</div>

<div id="tab-suite">
  <table>
    <thead><tr><th style="width:26px"></th><th style="width:52px"></th><th style="width:46px">#</th><th>Scenario</th><th style="width:60px" class="num">Stappen</th><th style="width:100px">Status</th><th style="width:60px" class="num">Duur</th><th style="width:250px"></th></tr></thead>
    <tbody id="rijen"></tbody>
  </table>
  <details style="margin-top:12px"><summary>Run-log (buildfouten, go test-output)</summary><pre id="log"></pre></details>
</div>

<div id="tab-dekking" style="display:none">
  <div class="sub">Traceability: het veld <code>dekt</code> van een scenario verwijst naar requirements, use cases of reviewpunten. Hier zie je per verwijzing welke scenario's het afdekken en hun laatste resultaat. (Later te koppelen aan UML-elementen in Studio.)</div>
  <table><thead><tr><th style="width:220px">Verwijzing</th><th>Scenario's</th><th style="width:120px">Oordeel</th></tr></thead><tbody id="dekkingrijen"></tbody></table>
  <h3>Scenario's zonder verwijzing</h3><div id="ongedekt" class="sub"></div>
</div>

<div id="tab-load" style="display:none">
  <div class="sub">Speelt de request-stappen van één scenario af met N virtuele gebruikers × iteraties, in-process tegen API + Postgres (eigen database <code>…_load</code>). Variabelen <code>{{vu}}</code>, <code>{{iter}}</code>, <code>{{uniek}}</code> maken unieke id's. Drempels uit het loadprofiel laten de test falen bij een performance-regressie.</div>
  <div class="rij">
    <select id="load-id" style="min-width:380px"></select>
    <label title="leeg = waarde uit het loadprofiel van het scenario">vus <input type="number" id="load-vus" style="width:110px" min="1" placeholder="uit profiel"></label>
    <label title="leeg = waarde uit het loadprofiel van het scenario">iteraties <input type="number" id="load-iter" style="width:110px" min="1" placeholder="uit profiel"></label>
    <button class="primair" data-actie="load-start">⚡ Loadtest starten</button>
    <span id="load-melding" class="melding"></span>
  </div>
  <div class="rij">
    <label title="Niet resetten en niet seeden: draai op de dataset die er al staat (bv. na een dikke seed en een ronde mutaties)."><input type="checkbox" id="load-behoud"> database behouden (geen reset, geen seed)</label>
    <label title="Overschrijft de scenario-vars, bv. het id-bereik van de dikke seed.">vars <input type="text" id="load-vars" style="min-width:330px" placeholder="npVan=1;npTot=2000;locVan=1;locTot=2000"></label>
    <label title="Seed voor {{rnd:a-b}} en kans; zelfde seed = zelfde reeks.">seed <input type="number" id="load-seed" style="width:80px" min="1" placeholder="1"></label>
  </div>
  <div class="rij">
    <label title="Alleen bij reset. Puntkomma-gescheiden replay-bestanden onder 'replay files/'. Leeg = de standaard-seed. Dik bestand maken: python scripts/genereer-load-seed.py --np 2000" style="flex:1 1 auto">seeds bij reset <input type="text" id="load-seeds" style="width:100%;min-width:520px" placeholder="leeg = standaard-seed · bv. replay files/registraties-replay-init-gemeenten-cbs-2026.json;replay files/registraties-replay-load-np-loc-2000.json"></label>
  </div>
  <div class="sub">Recept voor een performancetest op 'rommelige' data: <b>1</b> sc 31 starten met seeds = gemeenten + dik bestand (vult de database; duurt even) · <b>2</b> sc 31 nogmaals met <i>behouden</i> en veel iteraties (gooit de data door elkaar) · <b>3</b> sc 32 met <i>behouden</i> (parallel lezen) · <b>4</b> sc 33 met <i>behouden</i> (lezen terwijl er geregistreerd wordt). Zet bij 2–4 de vars op het bereik van de dikke seed.</div>
  <div id="load-resultaat"></div>
  <details style="margin-top:12px"><summary>Load-log</summary><pre id="load-log"></pre></details>
</div>

<div id="tab-help" style="display:none">
<pre>SCENARIO  { "id": "21", "naam": "…", "beschrijving": "…", "volgorde": 210,
            "vereist": ["08"]            scenario's waarvan dit scenario state gebruikt (gaan mee in een selectie)
            "dekt": ["UC-12","REQ-7"]    traceability
            "tags": ["engine"], "uit": false,
            "env": {"AUTH_ENABLED": "true"},
            "vars": {"npTot": "50"},     scenariovariabelen (loadtest: overschrijfbaar via het veld vars / LOAD_VARS)
            "load": {"vus": 8, "iteraties": 25, "drempels": {"p95_ms": 250, "fout_pct": 0},
                     "mix": [{"scenario": "31", "vus": 3, "iteraties": 40}, {"scenario": "32", "vus": 12}]},
                                         mix = rollen: andere scenario's TEGELIJK afspelen (dan mag "stappen" leeg zijn)
            "stappen": [ … ] }

STAP      request : {"naam","method","path","body", "verwacht": {…}, "bewaar": {…}, "max_queries": 40, "uit": false,
                     "zet": {"npId": "{{rnd:npVan-npTot}}"},     variabelen vóór de request zetten
                     "kans": 0.5}                                stap draait met deze kans (weggelaten = altijd)
          replay  : {"replay": "replay files/x.json"}     → zet {{laatsteRegistratieID}} en {{replayAantal}}
          actie   : {"actie": "seed_admin"}

VERWACHT  "status": 201 | "status_in": [403,404] | "bevat": "tekst" | "bevat_niet": "sql:"
          "header": {"Content-Type": "problem+json"}
          "json": { "registratie_id": ">0", "opvoer": "!=null", "afvoer": "null", "id": 42,
                    "namen[afvoer=null].data[afvoer=null].achternaam": "Vries",   filter = eerste element waar veld null/afwezig is
                    "adressen.0.data.0.straatnaam": "!=null" }

BEWAAR    {"regId": "registratie_id"}   lokaal   |   {"$regPatch": "registratie_id"}   globaal (latere scenario's)

VARIABELEN  {{naam}}  {{$globaal}}  {{seedLaatsteRegistratieID}}  {{vu}} {{iter}} {{uniek}}
            {{synthtijd:var}}  synthetisch tijdstip van een registratie-id      {{min1:var}}  waarde − 1
            {{rnd:a-b}}        willekeurig geheel getal in [a, b]; a en b zijn getallen of variabelen (geseed, dus herhaalbaar)
            "{{int:var}}"      (mét quotes in de JSON) → kaal getal in de body</pre>
</div>

<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var data = { scenarios: [], replay_bestanden: [], dekking: {} };
  var resultaten = {}, gekozen = {}, poller = null, loadPoller = null, bewerk = null;

  var opgeslagenPw = sessionStorage.getItem('regressie_pw'); if (opgeslagenPw) $('pw').value = opgeslagenPw;

  function api(method, url, body) {
    sessionStorage.setItem('regressie_pw', $('pw').value);
    return fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'X-Beheer-Wachtwoord': $('pw').value }, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d || {} }; }); });
  }
  function meld(tekst, ok) { var m = $('melding'); m.className = 'melding' + (ok ? ' ok' : ''); m.textContent = tekst || ''; }
  function kloon(o) { return JSON.parse(JSON.stringify(o)); }
  function jsonScenarios() { return data.scenarios.filter(function (s) { return s.soort === 'json' && s.definitie; }); }

  // ── laden ────────────────────────────────────────────────────────────────
  function laad() {
    return fetch('/admin/regressie/scenarios').then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { meld(d.error); return; }
      data = d;
      if (d.declaratief_map) $('declmap').textContent = d.declaratief_map;
      if (!$('dsn').value) $('dsn').value = d.default_dsn || '';
      if (!d.devloop) meld('DEVLOOP staat uit op de API: afspelen en opslaan worden geweigerd (bekijken kan wel).');
      $('imp-bestand').innerHTML = (d.replay_bestanden || []).map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('');
      var huidig = $('load-id').value;
      $('load-id').innerHTML = jsonScenarios().map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.id + ' — ' + s.naam) + (s.definitie.load ? ' ⚡' : '') + '</option>'; }).join('');
      var metLoad = jsonScenarios().filter(function (s) { return s.definitie.load; })[0];
      $('load-id').value = huidig || (metLoad ? metLoad.id : '');
      renderSuite(); renderDekking();
    });
  }

  // ── suite-tabel ──────────────────────────────────────────────────────────
  function badge(st) { var k = { pass: 'pass', fail: 'fail', skip: 'skip', bezig: 'bezig' }[st] || ''; return st ? '<span class="badge ' + k + '">' + esc(st) + '</span>' : ''; }
  function renderSuite() {
    var lijst = data.scenarios;
    $('rijen').innerHTML = lijst.map(function (s, i) {
      var r = resultaten[s.id], def = s.definitie || {}, isJson = s.soort === 'json' && s.definitie;
      var chips = (def.uit ? '<span class="chip uit">uit</span>' : '') +
        (def.vereist || []).map(function (v) { return '<span class="chip" title="vereist scenario ' + esc(v) + '">← ' + esc(v) + '</span>'; }).join('') +
        (def.dekt || []).map(function (v) { return '<span class="chip dekt">' + esc(v) + '</span>'; }).join('') +
        (def.tags || []).map(function (v) { return '<span class="chip">' + esc(v) + '</span>'; }).join('') + (def.load ? '<span class="chip">⚡ load</span>' : '');
      var inhoud = '<details><summary>inhoud (' + esc(isJson ? s.bestand : 'Go') + ')</summary><pre>' + esc(s.inhoud) + '</pre></details>';
      var seeds = (s.seeds || []).map(function (sd) {
        return sd.fout ? '<details><summary class="melding">seed: ' + esc(sd.bestand) + ' — ' + esc(sd.fout) + '</summary></details>'
          : '<details><summary>seed: ' + esc(sd.bestand) + ' (' + sd.aantal + ' registraties)</summary><pre>' + esc((sd.samenvatting || []).join('\n')) + '</pre><details><summary>ruwe JSON</summary><pre>' + esc(sd.inhoud) + '</pre></details></details>';
      }).join('');
      var out = r && r.output && r.output.length ? '<details' + (r.status === 'fail' ? ' open' : '') + '><summary>output (' + r.output.length + ')</summary><pre>' + esc(r.output.join('\n')) + '</pre></details>' : '';
      var vink = s.id === '00' ? ' checked disabled title="seed draait altijd mee"' : (gekozen[s.id] ? ' checked' : '');
      var pijlen = isJson ? '<button class="mini" data-actie="op" data-id="' + esc(s.id) + '" title="omhoog">▲</button><button class="mini" data-actie="neer" data-id="' + esc(s.id) + '" title="omlaag">▼</button>' : '';
      var acties = isJson ? '<button class="mini" data-actie="bewerk" data-id="' + esc(s.id) + '">✎ bewerk</button> <button class="mini" data-actie="dupliceer" data-id="' + esc(s.id) + '">⧉ kopie</button> ' +
        '<a href="/admin/regressie/export/k6?id=' + encodeURIComponent(s.id) + '" target="_blank"><button class="mini" title="exporteer als k6-script (experimenteel)">k6</button></a> ' +
        '<a href="/admin/regressie/export/hurl?id=' + encodeURIComponent(s.id) + '" target="_blank"><button class="mini" title="exporteer als Hurl-bestand (experimenteel)">hurl</button></a> ' +
        '<button class="mini gevaar" data-actie="verwijder" data-id="' + esc(s.id) + '">🗑</button>' : '';
      return '<tr><td><input type="checkbox" data-kies="' + esc(s.id) + '"' + vink + '></td><td>' + pijlen + '</td><td>' + esc(s.id) + '</td><td><b>' + esc(s.naam) + '</b> ' + chips +
        (def.beschrijving ? '<div class="sub" style="margin:0">' + esc(def.beschrijving) + '</div>' : '') + (s.fout ? '<div class="melding">' + esc(s.fout) + '</div>' : '') + inhoud + seeds + out +
        '</td><td class="num">' + (isJson ? (def.stappen || []).length : '') + '</td><td>' + badge(r ? r.status : '') + '</td><td class="num">' + (r && r.duur_s ? r.duur_s.toFixed(2) + 's' : '') + '</td><td class="rechts">' + acties + '</td></tr>';
    }).join('');
  }

  function renderDekking() {
    var refs = Object.keys(data.dekking || {}).sort();
    $('dekkingrijen').innerHTML = refs.map(function (ref) {
      var ids = data.dekking[ref], st = ids.map(function (id) { return (resultaten[id] || {}).status || ''; });
      var oordeel = st.indexOf('fail') >= 0 ? 'fail' : (st.length && st.every(function (x) { return x === 'pass'; }) ? 'pass' : (st.some(function (x) { return x; }) ? 'deels' : 'nog niet gedraaid'));
      return '<tr><td><span class="chip dekt">' + esc(ref) + '</span></td><td>' + ids.map(function (id) {
        var s = data.scenarios.filter(function (x) { return x.id === id; })[0] || {};
        return esc(id + ' ' + (s.naam || '')) + ' ' + badge((resultaten[id] || {}).status || '');
      }).join('<br>') + '</td><td>' + (oordeel === 'pass' || oordeel === 'fail' ? badge(oordeel) : '<span class="sub">' + esc(oordeel) + '</span>') + '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="sub">Nog geen enkel scenario heeft een dekt-verwijzing.</td></tr>';
    var zonder = jsonScenarios().filter(function (s) { return !(s.definitie.dekt || []).length; });
    $('ongedekt').textContent = zonder.map(function (s) { return s.id + ' ' + s.naam; }).join(' · ') || '(geen)';
  }

  // ── run + status ─────────────────────────────────────────────────────────
  function status() {
    return fetch('/admin/regressie/status').then(function (r) { return r.json(); }).then(function (d) {
      resultaten = {}; (d.resultaten || []).forEach(function (r) { resultaten[r.id] = r; });
      renderSuite(); renderDekking();
      $('samenvatting').textContent = (d.bezig ? '⏳ bezig… ' : '') + (d.samenvatting || '') + (d.fout ? '  — fout: ' + d.fout : '');
      $('log').textContent = (d.log || []).join('\n');
      if (!d.bezig && poller) { clearInterval(poller); poller = null; }
    });
  }
  function start(alles) {
    meld('');
    var ids = alles ? [] : Object.keys(gekozen).filter(function (k) { return gekozen[k]; });
    if (!alles && !ids.length) { meld('Selecteer minimaal één scenario.'); return; }
    api('POST', '/admin/regressie/run', { scenarios: ids, dsn: $('dsn').value, devtools: $('devtools').checked }).then(function (r) {
      if (!r.ok) { meld(r.d.error || ('fout ' + r.status)); return; }
      if (!poller) poller = setInterval(status, 1000);
      status();
    });
  }

  // ── volgorde / dupliceren / verwijderen / import ─────────────────────────
  function verplaats(id, richting) {
    var js = jsonScenarios().map(function (s) { return s.id; }), i = js.indexOf(id), j = i + richting;
    if (i < 0 || j < 0 || j >= js.length) return;
    var t = js[i]; js[i] = js[j]; js[j] = t;
    api('POST', '/admin/regressie/volgorde', { ids: js }).then(function (r) { if (!r.ok) meld(r.d.error || 'volgorde opslaan mislukt'); return laad(); });
  }
  function vrijId() {
    var gebruikt = {}; data.scenarios.forEach(function (s) { gebruikt[s.id] = 1; });
    for (var n = 40; n < 1000; n++) { var k = (n < 100 ? '' : '') + String(n); if (k.length < 2) k = '0' + k; if (!gebruikt[k]) return k; }
    return '';
  }
  function dupliceer(id) {
    var s = jsonScenarios().filter(function (x) { return x.id === id; })[0]; if (!s) return;
    var def = kloon(s.definitie); def.id = vrijId(); def.naam = s.definitie.naam + ' (kopie)'; def.volgorde = (s.definitie.volgorde || 0) + 1;
    open(def, null, true);
  }
  function verwijder(id) {
    if (!confirm('Scenario ' + id + ' verwijderen?')) return;
    api('DELETE', '/admin/regressie/scenarios/' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok) { if (r.status === 409 && confirm(r.d.error + '\n\nToch verwijderen?')) { return api('DELETE', '/admin/regressie/scenarios/' + encodeURIComponent(id) + '?forceer=1').then(laad); } meld(r.d.error || 'verwijderen mislukt'); return; }
      meld('Scenario ' + id + ' verwijderd.', true); return laad();
    });
  }
  function importeer() {
    api('POST', '/admin/regressie/import-replay', { bestand: $('imp-bestand').value, id: $('imp-id').value, naam: $('imp-naam').value }).then(function (r) {
      if (!r.ok) { meld(r.d.error || 'import mislukt'); return; }
      $('importpaneel').style.display = 'none';
      meld('Geïmporteerd als scenario ' + r.d.id + ' (' + r.d.stappen + ' stappen).', true);
      return laad().then(function () { var s = jsonScenarios().filter(function (x) { return x.id === r.d.id; })[0]; if (s) open(kloon(s.definitie), s.id, false); });
    });
  }

  // ── editor ───────────────────────────────────────────────────────────────
  function soort(st) { return ('replay' in st) ? 'replay' : (('actie' in st) ? 'actie' : 'request'); }
  function nieuweStap(s) {
    if (s === 'replay') return { replay: (data.replay_bestanden || [''])[0] || '' };
    if (s === 'actie') return { actie: 'seed_admin' };
    return { naam: '', method: 'GET', path: '/', verwacht: { status: 200 } };
  }
  function open(def, vorigId, isNieuw) {
    bewerk = { def: def, vorigId: vorigId, isNieuw: isNieuw, kies: {}, toonJson: false };
    renderEditor(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function lijst(v) { return (v || []).join(', '); }
  function renderEditor() {
    var e = $('editor');
    if (!bewerk) { e.innerHTML = ''; return; }
    var d = bewerk.def, load = d.load || null, dr = (load && load.drempels) || {};
    var stappen = (d.stappen || []).map(function (st, i) {
      var so = soort(st), v = st.verwacht || {}, kern;
      if (so === 'replay') {
        kern = '<select data-sveld="replay" data-i="' + i + '" style="min-width:420px">' + (data.replay_bestanden || []).concat((data.replay_bestanden || []).indexOf(st.replay) < 0 ? [st.replay] : []).map(function (b) { return '<option' + (b === st.replay ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') + '</select>';
      } else if (so === 'actie') {
        kern = '<select data-sveld="actie" data-i="' + i + '"><option>seed_admin</option></select>';
      } else {
        kern = '<select data-sveld="method" data-i="' + i + '">' + ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(function (m) { return '<option' + (m === (st.method || 'GET').toUpperCase() ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
          '<input type="text" data-sveld="path" data-i="' + i + '" value="' + esc(st.path || '') + '" style="flex:1 1 300px" placeholder="/pad?query={{var}}">' +
          '<label title="verwachte HTTP-status">→ <input type="number" data-sveld="status" data-i="' + i + '" value="' + esc(v.status || '') + '" style="width:74px" placeholder="200"></label>';
      }
      return '<div class="stap' + (st.uit ? ' uit' : '') + '"><div class="kop"><input type="checkbox" data-stapkies="' + i + '"' + (bewerk.kies[i] ? ' checked' : '') + ' title="selecteer voor kopiëren">' +
        '<span class="nr">' + (i + 1) + '</span><button class="mini" data-actie="stap-op" data-i="' + i + '">▲</button><button class="mini" data-actie="stap-neer" data-i="' + i + '">▼</button>' +
        '<span class="chip">' + so + '</span>' + (so === 'request' ? '<input type="text" data-sveld="naam" data-i="' + i + '" value="' + esc(st.naam || '') + '" placeholder="naam van de stap" style="width:220px">' : '') + kern +
        '<span class="groei"></span><label title="stap overslaan"><input type="checkbox" data-sveld="uit" data-i="' + i + '"' + (st.uit ? ' checked' : '') + '> uit</label>' +
        '<button class="mini" data-actie="stap-kopie" data-i="' + i + '" title="dupliceer stap">⧉</button><button class="mini gevaar" data-actie="stap-weg" data-i="' + i + '">🗑</button></div>' +
        '<details' + (bewerk.openStap === i ? ' open' : '') + '><summary>details (body, verwachtingen, bewaar) — JSON van de hele stap</summary><textarea rows="' + Math.min(18, Math.max(5, JSON.stringify(st, null, 2).split('\n').length)) + '" data-stapraw="' + i + '">' + esc(JSON.stringify(st, null, 2)) + '</textarea></details></div>';
    }).join('');

    e.innerHTML = '<div class="paneel"><div class="rij"><h2>' + (bewerk.isNieuw ? 'Nieuw scenario' : 'Scenario ' + esc(bewerk.vorigId) + ' bewerken') + '</h2><span class="groei"></span>' +
      '<button data-actie="toggle-json">' + (bewerk.toonJson ? 'formulier' : 'hele scenario als JSON') + '</button><button class="primair" data-actie="opslaan">Opslaan</button><button data-actie="sluit">Sluiten</button></div>' +
      '<div class="melding" id="emelding"></div>' +
      (bewerk.toonJson ? '<textarea rows="28" id="heeljson">' + esc(JSON.stringify(d, null, 2)) + '</textarea>' :
      '<div class="grid"><label class="veld">Id<input type="text" data-veld="id" value="' + esc(d.id || '') + '"></label><label class="veld" style="grid-column: span 2">Naam<input type="text" data-veld="naam" value="' + esc(d.naam || '') + '"></label>' +
      '<label class="veld">Vereist (id\'s, komma)<input type="text" data-lijst="vereist" value="' + esc(lijst(d.vereist)) + '" placeholder="05, 08"></label>' +
      '<label class="veld">Dekt (requirements / use cases)<input type="text" data-lijst="dekt" value="' + esc(lijst(d.dekt)) + '" placeholder="UC-12, REQ-7"></label>' +
      '<label class="veld">Tags<input type="text" data-lijst="tags" value="' + esc(lijst(d.tags)) + '"></label></div>' +
      '<label class="veld" style="margin-top:8px">Beschrijving<input type="text" data-veld="beschrijving" value="' + esc(d.beschrijving || '') + '"></label>' +
      '<div class="rij"><label><input type="checkbox" data-veld="uit"' + (d.uit ? ' checked' : '') + '> scenario uit (overslaan)</label>' +
      '<label><input type="checkbox" id="heeftload"' + (load ? ' checked' : '') + '> loadprofiel</label>' +
      (load ? '<label>vus <input type="number" data-load="vus" value="' + esc(load.vus || '') + '" style="width:70px"></label><label>iteraties <input type="number" data-load="iteraties" value="' + esc(load.iteraties || '') + '" style="width:80px"></label>' +
        '<label>p95 ≤ ms <input type="number" data-drempel="p95_ms" value="' + esc(dr.p95_ms || '') + '" style="width:80px"></label><label>fout ≤ % <input type="number" data-drempel="fout_pct" value="' + esc(dr.fout_pct || 0) + '" style="width:70px"></label>' : '') + '</div>' +
      '<details' + (d.env ? ' open' : '') + '><summary>omgevingsvariabelen tijdens dit scenario (env, JSON-object)</summary><textarea rows="4" id="envjson" placeholder=\'{"AUTH_ENABLED": "true"}\'>' + esc(d.env ? JSON.stringify(d.env, null, 2) : '') + '</textarea></details>' +
      '<details' + (d.vars ? ' open' : '') + '><summary>scenariovariabelen (vars, JSON-object; bij een loadtest te overschrijven)</summary><textarea rows="4" id="varsjson" placeholder=\'{"npVan": "1", "npTot": "2000"}\'>' + esc(d.vars ? JSON.stringify(d.vars, null, 2) : '') + '</textarea></details>' +
      (load && load.mix ? '<div class="sub">Dit scenario heeft rollen (<code>load.mix</code>): ' + esc(load.mix.map(function (m) { return m.scenario + ' × ' + (m.vus || 'profiel') + ' vus'; }).join(', ')) + '. Bewerk de rollen via <i>hele scenario als JSON</i>. Stappen mogen dan leeg blijven.</div>' : '') +
      '<h3>Stappen</h3>' + stappen +
      '<div class="rij"><button data-actie="stap-plus" data-soort="request">+ request-stap</button><button data-actie="stap-plus" data-soort="replay">+ replay-stap</button><button data-actie="stap-plus" data-soort="actie">+ actie-stap</button>' +
      '<span class="groei"></span><button data-actie="kies-alle">alle stappen selecteren</button><button data-actie="kopieer-selectie" title="maakt een nieuw scenario met de geselecteerde stappen">⧉ Selectie → nieuw scenario</button></div>') +
      '</div>';
  }
  function emeld(t, ok) { var m = $('emelding'); if (m) { m.className = 'melding' + (ok ? ' ok' : ''); m.textContent = t || ''; } }

  function verzamelDef() {
    var d = bewerk.def;
    if (bewerk.toonJson) { try { d = bewerk.def = JSON.parse($('heeljson').value); } catch (x) { emeld('Scenario-JSON ongeldig: ' + x.message); return null; } return d; }
    var env = $('envjson') ? $('envjson').value.trim() : '';
    if (env) { try { d.env = JSON.parse(env); } catch (x) { emeld('env is geen geldige JSON: ' + x.message); return null; } } else { delete d.env; }
    var vars = $('varsjson') ? $('varsjson').value.trim() : '';
    if (vars) { try { d.vars = JSON.parse(vars); } catch (x) { emeld('vars is geen geldige JSON: ' + x.message); return null; } Object.keys(d.vars).forEach(function (k) { d.vars[k] = String(d.vars[k]); }); } else { delete d.vars; }
    if (document.querySelector('textarea.fout')) { emeld('Er staat nog ongeldige JSON in een stap (rood gemarkeerd).'); return null; }
    return d;
  }
  function opslaan() {
    var d = verzamelDef(); if (!d) return;
    api('POST', '/admin/regressie/scenarios', { scenario: d, vorig_id: bewerk.vorigId || '', overschrijf: false }).then(function (r) {
      if (!r.ok) { emeld(r.d.error || ('fout ' + r.status)); return; }
      meld('Opgeslagen als ' + r.d.bestand + '.', true);
      bewerk.vorigId = r.d.id; bewerk.isNieuw = false; renderEditor(); emeld('Opgeslagen (' + r.d.bestand + ').', true);
      return laad();
    });
  }
  function kopieerSelectie() {
    var idx = Object.keys(bewerk.kies).filter(function (k) { return bewerk.kies[k]; }).map(Number).sort(function (a, b) { return a - b; });
    if (!idx.length) { emeld('Selecteer eerst één of meer stappen (vinkje links van de stap).'); return; }
    var bron = bewerk.def, nieuw = { id: vrijId(), naam: (bron.naam || 'scenario') + ' (selectie)', beschrijving: 'Gekopieerd uit scenario ' + (bron.id || '?') + ', stappen ' + idx.map(function (i) { return i + 1; }).join(', ') + '.', tags: kloon(bron.tags || []), stappen: idx.map(function (i) { return kloon(bron.stappen[i]); }) };
    if (bron.env) nieuw.env = kloon(bron.env);
    if (bron.vars) nieuw.vars = kloon(bron.vars);
    open(nieuw, null, true);
    emeld('Nieuw scenario met ' + idx.length + ' gekopieerde stap(pen) — nog niet opgeslagen. Pas id/naam aan en klik Opslaan.', true);
  }

  // ── load ─────────────────────────────────────────────────────────────────
  function loadStatus() {
    return fetch('/admin/regressie/load/status').then(function (r) { return r.json(); }).then(function (d) {
      $('load-log').textContent = (d.log || []).join('\n');
      var res = d.resultaat, h = '';
      if (d.bezig) h = '<div class="samenvatting">⏳ loadtest scenario ' + esc(d.scenario) + ' loopt…</div>';
      else if (d.fout) h = '<div class="melding">' + esc(d.fout) + '</div>';
      if (res) {
        h += '<div class="rij"><span class="samenvatting">' + esc(res.scenario + ' — ' + res.naam) + '</span> ' + (res.drempels_ok ? '<span class="badge pass">drempels ok</span>' : '<span class="badge fail">drempel overschreden</span>') + '</div>' +
          '<div class="sub">' + ((res.rollen || []).length ? 'mix: ' + res.rollen.map(function (r) { return esc(r.scenario) + ' ' + r.vus + ' vus × ' + r.iteraties; }).join(' + ') : res.vus + ' vus × ' + res.iteraties + ' iteraties') +
          (res.behoud ? ' · <b>database behouden</b>' : ' · reset + seed') + ' · seed ' + res.seed + ' · ' + res.requests + ' requests in ' + res.duur_s + ' s · <b>' + res.rps + ' req/s</b> · fouten ' + res.fouten + ' (' + res.fout_pct + '%) · p95 totaal <b>' + res.p95_ms + ' ms</b>' +
          (res.drempel_p95_ms ? ' (drempel ' + res.drempel_p95_ms + ' ms)' : '') + '</div>' + (res.drempel_reden || []).map(function (x) { return '<div class="melding">' + esc(x) + '</div>'; }).join('') +
          '<table><thead><tr><th>Stap</th><th class="num">n</th><th class="num">fouten</th><th class="num">gem ms</th><th class="num">p50</th><th class="num">p95</th><th class="num">p99</th><th class="num">max</th></tr></thead><tbody>' +
          (res.stappen || []).map(function (s) { return '<tr><td>' + (s.rol ? '<span class="chip">' + esc(s.rol.split(' ')[0]) + '</span> ' : '') + esc(s.naam) + '</td><td class="num">' + s.aantal + '</td><td class="num">' + s.fouten + '</td><td class="num">' + s.gem_ms + '</td><td class="num">' + s.p50_ms + '</td><td class="num"><b>' + s.p95_ms + '</b></td><td class="num">' + s.p99_ms + '</td><td class="num">' + s.max_ms + '</td></tr>'; }).join('') + '</tbody></table>' +
          ((res.fout_voorbeelden || []).length ? '<h3>Fout-voorbeelden</h3><pre>' + esc(res.fout_voorbeelden.join('\n')) + '</pre>' : '') +
          ((res.overgeslagen_stappen || []).length ? '<div class="sub">Overgeslagen in de loadtest: ' + esc(res.overgeslagen_stappen.join(' · ')) + '</div>' : '');
      }
      $('load-resultaat').innerHTML = h;
      if (!d.bezig && loadPoller) { clearInterval(loadPoller); loadPoller = null; }
    });
  }
  function loadStart() {
    $('load-melding').textContent = '';
    api('POST', '/admin/regressie/load', { id: $('load-id').value, vus: Number($('load-vus').value) || 0, iteraties: Number($('load-iter').value) || 0, dsn: $('dsn').value,
      behoud: $('load-behoud').checked, vars: $('load-vars').value.trim(), seed: Number($('load-seed').value) || 0, seeds: $('load-seeds').value.trim() }).then(function (r) {
      if (!r.ok) { $('load-melding').textContent = r.d.error || ('fout ' + r.status); return; }
      if (!loadPoller) loadPoller = setInterval(loadStatus, 1000);
      loadStatus();
    });
  }

  // ── events ───────────────────────────────────────────────────────────────
  document.addEventListener('click', function (ev) {
    var tabKnop = ev.target.closest('[data-tab]');
    if (tabKnop) {
      ['suite', 'dekking', 'load', 'help'].forEach(function (t) { $('tab-' + t).style.display = t === tabKnop.dataset.tab ? '' : 'none'; });
      document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('actief', b === tabKnop); });
      if (tabKnop.dataset.tab === 'load') loadStatus();
      return;
    }
    var k = ev.target.closest('[data-actie]'); if (!k) return;
    var a = k.dataset.actie, id = k.dataset.id, i = Number(k.dataset.i), st = bewerk && bewerk.def.stappen;
    if (a === 'run-alles') start(true);
    else if (a === 'run-selectie') start(false);
    else if (a === 'selectie-wissen') { gekozen = {}; renderSuite(); }
    else if (a === 'nieuw') open({ id: vrijId(), naam: '', stappen: [nieuweStap('request')] }, null, true);
    else if (a === 'import-open') { $('importpaneel').style.display = ''; if (!$('imp-id').value) $('imp-id').value = vrijId(); }
    else if (a === 'import-sluit') $('importpaneel').style.display = 'none';
    else if (a === 'import-doe') importeer();
    else if (a === 'op') verplaats(id, -1);
    else if (a === 'neer') verplaats(id, 1);
    else if (a === 'bewerk') { var s = jsonScenarios().filter(function (x) { return x.id === id; })[0]; if (s) open(kloon(s.definitie), s.id, false); }
    else if (a === 'dupliceer') dupliceer(id);
    else if (a === 'verwijder') verwijder(id);
    else if (a === 'sluit') { bewerk = null; renderEditor(); }
    else if (a === 'opslaan') opslaan();
    else if (a === 'toggle-json') { var d = verzamelDef(); if (d) { bewerk.toonJson = !bewerk.toonJson; renderEditor(); } }
    else if (a === 'stap-plus') { st.push(nieuweStap(k.dataset.soort)); bewerk.openStap = st.length - 1; renderEditor(); }
    else if (a === 'stap-weg') { st.splice(i, 1); bewerk.kies = {}; renderEditor(); }
    else if (a === 'stap-kopie') { st.splice(i + 1, 0, kloon(st[i])); bewerk.kies = {}; renderEditor(); }
    else if (a === 'stap-op' && i > 0) { st.splice(i - 1, 0, st.splice(i, 1)[0]); bewerk.kies = {}; renderEditor(); }
    else if (a === 'stap-neer' && i < st.length - 1) { st.splice(i + 1, 0, st.splice(i, 1)[0]); bewerk.kies = {}; renderEditor(); }
    else if (a === 'kies-alle') { st.forEach(function (_, n) { bewerk.kies[n] = true; }); renderEditor(); }
    else if (a === 'kopieer-selectie') kopieerSelectie();
    else if (a === 'load-start') loadStart();
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset.kies) { gekozen[t.dataset.kies] = t.checked; return; }
    if (!bewerk) return;
    var d = bewerk.def;
    if (t.dataset.stapkies !== undefined) { bewerk.kies[t.dataset.stapkies] = t.checked; return; }
    if (t.id === 'heeftload') { if (t.checked) d.load = d.load || { vus: 5, iteraties: 20, drempels: { p95_ms: 250, fout_pct: 0 } }; else delete d.load; renderEditor(); return; }
    if (t.dataset.veld) { d[t.dataset.veld] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.veld === 'uit' && !t.checked) delete d.uit; return; }
    if (t.dataset.lijst) { var l = t.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); if (l.length) d[t.dataset.lijst] = l; else delete d[t.dataset.lijst]; return; }
    if (t.dataset.load) { d.load[t.dataset.load] = Number(t.value) || 0; return; }
    if (t.dataset.drempel) { d.load.drempels = d.load.drempels || {}; d.load.drempels[t.dataset.drempel] = Number(t.value) || 0; return; }
    if (t.dataset.stapraw !== undefined) {
      try { d.stappen[Number(t.dataset.stapraw)] = JSON.parse(t.value); t.classList.remove('fout'); bewerk.openStap = Number(t.dataset.stapraw); renderEditor(); }
      catch (x) { t.classList.add('fout'); emeld('Stap ' + (Number(t.dataset.stapraw) + 1) + ': ongeldige JSON — ' + x.message); }
      return;
    }
    if (t.dataset.sveld) {
      var st = d.stappen[Number(t.dataset.i)], v = t.dataset.sveld;
      if (v === 'status') { st.verwacht = st.verwacht || {}; if (t.value) { st.verwacht.status = Number(t.value); delete st.verwacht.status_in; } else delete st.verwacht.status; }
      else if (v === 'uit') { if (t.checked) st.uit = true; else delete st.uit; }
      else if (v === 'naam' && !t.value) delete st.naam;
      else st[v] = t.value;
      bewerk.openStap = undefined; renderEditor();
    }
  });

  laad().then(status);
})();
</script>
</body>
</html>`
