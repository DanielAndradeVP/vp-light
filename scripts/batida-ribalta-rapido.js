// batida-ribalta-rapido — Foco na ribalta: par "batendo" tilt tipo bumbo (ataque rápido +
// decaimento) com strobo forte marcando. Moving heads fazem acompanhamento discreto (cor +
// movimento pequeno) pra não competir com a ribalta. Perfil RÁPIDO (trecho agitado).
// Standalone (não usa mov-preset.js) — arquivo não começa com "mov-".

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

// "Batida de bumbo" — ataque rápido, decaimento mais longo. Período curto (rápido).
const BEAT_PERIOD = 20; // 0.8s a 25fps
const BEAT_SHAPE = 0.28; // expoente < 1 => pico agudo e decaimento rápido (kick-like)

// Acompanhamento discreto dos movings — amplitude pequena, período moderado.
const MH_SWAY_PERIOD = 60; // 2.4s
const MH_SWAY_AMPLITUDE = 10; // graus DMX de excursão em torno do centro
const MH_SPEED_DISCRETO = 150; // raw virtual_speed — meio-termo, não chama atenção

// Cores em comum nos dois beams, troca espaçada (discreta).
const CORES = ['white', 'purple_light', 'blue_light'];
const COR_STAGE_TICKS = 100; // 4s por cor — bem mais lento que a batida da ribalta

let tick = 0;

let mh1Pan, mh1PanFine, mh1Tilt, mh1Speed, mh1Fecho, mh1Strobo;
let mh2Pan, mh2PanFine, mh2Tilt, mh2Speed, mh2Fecho, mh2Strobo;

let r1Tilt, r1Speed, r1Function, r1Strobo, r1Dimmer, r1Leds;
let r2Tilt, r2Speed, r2Function, r2Strobo, r2Dimmer, r2Leds;

let fitaDimmer;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }

function setRibaltaPair(tilt, speed, strobo, dimmer) {
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Tilt, tilt);  ch(r2Tilt, tilt);
  ch(r1Speed, speed); ch(r2Speed, speed);
  ch(r1Strobo, strobo); ch(r2Strobo, strobo);
  ch(r1Dimmer, dimmer); ch(r2Dimmer, dimmer);
}

function OnStart() {
  tick = 0;

  mh1Pan     = getChannel(MH1, 'pan');
  mh1PanFine = getChannel(MH1, 'pan_fine');
  mh1Tilt    = getChannel(MH1, 'tilt');
  mh1Speed   = getChannel(MH1, 'virtual_speed');
  mh1Fecho   = getChannel(MH1, 'fecho_lampada');
  mh1Strobo  = getChannel(MH1, 'strobo');

  mh2Pan     = getChannel(MH2, 'pan');
  mh2PanFine = getChannel(MH2, 'pan_fine');
  mh2Tilt    = getChannel(MH2, 'tilt');
  mh2Speed   = getChannel(MH2, 'virtual_speed');
  mh2Fecho   = getChannel(MH2, 'fecho_lampada');
  mh2Strobo  = getChannel(MH2, 'strobo');

  r1Tilt     = getChannel(R1, 'tilt');
  r1Speed    = getChannel(R1, 'speed');
  r1Function = getChannel(R1, 'function');
  r1Strobo   = getChannel(R1, 'strobo');
  r1Dimmer   = getChannel(R1, 'dimmer');
  r1Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R1, 'led_' + n));

  r2Tilt     = getChannel(R2, 'tilt');
  r2Speed    = getChannel(R2, 'speed');
  r2Function = getChannel(R2, 'function');
  r2Strobo   = getChannel(R2, 'strobo');
  r2Dimmer   = getChannel(R2, 'dimmer');
  r2Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R2, 'led_' + n));

  fitaDimmer = getChannel(FITA, 'dimmer');
}

function OnExecute() {
  tick++;

  // Ribalta em par — "batida" com pico agudo e decaimento (kick-like), sempre igual nas duas.
  const beatPhase = (tick % BEAT_PERIOD) / BEAT_PERIOD;
  const kick = Math.pow(Math.abs(Math.sin(Math.PI * beatPhase)), BEAT_SHAPE);
  const ribaltaTilt = lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, kick);
  setRibaltaPair(ribaltaTilt, MP_RIB.SPEED_FAST, 255, MP_RIB.DIM_ON);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Moving heads — acompanhamento discreto: sway pequeno de pan/tilt, sem competir com a ribalta.
  const swayT = (Math.sin((2 * Math.PI * tick) / MH_SWAY_PERIOD) + 1) / 2;
  const pan1 = MP_M1.PAN_C - MP_MH_GAP + lerp(-MH_SWAY_AMPLITUDE, MH_SWAY_AMPLITUDE, swayT);
  const pan2 = MP_M2.PAN_C + MP_MH_GAP + lerp(-MH_SWAY_AMPLITUDE, MH_SWAY_AMPLITUDE, swayT);
  const tilt1 = lerp(MP_M1.TILT_F, MP_M1.TILT_MID, swayT);
  const tilt2 = lerp(MP_M2.TILT_F, MP_M2.TILT_MID, swayT);

  ch(mh1Pan, pan1); ch(mh1PanFine, 0); ch(mh1Tilt, tilt1);
  ch(mh2Pan, pan2); ch(mh2PanFine, 0); ch(mh2Tilt, tilt2);

  ch(mh1Speed, MH_SPEED_DISCRETO);
  ch(mh2Speed, MH_SPEED_DISCRETO);

  ch(mh1Fecho, 255); ch(mh1Strobo, 255);
  ch(mh2Fecho, 255); ch(mh2Strobo, 255);

  const corStage = Math.floor(tick / COR_STAGE_TICKS) % CORES.length;
  adapter.setColor(MH1, CORES[corStage]);
  adapter.setColor(MH2, CORES[corStage]);

  // Fita — leve acompanhamento constante, sem competir com a ribalta.
  ch(fitaDimmer, 160);
}

function OnTerminate() {
  ch(mh1Fecho, 0); ch(mh1Strobo, 0); ch(mh1Speed, 0); ch(mh1PanFine, 0);
  ch(mh2Fecho, 0); ch(mh2Strobo, 0); ch(mh2Speed, 0); ch(mh2PanFine, 0);
  ch(mh1Tilt, MP_M1.TILT_MID); ch(mh1Pan, MP_M1.PAN_C);
  ch(mh2Tilt, MP_M2.TILT_MID); ch(mh2Pan, MP_M2.PAN_C);

  setRibaltaPair(MP_RIB.TILT_LOW, 0, 0, 0);
  for (const c of (r1Leds || [])) ch(c, 0);
  for (const c of (r2Leds || [])) ch(c, 0);

  ch(fitaDimmer, 0);
}
