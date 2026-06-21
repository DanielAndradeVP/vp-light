// mini-bruts-pisca-esquerda-direita - Mini Bruts alternando dois da esquerda e dois da direita. Destino: sem F-key definida.
const LEFT_BRUTS = [
  'fixture_1780805067518_mini_brut_01',
  'fixture_1780805067518_mini_brut_02',
];

const RIGHT_BRUTS = [
  'fixture_1780805067518_mini_brut_03',
  'fixture_1780805067518_mini_brut_04',
];

const FLASH_VALUE = 200;
const OFF_VALUE = 0;
const FLASH_TICKS = 5; // 200ms em 25fps
const GAP_TICKS = 2;   // 80ms de respiro entre lados

let leftDimmers = [];
let rightDimmers = [];
let tick = 0;

function resolveDimmers(fixtureIds) {
  return fixtureIds
    .map((fixtureId) => getChannel(fixtureId, 'dimmer'))
    .filter((channel) => channel !== null);
}

function setChannels(channels, value) {
  channels.forEach((channel) => SetChannel(channel, value));
}

function blackoutBruts() {
  setChannels(leftDimmers, OFF_VALUE);
  setChannels(rightDimmers, OFF_VALUE);
}

function OnStart() {
  leftDimmers = resolveDimmers(LEFT_BRUTS);
  rightDimmers = resolveDimmers(RIGHT_BRUTS);
  tick = 0;
  blackoutBruts();
}

function OnExecute() {
  tick++;

  const segment = FLASH_TICKS + GAP_TICKS;
  const cycle = segment * 2;
  const phase = tick % cycle;

  if (phase < FLASH_TICKS) {
    setChannels(leftDimmers, FLASH_VALUE);
    setChannels(rightDimmers, OFF_VALUE);
  } else if (phase < segment) {
    blackoutBruts();
  } else if (phase < segment + FLASH_TICKS) {
    setChannels(leftDimmers, OFF_VALUE);
    setChannels(rightDimmers, FLASH_VALUE);
  } else {
    blackoutBruts();
  }
}

function OnTerminate() {
  blackoutBruts();
}
