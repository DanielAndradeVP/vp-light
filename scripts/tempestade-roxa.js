// CENA: TEMPESTADE ROXA
// Mini Bruts: 4 sequências intercaladas — cascade, cascade-reverso, pares, todos juntos.
// Moving Heads: simétricos e alinhados (expandem e contraem juntos, MH1↔MH2 espelho).
// Ribaltas: oscilação de velocidade média com dois momentos de strobo por ciclo.
// PARs: roxo fixo com 4 fases de strobo — grupo A, grupo B, todos, sólido (respiro).

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

// ─── PARs — roxo com ciclo de strobo ─────────────────────────────────────────
const PAR_RED    = 160;
const PAR_GREEN  = 0;
const PAR_BLUE   = 220;
const PAR_DIM_ON = 210;
// Grupo A = índices pares (0,2,4,6) | Grupo B = índices ímpares (1,3,5,7)
// Ciclo 480 ticks (~19s): 4 fases de 120 ticks cada
const PAR_CYCLE      = 480;
const PAR_PH_A       = 0;    // 0–119:   Grupo A strobo rápido, B sólido
const PAR_PH_B       = 120;  // 120–239: Grupo B strobo rápido, A sólido
const PAR_PH_ALL     = 240;  // 240–359: Todos strobo médio
const PAR_PH_REST    = 360;  // 360–479: Todos sólidos (respiro)
const PAR_STRB_FAST  = 2;    // toggle a cada 2 ticks (~12 Hz)
const PAR_STRB_MED   = 5;    // toggle a cada 5 ticks (~5 Hz)

// ─── Ribaltas ─────────────────────────────────────────────────────────────────
// Ciclo 360 ticks (~14.4s): sobe → pausa no topo → desce → pausa em zero
const RIB_CYCLE    = 360;
const RIB_RISE     = 120;  // sobe em 120 ticks (~4.8s)
const RIB_HOLD_TOP = 60;   // pausa no topo 60 ticks (~2.4s) — strobo aqui
const RIB_FALL     = 120;  // desce em 120 ticks (~4.8s)
// rest = 360 - 300 = 60 ticks — pausa em zero (sem strobo)
const RIB_TILT_MAX  = 255;
const RIB_DIM_ON    = 217;
const RIB_SPEED_VAL = 160; // velocidade média
// Janelas de strobo: top (fase 120–178) e meio da descida (fase 225–265)
const RIB_STRB1_S = 120;
const RIB_STRB1_E = 178;
const RIB_STRB2_S = 225;
const RIB_STRB2_E = 268;
const RIB_STRB_RATE = 3;   // toggle a cada 3 ticks (~8 Hz)

// ─── Moving Heads — simétricos e alinhados ───────────────────────────────────
// Ambos expandem juntos (MH1 vai direita, MH2 vai esquerda) e contraem juntos.
const MH_PAN_CENTER   = 128;
const MH_PAN_SPREAD   = 95;   // offset máximo a partir do centro
const MH_TILT_LOW     = 170;  // posição baixa (piso)
const MH_TILT_HIGH    = 215;  // posição levantada
const MH_EXPAND_TICKS = 180;
const MH_HOLD_TICKS   = 45;
const MH_CONTRACT_TICKS = 175;
const MH_REST_TICKS   = 100;
const MH_CYCLE = MH_EXPAND_TICKS + MH_HOLD_TICKS + MH_CONTRACT_TICKS + MH_REST_TICKS; // 500

// ─── Mini Bruts — 4 sequências rotativas ─────────────────────────────────────
const BRUT_BASE = 40;
const BRUT_PEAK = 230;
const BRUT_CYCLE    = 600; // ciclo total (~24s)
const BRUT_SEQ_DUR  = 150; // duração de cada sequência (4 × 150 = 600)
// SEQ 0: cascade 0→1→2→3 | SEQ 1: cascade reverso 3→2→1→0
// SEQ 2: pares (0+2) vs (1+3) | SEQ 3: todos pulsando juntos

// ─── OnStart ─────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ribTiltForPhase(phase) {
  if (phase < RIB_RISE) {
    return Math.round((phase / RIB_RISE) * RIB_TILT_MAX);
  } else if (phase < RIB_RISE + RIB_HOLD_TOP) {
    return RIB_TILT_MAX;
  } else if (phase < RIB_RISE + RIB_HOLD_TOP + RIB_FALL) {
    const ft = phase - RIB_RISE - RIB_HOLD_TOP;
    return Math.round((1 - ft / RIB_FALL) * RIB_TILT_MAX);
  }
  return 0;
}

// Strobo nos dois momentos do ciclo; fora deles dimmer fixo.
function ribDimmerForPhase(phase) {
  const inStrb1 = phase >= RIB_STRB1_S && phase < RIB_STRB1_E;
  const inStrb2 = phase >= RIB_STRB2_S && phase < RIB_STRB2_E;
  if (inStrb1 || inStrb2) {
    return (Math.floor(tick / RIB_STRB_RATE) % 2 === 0) ? RIB_DIM_ON : 0;
  }
  return RIB_DIM_ON;
}

