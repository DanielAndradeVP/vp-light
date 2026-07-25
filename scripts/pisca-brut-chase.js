// pisca-brut-chase — etapa 3 de 3 do antigo brut-pisca-combo.
// Chase físico ping-pong na ordem real do palco: B01 → B03 → B02 → B04 → B02 → B03.
const B01 = 'fixture_1780805067518_mini_brut_01';
const B02 = 'fixture_1780805067518_mini_brut_02';
const B03 = 'fixture_1780805067518_mini_brut_03';
const B04 = 'fixture_1780805067518_mini_brut_04';

const ALL_BRUTS = [B01, B02, B03, B04];
const CHASE_SEQUENCE = [B01, B03, B02, B04, B02, B03]; // ids, nunca índices — sem desalinhamento se um brut for desabilitado

const CHASE_FLASH_TICKS = 4; // 160ms aceso
const CHASE_GAP_TICKS   = 2; // 80ms apagado entre um brut e outro
const STEP  = CHASE_FLASH_TICKS + CHASE_GAP_TICKS;
const CYCLE = STEP * CHASE_SEQUENCE.length;

let tick = 0;

function setGroup(ids, value01) {
  for (const id of ids) adapter.setDimmer(id, value01);
}

function allOff() {
  setGroup(ALL_BRUTS, 0);
}

function OnStart() { tick = 0; }

function OnExecute() {
  tick++;
  const phase = tick % CYCLE;
  const stepIndex = Math.floor(phase / STEP) % CHASE_SEQUENCE.length;
  const stepPhase = phase % STEP;

  allOff();
  if (stepPhase < CHASE_FLASH_TICKS) {
    adapter.setDimmer(CHASE_SEQUENCE[stepIndex], 1);
  }
}

function OnTerminate() {
  allOff();
}
