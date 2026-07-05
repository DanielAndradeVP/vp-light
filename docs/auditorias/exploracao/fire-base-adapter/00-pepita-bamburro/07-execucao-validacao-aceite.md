# Execução, Validação e Aceite
> Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## 4. Ordem de execução

| # | Passo | Depende de |
|---|---|---|
| 1 | Implementar plano do adapter (bugs + `value`/`preset` + sandbox) | `plano-adapter-universal.md` |
| 2 | fire-base v2: `FB_ALIASES` + resolvers com `{id, ch}` (§2.1) | — (retrocompatível, pode até anteceder o 1 graças à degradação §2.2) |
| 3 | `fb_adapterValue` + `fb_write` + migrar helpers internos (§2.2) | 2 |
| 4 | `fb_wheel` / `fb_preset` / `fb_parColor` (§2.3) | 1, 3 |
| 5 | Atualizar harness `tools/validate-fire.js` com stubs de `adapter.value`/`preset` (identidade) + teste com transform fake provando a correção aplicada | 3 |
| 6 | Atualizar `guia-fire-base-como-usar.md` (novas funções + ressalvas §3) | 4 |

## 5. Validação (mesmo método da v1)

1. Compilar a base v2 no sandbox exato do engine sobre o show real — parse OK,
   ciclo de vida ausente, resolvers batendo com os canais conhecidos
   (MH1 pan=132, bruts 400/401/402/410, PAR layout B, `enabled:false` → null).
2. **Teste de identidade:** sandbox SEM `adapter.value` → cada helper produz
   exatamente os mesmos `SetChannel` da v1 (diff de writes vazio).
3. **Teste de correção:** sandbox COM `adapter.value` e um transform fake
   (`dimmer scale 0.5, max 100`) → `fb_dim(par, 255)` escreve 100; remover o
   transform → volta a escrever 255 sem recompilar o script.
4. **Teste de preset:** `fb_preset(par, 'preset', 'warm')` escreve os 3 canais
   definidos no show; alias inexistente no preset é ignorado sem erro.

## 6. Critérios de aceite

- Criar/editar uma adaptação (mapa, transform ou preset) de **qualquer**
  equipamento no show altera o comportamento de **todos** os scripts-fire que
  usam aquele fixture — zero edição de script, zero restart para valores.
- Sem adapters definidos, a base v2 é byte a byte equivalente à v1.
- Scripts escritos contra a v1 (exemplos do guia) rodam inalterados na v2.
- Nenhum script-fire contém `SetChannel` cru, ID literal ou número de canal —
  o checklist do guia e o harness continuam sendo o gate.
