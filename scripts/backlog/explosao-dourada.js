// CENA: EXPLOSÃO DOURADA — Casamento
// Baseado em tempestade-roxa. Cor: ouro quente (R255 G130 B20). MH: feixe branco.
// Strobo COORDENADO em 5 estágios via ciclo global de 600 ticks (~24s):
//   Estágio 0 (0–119):   Construção — tudo sólido, MH varrem devagar
//   Estágio 1 (120–239): Pulso      — PAR grupo A pulso lento, ribaltas pulsam no hold
//   Estágio 2 (240–359): Strobo leve — PAR grupos alternando strobo médio, ribaltas+hold+descida
//   Estágio 3 (360–479): PICO        — tudo strobo rápido incluindo MH, bruts em rajada
//   Estágio 4 (480–599): Respiro     — tudo sólido, bruts base

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

// ─── Cor dos PARs: ouro quente ────────────────────────────────────────────────
const PAR_RED   = 255;
const PAR_GREEN = 130;
const PAR_BLUE  = 20;
const PAR_DIM   = 220;

// ─── Ciclo global e estágios ──────────────────────────────────────────────────
const GLOBAL_CYCLE = 600;
const STAGE_DUR    = 120; // ticks por estágio (5 × 120 = 600)

// ─── Taxas de strobo (ticks por half-cycle, tick = 40ms) ─────────────────────
const STRB_SLOW = 8; // ~1.6 Hz  — pulso suave
const STRB_MED  = 5; // ~2.5 Hz  — médio
const STRB_FAST = 2; // ~6.3 Hz  — rápido/intenso

// ─── Ribaltas ─────────────────────────────────────────────────────────────────
const RIB_CYCLE    = 360;
const RIB_RISE     = 100;
const RIB_HOLD_TOP = 80;
const RIB_FALL     = 120;
// rest = 60 ticks
const RIB_TILT_MAX  = 255;
const RIB_DIM_ON    = 220;
const RIB_SPEED_VAL = 140;

// ─── Moving Heads ─────────────────────────────────────────────────────────────
const MH_PAN_CENTER     = 128;
const MH_PAN_SPREAD     = 85;
const MH_TILT_LOW       = 165;
const MH_TILT_HIGH      = 215;
const MH_EXPAND_TICKS   = 190;
const MH_HOLD_TICKS     = 50;
const MH_CONTRACT_TICKS = 190;
const MH_REST_TICKS     = 70;
const MH_CYCLE = 500; // 190+50+190+70

// ─── Mini Bruts ───────────────────────────────────────────────────────────────
const BRUT_BASE = 40;
const BRUT_PEAK = 230;

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

// Dimmer das ribaltas: o movimento segue RIB_CYCLE; o strobo escala com o estágio.
function ribDimForPhase(ribPhase, stage) {
  const inHold      = ribPhase >= RIB_RISE && ribPhase < RIB_RISE + RIB_HOLD_TOP;
  const inFallEarly = ribPhase >= RIB_RISE + RIB_HOLD_TOP && ribPhase < RIB_RISE + RIB_HOLD_TOP + 60;
  const inActive    = ribPhase < RIB_RISE + RIB_HOLD_TOP + RIB_FALL;

  if (stage === 0 || stage === 4) return RIB_DIM_ON;

  if (stage === 1) {
    // pulso lento apenas durante o hold no topo
    if (inHold) return (Math.floor(tick / STRB_SLOW) % 2 === 0) ? RIB_DIM_ON : 0;
    return RIB_DIM_ON;
  }

  if (stage === 2) {
    // strobo médio em hold + primeira metade da descida
    if (inHold || inFallEarly) return (Math.floor(tick / STRB_MED) % 2 === 0) ? RIB_DIM_ON : 0;
    return RIB_DIM_ON;
  }

  // stage === 3: strobo rápido em todo o arco ativo (subida+hold+descida)
  if (inActive) return (Math.floor(tick / STRB_FAST) % 2 === 0) ? RIB_DIM_ON : 0;
  return 0; // rest: apagado
}

