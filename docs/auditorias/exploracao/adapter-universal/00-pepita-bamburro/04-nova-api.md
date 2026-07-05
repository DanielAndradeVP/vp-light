# Nova API

> Mina: adapter-universal — origem: docs/auditorias/bateamento/plano-adapter-universal.md

## 4. Nova API (retrocompatível — `resolve` não muda)

| Função | Assinatura | Devolve | Uso |
|---|---|---|---|
| `resolve` | `(id, alias, key, logico)` | DMX \| null | **inalterada** (tipo 1) |
| `value` | `(id, alias, valorCru)` | DMX corrigido (ou o cru) | tipo 2 — aplica todo transform cujo `alias` case; **nunca** devolve null para entrada válida: sem transform, passa o valor adiante. É o gancho de "correção automática". |
| `preset` | `(id, key, logico)` | `{alias: DMX, ...}` \| null | tipo 3 — o chamador escreve cada alias |

Regras:
- `value()` é **identidade por padrão** — fixture sem transform se comporta
  exatamente como hoje. É isso que permite a base comum chamá-la em *toda*
  escrita sem risco.
- Chaves e nomes lógicos normalizados dos **dois lados** (corrige BUG 1).
- Diagnóstico com dedupe (corrige BUG 3). `_default` no tipo 1 (BUG 4).
