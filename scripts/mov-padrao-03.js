// mov-padrao-03 — Movings 8 fases + Ribaltas 7 fases sincronizadas. Destino: F1.
// Preset compartilhado: scripts/mov-padrao-preset.js (cor ParLed + pan/tilt)

// ─── IDs de fixture ───────────────────────────────────────────────────────────
const ID_MH1  = 'fixture_1780805067518_moving_head_beam_1';
const ID_MH2  = 'fixture_1780805067518_moving_head_beam_2';
const ID_RIB1 = 'fixture_1780805067518_ribalta_1';
const ID_RIB2 = 'fixture_1780805067518_ribalta_2';

// ─── Canais resolvidos ────────────────────────────────────────────────────────
let mh1Fecho, mh1Strobo, mh1ColorWheel, mh1Pan, mh1PanFine, mh1Tilt, mh1Speed;
let mh2Fecho, mh2Strobo, mh2ColorWheel, mh2Pan, mh2PanFine, mh2Tilt, mh2Speed;
let rib1Tilt, rib1Speed, rib1Dimmer, rib1Function, rib1Leds = [];
let rib2Tilt, rib2Speed, rib2Dimmer, rib2Function, rib2Leds = [];

let tick = 0;

// Ciclo de 8 fases — 720 ticks (~28.8s)
// F0: lento     — pan abrindo L→R, tilt desce HIGH→FLOOR        (150t, spd=20)
// F1: médio     — varrida R→L, tilt sobe FLOOR→MID              (130t, spd=55)
// F2: rápido    — pan curto L→CENTER, tilt MID→FLOOR            ( 60t, spd=130)
// F3: rápido    — pan CENTER→R, tilt FLOOR→MID                  ( 80t, spd=130)
// F4: parada    — pan=R fixo, tilt=MID (ponto forte)            ( 50t, spd=25)
// F5: dramático — pan R→L lento, tilt=FLOOR                     (120t, spd=30)
// F6: subida    — pan L→CENTER, tilt sobe FLOOR→HIGH            ( 80t, spd=45)
// F7: final     — pan CENTER→R rápido, tilt=HIGH                ( 50t, spd=120)
const MH_D0 = 150;
const MH_D1 = 130;
const MH_D2 = 60;
const MH_D3 = 80;
const MH_D4 = 50;
const MH_D5 = 120;
const MH_D6 = 80;
const MH_D7 = 50;

const MH_S1 = MH_D0;
const MH_S2 = MH_S1 + MH_D1;
const MH_S3 = MH_S2 + MH_D2;
const MH_S4 = MH_S3 + MH_D3;
const MH_S5 = MH_S4 + MH_D4;
const MH_S6 = MH_S5 + MH_D5;
const MH_S7 = MH_S6 + MH_D6;
const MH_CYCLE = MH_S7 + MH_D7; // 720

// Ciclo de 7 fases — 500 ticks (~20s)
// FA: subida lenta   100→190                                     (100t, spd=70)
// FB: pausa em 190                                               ( 50t, spd=70)
// FC: descida rápida 190→100                                     ( 70t, spd=200)
// FD: pausa em 100                                               ( 50t, spd=200)
// FE: subida média   100→190                                     (100t, spd=130)
// FF: descida rápida 190→100                                     ( 60t, spd=200)
// FG: pausa em 100 + preparação lenta                            ( 70t, spd=60)
const RIB_DA = 100;
const RIB_DB = 50;
const RIB_DC = 70;
const RIB_DD = 50;
const RIB_DE = 100;
const RIB_DF = 60;
const RIB_DG = 70;

const RIB_SB = RIB_DA;
const RIB_SC = RIB_SB + RIB_DB;
const RIB_SD = RIB_SC + RIB_DC;
const RIB_SE = RIB_SD + RIB_DD;
const RIB_SF = RIB_SE + RIB_DE;
const RIB_SG = RIB_SF + RIB_DF;
const RIB_CYCLE = RIB_SG + RIB_DG; // 500

const RIB_SPD_SLOW = 70;
const RIB_SPD_MED  = 130;
const RIB_SPD_FAST = 200;
const RIB_SPD_PREP = 60;

