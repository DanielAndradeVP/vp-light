// CENA: NOITE ROXA
// PARs fixos em roxo profundo (R=160, G=0, B=220).
// Ribaltas em respiração sincronizada (tilt 0→255→0, sobem e descem juntas).
// Moving Heads em farol lento ping-pong, espelhados, MH2 atrasado 2s.
// Mini Bruts com pulsos aleatórios independentes (faíscas elétricas).

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

// ─── Estado global ────────────────────────────────────────────────────────────
let tick = 0;

// PARs: cor fixa roxo profundo — sem animação de dimmer.
const PAR_DIM   = 210;  // ~82% de brilho
const PAR_RED   = 160;
const PAR_GREEN = 0;
const PAR_BLUE  = 220;

// Ribaltas: dimmer sobe 153 (60%) → 217 (85%) em 300 ticks (~12s).
const RIB_DIM_START  = 153;
const RIB_DIM_END    = 217;
const RIB_DIM_TICKS  = 300;
// Tilt: ciclo 300 ticks — 100 sobe + 50 pausa + 100 desce + 50 pausa.
const RIB_CYCLE  = 300;
const RIB_RISE   = 100;
const RIB_HOLD1  = 50;
const RIB_FALL   = 100;
// Rib2 sem offset → sincronizadas, sobem e descem juntas.
const RIB2_OFFSET    = 0;
const RIB_TILT_MAX   = 255;
// Speed funcional do catálogo (não altere sem reconfirmar no palco).
const RIB1_SPEED_VAL = 190;
const RIB2_SPEED_VAL = 190;

// Moving Heads: pan center→right (MH1) / center→left (MH2); tilt floor→back.
const MH_PAN_CENTER  = 128;
const MH_PAN_OFFSET  = 102;
const MH_TILT_FLOOR  = 170;
const MH_TILT_BACK   = 210;
// Ciclo: 250 sai + 87 pausa + 250 volta + 50 repouso = 637 ticks.
const MH_MOVE_TICKS = 250;
const MH_HOLD_TICKS = 87;
const MH_REST_TICKS = 50;
const MH_CYCLE = MH_MOVE_TICKS * 2 + MH_HOLD_TICKS + MH_REST_TICKS; // 637
// MH2 começa 50 ticks (2s) depois do MH1.
const MH2_PHASE_OFFSET = MH_CYCLE - 50; // 587

