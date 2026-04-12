/**
 * sfx.js — Synthesized sound effects voor het 3D Data Universum.
 *
 * Puur Web Audio API: oscillatoren, filters, gain envelopes.
 * Geen samples, geen dependencies.
 *
 * Alle functies zijn fire-and-forget en falen stil als AudioContext
 * niet beschikbaar is (bijv. voor autoplay-policy).
 * Elke publieke functie is verpakt in try-catch zodat een audiofout
 * nooit de React-app laat crashen.
 */

let ctx = null;
let sendBus = null; // shared stereo delay bus

function getCtx() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume na autoplay-policy blokkade
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/**
 * Stereo ping-pong delay bus.
 * Alle effecten sturen hun output naar bus.dry (direct) en bus.wet (echo).
 * De delay kaatst L↔R met zachte feedback en lowpass-filtering
 * zodat herhalingen donkerder worden — dromerig effect.
 */
function getBus() {
  const ac = getCtx();
  if (!ac) return null;
  if (sendBus) return sendBus;

  // ── Dry pad: direct naar output ──────────────────────────────────
  const dry = ac.createGain();
  dry.gain.value = 1.0;
  dry.connect(ac.destination);

  // ── Wet pad: stereo ping-pong delay ──────────────────────────────
  const wet = ac.createGain();
  wet.gain.value = 0.35;           // send-niveau naar delay

  const delayL = ac.createDelay(1);
  const delayR = ac.createDelay(1);
  delayL.delayTime.value = 0.27;   // L: 270ms
  delayR.delayTime.value = 0.35;   // R: 350ms   (ongelijk = stereo spread)

  const fbL = ac.createGain();
  const fbR = ac.createGain();
  fbL.gain.value = 0.4;           // feedback: ~3-4 herhalingen
  fbR.gain.value = 0.35;

  // Darkening filter op de feedback-loop
  const lpL = ac.createBiquadFilter();
  lpL.type = "lowpass";
  lpL.frequency.value = 1200;
  const lpR = ac.createBiquadFilter();
  lpR.type = "lowpass";
  lpR.frequency.value = 1000;

  // Stereo panning
  const panL = ac.createStereoPanner();
  panL.pan.value = -0.7;
  const panR = ac.createStereoPanner();
  panR.pan.value = 0.7;

  // Routing: wet → delayL → panL → dest, delayL → fb → filter → delayR → ...
  wet.connect(delayL);
  wet.connect(delayR);

  delayL.connect(panL);
  panL.connect(ac.destination);
  delayL.connect(fbL);
  fbL.connect(lpL);
  lpL.connect(delayR);          // L feedback → R

  delayR.connect(panR);
  panR.connect(ac.destination);
  delayR.connect(fbR);
  fbR.connect(lpR);
  lpR.connect(delayL);          // R feedback → L (ping-pong)

  sendBus = { dry, wet, delayL, delayR, fbL, fbR, lpL, lpR };
  return sendBus;
}

/** Verkrijg de output-node waar effecten op moeten aansluiten. */
function out() {
  const bus = getBus();
  if (!bus) {
    const ac = getCtx();
    return ac ? ac.destination : null;
  }
  return bus.dry;
}

