// altar-lenta — MHs apontados em direção ao altar (TILT_A de cada um) com deriva
// de pan bem sutil e lenta; ribalta em par recua devagar de TILT_ALTAR (145)
// até TILT_LOW (100) e respira suavemente ali; fita em fade lento. Clima sóbrio/contemplativo.
// Perfil LENTO (trecho calmo da música) — sem strobo, fecho/dimmer aberto contínuo.
// Standalone (não usa mov-preset.js) — constantes físicas copiadas do briefing.
const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const R1   = 'fixture_1780805067518_ribalta_1';
const R2   = 'fixture_1780805067518_ribalta_2';
const FITA = 'fixture_1780805067518_fita_led';

const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_RIB = { TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170, DIM_ON: 255, DIM_WASH: 220 };

const MH_SPEED_FRAC = 0.85; // lento
const PAN_DRIFT_AMPLITUDE = 6; // sutil
const PAN_DRIFT_PERIOD = 500; // ~20s

const RIB_WARMUP_TICKS = 75; // ~3s apagada posicionando em TILT_ALTAR — esconde o motor viajando
// de onde a ribalta estava até lá, só acende quando já está no lugar
const RIB_APPROACH_TICKS = 250; // ~10s recuando devagar do altar até TILT_LOW, sem voltar
const RIB_HOLD_TICKS = 100; // ~4s parada em TILT_LOW antes de reiniciar o ciclo (loop)
const RIB_CYCLE_TICKS = RIB_WARMUP_TICKS + RIB_APPROACH_TICKS + RIB_HOLD_TICKS;

const FITA_MIN = 40;
const FITA_MAX = 200;
const FITA_PERIOD = 560;

let tick = 0;
let r1Tilt, r1Speed, r1Function, r1Strobo, r2Tilt, r2Speed, r2Function, r2Strobo;
let r1Dimmer, r2Dimmer, mh1Strobo, mh2Strobo, fita;
let r1Leds, r2Leds;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

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

  // Deriva de pan bem sutil em torno do centro; tilt fixo apontando pro altar.
  const drift = (wave01(tick, PAN_DRIFT_PERIOD) - 0.5) * 2 * PAN_DRIFT_AMPLITUDE;
  adapter.setPanTilt(MH1, { pan: MP_M1.PAN_C + drift, tilt: MP_M1.TILT_A });
  adapter.setPanTilt(MH2, { pan: MP_M2.PAN_C + drift, tilt: MP_M2.TILT_A });

  // Shutter aberto contínuo — sem estrobo (perfil lento).
  ch(mh1Strobo, 255);
  ch(mh2Strobo, 255);

  // Ribalta: primeiro fica apagada (~3s) se posicionando em TILT_ALTAR — esconde o motor
  // viajando de onde estava até lá. Depois acende e recua num único movimento contínuo até
  // TILT_LOW, segura ali (~4s) e reinicia o ciclo do zero (loop contínuo).
  const cycleTick = tick % RIB_CYCLE_TICKS;
  const ribWarmingUp = cycleTick <= RIB_WARMUP_TICKS;
  const ribTick = Math.max(0, cycleTick - RIB_WARMUP_TICKS);
  const approachT = smoothstep(Math.min(ribTick, RIB_APPROACH_TICKS) / RIB_APPROACH_TICKS);
  const ribTilt = lerp(MP_RIB.TILT_ALTAR, MP_RIB.TILT_LOW, approachT);
  const ribLevel = ribWarmingUp ? 0 : 255;

  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_SLOW); ch(r2Speed, MP_RIB.SPEED_SLOW);
  ch(r1Tilt, ribTilt); ch(r2Tilt, ribTilt);
  ch(r1Dimmer, ribWarmingUp ? 0 : MP_RIB.DIM_ON); ch(r2Dimmer, ribWarmingUp ? 0 : MP_RIB.DIM_ON);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of r1Leds) ch(c, ribLevel);
  for (const c of r2Leds) ch(c, ribLevel);

  // Fita — fade lento.
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
