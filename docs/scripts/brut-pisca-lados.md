# brut-pisca-lados.js — versão corrigida (adapter-first)

Fix: agrupamento corrigido pra corte espacial real (`fire-base.js`: ordem física `B01→B03→B02→B04`) — esquerda de verdade é **B01+B03**, direita é **B02+B04**. Compartilha `setGroup` com `brut-pisca-cruz.js` em vez de duplicar (ambos podem virar `fire-*.js` puxando de `fire-base.js`).

```js
// brut-pisca-lados — esquerda física (B01+B03) × direita física (B02+B04).
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
```

## Notas

- Estrutura idêntica a `brut-pisca-cruz.js` de propósito — se os dois efeitos vão conviver no pacote fire-*, vale extrair `setGroup` pra `fire-base.js` (`fb_ribDim`-like, mas pra Mini Brut) em vez de repetir nos dois arquivos.
- `adapter.setDimmer` cobre 100% do equipamento aqui (só `dimmer` de Mini Brut) — nenhum canal raw necessário.
