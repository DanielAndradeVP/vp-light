# mov-preset.js — versão corrigida (adapter-first)

Problema original: o arquivo misturava **biblioteca** (constantes/helpers reusados por `mov-*.js`) com um **script executável próprio** (`OnStart`/`OnExecute`/`OnTerminate` do F10), que ficava sobrescrito sempre que injetado — dead code com risco real: se um `mov-*.js` futuro esquecer de declarar um dos três hooks, o hook "fantasma" do F10 passa a rodar escondido.

**Fix teórico:** biblioteca não declara `OnStart`/`OnExecute`/`OnTerminate`, ponto final. O efeito de 8 fases do F10 sai daqui e vira um script próprio (`mov-f10-standalone.js`), que só consome os helpers abaixo — mesmo padrão que `fire-base.js` já segue.

## O que vira `adapter.*` vs. o que continua cru

| Canal / capability | Antes (cru) | Agora |
|---|---|---|
| `fecho_lampada` (dimmer do beam) | `mp_ch(fecho, 255)` | `adapter.setDimmer(id, 1)` |
| `virtual_speed` | `mp_ch(speed, v)` | `adapter.setMovementSpeed(id, v/255)` |
| `pan`/`tilt` do MH | `mp_ch(pan, v)` / `mp_ch(tilt, v)` | `adapter.setPanTilt(id, { pan, tilt })` |
| `color_wheel` | pulso raw `1→0` | continua raw — é reset de motor, não escolha de cor |
| Ribalta `dimmer` | `mp_ch(r1Dim, v)` | `adapter.setDimmer(ribId, v/255)` |
| Ribalta `speed` | `mp_ch(r1Spd, v)` | `adapter.setMovementSpeed(ribId, v/255)` |
| Ribalta `tilt`/`function`/`led_N`/`strobo` | `mp_ch(...)` | **continua raw** — Ribalta não tem `fixtureProfile`; `setPanTilt` exige canal `pan`, que ela não tem |

## Biblioteca reescrita (só constantes + helpers, sem hooks)

```js
// mov-preset.js — biblioteca pura. PROIBIDO declarar OnStart/OnExecute/OnTerminate aqui.

const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50,  TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;
const MP_MH_SPEED_SLOW = 210; // 0..255 cru — pra adapter.setMovementSpeed use MP_MH_SPEED_SLOW/255

const MP_RIB = {
  TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190,
  SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170,
  DIM_ON: 255, DIM_WASH: 220,
};

// Move os dois MH com pan-base + gap simétrico. Sempre via adapter — nunca DMX cru.
function mp_moveMH(mh1Id, mh2Id, pan, tilt, speedNorm) {
  adapter.setPanTilt(mh1Id, { pan: pan - MP_MH_GAP, tilt });
  adapter.setPanTilt(mh2Id, { pan: pan + MP_MH_GAP, tilt });
  adapter.setMovementSpeed(mh1Id, speedNorm);
  adapter.setMovementSpeed(mh2Id, speedNorm);
}

function mp_openMH(mhId) { adapter.setDimmer(mhId, 1); }
function mp_closeMH(mhId) { adapter.setDimmer(mhId, 0); }

// "Acorda" a roda de cor (pulso 1→0) — sem equivalente semântico, é reset de motor.
function mp_wakeColorWheel(mhId) {
  const ch = getChannel(mhId, 'color_wheel');
  if (ch !== null) { SetChannel(ch, 1); SetChannel(ch, 0); }
}

// Ribalta: dimmer/speed via adapter; tilt/function/strobo crus (sem profile).
function mp_moveRibalta(ribId, tilt, speedNorm) {
  const fn = getChannel(ribId, 'function');
  const tiltCh = getChannel(ribId, 'tilt');
  if (fn !== null) SetChannel(fn, 0); // 0 = modo DMX manual
  if (tiltCh !== null) SetChannel(tiltCh, tilt);
  adapter.setMovementSpeed(ribId, speedNorm);
}

function mp_dimRibalta(ribId, value01) { adapter.setDimmer(ribId, value01); }

function mp_zeroRibalta(ribId, tiltRest) {
  mp_dimRibalta(ribId, 0);
  mp_moveRibalta(ribId, tiltRest, 0);
  const strobo = getChannel(ribId, 'strobo');
  if (strobo !== null) SetChannel(strobo, 0);
}
```

## `mov-f10-standalone.js` (efeito próprio, fora da biblioteca)

```js
// Preset: mov-preset.js — usa MP_M1/MP_M2/MP_MH_GAP/mp_moveMH/mp_openMH/mp_closeMH.
const MH1 = 'fixture_1780805067518_moving_head_beam_1';
const MH2 = 'fixture_1780805067518_moving_head_beam_2';

const KEYFRAMES = [
  { pan: MP_M1.PAN_L, tilt: MP_M1.TILT_A,     dur: 120 },
  { pan: MP_M1.PAN_R, tilt: MP_M1.TILT_FLOOR, dur: 120 },
  { pan: MP_M1.PAN_L, tilt: MP_M1.TILT_MID,   dur: 120 },
  { pan: MP_M1.PAN_C, tilt: MP_M1.TILT_FLOOR, dur: 120 },
  { pan: MP_M1.PAN_R, tilt: MP_M1.TILT_MID,   dur: 120 },
  { pan: MP_M1.PAN_C, tilt: MP_M1.TILT_A,     dur: 120 },
  { pan: MP_M1.PAN_L, tilt: MP_M1.TILT_A,     dur: 0   }, // fecha o loop (== keyframe 0)
];
const CYCLE = KEYFRAMES.reduce((s, k) => s + k.dur, 0) || 1; // FIX: nunca 0 (evita NaN)

let tick = 0;

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function smoothstep(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

function stateForPhase(phase) {
  const p = phase % CYCLE;
  let acc = 0;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const dur = KEYFRAMES[i].dur;
    if (dur > 0 && p < acc + dur) {
      const t = smoothstep((p - acc) / dur);
      return { pan: lerp(KEYFRAMES[i].pan, KEYFRAMES[i + 1].pan, t), tilt: lerp(KEYFRAMES[i].tilt, KEYFRAMES[i + 1].tilt, t) };
    }
    acc += dur;
  }
  return { pan: KEYFRAMES[0].pan, tilt: KEYFRAMES[0].tilt };
}

function OnStart() {
  tick = 0;
  mp_wakeColorWheel(MH1);
  mp_wakeColorWheel(MH2);
}

function OnExecute() {
  tick++;
  const s = stateForPhase(tick % CYCLE);
  mp_moveMH(MH1, MH2, s.pan, s.tilt, MP_MH_SPEED_SLOW / 255);
  mp_openMH(MH1);
  mp_openMH(MH2);
}

function OnTerminate() {
  mp_closeMH(MH1);
  mp_closeMH(MH2);
}
```

## Notas

- Removida a ribalta RGB estática do F10 (4 fixtures `enabled:false` no show atual — não produzia luz nenhuma; reintroduzir só se/quando forem reabilitadas).
- `CYCLE = ... || 1` fecha a falha de `phase % 0 = NaN` caso alguém zere todas as durações.
- `adapter.setDimmer`/`setMovementSpeed`/`setPanTilt` já clampam 0–255 internamente — não precisa mais de `mp_ch` pra esses três casos.
