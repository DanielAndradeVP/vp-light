# Auditoria — Engine Core (electron/engine/*)

> Auditoria **read-only**. Executor: **codex-xhigh** (MCP). Auditor principal: Claude (Sonnet 5).
> Nenhum arquivo do projeto foi alterado. Data: 2026-07-24. Estado auditado: HEAD `b148e2c`.
> `[fato]` = lido diretamente no código, com `arquivo:linha`. `[análise]` = interpretação do executor.

Escopo: `electron/engine/engine.js`, `compositor.js`, `universe.js`, `artnet.js`, `interpolator.js`, `ribaltaDebug.js`, `perfStats.js`, `electron/ribaltaPhysicalCalib.js`.

---

## Veredito do commit `7fe113f` ("blinda engine contra crash")

- [fato] O commit acrescentou `try/catch` síncrono somente em `interpolator.tick()`, `compositor.renderFrame()` e calibração/envio Art-Net (engine.js:53, 61, 70), e handlers globais `uncaughtException`/`unhandledRejection` (main.js:43, 46).
- [análise] "Blinda engine contra crash" é parcialmente verdadeiro: exceções síncronas isoladas deixam de encerrar o frame/processo, mas não há rollback do universo nem garantia de estado íntegro após erro.
- **Risco antigo A (loop infinito em script trava tudo): continua integralmente aberto.** Scripts continuam compilados via `new Function` no main (main.js:1117), `OnExecute` é chamado sincronamente no compositor (compositor.js:252), e nada detecta/interrompe `while(true)` (engine.js:99).
- **Risco antigo B (`_layerStats`/`_lastDiagnosticAt` sem limpeza): continua aberto nos dois casos** (compositor.js:43,46,408; adapter.js:75,83). `7fe113f` não tocou nesses arquivos.

---

## Bugs reais por arquivo

### engine.js
- Estado de performance não é resetado no `start()` (só `frameCount` é zerado, engine.js:24,47) — métricas misturam sessões após Stop/Start.
- Interpolador roda antes do compositor (engine.js:54,62) — script que muda pan/tilt e dimmer no mesmo `OnExecute` tem defasagem fixa de até 40ms entre eles.
- `stop()` não envia blackout/último frame seguro (engine.js:108) — nós Art-Net podem reter o último look indefinidamente.
- Se o compositor lança exceção após escritas parciais, o frame parcial ainda é enviado (engine.js:63,71) — sem double-buffer/rollback.

### compositor.js (achados mais graves do núcleo)
- **C-01 [Crítico]**: remoção/fade de camada pode reaplicar o efeito em 100% — `_removeLayerInternal()` chama `OnTerminate` sem limpar `buffer`/`touched` antes do flush (compositor.js:160,165,208,213); template padrão de script gera `OnTerminate` vazio (main.js:1197) — cenário oficialmente suportado, não é caso extremo.
- **C-02**: escritas de `OnStart` são descartadas (o primeiro render limpa `buffer`/`touched` antes do `OnExecute`, compositor.js:247) mas `controlledMask` não é limpo junto — pode bloquear restauração de cena sem produzir DMX algum.
- **C-03**: camada removida por erro ainda entra na mescla do frame corrente (compositor.js:242,255,274).
- **C-04/C-05**: modo `linear` de macro permanece ativo após término/erro sem restaurar HTP (compositor.js:347,404,434); múltiplas macros podem rodar simultaneamente corrompendo o `_mergeMode` global; `getActiveMacroStatus()` só reporta a primeira (compositor.js:342,347,453; PainelOperacao.jsx:696).
- **C-06**: duração de macro perde um frame útil (`_advanceMacro()` roda antes do `OnExecute`, compositor.js:237,443,446).
- **C-07**: hooks assíncronos (`async OnExecute`) escapam do isolamento — compositor não valida/aguarda Promise (compositor.js:252); rejeições não chegam ao catch; loop infinito de Promises não resolvidas é possível.
- **C-08**: fixture desabilitada não é zerada, só ignorada (compositor.js:282) — pode manter luz acesa indefinidamente.
- **C-09**: exceções de `OnTerminate` são engolidas por catch vazio (compositor.js:210), sem diagnóstico.
- Código morto: `removeLayer()` exportado mas sem chamada no projeto (compositor.js:112,464) — e seria perigoso se usado (remove sem `OnTerminate`/flush).

