// CENA: NOITE ROSA — Casamento
// PARs: magenta quente (R240 G0 B200) — pano de fundo sólido.
// Moving Heads: cross-pattern independente com ciclos diferentes.
//   MH1 varre só o PAN (tilt fixo alto) — ciclo 500 ticks
//   MH2 varre só o TILT (pan fixo centro) — ciclo 380 ticks
//   No estágio 3: MH1 e MH2 estrobam em oposição (quando um acende o outro apaga)
// Ribaltas: gangorra (offset 180) com strobo crescendo por estágio global.
// Bruts: faíscas aleatórias independentes (sem sequência fixa).
//   No estágio 3: todos disparam em rajada.
// Ciclo global 600 ticks — 5 estágios de 120 ticks coordena PARs, ribaltas e MH.

// ─── IDs de fixture ───────────────────────────────────────────────────────────
const ID_PAR = [
  'fixture_1780805067518_parled_deluxe_1',
  'fixture_1780805067518_parled_deluxe_2',
  'fixture_1780805067518_parled_deluxe_3',
  'fixture_1780805067518_parled_deluxe_5',
  'fixture_1780805067518_parled_deluxe_6',
  'fixture_1780805067518_parled_deluxe_7',
  'fixture_1780805067518_parled_deluxe_8',
  'fixture_1780805067518_parled_deluxe_9',
];
const ID_RIB1 = 'fixture_1780805067518_ribalta_1';
const ID_RIB2 = 'fixture_1780805067518_ribalta_2';
const ID_MH1  = 'fixture_1780805067518_moving_head_beam_1';
const ID_MH2  = 'fixture_1780805067518_moving_head_beam_2';
const ID_BRUT = [
  'fixture_1780805067518_mini_brut_01',
  'fixture_1780805067518_mini_brut_02',
  'fixture_1780805067518_mini_brut_03',
  'fixture_1780805067518_mini_brut_04',
];

// ─── Canais resolvidos ────────────────────────────────────────────────────────
let parDimmer = [], parRed = [], parGreen = [], parBlue = [];
let rib1Tilt, rib1Speed, rib1Dimmer, rib1Leds = [];
let rib2Tilt, rib2Speed, rib2Dimmer, rib2Leds = [];
let mh1Fecho, mh1Strobo, mh1ColorWheel, mh1Pan, mh1PanFine, mh1Tilt, mh1Speed;
let mh2Fecho, mh2Strobo, mh2ColorWheel, mh2Pan, mh2PanFine, mh2Tilt, mh2Speed;
let brutDimmer = [];

let tick = 0;

// ─── Cor: magenta quente ──────────────────────────────────────────────────────
const PAR_RED   = 240;
const PAR_GREEN = 0;
const PAR_BLUE  = 200;
const PAR_DIM   = 220;

// ─── Ciclo global 600 ticks — 5 estágios de 120 ticks ────────────────────────
const GLOBAL_CYCLE = 600;
const STAGE_DUR    = 120;

// ─── Taxas de strobo (ticks por half-cycle, tick = 40ms) ─────────────────────
const STRB_SLOW = 8;  // ~1.6 Hz
const STRB_MED  = 5;  // ~2.5 Hz
const STRB_FAST = 2;  // ~6.3 Hz

// ─── Ribaltas — gangorra: RIB2 adiantada 180 ticks ───────────────────────────
const RIB_CYCLE    = 360;
const RIB_OFFSET   = 180;
const RIB_RISE     = 110;
const RIB_HOLD_TOP = 70;
const RIB_FALL     = 120;
const RIB_TILT_MAX = 255;
const RIB_DIM_ON   = 215;
const RIB_SPEED_VAL = 145;

// ─── Moving Heads — cross-pattern ────────────────────────────────────────────
const MH_PAN_CENTER  = 128;
const MH_PAN_SPREAD  = 90;   // MH1 varre ±90 no pan
const MH_TILT_MID    = 188;  // MH1 fica nesse tilt fixo
const MH_TILT_LOW    = 163;  // MH2 oscila entre LOW e HIGH
const MH_TILT_HIGH   = 218;
const MH1_PAN_CYCLE  = 500;  // MH1: ciclo completo do pan
const MH2_TILT_CYCLE = 380;  // MH2: ciclo completo do tilt