// Ambos os MHs usam o mesmo state; MH1 adiciona o spread, MH2 subtrai (espelho).
function mhStateForPhase(phase) {
  if (phase < MH_EXPAND_TICKS) {
    const pct = phase / MH_EXPAND_TICKS;
    return {
      spread: Math.round(pct * MH_PAN_SPREAD),
      tilt:   Math.round(MH_TILT_LOW + pct * (MH_TILT_HIGH - MH_TILT_LOW)),
    };
  } else if (phase < MH_EXPAND_TICKS + MH_HOLD_TICKS) {
    return { spread: MH_PAN_SPREAD, tilt: MH_TILT_HIGH };
  } else if (phase < MH_EXPAND_TICKS + MH_HOLD_TICKS + MH_CONTRACT_TICKS) {
    const rt  = phase - MH_EXPAND_TICKS - MH_HOLD_TICKS;
    const pct = rt / MH_CONTRACT_TICKS;
    return {
      spread: Math.round((1 - pct) * MH_PAN_SPREAD),
      tilt:   Math.round(MH_TILT_HIGH - pct * (MH_TILT_HIGH - MH_TILT_LOW)),
    };
  }
  return { spread: 0, tilt: MH_TILT_LOW };
}

// Retorna BRUT_PEAK ou BRUT_BASE: 4 sequências rotativas de 150 ticks cada.
function brutValue(globalPhase, idx) {
  const seq      = Math.floor(globalPhase / BRUT_SEQ_DUR); // 0–3
  const seqPhase = globalPhase % BRUT_SEQ_DUR;

  if (seq === 0) {
    // Cascade direto: brut 0→1→2→3, cada um dispara por 10 ticks dentro de período 37
    const p   = seqPhase % 37;
    const on  = idx * 9;
    return (p >= on && p < on + 10) ? BRUT_PEAK : BRUT_BASE;
  }

  if (seq === 1) {
    // Cascade reverso: brut 3→2→1→0
    const p   = seqPhase % 37;
    const on  = (3 - idx) * 9;
    return (p >= on && p < on + 10) ? BRUT_PEAK : BRUT_BASE;
  }

  if (seq === 2) {
    // Pares alternados: (0+2) ligam, depois (1+3) ligam (período 50 ticks)
    const p       = seqPhase % 50;
    const isGrpA  = (idx === 0 || idx === 2);
    if (isGrpA) return (p < 20) ? BRUT_PEAK : BRUT_BASE;
    return (p >= 25 && p < 45) ? BRUT_PEAK : BRUT_BASE;
  }

  // seq === 3: todos pulsam juntos — 10 ligados / 10 desligados
  return ((seqPhase % 20) < 10) ? BRUT_PEAK : BRUT_BASE;
}

// Retorna dimmer do PAR: varia conforme fase do ciclo de strobo e grupo do PAR.
function parDimValue(parPhase, idx) {
  const isGrpA = (idx % 2 === 0); // índices 0,2,4,6 = grupo A

  if (parPhase < PAR_PH_B) {
    // Grupo A strobo rápido, B sólido
    if (isGrpA) return (Math.floor(tick / PAR_STRB_FAST) % 2 === 0) ? PAR_DIM_ON : 0;
    return PAR_DIM_ON;
  }

  if (parPhase < PAR_PH_ALL) {
    // Grupo B strobo rápido, A sólido
    if (!isGrpA) return (Math.floor(tick / PAR_STRB_FAST) % 2 === 0) ? PAR_DIM_ON : 0;
    return PAR_DIM_ON;
  }

  if (parPhase < PAR_PH_REST) {
    // Todos strobo médio
    return (Math.floor(tick / PAR_STRB_MED) % 2 === 0) ? PAR_DIM_ON : 0;
  }

  // Fase rest: todos sólidos
  return PAR_DIM_ON;
}

// ─── OnExecute ───────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;

  // ── PARs ────────────────────────────────────────────────────────────────────
  const parPhase = tick % PAR_CYCLE;
  for (let i = 0; i < ID_PAR.length; i++) {
    if (parDimmer[i] === null) continue;
    SetChannel(parDimmer[i], parDimValue(parPhase, i));
    if (parRed[i]   !== null) SetChannel(parRed[i],   PAR_RED);
    if (parGreen[i] !== null) SetChannel(parGreen[i], PAR_GREEN);
    if (parBlue[i]  !== null) SetChannel(parBlue[i],  PAR_BLUE);
  }

  // ── Ribaltas — sincronizadas, mesma fase ────────────────────────────────────
  const ribPhase   = tick % RIB_CYCLE;
  const ribTiltVal = ribTiltForPhase(ribPhase);
  const ribDimVal  = ribDimmerForPhase(ribPhase);

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

  // ── Moving Heads — simétricos e alinhados ───────────────────────────────────
  const mhPhase = tick % MH_CYCLE;
  const mhState = mhStateForPhase(mhPhase);

  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      255);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MH_PAN_CENTER + mhState.spread);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       mhState.tilt);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      40);

  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      255);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_CENTER - mhState.spread);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       mhState.tilt);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      40);

  // ── Mini Bruts — sequências intercaladas ────────────────────────────────────
  const brutPhase = tick % BRUT_CYCLE;
  for (let i = 0; i < 4; i++) {
    if (brutDimmer[i] === null) continue;
    SetChannel(brutDimmer[i], brutValue(brutPhase, i));
  }
}

// ─── OnTerminate ─────────────────────────────────────────────────────────────
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
