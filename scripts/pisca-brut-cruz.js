// pisca-brut-cruz — etapa 1 de 3 do antigo brut-pisca-combo.
// Mini Bruts piscando cruzado: extremos (B01+B04) x centro (B02+B03).
const EXTREMOS = ['fixture_1780805067518_mini_brut_01', 'fixture_1780805067518_mini_brut_04'];
const CENTRO   = ['fixture_1780805067518_mini_brut_02', 'fixture_1780805067518_mini_brut_03'];

const FLASH_TICKS = 3; // 120ms
const GAP_TICKS   = 3; // 120ms — respiro real (era 1 tick/40ms, imperceptível)
const CYCLE = (FLASH_TICKS + GAP_TICKS) * 2;

let tick = 0;

function setGroup(ids, value01) {
  for (const id of ids) adapter.setDimmer(id, value01);
}

function OnStart() { tick = 0; }

function OnExecute() {
  tick++;
  const segment = FLASH_TICKS + GAP_TICKS;
  const phase = tick % CYCLE;

  if (phase < FLASH_TICKS) {
    setGroup(EXTREMOS, 1); setGroup(CENTRO, 0);
  } else if (phase < segment + FLASH_TICKS) {
    setGroup(EXTREMOS, 0); setGroup(CENTRO, phase < segment ? 0 : 1);
  } else {
    setGroup(EXTREMOS, 0); setGroup(CENTRO, 0);
  }
}

function OnTerminate() {
  setGroup(EXTREMOS, 0);
  setGroup(CENTRO, 0);
}