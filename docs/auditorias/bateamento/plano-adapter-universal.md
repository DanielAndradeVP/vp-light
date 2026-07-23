# Plano — Adapter universal (`electron/adapter.js`)

> Objetivo: evoluir o adapter para que **qualquer canal ou valor de qualquer
> equipamento DMX** possa ser corrigido/adaptado editando só o `.show.json` —
> sem tocar em engine nem em scripts.
> Consumidores atuais (raio de impacto): apenas o sandbox de `electron/main.js`
> (`buildScriptSandbox` → `adapter.resolve`) e `scripts/fire-base.js`. Nenhuma
> tela React usa o adapter. Evoluir aqui é seguro.

---

## 1. Bugs encontrados (confirmados por teste)

> **Status de risco — auditoria 2026-07-23 (véspera do evento Fire):**
> BUG 1 confirmado presente no `electron/adapter.js` mesclado em main (linha 378,
> `hasOwnProperty.call(mapping, logical)` contra chave normalizada). Bug
> **sem risco para o evento de amanhã**: o único ponto de chamada é
> `fb_mhColor()` em `scripts/fire-base.js`, e nenhum script `fire-*.js` ativo
> hoje chama essa função (`fire-base.js` está inerte, só a própria lib existe
> na pasta `scripts/`). Ressalva: se um script novo `fire-*.js` for criado
> antes do evento usando `fb_mhColor`/`adapter.resolve` com nome de cor em
> maiúscula, com acento ou espaço nas pontas, ele vai bater nesse bug (retorno
> `null` silencioso). Enquanto BUG 1 não for corrigido, usar só chaves de cor
> já normalizadas (minúsculo, sem acento, `_` no lugar de espaço) — é o formato
> que os dois moving heads já usam hoje no `vp.show.json`.

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

---

## 2. Limitação estrutural (por que hoje NÃO corrige "qualquer canal/valor")

O formato atual só expressa **mapa escalar 1-para-1**:
`nome lógico → um valor DMX em um canal`. Não expressa:

1. **Correção de valor contínuo** — "o dimmer desse PAR satura, limite em 200";
   "o tilt desse moving precisa de +6"; "esse canal é invertido (255=off)".
2. **Faixas (range)** — "strobe lento..rápido é 10..250 nesse modelo; no outro
   é 40..180". Scripts querem pedir `0..1` e cada fixture escala pro seu range.
3. **Preset multi-canal** — "cor 'warm' nesse PAR = red 255, green 140, blue 40"
   (3 canais de uma vez; a roda de cor resolve com 1 canal, RGB não).
4. **Vínculo adapterKey→canal** — hoje o script precisa saber *qual alias*
   escrever além de resolver o valor; o conhecimento fica dividido.

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

## 5. Mudanças por arquivo (pequenas e cirúrgicas)

1. **`electron/adapter.js`** — corrigir BUG 1/2/3/4; adicionar `value()` e
   `preset()`; ~+80 linhas. Continua módulo puro (recebe `getFixture`/
   `getChannelByAlias`/`isEnabled` como argumentos — testável sem Electron).
2. **`electron/main.js`** — só em `buildScriptSandbox` (~linha 1062): expor
   `adapter.value` e `adapter.preset` ao lado do `resolve` existente. ~6 linhas.
3. **Engine/compositor/universe** — **nenhuma mudança**. A correção acontece na
   borda do script (antes do `SetChannel` da camada), então cenas, faders
   manuais e a calibração física da ribalta continuam intocados.

## 6. Ordem de execução e validação

1. Corrigir BUG 1 e 2 + testes de unidade puros (`node`, sem Electron) cobrindo:
   chave acentuada/maiúscula, adapterKey maiúsculo, `_default`, canal null.
2. Adicionar `value()`/`preset()` + testes (identidade sem transform; ordem
   invert→scale→offset→clamp; preset com alias inexistente → ignorado).
3. Expor no sandbox (`main.js`) e reiniciar `npm run dev`.
4. Regressão: rodar os 14 scripts atuais — nenhum usa `value`/`preset`, e
   `resolve` mantém contrato → comportamento idêntico.

## 7. Critérios de aceite

- Editar um `transform` no show corrige o canal em **todos** os scripts que
  escrevem via base comum, sem tocar em nenhum script.
- Adapter novo com chave "Azul Claro" funciona (BUG 1 morto).
- Fixture sem adapters se comporta byte a byte como hoje.
- Toda falha de adaptação aparece uma vez no console do main com o motivo.