/** Verkrijg de delay-send node (connect hierop voor echo). */
function send() {
  const bus = getBus();
  return bus ? bus.wet : null;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function envelope(gainNode, now, attack, hold, release, peak = 1) {
  const g = gainNode.gain;
  g.setValueAtTime(0, now);
  g.linearRampToValueAtTime(peak, now + attack);
  g.setValueAtTime(peak, now + attack + hold);
  g.exponentialRampToValueAtTime(0.001, now + attack + hold + release);
}

/** Maak een korte noise-burst als AudioBufferSourceNode. */
function createNoise(ac, duration) {
  const len = Math.ceil(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

/* ── Effects ────────────────────────────────────────────────────────── */

/*
Effect	    Oud bereik	Nieuw bereik	                        Ruis
Woosh in	60→2400 Hz	35→800 Hz	                            ✅ bandpass noise sweep 200→3000 Hz
Woosh out	2200→100 Hz	700→30 Hz	                            ✅ bandpass noise sweep 2500→150 Hz
Ping	    carrier 880, mod 220 Hz	carrier 340, mod 110 Hz	    —
Tick	    1600/900 Hz	600/380 Hz	                            —
Zoom	    300→600→440 Hz	110→240→170 Hz	                    ✅ lowpass noise 800 Hz
Buzz	    110 Hz, LP 400	55 Hz, LP 200	                    —
De noise wordt gegenereerd als AudioBuffer met white noise, gefilterd door een sweep-bandpass (woosh) of lowpass (zoom), 
met eigen gain envelope zodat het zacht mee-faded. Moet nu meer sci-fi/ambient klinken en minder arcade.
*/


/**
 * Wormhole woosh — frequentie-sweep met resonant lowpass.
 * Richting: "in" (stijgende sweep, drill-down) of "out" (dalend, terug).
 */
export function woosh(direction = "in") {
  try {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  // "out" = langzamer, lager, dromeriger
  const isOut = direction !== "in";
  const dur = isOut ? 1.4 : 0.7;

  // Twee gedetunde saw-oscillatoren
  const osc1 = ac.createOscillator();
  const osc2 = ac.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "sawtooth";

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = isOut ? 1.2 : 1.8;

  const gain = ac.createGain();
  envelope(gain, now, isOut ? 0.12 : 0.06, isOut ? 0.4 : 0.2, dur - (isOut ? 0.52 : 0.26), 0.10);

  // Noise-laag voor luchtachtige textuur
  const noise = createNoise(ac, dur + 0.2);
  const nFilter = ac.createBiquadFilter();
  nFilter.type = "bandpass";
  nFilter.Q.value = 0.8;
  const nGain = ac.createGain();
  envelope(nGain, now, isOut ? 0.1 : 0.05, isOut ? 0.3 : 0.15, dur - (isOut ? 0.4 : 0.2), 0.04);

  if (!isOut) {
    osc1.frequency.setValueAtTime(35, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + dur);
    osc2.frequency.setValueAtTime(38, now);
    osc2.frequency.exponentialRampToValueAtTime(850, now + dur);
    filter.frequency.setValueAtTime(80, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + dur);
    nFilter.frequency.setValueAtTime(200, now);
    nFilter.frequency.exponentialRampToValueAtTime(3000, now + dur);
  } else {
    // Lager en langzamer: 400→18 Hz over 1.4s
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(18, now + dur);
    osc2.frequency.setValueAtTime(420, now);
    osc2.frequency.exponentialRampToValueAtTime(20, now + dur);
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + dur);
    nFilter.frequency.setValueAtTime(1800, now);
    nFilter.frequency.exponentialRampToValueAtTime(80, now + dur);
  }

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(out());

  noise.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(out());

  if (isOut) {
    // Woosh-out: eigen trage delay (450ms/600ms) voor dromerig uitfade-effect
    const dlyL = ac.createDelay(2);
    const dlyR = ac.createDelay(2);
    dlyL.delayTime.value = 0.45;
    dlyR.delayTime.value = 0.60;
    const fb = ac.createGain();
    fb.gain.value = 0.35;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const pL = ac.createStereoPanner();
    pL.pan.value = -0.6;
    const pR = ac.createStereoPanner();
    pR.pan.value = 0.6;
    const wetG = ac.createGain();
    wetG.gain.value = 0.4;

    gain.connect(wetG);
    nGain.connect(wetG);
    wetG.connect(dlyL);
    wetG.connect(dlyR);
    dlyL.connect(pL); pL.connect(ac.destination);
    dlyR.connect(pR); pR.connect(ac.destination);
    dlyL.connect(fb); fb.connect(lp); lp.connect(dlyR);
    dlyR.connect(ac.createGain()).connect(lp);  // simple cross-feed
  } else {
    // Woosh-in: normale shared delay bus
    if (send()) { gain.connect(send()); nGain.connect(send()); }
  }

  osc1.start(now);
  osc2.start(now);
  noise.start(now);
  osc1.stop(now + dur + 0.1);
  osc2.stop(now + dur + 0.1);
  noise.stop(now + dur + 0.2);
  } catch { /* stil */ }
}

/**
 * Selectie-ping — kort FM-belletje.
 */
export function ping() {
  try {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const mod = ac.createOscillator();
  const modGain = ac.createGain();
  mod.type = "sine";
  mod.frequency.value = 110;
  modGain.gain.value = 80;

  const carrier = ac.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = 340;

  const gain = ac.createGain();
  envelope(gain, now, 0.008, 0.04, 0.28, 0.07);

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(gain);
  gain.connect(out());
  if (send()) gain.connect(send());

  mod.start(now);
  carrier.start(now);
  mod.stop(now + 0.35);
  carrier.stop(now + 0.35);
  } catch { /* stil */ }
}

/**
 * Domein toggle — subtiel klikje, bijna mechanisch.
 */
export function tick(on = true) {
  try {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "square";
  osc.frequency.value = on ? 600 : 380;

  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 250;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out());

  osc.start(now);
  osc.stop(now + 0.08);
  } catch { /* stil */ }
}

/**
 * Zoom — tonale glide bij camera-beweging.
 * Kan subtiel meespelen bij flyToNode.
 */
export function zoom() {
  try {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const dur = 0.45;

  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(240, now + dur * 0.3);
  osc.frequency.exponentialRampToValueAtTime(170, now + dur);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  filter.Q.value = 0.7;

  const gain = ac.createGain();
  envelope(gain, now, 0.03, 0.1, dur - 0.13, 0.04);

  // Lichte ruis-laag
  const noise = createNoise(ac, dur + 0.1);
  const nFilter = ac.createBiquadFilter();
  nFilter.type = "lowpass";
  nFilter.frequency.value = 800;
  const nGain = ac.createGain();
  envelope(nGain, now, 0.02, 0.08, dur - 0.1, 0.015);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out());
  if (send()) gain.connect(send());

  noise.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(out());
  if (send()) nGain.connect(send());

  osc.start(now);
  noise.start(now);
  osc.stop(now + dur + 0.05);
  noise.stop(now + dur + 0.1);
  } catch { /* stil */ }
}

