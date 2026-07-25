// horizonte-lenta — Moving heads em varredura horizontal lenta e constante numa altura de
// tilt fixa (tipo "nascer do sol"). Fita em fade lento subindo/descendo em fase com o sweep.
// Perfil LENTO (trecho calmo) — sem strobo, fecho/dimmer aberto contínuo.
// Standalone (não usa mov-preset.js) — arquivo não começa com "mov-".

const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const FITA = 'fixture_1780805067518_fita_led';

// Constantes físicas calibradas do rig (copiadas de mov-preset.js).
const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;

// Ciclo longo — varredura horizontal completa (esquerda-direita-esquerda).
const SWEEP_PERIOD = 400; // 16s
const MH_SPEED_SLOW = 215; // raw virtual_speed — bem lento, constante

// Altura de tilt fixa ("horizonte") — ponto médio entre frente e ponta-altar de cada beam.
const HORIZON_TILT_1 = MP_M1.TILT_MID;
const HORIZON_TILT_2 = MP_M2.TILT_MID;

// Cores em comum nos dois beams — trocas espaçadas evocando aquecimento do "nascer do sol".
const CORES = ['white', 'yellow'];
const COR_STAGE_TICKS = SWEEP_PERIOD / 2;

let tick = 0;

let mh1Pan, mh1PanFine, mh1Tilt, mh1Speed, mh1Fecho, mh1Strobo;
let mh2Pan, mh2PanFine, mh2Tilt, mh2Speed, mh2Fecho, mh2Strobo;

let fitaDimmer;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 250; // fase inicial deslocada — evita o mesmo ponto de partida repetido entre os
  // scripts "-lenta"

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

  fitaDimmer = getChannel(FITA, 'dimmer');
}

function OnExecute() {
  tick++;

  const p = wave01(tick, SWEEP_PERIOD);

  // Varredura horizontal na altura fixa do "horizonte" — mesma fase nos dois (sincronizados).
  const pan1 = lerp(MP_M1.PAN_L, MP_M1.PAN_R, p) - MP_MH_GAP;
  const pan2 = lerp(MP_M2.PAN_L, MP_M2.PAN_R, p) + MP_MH_GAP;

  ch(mh1Pan, pan1); ch(mh1PanFine, 0); ch(mh1Tilt, HORIZON_TILT_1);
  ch(mh2Pan, pan2); ch(mh2PanFine, 0); ch(mh2Tilt, HORIZON_TILT_2);

  ch(mh1Speed, MH_SPEED_SLOW);
  ch(mh2Speed, MH_SPEED_SLOW);

  // Fecho aberto contínuo, sem estrobo — perfil lento.
  ch(mh1Fecho, 255); ch(mh1Strobo, 255);
  ch(mh2Fecho, 255); ch(mh2Strobo, 255);

  const corStage = Math.floor(tick / COR_STAGE_TICKS) % CORES.length;
  adapter.setColor(MH1, CORES[corStage]);
  adapter.setColor(MH2, CORES[corStage]);

  // Fita — fade lento subindo/descendo em fase com o sweep.
  ch(fitaDimmer, lerp(50, 230, p));
}

function OnTerminate() {
  ch(mh1Fecho, 0); ch(mh1Strobo, 0); ch(mh1Speed, 0); ch(mh1PanFine, 0);
  ch(mh2Fecho, 0); ch(mh2Strobo, 0); ch(mh2Speed, 0); ch(mh2PanFine, 0);
  ch(mh1Tilt, MP_M1.TILT_MID); ch(mh1Pan, MP_M1.PAN_C);
  ch(mh2Tilt, MP_M2.TILT_MID); ch(mh2Pan, MP_M2.PAN_C);

  ch(fitaDimmer, 0);
}
