// flash-blackout-rapido — Efeito de flash/blackout: movings piscando fecho/dimmer
// on-off rápido junto com strobo, ribalta com strobo no máximo e dimmer piscando
// junto, fita piscando junto. O mais extremo dos rápidos.
// Standalone (não usa mov-preset.js).
const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const R1   = 'fixture_1780805067518_ribalta_1';
const R2   = 'fixture_1780805067518_ribalta_2';
const FITA = 'fixture_1780805067518_fita_led';

const MP_RIB = { TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170, DIM_ON: 255, DIM_WASH: 220 };

const FLASH_ON_TICKS  = 3; // 120ms aceso
const FLASH_OFF_TICKS = 3; // 120ms blackout total
const CYCLE = FLASH_ON_TICKS + FLASH_OFF_TICKS;

const RIB_TILT_FIXED = MP_RIB.TILT_ALTAR;

let tick = 0;
let mh1Strobo, mh2Strobo;
let r1Tilt, r1Speed, r1Function, r1Strobo, r1Dimmer, r1Leds;
let r2Tilt, r2Speed, r2Function, r2Strobo, r2Dimmer, r2Leds;
let fita;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function OnStart() {
  tick = 0;

  mh1Strobo = getChannel(MH1, 'strobo');
  mh2Strobo = getChannel(MH2, 'strobo');

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

  const flashing = (tick % CYCLE) < FLASH_ON_TICKS;

  // Movings — fecho/dimmer on-off rápido junto com strobo real no bloco aceso.
  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, flashing ? 1 : 0);
  adapter.setDimmer(MH2, flashing ? 1 : 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
  if (flashing) {
    adapter.setStrobe(MH1, 'extra_rapido');
    adapter.setStrobe(MH2, 'extra_rapido');
  } else {
    ch(mh1Strobo, 0);
    ch(mh2Strobo, 0);
  }

  // Ribalta em par — dimmer e strobo piscando juntos no máximo.
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_FAST); ch(r2Speed, MP_RIB.SPEED_FAST);
  ch(r1Tilt, RIB_TILT_FIXED); ch(r2Tilt, RIB_TILT_FIXED);
  ch(r1Dimmer, flashing ? 255 : 0); ch(r2Dimmer, flashing ? 255 : 0);
  ch(r1Strobo, flashing ? 255 : 0); ch(r2Strobo, flashing ? 255 : 0);
  for (const c of r1Leds) ch(c, flashing ? 255 : 0);
  for (const c of r2Leds) ch(c, flashing ? 255 : 0);

  // Fita — pisca junto com o mesmo bloco.
  ch(fita, flashing ? 255 : 0);
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
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
