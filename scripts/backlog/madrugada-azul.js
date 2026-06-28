// CENA: MADRUGADA AZUL — Casamento
// PARs em azul elétrico (R20 G80 B255). MH feixe branco sem strobo — bruts são os astros.
// Mini Bruts: ciclo próprio de 700 ticks com 7 sequências (100 ticks cada):
//   0: ping-pong bounce | 1: trail-2 deslizante | 2: outer vs inner | 3: solo devagar
//   4: explosão do centro | 5: implosão pro centro | 6: cascata bidirecional
// Ribaltas DEFASADAS (RIB2 offset +180 ticks) — efeito gangorra.
// Strobo PARs/Ribaltas via ciclo global 5 estágios 600 ticks.

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

// ─── Cor: azul elétrico ───────────────────────────────────────────────────────
const PAR_RED   = 20;
const PAR_GREEN = 80;
const PAR_BLUE  = 255;
const PAR_DIM   = 220;

// ─── Ciclo global 600 ticks — 5 estágios de 120 ticks (PARs + Ribaltas) ──────
const GLOBAL_CYCLE = 600;
const STAGE_DUR    = 120;

// ─── Taxas de strobo (ticks por half-cycle) ───────────────────────────────────
const STRB_SLOW = 8;  // ~1.6 Hz
const STRB_MED  = 5;  // ~2.5 Hz
const STRB_FAST = 2;  // ~6.3 Hz

// ─── Ribaltas — defasadas: RIB2 avançada 180 ticks (gangorra) ────────────────
const RIB_CYCLE     = 360;
const RIB_OFFSET    = 180; // RIB2 sempre em fase oposta a RIB1
const RIB_RISE      = 110;
const RIB_HOLD_TOP  = 70;
const RIB_FALL      = 130;
const RIB_TILT_MAX  = 255;
const RIB_DIM_ON    = 220;
const RIB_SPEED_VAL = 150;

// ─── Moving Heads ─────────────────────────────────────────────────────────────
const MH_PAN_CENTER     = 128;
const MH_PAN_SPREAD     = 90;
const MH_TILT_LOW       = 160;
const MH_TILT_HIGH      = 200;
const MH_EXPAND_TICKS   = 180;
const MH_HOLD_TICKS     = 60;
const MH_CONTRACT_TICKS = 180;
const MH_REST_TICKS     = 80;
const MH_CYCLE = 500; // 180+60+180+80

// ─── Mini Bruts ───────────────────────────────────────────────────────────────
const BRUT_BASE     = 40;
const BRUT_PEAK     = 230;
const BRUT_CYCLE    = 700; // 7 sequências × 100 ticks
const BRUT_SEQ_DUR  = 100;

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

function mhStateForPhase(phase) {
  if (phase < MH_EXPAND_TICKS) {
    const pct = phase / MH_EXPAND_TICKS;
    return {
      spread: Math.round(pct * MH_PAN_SPREAD),
      tilt:   Math.round(MH_TILT_LOW + pct * (MH_TILT_HIGH - MH_TILT_LOW)),
    };
  }
  if (phase < MH_EXPAND_TICKS + MH_HOLD_TICKS) {
    return { spread: MH_PAN_SPREAD, tilt: MH_TILT_HIGH };
  }
  if (phase < MH_EXPAND_TICKS + MH_HOLD_TICKS + MH_CONTRACT_TICKS) {
    const rt  = phase - MH_EXPAND_TICKS - MH_HOLD_TICKS;
    const pct = rt / MH_CONTRACT_TICKS;
    return {
      spread: Math.round((1 - pct) * MH_PAN_SPREAD),
      tilt:   Math.round(MH_TILT_HIGH - pct * (MH_TILT_HIGH - MH_TILT_LOW)),
    };
  }
  return { spread: 0, tilt: MH_TILT_LOW };
}

// ─── Sequências dos Mini Bruts ─────────────────────────────────────────────────

// Seq 0 — Ping-pong: bounce 0→1→2→3→2→1 (6 posições em 100 ticks)
function brutPingPong(sub, idx) {
  const bounds    = [0, 16, 32, 48, 64, 80, 100];
  const positions = [0,  1,  2,  3,  2,   1];
  for (let s = 0; s < 6; s++) {
    if (sub >= bounds[s] && sub < bounds[s + 1]) {
      return (idx === positions[s]) ? BRUT_PEAK : BRUT_BASE;
    }
  }
  return BRUT_BASE;
}

// Seq 1 — Trail-2: par de 2 consecutivos desliza: (0+1)→(1+2)→(2+3)→(1+2)
function brutTrail2(sub, idx) {
  const pos        = Math.floor(sub / 25);
  const pairStarts = [0, 1, 2, 1];
  const start      = pairStarts[pos];
  return (idx === start || idx === start + 1) ? BRUT_PEAK : BRUT_BASE;
}

