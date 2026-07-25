# mov-desc-full-reset.js — versão corrigida (adapter-first)

Fix: `MOVING_SPEED_RESET` vira realmente diferente de `MOVING_SPEED_DESCEND` (rápido, não a mesma velocidade lenta) — só assim o reset de 35 ticks tem chance física de completar. Resto via `adapter.set*`.

```js
// mov-desc-full-reset — descida MH + bruts + fita, reset escondido. Preset: mov-preset.js
const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';
const ID_FITA = 'fixture_1780805067518_fita_led';
const BRUTS = [
  'fixture_1780805067518_mini_brut_01', 'fixture_1780805067518_mini_brut_02',
  'fixture_1780805067518_mini_brut_03', 'fixture_1780805067518_mini_brut_04',
];

const DESCEND_TICKS = 300;
const RESET_TICKS = 60;           // FIX: 35→60 ticks, e velocidade própria (ver abaixo)
const LOOP = DESCEND_TICKS + RESET_TICKS;

const SPEED_DESCEND = MP_MH_SPEED_SLOW / 255; // lento, visível
const SPEED_RESET = 0.20;                     // FIX: era igual ao descend — agora é rápido de verdade

let tick = 0;

function OnStart() { tick = 0; }

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function wave01(t, period, min01, max01) { return min01 + (max01 - min01) / 2 * (1 + Math.sin(2 * Math.PI * t / period)); }

function OnExecute() {
  tick++;
  const cycleTick = tick % LOOP;
  const descending = cycleTick < DESCEND_TICKS;

  adapter.setColor(ID_M1, 'white'); adapter.setColor(ID_M2, 'white');
  adapter.setPanTilt(ID_M1, { pan: MP_M1.PAN_C, tilt: descending
    ? lerp(MP_M1.TILT_F, MP_M1.TILT_A, cycleTick / (DESCEND_TICKS - 1))
    : MP_M1.TILT_F });
  adapter.setPanTilt(ID_M2, { pan: MP_M2.PAN_C, tilt: descending
    ? lerp(MP_M2.TILT_F, MP_M2.TILT_A, cycleTick / (DESCEND_TICKS - 1))
    : MP_M2.TILT_F });

  adapter.setMovementSpeed(ID_M1, descending ? SPEED_DESCEND : SPEED_RESET);
  adapter.setMovementSpeed(ID_M2, descending ? SPEED_DESCEND : SPEED_RESET);
  adapter.setDimmer(ID_M1, descending ? 1 : 0);
  adapter.setDimmer(ID_M2, descending ? 1 : 0);

  BRUTS.forEach((id, i) => adapter.setDimmer(id, wave01(cycleTick + i * 25, 100, 0.30, 1)));
  adapter.setDimmer(ID_FITA, 0.70);
}

function OnTerminate() {
  adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
  adapter.setMovementSpeed(ID_M1, 0); adapter.setMovementSpeed(ID_M2, 0);
  BRUTS.forEach((id) => adapter.setDimmer(id, 0));
  adapter.setDimmer(ID_FITA, 0);
}
```

## Notas

- `mov-desc-mh-brut.js` era uma cópia byte-a-byte deste arquivo — **não recriar como script separado**; se a versão "sem Mini Brut" fizer falta, é só remover o array `BRUTS` e as duas linhas que o usam, mas registrar como variante explícita, não duplicata acidental.
- Prism continua raw (sempre 0, sem valor "desligado" calibrado ainda) — mesma nota de `mov-desc-branco.md`.