// ─── Mini Bruts — faíscas aleatórias ─────────────────────────────────────────
const BRUT_BASE = 50;
const BRUT_PEAK = 240;
let brutNextPulse = [0, 0, 0, 0];
let brutPulseEnd  = [-1, -1, -1, -1];

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── OnStart ──────────────────────────────────────────────────────────────────
function OnStart() {
  tick = 0;

  for (let i = 0; i < ID_PAR.length; i++) {
    parDimmer[i] = getChannel(ID_PAR[i], 'dimmer');
    parRed[i]    = getChannel(ID_PAR[i], 'red');
    parGreen[i]  = getChannel(ID_PAR[i], 'green');
    parBlue[i]   = getChannel(ID_PAR[i], 'blue');
  }

  rib1Tilt   = getChannel(ID_RIB1, 'tilt');
  rib1Speed  = getChannel(ID_RIB1, 'speed');
  rib1Dimmer = getChannel(ID_RIB1, 'dimmer');
  rib1Leds   = [];
  for (let i = 1; i <= 8; i++) rib1Leds.push(getChannel(ID_RIB1, 'led_' + i));

  rib2Tilt   = getChannel(ID_RIB2, 'tilt');
  rib2Speed  = getChannel(ID_RIB2, 'speed');
  rib2Dimmer = getChannel(ID_RIB2, 'dimmer');
  rib2Leds   = [];
  for (let i = 1; i <= 8; i++) rib2Leds.push(getChannel(ID_RIB2, 'led_' + i));

  mh1Fecho      = getChannel(ID_MH1, 'fecho_lampada');
  mh1Strobo     = getChannel(ID_MH1, 'strobo');
  mh1ColorWheel = getChannel(ID_MH1, 'color_wheel');
  mh1Pan        = getChannel(ID_MH1, 'pan');
  mh1PanFine    = getChannel(ID_MH1, 'pan_fine');
  mh1Tilt       = getChannel(ID_MH1, 'tilt');
  mh1Speed      = getChannel(ID_MH1, 'virtual_speed');

  mh2Fecho      = getChannel(ID_MH2, 'fecho_lampada');
  mh2Strobo     = getChannel(ID_MH2, 'strobo');
  mh2ColorWheel = getChannel(ID_MH2, 'color_wheel');
  mh2Pan        = getChannel(ID_MH2, 'pan');
  mh2PanFine    = getChannel(ID_MH2, 'pan_fine');
  mh2Tilt       = getChannel(ID_MH2, 'tilt');
  mh2Speed      = getChannel(ID_MH2, 'virtual_speed');

  brutDimmer = [];
  for (let i = 0; i < 4; i++) brutDimmer.push(getChannel(ID_BRUT[i], 'dimmer'));

  if (mh1ColorWheel !== null) { SetChannel(mh1ColorWheel, 1); SetChannel(mh1ColorWheel, 0); }
  if (mh2ColorWheel !== null) { SetChannel(mh2ColorWheel, 1); SetChannel(mh2ColorWheel, 0); }

  // Primeiro pulso de cada brut em momento aleatório (1–4s)
  for (let i = 0; i < 4; i++) {
    brutNextPulse[i] = rnd(25, 100);
    brutPulseEnd[i]  = -1;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStage(gPhase) {
  return Math.min(4, Math.floor(gPhase / STAGE_DUR));
}

// Ribalta: tilt segue RIB_CYCLE, dimmer escala com estágio.
function ribTiltForPhase(phase) {
  if (phase < RIB_RISE) {
    return Math.round((phase / RIB_RISE) * RIB_TILT_MAX);
  }
  if (phase < RIB_RISE + RIB_HOLD_TOP) {
    return RIB_TILT_MAX;
  }
  if (phase < RIB_RISE + RIB_HOLD_TOP + RIB_FALL) {
    const ft = phase - RIB_RISE - RIB_HOLD_TOP;
    return Math.round((1 - ft / RIB_FALL) * RIB_TILT_MAX);
  }
  return 0;
}

function ribDimForPhase(ribPhase, stage) {
  const inHold = ribPhase >= RIB_RISE && ribPhase < RIB_RISE + RIB_HOLD_TOP;
  const inFall = ribPhase >= RIB_RISE + RIB_HOLD_TOP && ribPhase < RIB_RISE + RIB_HOLD_TOP + RIB_FALL;

  if (stage === 0 || stage === 4) return RIB_DIM_ON;

  if (stage === 1) {
    if (inHold) return (Math.floor(tick / STRB_SLOW) % 2 === 0) ? RIB_DIM_ON : 0;
    return RIB_DIM_ON;
  }

  if (stage === 2) {
    if (inHold || inFall) return (Math.floor(tick / STRB_MED) % 2 === 0) ? RIB_DIM_ON : 0;
    return RIB_DIM_ON;
  }

  // stage 3: strobo rápido em todo o arco ativo
  if (ribPhase < RIB_RISE + RIB_HOLD_TOP + RIB_FALL) {
    return (Math.floor(tick / STRB_FAST) % 2 === 0) ? RIB_DIM_ON : 0;
  }
  return 0;
}

function parDimValue(gPhase, idx) {
  const stage    = getStage(gPhase);
  const isGrpA   = (idx % 2 === 0);
  const subPhase = gPhase % STAGE_DUR;

  if (stage === 0 || stage === 4) return PAR_DIM;

  if (stage === 1) {
    if (isGrpA) return (Math.floor(tick / STRB_SLOW) % 2 === 0) ? PAR_DIM : 0;
    return PAR_DIM;
  }

  if (stage === 2) {
    const firstHalf = subPhase < 60;
    if (firstHalf) {
      if (isGrpA) return (Math.floor(tick / STRB_MED) % 2 === 0) ? PAR_DIM : 0;
      return PAR_DIM;
    } else {
      if (!isGrpA) return (Math.floor(tick / STRB_MED) % 2 === 0) ? PAR_DIM : 0;
      return PAR_DIM;
    }
  }

  return (Math.floor(tick / STRB_FAST) % 2 === 0) ? PAR_DIM : 0;
}

// MH1 varre o PAN de um lado a outro; tilt fica fixo alto.
function mh1PanValue() {
  const p = tick % MH1_PAN_CYCLE;
  if (p < MH1_PAN_CYCLE / 2) {
    return MH_PAN_CENTER + Math.round((p / (MH1_PAN_CYCLE / 2)) * MH_PAN_SPREAD);
  }
  return MH_PAN_CENTER + Math.round(((MH1_PAN_CYCLE - p) / (MH1_PAN_CYCLE / 2)) * MH_PAN_SPREAD);
}

// MH2 varre o TILT de baixo pra cima; pan fica fixo no centro.
function mh2TiltValue() {
  const p = tick % MH2_TILT_CYCLE;
  const half = MH2_TILT_CYCLE / 2;
  if (p < half) {
    return MH_TILT_LOW + Math.round((p / half) * (MH_TILT_HIGH - MH_TILT_LOW));
  }
  return MH_TILT_HIGH - Math.round(((p - half) / half) * (MH_TILT_HIGH - MH_TILT_LOW));
}

// No estágio 3: MH1 e MH2 estrobam em oposição (X acende enquanto Y apaga).
function mh1FechoValue(stage) {
  if (stage === 3) return (Math.floor(tick / STRB_FAST) % 2 === 0) ? 255 : 0;
  return 255;
}

function mh2FechoValue(stage) {
  // Offset de STRB_FAST: exato oposto do MH1
  if (stage === 3) return (Math.floor(tick / STRB_FAST) % 2 === 0) ? 0 : 255;
  return 255;
}

// Bruts: faíscas aleatórias. No estágio 3 todos disparam em rajada.
function updateBruts(stage) {
  if (stage === 3) {
    // Rajada: todos no pico
    for (let i = 0; i < 4; i++) {
      if (brutDimmer[i] !== null) SetChannel(brutDimmer[i], BRUT_PEAK);
    }
    return;
  }

  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] === null) continue;
    if (tick < brutPulseEnd[i]) {
      SetChannel(brutDimmer[i], BRUT_PEAK);
    } else {
      SetChannel(brutDimmer[i], BRUT_BASE);
      if (tick >= brutNextPulse[i]) {
        const dur = rnd(6, 14);
        brutPulseEnd[i]  = tick + dur;
        // Intervalos mais curtos nos estágios 1-2 (mais agitado), mais longos no respiro.
        const minGap = stage === 4 ? 100 : 30;
        const maxGap = stage === 4 ? 250 : 100;
        brutNextPulse[i] = brutPulseEnd[i] + rnd(minGap, maxGap);
      }
    }
  }
}

