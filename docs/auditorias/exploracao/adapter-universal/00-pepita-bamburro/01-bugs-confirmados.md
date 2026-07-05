# Bugs Confirmados

> Mina: adapter-universal — origem: docs/auditorias/bateamento/plano-adapter-universal.md

## 1. Bugs encontrados (confirmados por teste)

### BUG 1 — ALTO: normalização assimétrica (chave gravada nunca normalizada)
`resolve()` normaliza a *consulta* (`normalizeKey(logicalValue)` → minúsculas,
sem acento) mas compara contra as chaves **cruas** do show via `hasOwnProperty`.

Teste real executado:
| No show.json | Consulta do script | Resultado |
|---|---|---|
| `"Azul Claro": 90` | `'Azul Claro'` | **null** (esperado 90) |
| `"red": 30` | `'red'` | 30 ✓ |
| adapterKey `"Color"` | `'color'` | **null** (esperado 30) |

Consequência: se o usuário escrever no show qualquer chave com maiúscula,
acento ou espaço nas pontas, o valor fica **inalcançável para sempre** — e a
falha é silenciosa (retorna `null`, o script pula a escrita). Como a proposta é
justamente o usuário criar/editar adaptações à mão no show, este bug é o
primeiro a corrigir.

**Correção:** normalizar as chaves do mapeamento no momento do lookup
(ou pré-indexar): procurar `normalizeKey(k) === logical` entre as chaves de
`mapping`, e `normalizeKey(k) === key` entre as chaves de `adapters`.

### BUG 2 — MÉDIO: checagem falsy do canal (linha 55)
`if (!getChannelByAlias(fixture, alias)) return null;` usa falsy em vez de
`=== null`. Hoje funciona porque canais são 1-based (nunca 0), mas é uma bomba
armada: qualquer refactor que passe a devolver índice 0-based quebra o adapter
silenciosamente. Trocar por `getChannelByAlias(fixture, alias) === null`.

### BUG 3 — MÉDIO: falha 100% silenciosa (null sem diagnóstico)
`null` significa ao mesmo tempo: fixture inexistente, fixture desabilitado,
alias sem canal, adapterKey ausente, valor lógico ausente, valor não numérico
— e o `catch {}` engole até erro de programação. Impossível para o usuário
descobrir *por que* a adaptação que ele acabou de criar não funciona.

**Correção:** manter o contrato `null` (scripts dependem dele), mas logar uma
única vez por combinação `(fixtureId, key, logical)` no console do main
(`console.warn('[adapter] ...motivo...')`, com dedupe via `Set`). Em culto não
polui; em desenvolvimento diagnostica na hora.

### BUG 4 — BAIXO: sem fallback `_default`
Valor lógico ausente → `null` → script pula a escrita. Um mapeamento como
`{ "red": 30, "_default": 0 }` permitiria degradar para um valor seguro em vez
de simplesmente não escrever.
