# mov-desc-seq-fade.js — versão corrigida (adapter-first)

Fixes: (1) fade de lâmpada vira um contador **global, nunca reiniciado** — some a descontinuidade de brilho no handoff; (2) `needsInitialPosition`/`applyStrategicPositioning` removidos (código morto confirmado); (3) `returnRibaltaHidden`/`holdRibaltaAtLow` viram uma função só.

```js
// mov-desc-seq-fade — MH e Ribalta alternam descida, com handoff sem costura. Preset: mov-preset.js
const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';
const ID_R1 = 'fixture_1780805067518_ribalta_1';
const ID_R2 = 'fixture_1780805067518_ribalta_2';
const ID_FITA = 'fixture_1780805067518_fita_led';

const MH_TICKS = 75, RIB_TICKS = 75, TRAVEL_FRAC = 0.5, TAIL = 8;
const FADE_TICKS = 25;
const SPEED_MH = 0.47, SPEED_RIB = 0.35; // ~120/255, ~90/255

let phase = 'mh', mhTick = 0, ribTick = 0;
let lampFadeTick = 0; // FIX: nunca reseta por fase — só sobe, satura em FADE_TICKS e fica lá

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function fadeLevel(tick, duration) { return Math.min(1, tick / (duration - 1)); }

function ribApply(ribId, tilt, speed01) {
  const fn = getChannel(ribId, 'function');
  const tiltCh = getChannel(ribId, 'tilt');
  if (fn !== null) SetChannel(fn, 0);
  if (tiltCh !== null) SetChannel(tiltCh, tilt);
  adapter.setMovementSpeed(ribId, speed01);
}

function OnStart() {
  phase = 'mh'; mhTick = 0; ribTick = 0; lampFadeTick = 0;
}

function applyMH(p, forceFullFecho) {
  adapter.setColor(ID_M1, 'white'); adapter.setColor(ID_M2, 'white');
  const tiltEnd1 = lerp(MP_M1.TILT_F, MP_M1.TILT_A, TRAVEL_FRAC);
  const tiltEnd2 = lerp(MP_M2.TILT_F, MP_M2.TILT_A, TRAVEL_FRAC);
  adapter.setPanTilt(ID_M1, { pan: MP_M1.PAN_C, tilt: lerp(MP_M1.TILT_F, tiltEnd1, p) });
  adapter.setPanTilt(ID_M2, { pan: MP_M2.PAN_C, tilt: lerp(MP_M2.TILT_F, tiltEnd2, p) });
  adapter.setMovementSpeed(ID_M1, SPEED_MH); adapter.setMovementSpeed(ID_M2, SPEED_MH);

  if (!forceFullFecho) lampFadeTick++; // só acumula fade enquanto o MH está "entrando"
  const fecho = forceFullFecho ? 1 : fadeLevel(lampFadeTick, FADE_TICKS); // FIX: sempre a mesma curva
  adapter.setDimmer(ID_M1, fecho); adapter.setDimmer(ID_M2, fecho);
}

function OnExecute() {
  if (phase === 'mh') {
    const p = Math.min(1, mhTick / (MH_TICKS - 1));
    applyMH(p, false);
    ribApply(ID_R1, MP_RIB.TILT_LOW, 0); ribApply(ID_R2, MP_RIB.TILT_LOW, 0);
    adapter.setDimmer(ID_R1, 0); adapter.setDimmer(ID_R2, 0);

    mhTick++;
    if (mhTick >= MH_TICKS) { phase = 'rib'; ribTick = 0; }
  } else {
    const p = Math.min(1, ribTick / (RIB_TICKS - 1));
    const tailLeft = RIB_TICKS - ribTick;
    const inHandoff = tailLeft <= TAIL;

    if (inHandoff) {
      applyMH(Math.min(1, (TAIL - tailLeft) / (MH_TICKS - 1)), true); // FIX: usa a mesma curva de fecho (já em 1)
    } else {
      adapter.setColor(ID_M1, 'white'); adapter.setColor(ID_M2, 'white');
      adapter.setPanTilt(ID_M1, { pan: MP_M1.PAN_C, tilt: MP_M1.TILT_F });
      adapter.setPanTilt(ID_M2, { pan: MP_M2.PAN_C, tilt: MP_M2.TILT_F });
      adapter.setMovementSpeed(ID_M1, 0); adapter.setMovementSpeed(ID_M2, 0);
      adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
    }

    const ribTilt = lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, p);
    const ribDim = inHandoff ? Math.max(0, (tailLeft - 1) / (TAIL - 1)) : fadeLevel(ribTick, FADE_TICKS);
    ribApply(ID_R1, ribTilt, SPEED_RIB); ribApply(ID_R2, ribTilt, SPEED_RIB);
    adapter.setDimmer(ID_R1, ribDim); adapter.setDimmer(ID_R2, ribDim);

    ribTick++;
    if (ribTick >= RIB_TICKS) { phase = 'mh'; mhTick = TAIL; } // continua a curva de tilt do handoff
  }

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

- `lampFadeTick` só incrementa enquanto `forceFullFecho` é `false` — no handoff ele já para de subir (fica travado em `FADE_TICKS`, ou seja, `fecho = 1` direto), e ao voltar pra fase `'mh'` a curva continua exatamente de onde parou porque o contador nunca foi zerado. É essa continuidade que elimina o degrau de brilho.
- `applyStrategicPositioning`/`needsInitialPosition`/`holdRibaltaAtLow` (duplicata de `returnRibaltaHidden`) não têm equivalente aqui — eram código morto, confirmado por não produzirem nenhuma diferença observável no original.