// Mini Bruts: base 30% (76), pulso ~82% (210). Intervalos aleatórios por unidade.
const BRUT_BASE = 76;
const BRUT_PEAK = 210;
let brutNextPulse = [0, 0, 0, 0];
let brutPulseEnd  = [-1, -1, -1, -1];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── OnStart ─────────────────────────────────────────────────────────────────
function OnStart() {
  tick = 0;

  // PARs
  for (let i = 0; i < 9; i++) {
    parDimmer[i] = getChannel(ID_PAR[i], 'dimmer');
    parRed[i]    = getChannel(ID_PAR[i], 'red');
    parGreen[i]  = getChannel(ID_PAR[i], 'green');
    parBlue[i]   = getChannel(ID_PAR[i], 'blue');
  }

  // Ribaltas
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

  // Moving Heads
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

  // Mini Bruts
  brutDimmer = [];
  for (let i = 0; i < 4; i++) brutDimmer.push(getChannel(ID_BRUT[i], 'dimmer'));

  // Moving Heads: pulsa color_wheel em 1 depois zera — garante branco limpo na roda
  if (mh1ColorWheel !== null) { SetChannel(mh1ColorWheel, 1); SetChannel(mh1ColorWheel, 0); }
  if (mh2ColorWheel !== null) { SetChannel(mh2ColorWheel, 1); SetChannel(mh2ColorWheel, 0); }

  // Primeiro pulso de cada Brut em momento aleatório (1–4s após início)
  for (let i = 0; i < 4; i++) {
    brutNextPulse[i] = randomBetween(25, 100);
    brutPulseEnd[i]  = -1;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ribTiltForPhase(phase) {
  if (phase < RIB_RISE) {
    return Math.round((phase / RIB_RISE) * RIB_TILT_MAX);
  } else if (phase < RIB_RISE + RIB_HOLD1) {
    return RIB_TILT_MAX;
  } else if (phase < RIB_RISE + RIB_HOLD1 + RIB_FALL) {
    const ft = phase - RIB_RISE - RIB_HOLD1;
    return Math.round((1 - ft / RIB_FALL) * RIB_TILT_MAX);
  } else {
    return 0;
  }
}

function mhStateForPhase(phase) {
  if (phase < MH_MOVE_TICKS) {
    const pct = phase / MH_MOVE_TICKS;
    return {
      panOffset: Math.round(pct * MH_PAN_OFFSET),
      tilt: Math.round(MH_TILT_FLOOR + pct * (MH_TILT_BACK - MH_TILT_FLOOR)),
    };
  } else if (phase < MH_MOVE_TICKS + MH_HOLD_TICKS) {
    return { panOffset: MH_PAN_OFFSET, tilt: MH_TILT_BACK };
  } else if (phase < MH_MOVE_TICKS * 2 + MH_HOLD_TICKS) {
    const rt = phase - MH_MOVE_TICKS - MH_HOLD_TICKS;
    const pct = rt / MH_MOVE_TICKS;
    return {
      panOffset: Math.round((1 - pct) * MH_PAN_OFFSET),
      tilt: Math.round(MH_TILT_BACK - pct * (MH_TILT_BACK - MH_TILT_FLOOR)),
    };
  } else {
    return { panOffset: 0, tilt: MH_TILT_FLOOR };
  }
}

// ─── OnExecute ───────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;

  // ── PAR LED Deluxe — roxo fixo ──────────────────────────────────────────────
  for (let i = 0; i < 9; i++) {
    if (parDimmer[i] === null) continue;
    SetChannel(parDimmer[i], PAR_DIM);
    if (parRed[i]   !== null) SetChannel(parRed[i],   PAR_RED);
    if (parGreen[i] !== null) SetChannel(parGreen[i], PAR_GREEN);
    if (parBlue[i]  !== null) SetChannel(parBlue[i],  PAR_BLUE);
  }

  // ── Ribaltas ────────────────────────────────────────────────────────────────
  const ribDim = tick <= RIB_DIM_TICKS
    ? RIB_DIM_START + Math.round((tick / RIB_DIM_TICKS) * (RIB_DIM_END - RIB_DIM_START))
    : RIB_DIM_END;

  const rib1TiltVal = ribTiltForPhase(tick % RIB_CYCLE);
  const rib2TiltVal = ribTiltForPhase((tick + RIB2_OFFSET) % RIB_CYCLE);

  if (rib1Tilt   !== null) SetChannel(rib1Tilt,   rib1TiltVal);
  if (rib1Speed  !== null) SetChannel(rib1Speed,  RIB1_SPEED_VAL);
  if (rib1Dimmer !== null) SetChannel(rib1Dimmer, ribDim);
  for (let i = 0; i < rib1Leds.length; i++) {
    if (rib1Leds[i] !== null) SetChannel(rib1Leds[i], 255);
  }

  if (rib2Tilt   !== null) SetChannel(rib2Tilt,   rib2TiltVal);
  if (rib2Speed  !== null) SetChannel(rib2Speed,  RIB2_SPEED_VAL);
  if (rib2Dimmer !== null) SetChannel(rib2Dimmer, ribDim);
  for (let i = 0; i < rib2Leds.length; i++) {
    if (rib2Leds[i] !== null) SetChannel(rib2Leds[i], 255);
  }

  // ── Moving Heads ────────────────────────────────────────────────────────────
  const mh1State = mhStateForPhase(tick % MH_CYCLE);
  const mh2State = mhStateForPhase((tick + MH2_PHASE_OFFSET) % MH_CYCLE);

  // MH1 → pan para a direita
  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      255);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MH_PAN_CENTER + mh1State.panOffset);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       mh1State.tilt);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      30);

  // MH2 → pan para a esquerda (espelho)
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      255);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER - mh2State.panOffset);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       mh2State.tilt);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      30);

  // ── Mini Bruts ──────────────────────────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] === null) continue;
    if (tick < brutPulseEnd[i]) {
      SetChannel(brutDimmer[i], BRUT_PEAK);
    } else {
      SetChannel(brutDimmer[i], BRUT_BASE);
      if (tick >= brutNextPulse[i]) {
        const pulseDur = randomBetween(7, 12);
        brutPulseEnd[i]  = tick + pulseDur;
        brutNextPulse[i] = brutPulseEnd[i] + randomBetween(50, 175);
      }
    }
  }
}

// ─── OnTerminate ─────────────────────────────────────────────────────────────
function OnTerminate() {
  for (let i = 0; i < 9; i++) {
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
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       MH_TILT_FLOOR);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      0);
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      0);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     0);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MH_TILT_FLOOR);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      0);
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] !== null) SetChannel(brutDimmer[i], 0);
  }
}
