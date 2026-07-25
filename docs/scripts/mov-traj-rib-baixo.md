# mov-traj-rib-baixo.js — recomendação: consolidar com mov-traj-rib-alto.js

Este script era idêntico a `mov-traj-rib-alto.js` em tudo (mesmas 8 fases, mesmas durações/velocidades, mesmo `warmup`) — a única diferença real era usar extremos crus (`MH_X`) em vez de `MP_M1`/`MP_M2` calibrados. Depois de aplicar a mesma correção (posições calibradas por fixture + keyframe de fechamento, ver `mov-traj-rib-alto.md`), os dois arquivos ficam **funcionalmente iguais** — não faz sentido manter dois scripts com o mesmo corpo.

**Fix teórico: não recriar este arquivo.** Se o pacote de 50 scripts precisar de duas variantes de trajetória (uma "alta", uma "baixa"), a diferenciação deve vir de **parâmetros reais** — outro conjunto de keyframes com tilt mais alto/baixo — não de duas cópias que só diferem por um bug de calibração corrigido.

```js
// Se "alto" e "baixo" forem efeitos genuinamente diferentes, a diferença
// devia estar nos KEYFRAMES (outro tilt-alvo por fase), não em duas cópias
// inteiras do arquivo. Exemplo de parametrização:
function buildKeyframes(tiltBias) {
  return [
    { pan: 'PAN_L', tilt: 'TILT_A',     dur: 150, spd: 0.80 },
    { pan: 'PAN_R', tilt: tiltBias === 'baixo' ? 'TILT_FLOOR' : 'TILT_MID', dur: 130, spd: 0.75 },
    // ...demais fases, ajustando só o alvo de tilt conforme a variante
    { pan: 'PAN_L', tilt: 'TILT_A', dur: 40, spd: 0.58 }, // fecha o loop
  ];
}
```

## Notas

- Ver `mov-traj-rib-alto.md` pro código corrigido completo (per-fixture, loop fechado).
- Mesma observação de nome: "rib" não corresponde a nenhuma ribalta tocada — renomear pra algo como `mov-traj-mh-baixo.js` se a variante realmente for mantida como algo distinto de `mh-alto`.
