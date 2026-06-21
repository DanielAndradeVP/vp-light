// CENA: AURORA VERMELHA — Casamento
// Base: noite-rosa. Diferenças:
//   Cor: vermelho profundo (R255 G15 B40).
//   MH invertidos: MH1 varre TILT (pan fixo), MH2 varre PAN (tilt fixo) — ciclos trocados.
//   Estágio 3: MH1+MH2 estrobam JUNTOS (não em oposição). Bruts em cascata rápida.
//   Ribaltas: gangorra com RIB_RISE mais curto (impacto mais abrupto).
// Ciclo global 5 estágios 600 ticks.

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

// ─── Cor: vermelho profundo ───────────────────────────────────────────────────
const PAR_RED   = 255;
const PAR_GREEN = 15;
const PAR_BLUE  = 40;
const PAR_DIM   = 220;

// ─── Ciclo global 600 ticks — 5 estágios de 120 ticks ────────────────────────
const GLOBAL_CYCLE = 600;
const STAGE_DUR    = 120;

const STRB_SLOW = 8;
const STRB_MED  = 5;
const STRB_FAST = 2;

// ─── Ribaltas — gangorra, rise abrupto ───────────────────────────────────────
const RIB_CYCLE     = 360;
const RIB_OFFSET    = 180;
const RIB_RISE      = 60;   // sobe rápido (vs 110 do noite-rosa)
const RIB_HOLD_TOP  = 90;   // pausa mais longa no topo
const RIB_FALL      = 150;
const RIB_TILT_MAX  = 255;
const RIB_DIM_ON    = 215;
const RIB_SPEED_VAL = 180;  // motor mais rápido

// ─── Moving Heads — cross invertido: MH1 varre TILT, MH2 varre PAN ───────────
const MH_PAN_CENTER   = 128;
const MH_PAN_SPREAD   = 90;
const MH_TILT_MID     = 188; // MH2 fica nesse tilt fixo
const MH_TILT_LOW     = 163;
const MH_TILT_HIGH    = 218;
const MH1_TILT_CYCLE  = 380; // MH1: oscila tilt (era ciclo do MH2 em noite-rosa)
const MH2_PAN_CYCLE   = 500; // MH2: oscila pan (era ciclo do MH1 em noite-rosa)

// ─── PARs — chase ping-pong ───────────────────────────────────────────────────
// Velocidade do chase escala com o estágio; estágio 3 = tudo strobo.
// step 0–7: acende PAR 0→7 | step 8–13: volta PAR 6→1 (total 14 steps/ciclo)

// ─── Mini Bruts — faíscas + cascata no pico ──────────────────────────────────
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

  for (let i = 0; i < 4; i++) {
    brutNextPulse[i] = rnd(25, 100);
    brutPulseEnd[i]  = -1;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStage(gPhase) {
  return Math.min(4, Math.floor(gPhase / STAGE_DUR));
}

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

  if (ribPhase < RIB_RISE + RIB_HOLD_TOP + RIB_FALL) {
    return (Math.floor(tick / STRB_FAST) % 2 === 0) ? RIB_DIM_ON : 0;
  }
  return 0;
}

// Ticks por posição do chase: diminui conforme o estágio cresce (mais rápido).
function chaseTicksPerStep(stage) {
  if (stage === 0 || stage === 4) return 4; // ~160ms/PAR
  if (stage === 1) return 3;                // ~120ms/PAR
  return 2;                                 // ~80ms/PAR
}

function parDimValue(gPhase, idx) {
  const stage = getStage(gPhase);

  // Estágio 3: tudo strobo rápido — explosão total
  if (stage === 3) {
    return (Math.floor(tick / STRB_FAST) % 2 === 0) ? PAR_DIM : 0;
  }

  // Outros estágios: chase ping-pong 0→7→0
  const cs     = chaseTicksPerStep(stage);
  const step   = Math.floor(tick / cs) % 14;        // 0..13
  const active = step <= 7 ? step : 14 - step;       // 0→7→6→...→1
  return idx === active ? PAR_DIM : 0;
}

// MH1: oscila TILT (pan fixo centro)
function mh1TiltValue() {
  const p    = tick % MH1_TILT_CYCLE;
  const half = MH1_TILT_CYCLE / 2;
  if (p < half) return MH_TILT_LOW + Math.round((p / half) * (MH_TILT_HIGH - MH_TILT_LOW));
  return MH_TILT_HIGH - Math.round(((p - half) / half) * (MH_TILT_HIGH - MH_TILT_LOW));
}

// MH2: oscila PAN (tilt fixo)
function mh2PanValue() {
  const p    = tick % MH2_PAN_CYCLE;
  const half = MH2_PAN_CYCLE / 2;
  if (p < half) return MH_PAN_CENTER + Math.round((p / half) * MH_PAN_SPREAD);
  return MH_PAN_CENTER + Math.round(((MH2_PAN_CYCLE - p) / half) * MH_PAN_SPREAD);
}

// Estágio 3: ambos estrobam JUNTOS (diferente de noite-rosa onde eram em oposição)
function mhFechoValue(stage) {
  if (stage === 3) return (Math.floor(tick / STRB_FAST) % 2 === 0) ? 255 : 0;
  return 255;
}

// Bruts: faíscas aleatórias. Estágio 3: cascata bidirecional rápida.
function updateBruts(stage) {
  if (stage === 3) {
    // Cascata rápida alternando direção a cada 16 ticks
    const dir    = Math.floor(tick / 16) % 2;
    const p      = tick % 16;
    const step   = Math.floor(p / 4);
    const active = dir === 0 ? step : 3 - step;
    for (let i = 0; i < 4; i++) {
      if (brutDimmer[i] !== null) {
        SetChannel(brutDimmer[i], i === active ? BRUT_PEAK : BRUT_BASE);
      }
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

  // ── Moving Heads — cross invertido ──────────────────────────────────────────
  const fechoVal = mhFechoValue(stage);
  const mhSpd    = stage === 3 ? 80 : 35;

  // MH1: pan fixo centro, tilt oscila
  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      fechoVal);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MH_PAN_CENTER);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       mh1TiltValue());
  if (mh1Speed      !== null) SetChannel(mh1Speed,      mhSpd);

  // MH2: pan oscila, tilt fixo
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      fechoVal);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        mh2PanValue());
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MH_TILT_MID);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      mhSpd);

  // ── Mini Bruts ───────────────────────────────────────────────────────────────
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
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       MH_TILT_LOW);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      0);
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      0);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     0);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MH_TILT_MID);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      0);
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] !== null) SetChannel(brutDimmer[i], 0);
  }
}