/**
 * Error/blocked — korte buzz.
 */
export function buzz() {
  try {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 55;

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 200;

  const gain = ac.createGain();
  envelope(gain, now, 0.01, 0.06, 0.12, 0.06);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out());

  osc.start(now);
  osc.stop(now + 0.2);
  } catch { /* stil */ }
}

/* ── Ambient drone — continu geluid dat reageert op beweging ───────── */
/*
 * Architectuur:
 *   - Lage sawtooth (42 Hz) + licht gedetunde 2e saw (43.5 Hz) → lowpass 280 Hz
 *   - Noise door bandpass met LFO sweep (0.07 Hz) → morph-effect
 *   - Alles door master gain die:
 *       idle  = 0.03     (zacht hoorbaar als ambient bed)
 *       bewegen = 0.18   (duidelijk hoorbaar)
 *   - Filter-cutoff gaat mee open bij beweging (280 → 1200 Hz)
 *   - Gaat door de stereo delay-bus voor ruimtelijk effect
 *
 * API:  droneStart()           — start de drone (idempotent)
 *       droneStop()            — stop en cleanup
 *       droneMove(intensity)   — 0..1, direct gain + filter aansturen
 */

let droneState = null;

/** Start de ambient drone. Idempotent — meerdere calls zijn veilig. */
export function droneStart() {
  try {
    if (droneState) return;         // al actief
    const ac = getCtx();
    if (!ac) return;

    // ── Sawtooth drone ──────────────────────────────────────────────
    const saw1 = ac.createOscillator();
    saw1.type = "sawtooth";
    saw1.frequency.value = 42;

    const saw2 = ac.createOscillator();
    saw2.type = "sawtooth";
    saw2.frequency.value = 43.5;    // licht detuned → warm zwevend

    const sawGain = ac.createGain();
    sawGain.gain.value = 0.5;       // mix van de twee saws

    const lpFilter = ac.createBiquadFilter();
    lpFilter.type = "lowpass";
    lpFilter.frequency.value = 280; // basis-cutoff, opent bij beweging
    lpFilter.Q.value = 1.5;

    saw1.connect(sawGain);
    saw2.connect(sawGain);
    sawGain.connect(lpFilter);

    // ── Noise textuur met LFO-sweep ────────────────────────────────
    // Oneindige noise via ScriptProcessor vervangen door lang noise-buffer
    const noiseDur = 8;             // 8 sec loop
    const noiseLen = Math.ceil(ac.sampleRate * noiseDur);
    const noiseBuf = ac.createBuffer(1, noiseLen, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1;

    const noiseSrc = ac.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 300;
    bp.Q.value = 2.5;

    // LFO op bandpass-frequentie: langzaam morph-effect
    const lfo = ac.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;     // heel langzame sweep
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 200;       // sweep 300 ± 200 Hz
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);

    const noiseGain = ac.createGain();
    noiseGain.gain.value = 0.3;     // noise-mix in de drone

    noiseSrc.connect(bp);
    bp.connect(noiseGain);

    // ── Master gain + routing ──────────────────────────────────────
    const master = ac.createGain();
    master.gain.value = 0.03;       // idle: zacht hoorbaar als ambient bed

    lpFilter.connect(master);
    noiseGain.connect(master);
    master.connect(out());
    if (send()) master.connect(send());

    // Start alles
    const now = ac.currentTime;
    saw1.start(now);
    saw2.start(now);
    noiseSrc.start(now);
    lfo.start(now);

    droneState = {
      ac, saw1, saw2, noiseSrc, lfo,
      master,             // gain: 0.008 (idle) → 0.06 (beweging)
      lpFilter,           // freq: 180 (idle) → 600 (beweging)
      bp,                 // bandpass op noise (voor evt. extra modulatie)
    };
  } catch { /* stil */ }
}

