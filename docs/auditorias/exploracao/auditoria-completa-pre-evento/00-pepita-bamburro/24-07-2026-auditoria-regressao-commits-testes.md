# Auditoria — Regressão de Commits Recentes, Testes, Build e Tooling

> Auditoria **read-only**. Executor: subagente Claude (general-purpose). Auditor principal: Claude (Sonnet 5).
> Nenhum arquivo alterado. Data: 2026-07-24.
> `[fato]` = arquivo:linha / `git show`. `[análise]` = interpretação.

Escopo: revisão de regressão dos commits `7fe113f`, `65b56e4`, `67bb327`, `b148e2c`; varredura de TODO/FIXME/console.log/debugger em todo o repo; inventário e execução de testes; higiene de `package.json`/`vite.config.js`/`tools/`.

---

## Bugs reais

### [Crítico] `b148e2c` remapeou silenciosamente as teclas 1/2/3, sem aviso, sem teste
- [fato] Antes: `Main.jsx` tratava `/^[0-9]$/` inteiro como atalho de troca de **página de cena** (0→página 10).
- [fato] Depois de `b148e2c`: `/^[123]$/` é interceptado primeiro e, com `scriptListModeEnabled` (default `true`), passa a escolher qual **fileira de F-keys** está em uso — só `/^[04-9]$/` continua trocando página de cena.
- [análise] Pressionar `1`, `2` ou `3` **deixa de levar às páginas de cena 1, 2 e 3** — mudança de comportamento em atalho de teclado ao vivo, **não mencionada em nenhuma linha da mensagem de commit** ("fix: script:create/edit/clear passam a receber pageId explicito"). Como hoje (2026-07-24) é o dia do evento, é risco real para um operador que confia em memória muscular de teclado. Nenhum teste cobre atalhos de teclado do Main.jsx (não há testes de componente React no projeto).

### [Crítico] `b148e2c` dessincroniza `PainelOperacao.jsx` do novo modelo de páginas de `Main.jsx`
- [fato] `git show --stat b148e2c` confirma que só `electron/main.js`, `electron/preload.js`, `src/screens/Main.jsx` e um doc mudaram — **`PainelOperacao.jsx` não foi tocado**.
- [fato] `Main.jsx` foi reescrito para um modelo de "3 fileiras simultâneas de F-keys" com estado **local** (`scriptBankIndex`, `activeScriptListIndex`, `scriptListModeEnabled`, `scriptPageBanks`) — `setActiveScriptPageId` (estado compartilhado que `PainelOperacao.jsx` ainda usa) só é chamado no fallback de remoção de página (`Main.jsx:2765`), nunca mais quando o operador troca de banco/lista.
- [análise] Assim que o operador troca de banco/lista em `Main.jsx`, o `PainelOperacao.jsx` (painel touch) continua mostrando a página de scripts que estava ativa no carregamento — **as duas telas divergem silenciosamente**, sem nenhum teste cobrindo isso.

### [Alto] Hardening do `engine.js` (`7fe113f`) sem rate-limit no `console.error`
- [fato] Os 4 novos `try/catch` (engine.js:52-86) chamam `console.error` sem limitação de taxa, apesar do arquivo já ter o padrão pronto (`_stageStats.total.shouldWarn(...)`, usado 6 linhas abaixo para frame lento) — não reaproveitado.
- [análise] Se qualquer etapa lançar erro em todo frame, o log recebe ~25 msg/s indefinidamente durante o show inteiro — risco de I/O de console degradando performance, mesmo com o crash evitado.

### [Médio] Escopo do commit `b148e2c` não bate com a mensagem
- [fato] O fix descrito (propagar `pageId` explícito) está correto e completo. Mas o mesmo commit também implementa integralmente (382 linhas em `Main.jsx`) a feature especulativa de "3 fileiras + bancos" — cujo próprio relatório técnico incluído no commit (`docs/relatorios/2026-07-23-proposta-fkeys-3-fileiras-paginacao-scripts.md`) recomenda **validar com protótipo antes de implementar a lógica de bancos**, recomendação escrita no mesmo commit que já entrega a lógica pronta.
- [análise] Duas mudanças de risco muito diferente (fix cirúrgico vs. redesenho de UI + remap de atalhos) foram esmagadas num único commit — dificulta reverter só a parte arriscada se algo quebrar hoje.

### [Baixo] `tools/sync-scripts.js` obsoleto e potencialmente destrutivo
- [fato] Lê/escreve `show.scripts[fkey]={name,file}` (modelo legado achatado). `electron/show.js:295-329` deleta esse campo na migração e **dispara a migração legada de novo automaticamente** sempre que `show.scripts` aparecer não-vazio no show carregado.
- [análise] Rodar `node tools/sync-scripts.js` hoje grava `show.scripts` populado de volta; na próxima abertura, a migração roda de novo com risco real de sobrescrever/duplicar associações já existentes em `scriptLibrary`/`scriptPages`. **Não usar essa ferramenta.**

