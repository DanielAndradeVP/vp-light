# brut-pisca-combo.js — versão corrigida (adapter-first)

Fix principal: trocar índice de array por **id de fixture** em todo lugar — elimina de vez o risco de desalinhamento se um Mini Brut for desabilitado (não existe mais "posição no array", `adapter.setDimmer` resolve por id sempre).

```js
// brut-pisca-combo — 3 padrões em sequência: cruzado, lados, chase físico.
const B01 = 'fixture_1780805067518_mini_brut_01';
const B02 = 'fixture_1780805067518_mini_brut_02';
const B03 = 'fixture_1780805067518_mini_brut_03';
const B04 = 'fixture_1780805067518_mini_brut_04';

const CROSS_A = [B01, B04], CROSS_B = [B02, B03];   // extremos × centro
const SIDE_A  = [B01, B03], SIDE_B  = [B02, B04];   // FIX: esquerda/direita física real
const CHASE_SEQ = [B01, B03, B02, B04, B02, B03];   // ping-pong na ordem física do palco

const CROSS_FLASH = 3, CROSS_GAP = 3, CROSS_REPEATS = 8;   // FIX: gap 1→3 (era imperceptível)
const SIDE_FLASH  = 5, SIDE_GAP  = 2, SIDE_REPEATS  = 6;
const CHASE_FLASH = 4, CHASE_GAP = 2, CHASE_REPEATS = 4;

const CROSS_DUR = (CROSS_FLASH + CROSS_GAP) * 2 * CROSS_REPEATS;
const SIDE_DUR  = (SIDE_FLASH + SIDE_GAP) * 2 * SIDE_REPEATS;
const CHASE_DUR = (CHASE_FLASH + CHASE_GAP) * CHASE_SEQ.length * CHASE_REPEATS;
const TOTAL_DUR = CROSS_DUR + SIDE_DUR + CHASE_DUR;

let tick = 0;

function setGroup(ids, value01) { for (const id of ids) adapter.setDimmer(id, value01); }
function allOff() { setGroup([B01, B02, B03, B04], 0); }

function runPair(localTick, groupA, groupB, flash, gap) {
  const segment = flash + gap;
  const phase = localTick % (segment * 2);
  allOff();
  if (phase < flash) setGroup(groupA, 1);
  else if (phase >= segment && phase < segment + flash) setGroup(groupB, 1);
}

function runChase(localTick) {
  const step = CHASE_FLASH + CHASE_GAP;
  const stepIndex = Math.floor(localTick / step) % CHASE_SEQ.length;
  const stepPhase = localTick % step;
  allOff();
  if (stepPhase < CHASE_FLASH) setGroup([CHASE_SEQ[stepIndex]], 1);
}

function OnStart() { tick = 0; }

function OnExecute() {
  const cycleTick = tick % TOTAL_DUR;
  tick++; // FIX: incrementa no início, igual ao resto do pacote (era no fim)

  if (cycleTick < CROSS_DUR) {
    runPair(cycleTick, CROSS_A, CROSS_B, CROSS_FLASH, CROSS_GAP);
  } else if (cycleTick < CROSS_DUR + SIDE_DUR) {
    runPair(cycleTick - CROSS_DUR, SIDE_A, SIDE_B, SIDE_FLASH, SIDE_GAP);
  } else {
    runChase(cycleTick - CROSS_DUR - SIDE_DUR);
  }
}

function OnTerminate() { allOff(); }
```

## Notas

- `CHASE_SEQ`/`CROSS_A`/`SIDE_A` guardam **ids**, nunca índices — desabilitar um Mini Brut no show só faz `adapter.setDimmer` devolver `{ok:false, code:'FIXTURE_DISABLED'}` pra aquele id específico, sem deslocar nenhum outro grupo.
- `runPair`/`runChase` continuam chamando `allOff()` todo frame antes de acender o grupo certo — mantido igual ao original (funciona, só reescreve canais que não mudaram).