### universe.js
- **U-01**: offsets não são invertíveis após clamp — com `panOffset:40` (presente no show real, vp.show.json:298), lógico 255 vira físico 255 e o snapshot retorna 215 (universe.js:41,119).
- **U-02**: `rebaseChannelOffsets()` pode inventar/perder valores lógicos ao remover offset de canal saturado (universe.js:72,74).
- **U-03**: `_normalizeValue()` não testa `Number.isFinite` (universe.js:32) — entrada inválida (`NaN`/texto) vira blackout silencioso do canal, sem erro.
- **U-05**: troca de show não zera canais ausentes no novo show (universe.js:92; main.js:501,505,507 não chamam blackout) — canal do show anterior pode continuar sendo enviado.
- Código morto: `applyScene()`/`restoreState()` exportados mas não usados no runtime (universe.js:135,139,188) — `dmx:restoreState` tem lógica própria duplicada no main.js.
- [análise] O Viewer 3D recebe o buffer com offsets físicos já aplicados (`getUniverse()`), não o "lógico puro" que o comentário do engine (engine.js:68) sugere.

### artnet.js
- **A-01 [Alto]**: Stop/Start não reinicia `startIfaceRefresh()` — após o primeiro ciclo, `ifaceSockets` fica vazio permanentemente e o sistema cai no broadcast global genérico (artnet.js:112,168,286; engine.js:112).
- **A-02/A-03/A-04**: erro de bind pode deixar refresh pendente; erros de `send()` por interface são descartados sem contador/diagnóstico; ciclo de erro do loopback pode fechar socket novo por engano; `closeSocket()` não reseta `loopbackErrors` (artnet.js:59,127,139,200,220,275).
- **A-05**: endereços `169.254.x.x` (link-local/APIPA) são descartados (artnet.js:90) — prejudica ligação direta sem DHCP.
- Código morto: `artnet:getInterfaces` não é exposto no preload — diagnóstico de interfaces inacessível ao renderer (main.js:342; preload.js:75).

### interpolator.js
- **I-01 [Alto, risco operacional imediato]**: `show:save`/`show:saveAs` chamam `initializeOffsets()` → `interpolator.configure()`, que apaga todo estado e recria speed/current/target como zero (interpolator.js:49,56,135; main.js:551,573,733). **Salvar o show durante o culto com movings em posição faz eles saltarem para zero.**
- **I-02**: entrada não finita (`NaN`/`undefined`) em `setSpeed`/`setTarget` envenena o estado sem checagem (interpolator.js:90,102).
- **I-03**: configs duplicadas por `fixtureId` podem cruzar canais entre fixtures (interpolator.js:56,66).
- Avanço usa quantidade fixa por tick, sem delta de tempo — se o loop cair de 25fps para 12fps, o movimento leva ~2x mais tempo real (interpolator.js:139).

### ribaltaDebug.js
- Diagnóstico depende de ID/endereço fixos (ribaltaDebug.js:6,7) — hoje ainda bate com o patch real (canal 271, vp.show.json:460), mas quebra silenciosamente se a fixture for repatchada.
- Código morto: `logReEmit()`, export `log`/`R2_ID` sem consumidor externo (ribaltaDebug.js:100,117,121,122).
- [análise] Rodar com `VP_RIBALTA_DEBUG=1` ao vivo pode gerar volume alto de log na mesma thread do DMX — deve ser tratado como diagnóstico offline, não telemetria segura para palco.

