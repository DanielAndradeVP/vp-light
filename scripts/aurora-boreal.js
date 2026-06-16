// AURORA BOREAL
// Transicao lenta azul > verde > ciano, com fade-in/out de intensidade.
// Sem strobo. Destino: F1.

const PARLED1_ID = 'fixture_1780805067518';

let dimmer = null;
let strobo = null;
let red = null;
let green = null;
let blue = null;
let white = null;
let tick = 0;

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
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
  setIfReady(white, 0);
  setIfReady(red, 0);
}

function OnExecute() {
  tick++;
  const TOTAL = 1500;

  // Envelope de intensidade: fade-in 250 ticks, pleno, fade-out 250 ticks.
  let dimmerValue;
  if (tick < 250) {
    dimmerValue = (tick / 250) * 255;
  } else if (tick > TOTAL - 250) {
    dimmerValue = ((TOTAL - tick) / 250) * 255;
  } else {
    dimmerValue = 255;
  }
  setIfReady(dimmer, dimmerValue);

  // Ciclo de cor: 500 ticks por fase, aprox. 20s em 25fps.
  // 0-499: azul > verde | 500-999: verde > ciano | 1000-1499: ciano > azul.
  const phase = tick % TOTAL;
  let r = 0;
  let g = 0;
  let b = 0;

  if (phase < 500) {
    const t = phase / 500;
    g = t * 200;
    b = (1 - t) * 255 + t * 100;
  } else if (phase < 1000) {
    const t = (phase - 500) / 500;
    g = 200 + t * 55;
    b = 100 + t * 155;
  } else {
    const t = (phase - 1000) / 500;
    g = 255 * (1 - t);
    b = 255;
  }

  setIfReady(red, r);
  setIfReady(green, g);
  setIfReady(blue, b);
}

function OnTerminate() {
  setIfReady(dimmer, 0);
  setIfReady(strobo, 0);
  setIfReady(red, 0);
  setIfReady(green, 0);
  setIfReady(blue, 0);
  setIfReady(white, 0);
}