/** Stop de drone en ruim alles op. */
export function droneStop() {
  try {
    if (!droneState) return;
    const { saw1, saw2, noiseSrc, lfo, master } = droneState;
    const now = droneState.ac.currentTime;

    // Fade-out om klikken te voorkomen
    master.gain.setTargetAtTime(0, now, 0.15);

    // Stop bronnen na fade
    const stopTime = now + 0.6;
    [saw1, saw2, noiseSrc, lfo].forEach(n => {
      try { n.stop(stopTime); } catch { /* al gestopt */ }
    });

    droneState = null;
  } catch { /* stil */ }
}

/**
 * Beweeg de drone — stel intensiteit in op basis van bewegingssnelheid.
 * @param {number} intensity  0 (stilstand) tot 1 (maximale beweging)
 */
export function droneMove(intensity) {
  try {
    if (!droneState) return;
    const { ac, master, lpFilter } = droneState;
    const now = ac.currentTime;
    const t = Math.max(0, Math.min(1, intensity));

    // Gain:  0.03 … 0.18 (exponentiële curve voor natuurlijk gevoel)
    const gainTarget = 0.03 + t * t * 0.15;
    master.gain.setTargetAtTime(gainTarget, now, 0.08);

    // Filter cutoff: 280 … 1200 Hz (opent bij beweging)
    const freqTarget = 280 + t * 920;
    lpFilter.frequency.setTargetAtTime(freqTarget, now, 0.08);
  } catch { /* stil */ }
}