// ─── OnExecute ────────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;

  const gPhase = tick % GLOBAL_CYCLE;
  const stage  = getStage(gPhase);

  // ── PARs ────────────────────────────────────────────────────────────────────
  for (let i = 0; i < ID_PAR.length; i++) {
    if (parDimmer[i] === null) continue;
    SetChannel(parDimmer[i], parDimValue(gPhase, i));
    if (parRed[i]   !== null) SetChannel(parRed[i],   PAR_RED);
    if (parGreen[i] !== null) SetChannel(parGreen[i], PAR_GREEN);
    if (parBlue[i]  !== null) SetChannel(parBlue[i],  PAR_BLUE);
  }

  // ── Ribaltas — gangorra ──────────────────────────────────────────────────────
  const rib1Phase = tick % RIB_CYCLE;
  const rib2Phase = (tick + RIB_OFFSET) % RIB_CYCLE;

  if (rib1Tilt   !== null) SetChannel(rib1Tilt,   ribTiltForPhase(rib1Phase));
  if (rib1Speed  !== null) SetChannel(rib1Speed,  RIB_SPEED_VAL);
  if (rib1Dimmer !== null) SetChannel(rib1Dimmer, ribDimForPhase(rib1Phase, stage));
  for (let i = 0; i < rib1Leds.length; i++) {
    if (rib1Leds[i] !== null) SetChannel(rib1Leds[i], 255);
  }

  if (rib2Tilt   !== null) SetChannel(rib2Tilt,   ribTiltForPhase(rib2Phase));
  if (rib2Speed  !== null) SetChannel(rib2Speed,  RIB_SPEED_VAL);
  if (rib2Dimmer !== null) SetChannel(rib2Dimmer, ribDimForPhase(rib2Phase, stage));
  for (let i = 0; i < rib2Leds.length; i++) {
    if (rib2Leds[i] !== null) SetChannel(rib2Leds[i], 255);
  }

  // ── Moving Heads — cross-pattern ────────────────────────────────────────────
  const fecho1 = mh1FechoValue(stage);
  const fecho2 = mh2FechoValue(stage);
  // Velocidade do motor: mais rápida no estágio 3 para deixar o movimento mais agressivo
  const mhSpd  = stage === 3 ? 80 : 35;

  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      fecho1);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        mh1PanValue());
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       MH_TILT_MID);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      mhSpd);

  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      fecho2);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       mh2TiltValue());
  if (mh2Speed      !== null) SetChannel(mh2Speed,      mhSpd);

  // ── Mini Bruts — faíscas aleatórias ─────────────────────────────────────────
  updateBruts(stage);
}

