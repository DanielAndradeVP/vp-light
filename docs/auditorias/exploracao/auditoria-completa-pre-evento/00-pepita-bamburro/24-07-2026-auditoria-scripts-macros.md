# Auditoria — Sistema de Scripts, Biblioteca e Macros

> Auditoria **read-only**. Executor: subagente Claude (general-purpose). Auditor principal: Claude (Sonnet 5).
> Nenhum arquivo alterado. Data: 2026-07-24.
> `[fato]` = arquivo:linha. `[análise]` = interpretação.

Escopo: `electron/scriptLibrary.js`, `scriptWatcherLogic.js`, todos os `scripts/*.js` ativos, cruzado com `scriptLibrary`/`scriptPages`/`macros` de `shows/vp.show.json`.

**Correção de premissa**: o auto-prepend de `mov-preset.js`/`fire-base.js` não está em `scriptLibrary.js`/`scriptWatcherLogic.js` (que só tratam CRUD/rename-correlation) — está em `electron/main.js:1083-1112` (`readScriptCode`, `scriptPrependsMovPreset`, `scriptPrependsFireBase`) e no reload em cascata (`main.js:1732-1748`).

---

## Achados de maior risco

### [Alto] `fire-base.js` reativado corretamente, mas nunca exercitado ponta a ponta
- [fato] `scriptPrependsMovPreset`/`scriptPrependsFireBase` (main.js:1086-1098) são mutuamente exclusivos via `if/else if` — **sem risco de prepend duplicado**. Reload em cascata trata `fire-base.js` simetricamente a `mov-preset.js`. A implementação do Checkpoint 10 está correta.
- [fato] Porém **só existe `fire-base.js` em `scripts/`** — nenhum `fire-*.js` consumidor foi criado. As ~30 funções de `fire-base.js` (429 linhas) são mecanismo pronto, 100% não exercitado.
- [fato] Guard de segurança testado: se `fire-base.js` for associado a um F-key, `compileScriptForSwap` rejeita por falta de hooks antes de virar camada — falha segura.
- **Recomendação: criar/testar ao menos um `fire-*.js` real antes de confiar nisso ao vivo.**

### [Alto] `mov-desc-branco.js` — fase "reposition" de 1 tick, glitch de luz acesa
- [fato] `scripts/mov-desc-branco.js:95-102` — a fase `'reposition'` (luz apagada) dura só 1 tick (40ms) antes de virar `'descend'` (luz acesa) no mesmo ciclo. Scripts irmãos (`mov-desc-full-reset.js:32-35`, `mov-desc-mh-brut.js:32-35`, `mov-desc-rib-reset.js:27-30`) reservam `RESET_TICKS=35` (~1,4s) para o mesmo propósito.
- [fato] Com `speed=210` (interpolator.js:135-146), viajar de `TILT_A` a `TILT_F` (42 unidades) leva ~21 ticks (~840ms) — muito mais que os 40ms disponíveis.
- [análise] A cada ciclo (~12,4s), a luz reabre enquanto o motor ainda está fisicamente perto da posição do ciclo anterior — flinch/glitch visível de luz acesa no início de cada ciclo do script associado a **F5**.

### [Alto] As 2 macros do show atual estão 100% quebradas (8/8 passos, script inexistente)
- [fato] `teste-0101` (4 passos: `mov-padrao-01..04`) e `teste020202` (4 passos: `brut-forte`, `brut-padrao-01`, `brut-padrao-03`, `mov-padrao-01`) — **nenhum dos 8 arquivos existe em `scripts/`**.
- [fato] `validateMacroReferences()` bloqueia o start com erro explícito (main.js:2001-2009) — **seguro**, mas são resíduos de teste 100% inoperantes. `loadMacros()` no boot não valida isso — a macro fica "carregada" silenciosamente até alguém tentar rodá-la.
- **Recomendação: remover ou corrigir essas 2 macros antes do evento**, para não confundir o operador que tentar usá-las ao vivo.

### [Médio] `mov-traj-mh-rib.js` sem fase de warmup (snap com luz acesa)
- [fato] `mov-traj-rib-alto.js`/`mov-traj-rib-baixo.js` têm `WARMUP_TICKS=50` (~2s, luz apagada) antes de abrir; `mov-traj-mh-rib.js` (associado a **F8**) abre o feixe imediatamente na posição corrente, que pode estar longe do início da trajetória.

### [Médio] `mov-desc-seq-fade.js` — "posicionamento estratégico" com speed=0 nunca ocorre de fato
- [fato] `applyStrategicPositioning()` seta `speed=0` (linha 132-150) mas é sobrescrito no mesmo tick por `applyMovingDescend()` que reescreve `speed=MH_DESCEND_SPEED(120)` — o "snap instantâneo" descrito no comentário nunca acontece.

### [Médio] Validação assimétrica: script via F-key vs. via passo de macro
- [fato] `startScriptById` usa `compileScriptForSwap`, que valida hooks e reporta erro de `OnStart` explicitamente (main.js:1280-1286). Já `compileLayer` (usado por macros, main.js:1146-1154) **não valida hooks** e engole erro de `OnStart` num catch vazio, sem log. Erro de compilação num passo de macro para a macro inteira **sem notificar `macroStepErrors`/UI** (compositor.js:394-423). Não afeta as 2 macros quebradas de hoje (bloqueadas antes por referência inexistente), mas é um buraco real para qualquer macro futura com script existente porém malformado.

