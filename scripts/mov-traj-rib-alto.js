// mov-traj-rib-alto — Trajetória 8 fases MH.
// Preset: mov-preset.js

// ─── IDs de fixture ───────────────────────────────────────────────────────────
const ID_MH1  = 'fixture_1780805067518_moving_head_beam_1';
const ID_MH2  = 'fixture_1780805067518_moving_head_beam_2';

// ─── Canais resolvidos ────────────────────────────────────────────────────────
let mh1Fecho, mh1Strobo, mh1ColorWheel, mh1Pan, mh1PanFine, mh1Tilt, mh1Speed;
let mh2Fecho, mh2Strobo, mh2ColorWheel, mh2Pan, mh2PanFine, mh2Tilt, mh2Speed;

let tick = 0;

// Ciclo de 8 fases — 720 ticks (~28.8s)
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

// virtual_speed: maior = mais lento (referência mov-traj-mh-rib)
const MH_SPD_F0 = 205;
const MH_SPD_F1 = 190;
const MH_SPD_F2 = 165;
const MH_SPD_F3 = 180;
const MH_SPD_F4 = 220;
const MH_SPD_F5 = 175;
const MH_SPD_F6 = 155;
const MH_SPD_F7 = 148;

const WARMUP_TICKS = 50; // ~2s — posiciona no início da F0 sem luz, motor lento
let runPhase = 'warmup';
let warmupTick = 0;

// ─── OnStart ─────────────────────────────────────────────────────────────────
function OnStart() {
  tick = 0;
  runPhase = 'warmup';
  warmupTick = 0;

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

  if (mh1ColorWheel !== null) { SetChannel(mh1ColorWheel, 1); SetChannel(mh1ColorWheel, 0); }
  if (mh2ColorWheel !== null) { SetChannel(mh2ColorWheel, 1); SetChannel(mh2ColorWheel, 0); }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function mhStateForPhase(phase) {
  if (phase < MH_S1) {
    const t = phase / MH_D0;
    return { pan: lerp(MP_M1.PAN_L, MP_M1.PAN_R, t), tilt: lerp(MP_M1.TILT_A, MP_M1.TILT_FLOOR, t), spd: MH_SPD_F0 };
  }
  if (phase < MH_S2) {
    const t = (phase - MH_S1) / MH_D1;
    return { pan: lerp(MP_M1.PAN_R, MP_M1.PAN_L, t), tilt: lerp(MP_M1.TILT_FLOOR, MP_M1.TILT_MID, t), spd: MH_SPD_F1 };
  }
  if (phase < MH_S3) {
    const t = (phase - MH_S2) / MH_D2;
    return { pan: lerp(MP_M1.PAN_L, MP_M1.PAN_C, t), tilt: lerp(MP_M1.TILT_MID, MP_M1.TILT_FLOOR, t), spd: MH_SPD_F2 };
  }
  if (phase < MH_S4) {
    const t = (phase - MH_S3) / MH_D3;
    return { pan: lerp(MP_M1.PAN_C, MP_M1.PAN_R, t), tilt: lerp(MP_M1.TILT_FLOOR, MP_M1.TILT_MID, t), spd: MH_SPD_F3 };
  }
  if (phase < MH_S5) {
    return { pan: MP_M1.PAN_R, tilt: MP_M1.TILT_MID, spd: MH_SPD_F4 };
  }
  if (phase < MH_S6) {
    const t = (phase - MH_S5) / MH_D5;
    return { pan: lerp(MP_M1.PAN_R, MP_M1.PAN_L, t), tilt: MP_M1.TILT_FLOOR, spd: MH_SPD_F5 };
  }
  if (phase < MH_S7) {
    const t = (phase - MH_S6) / MH_D6;
    return { pan: lerp(MP_M1.PAN_L, MP_M1.PAN_C, t), tilt: lerp(MP_M1.TILT_FLOOR, MP_M1.TILT_A, t), spd: MH_SPD_F6 };
  }
  const t = (phase - MH_S7) / MH_D7;
  return { pan: lerp(MP_M1.PAN_C, MP_M1.PAN_R, t), tilt: MP_M1.TILT_A, spd: MH_SPD_F7 };
}

// ─── OnExecute ───────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;

  if (runPhase === 'warmup') {
    warmupTick++;
    const start = mhStateForPhase(0);
    if (mh1Fecho      !== null) SetChannel(mh1Fecho,      0);
    if (mh1Strobo     !== null) SetChannel(mh1Strobo,     0);
    if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
    if (mh1Pan        !== null) SetChannel(mh1Pan,        start.pan - MP_MH_GAP);
    if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
    if (mh1Tilt       !== null) SetChannel(mh1Tilt,       start.tilt);
    if (mh1Speed      !== null) SetChannel(mh1Speed,      MP_MH_SPEED_SLOW);
    if (mh2Fecho      !== null) SetChannel(mh2Fecho,      0);
    if (mh2Strobo     !== null) SetChannel(mh2Strobo,     0);
    if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
    if (mh2Pan        !== null) SetChannel(mh2Pan,        start.pan + MP_MH_GAP);
    if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
    if (mh2Tilt       !== null) SetChannel(mh2Tilt,       start.tilt);
    if (mh2Speed      !== null) SetChannel(mh2Speed,      MP_MH_SPEED_SLOW);
    if (warmupTick >= WARMUP_TICKS) runPhase = 'run';
    return;
  }

  const mhPhase = tick % MH_CYCLE;
  const mh = mhStateForPhase(mhPhase);

  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      255);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        mh.pan - MP_MH_GAP);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       mh.tilt);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      mh.spd);

  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      255);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        mh.pan + MP_MH_GAP);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       mh.tilt);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      mh.spd);
}

// ─── OnTerminate ─────────────────────────────────────────────────────────────
function OnTerminate() {
  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      0);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     0);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MP_M1.PAN_L);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       MP_M1.TILT_MID);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      0);
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      0);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     0);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MP_M2.PAN_L);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MP_M2.TILT_MID);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      0);
}
