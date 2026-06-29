// ══════════════════════════════════════════════════════════════════════════════
// mov-preset.js — Biblioteca compartilhada (pan/tilt MH, helpers ribalta).
// Injetado automaticamente em todo mov-*.js exceto este arquivo.
// Script standalone — Movings trajetória suave por keyframes + Ribaltas RGB estáticas + Fita LED.
// Destino: F10. Sem ribalta motorizada nem Mini Bruts.
// ══════════════════════════════════════════════════════════════════════════════

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

// ── Ribaltas RGB estáticas (enabled:false no show — getChannel retorna null) ─
const MP_RIB_STATIC_IDS = [
  'fixture_1780805067518_ribalta_rgb_static_1',
  'fixture_1780805067518_ribalta_rgb_static_2',
  'fixture_1780805067518_ribalta_rgb_static_3',
  'fixture_1780805067518_ribalta_rgb_static_4',
];

const MP_FITA_DIM = 178;

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

// ── Ribaltas RGB estáticas — canais resolvidos ───────────────────────────────
let mp_ribStatic = [];

function mp_ch(c, v) {
  if (c !== null && c !== undefined) {
    SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
  }
}

function mp_resolveRibStatic() {
  mp_ribStatic = [];
  for (let i = 0; i < MP_RIB_STATIC_IDS.length; i++) {
    const id = MP_RIB_STATIC_IDS[i];
    mp_ribStatic.push({
      dim:     getChannel(id, 'dimmer'),
      r:       getChannel(id, 'red'),
      g:       getChannel(id, 'green'),
      b:       getChannel(id, 'blue'),
      strobo:  getChannel(id, 'strobo'),
      special: getChannel(id, 'special'),
    });
  }
}

function mp_applyRibStatic() {
  for (let i = 0; i < mp_ribStatic.length; i++) {
    const rib = mp_ribStatic[i];
    mp_ch(rib.special, 0);
    mp_ch(rib.strobo, 0);
    mp_ch(rib.dim, MP_RIB.DIM_WASH);
    mp_ch(rib.r, 255);
    mp_ch(rib.g, 255);
    mp_ch(rib.b, 255);
  }
}

