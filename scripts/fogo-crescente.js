// FOGO CRESCENTE
// Vermelho nasce, vira ambar/laranja, pulsa branco no climax e apaga.
// Sem strobo. Destino: F6.

const PARLED1_ID = 'fixture_1780805067518';

let dimmer = null;
let strobo = null;
let red = null;
let green = null;
let blue = null;
let white = null;
let tick = 0;

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value || 0)));
}

function lerp(a, b, t) {
  const safeT = Math.max(0, Math.min(1, t));
  return a + (b - a) * safeT;
}

function setIfReady(channel, value) {
  if (channel !== null) SetChannel(channel, clamp(value));
}

function OnStart() {
  dimmer = getChannel(PARLED1_ID, 'dimmer');
  strobo = getChannel(PARLED1_ID, 'strobo');
  red = getChannel(PARLED1_ID, 'red');
  green = getChannel(PARLED1_ID, 'green');
  blue = getChannel(PARLED1_ID, 'blue');
  white = getChannel(PARLED1_ID, 'white');
  tick = 0;

  setIfReady(strobo, 0);
  setIfReady(blue, 0);
  setIfReady(white, 0);
}

function OnExecute() {
  tick++;

  // 5 atos ao longo de 1500 ticks.
  // 0-300: brasa | 300-700: chama cresce | 700-1100: fogo pleno
  // 1100-1350: brasas vivas | 1350-1500: apaga
  let dimmerValue = 0;
  let r = 0;
  let g = 0;
  let w = 0;

  if (tick <= 300) {
    const t = tick / 300;
    dimmerValue = lerp(30, 130, t);
    r = lerp(80, 200, t);
    g = 0;
    w = 0;
  } else if (tick <= 700) {
    const t = (tick - 300) / 400;
    dimmerValue = lerp(130, 255, t);
    r = 255;
    g = lerp(0, 80, t);
    w = 0;
  } else if (tick <= 1100) {
    const t = (tick - 700) / 400;
    const pulse = (Math.sin((tick / 100) * Math.PI * 2) + 1) / 2;
    dimmerValue = 255;
    r = 255;
    g = lerp(80, 60, t);
    w = lerp(0, 80, t) * pulse;
  } else if (tick <= 1350) {
    const t = (tick - 1100) / 250;
    const flicker = (Math.sin((tick / 18) * Math.PI * 2) + 1) / 2;
    dimmerValue = lerp(255, 180, t) * (0.8 + 0.2 * flicker);
    r = 255;
    g = lerp(60, 20, t);
    w = 0;
  } else {
    const t = (tick - 1350) / 150;
    dimmerValue = lerp(180, 0, t);
    r = 255;
    g = 0;
    w = 0;
  }

  setIfReady(dimmer, dimmerValue);
  setIfReady(red, r);
  setIfReady(green, g);
  setIfReady(blue, 0);
  setIfReady(white, w);
  setIfReady(strobo, 0);
}

function OnTerminate() {
  setIfReady(dimmer, 0);
  setIfReady(strobo, 0);
  setIfReady(red, 0);
  setIfReady(green, 0);
  setIfReady(blue, 0);
  setIfReady(white, 0);
}
