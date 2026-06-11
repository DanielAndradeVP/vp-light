// FLASH GLORIA
// Branco pulsa lento, transicao verde > amarelo > vermelho, strobo em rajadas crescentes.
// Branco total no pico e apaga em vermelho. Com strobo. Destino: F7.

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

  setIfReady(blue, 0);
}

function OnExecute() {
  tick++;

  let dimmerValue = 0;
  let r = 0;
  let g = 0;
  let w = 0;
  let stroboValue = 0;

  if (tick <= 250) {
    // Fase 1: branco suave pulsando lento, sem strobo.
    const pulse = (Math.sin((tick / 125) * Math.PI * 2) + 1) / 2;
    dimmerValue = lerp(40, 160, pulse);
    r = 0;
    g = 0;
    w = 255;
    stroboValue = 0;
  } else if (tick <= 600) {
    // Fase 2: branco some, verde entra e sobe.
    const t = (tick - 250) / 350;
    dimmerValue = lerp(100, 220, t);
    w = lerp(255, 0, t);
    g = lerp(0, 255, t);
    r = 0;
    stroboValue = 0;
  } else if (tick <= 950) {
    // Fase 3: verde > amarelo, com rajadas a cada 80 ticks.
    const t = (tick - 600) / 350;
    dimmerValue = 220;
    g = 255;
    r = lerp(0, 200, t);
    w = 0;
    stroboValue = ((tick - 600) % 80) < 20 ? lerp(40, 120, t) : 0;
  } else if (tick <= 1200) {
    // Fase 4: amarelo > vermelho, rajadas mais curtas e intensas.
    const t = (tick - 950) / 250;
    dimmerValue = lerp(220, 255, t);
    r = 255;
    g = lerp(200, 0, t);
    w = lerp(0, 60, t);
    stroboValue = ((tick - 950) % 50) < 15 ? lerp(120, 220, t) : 0;
  } else if (tick <= 1380) {
    // Fase 5: pico, branco total e strobo forte continuo.
    dimmerValue = 255;
    r = 0;
    g = 0;
    w = 255;
    stroboValue = 220;
  } else {
    // Fase 6: apaga em vermelho lento.
    const t = (tick - 1380) / 120;
    dimmerValue = lerp(255, 0, t);
    r = 255;
    g = 0;
    w = 0;
    stroboValue = 0;
  }

  setIfReady(dimmer, dimmerValue);
  setIfReady(strobo, stroboValue);
  setIfReady(red, r);
  setIfReady(green, g);
  setIfReady(blue, 0);
  setIfReady(white, w);
}

function OnTerminate() {
  setIfReady(dimmer, 0);
  setIfReady(strobo, 0);
  setIfReady(red, 0);
  setIfReady(green, 0);
  setIfReady(blue, 0);
  setIfReady(white, 0);
}
