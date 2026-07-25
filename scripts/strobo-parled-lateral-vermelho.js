// strobo-parled-lateral-vermelho — Todos os Par LEDs ativos em vermelho: os 4 das
// pontas do rig (ParLed_Deluxe_1, _2 na esquerda extrema; _9, _10 na direita extrema)
// estrobando rápido, os demais ativos (_3, _5, _7, _8) vermelho sólido. Mini Bruts
// intercalando entre esquerda (B01+B03) e direita (B02+B04) no mesmo ritmo do strobo,
// Moving Heads parados no centro-frente, um pouco mais baixo que a posição catalogada
// "nivelado pra frente" (tilt levemente maior, na direção de "fecho na ponta do
// altar"), com strobo rápido próprio. Destino: F12, Página 2 ("lista 2").
const PARLED_LATERAIS = [
  'fixture_1780805067518_parled_deluxe_1',
  'fixture_1780805067518_parled_deluxe_2',
  'fixture_1780805067518_parled_deluxe_9',
  'fixture_1780805067518_parled_deluxe_6', // ParLed_Deluxe_10
];

// Demais Par LEDs ativos (fora das pontas) — ficam vermelho sólido, sem estrobar.
const PARLED_CENTRO = [
  'fixture_1780805067518_parled_deluxe_3',
  'fixture_1780805067518_parled_deluxe_5',
  'fixture_1780805067518_parled_deluxe_7',
  'fixture_1780805067518_parled_deluxe_8',
];

const BRUT_ESQUERDA = ['fixture_1780805067518_mini_brut_01', 'fixture_1780805067518_mini_brut_03'];
const BRUT_DIREITA  = ['fixture_1780805067518_mini_brut_02', 'fixture_1780805067518_mini_brut_04'];

const MH1 = 'fixture_1780805067518_moving_head_beam_1';
const MH2 = 'fixture_1780805067518_moving_head_beam_2';
// Base "nivelado pra frente" (catálogo de posicionamento físico dos Beam), com tilt
// um pouco maior (+20) pra baixar o facho em direção ao altar, ainda longe do
// waypoint "fecho na ponta do altar" (84/78 M1, 82/72 M2).
const MH1_CENTRO = { pan: 84, tilt: 56 };
const MH2_CENTRO = { pan: 84, tilt: 52 };

const STROBE_ON_TICKS  = 2; // 80ms aceso — estrobo rápido
const STROBE_OFF_TICKS = 2; // 80ms apagado
const STROBE_CYCLE = STROBE_ON_TICKS + STROBE_OFF_TICKS;

let tick = 0;
// id -> { macro, colorWheel, speed, macroSpeed, strobo, dimmer, red, green, blue, white }
// Cobre os dois layouts de canal em uso no show (com/sem color_wheel, com/sem strobo
// e white de hardware) — getChannel devolve null pro alias que não existir no layout.
let parledChannels = {};
let mh1Pan, mh1PanFine, mh1Tilt, mh1Speed, mh1Strobo;
let mh2Pan, mh2PanFine, mh2Tilt, mh2Speed, mh2Strobo;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function resolveParled(id) {
  return {
    macro: getChannel(id, 'macro'),
    colorWheel: getChannel(id, 'color_wheel'),
    speed: getChannel(id, 'speed'),
    macroSpeed: getChannel(id, 'macro_speed'),
    strobo: getChannel(id, 'strobo'),
    dimmer: getChannel(id, 'dimmer'),
    red: getChannel(id, 'red'),
    green: getChannel(id, 'green'),
    blue: getChannel(id, 'blue'),
    white: getChannel(id, 'white'),
  };
}

function setParledRed(c, on) {
  if (!c) return;
  ch(c.macro, 0);
  ch(c.colorWheel, 0);
  ch(c.speed, 0);
  ch(c.macroSpeed, 0);
  ch(c.strobo, 0);
  ch(c.white, 0);
  ch(c.dimmer, on ? 255 : 0);
  ch(c.red, 255);
  ch(c.green, 0);
  ch(c.blue, 0);
}

function setBrutGroup(ids, value01) {
  for (const id of ids) adapter.setDimmer(id, value01);
}

function OnStart() {
  tick = 0;

  parledChannels = {};
  for (const id of PARLED_LATERAIS.concat(PARLED_CENTRO)) parledChannels[id] = resolveParled(id);

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
}

function OnExecute() {
  tick++;

  const flashing = (tick % STROBE_CYCLE) < STROBE_ON_TICKS;

  // Par LEDs das pontas — strobo vermelho.
  for (const id of PARLED_LATERAIS) setParledRed(parledChannels[id], flashing);

  // Demais Par LEDs — vermelho sólido, sem estrobar.
  for (const id of PARLED_CENTRO) setParledRed(parledChannels[id], true);

  // Mini Bruts intercalando no mesmo ritmo do strobo: esquerda acesa quando os
  // par leds piscam, direita acesa no vão apagado — nunca os dois grupos juntos.
  setBrutGroup(BRUT_ESQUERDA, flashing ? 1 : 0);
  setBrutGroup(BRUT_DIREITA, flashing ? 0 : 1);

  // Moving Heads parados no centro-frente, mais baixo, com strobo rápido próprio.
  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  ch(mh1Speed, 0);
  ch(mh2Speed, 0);
  adapter.setStrobe(MH1, 'rapido');
  adapter.setStrobe(MH2, 'rapido');
  ch(mh1Pan, MH1_CENTRO.pan);
  ch(mh1PanFine, 0);
  ch(mh1Tilt, MH1_CENTRO.tilt);
  ch(mh2Pan, MH2_CENTRO.pan);
  ch(mh2PanFine, 0);
  ch(mh2Tilt, MH2_CENTRO.tilt);
}

function OnTerminate() {
  for (const id of PARLED_LATERAIS.concat(PARLED_CENTRO)) {
    const c = parledChannels[id];
    if (!c) continue;
    ch(c.macro, 0);
    ch(c.colorWheel, 0);
    ch(c.speed, 0);
    ch(c.macroSpeed, 0);
    ch(c.strobo, 0);
    ch(c.white, 0);
    ch(c.dimmer, 0);
    ch(c.red, 0);
    ch(c.green, 0);
    ch(c.blue, 0);
  }

  setBrutGroup(BRUT_ESQUERDA, 0);
  setBrutGroup(BRUT_DIREITA, 0);

  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  ch(mh1Speed, 0);
  ch(mh2Speed, 0);
  ch(mh1Strobo, 0);
  ch(mh2Strobo, 0);
}
