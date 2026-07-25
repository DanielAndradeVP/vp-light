// nevoa-lenta — MHs com frost ligado (feixe suavizado), movimento bem lento e
// amplo de pan/tilt, cor num crossfade bem lento entre tons calmos; fita constante baixa.
// Perfil LENTO (trecho calmo da música) — sem strobo, fecho/dimmer aberto contínuo.
// Standalone (não usa mov-preset.js) — constantes físicas copiadas do briefing.
const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const FITA = 'fixture_1780805067518_fita_led';

const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;

// Crossfade bem lento entre tons calmos (aproximação discreta — não há mixagem
// contínua de cor no color_wheel, só posições fixas).
const CORES = ['white', 'blue_light', 'purple_light'];
const COLOR_STAGE_TICKS = 380; // ~15.2s por cor

const MH_SPEED_FRAC = 0.92; // bem lento
const PAN_SWEEP_PERIOD = 700;  // ~28s — amplo
const TILT_SWEEP_PERIOD = 640; // defasado do pan

const FITA_BAIXA = 70; // constante baixa, sem fade

let tick = 0;
let mh1Strobo, mh2Strobo, mh1Frost, mh2Frost, fita;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 343; // fase inicial deslocada — evita o mesmo ponto de partida repetido entre os
  // scripts "-lenta"

  mh1Strobo = getChannel(MH1, 'strobo');
  mh2Strobo = getChannel(MH2, 'strobo');
  mh1Frost = getChannel(MH1, 'frost');
  mh2Frost = getChannel(MH2, 'frost');

  fita = getChannel(FITA, 'dimmer');
}

function OnExecute() {
  tick++;

  const stage = Math.floor((tick % (CORES.length * COLOR_STAGE_TICKS)) / COLOR_STAGE_TICKS);
  adapter.setColor(MH1, CORES[stage]);
  adapter.setColor(MH2, CORES[stage]);
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, MH_SPEED_FRAC);
  adapter.setMovementSpeed(MH2, MH_SPEED_FRAC);
  adapter.setFrost(MH1, 'ligado');
  adapter.setFrost(MH2, 'ligado');

  // Movimento lento e amplo — cobre o curso físico inteiro de pan/tilt.
  const panT = wave01(tick, PAN_SWEEP_PERIOD);
  const tiltT = wave01(tick, TILT_SWEEP_PERIOD);
  adapter.setPanTilt(MH1, {
    pan: lerp(MP_M1.PAN_L, MP_M1.PAN_R, panT) - MP_MH_GAP,
    tilt: lerp(MP_M1.TILT_F, MP_M1.TILT_FLOOR, tiltT),
  });
  adapter.setPanTilt(MH2, {
    pan: lerp(MP_M2.PAN_L, MP_M2.PAN_R, panT) + MP_MH_GAP,
    tilt: lerp(MP_M2.TILT_F, MP_M2.TILT_FLOOR, tiltT),
  });

  ch(mh1Strobo, 255);
  ch(mh2Strobo, 255);

  // Fita — constante baixa (sem fade nesta atmosfera).
  ch(fita, FITA_BAIXA);
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
  adapter.setPanTilt(MH1, { pan: MP_M1.PAN_C, tilt: MP_M1.TILT_MID });
  adapter.setPanTilt(MH2, { pan: MP_M2.PAN_C, tilt: MP_M2.TILT_MID });

  ch(mh1Strobo, 0);
  ch(mh2Strobo, 0);
  ch(mh1Frost, 0);
  ch(mh2Frost, 0);

  ch(fita, 0);
}
