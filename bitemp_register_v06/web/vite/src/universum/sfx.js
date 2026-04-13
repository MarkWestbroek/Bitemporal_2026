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
  // "out" = langzamer, lager, dromeriger, zachter
  const isOut = direction !== "in";
  const dur = isOut ? 2.2 : 0.7;

  // Twee gedetunde saw-oscillatoren
  const osc1 = ac.createOscillator();
  const osc2 = ac.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "sawtooth";

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = isOut ? 0.9 : 1.8;

  const gain = ac.createGain();
  envelope(gain, now, isOut ? 0.25 : 0.06, isOut ? 0.5 : 0.2, dur - (isOut ? 0.75 : 0.26), isOut ? 0.05 : 0.10);

  // Noise-laag voor luchtachtige textuur
  const noise = createNoise(ac, dur + 0.2);
  const nFilter = ac.createBiquadFilter();
  nFilter.type = "bandpass";
  nFilter.Q.value = 0.8;
  const nGain = ac.createGain();
  envelope(nGain, now, isOut ? 0.2 : 0.05, isOut ? 0.4 : 0.15, dur - (isOut ? 0.6 : 0.2), isOut ? 0.02 : 0.04);

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
    // Lager, langzamer en zachter: 300→14 Hz over 2.2s
    osc1.frequency.setValueAtTime(300, now);
    osc1.frequency.exponentialRampToValueAtTime(14, now + dur);
    osc2.frequency.setValueAtTime(315, now);
    osc2.frequency.exponentialRampToValueAtTime(16, now + dur);
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + dur);
    nFilter.frequency.setValueAtTime(1200, now);
    nFilter.frequency.exponentialRampToValueAtTime(60, now + dur);
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
    dlyL.delayTime.value = 0.55;
    dlyR.delayTime.value = 0.75;
    const fb = ac.createGain();
    fb.gain.value = 0.3;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 450;
    const pL = ac.createStereoPanner();
    pL.pan.value = -0.6;
    const pR = ac.createStereoPanner();
    pR.pan.value = 0.6;
    const wetG = ac.createGain();
    wetG.gain.value = 0.25;

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

    // Start nootvariatie
    scheduleDroneNoteChange();
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

    // Stop nootvariatie
    if (droneNoteTimer) { clearTimeout(droneNoteTimer); droneNoteTimer = null; }
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

/**
 * Paper whisper — subtiel papier-geritsel geluid voor perkamentrol open/dicht.
 * Gebruikt gefilterde noise met bandpass sweep voor realistisch papier-effect.
 * @param {"open"|"close"} direction — "open" = uitrollen, "close" = oprollen
 */
export function paperWhisper(direction = "open") {
  try {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const isOpen = direction === "open";
    const dur = isOpen ? 0.45 : 0.3;

    // Twee noise-lagen: breedbandige "froissement" + hogere "crinkle"
    const noise1 = createNoise(ac, dur + 0.1);
    const noise2 = createNoise(ac, dur + 0.1);

    // Bandpass 1: papier-body (1.5–4 kHz sweep)
    const bp1 = ac.createBiquadFilter();
    bp1.type = "bandpass";
    bp1.Q.value = 1.2;
    if (isOpen) {
      bp1.frequency.setValueAtTime(1500, now);
      bp1.frequency.linearRampToValueAtTime(4000, now + dur);
    } else {
      bp1.frequency.setValueAtTime(3800, now);
      bp1.frequency.linearRampToValueAtTime(1200, now + dur);
    }

    // Bandpass 2: hogere "crinkle" texture (5–8 kHz)
    const bp2 = ac.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.Q.value = 0.8;
    bp2.frequency.setValueAtTime(isOpen ? 5000 : 7000, now);
    bp2.frequency.linearRampToValueAtTime(isOpen ? 8000 : 4500, now + dur);

    // Gain envelopes — zacht, subtiel
    const gain1 = ac.createGain();
    envelope(gain1, now, 0.02, dur * 0.3, dur * 0.6, 0.06);

    const gain2 = ac.createGain();
    envelope(gain2, now, 0.01, dur * 0.2, dur * 0.7, 0.025);

    // Amplitude modulatie voor onregelmatig geritsel-effect
    const lfo = ac.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = isOpen ? 18 : 25;  // snellere modulation bij close
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(gain1.gain);  // moduleer de amplitude

    // Routing
    const dest = out();
    if (!dest) return;

    noise1.connect(bp1);
    bp1.connect(gain1);
    gain1.connect(dest);

    noise2.connect(bp2);
    bp2.connect(gain2);
    gain2.connect(dest);

    // Start
    lfo.start(now);
    noise1.start(now);
    noise2.start(now);

    // Stop
    const endTime = now + dur + 0.15;
    lfo.stop(endTime);
    noise1.stop(endTime);
    noise2.stop(endTime);
  } catch { /* stil */ }
}

/* ── Space bird fly-by — JMJ-achtig ruimtegeluid ───────────────────── */
/*
 * Een synthesized "ruimtevogel" die van links naar rechts (of omgekeerd)
 * door het sterrenbeeld vliegt. Geïnspireerd door Oxygene/Equinoxe.
 *
 * Opgebouwd uit:
 *   - Carrier: sine/triangle met grote frequentie-glide (portamento)
 *   - FM-modulator: snelle modulatie voor "trillerend" vogeleffect
 *   - Noise-laag: gefilterd voor "vleugels in de wind"
 *   - Stereo pan: lineaire sweep van L→R of R→L
 *   - Reverb-achtige tail via de shared delay bus
 */
