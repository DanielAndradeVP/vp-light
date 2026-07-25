// deitado-lenta — MHs apontados mais pro chão (TILT_FLOOR de cada um) com
// varredura de pan bem lenta; ribalta em par com tilt baixo (perto de TILT_LOW)
// quase constante; fita em fade bem lento. Clima intimista/baixo.
// Perfil LENTO (trecho calmo da música) — sem strobo, fecho/dimmer aberto contínuo.
// Standalone (não usa mov-preset.js) — constantes físicas copiadas do briefing.
const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const R1   = 'fixture_1780805067518_ribalta_1';
const R2   = 'fixture_1780805067518_ribalta_2';
const FITA = 'fixture_1780805067518_fita_led';

const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;
const MP_RIB = { TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170, DIM_ON: 255, DIM_WASH: 220 };

const MH_SPEED_FRAC = 0.95; // o mais lento do lote — clima intimista
const PAN_SWEEP_PERIOD = 820; // ~32.8s, varredura bem lenta

const RIB_DRIFT_AMPLITUDE = 5; // "constante ou quase" — drift mínimo perto de TILT_LOW
const RIB_DRIFT_PERIOD = 600;

const FITA_MIN = 30;
const FITA_MAX = 150; // teto mais baixo — clima intimista/baixo
const FITA_PERIOD = 820; // fade bem lento, mais longo que os outros lentos

let tick = 0;
let r1Tilt, r1Speed, r1Function, r1Strobo, r2Tilt, r2Speed, r2Function, r2Strobo;
let r1Dimmer, r2Dimmer, mh1Strobo, mh2Strobo, fita;
let r1Leds, r2Leds;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 0;

  r1Tilt = getChannel(R1, 'tilt'); r1Speed = getChannel(R1, 'speed');
  r1Function = getChannel(R1, 'function'); r1Strobo = getChannel(R1, 'strobo');
  r1Dimmer = getChannel(R1, 'dimmer');
  r2Tilt = getChannel(R2, 'tilt'); r2Speed = getChannel(R2, 'speed');
  r2Function = getChannel(R2, 'function'); r2Strobo = getChannel(R2, 'strobo');
  r2Dimmer = getChannel(R2, 'dimmer');
  r1Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R1, 'led_' + n));
  r2Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R2, 'led_' + n));

  mh1Strobo = getChannel(MH1, 'strobo');
  mh2Strobo = getChannel(MH2, 'strobo');

  fita = getChannel(FITA, 'dimmer');
}

function OnExecute() {
  tick++;

  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, MH_SPEED_FRAC);
  adapter.setMovementSpeed(MH2, MH_SPEED_FRAC);

  // Tilt fixo apontando pro chão; pan varre bem devagar de um lado a outro.
  const panT = wave01(tick, PAN_SWEEP_PERIOD);
  adapter.setPanTilt(MH1, {
    pan: lerp(MP_M1.PAN_L, MP_M1.PAN_R, panT) - MP_MH_GAP,
    tilt: MP_M1.TILT_FLOOR,
  });
  adapter.setPanTilt(MH2, {
    pan: lerp(MP_M2.PAN_L, MP_M2.PAN_R, panT) + MP_MH_GAP,
    tilt: MP_M2.TILT_FLOOR,
  });

  ch(mh1Strobo, 255);
  ch(mh2Strobo, 255);

  // Ribalta: tilt quase constante perto de TILT_LOW, com drift mínimo.
  const ribTilt = MP_RIB.TILT_LOW + (wave01(tick, RIB_DRIFT_PERIOD) - 0.5) * 2 * RIB_DRIFT_AMPLITUDE;
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_SLOW); ch(r2Speed, MP_RIB.SPEED_SLOW);
  ch(r1Tilt, ribTilt); ch(r2Tilt, ribTilt);
  ch(r1Dimmer, MP_RIB.DIM_ON); ch(r2Dimmer, MP_RIB.DIM_ON);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Fita — fade bem lento, teto baixo (intimista).
  ch(fita, lerp(FITA_MIN, FITA_MAX, wave01(tick, FITA_PERIOD)));
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

  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, 0); ch(r2Speed, 0);
  ch(r1Tilt, MP_RIB.TILT_LOW); ch(r2Tilt, MP_RIB.TILT_LOW);
  ch(r1Dimmer, 0); ch(r2Dimmer, 0);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of (r1Leds || [])) ch(c, 0);
  for (const c of (r2Leds || [])) ch(c, 0);

  ch(fita, 0);
}
