// respiro-ribalta-lenta — Foco na ribalta: par em "respiração" (dimmer fade in/out bem
// lento e suave) com tilt quase fixo. Moving heads fazem acompanhamento sutil (dimmer
// respirando em fase com a ribalta, movimento mínimo). Fita em fade lento, mesma fase.
// Perfil LENTO (trecho calmo) — sem strobo, fecho/dimmer aberto contínuo (a "respiração"
// é o efeito, não um blackout).
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

// Respiração — ciclo longo e suave.
const BREATH_PERIOD = 300; // 12s por respiração completa
const BREATH_DIM_MIN = 40;
const BREATH_DIM_MAX = 255;

// Movimento mínimo — sway quase imperceptível, "quase fixo".
const MH_SWAY_AMPLITUDE = 4; // graus DMX de excursão
const MH_SPEED_SLOW = 220;   // raw virtual_speed — bem lento

const MH_DIM_MIN = 0.15;
const MH_DIM_MAX = 1.0;

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
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

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

  const breath = wave01(tick, BREATH_PERIOD);

  // Ribalta em par — respiração de dimmer, tilt quase fixo (leve eco da respiração), sem strobo.
  const ribaltaDim = lerp(BREATH_DIM_MIN, BREATH_DIM_MAX, breath);
  const RIBALTA_TILT_ANCHOR = 95; // ancoragem mais baixa que TILT_LOUVOR (105), perto do extremo "louvor" útil (90-100)
  const ribaltaTilt = RIBALTA_TILT_ANCHOR + (breath - 0.5) * 6; // +-3 em torno do novo valor fixo (95)
  setRibaltaPair(ribaltaTilt, MP_RIB.SPEED_SLOW, 0, ribaltaDim);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Moving heads — dimmer respirando em fase com a ribalta, movimento mínimo.
  // Cor constante e neutra — o efeito é 100% respiração de intensidade.
  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  const mhDim = lerp(MH_DIM_MIN, MH_DIM_MAX, breath);
  adapter.setDimmer(MH1, mhDim);
  adapter.setDimmer(MH2, mhDim);
  adapter.setMovementSpeed(MH1, 1);
  adapter.setMovementSpeed(MH2, 1);

  const sway = (breath - 0.5) * 2 * MH_SWAY_AMPLITUDE;
  ch(mh1Pan, MP_M1.PAN_C - MP_MH_GAP); ch(mh1PanFine, 0); ch(mh1Tilt, MP_M1.TILT_F + sway);
  ch(mh2Pan, MP_M2.PAN_C + MP_MH_GAP); ch(mh2PanFine, 0); ch(mh2Tilt, MP_M2.TILT_F + sway);

  ch(mh1Speed, MH_SPEED_SLOW);
  ch(mh2Speed, MH_SPEED_SLOW);

  // fecho_lampada já foi setado acima via adapter.setDimmer — não sobrescrever raw aqui.
  ch(mh1Strobo, 255);
  ch(mh2Strobo, 255);

  // Fita — mesma respiração, em fase.
  ch(fitaDimmer, lerp(BREATH_DIM_MIN, BREATH_DIM_MAX, breath));
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
  ch(mh1Strobo, 0); ch(mh1Speed, 0); ch(mh1PanFine, 0);
  ch(mh2Strobo, 0); ch(mh2Speed, 0); ch(mh2PanFine, 0);
  ch(mh1Tilt, MP_M1.TILT_MID); ch(mh1Pan, MP_M1.PAN_C);
  ch(mh2Tilt, MP_M2.TILT_MID); ch(mh2Pan, MP_M2.PAN_C);

  setRibaltaPair(MP_RIB.TILT_LOW, 0, 0, 0);
  for (const c of (r1Leds || [])) ch(c, 0);
  for (const c of (r2Leds || [])) ch(c, 0);

  ch(fitaDimmer, 0);
}