### perfStats.js
- `createStatTracker()` não valida `historySize` (perfStats.js:18) — tamanho ≤0 produz `NaN` na média.
- `max`/`overruns` são cumulativos vitalícios, `avg` é de janela — snapshot mistura as duas sem indicar a diferença (perfStats.js:20,43).
- Sem `reset()` — por isso as métricas se misturam entre sessões após Stop/Start.
- [análise] É telemetria, não watchdog/deadline — não deve ser apresentada como proteção contra travamento.

### ribaltaPhysicalCalib.js
- **R-01**: comentário diz Ribalta_2 usa `gain 0.915` (linha 71) mas o valor real é `gain: 1` (linha 79) — **nenhuma correção de gain está de fato sendo aplicada**. Ribalta_1 e Ribalta_2 terminam com a mesma curva efetiva. *(Confirmado de forma independente também pela frente de auditoria de Adapters/Fixtures — ver arquivo correspondente; divergência conhecida desde 19/07, ainda não corrigida.)*
- **R-02**: renomear a fixture (`ribalta_1`/`ribalta_2` → qualquer outro texto) desativa a calibração silenciosamente (ribaltaPhysicalCalib.js:91,168; fixtureOffsets.js:19 não normaliza espaço→underscore).
- **R-03**: potencial dupla calibração se `tiltOffset` do show voltar a ser preenchido para ribaltas (hoje ambos zerados, vp.show.json:455,485 — bug latente, não ativo).
- **R-04**: colisão de canal entre duas ribaltas no mesmo endereço é sobrescrita silenciosamente, sem diagnóstico (ribaltaPhysicalCalib.js:178).
- Código morto: `calibratePhysicalTilt()`, `getTiltChannelMap()`, `PHYSICAL_TILT_CALIBRATION` exportados sem consumidor de produção.

---

## Cobertura automatizada
- Testes existentes cobrem só compositor/universe/perfStats diretamente (tests/compositor.test.js, tests/perf-stats.test.js). **Sem cobertura** para lifecycle Stop/Start do Art-Net, reset do interpolador ao salvar, offsets saturados, hooks assíncronos, ribalta debug ou calibração física — exatamente as áreas de maior risco encontradas.

---

## Resumo priorizado

**Crítico**
1. Scripts podem congelar toda a aplicação — `new Function` + execução síncrona no loop, sem worker/timeout/watchdog. `7fe113f` não resolveu isso.
2. Remoção/fade de camada pode reaplicar o último efeito em 100% (C-01) — pode deixar luzes presas após macro ou erro.

**Alto**
1. Salvar/Salvar Como reseta o interpolador — movings saltam para zero durante uso ao vivo (I-01).
2. Stop/Start perde permanentemente os sockets Art-Net por interface (A-01).
3. Modo linear de macro fica ativo após término/erro; múltiplas macros permitidas de forma assimétrica (C-04/C-05).
4. Troca de show não zera canais ausentes no show anterior (U-05).
5. Fixture desabilitada não é zerada (C-08).
6. Offsets saturados corrompem snapshot/rebase lógico (U-01/U-02).
7. Hooks assíncronos escapam do try/catch do compositor (C-07).
8. Calibração da Ribalta_2 diverge da própria especificação (R-01) — mesma curva aplicada às duas ribaltas.

**Médio**
- `_layerStats`/`_lastDiagnosticAt` sem limpeza; erro do compositor pode enviar frame parcial; erros de bind/send do Art-Net silenciosos; interfaces `169.254/16` excluídas; off-by-one de duração de macro; scripts de pan/tilt um frame atrás; `OnStart` não produz DMX mas pode bloquear canais; valores não finitos apagam canais silenciosamente.

**Baixo**
- Estatísticas não resetam entre sessões; alocações evitáveis no loop de 40ms; exports mortos; debug de Ribalta_2 hardcoded e potencialmente pesado; `artnet:getInterfaces` inacessível no renderer.
