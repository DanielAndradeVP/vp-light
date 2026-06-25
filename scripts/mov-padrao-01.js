// mov-padrao-01 — Cena de movimento suave em branco com Moving Heads. Destino: F1.
// Preset compartilhado: scripts/mov-padrao-preset.js (cor ParLed + pan/tilt)

// ── IDs de fixture ──────────────────────────────────────────────────────────
const ID_M1   = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2   = 'fixture_1780805067518_moving_head_beam_2';
const ID_R1   = 'fixture_1780805067518_ribalta_1';
const ID_R2   = 'fixture_1780805067518_ribalta_2';
const ID_FITA = 'fixture_1780805067518_fita_led';
const ID_B01  = 'fixture_1780805067518_mini_brut_01';
const ID_B02  = 'fixture_1780805067518_mini_brut_02';
const ID_B03  = 'fixture_1780805067518_mini_brut_03';
const ID_B04  = 'fixture_1780805067518_mini_brut_04';

// ── Canais resolvidos ───────────────────────────────────────────────────────
let m1_cw, m1_strobo, m1_fecho, m1_prism, m1_pan, m1_tilt, m1_speed;
let m2_cw, m2_strobo, m2_fecho, m2_prism, m2_pan, m2_tilt, m2_speed;
let r1_tilt, r1_speed, r1_dimmer, r1_strobo, r1_function;
let r2_tilt, r2_speed, r2_dimmer, r2_strobo, r2_function;
let r1_leds = null, r2_leds = null;
let fita, b01, b02, b03, b04;

// ── Estado ──────────────────────────────────────────────────────────────────
let tick = 0;

// ── Timing: 25fps, 40ms/tick ────────────────────────────────────────────────
const LOOP = 300;
const F2   = 300;

// ── Utilitários ─────────────────────────────────────────────────────────────
function ch(c, v) {
  if (c !== null && c !== undefined) {
    SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v)     { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Pulso senoidal contínuo entre min e max com período em ticks
// Em t=0+offset: retorna midpoint; at sin=1: max; at sin=-1: min
function spulse(t, min, max, period) {
  return min + ((max - min) / 2) * (1 + Math.sin(2 * Math.PI * t / period));
}


function OnStart() {
  tick = 0;

  // Moving Head 1
  m1_cw     = getChannel(ID_M1, 'color_wheel');
  m1_strobo = getChannel(ID_M1, 'strobo');
  m1_fecho  = getChannel(ID_M1, 'fecho_lampada');
  m1_prism  = getChannel(ID_M1, 'prism_1');
  m1_pan    = getChannel(ID_M1, 'pan');
  m1_tilt   = getChannel(ID_M1, 'tilt');
  m1_speed  = getChannel(ID_M1, 'virtual_speed');

  // Moving Head 2
  m2_cw     = getChannel(ID_M2, 'color_wheel');
  m2_strobo = getChannel(ID_M2, 'strobo');
  m2_fecho  = getChannel(ID_M2, 'fecho_lampada');
  m2_prism  = getChannel(ID_M2, 'prism_1');
  m2_pan    = getChannel(ID_M2, 'pan');
  m2_tilt   = getChannel(ID_M2, 'tilt');
  m2_speed  = getChannel(ID_M2, 'virtual_speed');

  // Ribalta 1
  r1_tilt     = getChannel(ID_R1, 'tilt');
  r1_speed    = getChannel(ID_R1, 'speed');
  r1_dimmer   = getChannel(ID_R1, 'dimmer');
  r1_strobo   = getChannel(ID_R1, 'strobo');
  r1_function = getChannel(ID_R1, 'function');
  r1_leds = [];
  for (let i = 1; i <= 8; i++) r1_leds.push(getChannel(ID_R1, 'led_' + i));

  // Ribalta 2
  r2_tilt     = getChannel(ID_R2, 'tilt');
  r2_speed    = getChannel(ID_R2, 'speed');
  r2_dimmer   = getChannel(ID_R2, 'dimmer');
  r2_strobo   = getChannel(ID_R2, 'strobo');
  r2_function = getChannel(ID_R2, 'function');
  r2_leds = [];
  for (let i = 1; i <= 8; i++) r2_leds.push(getChannel(ID_R2, 'led_' + i));

  // Garante modo DMX manual nas ribaltas (function=0)
  ch(r1_function, 0);
  ch(r2_function, 0);

  // Fita e Mini Bruts
  fita = getChannel(ID_FITA, 'dimmer');
  b01  = getChannel(ID_B01,  'dimmer');
  b02  = getChannel(ID_B02,  'dimmer');
  b03  = getChannel(ID_B03,  'dimmer');
  b04  = getChannel(ID_B04,  'dimmer');

  mp_resolveParLeds();
}


function OnExecute() {
  tick++;
  const t = tick % LOOP;
  const p = clamp01(t / (F2 - 1));

  mp_applyParLeds();

  // MOVING HEADS: tilt em espelho com luz branca e velocidade lenta
  ch(m1_cw, 0);
  ch(m2_cw, 0);
  ch(m1_speed, MP_MH_SPEED_SLOW);
  ch(m2_speed, MP_MH_SPEED_SLOW);
  ch(m1_pan, MP_M1.PAN_C);
  ch(m2_pan, MP_M2.PAN_C);
  ch(m1_tilt, lerp(MP_M1.TILT_F, MP_M1.TILT_A, p));
  ch(m2_tilt, lerp(MP_M2.TILT_F, MP_M2.TILT_A, p));
  ch(m1_fecho, 255);
  ch(m2_fecho, 255);
  ch(m1_strobo, 255);
  ch(m2_strobo, 255);
  ch(m1_prism, 0);
  ch(m2_prism, 0);

  // RIBALTAS — fase 1: branco cheio, tilt louvor estático
  ch(r1_dimmer, 255); ch(r2_dimmer, 255);
  ch(r1_speed, MP_RIB.R1_SPEED_SLOW); ch(r2_speed, MP_RIB.R2_SPEED_SLOW);
  ch(r1_tilt, MP_RIB.TILT_LOUVOR_1); ch(r2_tilt, MP_RIB.TILT_LOUVOR_2);
  ch(r1_strobo, 0); ch(r2_strobo, 0);
  for (let i = 0; i < 8; i++) {
    ch(r1_leds[i], 255);
    ch(r2_leds[i], 255);
  }

  // MINI BRUTS — fase 1: onda suave em 4 canais
  ch(b01, spulse(t, 76, 255, 100));
  ch(b02, spulse(t + 25, 76, 255, 100));
  ch(b03, spulse(t + 50, 76, 255, 100));
  ch(b04, spulse(t + 75, 76, 255, 100));

  // FITA LED — fase 1: 70% constante
  ch(fita, 178);
}

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

  ch(r1_dimmer, 0); ch(r2_dimmer, 0);
  ch(r1_strobo, 0); ch(r2_strobo, 0);
  if (r1_leds) { for (let i = 0; i < 8; i++) ch(r1_leds[i], 0); }
  if (r2_leds) { for (let i = 0; i < 8; i++) ch(r2_leds[i], 0); }

  ch(fita, 0);
  ch(b01, 0); ch(b02, 0); ch(b03, 0); ch(b04, 0);

  mp_zeroParLeds();
}