// Seq 2 — Outer vs Inner: (0+3) e (1+2) alternando com gap (período 30)
function brutOuterInner(sub, idx) {
  const p = sub % 30;
  if (p < 12)              return (idx === 0 || idx === 3) ? BRUT_PEAK : BRUT_BASE;
  if (p >= 15 && p < 27)  return (idx === 1 || idx === 2) ? BRUT_PEAK : BRUT_BASE;
  return BRUT_BASE;
}

// Seq 3 — Solo devagar: um brut por vez, troca a cada 25 ticks
function brutSolo(sub, idx) {
  const active = Math.floor(sub / 25) % 4;
  return (idx === active) ? BRUT_PEAK : BRUT_BASE;
}

// Seq 4 — Explosão do centro: expande de 1+2 → todos, com strobo crescente
function brutExplode(sub, idx) {
  if (sub < 25) {
    return (idx === 1 || idx === 2) ? BRUT_PEAK : BRUT_BASE;
  }
  if (sub < 50) {
    if (idx === 1 || idx === 2) return BRUT_PEAK;
    return (Math.floor(tick / STRB_SLOW) % 2 === 0) ? BRUT_PEAK : BRUT_BASE;
  }
  if (sub < 75) {
    return (Math.floor(tick / STRB_MED) % 2 === 0) ? BRUT_PEAK : BRUT_BASE;
  }
  return (Math.floor(tick / STRB_FAST) % 2 === 0) ? BRUT_PEAK : BRUT_BASE;
}

// Seq 5 — Implosão pro centro: contrai de todos → 1+2 → só o brut 1
function brutImplode(sub, idx) {
  if (sub < 25) {
    return (Math.floor(tick / STRB_FAST) % 2 === 0) ? BRUT_PEAK : BRUT_BASE;
  }
  if (sub < 50) {
    if (idx === 0 || idx === 3) return BRUT_BASE;
    return BRUT_PEAK;
  }
  if (sub < 75) {
    return (idx === 1 || idx === 2) ? BRUT_PEAK : BRUT_BASE;
  }
  return (idx === 1) ? BRUT_PEAK : BRUT_BASE;
}

// Seq 6 — Cascata bidirecional: alterna direção a cada 16 ticks (4 bruts × 4 ticks)
function brutBidi(sub, idx) {
  const dir    = Math.floor(sub / 16) % 2; // 0=frente, 1=trás
  const p      = sub % 16;
  const step   = Math.floor(p / 4);        // 0,1,2,3
  const active = dir === 0 ? step : 3 - step;
  return (idx === active) ? BRUT_PEAK : BRUT_BASE;
}

function brutValue(bPhase, idx) {
  const seq = Math.floor(bPhase / BRUT_SEQ_DUR);
  const sub = bPhase % BRUT_SEQ_DUR;
  switch (seq) {
    case 0: return brutPingPong(sub, idx);
    case 1: return brutTrail2(sub, idx);
    case 2: return brutOuterInner(sub, idx);
    case 3: return brutSolo(sub, idx);
    case 4: return brutExplode(sub, idx);
    case 5: return brutImplode(sub, idx);
    case 6: return brutBidi(sub, idx);
    default: return BRUT_BASE;
  }
}

// ─── OnExecute ────────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;

  const gPhase = tick % GLOBAL_CYCLE;
  const stage  = getStage(gPhase);
  const bPhase = tick % BRUT_CYCLE;

  // ── PARs ────────────────────────────────────────────────────────────────────
  for (let i = 0; i < ID_PAR.length; i++) {
    if (parDimmer[i] === null) continue;
    SetChannel(parDimmer[i], parDimValue(gPhase, i));
    if (parRed[i]   !== null) SetChannel(parRed[i],   PAR_RED);
    if (parGreen[i] !== null) SetChannel(parGreen[i], PAR_GREEN);
    if (parBlue[i]  !== null) SetChannel(parBlue[i],  PAR_BLUE);
  }

  // ── Ribaltas — gangorra: RIB1 na fase normal, RIB2 defasada +180 ────────────
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

  // ── Moving Heads — feixe branco, sem strobo (bruts são os astros) ───────────
  const mhPhase = tick % MH_CYCLE;
  const mhState = mhStateForPhase(mhPhase);

  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      255);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MH_PAN_CENTER + mhState.spread);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       mhState.tilt);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      35);

  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      255);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER - mhState.spread);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       mhState.tilt);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      35);

  // ── Mini Bruts — ciclo próprio independente ──────────────────────────────────
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] === null) continue;
    SetChannel(brutDimmer[i], brutValue(bPhase, i));
  }
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
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MH_TILT_LOW);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      0);
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] !== null) SetChannel(brutDimmer[i], 0);
  }
}
