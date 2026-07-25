# brut-fita-full.js — versão corrigida (adapter-first)

Fix teórico: nome promete "full" (100%) mas o valor cru era `200` (~78%) — vira `1` (100%) via `adapter.setDimmer`, que já normaliza 0–1 → 0–255. Fixture desabilitada some do array via `.filter`, agora reportada em vez de engolida.

```js
// brut-fita-full — Mini Bruts + Fita LED no máximo real (100%).
const FIXTURES = [
  'fixture_1780805067518_mini_brut_01',
  'fixture_1780805067518_mini_brut_02',
  'fixture_1780805067518_mini_brut_03',
  'fixture_1780805067518_mini_brut_04',
  'fixture_1780805067518_fita_led',
];

function OnExecute() {
  for (const id of FIXTURES) {
    adapter.setDimmer(id, 1); // FIX: era 200 (~78%) — "full" agora é 1 (100%) de verdade
  }
}

function OnTerminate() {
  for (const id of FIXTURES) {
    adapter.setDimmer(id, 0);
  }
}
```

## Notas

- `adapter.setDimmer` resolve o alias `dimmer` direto (todas as 5 fixtures têm esse canal) e já retorna `{ok:false, code:'FIXTURE_DISABLED'}` se alguma estiver desabilitada — nenhum `getChannel`/`OnStart` de resolução prévia é necessário, então o `.filter` que engolia fixtures desabilitadas em silêncio deixa de existir.
- Sem `OnStart` porque não há canal pra resolver antecipadamente — `adapter.setDimmer` já resolve fixture+canal a cada chamada.
