// mov-desc-seq-fade — Moving desce primeiro; ribalta entra depois com fade.
// Preset: mov-preset.js (injetado automaticamente em mov-*.js)
//
// Ciclo contínuo (sem fase reposition no loop):
//   mh_descend → rib_descend → mh_descend …
// Handoff: nos últimos RIB_TAIL_FADE_TICKS da rib, moving já desce aceso
// (rib apaga no topo) — sem pausa nem sensação de “voltar ao início”.
//
// Tempo visível: MH_DESCEND_TICKS / RIB_DESCEND_TICKS (75 = 3s @ 25fps).
// Motor: MH_DESCEND_SPEED / RIB_DESCEND_SPEED.

// ── IDs de fixture ──────────────────────────────────────────────────────────

const ID_M1   = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2   = 'fixture_1780805067518_moving_head_beam_2';

const ID_R1   = 'fixture_1780805067518_ribalta_1';
const ID_R2   = 'fixture_1780805067518_ribalta_2';

const ID_FITA = 'fixture_1780805067518_fita_led';


// ── Velocidade de descida — motor (igual fader speed no grid) ─────────────────
// 0 = mais rápido, 255 = mais lento. Não controla duração visível.
const MH_DESCEND_SPEED = 120;
const RIB_DESCEND_SPEED = 90;

// Duração visível da descida — 25fps, 3s = 75 ticks
const MH_DESCEND_TICKS = 75;
const RIB_DESCEND_TICKS = 75;

const FADE_MH_TICKS = 25;
const FADE_RIB_TICKS = 25;
const RIB_TAIL_FADE_TICKS = 8; // rib some no topo; moving entra aceso no handoff


// ── Canais resolvidos ───────────────────────────────────────────────────────

let m1_cw, m1_strobo, m1_fecho, m1_prism, m1_pan, m1_tilt, m1_speed;
let m2_cw, m2_strobo, m2_fecho, m2_prism, m2_pan, m2_tilt, m2_speed;

let r1_tilt, r1_speed, r1_dimmer, r1_strobo, r1_function;
let r2_tilt, r2_speed, r2_dimmer, r2_strobo, r2_function;

let r1_leds = null;
let r2_leds = null;

let fita;


// ── Estado ────────────────────────────────────────────────────────────────────

let tick = 0;
let phase = 'mh_descend'; // mh_descend | rib_descend
let mhDescendTick = 0;
let ribDescendTick = 0;
let needsInitialPosition = true;


// ── Geometria ─────────────────────────────────────────────────────────────────

const TRAVEL_FRAC = 0.5; // metade do arco (mesmo início/fim de ciclo)

const OFF = 0;


// ── Alvos de tilt (OnStart) ────────────────────────────────────────────────────

let m1_tilt_start;
let m2_tilt_start;
let m1_tilt_end;
let m2_tilt_end;
let rib_tilt_start;
let rib_tilt_end;

// ── Utilitários ───────────────────────────────────────────────────────────────

