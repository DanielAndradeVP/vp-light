# brut-pisca-cruz.js — versão corrigida (adapter-first)

Fixes: nomes renomeados pra refletir a ordem física real (`fire-base.js`: `B01→B03→B02→B04`, esquerda→direita) — o agrupamento vira **extremos × centro**, não "esquerda/direita". `setChannels` cru vira `adapter.setDimmer` (clamp de graça). `GAP_TICKS` sobe de 1 pra 3 ticks (perceptível).

```js
// brut-pisca-cruz — extremos (B01+B04) × centro (B02+B03), flash alternado.
const EXTREMOS = ['fixture_1780805067518_mini_brut_01', 'fixture_1780805067518_mini_brut_04'];
const CENTRO   = ['fixture_1780805067518_mini_brut_02', 'fixture_1780805067518_mini_brut_03'];

const FLASH_TICKS = 3; // 120ms
const GAP_TICKS   = 3; // FIX: era 1 (40ms, imperceptível) — 120ms agora dá um respiro real
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
```

## Notas

- `adapter.setDimmer` já clampa 0–1→0–255 internamente — não precisa de `setChannels` com clamp manual.
- Sem `OnStart` de resolução de canal: `adapter.setDimmer` resolve fixture a cada chamada, então não há canal pra guardar entre frames.
