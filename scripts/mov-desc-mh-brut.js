// mov-desc-mh-brut — Descida MH + mini bruts; sem ribalta.
// Preset: mov-preset.js

// ── IDs de fixture ──────────────────────────────────────────────────────────

const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';

const ID_FITA = 'fixture_1780805067518_fita_led';

const ID_B01 = 'fixture_1780805067518_mini_brut_01';
const ID_B02 = 'fixture_1780805067518_mini_brut_02';
const ID_B03 = 'fixture_1780805067518_mini_brut_03';
const ID_B04 = 'fixture_1780805067518_mini_brut_04';


// ── Canais resolvidos ───────────────────────────────────────────────────────

let m1_cw, m1_strobo, m1_fecho, m1_prism, m1_pan, m1_tilt, m1_speed;
let m2_cw, m2_strobo, m2_fecho, m2_prism, m2_pan, m2_tilt, m2_speed;

let fita, b01, b02, b03, b04;


// ── Estado ──────────────────────────────────────────────────────────────────

let tick = 0;


// ── Timing: 25fps, 40ms/tick ────────────────────────────────────────────────

const DESCEND_TICKS = 300; // 12s descendo visível
const RESET_TICKS = 35;   // 1.4s apagado para voltar ao tilt inicial

const LOOP = DESCEND_TICKS + RESET_TICKS;

const MOVING_SPEED_DESCEND = MP_MH_SPEED_SLOW;
const MOVING_SPEED_RESET = MP_MH_SPEED_SLOW;


// ── Valores gerais ──────────────────────────────────────────────────────────

const OFF = 0;


// ── Utilitários ─────────────────────────────────────────────────────────────

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

function spulse(t, min, max, period) {
  return min + ((max - min) / 2) * (1 + Math.sin(2 * Math.PI * t / period));
}


// ── Start ───────────────────────────────────────────────────────────────────

function OnStart() {
  tick = 0;

  // Moving Head 1
  m1_cw = getChannel(ID_M1, 'color_wheel');
  m1_strobo = getChannel(ID_M1, 'strobo');
  m1_fecho = getChannel(ID_M1, 'fecho_lampada');
  m1_prism = getChannel(ID_M1, 'prism_1');
  m1_pan = getChannel(ID_M1, 'pan');
  m1_tilt = getChannel(ID_M1, 'tilt');
  m1_speed = getChannel(ID_M1, 'virtual_speed');

  // Moving Head 2
  m2_cw = getChannel(ID_M2, 'color_wheel');
  m2_strobo = getChannel(ID_M2, 'strobo');
  m2_fecho = getChannel(ID_M2, 'fecho_lampada');
  m2_prism = getChannel(ID_M2, 'prism_1');
  m2_pan = getChannel(ID_M2, 'pan');
  m2_tilt = getChannel(ID_M2, 'tilt');
  m2_speed = getChannel(ID_M2, 'virtual_speed');

  // Fita e Mini Bruts
  fita = getChannel(ID_FITA, 'dimmer');

  b01 = getChannel(ID_B01, 'dimmer');
  b02 = getChannel(ID_B02, 'dimmer');
  b03 = getChannel(ID_B03, 'dimmer');
  b04 = getChannel(ID_B04, 'dimmer');

  mp_resolveParLeds();
}


// ── Loop ────────────────────────────────────────────────────────────────────

function OnExecute() {
  tick++;

  const cycleTick = tick % LOOP;
  const isDescending = cycleTick < DESCEND_TICKS;

  mp_applyParLeds();

  // Mantém configurações base dos movings
  ch(m1_cw, 0);
  ch(m2_cw, 0);

  ch(m1_pan, MP_M1.PAN_C);
  ch(m2_pan, MP_M2.PAN_C);

  ch(m1_prism, 0);
  ch(m2_prism, 0);

  if (isDescending) {
    const p = clamp01(cycleTick / (DESCEND_TICKS - 1));

    // MOVINGS — acesos e descendo
    ch(m1_speed, MOVING_SPEED_DESCEND);
    ch(m2_speed, MOVING_SPEED_DESCEND);

    ch(m1_tilt, lerp(MP_M1.TILT_F, MP_M1.TILT_A, p));
    ch(m2_tilt, lerp(MP_M2.TILT_F, MP_M2.TILT_A, p));

    ch(m1_fecho, 255);
    ch(m2_fecho, 255);

    ch(m1_strobo, 255);
    ch(m2_strobo, 255);
  } else {
    // RESET ESCONDIDO
    // Fecha os movings durante o reset para esconder o retorno deles.
    ch(m1_speed, MOVING_SPEED_RESET);
    ch(m2_speed, MOVING_SPEED_RESET);

    ch(m1_tilt, MP_M1.TILT_F);
    ch(m2_tilt, MP_M2.TILT_F);

    ch(m1_fecho, OFF);
    ch(m2_fecho, OFF);

    ch(m1_strobo, OFF);
    ch(m2_strobo, OFF);
  }

  // MINI BRUTS — onda suave em 4 canais
  ch(b01, spulse(cycleTick, 76, 255, 100));
  ch(b02, spulse(cycleTick + 25, 76, 255, 100));
  ch(b03, spulse(cycleTick + 50, 76, 255, 100));
  ch(b04, spulse(cycleTick + 75, 76, 255, 100));

  // FITA LED — 70% constante
  ch(fita, 178);
}


// ── Terminate ────────────────────────────────────────────────────────────────

function OnTerminate() {
  ch(m1_cw, 0);
  ch(m1_strobo, 0);
  ch(m1_fecho, 0);
  ch(m1_prism, 0);
  ch(m1_pan, 0);
  ch(m1_speed, 0);
  ch(m1_tilt, 0);

  ch(m2_cw, 0);
  ch(m2_strobo, 0);
  ch(m2_fecho, 0);
  ch(m2_prism, 0);
  ch(m2_pan, 0);
  ch(m2_speed, 0);
  ch(m2_tilt, 0);

  ch(fita, 0);

  ch(b01, 0);
  ch(b02, 0);
  ch(b03, 0);
  ch(b04, 0);

  mp_zeroParLeds();
}