function ch(c, v) {
  if (c !== null && c !== undefined) {
    SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function fadeLevel(phaseTick, duration, max) {
  if (duration <= 1) return max;
  return Math.round(max * clamp01(phaseTick / (duration - 1)));
}

function travelEnd(start, end) {
  return lerp(start, end, TRAVEL_FRAC);
}

function setRibaltaLeds(value) {
  if (r1_leds) {
    for (let i = 0; i < 8; i++) {
      ch(r1_leds[i], value);
    }
  }
  if (r2_leds) {
    for (let i = 0; i < 8; i++) {
      ch(r2_leds[i], value);
    }
  }
}

function blackoutRibaltas() {
  ch(r1_dimmer, OFF);
  ch(r2_dimmer, OFF);
  ch(r1_strobo, OFF);
  ch(r2_strobo, OFF);
  setRibaltaLeds(OFF);
}

function applyMovingBase() {
  ch(m1_cw, 0);
  ch(m2_cw, 0);
  ch(m1_pan, MP_M1.PAN_C);
  ch(m2_pan, MP_M2.PAN_C);
  ch(m1_prism, 0);
  ch(m2_prism, 0);
}

/** Posicionamento estratégico completo — snap, sem luz. Speed 0 fixo (não usa constantes de descida). */
function applyStrategicPositioning() {
  ch(m1_speed, 0);
  ch(m2_speed, 0);
  ch(m1_tilt, m1_tilt_start);
  ch(m2_tilt, m2_tilt_start);
  ch(m1_fecho, OFF);
  ch(m2_fecho, OFF);
  ch(m1_strobo, OFF);
  ch(m2_strobo, OFF);

  mp_applyRibaltaPair(
    r1_function, r2_function,
    r1_speed, r2_speed,
    r1_tilt, r2_tilt,
    0,
    rib_tilt_start
  );
  blackoutRibaltas();
}

/** Reposiciona só os movings no topo, sem luz — não mexe na ribalta. */
function applyMovingRepositionTop() {
  ch(m1_speed, 0);
  ch(m2_speed, 0);
  ch(m1_tilt, m1_tilt_start);
  ch(m2_tilt, m2_tilt_start);
  ch(m1_fecho, OFF);
  ch(m2_fecho, OFF);
  ch(m1_strobo, OFF);
  ch(m2_strobo, OFF);
}

/** Ribalta apagada + snap LOW escondido (speed 0). */
function returnRibaltaHidden() {
  blackoutRibaltas();
  mp_applyRibaltaPair(
    r1_function, r2_function,
    r1_speed, r2_speed,
    r1_tilt, r2_tilt,
    0,
    rib_tilt_start
  );
}

/** Ribalta parada em TILT_LOW, apagada — speed 0 fixo. */
function holdRibaltaAtLow() {
  returnRibaltaHidden();
}

function applyMovingDescend(progress, fecho) {
  ch(m1_speed, MH_DESCEND_SPEED);
  ch(m2_speed, MH_DESCEND_SPEED);
  ch(m1_tilt, lerp(m1_tilt_start, m1_tilt_end, progress));
  ch(m2_tilt, lerp(m2_tilt_start, m2_tilt_end, progress));
  ch(m1_fecho, fecho);
  ch(m2_fecho, fecho);
  ch(m1_strobo, fecho > 0 ? 255 : OFF);
  ch(m2_strobo, fecho > 0 ? 255 : OFF);
}


// ── Start ─────────────────────────────────────────────────────────────────────

function OnStart() {
  tick = 0;
  phase = 'mh_descend';
  mhDescendTick = 0;
  ribDescendTick = 0;
  needsInitialPosition = true;

  m1_cw     = getChannel(ID_M1, 'color_wheel');
  m1_strobo = getChannel(ID_M1, 'strobo');
  m1_fecho  = getChannel(ID_M1, 'fecho_lampada');
  m1_prism  = getChannel(ID_M1, 'prism_1');
  m1_pan    = getChannel(ID_M1, 'pan');
  m1_tilt   = getChannel(ID_M1, 'tilt');
  m1_speed  = getChannel(ID_M1, 'virtual_speed');

  m2_cw     = getChannel(ID_M2, 'color_wheel');
  m2_strobo = getChannel(ID_M2, 'strobo');
  m2_fecho  = getChannel(ID_M2, 'fecho_lampada');
  m2_prism  = getChannel(ID_M2, 'prism_1');
  m2_pan    = getChannel(ID_M2, 'pan');
  m2_tilt   = getChannel(ID_M2, 'tilt');
  m2_speed  = getChannel(ID_M2, 'virtual_speed');

  r1_tilt     = getChannel(ID_R1, 'tilt');
  r1_speed    = getChannel(ID_R1, 'speed');
  r1_dimmer   = getChannel(ID_R1, 'dimmer');
  r1_strobo   = getChannel(ID_R1, 'strobo');
  r1_function = getChannel(ID_R1, 'function');

  r1_leds = [];
  for (let i = 1; i <= 8; i++) {
    r1_leds.push(getChannel(ID_R1, 'led_' + i));
  }

  r2_tilt     = getChannel(ID_R2, 'tilt');
  r2_speed    = getChannel(ID_R2, 'speed');
  r2_dimmer   = getChannel(ID_R2, 'dimmer');
  r2_strobo   = getChannel(ID_R2, 'strobo');
  r2_function = getChannel(ID_R2, 'function');

  r2_leds = [];
  for (let i = 1; i <= 8; i++) {
    r2_leds.push(getChannel(ID_R2, 'led_' + i));
  }

  fita = getChannel(ID_FITA, 'dimmer');

  m1_tilt_start = MP_M1.TILT_F;
  m2_tilt_start = MP_M2.TILT_F;
  rib_tilt_start = MP_RIB.TILT_LOW;

  m1_tilt_end = travelEnd(m1_tilt_start, MP_M1.TILT_A);
  m2_tilt_end = travelEnd(m2_tilt_start, MP_M2.TILT_A);
  rib_tilt_end = travelEnd(rib_tilt_start, MP_RIB.TILT_HIGH);
}


// ── Loop ──────────────────────────────────────────────────────────────────────

function OnExecute() {
  tick++;

  applyMovingBase();

  if (phase === 'mh_descend') {
    const p = clamp01(mhDescendTick / (MH_DESCEND_TICKS - 1));
    let fechoFinal;

    if (needsInitialPosition) {
      applyStrategicPositioning();
      needsInitialPosition = false;
      fechoFinal = fadeLevel(mhDescendTick, FADE_MH_TICKS, 255);
    } else {
      holdRibaltaAtLow();
      fechoFinal = fadeLevel(mhDescendTick, FADE_MH_TICKS, 255);
    }

    applyMovingDescend(p, fechoFinal);

    mhDescendTick++;
    if (mhDescendTick >= MH_DESCEND_TICKS) {
      phase = 'rib_descend';
      ribDescendTick = 0;
    }
  } else if (phase === 'rib_descend') {
    const p = clamp01(ribDescendTick / (RIB_DESCEND_TICKS - 1));
    const tailLeft = RIB_DESCEND_TICKS - ribDescendTick;
    const inHandoff = tailLeft <= RIB_TAIL_FADE_TICKS;
    const ribDim = inHandoff
      ? Math.round(255 * clamp01((tailLeft - 1) / (RIB_TAIL_FADE_TICKS - 1)))
      : fadeLevel(ribDescendTick, FADE_RIB_TICKS, 255);

    if (inHandoff) {
      const handoffMhTick = RIB_TAIL_FADE_TICKS - tailLeft;
      const mhP = clamp01(handoffMhTick / (MH_DESCEND_TICKS - 1));
      applyMovingDescend(mhP, 255);
    } else {
      applyMovingRepositionTop();
    }

    // Grid ribalta: function → speed → tilt
    mp_applyRibaltaPair(
      r1_function, r2_function,
      r1_speed, r2_speed,
      r1_tilt, r2_tilt,
      RIB_DESCEND_SPEED,
      lerp(rib_tilt_start, rib_tilt_end, p)
    );

    ch(r1_dimmer, ribDim);
    ch(r2_dimmer, ribDim);
    ch(r1_strobo, OFF);
    ch(r2_strobo, OFF);
    setRibaltaLeds(ribDim);

    ribDescendTick++;
    if (ribDescendTick >= RIB_DESCEND_TICKS) {
      returnRibaltaHidden();
      phase = 'mh_descend';
      mhDescendTick = RIB_TAIL_FADE_TICKS;
    }
  }

  ch(fita, MP_FITA_DIM);
}


// ── Terminate ─────────────────────────────────────────────────────────────────

function OnTerminate() {
  ch(m1_cw, 0);
  ch(m1_strobo, 0);
  ch(m1_fecho, 0);
  ch(m1_prism, 0);
  ch(m1_pan, 0);
  ch(m1_tilt, 0);
  ch(m1_speed, 0);

  ch(m2_cw, 0);
  ch(m2_strobo, 0);
  ch(m2_fecho, 0);
  ch(m2_prism, 0);
  ch(m2_pan, 0);
  ch(m2_tilt, 0);
  ch(m2_speed, 0);

  mp_zeroRibaltaPair(r1_function, r2_function, r1_speed, r2_speed, r1_tilt, r2_tilt, rib_tilt_start);

  ch(r1_dimmer, 0);
  ch(r2_dimmer, 0);
  ch(r1_strobo, 0);
  ch(r2_strobo, 0);

  setRibaltaLeds(0);

  ch(fita, 0);
}
