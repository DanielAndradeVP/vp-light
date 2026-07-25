// deriva-cor-lenta — Crossfade lento entre cores (dwell longo em cada cor, sem troca
// brusca — a roda de cor é mecânica, então a "suavização" vem de um dip curto de
// dimmer em torno de cada troca) enquanto os movings fazem uma deriva de pan/tilt
// bem sutil e lenta. Ribalta em wash constante (tilt quase fixo, dimmer alto).
// Sem strobo — fecho/dimmer aberto contínuo.
// Standalone (não usa mov-preset.js).
const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const R1   = 'fixture_1780805067518_ribalta_1';
const R2   = 'fixture_1780805067518_ribalta_2';
const FITA = 'fixture_1780805067518_fita_led';

const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;
const MP_RIB = { TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170, DIM_ON: 255, DIM_WASH: 220 };

const CORES = ['white', 'red', 'green', 'yellow', 'blue_light', 'purple_light'];
const STAGE_TICKS = 300;       // ~12s de dwell por cor — bem lento
const CYCLE = CORES.length * STAGE_TICKS;
const TRANSITION_TICKS = 30;   // dip de dimmer em torno de cada troca (disfarça o clique da roda)
const DIM_FLOOR = 0.25;

const DRIFT_PAN_PERIOD  = 520;
const DRIFT_TILT_PERIOD = 610;
const DRIFT_PAN_AMPL  = 5;
const DRIFT_TILT_AMPL = 6;

const MH_SPEED = 0.92; // 0=rápido, 1=lento — deriva quase parada

const RIB_TILT_WASH = MP_RIB.TILT_LOUVOR; // quase fixo
const FITA_FADE_PERIOD = 400;
const FITA_MIN = 180;
const FITA_MAX = 230;

let tick = 0;
let r1Tilt, r1Speed, r1Function, r1Strobo, r1Dimmer, r1Leds;
let r2Tilt, r2Speed, r2Function, r2Strobo, r2Dimmer, r2Leds;
let fita;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}
function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function colorDimmerEnvelope(tickInStage) {
  const half = TRANSITION_TICKS / 2;
  if (tickInStage < half) return lerp(DIM_FLOOR, 1, tickInStage / half);
  if (tickInStage > STAGE_TICKS - half) return lerp(DIM_FLOOR, 1, (STAGE_TICKS - tickInStage) / half);
  return 1;
}

function OnStart() {
  tick = 0;

  r1Tilt     = getChannel(R1, 'tilt');
  r1Speed    = getChannel(R1, 'speed');
  r1Function = getChannel(R1, 'function');
  r1Strobo   = getChannel(R1, 'strobo');
  r1Dimmer   = getChannel(R1, 'dimmer');

  r2Tilt     = getChannel(R2, 'tilt');
  r2Speed    = getChannel(R2, 'speed');
  r2Function = getChannel(R2, 'function');
  r2Strobo   = getChannel(R2, 'strobo');
  r2Dimmer   = getChannel(R2, 'dimmer');
  r1Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R1, 'led_' + n));
  r2Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R2, 'led_' + n));

  fita = getChannel(FITA, 'dimmer');
}

function OnExecute() {
  tick++;

  const cyclePos = tick % CYCLE;
  const stage = Math.floor(cyclePos / STAGE_TICKS);
  const tickInStage = cyclePos % STAGE_TICKS;
  const cor = CORES[stage];
  const dim = colorDimmerEnvelope(tickInStage);

  // Movings — dwell longo por cor com dip de dimmer suavizando a troca da roda mecânica.
  adapter.setColor(MH1, cor);
  adapter.setColor(MH2, cor);
  adapter.setDimmer(MH1, dim);
  adapter.setDimmer(MH2, dim);
  adapter.setMovementSpeed(MH1, MH_SPEED);
  adapter.setMovementSpeed(MH2, MH_SPEED);

  // Deriva sutil e lenta de pan/tilt em torno do centro calibrado.
  const panT  = wave01(tick, DRIFT_PAN_PERIOD);
  const tiltT = wave01(tick, DRIFT_TILT_PERIOD);
  const panDrift  = (panT - 0.5) * 2 * DRIFT_PAN_AMPL;
  const tiltDrift = (tiltT - 0.5) * 2 * DRIFT_TILT_AMPL;
  adapter.setPanTilt(MH1, { pan: MP_M1.PAN_C - MP_MH_GAP + panDrift, tilt: MP_M1.TILT_F + tiltDrift });
  adapter.setPanTilt(MH2, { pan: MP_M2.PAN_C + MP_MH_GAP + panDrift, tilt: MP_M2.TILT_F + tiltDrift });

  // Shutter aberto sem estrobo.
  const s1 = getChannel(MH1, 'strobo');
  const s2 = getChannel(MH2, 'strobo');
  ch(s1, 255);
  ch(s2, 255);

  // Ribalta em par — wash constante: tilt quase fixo, dimmer alto, sem strobo.
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_SLOW); ch(r2Speed, MP_RIB.SPEED_SLOW);
  ch(r1Tilt, RIB_TILT_WASH); ch(r2Tilt, RIB_TILT_WASH);
  ch(r1Dimmer, MP_RIB.DIM_ON); ch(r2Dimmer, MP_RIB.DIM_ON);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Fita — quase constante, fade bem lento.
  ch(fita, lerp(FITA_MIN, FITA_MAX, wave01(tick, FITA_FADE_PERIOD)));
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
  const s1 = getChannel(MH1, 'strobo');
  const s2 = getChannel(MH2, 'strobo');
  ch(s1, 0);
  ch(s2, 0);

  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, 0); ch(r2Speed, 0);
  ch(r1Tilt, MP_RIB.TILT_LOW); ch(r2Tilt, MP_RIB.TILT_LOW);
  ch(r1Dimmer, 0); ch(r2Dimmer, 0);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of (r1Leds || [])) ch(c, 0);
  for (const c of (r2Leds || [])) ch(c, 0);

  ch(fita, 0);
}
