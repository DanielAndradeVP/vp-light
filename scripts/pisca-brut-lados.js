// pisca-brut-lados — etapa 2 de 3 do antigo brut-pisca-combo.
// Mini Bruts piscando esquerda física (B01+B03) x direita física (B02+B04).
const ESQUERDA = ['fixture_1780805067518_mini_brut_01', 'fixture_1780805067518_mini_brut_03'];
const DIREITA  = ['fixture_1780805067518_mini_brut_02', 'fixture_1780805067518_mini_brut_04'];

const FLASH_TICKS = 5; // 200ms
const GAP_TICKS   = 2; // 80ms
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
    setGroup(ESQUERDA, 1); setGroup(DIREITA, 0);
  } else if (phase < segment + FLASH_TICKS) {
    setGroup(ESQUERDA, 0); setGroup(DIREITA, phase < segment ? 0 : 1);
  } else {
    setGroup(ESQUERDA, 0); setGroup(DIREITA, 0);
  }
}

function OnTerminate() {
  setGroup(ESQUERDA, 0);
  setGroup(DIREITA, 0);
}
