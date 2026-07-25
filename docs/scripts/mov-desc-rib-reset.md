# mov-desc-rib-reset.js — versão corrigida (adapter-first)

Fix de conteúdo: o nome promete Ribalta ("rib-reset") e o script original nunca tocava nenhuma — agora toca de verdade, sincronizada com o MH (desce junto, esconde junto no reset). Fix de timing: mesma correção de velocidade de reset de `mov-desc-full-reset.md`.

```js
// mov-desc-rib-reset — MH + Ribalta descem juntos, reset escondido. Preset: mov-preset.js
const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';
const ID_R1 = 'fixture_1780805067518_ribalta_1';
const ID_R2 = 'fixture_1780805067518_ribalta_2';
const ID_FITA = 'fixture_1780805067518_fita_led';

const DESCEND_TICKS = 300;
const RESET_TICKS = 60;                        // FIX: 35→60, com velocidade própria abaixo
const LOOP = DESCEND_TICKS + RESET_TICKS;
const SPEED_DESCEND = MP_MH_SPEED_SLOW / 255;
const SPEED_RESET = 0.20;                       // FIX: rápido de verdade, não igual ao descend

let tick = 0;
function OnStart() { tick = 0; }
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

// Ribalta: dimmer/speed via adapter; tilt/function raw (sem profile, sem 'pan').
function ribApply(ribId, tilt, speed01) {
  const fn = getChannel(ribId, 'function');
  const tiltCh = getChannel(ribId, 'tilt');
  if (fn !== null) SetChannel(fn, 0);
  if (tiltCh !== null) SetChannel(tiltCh, tilt);
  adapter.setMovementSpeed(ribId, speed01);
}

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
  adapter.setDimmer(ID_M1, descending ? 1 : 0);
  adapter.setDimmer(ID_M2, descending ? 1 : 0);

  const ribTilt = descending ? lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, p) : MP_RIB.TILT_LOW;
  ribApply(ID_R1, ribTilt, descending ? SPEED_DESCEND : SPEED_RESET);
  ribApply(ID_R2, ribTilt, descending ? SPEED_DESCEND : SPEED_RESET);
  adapter.setDimmer(ID_R1, descending ? 1 : 0);
  adapter.setDimmer(ID_R2, descending ? 1 : 0);

  adapter.setDimmer(ID_FITA, 0.70);
}

function OnTerminate() {
  adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
  adapter.setMovementSpeed(ID_M1, 0); adapter.setMovementSpeed(ID_M2, 0);
  adapter.setDimmer(ID_R1, 0); adapter.setDimmer(ID_R2, 0);
  ribApply(ID_R1, MP_RIB.TILT_LOW, 0); ribApply(ID_R2, MP_RIB.TILT_LOW, 0);
  adapter.setDimmer(ID_FITA, 0);
}
```

## Notas

- Se a intenção real era só "MH sem bruts, sem ribalta" (igual a `mov-desc-mh-brut.js`), este arquivo é redundante com `mov-desc-full-reset.js` sem bruts — nesse caso, **não recriar**, e sim renomear o F-key pra algo que não prometa "rib". A versão acima assume que "rib" era pra valer e completa o que faltava.
