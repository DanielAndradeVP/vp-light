// varredura-lateral-rapido — Varredura horizontal ampla e rápida dos dois movings
// (extremos reais de pan/tilt, mesmo princípio das fases F0/F1 do mov-traj-rib-baixo),
// ribalta em par acompanhando com tilt subindo/descendo rápido + strobo, fita em pulso.
// Standalone (não usa mov-preset.js).
const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const R1   = 'fixture_1780805067518_ribalta_1';
const R2   = 'fixture_1780805067518_ribalta_2';
const FITA = 'fixture_1780805067518_fita_led';

const MP_MH_GAP = 8;
const MP_RIB = { TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170, DIM_ON: 255, DIM_WASH: 220 };

// Curso amplo — extremos reais do pan/tilt (não os pontos calibrados estreitos de MP_M1/MP_M2),
// mesmo princípio de mov-traj-rib-baixo.
const MH_X = { PAN_L: 0, PAN_R: 255, TILT_UP: 0, TILT_DN: 255 };

const SWEEP_PERIOD = 45;    // ~1.8s por curso completo de ida (rápido)
const MH_SPEED_RAW = 25;    // virtual_speed baixo = rápido

const RIB_STROBO = 220;

const FITA_ON_TICKS  = 4;
const FITA_OFF_TICKS = 4;
const FITA_CYCLE = FITA_ON_TICKS + FITA_OFF_TICKS;

let tick = 0;
let mh1Pan, mh1PanFine, mh1Tilt, mh1Speed, mh1Strobo;
let mh2Pan, mh2PanFine, mh2Tilt, mh2Speed, mh2Strobo;
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

  mh1Pan     = getChannel(MH1, 'pan');
  mh1PanFine = getChannel(MH1, 'pan_fine');
  mh1Tilt    = getChannel(MH1, 'tilt');
  mh1Speed   = getChannel(MH1, 'virtual_speed');
  mh1Strobo  = getChannel(MH1, 'strobo');

  mh2Pan     = getChannel(MH2, 'pan');
  mh2PanFine = getChannel(MH2, 'pan_fine');
  mh2Tilt    = getChannel(MH2, 'tilt');
  mh2Speed   = getChannel(MH2, 'virtual_speed');
  mh2Strobo  = getChannel(MH2, 'strobo');

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

  // Movings — varredura lateral ampla, MH1 e MH2 sempre juntos (mesmo t, gap fixo).
  const t = wave01(tick, SWEEP_PERIOD);
  const pan  = lerp(MH_X.PAN_L, MH_X.PAN_R, t);
  const tilt = lerp(MH_X.TILT_UP, MH_X.TILT_DN, t);

  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  ch(mh1Speed, MH_SPEED_RAW);
  ch(mh2Speed, MH_SPEED_RAW);
  ch(mh1Strobo, 255); // aberto/sem estrobo — não há valor "aberto" nomeado
  ch(mh2Strobo, 255);
  ch(mh1Pan, pan - MP_MH_GAP);
  ch(mh1PanFine, 0);
  ch(mh1Tilt, tilt);
  ch(mh2Pan, pan + MP_MH_GAP);
  ch(mh2PanFine, 0);
  ch(mh2Tilt, tilt);

  // Ribalta em par — tilt acompanha o mesmo progresso da varredura, rápido, com strobo.
  const ribTilt = lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, t);
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, MP_RIB.SPEED_FAST); ch(r2Speed, MP_RIB.SPEED_FAST);
  ch(r1Tilt, ribTilt); ch(r2Tilt, ribTilt);
  ch(r1Dimmer, MP_RIB.DIM_ON); ch(r2Dimmer, MP_RIB.DIM_ON);
  ch(r1Strobo, RIB_STROBO); ch(r2Strobo, RIB_STROBO);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Fita — pulso acompanhando o ritmo rápido.
  const fitaPhase = tick % FITA_CYCLE;
  ch(fita, fitaPhase < FITA_ON_TICKS ? 255 : 0);
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  ch(mh1Speed, 0); ch(mh2Speed, 0);
  ch(mh1Strobo, 0); ch(mh2Strobo, 0);
  ch(mh1Pan, MH_X.PAN_L); ch(mh1PanFine, 0); ch(mh1Tilt, 128);
  ch(mh2Pan, MH_X.PAN_L); ch(mh2PanFine, 0); ch(mh2Tilt, 128);

  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Speed, 0); ch(r2Speed, 0);
  ch(r1Tilt, MP_RIB.TILT_LOW); ch(r2Tilt, MP_RIB.TILT_LOW);
  ch(r1Dimmer, 0); ch(r2Dimmer, 0);
  ch(r1Strobo, 0); ch(r2Strobo, 0);
  for (const c of (r1Leds || [])) ch(c, 0);
  for (const c of (r2Leds || [])) ch(c, 0);

  ch(fita, 0);
}