function mp_zeroRibStatic() {
  for (let i = 0; i < mp_ribStatic.length; i++) {
    const rib = mp_ribStatic[i];
    mp_ch(rib.special, 0);
    mp_ch(rib.strobo, 0);
    mp_ch(rib.dim, 0);
    mp_ch(rib.r, 0);
    mp_ch(rib.g, 0);
    mp_ch(rib.b, 0);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// F10 standalone — Movings 8 fases + Ribaltas RGB estáticas + Fita LED
// (prefixo mp_f10_ evita conflito de let ao prepend em outros mov-*.js)
// ══════════════════════════════════════════════════════════════════════════════

const MP_F10_ID_MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MP_F10_ID_MH2  = 'fixture_1780805067518_moving_head_beam_2';
const MP_F10_ID_FITA = 'fixture_1780805067518_fita_led';

let mp_f10_mh1Fecho, mp_f10_mh1Strobo, mp_f10_mh1ColorWheel, mp_f10_mh1Pan, mp_f10_mh1PanFine, mp_f10_mh1Tilt, mp_f10_mh1Speed;
let mp_f10_mh2Fecho, mp_f10_mh2Strobo, mp_f10_mh2ColorWheel, mp_f10_mh2Pan, mp_f10_mh2PanFine, mp_f10_mh2Tilt, mp_f10_mh2Speed;
let mp_f10_fita;
let mp_f10_tick = 0;

// Trajetória contínua por keyframes — sem saltos entre etapas (~28.8s, 720 ticks)
// K0 = K6 para loop perfeito; smoothstep + speed lenta uniforme no interpolador
const MP_F10_MH_KEYFRAMES = [
  { pan: MP_M1.PAN_L,  tilt: MP_M1.TILT_A,     dur: 120 }, // K0 — lateral esq / altar
  { pan: MP_M1.PAN_R,  tilt: MP_M1.TILT_FLOOR, dur: 120 }, // K1 — direita / chão
  { pan: MP_M1.PAN_L,  tilt: MP_M1.TILT_MID,   dur: 120 }, // K2 — esq / meio
  { pan: MP_M1.PAN_C,  tilt: MP_M1.TILT_FLOOR, dur: 120 }, // K3 — centro / chão
  { pan: MP_M1.PAN_R,  tilt: MP_M1.TILT_MID,   dur: 120 }, // K4 — direita / meio
  { pan: MP_M1.PAN_C,  tilt: MP_M1.TILT_A,     dur: 120 }, // K5 — centro / altar
  { pan: MP_M1.PAN_L,  tilt: MP_M1.TILT_A,     dur: 0   }, // K6 = K0 (fecha o loop)
];

const MP_F10_MH_CYCLE = MP_F10_MH_KEYFRAMES.reduce(function (sum, k) {
  return sum + k.dur;
}, 0);

const MP_F10_MH_SPEED = MP_MH_SPEED_SLOW;

function mp_f10_lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function mp_f10_smoothstep(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function mp_f10_mhStateForPhase(phase) {
  const p = phase % MP_F10_MH_CYCLE;
  let acc = 0;

  for (let i = 0; i < MP_F10_MH_KEYFRAMES.length - 1; i++) {
    const dur = MP_F10_MH_KEYFRAMES[i].dur;
    if (p < acc + dur) {
      const from = MP_F10_MH_KEYFRAMES[i];
      const to = MP_F10_MH_KEYFRAMES[i + 1];
      const t = mp_f10_smoothstep((p - acc) / dur);
      return {
        pan: mp_f10_lerp(from.pan, to.pan, t),
        tilt: mp_f10_lerp(from.tilt, to.tilt, t),
        spd: MP_F10_MH_SPEED,
      };
    }
    acc += dur;
  }

  const last = MP_F10_MH_KEYFRAMES[0];
  return { pan: last.pan, tilt: last.tilt, spd: MP_F10_MH_SPEED };
}

function OnStart() {
  mp_f10_tick = 0;

  mp_f10_mh1Fecho      = getChannel(MP_F10_ID_MH1, 'fecho_lampada');
  mp_f10_mh1Strobo     = getChannel(MP_F10_ID_MH1, 'strobo');
  mp_f10_mh1ColorWheel = getChannel(MP_F10_ID_MH1, 'color_wheel');
  mp_f10_mh1Pan        = getChannel(MP_F10_ID_MH1, 'pan');
  mp_f10_mh1PanFine    = getChannel(MP_F10_ID_MH1, 'pan_fine');
  mp_f10_mh1Tilt       = getChannel(MP_F10_ID_MH1, 'tilt');
  mp_f10_mh1Speed      = getChannel(MP_F10_ID_MH1, 'virtual_speed');

  mp_f10_mh2Fecho      = getChannel(MP_F10_ID_MH2, 'fecho_lampada');
  mp_f10_mh2Strobo     = getChannel(MP_F10_ID_MH2, 'strobo');
  mp_f10_mh2ColorWheel = getChannel(MP_F10_ID_MH2, 'color_wheel');
  mp_f10_mh2Pan        = getChannel(MP_F10_ID_MH2, 'pan');
  mp_f10_mh2PanFine    = getChannel(MP_F10_ID_MH2, 'pan_fine');
  mp_f10_mh2Tilt       = getChannel(MP_F10_ID_MH2, 'tilt');
  mp_f10_mh2Speed      = getChannel(MP_F10_ID_MH2, 'virtual_speed');

  mp_f10_fita = getChannel(MP_F10_ID_FITA, 'dimmer');

  if (mp_f10_mh1ColorWheel !== null) { SetChannel(mp_f10_mh1ColorWheel, 1); SetChannel(mp_f10_mh1ColorWheel, 0); }
  if (mp_f10_mh2ColorWheel !== null) { SetChannel(mp_f10_mh2ColorWheel, 1); SetChannel(mp_f10_mh2ColorWheel, 0); }

  mp_resolveRibStatic();
}

function OnExecute() {
  mp_f10_tick++;

  const mhPhase = mp_f10_tick % MP_F10_MH_CYCLE;
  const mh = mp_f10_mhStateForPhase(mhPhase);

  mp_ch(mp_f10_mh1Fecho, 255);
  mp_ch(mp_f10_mh1Strobo, 255);
  mp_ch(mp_f10_mh1ColorWheel, 0);
  mp_ch(mp_f10_mh1Speed, MP_F10_MH_SPEED);
  mp_ch(mp_f10_mh1Pan, mh.pan - MP_MH_GAP);
  mp_ch(mp_f10_mh1PanFine, 0);
  mp_ch(mp_f10_mh1Tilt, mh.tilt);

  mp_ch(mp_f10_mh2Fecho, 255);
  mp_ch(mp_f10_mh2Strobo, 255);
  mp_ch(mp_f10_mh2ColorWheel, 0);
  mp_ch(mp_f10_mh2Speed, MP_F10_MH_SPEED);
  mp_ch(mp_f10_mh2Pan, mh.pan + MP_MH_GAP);
  mp_ch(mp_f10_mh2PanFine, 0);
  mp_ch(mp_f10_mh2Tilt, mh.tilt);

  mp_applyRibStatic();
  mp_ch(mp_f10_fita, MP_FITA_DIM);
}

function OnTerminate() {
  mp_ch(mp_f10_mh1Fecho, 0);
  mp_ch(mp_f10_mh1Strobo, 0);
  mp_ch(mp_f10_mh1ColorWheel, 0);
  mp_ch(mp_f10_mh1Speed, 0);
  mp_ch(mp_f10_mh1Pan, MP_M1.PAN_L);
  mp_ch(mp_f10_mh1PanFine, 0);
  mp_ch(mp_f10_mh1Tilt, MP_M1.TILT_MID);

  mp_ch(mp_f10_mh2Fecho, 0);
  mp_ch(mp_f10_mh2Strobo, 0);
  mp_ch(mp_f10_mh2ColorWheel, 0);
  mp_ch(mp_f10_mh2Speed, 0);
  mp_ch(mp_f10_mh2Pan, MP_M2.PAN_L);
  mp_ch(mp_f10_mh2PanFine, 0);
  mp_ch(mp_f10_mh2Tilt, MP_M2.TILT_MID);

  mp_zeroRibStatic();
  mp_ch(mp_f10_fita, 0);
}
