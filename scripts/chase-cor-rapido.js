// chase-cor-rapido — Troca de cor tipo "chase" nos dois movings, sincronizada com
// pequenos movimentos rápidos de pan/tilt (figura curta), ribalta com strobo
// marcando o "tempo" (liga/desliga em blocos de ticks).
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

// Bloco do "tempo": cor e strobo trocam juntos, marcando o mesmo pulso.
const BLOCK_TICKS = 10; // ~400ms por bloco
const COLOR_CYCLE = CORES.length * BLOCK_TICKS;

// Figura curta de pan/tilt em torno do centro — pequena amplitude, período curto.
const PAN_AMPL  = 12;
const TILT_AMPL = 10;
const FIGURE_PERIOD = BLOCK_TICKS * 2; // meio-giro por bloco de cor

const RIB_STROBO = 240;
const RIB_TILT_FIXED = MP_RIB.TILT_LOUVOR;

let tick = 0;
let r1Tilt, r1Speed, r1Function, r1Strobo, r1Dimmer, r1Leds;
let r2Tilt, r2Speed, r2Function, r2Strobo, r2Dimmer, r2Leds;
let fita;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

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

  // Chase de cor — troca em blocos de tempo fixos, igual nos dois movings.
  const stage = Math.floor((tick % COLOR_CYCLE) / BLOCK_TICKS);
  const cor = CORES[stage];
  adapter.setColor(MH1, cor);
  adapter.setColor(MH2, cor);
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);

  // Figura curta de pan/tilt — pequena oscilação em torno do centro calibrado.
  const panT  = wave01(tick, FIGURE_PERIOD);
  const tiltT = wave01(tick + FIGURE_PERIOD / 4, FIGURE_PERIOD);
  adapter.setPanTilt(MH1, {
    pan: MP_M1.PAN_C - MP_MH_GAP + (panT - 0.5) * 2 * PAN_AMPL,
    tilt: MP_M1.TILT_F + (tiltT - 0.5) * 2 * TILT_AMPL,
  });
  adapter.setPanTilt(MH2, {
    pan: MP_M2.PAN_C + MP_MH_GAP + (panT - 0.5) * 2 * PAN_AMPL,
    tilt: MP_M2.TILT_F + (tiltT - 0.5) * 2 * TILT_AMPL,
  });

  // Ribalta em par — tilt praticamente fixo, strobo liga/desliga em blocos marcando o tempo.
  const blockPhase = tick % (BLOCK_TICKS * 2);
  const striking = blockPhase < BLOCK_TICKS;
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_FAST); ch(r2Speed, MP_RIB.SPEED_FAST);
  ch(r1Tilt, RIB_TILT_FIXED); ch(r2Tilt, RIB_TILT_FIXED);
  ch(r1Dimmer, MP_RIB.DIM_ON); ch(r2Dimmer, MP_RIB.DIM_ON);
  ch(r1Strobo, striking ? RIB_STROBO : 0);
  ch(r2Strobo, striking ? RIB_STROBO : 0);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Fita — acompanha o mesmo bloco de tempo do strobo.
  ch(fita, striking ? 255 : 60);
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);

  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, 0); ch(r2Speed, 0);
  ch(r1Tilt, MP_RIB.TILT_LOW); ch(r2Tilt, MP_RIB.TILT_LOW);
  ch(r1Dimmer, 0); ch(r2Dimmer, 0);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of (r1Leds || [])) ch(c, 0);
  for (const c of (r2Leds || [])) ch(c, 0);

  ch(fita, 0);
}
