# mov-desc-branco.js — versão corrigida (adapter-first)

Fixes: (1) reposicionamento vira contador real com velocidade rápida própria, não 1 frame com a mesma velocidade lenta da descida; (2) uma única fonte de posições (`MP_M1`/`MP_M2` do preset, sem redeclarar local); (3) pan/tilt/dimmer/speed/cor via `adapter.set*`.

```js
// mov-desc-branco — descida branca MH + bruts + fita. Preset: mov-preset.js
const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';
const ID_FITA = 'fixture_1780805067518_fita_led';
const BRUTS = [
  'fixture_1780805067518_mini_brut_01', 'fixture_1780805067518_mini_brut_02',
  'fixture_1780805067518_mini_brut_03', 'fixture_1780805067518_mini_brut_04',
];

const DESCEND_TICKS = 300;     // 12s descendo, visível
const REPOSITION_TICKS = 60;   // FIX: 2.4s reais de retorno, não 1 frame
const SPEED_DESCEND = MP_MH_SPEED_SLOW / 255; // lento, visível
const SPEED_REPOSITION = 0.20;                // FIX: rápido de propósito — some da tela em 2.4s de verdade

let tick = 0;
let phase = 'reposition';
let phaseTick = 0;

function OnStart() {
  tick = 0;
  phase = 'reposition';
  phaseTick = 0;
}

function OnExecute() {
  tick++;
  phaseTick++;

  adapter.setColor(ID_M1, 'white');
  adapter.setColor(ID_M2, 'white');
  // prism sempre "desligado" neste efeito — sem valor calibrado pra isso ainda, raw por enquanto.
  SetChannel(getChannel(ID_M1, 'prism_1'), 0);
  SetChannel(getChannel(ID_M2, 'prism_1'), 0);

  if (phase === 'reposition') {
    adapter.setPanTilt(ID_M1, { pan: MP_M1.PAN_C, tilt: MP_M1.TILT_F });
    adapter.setPanTilt(ID_M2, { pan: MP_M2.PAN_C, tilt: MP_M2.TILT_F });
    adapter.setMovementSpeed(ID_M1, SPEED_REPOSITION);
    adapter.setMovementSpeed(ID_M2, SPEED_REPOSITION);
    adapter.setDimmer(ID_M1, 0);
    adapter.setDimmer(ID_M2, 0);

    if (phaseTick >= REPOSITION_TICKS) { phase = 'descend'; phaseTick = 0; }
  } else {
    const p = Math.min(1, phaseTick / (DESCEND_TICKS - 1));
    adapter.setPanTilt(ID_M1, { pan: MP_M1.PAN_C, tilt: lerp(MP_M1.TILT_F, MP_M1.TILT_A, p) });
    adapter.setPanTilt(ID_M2, { pan: MP_M2.PAN_C, tilt: lerp(MP_M2.TILT_F, MP_M2.TILT_A, p) });
    adapter.setMovementSpeed(ID_M1, SPEED_DESCEND);
    adapter.setMovementSpeed(ID_M2, SPEED_DESCEND);
    adapter.setDimmer(ID_M1, 1);
    adapter.setDimmer(ID_M2, 1);

    if (phaseTick >= DESCEND_TICKS) { phase = 'reposition'; phaseTick = 0; }
  }

  BRUTS.forEach((id, i) => adapter.setDimmer(id, wave01(tick + i * 25, 100, 0.30, 1)));
  adapter.setDimmer(ID_FITA, 0.70);
}

function OnTerminate() {
  adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
  adapter.setMovementSpeed(ID_M1, 0); adapter.setMovementSpeed(ID_M2, 0);
  BRUTS.forEach((id) => adapter.setDimmer(id, 0));
  adapter.setDimmer(ID_FITA, 0);
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function wave01(t, period, min01, max01) { return min01 + (max01 - min01) / 2 * (1 + Math.sin(2 * Math.PI * t / period)); }
```

## Notas

- `adapter.setPrism` só tem `'ligado'` calibrado hoje (o `'desligado'` que existiu numa sessão anterior sumiu do `shows/vp.show.json` atual) — a linha de prism acima fica em raw até esse valor voltar; trocar por `adapter.setPrism(id, 'desligado')` assim que existir.
- `strobo` não é tocado neste efeito (o original ligava strobo=255 junto com fecho, mas como capability `strobe` só tem valores de velocidade calibrados, não um "aberto" — se precisar do shutter sempre aberto sem estrobar, usar raw: `SetChannel(getChannel(id,'strobo'), 255)`).