export function spaceBird() {
  try {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;

    // Randomiseer richting en karakter
    const leftToRight = Math.random() > 0.5;
    const dur = 2.5 + Math.random() * 3;        // 2.5-5.5 sec
    const baseFreq = 400 + Math.random() * 800;  // 400-1200 Hz
    const peakFreq = baseFreq * (1.5 + Math.random() * 2);
    const endFreq = baseFreq * (0.3 + Math.random() * 0.5);

    // ── FM carrier + modulator ─────────────────────────────────────
    const carrier = ac.createOscillator();
    carrier.type = Math.random() > 0.5 ? "sine" : "triangle";

    // Frequentie-pad: laag → hoog (midden) → laag — als een voorbijvliegend object
    const midTime = now + dur * (0.3 + Math.random() * 0.2);
    carrier.frequency.setValueAtTime(baseFreq, now);
    carrier.frequency.exponentialRampToValueAtTime(peakFreq, midTime);
    carrier.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    // FM modulator voor trillerend/warblend effect
    const mod = ac.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(6 + Math.random() * 12, now);
    mod.frequency.linearRampToValueAtTime(15 + Math.random() * 20, midTime);
    mod.frequency.linearRampToValueAtTime(4 + Math.random() * 8, now + dur);

    const modGain = ac.createGain();
    modGain.gain.setValueAtTime(baseFreq * 0.15, now);
    modGain.gain.linearRampToValueAtTime(peakFreq * 0.25, midTime);
    modGain.gain.linearRampToValueAtTime(endFreq * 0.1, now + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    // ── Filter: bandpass die mee-sweept ────────────────────────────
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2 + Math.random() * 3;
    bp.frequency.setValueAtTime(baseFreq * 1.5, now);
    bp.frequency.exponentialRampToValueAtTime(peakFreq * 1.2, midTime);
    bp.frequency.exponentialRampToValueAtTime(endFreq * 1.5, now + dur);

    // ── Noise-laag: "windveren" ────────────────────────────────────
    const noise = createNoise(ac, dur + 0.5);
    const nBp = ac.createBiquadFilter();
    nBp.type = "bandpass";
    nBp.Q.value = 1.5;
    nBp.frequency.setValueAtTime(1500, now);
    nBp.frequency.exponentialRampToValueAtTime(5000, midTime);
    nBp.frequency.linearRampToValueAtTime(800, now + dur);

    const nGain = ac.createGain();
    envelope(nGain, now, dur * 0.15, dur * 0.3, dur * 0.55, 0.012);

    // ── Stereo pan sweep ───────────────────────────────────────────
    const panner = ac.createStereoPanner();
    panner.pan.setValueAtTime(leftToRight ? -0.9 : 0.9, now);
    panner.pan.linearRampToValueAtTime(leftToRight ? 0.9 : -0.9, now + dur);

    // ── Gain envelope: zacht, swell in het midden ──────────────────
    const gain = ac.createGain();
    const peak = 0.04 + Math.random() * 0.03;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(peak, midTime);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    // ── Routing ────────────────────────────────────────────────────
    carrier.connect(bp);
    bp.connect(gain);
    noise.connect(nBp);
    nBp.connect(nGain);
    nGain.connect(gain);
    gain.connect(panner);
    panner.connect(out());
    if (send()) panner.connect(send());

    // Start & stop
    carrier.start(now);
    mod.start(now);
    noise.start(now);
    carrier.stop(now + dur + 0.2);
    mod.stop(now + dur + 0.2);
    noise.stop(now + dur + 0.5);
  } catch { /* stil */ }
}

/* ── Drone nootvariatie ────────────────────────────────────────────── */
/*
 * Wisselt de fundamentele dronefrequentie periodiek naar een andere noot.
 * Notenset (lage bas): C1=~32.7, D1=~36.7, Eb1=~38.9, F1=~43.7, G1=~49,
 * Ab1=~51.9 — een donkere mineur-achtige reeks.
 *
 * Één keer per 12-30 seconden glijdt de drone naar een andere noot
 * via een langzame exponential ramp (2-4 seconden portamento).
 */
const DRONE_NOTES = [32.7, 36.7, 38.9, 43.7, 49.0, 51.9, 43.7, 38.9];
let droneNoteTimer = null;
let droneNoteIdx = 0;

function scheduleDroneNoteChange() {
  if (droneNoteTimer) clearTimeout(droneNoteTimer);
  const delay = (12 + Math.random() * 18) * 1000;
  droneNoteTimer = setTimeout(() => {
    try {
      if (!droneState) return;
      const { ac, saw1, saw2 } = droneState;
      const now = ac.currentTime;

      // Kies volgende noot (niet dezelfde)
      let next;
      do { next = Math.floor(Math.random() * DRONE_NOTES.length); }
      while (next === droneNoteIdx && DRONE_NOTES.length > 1);
      droneNoteIdx = next;

      const freq = DRONE_NOTES[droneNoteIdx];
      const glideTime = 2 + Math.random() * 2; // 2-4 sec portamento

      saw1.frequency.setTargetAtTime(freq, now, glideTime * 0.3);
      saw2.frequency.setTargetAtTime(freq * 1.035, now, glideTime * 0.3); // licht detuned
    } catch { /* stil */ }
    scheduleDroneNoteChange();
  }, delay);
}
