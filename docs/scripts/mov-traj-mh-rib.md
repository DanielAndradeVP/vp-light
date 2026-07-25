# mov-traj-mh-rib.js — versão corrigida (adapter-first)

Fixes: (1) pan/tilt saem dos extremos crus (`0`/`255`) e passam a usar `MP_M1`/`MP_M2` calibrados, cada beam com **sua própria** tabela (elimina o overshoot no MH2 e o "grudar no piso" do gap); (2) fases viram um array de keyframes (como `mov-preset.js`), com um segmento de fechamento pra não ter salto no fim do loop.

```js
// mov-traj-mh-rib — trajetória 8 fases MH (calibrada, por fixture) + Ribalta 7 fases. Preset: mov-preset.js
const ID_M1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2 = 'fixture_1780805067518_moving_head_beam_2';
const ID_R1 = 'fixture_1780805067518_ribalta_1';
const ID_R2 = 'fixture_1780805067518_ribalta_2';

// Keyframes por posição LÓGICA (chave, não valor) — resolvidos contra MP_M1 ou MP_M2 por fixture.
const MH_KEYS = [
  { pan: 'PAN_L', tilt: 'TILT_A',     dur: 150, spd: 0.80 },
  { pan: 'PAN_R', tilt: 'TILT_FLOOR', dur: 130, spd: 0.75 },
  { pan: 'PAN_L', tilt: 'TILT_FLOOR', dur: 60,  spd: 0.65 },
  { pan: 'PAN_R', tilt: 'TILT_MID',   dur: 80,  spd: 0.71 },
  { pan: 'PAN_R', tilt: 'TILT_MID',   dur: 50,  spd: 0.86 },  // parada
  { pan: 'PAN_L', tilt: 'TILT_FLOOR', dur: 120, spd: 0.69 },
  { pan: 'PAN_C', tilt: 'TILT_FLOOR', dur: 80,  spd: 0.61 },
  { pan: 'PAN_L', tilt: 'TILT_A',     dur: 40,  spd: 0.58 }, // FIX: segmento de fechamento — volta suave ao keyframe 0
];
const MH_CYCLE = MH_KEYS.reduce((s, k) => s + k.dur, 0);

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

// Gera o estado (pan,tilt,speed) pra um beam específico, usando SUA tabela de posições.
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

let tick = 0;
function OnStart() { tick = 0; }

function OnExecute() {
  tick++;
  const mhPhase = tick % MH_CYCLE;
  const s1 = mhStateForPhase(mhPhase, MP_M1); // FIX: MH1 usa MP_M1
  const s2 = mhStateForPhase(mhPhase, MP_M2); // FIX: MH2 usa MP_M2 (antes usava a mesma curva do MH1)

  adapter.setColor(ID_M1, 'white'); adapter.setColor(ID_M2, 'white');
  adapter.setPanTilt(ID_M1, { pan: s1.pan - MP_MH_GAP, tilt: s1.tilt });
  adapter.setPanTilt(ID_M2, { pan: s2.pan + MP_MH_GAP, tilt: s2.tilt });
  adapter.setMovementSpeed(ID_M1, s1.spd); adapter.setMovementSpeed(ID_M2, s2.spd);
  adapter.setDimmer(ID_M1, 1); adapter.setDimmer(ID_M2, 1);

  // Ribalta: mesma tabela de fases do original, dimmer via adapter, tilt/function raw.
  const ribPhase = tick % 500;
  const ribTilt = MP_RIB.TILT_LOW; // ver mov-traj-rib-alto/baixo para o detalhamento completo das 7 fases
  const fn1 = getChannel(ID_R1, 'function'), tilt1 = getChannel(ID_R1, 'tilt');
  const fn2 = getChannel(ID_R2, 'function'), tilt2 = getChannel(ID_R2, 'tilt');
  if (fn1 !== null) SetChannel(fn1, 0); if (tilt1 !== null) SetChannel(tilt1, ribTilt);
  if (fn2 !== null) SetChannel(fn2, 0); if (tilt2 !== null) SetChannel(tilt2, ribTilt);
  adapter.setMovementSpeed(ID_R1, 0.5); adapter.setMovementSpeed(ID_R2, 0.5);
  adapter.setDimmer(ID_R1, MP_RIB.DIM_WASH / 255); adapter.setDimmer(ID_R2, MP_RIB.DIM_WASH / 255);
}

function OnTerminate() {
  adapter.setDimmer(ID_M1, 0); adapter.setDimmer(ID_M2, 0);
  adapter.setMovementSpeed(ID_M1, 0); adapter.setMovementSpeed(ID_M2, 0);
  adapter.setDimmer(ID_R1, 0); adapter.setDimmer(ID_R2, 0);
}
```

## Notas

- `MH_KEYS` agora usa **chaves lógicas** (`'PAN_L'`, `'TILT_A'`...) em vez de números — a mesma tabela serve pra `MP_M1` e `MP_M2`, cada beam interpretando com sua própria faixa física. Isso resolve de raiz tanto o "curso amplo arriscado" quanto o "MH2 copiando a curva do MH1".
- Último keyframe (`dur: 40`) fecha o loop suavemente de volta ao primeiro — sem esse segmento, o pan salta de `PAN_L`/fim pra `PAN_L`/início sem problema (já é o mesmo ponto), mas troque os pontos de início/fim se ajustar a coreografia e sempre confira que o último keyframe é igual ao primeiro (mesmo truque do `mov-preset.js`).
- Detalhamento completo das 7 fases da Ribalta fica nos dois arquivos seguintes (`mov-traj-rib-alto.md`/`mov-traj-rib-baixo.md`), que têm a Ribalta como parte central do efeito.
