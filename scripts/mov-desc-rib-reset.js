// mov-desc-rib-reset — MH descem com reset escondido + fita.
// Preset: mov-preset.js

// ── IDs de fixture ──────────────────────────────────────────────────────────

const ID_M1   = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2   = 'fixture_1780805067518_moving_head_beam_2';

const ID_FITA = 'fixture_1780805067518_fita_led';


// ── Canais resolvidos ───────────────────────────────────────────────────────

let m1_cw, m1_strobo, m1_fecho, m1_prism, m1_pan, m1_tilt, m1_speed;
let m2_cw, m2_strobo, m2_fecho, m2_prism, m2_pan, m2_tilt, m2_speed;

let fita;


// ── Estado ──────────────────────────────────────────────────────────────────

let tick = 0;


// ── Timing: 25fps, 40ms/tick ────────────────────────────────────────────────

const DESCEND_TICKS = 300; // 12s descendo visível
const RESET_TICKS   = 35;  // 1.4s apagado para voltar ao tilt inicial

const LOOP = DESCEND_TICKS + RESET_TICKS;


const MOVING_SPEED_DESCEND = MP_MH_SPEED_SLOW;
const MOVING_SPEED_RESET   = MP_MH_SPEED_SLOW;


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

  fita = getChannel(ID_FITA, 'dimmer');
}


// ── Loop ────────────────────────────────────────────────────────────────────

function OnExecute() {
  tick++;

  const cycleTick = tick % LOOP;
  const isDescending = cycleTick < DESCEND_TICKS;

  // Mantém configurações base
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

  ch(fita, 0);
}
