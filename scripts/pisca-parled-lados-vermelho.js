// pisca-parled-lados-vermelho — PAR LED alternando esquerda x direita física em vermelho.
// Mesma base do pisca-parled-lados.js (inspirada na cena G / parled_static), só que
// em vez de azul claro a cor é vermelha.

// Grupos por posição física real (posX no rig), igual ao par ESQUERDA/DIREITA dos bruts.
const ESQUERDA = [
  'fixture_1780805067518_parled_deluxe_1',
  'fixture_1780805067518_parled_deluxe_2',
  'fixture_1780805067518_parled_deluxe_3',
  'fixture_1780805067518_parled_deluxe_5',
];
const DIREITA = [
  'fixture_1780805067518_parled_deluxe_7',
  'fixture_1780805067518_parled_deluxe_8',
  'fixture_1780805067518_parled_deluxe_4',
  'fixture_1780805067518_parled_deluxe_6',
  'fixture_1780805067518_parled_deluxe_9',
];

// Vermelho — RGB fixo, independente do layout de canais de cada PAR.
const VERMELHO = { r: 255, g: 0, b: 0 };

const FLASH_TICKS = 2; // 80ms
const GAP_TICKS   = 1; // 40ms
const CYCLE = (FLASH_TICKS + GAP_TICKS) * 2;

let tick = 0;
let channels = {}; // id -> { dimmer, r, g, b, white, strobo }

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

// Resolve só os aliases comuns aos dois layouts de PAR Deluxe (A e B); o que não
// existir num layout (white/strobo no B) volta null e ch() ignora.
function resolvePar(id) {
  return {
    dimmer: getChannel(id, 'dimmer'),
    r:      getChannel(id, 'red'),
    g:      getChannel(id, 'green'),
    b:      getChannel(id, 'blue'),
    white:  getChannel(id, 'white'),
    strobo: getChannel(id, 'strobo'),
  };
}

function setGroup(ids, on) {
  for (const id of ids) {
    const c = channels[id];
    ch(c.dimmer, on ? 255 : 0);
    ch(c.r, VERMELHO.r);
    ch(c.g, VERMELHO.g);
    ch(c.b, VERMELHO.b);
    ch(c.white, 0);
    ch(c.strobo, 0);
  }
}

function OnStart() {
  tick = 0;
  channels = {};
  for (const id of ESQUERDA.concat(DIREITA)) channels[id] = resolvePar(id);
}

function OnExecute() {
  tick++;
  const segment = FLASH_TICKS + GAP_TICKS;
  const phase = tick % CYCLE;

  if (phase < FLASH_TICKS) {
    setGroup(ESQUERDA, true); setGroup(DIREITA, false);
  } else if (phase < segment + FLASH_TICKS) {
    setGroup(ESQUERDA, false); setGroup(DIREITA, phase < segment ? false : true);
  } else {
    setGroup(ESQUERDA, false); setGroup(DIREITA, false);
  }
}

function OnTerminate() {
  setGroup(ESQUERDA, false);
  setGroup(DIREITA, false);
}
