// TEMPESTADE ROXA
// Azul > roxo com strobo progressivo entrando na metade e acelerando.
// Com strobo. Destino: F8.

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

  setIfReady(green, 0);
  setIfReady(white, 0);
}

function OnExecute() {
  tick++;

  let dimmerValue = 0;
  let r = 0;
  let b = 0;
  let stroboValue = 0;

  if (tick <= 375) {
    // Fase 1: azul puro, fade-in, sem strobo.
    const t = tick / 375;
    dimmerValue = lerp(0, 200, t);
    r = 0;
    b = 255;
    stroboValue = 0;
  } else if (tick <= 750) {
    // Fase 2: azul > roxo, strobo comeca fraco.
    const t = (tick - 375) / 375;
    dimmerValue = 200;
    r = lerp(0, 150, t);
    b = 255;
    stroboValue = lerp(0, 60, t);
  } else if (tick <= 1125) {
    // Fase 3: roxo intenso, strobo cresce.
    const t = (tick - 750) / 375;
    dimmerValue = lerp(200, 255, t);
    r = lerp(150, 220, t);
    b = 255;
    stroboValue = lerp(60, 160, t);
  } else {
    // Fase 4: frenesi roxo-branco, strobo maximo, depois recua.
    const t = (tick - 1125) / 375;
    dimmerValue = 255;
    r = lerp(220, 80, t);
    b = lerp(255, 200, t);
    stroboValue = lerp(160, 20, t);
  }

  setIfReady(dimmer, dimmerValue);
  setIfReady(strobo, stroboValue);
  setIfReady(red, r);
  setIfReady(green, 0);
  setIfReady(blue, b);
  setIfReady(white, 0);
}

function OnTerminate() {
  setIfReady(dimmer, 0);
  setIfReady(strobo, 0);
  setIfReady(red, 0);
  setIfReady(green, 0);
  setIfReady(blue, 0);
  setIfReady(white, 0);
}
