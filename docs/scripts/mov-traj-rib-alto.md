# mov-traj-rib-alto.js — versão corrigida (adapter-first)

**Nota de nome:** este script não toca ribalta nenhuma — recomendação é renomear o arquivo real pra algo como `mov-traj-mh-alto.js` na próxima leva (sem "rib"). Aqui documentado o efeito de MH corrigido, que é o que ele de fato faz.

Fixes: (1) MH2 ganha sua própria tabela (`MP_M2`), não mais a curva do MH1; (2) o loop fecha suavemente sozinho (keyframe de fechamento), então o salto de pan a cada ~28.8s desaparece sem precisar reproteger a cada repetição — só o `warmup` inicial (na ativação) continua existindo.

```js
// mov-traj-mh-alto — trajetória 8 fases MH, calibrada por fixture. Preset: mov-preset.js
const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';

const MH_KEYS = [
  { pan: 'PAN_L', tilt: 'TILT_A',     dur: 150, spd: 0.80 },
  { pan: 'PAN_R', tilt: 'TILT_FLOOR', dur: 130, spd: 0.75 },
  { pan: 'PAN_L', tilt: 'TILT_FLOOR', dur: 60,  spd: 0.65 },
  { pan: 'PAN_R', tilt: 'TILT_MID',   dur: 80,  spd: 0.71 },
  { pan: 'PAN_R', tilt: 'TILT_MID',   dur: 50,  spd: 0.86 },
  { pan: 'PAN_L', tilt: 'TILT_FLOOR', dur: 120, spd: 0.69 },
  { pan: 'PAN_C', tilt: 'TILT_FLOOR', dur: 80,  spd: 0.61 },
  { pan: 'PAN_L', tilt: 'TILT_A',     dur: 40,  spd: 0.58 }, // FIX: fecha o loop suavemente
];
const MH_CYCLE = MH_KEYS.reduce((s, k) => s + k.dur, 0);
const WARMUP_TICKS = 50;

let tick = 0, runPhase = 'warmup', warmupTick = 0;

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function mhStateForPhase(phase, pos) {
  const p = phase % MH_CYCLE;
  let acc = 0;
  for (let i = 0; i < MH_KEYS.length; i++) {
    const k = MH_KEYS[i];
    const next = MH_KEYS[(i + 1) % MH_KEYS.length];
    if (p < acc + k.dur) {
      const t = (p - acc) / k.dur;
      return { pan: lerp(pos[k.pan], pos[next.pan], t), tilt: lerp(pos[k.tilt], pos[next.tilt], t), spd: k.spd };
    }
    acc += k.dur;
  }
  return { pan: pos[MH_KEYS[0].pan], tilt: pos[MH_KEYS[0].tilt], spd: MH_KEYS[0].spd };
}

function OnStart() { tick = 0; runPhase = 'warmup'; warmupTick = 0; }

function OnExecute() {
  if (runPhase === 'warmup') {
    warmupTick++;
    const s1 = mhStateForPhase(0, MP_M1), s2 = mhStateForPhase(0, MP_M2);
    adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
    adapter.setPanTilt(ID_M1, { pan: s1.pan - MP_MH_GAP, tilt: s1.tilt });
    adapter.setPanTilt(ID_M2, { pan: s2.pan + MP_MH_GAP, tilt: s2.tilt });
    adapter.setMovementSpeed(ID_M1, MP_MH_SPEED_SLOW / 255);
    adapter.setMovementSpeed(ID_M2, MP_MH_SPEED_SLOW / 255);
    if (warmupTick >= WARMUP_TICKS) runPhase = 'run';
    return;
  }

  tick++;
  const mhPhase = tick % MH_CYCLE;
  const s1 = mhStateForPhase(mhPhase, MP_M1);
  const s2 = mhStateForPhase(mhPhase, MP_M2); // FIX: era mhStateForPhase(mhPhase, MP_M1) pros dois

  adapter.setColor(ID_M1, 'white'); adapter.setColor(ID_M2, 'white');
  adapter.setDimmer(ID_M1, 1); adapter.setDimmer(ID_M2, 1);
  adapter.setPanTilt(ID_M1, { pan: s1.pan - MP_MH_GAP, tilt: s1.tilt });
  adapter.setPanTilt(ID_M2, { pan: s2.pan + MP_MH_GAP, tilt: s2.tilt });
  adapter.setMovementSpeed(ID_M1, s1.spd); adapter.setMovementSpeed(ID_M2, s2.spd);
}

function OnTerminate() {
  adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
  adapter.setMovementSpeed(ID_M1, 0); adapter.setMovementSpeed(ID_M2, 0);
}
```

## Notas

- `mhStateForPhase(phase, pos)` recebe a tabela de posições como parâmetro — chamado com `MP_M1` pro MH1 e `MP_M2` pro MH2, cada um seguindo sua própria calibração física.
- Último keyframe (`dur: 40`) repete o primeiro (`PAN_L`/`TILT_A`) — fecha o ciclo sem depender de proteção especial a cada repetição, resolvendo o salto que só o `warmup` inicial cobria antes.
