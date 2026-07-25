// respiracao-lenta — Moving heads em "respiração": dimmer em fade in/out suave tipo
// seno lento + deriva de pan/tilt bem devagar. Ribalta em par com tilt subindo/descendo
// bem devagar sincronizado com a respiração, fita também em fade lento.
// Sem strobo — fecho/dimmer aberto contínuo, o movimento e o brilho são o efeito.
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

const BREATH_PERIOD = 300; // ~12s por ciclo completo de respiração
const DIM_MIN = 0.18;
const DIM_MAX = 1.0;

const DRIFT_PAN_PERIOD  = 460; // deriva de pan bem devagar
const DRIFT_TILT_PERIOD = 520; // defasado do pan — movimento menos robótico
const DRIFT_PAN_AMPL = 6;

const MH_SPEED = 0.88; // 0=rápido, 1=lento — bem devagar

const FITA_MIN = 40;
const FITA_MAX = 255;

let tick = 0;
let r1Tilt, r1Speed, r1Function, r1Strobo, r1Dimmer, r1Leds;
let r2Tilt, r2Speed, r2Function, r2Strobo, r2Dimmer, r2Leds;
let fita;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}
function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 119; // fase inicial deslocada — ribalta/respiração já começam mais "cheias" em vez
  // de sempre nascerem no meio do ciclo (evita o mesmo ponto de partida repetido entre os
  // scripts "-lenta")

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

  const breath = wave01(tick, BREATH_PERIOD);

  // Movings — respiração no dimmer + deriva lenta de pan/tilt.
  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, lerp(DIM_MIN, DIM_MAX, breath));
  adapter.setDimmer(MH2, lerp(DIM_MIN, DIM_MAX, breath));
  adapter.setMovementSpeed(MH1, MH_SPEED);
  adapter.setMovementSpeed(MH2, MH_SPEED);

  const panT  = wave01(tick, DRIFT_PAN_PERIOD);
  const tiltT = wave01(tick, DRIFT_TILT_PERIOD);
  const panDrift = (panT - 0.5) * 2 * DRIFT_PAN_AMPL;
  adapter.setPanTilt(MH1, {
    pan: MP_M1.PAN_C - MP_MH_GAP + panDrift,
    tilt: lerp(MP_M1.TILT_F, MP_M1.TILT_MID, tiltT),
  });
  adapter.setPanTilt(MH2, {
    pan: MP_M2.PAN_C + MP_MH_GAP + panDrift,
    tilt: lerp(MP_M2.TILT_F, MP_M2.TILT_MID, tiltT),
  });

  // Shutter aberto sem estrobo — não há valor "aberto" nomeado na capability strobe.
  const s1 = getChannel(MH1, 'strobo');
  const s2 = getChannel(MH2, 'strobo');
  ch(s1, 255);
  ch(s2, 255);

  // Ribalta em par — tilt sobe/desce devagar, sincronizado com a mesma respiração.
  const ribTilt = lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, breath);
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_SLOW); ch(r2Speed, MP_RIB.SPEED_SLOW);
  ch(r1Tilt, ribTilt); ch(r2Tilt, ribTilt);
  ch(r1Dimmer, MP_RIB.DIM_ON); ch(r2Dimmer, MP_RIB.DIM_ON);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Fita — fade lento acompanhando a mesma respiração.
  ch(fita, lerp(FITA_MIN, FITA_MAX, breath));
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