## Código morto / inconsistências
- `activeScriptPageId`/`toggleScriptAtActivePage` (showStore.js) não estão mortos globalmente (`PainelOperacao.jsx` ainda usa), mas pararam de ser fonte de verdade para `Main.jsx` — estado "zumbi" para metade do app (mesmo achado do relatório de frontend, seção 2.4).
- `tools/sync-scripts.js` é, na prática, ferramenta morta para o fluxo atual — nenhum script npm o referencia.

## Pontos de melhoria
- `main.js:521-554` (`show:save`) e `main.js:1161-1185` (`script:create`) fazem dump verboso incondicional de estado a cada clique — sem flag de debug (pré-existente, não introduzido pelos 4 commits auditados).
- `Main.jsx:1126` — `console.log('[ribalta2-debug]', ...)` no renderer, **sem gate de flag**, diferente do equivalente no main (`VP_RIBALTA_DEBUG=1`, main.js:2160).
- **Cobertura de teste é 100% backend, 0% frontend** — os dois bugs críticos desta seção (remap de teclado, dessincronia de painel) são exatamente o tipo que só testes de componente/integração de UI pegariam.

## Varredura ampla do repositório

**TODO/FIXME/HACK/XXX**: [fato] **zero ocorrências reais** em `electron/`, `src/`, `scripts/`, `tools/`. Os 2 únicos hits são falsos positivos (palavra "TODO/TODOS" em português, dentro de comentários de `artnet.js:176,215`).

**debugger**: [fato] nenhuma ocorrência em todo o repositório.

**console.log**:
- `electron/` — 36 ocorrências (show.js, main.js, ribaltaPhysicalCalib.js, artnet.js, interpolator.js, ribaltaDebug.js — este último é debug explícito por design, engine.js). Maioria são logs de ciclo de vida aceitáveis; destaque para `main.js:521-554`/`1161-1185` (dumps verbosos incondicionais em caminho normal de uso).
- `src/` — 1 ocorrência (`Main.jsx:1126`, sem gate — ver acima).

**Arquivos de teste**: [fato] 10 arquivos, todos em `tests/`, todos cobrindo `electron/` (engine/adapter/show/scriptLibrary). **Nenhum cobre `src/` (React).**

## Execução real dos testes
```
Comando: npm test (= vitest run)
Test Files  10 passed (10)
     Tests  142 passed (142)
   Duration ~0.8-2s
```
100% passando, 0 falhas — confirma a alegação do commit `65b56e4`.

## Higiene geral
- `package.json`: todos os 8 scripts npm apontam para arquivos existentes; nenhuma dependência órfã.
- `vite.config.js`: dois entry points (`index.html`, `viewer3d.html`) consistentes com a janela separada do preview 3D. Sem problemas.
- `tools/sync-scripts.js` — obsoleto/perigoso (ver acima). Demais scripts de `tools/` (launchers/instaladores de SO) sem problemas, sem referência ao modelo antigo F1-F12.

## Resumo priorizado

**Crítico**
1. `b148e2c` — remap silencioso das teclas 1/2/3 (deixam de trocar página de cena), sem menção no commit, sem teste, no dia do evento.
2. `b148e2c` — `PainelOperacao.jsx` dessincronizado do novo modelo de páginas de `Main.jsx` (painel touch trava na página inicial).

**Alto**
3. `console.error` sem rate-limit nos novos try/catch de `engine.js` — risco de log flood em falha recorrente durante o show (reforça achado do relatório de engine).
4. Escopo do commit `b148e2c` não corresponde à mensagem — fix pequeno + feature grande especulativa no mesmo commit.

**Médio**
5. `tools/sync-scripts.js` obsoleto e potencialmente destrutivo contra o schema atual.
6. Lacuna de cobertura de teste 100% backend / 0% frontend — exatamente o tipo de teste que pegaria os itens 1 e 2.

**Baixo**
7. `console.log` verbosos incondicionais em `main.js` (show:save, script:create) e `Main.jsx:1126` sem gate de debug.
8. `activeScriptPageId` como estado "zumbi" para metade do app.

**Sem achados**: `65b56e4` (mapeamento físico MH1/MH2) é o commit mais coerente e completo dos 4 auditados; `67bb327` é só documentação; TODO/FIXME/HACK/XXX/debugger — zero ocorrências reais; `package.json`/`vite.config.js` sem problemas.