// ─── OnTerminate ──────────────────────────────────────────────────────────────
function OnTerminate() {
  for (let i = 0; i < ID_PAR.length; i++) {
    if (parDimmer[i] !== null) SetChannel(parDimmer[i], 0);
    if (parRed[i]    !== null) SetChannel(parRed[i],    0);
    if (parGreen[i]  !== null) SetChannel(parGreen[i],  0);
    if (parBlue[i]   !== null) SetChannel(parBlue[i],   0);
  }
  if (rib1Tilt   !== null) SetChannel(rib1Tilt,   0);
  if (rib1Speed  !== null) SetChannel(rib1Speed,  0);
  if (rib1Dimmer !== null) SetChannel(rib1Dimmer, 0);
  for (let i = 0; i < rib1Leds.length; i++) {
    if (rib1Leds[i] !== null) SetChannel(rib1Leds[i], 0);
  }
  if (rib2Tilt   !== null) SetChannel(rib2Tilt,   0);
  if (rib2Speed  !== null) SetChannel(rib2Speed,  0);
  if (rib2Dimmer !== null) SetChannel(rib2Dimmer, 0);
  for (let i = 0; i < rib2Leds.length; i++) {
    if (rib2Leds[i] !== null) SetChannel(rib2Leds[i], 0);
  }
  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      0);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     0);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MH_PAN_CENTER);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       MH_TILT_MID);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      0);
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      0);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     0);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MH_TILT_LOW);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      0);
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] !== null) SetChannel(brutDimmer[i], 0);
  }
}
