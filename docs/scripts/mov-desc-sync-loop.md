# mov-desc-sync-loop.js — versão corrigida (adapter-first)

Fix crítico: adiciona a fase de reset escondido que faltava por completo (lâmpada/ribalta sempre acesas + salto de posição a cada 12s no original). Remove as 6 constantes mortas e a duplicata `LOOP`/`F2`.

```js
// mov-desc-sync-loop — MH + Ribalta descem juntos, reset escondido. Preset: mov-preset.js
const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';
const ID_R1 = 'fixture_1780805067518_ribalta_1';
const ID_R2 = 'fixture_1780805067518_ribalta_2';
const ID_FITA = 'fixture_1780805067518_fita_led';
const BRUTS = [
  'fixture_1780805067518_mini_brut_01', 'fixture_1780805067518_mini_brut_02',
  'fixture_1780805067518_mini_brut_03', 'fixture_1780805067518_mini_brut_04',
];

const DESCEND_TICKS = 300;   // FIX: nome único — antes existiam LOOP e F2 com o mesmo valor
const RESET_TICKS = 60;      // FIX: fase de reset que não existia — sem ela havia salto visível a cada ciclo
const LOOP = DESCEND_TICKS + RESET_TICKS;
const SPEED_DESCEND = MP_MH_SPEED_SLOW / 255;
const SPEED_RESET = 0.20;

let tick = 0;
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function wave01(t, period, min01, max01) { return min01 + (max01 - min01) / 2 * (1 + Math.sin(2 * Math.PI * t / period)); }

function ribApply(ribId, tilt, speed01) {
  const fn = getChannel(ribId, 'function');
  const tiltCh = getChannel(ribId, 'tilt');
  if (fn !== null) SetChannel(fn, 0);
  if (tiltCh !== null) SetChannel(tiltCh, tilt);
  adapter.setMovementSpeed(ribId, speed01);
}
function ribLeds(ribId, value01) {
  for (let i = 1; i <= 8; i++) {
    const led = getChannel(ribId, 'led_' + i);
    if (led !== null) SetChannel(led, Math.round(value01 * 255));
  }
}

function OnStart() { tick = 0; }

function OnExecute() {
  tick++;
  const cycleTick = tick % LOOP;
  const descending = cycleTick < DESCEND_TICKS;
  const p = descending ? cycleTick / (DESCEND_TICKS - 1) : 0;

  adapter.setColor(ID_M1, 'white'); adapter.setColor(ID_M2, 'white');
  adapter.setPanTilt(ID_M1, { pan: MP_M1.PAN_C, tilt: descending ? lerp(MP_M1.TILT_F, MP_M1.TILT_A, p) : MP_M1.TILT_F });
  adapter.setPanTilt(ID_M2, { pan: MP_M2.PAN_C, tilt: descending ? lerp(MP_M2.TILT_F, MP_M2.TILT_A, p) : MP_M2.TILT_F });
  adapter.setMovementSpeed(ID_M1, descending ? SPEED_DESCEND : SPEED_RESET);
  adapter.setMovementSpeed(ID_M2, descending ? SPEED_DESCEND : SPEED_RESET);
  adapter.setDimmer(ID_M1, descending ? 1 : 0); // FIX: era sempre 1 — agora fecha durante o reset
  adapter.setDimmer(ID_M2, descending ? 1 : 0);

  const ribTilt = descending ? lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, p) : MP_RIB.TILT_LOW;
  ribApply(ID_R1, ribTilt, descending ? SPEED_DESCEND : SPEED_RESET);
  ribApply(ID_R2, ribTilt, descending ? SPEED_DESCEND : SPEED_RESET);
  adapter.setDimmer(ID_R1, descending ? 1 : 0); // FIX: era sempre 1
  adapter.setDimmer(ID_R2, descending ? 1 : 0);
  ribLeds(ID_R1, descending ? 1 : 0);
  ribLeds(ID_R2, descending ? 1 : 0);

  BRUTS.forEach((id, i) => adapter.setDimmer(id, wave01(tick + i * 25, 100, 0.30, 1)));
  adapter.setDimmer(ID_FITA, 0.70);
}

function OnTerminate() {
  adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
  adapter.setMovementSpeed(ID_M1, 0); adapter.setMovementSpeed(ID_M2, 0);
  adapter.setDimmer(ID_R1, 0); adapter.setDimmer(ID_R2, 0);
  ribApply(ID_R1, MP_RIB.TILT_LOW, 0); ribApply(ID_R2, MP_RIB.TILT_LOW, 0);
  ribLeds(ID_R1, 0); ribLeds(ID_R2, 0);
  BRUTS.forEach((id) => adapter.setDimmer(id, 0));
  adapter.setDimmer(ID_FITA, 0);
}
```

## Notas

- As 6 constantes locais mortas (`M1_PAN_C` etc.) somem — o código usa só `MP_M1`/`MP_M2` do preset, uma fonte só.
- Mesma correção de velocidade de reset aplicada em todos os outros `mov-desc-*` com reset (`SPEED_RESET` distinto de `SPEED_DESCEND`).