---

## Código morto
- `fire-base.js` inteiro (429 linhas) — mecanismo correto, zero uso real (ver acima).
- `mov-preset.js:56-136` (`mp_resolveRibStatic`, `mp_applyRibStatic`, `mp_zeroRibStatic`, `MP_RIB_STATIC_IDS`) — usados só pelo próprio bloco standalone de `mov-preset.js`, nenhum dos outros 8 `mov-*.js` que recebem o preset injetado os usa; peso morto replicado em toda compilação.
- `mov-desc-mh-brut` — registrado na `scriptLibrary`, arquivo existe e compila, mas **não associado a nenhum F-key/página** — só acessível manualmente pela UI de biblioteca.
- `holdRibaltaAtLow()` em `mov-desc-seq-fade.js:176-179` — alias redundante de `returnRibaltaHidden()`.
- Fallback final de `mp_f10_mhStateForPhase` (mov-preset.js:199-200) — matematicamente inalcançável.
- `scripts/backlog/` — existia com 9 arquivos na auditoria de 05/07, **removida** entre 05/07 e hoje; mecanismo de exclusão no código (main.js:1397,1830) permanece sem nada para excluir.
- `scripts/casamento/` — nunca existiu como pasta real; era só exemplo hipotético num doc de auditoria anterior.

## Pontos de melhoria
- Duplicação de `ch()`/`lerp()`/`clamp01()`/`spulse()` e IDs de fixture hardcoded entre os 6 `mov-desc-*.js`, 3 `mov-traj-*.js` e 3 `brut-pisca-*.js` (até 5 cópias independentes do mesmo mapeamento de IDs de mini-brut, incluindo em `fire-base.js`).
- Inconsistência `null` vs `null|undefined` em filtros de canal entre os `brut-pisca-*.js` — não é bug hoje (`getFixtureChannel` nunca retorna `undefined`), mas é uma inconsistência defensiva.
- Comentário desatualizado em `mov-preset.js:5` ("Destino: F10") — hoje `mov-preset` está em **F4**; F10 é `mov-traj-rib-baixo`.
- `page_scripts` (`{"1":{}}`) é chave legada morta no schema do show — o mecanismo real é `scriptPages`.

## Integridade show.json ↔ scripts

**scriptPages (F1-F12): 100% íntegro.** Todas as 13 associações ativas apontam para entradas da `scriptLibrary` existentes, e todas as 15 entradas da `scriptLibrary` apontam para arquivos reais em `scripts/`.

| Slot | Script | Observação |
|---|---|---|
| page-1/F1 | brut-fita-full | OK |
| page-1/F2 | brut-pisca-combo | OK |
| page-1/F3 | brut-pisca-cruz | OK |
| page-1/F4 | mov-preset | OK (comentário interno desatualizado) |
| page-1/F5 | mov-desc-branco | **bug de reposition (Alto)** |
| page-1/F6 | mov-desc-full-reset | OK |
| page-1/F7 | mov-desc-rib-reset | OK |
| page-1/F8 | mov-traj-mh-rib | **sem warmup (Médio)** |
| page-1/F9 | mov-traj-rib-alto | OK |
| page-1/F10 | mov-traj-rib-baixo | OK |
| page-1/F11 | mov-desc-seq-fade | **speed=0 sobrescrito (Médio)** |
| page-1/F12 | mov-desc-sync-loop | OK |
| page-2/F1 | brut-pisca-lados | OK |
| (não associado) | fire-base | correto — biblioteca pura |
| (não associado) | mov-desc-mh-brut | órfão de F-key |

**macros[]: 100% quebrado.** 2 macros, 8 passos, 0 scripts existentes — bloqueadas com segurança pelo `validateMacroReferences`, mas são lixo funcional.

**Fixture IDs em `fire-base.js`**: todos os 24 IDs referenciados batem 1:1 com `shows/vp.show.json` — biblioteca pronta para quando o primeiro `fire-*.js` for criado.

## Resumo priorizado

**Crítico**: nenhum item chega a esse nível (nada quebra o engine, trava a UI, ou envia DMX fora de faixa).

**Alto**
1. `mov-desc-branco.js` (F5) — glitch de luz acesa a cada ciclo por falta de tempo de reposicionamento.
2. As 2 macros do show (`teste-0101`, `teste020202`) são 100% inoperantes — remover/corrigir antes do evento.
3. `fire-base.js` nunca testado ponta a ponta com um script real.

**Médio**
4. `mov-traj-mh-rib.js` (F8) sem warmup — risco de snap visível com luz acesa.
5. `mov-desc-seq-fade.js` (F11) — comentário de comportamento não reflete o que o código faz.
6. Validação assimétrica F-key vs. macro (erros de `OnStart`/compilação em macro não chegam à UI).
7. `mov-desc-mh-brut` órfão de F-key.

**Baixo**: duplicação de helpers/IDs entre famílias de scripts; comentário desatualizado em `mov-preset.js`; funções mortas em `mov-preset.js`; `scripts/backlog/` e `scripts/casamento/` já não existem mas o código de exclusão permanece; `page_scripts` como chave legada morta.
