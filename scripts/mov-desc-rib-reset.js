// mov-desc-rib-reset — MH + ribalta descem juntos; reset ribalta escondido.
// Preset: mov-preset.js

// ── IDs de fixture ──────────────────────────────────────────────────────────

const ID_M1   = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2   = 'fixture_1780805067518_moving_head_beam_2';

const ID_R1   = 'fixture_1780805067518_ribalta_1';
const ID_R2   = 'fixture_1780805067518_ribalta_2';

const ID_FITA = 'fixture_1780805067518_fita_led';


// ── Canais resolvidos ───────────────────────────────────────────────────────

let m1_cw, m1_strobo, m1_fecho, m1_prism, m1_pan, m1_tilt, m1_speed;
let m2_cw, m2_strobo, m2_fecho, m2_prism, m2_pan, m2_tilt, m2_speed;

let r1_tilt, r1_speed, r1_dimmer, r1_strobo, r1_function;
let r2_tilt, r2_speed, r2_dimmer, r2_strobo, r2_function;

let r1_leds = null;
let r2_leds = null;

let fita;


// ── Estado ──────────────────────────────────────────────────────────────────

let tick = 0;


// ── Timing: 25fps, 40ms/tick ────────────────────────────────────────────────

const DESCEND_TICKS = 300; // 12s descendo visível
const RESET_TICKS   = 35;  // 1.4s apagado para voltar ao tilt inicial

const LOOP = DESCEND_TICKS + RESET_TICKS;


const MOVING_SPEED_DESCEND = MP_MH_SPEED_SLOW;
const MOVING_SPEED_RESET   = MP_MH_SPEED_SLOW;


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


// ── Start ───────────────────────────────────────────────────────────────────

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
  for (let i = 1; i <= 8; i++) {
    r1_leds.push(getChannel(ID_R1, 'led_' + i));
  }

  // Ribalta 2
  r2_tilt     = getChannel(ID_R2, 'tilt');
  r2_speed    = getChannel(ID_R2, 'speed');
  r2_dimmer   = getChannel(ID_R2, 'dimmer');
  r2_strobo   = getChannel(ID_R2, 'strobo');
  r2_function = getChannel(ID_R2, 'function');

  r2_leds = [];
  for (let i = 1; i <= 8; i++) {
    r2_leds.push(getChannel(ID_R2, 'led_' + i));
  }

  // Modo DMX manual + tilt inicial (par sincronizado)
  mp_applyRibaltaPair(
    r1_function, r2_function,
    r1_speed, r2_speed,
    r1_tilt, r2_tilt,
    MP_RIB.SPEED_SLOW,
    MP_RIB.TILT_LOW
  );

  blackoutRibaltas();

  fita = getChannel(ID_FITA, 'dimmer');

  mp_resolveParLeds();
}


// ── Loop ────────────────────────────────────────────────────────────────────

function OnExecute() {
  tick++;

  const cycleTick = tick % LOOP;
  const isDescending = cycleTick < DESCEND_TICKS;

  mp_applyParLeds();

  // Mantém configurações base
  ch(m1_cw, 0);
  ch(m2_cw, 0);

  ch(m1_pan, MP_M1.PAN_C);
  ch(m2_pan, MP_M2.PAN_C);

  ch(m1_prism, 0);
  ch(m2_prism, 0);

  const ribaltaTilt = isDescending
    ? lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, clamp01(cycleTick / (DESCEND_TICKS - 1)))
    : MP_RIB.TILT_LOW;

  mp_applyRibaltaPair(
    r1_function, r2_function,
    r1_speed, r2_speed,
    r1_tilt, r2_tilt,
    MP_RIB.SPEED_SLOW,
    ribaltaTilt
  );

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

    ch(r1_dimmer, 255);
    ch(r2_dimmer, 255);

    ch(r1_strobo, 0);
    ch(r2_strobo, 0);

    setRibaltaLeds(255);
  } else {
    // RESET ESCONDIDO — ribaltas apagadas; tilt ja em TILT_LOW via mp_applyRibaltaPair
    blackoutRibaltas();

    ch(m1_speed, MOVING_SPEED_RESET);
    ch(m2_speed, MOVING_SPEED_RESET);

    ch(m1_tilt, MP_M1.TILT_F);
    ch(m2_tilt, MP_M2.TILT_F);

    ch(m1_fecho, 0);
    ch(m2_fecho, 0);

    ch(m1_strobo, 0);
    ch(m2_strobo, 0);
  }

  ch(fita, MP_FITA_DIM);
}


// ── Terminate ────────────────────────────────────────────────────────────────

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

  mp_zeroRibaltaPair(r1_function, r2_function, r1_speed, r2_speed, r1_tilt, r2_tilt, MP_RIB.TILT_LOW);

  ch(r1_dimmer, 0);
  ch(r2_dimmer, 0);

  ch(r1_strobo, 0);
  ch(r2_strobo, 0);

  setRibaltaLeds(0);

  ch(fita, 0);

  mp_zeroParLeds();
}
