# Impacto Por Arquivo

> Mina: adapter-universal — origem: docs/auditorias/bateamento/plano-adapter-universal.md

> Consumidores atuais (raio de impacto): apenas o sandbox de `electron/main.js`
> (`buildScriptSandbox` → `adapter.resolve`) e `scripts/fire-base.js`. Nenhuma
> tela React usa o adapter. Evoluir aqui é seguro.

## 5. Mudanças por arquivo (pequenas e cirúrgicas)

1. **`electron/adapter.js`** — corrigir BUG 1/2/3/4; adicionar `value()` e
   `preset()`; ~+80 linhas. Continua módulo puro (recebe `getFixture`/
   `getChannelByAlias`/`isEnabled` como argumentos — testável sem Electron).
2. **`electron/main.js`** — só em `buildScriptSandbox` (~linha 1062): expor
   `adapter.value` e `adapter.preset` ao lado do `resolve` existente. ~6 linhas.
3. **Engine/compositor/universe** — **nenhuma mudança**. A correção acontece na
   borda do script (antes do `SetChannel` da camada), então cenas, faders
   manuais e a calibração física da ribalta continuam intocados.