// ─── OnStart ─────────────────────────────────────────────────────────────────
function OnStart() {
  tick = 0;

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

  rib1Tilt     = getChannel(ID_RIB1, 'tilt');
  rib1Speed    = getChannel(ID_RIB1, 'speed');
  rib1Dimmer   = getChannel(ID_RIB1, 'dimmer');
  rib1Function = getChannel(ID_RIB1, 'function');
  rib1Leds   = [];
  for (let i = 1; i <= 8; i++) rib1Leds.push(getChannel(ID_RIB1, 'led_' + i));

  rib2Tilt     = getChannel(ID_RIB2, 'tilt');
  rib2Speed    = getChannel(ID_RIB2, 'speed');
  rib2Dimmer   = getChannel(ID_RIB2, 'dimmer');
  rib2Function = getChannel(ID_RIB2, 'function');
  rib2Leds   = [];
  for (let i = 1; i <= 8; i++) rib2Leds.push(getChannel(ID_RIB2, 'led_' + i));

  if (mh1ColorWheel !== null) { SetChannel(mh1ColorWheel, 1); SetChannel(mh1ColorWheel, 0); }
  if (mh2ColorWheel !== null) { SetChannel(mh2ColorWheel, 1); SetChannel(mh2ColorWheel, 0); }

  mp_resolveParLeds();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Retorna { pan, tilt, spd } para os dois MHs (posição-base compartilhada).
// No OnExecute: MH1 recebe pan-GAP e MH2 recebe pan+GAP — mesma direção, separação fixa.
function mhStateForPhase(phase) {
  // F0: lento — pan L→R abrindo, tilt desce altar→chão (150t, spd=20)
  if (phase < MH_S1) {
    const t = phase / MH_D0;
    return { pan: lerp(MP_M1.PAN_L, MP_M1.PAN_R, t), tilt: lerp(MP_M1.TILT_A, MP_M1.TILT_FLOOR, t), spd: 20 };
  }
  // F1: médio — varrida R→L, tilt sobe chão→mid (130t, spd=55)
  if (phase < MH_S2) {
    const t = (phase - MH_S1) / MH_D1;
    return { pan: lerp(MP_M1.PAN_R, MP_M1.PAN_L, t), tilt: lerp(MP_M1.TILT_FLOOR, MP_M1.TILT_MID, t), spd: 55 };
  }
  // F2: rápido — pan L→CENTER, tilt MID→FLOOR (60t, spd=130)
  if (phase < MH_S3) {
    const t = (phase - MH_S2) / MH_D2;
    return { pan: lerp(MP_M1.PAN_L, MP_M1.PAN_C, t), tilt: lerp(MP_M1.TILT_MID, MP_M1.TILT_FLOOR, t), spd: 130 };
  }
  // F3: rápido — pan CENTER→R, tilt FLOOR→MID (80t, spd=130)
  if (phase < MH_S4) {
    const t = (phase - MH_S3) / MH_D3;
    return { pan: lerp(MP_M1.PAN_C, MP_M1.PAN_R, t), tilt: lerp(MP_M1.TILT_FLOOR, MP_M1.TILT_MID, t), spd: 130 };
  }
  // F4: parada em ponto forte — pan=R, tilt=MID (50t, spd=25)
  if (phase < MH_S5) {
    return { pan: MP_M1.PAN_R, tilt: MP_M1.TILT_MID, spd: 25 };
  }
  // F5: dramático — pan R→L lento, tilt=FLOOR (120t, spd=30)
  if (phase < MH_S6) {
    const t = (phase - MH_S5) / MH_D5;
    return { pan: lerp(MP_M1.PAN_R, MP_M1.PAN_L, t), tilt: MP_M1.TILT_FLOOR, spd: 30 };
  }
  // F6: subida — pan L→CENTER, tilt sobe FLOOR→altar (80t, spd=45)
  if (phase < MH_S7) {
    const t = (phase - MH_S6) / MH_D6;
    return { pan: lerp(MP_M1.PAN_L, MP_M1.PAN_C, t), tilt: lerp(MP_M1.TILT_FLOOR, MP_M1.TILT_A, t), spd: 45 };
  }
  // F7: final rápido — pan CENTER→R, tilt=altar (50t, spd=120)
  const t = (phase - MH_S7) / MH_D7;
  return { pan: lerp(MP_M1.PAN_C, MP_M1.PAN_R, t), tilt: MP_M1.TILT_A, spd: 120 };
}

// Retorna { tilt, spd } para as ribaltas (as duas usam a mesma posição e speed).
function ribStateForPhase(phase) {
  // FA: subida lenta LOW→HIGH (100t, spd=70)
  if (phase < RIB_SB) {
    const t = phase / RIB_DA;
    return { tilt: lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, t), spd: RIB_SPD_SLOW };
  }
  // FB: pausa em HIGH (50t, spd=70)
  if (phase < RIB_SC) {
    return { tilt: MP_RIB.TILT_HIGH, spd: RIB_SPD_SLOW };
  }
  // FC: descida rápida HIGH→LOW (70t, spd=200)
  if (phase < RIB_SD) {
    const t = (phase - RIB_SC) / RIB_DC;
    return { tilt: lerp(MP_RIB.TILT_HIGH, MP_RIB.TILT_LOW, t), spd: RIB_SPD_FAST };
  }
  // FD: pausa em LOW (50t, spd=200)
  if (phase < RIB_SE) {
    return { tilt: MP_RIB.TILT_LOW, spd: RIB_SPD_FAST };
  }
  // FE: subida média LOW→HIGH (100t, spd=130)
  if (phase < RIB_SF) {
    const t = (phase - RIB_SE) / RIB_DE;
    return { tilt: lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, t), spd: RIB_SPD_MED };
  }
  // FF: descida rápida HIGH→LOW (60t, spd=200)
  if (phase < RIB_SG) {
    const t = (phase - RIB_SF) / RIB_DF;
    return { tilt: lerp(MP_RIB.TILT_HIGH, MP_RIB.TILT_LOW, t), spd: RIB_SPD_FAST };
  }
  // FG: pausa em LOW + preparação lenta (70t, spd=60)
  return { tilt: MP_RIB.TILT_LOW, spd: RIB_SPD_PREP };
}

