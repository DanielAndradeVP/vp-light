// ══════════════════════════════════════════════════════════════════════════════
// mov-padrao-preset.js — Preset compartilhado dos scripts mov-padrao-*.js
// Incluído automaticamente pelo runtime. Edite SOMENTE este arquivo para mudar
// a cor dos ParLeds ou as posições pan/tilt em TODOS os mov-padrão de uma vez.
// ══════════════════════════════════════════════════════════════════════════════

// ── COR PAR LED — altere R/G/B/DIM para mudar a cor em todos os mov-padrão ───
const MP_PAR_COLOR = { R: 160, G: 0, B: 220, DIM: 255 };

// ── IDs ParLed Deluxe (grupo ativo no show) ───────────────────────────────────
const MP_PAR_IDS = [
  'fixture_1780805067518_parled_deluxe_1',
  'fixture_1780805067518_parled_deluxe_2',
  'fixture_1780805067518_parled_deluxe_3',
  'fixture_1780805067518_parled_deluxe_4',
  'fixture_1780805067518_parled_deluxe_5',
  'fixture_1780805067518_parled_deluxe_7',
  'fixture_1780805067518_parled_deluxe_8',
  'fixture_1780805067518_parled_deluxe_9',
  'fixture_1780805067518_parled_deluxe_6', // ParLed_Deluxe_9_extra
];

// ── Moving Head Beam 1 (esquerda) — posições medidas no rig ─────────────────
// PAN_C = frente simétrica | PAN_L = lateral esq. | PAN_R = varrida direita
// TILT_F = nivelado frente | TILT_A = fecho altar | TILT_L = lateral
// TILT_MID = intermediário | TILT_FLOOR = apontado pro chão
const MP_M1 = {
  PAN_C:      84,
  PAN_L:      42,
  PAN_R:     120,
  TILT_F:     36,
  TILT_A:     78,
  TILT_L:     35,
  TILT_MID:  110,
  TILT_FLOOR: 144,
};

// ── Moving Head Beam 2 (direita) — espelho do M1 ─────────────────────────────
const MP_M2 = {
  PAN_C:      84,
  PAN_R:      44,
  PAN_L:      50,
  TILT_F:     32,
  TILT_A:     72,
  TILT_L:     26,
  TILT_MID:  100,
  TILT_FLOOR: 125,
};

// Separação de pan entre M1 e M2 na mesma trajetória (sincronizados)
const MP_MH_GAP = 8;

// virtual_speed padrão — lento/suave nos mov-padrão simples
const MP_MH_SPEED_SLOW = 210;

// ── Ribaltas — par sincronizado (mesmo tilt logico e mesma speed nas duas) ───
// Calibracao fisica R1/R2 fica em electron/ribaltaPhysicalCalib.js — scripts
// NUNCA somam offset manual (+70 etc.) nem usam speed diferente por lado.
const MP_RIB = {
  TILT_LOUVOR: 105,
  TILT_ALTAR:  145,
  TILT_LOW:    100,
  TILT_HIGH:   190,
  SPEED_SLOW:  190,
  SPEED_FAST:  20,
  SPEED_MED:   170,
  DIM_ON:      255,
  DIM_WASH:    220,
};

/**
 * Ribaltas motorizadas: function(0) → speed → tilt — mesmo valor nas duas.
 * Canais = numeros DMX resolvidos via getChannel (ou null).
 */
function mp_applyRibaltaPair(r1Fn, r2Fn, r1Spd, r2Spd, r1Tilt, r2Tilt, speed, tilt) {
  mp_ch(r1Fn, 0);
  mp_ch(r2Fn, 0);
  mp_ch(r1Spd, speed);
  mp_ch(r2Spd, speed);
  mp_ch(r1Tilt, tilt);
  mp_ch(r2Tilt, tilt);
}

/** OnTerminate: function → speed → tilt neutros iguais nas duas. */
function mp_zeroRibaltaPair(r1Fn, r2Fn, r1Spd, r2Spd, r1Tilt, r2Tilt, neutralTilt) {
  const tilt = neutralTilt !== undefined && neutralTilt !== null ? neutralTilt : 0;
  mp_ch(r1Fn, 0);
  mp_ch(r2Fn, 0);
  mp_ch(r1Spd, 0);
  mp_ch(r2Spd, 0);
  mp_ch(r1Tilt, tilt);
  mp_ch(r2Tilt, tilt);
}

// ── ParLeds — canais resolvidos (preenchido no OnStart de cada script) ──────
let mp_par = [];

function mp_ch(c, v) {
  if (c !== null && c !== undefined) {
    SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
  }
}

function mp_resolveParLeds() {
  mp_par = [];
  for (let i = 0; i < MP_PAR_IDS.length; i++) {
    const id = MP_PAR_IDS[i];
    mp_par.push({
      macro: getChannel(id, 'macro'),
      cw:    getChannel(id, 'color_wheel'),
      speed: getChannel(id, 'speed'),
      dim:   getChannel(id, 'dimmer'),
      r:     getChannel(id, 'red'),
      g:     getChannel(id, 'green'),
      b:     getChannel(id, 'blue'),
    });
  }
}

function mp_applyParLeds() {
  const c = MP_PAR_COLOR;
  for (let i = 0; i < mp_par.length; i++) {
    const p = mp_par[i];
    mp_ch(p.macro, 0);
    mp_ch(p.cw, 0);
    mp_ch(p.speed, 0);
    mp_ch(p.dim, c.DIM);
    mp_ch(p.r, c.R);
    mp_ch(p.g, c.G);
    mp_ch(p.b, c.B);
  }
}

function mp_zeroParLeds() {
  for (let i = 0; i < mp_par.length; i++) {
    const p = mp_par[i];
    mp_ch(p.macro, 0);
    mp_ch(p.cw, 0);
    mp_ch(p.speed, 0);
    mp_ch(p.dim, 0);
    mp_ch(p.r, 0);
    mp_ch(p.g, 0);
    mp_ch(p.b, 0);
  }
}
