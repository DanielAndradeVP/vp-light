// dueto-lenta — Moving heads em trajetórias complementares: cruzam e se afastam ao longo
// do ciclo (não espelhadas iguais), mantendo o mesmo princípio de sincronismo de fases do
// mov-traj-rib-baixo, bem devagar. Fita em fade lento.
// Perfil LENTO (trecho calmo) — sem strobo, fecho/dimmer aberto contínuo.
// Standalone (não usa mov-preset.js) — arquivo não começa com "mov-".

const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const FITA = 'fixture_1780805067518_fita_led';

// Constantes físicas calibradas do rig (copiadas de mov-preset.js).
const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;

// Ciclos longos — perfil LENTO.
const PAN_PERIOD = 360;  // 14.4s — travessia completa de pan
const TILT_PERIOD = 300; // 12s — respiração de tilt, independente do pan

const MH_SPEED_SLOW = 210; // raw virtual_speed — alto = rastreio lento

// Cores em comum nos dois beams, trocas bem espaçadas.
const CORES = ['white', 'blue_light'];
const COR_STAGE_TICKS = 400; // ~16s por cor

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
  tick = 332; // fase inicial deslocada — evita o mesmo ponto de partida repetido entre os
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

  // Pan: MH1 varre L→R, MH2 varre R→L no mesmo instante — cruzam no meio do ciclo e se
  // afastam nos extremos (complementar, não espelhado igual).
  const panP = wave01(tick, PAN_PERIOD);
  const pan1 = lerp(MP_M1.PAN_L, MP_M1.PAN_R, panP) - MP_MH_GAP;
  const pan2 = lerp(MP_M2.PAN_R, MP_M2.PAN_L, panP) + MP_MH_GAP;

  // Tilt: MH1 desce enquanto MH2 sobe (fases opostas) — reforça o efeito de dueto.
  const tiltP = wave01(tick, TILT_PERIOD);
  const tilt1 = lerp(MP_M1.TILT_F, MP_M1.TILT_A, tiltP);
  const tilt2 = lerp(MP_M2.TILT_A, MP_M2.TILT_F, tiltP);

  ch(mh1Pan, pan1); ch(mh1PanFine, 0); ch(mh1Tilt, tilt1);
  ch(mh2Pan, pan2); ch(mh2PanFine, 0); ch(mh2Tilt, tilt2);

  ch(mh1Speed, MH_SPEED_SLOW);
  ch(mh2Speed, MH_SPEED_SLOW);

  // Fecho aberto contínuo, sem estrobo — perfil lento.
  ch(mh1Fecho, 255); ch(mh1Strobo, 255);
  ch(mh2Fecho, 255); ch(mh2Strobo, 255);

  const corStage = Math.floor(tick / COR_STAGE_TICKS) % CORES.length;
  adapter.setColor(MH1, CORES[corStage]);
  adapter.setColor(MH2, CORES[corStage]);

  // Fita — fade lento, mesmo período do pan.
  ch(fitaDimmer, lerp(60, 220, panP));
}

function OnTerminate() {
  ch(mh1Fecho, 0); ch(mh1Strobo, 0); ch(mh1Speed, 0); ch(mh1PanFine, 0);
  ch(mh2Fecho, 0); ch(mh2Strobo, 0); ch(mh2Speed, 0); ch(mh2PanFine, 0);
  ch(mh1Tilt, MP_M1.TILT_MID); ch(mh1Pan, MP_M1.PAN_C);
  ch(mh2Tilt, MP_M2.TILT_MID); ch(mh2Pan, MP_M2.PAN_C);

  ch(fitaDimmer, 0);
}