// Shutter do MH: abre sempre, exceto no pico onde stroboa junto.
function mhFechoValue(stage) {
  if (stage === 3) return (Math.floor(tick / STRB_FAST) % 2 === 0) ? 255 : 0;
  return 255;
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

function parDimValue(gPhase, idx) {
  const stage    = getStage(gPhase);
  const isGrpA   = (idx % 2 === 0); // índices 0,2,4,6 = grupo A
  const subPhase = gPhase % STAGE_DUR;

  if (stage === 0 || stage === 4) return PAR_DIM;

  if (stage === 1) {
    // Grupo A pulso lento; Grupo B sólido
    if (isGrpA) return (Math.floor(tick / STRB_SLOW) % 2 === 0) ? PAR_DIM : 0;
    return PAR_DIM;
  }

  if (stage === 2) {
    // Primeira metade: A strobo médio, B sólido; Segunda: B strobo médio, A sólido
    const firstHalf = subPhase < 60;
    if (firstHalf) {
      if (isGrpA) return (Math.floor(tick / STRB_MED) % 2 === 0) ? PAR_DIM : 0;
      return PAR_DIM;
    } else {
      if (!isGrpA) return (Math.floor(tick / STRB_MED) % 2 === 0) ? PAR_DIM : 0;
      return PAR_DIM;
    }
  }

  // stage === 3: todos strobo rápido
  return (Math.floor(tick / STRB_FAST) % 2 === 0) ? PAR_DIM : 0;
}

// Bruts seguem o estágio global: cascatas nos primeiros, rajada total no pico, base no respiro.
function brutValue(gPhase, idx) {
  const stage    = getStage(gPhase);
  const subPhase = gPhase % STAGE_DUR;

  if (stage === 0) {
    // cascade direto 0→1→2→3
    const p  = subPhase % 37;
    const on = idx * 9;
    return (p >= on && p < on + 10) ? BRUT_PEAK : BRUT_BASE;
  }
  if (stage === 1) {
    // cascade reverso 3→2→1→0
    const p  = subPhase % 37;
    const on = (3 - idx) * 9;
    return (p >= on && p < on + 10) ? BRUT_PEAK : BRUT_BASE;
  }
  if (stage === 2) {
    // pares alternados com período reduzido (40 ticks)
    const p      = subPhase % 40;
    const isGrpA = (idx === 0 || idx === 2);
    if (isGrpA) return (p < 16) ? BRUT_PEAK : BRUT_BASE;
    return (p >= 20 && p < 36) ? BRUT_PEAK : BRUT_BASE;
  }
  if (stage === 3) {
    // rajada máxima: todos pulsam rápido (5 on / 5 off)
    return ((subPhase % 10) < 5) ? BRUT_PEAK : BRUT_BASE;
  }
  // stage === 4: respiro — base
  return BRUT_BASE;
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

  // ── Ribaltas — sincronizadas ─────────────────────────────────────────────────
  const ribPhase   = tick % RIB_CYCLE;
  const ribTiltVal = ribTiltForPhase(ribPhase);
  const ribDimVal  = ribDimForPhase(ribPhase, stage);

  if (rib1Tilt   !== null) SetChannel(rib1Tilt,   ribTiltVal);
  if (rib1Speed  !== null) SetChannel(rib1Speed,  RIB_SPEED_VAL);
  if (rib1Dimmer !== null) SetChannel(rib1Dimmer, ribDimVal);
  for (let i = 0; i < rib1Leds.length; i++) {
    if (rib1Leds[i] !== null) SetChannel(rib1Leds[i], 255);
  }

  if (rib2Tilt   !== null) SetChannel(rib2Tilt,   ribTiltVal);
  if (rib2Speed  !== null) SetChannel(rib2Speed,  RIB_SPEED_VAL);
  if (rib2Dimmer !== null) SetChannel(rib2Dimmer, ribDimVal);
  for (let i = 0; i < rib2Leds.length; i++) {
    if (rib2Leds[i] !== null) SetChannel(rib2Leds[i], 255);
  }

  // ── Moving Heads — simétricos, feixe branco ──────────────────────────────────
  const mhPhase   = tick % MH_CYCLE;
  const mhState   = mhStateForPhase(mhPhase);
  const fechoVal  = mhFechoValue(stage);

  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      fechoVal);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MH_PAN_CENTER + mhState.spread);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       mhState.tilt);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      40);

  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      fechoVal);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER - mhState.spread);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       mhState.tilt);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      40);

  // ── Mini Bruts — sequência por estágio ──────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] === null) continue;
    SetChannel(brutDimmer[i], brutValue(gPhase, i));
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
