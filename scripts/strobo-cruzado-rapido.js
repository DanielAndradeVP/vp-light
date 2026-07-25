// strobo-cruzado-rapido — Movings em cruzado rápido (MH1 vai enquanto MH2 volta),
// cor trocando rápido entre as cores comuns, ribalta em par com strobo alto e tilt
// oscilando rápido, fita piscando/pulsando.
// Standalone (não usa mov-preset.js).
const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const R1   = 'fixture_1780805067518_ribalta_1';
const R2   = 'fixture_1780805067518_ribalta_2';
const FITA = 'fixture_1780805067518_fita_led';

// Constantes físicas calibradas do rig (copiadas de mov-preset.js).
const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;
const MP_RIB = { TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170, DIM_ON: 255, DIM_WASH: 220 };

// Cores comuns entre MH1 e MH2 (conferido em shows/vp.show.json > adapters.color).
const CORES = ['white', 'red', 'green', 'yellow', 'blue_light', 'purple_light'];
const COLOR_TICKS = 8;                       // ~320ms por cor — troca rápida
const COLOR_CYCLE = CORES.length * COLOR_TICKS;

const MH_CROSS_PERIOD = 55;                  // ~2.2s por curso — cruzado rápido
const RIB_TILT_PERIOD = 35;                  // ~1.4s — tilt oscila mais rápido que o pan dos MH
const RIB_STROBO = 235;                      // strobo alto (rápido) na ribalta

const FITA_ON_TICKS  = 3;
const FITA_OFF_TICKS = 3;
const FITA_CYCLE = FITA_ON_TICKS + FITA_OFF_TICKS;

let tick = 0;
let mh1Pan, mh1Tilt;
let mh2Pan, mh2Tilt;
let r1Tilt, r1Speed, r1Function, r1Strobo, r1Dimmer, r1Leds;
let r2Tilt, r2Speed, r2Function, r2Strobo, r2Dimmer, r2Leds;
let fita;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}
function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 0;

  mh1Pan  = getChannel(MH1, 'pan');
  mh1Tilt = getChannel(MH1, 'tilt');
  mh2Pan  = getChannel(MH2, 'pan');
  mh2Tilt = getChannel(MH2, 'tilt');

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

  // Movings — cruzado: MH1 varre L→R enquanto MH2 varre R→L (espelho oposto).
  const t = wave01(tick, MH_CROSS_PERIOD);
  const pan1  = lerp(MP_M1.PAN_L, MP_M1.PAN_R, t) - MP_MH_GAP;
  const pan2  = lerp(MP_M2.PAN_R, MP_M2.PAN_L, t) + MP_MH_GAP;
  const tilt1 = lerp(MP_M1.TILT_F, MP_M1.TILT_A, t);
  const tilt2 = lerp(MP_M2.TILT_A, MP_M2.TILT_F, t);

  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
  adapter.setStrobe(MH1, 'extra_rapido');
  adapter.setStrobe(MH2, 'extra_rapido');
  ch(mh1Pan, pan1);
  ch(mh1Tilt, tilt1);
  ch(mh2Pan, pan2);
  ch(mh2Tilt, tilt2);

  const stage = Math.floor((tick % COLOR_CYCLE) / COLOR_TICKS);
  const cor = CORES[stage];
  adapter.setColor(MH1, cor);
  adapter.setColor(MH2, cor);

  // Ribalta em par — strobo alto, tilt oscilando rápido.
  const ribTilt = lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, wave01(tick, RIB_TILT_PERIOD));
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_FAST); ch(r2Speed, MP_RIB.SPEED_FAST);
  ch(r1Tilt, ribTilt); ch(r2Tilt, ribTilt);
  ch(r1Dimmer, MP_RIB.DIM_ON); ch(r2Dimmer, MP_RIB.DIM_ON);
  ch(r1Strobo, RIB_STROBO); ch(r2Strobo, RIB_STROBO);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Fita — pulso rápido on/off.
  const fitaPhase = tick % FITA_CYCLE;
  ch(fita, fitaPhase < FITA_ON_TICKS ? 255 : 0);
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
