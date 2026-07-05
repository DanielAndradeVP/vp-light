# Schema Com Três Tipos

> Mina: adapter-universal — origem: docs/auditorias/bateamento/plano-adapter-universal.md

## 3. Proposta — 3 tipos de adaptação num schema retrocompatível

Um mapeamento sem campo `type` continua sendo o mapa escalar de hoje
(**zero mudança** nos adapters existentes dos dois moving heads). Com `type`,
ganha superpoderes:

```jsonc
"adapters": {
  // TIPO 1 (legado, implícito) — mapa escalar: lógico → DMX
  "color": { "red": 30, "white": 0, "_default": 0 },

  // TIPO 2 — transform: correção contínua de UM canal (alias fixo)
  // Aplicada sobre o valor cru que o script pediu, na ordem:
  // invert → scale → offset → clamp(min..max)
  "fix_dimmer": { "type": "transform", "alias": "dimmer",
                  "scale": 0.85, "offset": 0, "invert": false,
                  "min": 0, "max": 200 },
  "fix_tilt":   { "type": "transform", "alias": "tilt", "offset": 6 },

  // TIPO 3 — preset: um nome lógico vira VÁRIOS canais de uma vez
  "preset": { "type": "preset",
              "warm":  { "red": 255, "green": 140, "blue": 40 },
              "frio":  { "red": 60,  "green": 120, "blue": 255 } }
}
```

Com isso o usuário corrige **qualquer canal** (transform em qualquer alias),
**qualquer valor** (mapa/range/limite/inversão/offset) e **qualquer
equipamento** (o campo `adapters` já existe em todo fixture do show) — só
editando o `.show.json`, que o adapter lê ao vivo a cada chamada.
