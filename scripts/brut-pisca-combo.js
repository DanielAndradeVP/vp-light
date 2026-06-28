// brut-pisca-combo — Três padrões de pisca nos mini bruts.

// ── IDs dos Mini Bruts ──────────────────────────────────────────────────────

const ID_B01 = 'fixture_1780805067518_mini_brut_01'; // DMX 400
const ID_B02 = 'fixture_1780805067518_mini_brut_02'; // DMX 402
const ID_B03 = 'fixture_1780805067518_mini_brut_03'; // DMX 401
const ID_B04 = 'fixture_1780805067518_mini_brut_04'; // DMX 410

const BRUT_IDS = [ID_B01, ID_B02, ID_B03, ID_B04];


// ── Valores gerais ──────────────────────────────────────────────────────────

const FLASH_VALUE = 200;
const OFF_VALUE = 0;


// ── Padrão 1: Cruzado 1+4 / 2+3 ─────────────────────────────────────────────

const CROSS_GROUP_A = [0, 3]; // bruts 1 e 4
const CROSS_GROUP_B = [1, 2]; // bruts 2 e 3

const CROSS_FLASH_TICKS = 3; // 120ms em 25fps
const CROSS_GAP_TICKS   = 1; // 40ms de respiro
const CROSS_REPEATS     = 8;


// ── Padrão 2: Esquerda / direita 1+2 / 3+4 ──────────────────────────────────

const SIDE_GROUP_A = [0, 1]; // bruts 1 e 2
const SIDE_GROUP_B = [2, 3]; // bruts 3 e 4

const SIDE_FLASH_TICKS = 5; // 200ms em 25fps
const SIDE_GAP_TICKS   = 2; // 80ms de respiro
const SIDE_REPEATS     = 6;


// ── Padrão 3: Sequência ping-pong física ────────────────────────────────────
// Ordem real no palco:
// B01 = 400
// B03 = 401
// B02 = 402
// B04 = 410
//
// Sequência:
// 400 -> 401 -> 402 -> 410 -> 402 -> 401

const CHASE_SEQUENCE = [0, 2, 1, 3, 1, 2];

const CHASE_FLASH_TICKS = 4; // 160ms aceso
const CHASE_GAP_TICKS   = 2; // 80ms apagado entre um brut e outro
const CHASE_REPEATS     = 4;


// ── Cálculo de duração dos padrões ──────────────────────────────────────────

const CROSS_SEGMENT  = CROSS_FLASH_TICKS + CROSS_GAP_TICKS;
const CROSS_CYCLE    = CROSS_SEGMENT * 2;
const CROSS_DURATION = CROSS_CYCLE * CROSS_REPEATS;

const SIDE_SEGMENT  = SIDE_FLASH_TICKS + SIDE_GAP_TICKS;
const SIDE_CYCLE    = SIDE_SEGMENT * 2;
const SIDE_DURATION = SIDE_CYCLE * SIDE_REPEATS;

const CHASE_STEP     = CHASE_FLASH_TICKS + CHASE_GAP_TICKS;
const CHASE_CYCLE    = CHASE_STEP * CHASE_SEQUENCE.length;
const CHASE_DURATION = CHASE_CYCLE * CHASE_REPEATS;

const TOTAL_DURATION = CROSS_DURATION + SIDE_DURATION + CHASE_DURATION;


// ── Estado ──────────────────────────────────────────────────────────────────

let brutDimmers = [];
let tick = 0;


// ── Utilitários ─────────────────────────────────────────────────────────────

function ch(channel, value) {
  if (channel !== null && channel !== undefined) {
    SetChannel(channel, Math.max(0, Math.min(255, Math.round(value))));
  }
}

function resolveDimmers(fixtureIds) {
  return fixtureIds
    .map((fixtureId) => getChannel(fixtureId, 'dimmer'))
    .filter((channel) => channel !== null && channel !== undefined);
}

function setBrut(index, value) {
  ch(brutDimmers[index], value);
}

function setGroup(indexes, value) {
  indexes.forEach((index) => setBrut(index, value));
}

function blackoutBruts() {
  for (let i = 0; i < brutDimmers.length; i++) {
    ch(brutDimmers[i], OFF_VALUE);
  }
}


// ── Padrões ─────────────────────────────────────────────────────────────────

function runPairPattern(localTick, groupA, groupB, flashTicks, gapTicks) {
  const segment = flashTicks + gapTicks;
  const cycle = segment * 2;
  const phase = localTick % cycle;

  blackoutBruts();

  if (phase < flashTicks) {
    setGroup(groupA, FLASH_VALUE);
    return;
  }

  if (phase >= segment && phase < segment + flashTicks) {
    setGroup(groupB, FLASH_VALUE);
  }
}

function runChasePattern(localTick) {
  const step = CHASE_FLASH_TICKS + CHASE_GAP_TICKS;
  const stepIndex = Math.floor(localTick / step) % CHASE_SEQUENCE.length;
  const stepPhase = localTick % step;

  blackoutBruts();

  if (stepPhase < CHASE_FLASH_TICKS) {
    const brutIndex = CHASE_SEQUENCE[stepIndex];
    setBrut(brutIndex, FLASH_VALUE);
  }
}


// ── Hooks do VP-Light ───────────────────────────────────────────────────────

function OnStart() {
  brutDimmers = resolveDimmers(BRUT_IDS);
  tick = 0;
  blackoutBruts();
}

function OnExecute() {
  const cycleTick = tick % TOTAL_DURATION;

  if (cycleTick < CROSS_DURATION) {
    runPairPattern(
      cycleTick,
      CROSS_GROUP_A,
      CROSS_GROUP_B,
      CROSS_FLASH_TICKS,
      CROSS_GAP_TICKS
    );
  } else if (cycleTick < CROSS_DURATION + SIDE_DURATION) {
    runPairPattern(
      cycleTick - CROSS_DURATION,
      SIDE_GROUP_A,
      SIDE_GROUP_B,
      SIDE_FLASH_TICKS,
      SIDE_GAP_TICKS
    );
  } else {
    runChasePattern(cycleTick - CROSS_DURATION - SIDE_DURATION);
  }

  tick++;
}

function OnTerminate() {
  blackoutBruts();
}