// ─── OnExecute ───────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;

  mp_applyParLeds();

  // ── Moving Heads — sincronizados na mesma direção ────────────────────────────
  const mhPhase = tick % MH_CYCLE;
  const mh = mhStateForPhase(mhPhase);

  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      255);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      mh.spd);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        mh.pan - MP_MH_GAP);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       mh.tilt);

  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      255);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      mh.spd);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        mh.pan + MP_MH_GAP);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       mh.tilt);

  // ── Ribaltas — par sincronizado (function → speed → tilt) ──
  const ribPhase = tick % RIB_CYCLE;
  const rib = ribStateForPhase(ribPhase);

  mp_applyRibaltaPair(
    rib1Function, rib2Function,
    rib1Speed, rib2Speed,
    rib1Tilt, rib2Tilt,
    rib.spd,
    rib.tilt
  );
  if (rib1Dimmer !== null) SetChannel(rib1Dimmer, MP_RIB.DIM_WASH);
  for (let i = 0; i < rib1Leds.length; i++) {
    if (rib1Leds[i] !== null) SetChannel(rib1Leds[i], 255);
  }

  if (rib2Dimmer !== null) SetChannel(rib2Dimmer, MP_RIB.DIM_WASH);
  for (let i = 0; i < rib2Leds.length; i++) {
    if (rib2Leds[i] !== null) SetChannel(rib2Leds[i], 255);
  }
}

// ─── OnTerminate ─────────────────────────────────────────────────────────────
function OnTerminate() {
  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      0);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     0);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MP_M1.PAN_L);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       MP_M1.TILT_MID);
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      0);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     0);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MP_M2.PAN_L);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MP_M2.TILT_MID);
  mp_zeroRibaltaPair(rib1Function, rib2Function, rib1Speed, rib2Speed, rib1Tilt, rib2Tilt, MP_RIB.TILT_LOW);
  if (rib1Dimmer !== null) SetChannel(rib1Dimmer, 0);
  for (let i = 0; i < rib1Leds.length; i++) {
    if (rib1Leds[i] !== null) SetChannel(rib1Leds[i], 0);
  }
  if (rib2Dimmer !== null) SetChannel(rib2Dimmer, 0);
  for (let i = 0; i < rib2Leds.length; i++) {
    if (rib2Leds[i] !== null) SetChannel(rib2Leds[i], 0);
  }

  mp_zeroParLeds();
}
