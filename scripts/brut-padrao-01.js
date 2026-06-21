// mini-bruts-pisca-cruzado - Mini Bruts alternando 1+4 e depois 2+3. Destino: sem F-key definida.

const LEFT_BRUTS = [
  'fixture_1780805067518_mini_brut_01',
  'fixture_1780805067518_mini_brut_04',
];

const RIGHT_BRUTS = [
  'fixture_1780805067518_mini_brut_02',
  'fixture_1780805067518_mini_brut_03',
];

const FLASH_VALUE = 200;
const OFF_VALUE = 0;
const FLASH_TICKS = 3; // 120ms em 25fps
const GAP_TICKS = 1;   // 40ms de respiro entre grupos

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
    setChannels(leftDimmers, FLASH_VALUE);   // acende bruts 1 e 4
    setChannels(rightDimmers, OFF_VALUE);
  } else if (phase < segment) {
    blackoutBruts();
  } else if (phase < segment + FLASH_TICKS) {
    setChannels(leftDimmers, OFF_VALUE);
    setChannels(rightDimmers, FLASH_VALUE);  // acende bruts 2 e 3
  } else {
    blackoutBruts();
  }
}

function OnTerminate() {
  blackoutBruts();
}