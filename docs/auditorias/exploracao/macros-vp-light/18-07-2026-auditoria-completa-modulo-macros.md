# Auditoria Completa — Módulo de Macros (VP-LIGHT)

> Data: 2026-07-18 (entregue em 2026-07-19). Mina: `macros-vp-light`.
> Auditor principal: Sonnet 5 (raciocínio, cruzamento de evidências, conclusões).
> Executor de evidências: subagente MCP `codex-high` (leitura de código, grep, citação de linhas), em modo estritamente read-only.
> Escopo: exclusivamente o módulo de macros (sequenciador de passos). Não cobre paginação de F-Keys nem o canal DMX "macro" dos PAR LEDs (que é outra coisa, ver §3).
> Nenhum arquivo de produção foi alterado nesta auditoria.

---

## 1. Resumo executivo

O operador relatou que a macro "funciona mas é ruim de usar" e "encerra abruptamente". A auditoria confirma os dois pontos, mas revela que o problema é mais profundo do que UI: **a UI atual é estruturalmente incapaz de configurar as funcionalidades que o motor (compositor) já implementa**. O backend suporta fade-in, fade-out, overlap, loop e `mergeMode` linear por macro — mas o editor em `PainelOperacao.jsx` grava incondicionalmente `fadeInMs:0`, `fadeOutMs:0`, `overlapMs:0`, `loop:false`, `mergeMode:'htp'` para qualquer macro criada ou editada pela tela (`src/screens/PainelOperacao.jsx:538-544`). Ou seja: **a finalização abrupta relatada pelo operador não é um bug do motor de fade — é a ausência de qualquer caminho de UI para configurar um fade-out**, combinada com um mecanismo de flush que reaplica o último frame do script em peso integral ao remover a camada (`electron/engine/compositor.js:189-197,141-147`).

Além disso, as duas únicas macros hoje persistidas em `shows/vp.show.json` (`teste-0101`, `teste020202`) referenciam 7 scripts que **não existem** no repositório (`vp.show.json:1529-1602`). Isso significa que, no estado atual do show, **nenhuma macro salva funciona de ponta a ponta** — o teste bem-sucedido do operador foi necessariamente com uma macro nova, criada na sessão, com scripts existentes.

O backend é significativamente mais funcional do que os "50%" percebidos pelo operador em termos de mecânica (CRUD, execução, fade, overlap, loop, merge — tudo implementado e chamado), mas tem lacunas reais de robustez: sem validação de referências, sem feedback de erro ao operador, `mergeMode` global (não por macro/camada) contaminando scripts simultâneos, `restoreState` que ignora macro ativa causando blackout momentâneo ao trocar de cena, e nenhum cleanup lógico (`OnTerminate`) ao fechar o aplicativo. A UI, por outro lado, está abaixo do nível mínimo operável para culto: não expõe metade dos campos do schema, não confirma ações destrutivas, não mostra erros, e depende de polling de 200 ms sem indicação de falha.

Recomendação decisiva (§12): a estratégia de encerramento correta é **fade-out do último passo, configurável por macro, com um "passo de saída" implícito opcional** — não uma cena de destino automática (isso pertenceria ao operador decidir). Isso é detalhado em §12.

---

## 2. Arquitetura atual

O macro é um **sequenciador de passos server-side** que roda inteiramente no processo Electron main, dentro do compositor da engine de 25 fps (40 ms/frame). Cada passo de macro é tecnicamente idêntico a uma "camada" (layer) de script — a mesma abstração usada por F-Keys e page-scripts (`electron/engine/compositor.js:82-96`). A macro em si é apenas uma máquina de estados que decide, quadro a quadro, quando criar a próxima camada e quando liberar (fade-out) a camada do passo anterior (`compositor.js:215-219`, `_advanceMacro`).

Fluxo de dados (ver diagrama textual em §4-§6):

```
UI (PainelOperacao.jsx) → window.vp.macro* (preload.js:129-137) → ipcMain macro:* (main.js:1492-1533)
   → macroDefs (main.js:1437) + normalizeMacroDef (main.js:1442-1456) → show.json (persistência)
   → instantiateMacro (main.js:1459-1470) → compositor.createMacro (compositor.js:278-299)
   → engine loop 40ms (engine.js:34-60) → compositor.renderFrame (compositor.js:215-266)
   → universe.js → ribaltaPhysicalCalib → artnet.js (UDP) → SL3000 → DMX
                                        ↘ onFrame → viewer3D (independe de freeze)
```

Não existe uma "macro engine" separada: é o mesmo compositor de camadas usado para tudo, com uma camada extra de agendamento (`_macros` Map, `compositor.js:38-46`) que decide quando trocar de passo. Isso é uma decisão de arquitetura razoável (reuso), mas tem uma consequência importante: **macro não tem prioridade nem isolamento — ela compete por canais exatamente como qualquer F-Key**, sujeita ao mesmo HTP/linear global.

---

## 3. Mapa completo de arquivos

| Arquivo | Papel no módulo de macros |
|---|---|
| `src/screens/PainelOperacao.jsx` | Única tela com UI de macro: `MacroEditorModal` (criação/edição, ~L305-500) e `MacroPanel` (lista, status, transporte, ~L508-720). |
| `src/theme.js:104` | `operationPanelMacroWidth: 300` — largura fixa da coluna de macros. |
| `src/App.jsx:8-19` | Roteamento local que abre `PainelOperacao` a partir da mesa principal. |
| `src/screens/Main.jsx:1587-1594` | Botão "Painel de Operação" que leva à tela de macros. |
| `src/store/showStore.js` | **Sem nenhuma referência a macro** — confirmado por grep integral. Estado de macro não passa pelo Context global. |
| `electron/preload.js:129-137` | Expõe `window.vp.{createMacro,updateMacro,startMacro,stopMacro,nextMacroStep,removeMacro,macroList,macroStatus}`. Comentário residual "UI a fazer" apesar da UI existir. |
| `electron/main.js` | `macroDefs` (~L1437), `normalizeMacroDef` (~L1442-1456), `instantiateMacro` (~L1459-1470), handlers IPC `macro:*` (~L1492-1533), `saveMacros`/`loadMacros` (~L1473-1489), integração com blackout/stopAll (~L389-393,675-684) e com `restoreState` (~L413-430, que **não** considera macro). |
| `electron/show.js` | Nenhuma normalização/validação específica de macro; `macros` passa como bloco opaco no load/save (~L130-139,153-206). |
| `electron/engine/compositor.js` | Runtime real: `createMacro/startMacro/stopMacro/triggerNextStep/stopAllMacros/getActiveMacroStatus` (~L278-403), `_enterStep`/`_advanceMacro`/`_gotoNextStep` (~L346-395), motor de camadas genérico (`addLayer` ~L82-96, `releaseLayer` ~L179-187, `_removeLayerInternal` ~L189-197, `_flushLayerToUniverse` ~L141-147, `renderFrame` ~L215-266). |
| `electron/engine/engine.js:18-60` | Loop de 40 ms que chama `compositor.renderFrame()` a cada frame; é o único "relógio" das macros (não há timers próprios). |
| `electron/engine/artnet.js:173-187,237-246` | Freeze: bloqueia só `_transmitPacket()`; `renderFrame` (e logo macros) continua rodando por baixo. |
| `shows/vp.show.json:1529-1602` | As 2 macros persistidas hoje, ambas com scripts inexistentes. |
| `scripts/*.js` | Scripts reaproveitados pelos passos de macro via o mesmo `compileLayer`/`readScriptCode` de F-Keys (`main.js:1104-1111,1071-1085`). |

**Fora de escopo, mas achado por grep e descartado corretamente**: `src/viewer3d/scene.js:859-867`, `src/viewer3d/fixtures/parled.js:4-12,168,176-189`, `banco-de-conhecimento/par-led.md:26-122` e trechos de `shows/vp.show.json` (aliases de fixture) — todos referem-se ao **canal DMX `macro`/`macro_speed` de PAR LEDs** (uma feature nativa do fixture), sem relação com o sequenciador. Não confundir nos próximos passos de reconstrução.

---

## 4. Fluxo frontend

Navegação: Mesa (`Main.jsx`) → botão "Painel de Operação" (`Main.jsx:1587-1594`) → `App.jsx:8-19` troca `screen` para `'painel'` → `PainelOperacao.jsx` renderiza a coluna de macros permanentemente à esquerda (sem aba a selecionar), largura fixa 300 px (`theme.js:104`; `PainelOperacao.jsx:999`).

**Carregamento de scripts disponíveis**: uma vez, no mount do editor, via `window.vp.listScripts()` (`PainelOperacao.jsx:334-341`).

**Polling de macros**: a cada 200 ms, `window.vp.macroList()` + `window.vp.macroStatus()` (`PainelOperacao.jsx:514-524`). Não há chamada imediata ao abrir — a lista pode aparecer vazia por até ~200 ms. `setInterval(async ...)` sem lock, então IPCs lentos podem gerar respostas fora de ordem.

**Criação**: `+ Nova Macro` → modal `MacroEditorModal` → nome (input texto), intervalo comum em ms (`min 500`, `step 500`, default 2000 — `PainelOperacao.jsx:409-420`), N passos com `<select>` de script (`:440-462`), botão `+ Script` (`:482-484`) e `✕` por passo (`:463-479`) → `canSave` exige nome + ≥1 passo + todos os scripts preenchidos (`:360`) → `Criar` chama `window.vp.createMacro` com objeto que **sempre** força `mergeMode:'htp'`, `loop:false`, `fadeInMs/fadeOutMs/overlapMs:0` (`:533-545`).

**Edição**: `✎` no card da macro abre o mesmo modal pré-preenchido, mas o mapeamento descarta durações por passo distintas, fades e overlap, mantendo só o `durationMs` do primeiro passo como "intervalo comum" (`PainelOperacao.jsx:316-332`). **Salvar uma macro avançada pela UI destrói silenciosamente seus fades/overlap/loop/mergeMode.**

**Exclusão**: um clique no `✕` do card, **sem confirmação** (`:649-654`), remoção otimista no estado local mesmo antes de confirmar sucesso do IPC (`:567-570`).

**Execução/parada/avanço**: botão único que alterna `▶ Start`/`■ Stop` conforme a macro ativa (`:659-666`), `Próximo →` aparece só quando ativa (`:667-670`). Nenhum desses três lê o retorno do IPC — sucesso e falha são tratados de forma idêntica (`:564-566`).

**Visualização de passo atual**: chips `{índice+1}: {script}` por passo, o chip do índice corrente em destaque de cor (`:675-697`, ver JSX completo em §8). Não há "passo 2 de 4", barra de progresso, tempo restante ou indicação de fade em andamento — o status IPC só carrega `{id, stepIndex, loop}` (`compositor.js:398-403`).

**Referência quebrada**: visualmente **indistinguível** de uma referência válida — mesmo nome, mesma cor, mesmo estilo (`PainelOperacao.jsx:343-347,694`).

**Responsividade**: sem media queries, sem listener de `resize`, coluna de macro fixa em 300 px (`flexShrink:0`), grids de pads fixos em 6/7 colunas (`:799-805,842-848,888-894`), contêiner raiz com `overflow:hidden` (`:945-947,990-998`) — conteúdo que não couber é cortado, não rolado. O modal do editor tem `width:420px` sem `maxWidth:100%` (`:369-375`) — pode ultrapassar viewports estreitas.

---

## 5. Fluxo IPC

`electron/preload.js:129-137` expõe 8 funções, todas passthrough 1:1 para `ipcRenderer.invoke`:

| Renderer | Canal | Handler (main.js) | Validação | Retorno |
|---|---|---|---|---|
| `createMacro(id, def)` | `macro:create` | `~1492-1504` | só `id` truthy e não-duplicado | `{ok,steps}` ou `{ok:false,error}` |
| `updateMacro(id, def)` | `macro:update` | `~1506-1519` | exige ID existente; para a macro se ativa | `{ok,steps}` |
| `startMacro(id)` | `macro:start` | `~1521` | nenhuma explícita | `{ok}` — `true` mesmo se o 1º passo falhar ao compilar (erro é engolido dentro de `_enterStep`) |
| `stopMacro(id)` | `macro:stop` | `~1522` | nenhuma | `{ok}` — `true` mesmo parando macro já inativa |
| `nextMacroStep(id)` | `macro:next` | `~1523` | exige macro ativa | `{ok}` — `true` mesmo no último passo sem loop (que na verdade encerra) |
| `removeMacro(id)` | `macro:remove` | `~1524-1529` | nenhuma | `{ok}` — apaga de `macroDefs` mesmo se não existir no compositor |
| `macroList()` | `macro:list` | `~1532` | — | `Object.values(macroDefs)` cru, sem validade de refs, sem status |
| `macroStatus()` | `macro:status` | `~1533` | — | `{id,stepIndex,loop}` da **primeira** macro ativa encontrada (ordem de iteração do `Map`) ou `null` |

Nenhum handler valida: existência dos scripts referenciados, tipo/duplicidade de ID, coerência de durações, número mínimo de passos, ou impede duas macros escrevendo os mesmos canais. Nenhum retorna mensagem de erro estruturada além de `err.message` cru em `create`/`update`.

---

## 6. Fluxo do runtime

1. `startMacro(id)` (`compositor.js:303-310`): valida existência/passos, remove camadas remanescentes da própria macro, marca `active:true`, seta `_mergeMode` global conforme `macro.mergeMode`, chama `_enterStep(macro, 0)`.
2. `_enterStep` (`~346-369`): compila o passo via `step.makeLayer()` (que é `compileLayer(file)` — `main.js:1459-1461,1104-1111`, chamando `OnStart` do script); em caso de exceção, loga `console.error` e marca `macro.active=false` **sem restaurar `_mergeMode`**; em sucesso, cria ID `macro:{id}:{index}:{seq}` e chama `addLayer`.
3. A cada frame (`engine.js:40-58` → `compositor.js:215-266`): `_advanceMacro` incrementa `frameInStep`; quando atinge `durationFrames - overlapFrames`, dispara `_gotoNextStep` (`~371-382`), que libera (fade-out) a camada atual via `releaseLayer` e entra no próximo passo — as duas camadas coexistem durante o fade.
4. `OnExecute` do script ativo roda todo frame, depois de `buffer.fill(0)`/`touched.fill(0)` (`~226-236`); exceção remove a camada via `_removeLayerInternal(layer,'error')` mas **não** marca a macro como inativa nem avisa a UI.
5. Merge (`~239-258`): HTP (máximo ponderado) ou linear (soma clamped a 255) conforme `_mergeMode` global — compartilhado com F-Keys/page-scripts.
6. Remoção de camada (`_removeLayerInternal`, `~189-197`): chama `OnTerminate` (se existir) → `_flushLayerToUniverse` (escreve o buffer **sem** aplicar `weight`, só nos canais `touched` não controlados por outra camada, `~141-147`) → remove do Map → `onDone`.
7. Fim natural (último passo, sem loop, `_gotoNextStep`, `~371-382`): libera a última camada em fade-out e marca `macro.active=false` **imediatamente** — a UI já mostra "parada" enquanto a camada física ainda pode estar em fade.

---

## 7. Schema atual

Não existe schema declarativo nem validação em `electron/show.js` — só é exigido que `show.pages`/`show.fixtures`/`show.version` existam (`show.js:130-139`); `macros` pode faltar, ser malformado, ou ter entradas inválidas sem invalidar o show.

Schema real (implícito, definido por `normalizeMacroDef`, `main.js:1442-1456`):

```
macro:
  id: string (chave)
  name: string (fallback = id)
  mergeMode: 'linear' | 'htp' (qualquer outro valor cai em 'htp')
  loop: boolean (coerção !!)
  steps: Step[] (default [])

Step:
  script: string ('' se ausente — nome do arquivo em scripts/, sem validação de existência)
  durationMs: number | null (null = infinito, avanço manual)
  fadeInMs: number (default 0)
  fadeOutMs: number (default 0)
  overlapMs: number (default 0)
```

JSON real persistido hoje (`shows/vp.show.json:1529-1602`, resumido — ver arquivo fonte para o JSON completo):

```json
{"id":"teste-0101","mergeMode":"htp","loop":false,
 "steps":[
   {"script":"mov-padrao-01","durationMs":5000,"fadeInMs":0,"fadeOutMs":0,"overlapMs":0},
   {"script":"mov-padrao-02", "..."},
   {"script":"mov-padrao-03", "..."},
   {"script":"mov-padrao-04", "..."}]}
```
```json
{"id":"teste020202","mergeMode":"htp","loop":false,
 "steps":[
   {"script":"brut-forte","durationMs":2000,"...":"..."},
   {"script":"brut-padrao-01","..."},
   {"script":"brut-padrao-03","..."},
   {"script":"mov-padrao-01","..."}]}
```

Todos os 7 nomes de script (`mov-padrao-01..04`, `brut-forte`, `brut-padrao-01`, `brut-padrao-03`) **não existem** em `scripts/` — confirmado por varredura completa do diretório (sem subpastas hoje). Ambas as macros falham no primeiro passo. Não há campo de versão de schema nem migração; `show.version` é só `"1.0"` fixo e não é comparado (`show.js:133-137`).

---

## 8. Estado atual da UI/UX

JSX central da lista (`PainelOperacao.jsx:595-698`, reproduzido de forma fiel pelo executor):

```jsx
{macros.map((macro) => {
  const isActive  = activeMacroId === macroId;
  const stepIndex = isActive ? currentStep : -1;
  return (
    <div style={{
      background: isActive ? theme.colors.accentOverlay : C.bg,
      border: isActive ? `3px solid ${C.accent}` : theme.borders.thin,
    }}>
      <span>{macroLabel}</span>
      {macro.loop && <span>LOOP</span>}
      {(macro.mergeMode==='htp'||macro.htp) && <span>HTP</span>}
      <Btn onClick={()=> isActive ? handleStop(macroId) : handleStart(macroId)}>
        {isActive ? '■ Stop' : '▶ Start'}
      </Btn>
      {isActive && <Btn onClick={()=>handleNext(macroId)}>Próximo →</Btn>}
      {isActive && macro.steps?.length>0 && (
        <div>{macro.steps.map((step, si) => (
          <div style={{ background: si===stepIndex ? C.accent : C.surfaceAlt }}>
            {si+1}: {step.script || step.scriptName || '?'}
          </div>
        ))}</div>
      )}
    </div>
  );
})}
```

Mensagens de texto encontradas no módulo inteiro: `"Nenhuma macro criada"`, `"Backend de macros não disponível"` (`:592`), `"Nenhum script encontrado em scripts/. Crie scripts na mesa principal primeiro."` (`:435-438`), títulos `"Nova Macro"`/`"Editar Macro"` (`:386`), botões `Cancelar/Criar/Salvar` (`:494-497`). **Não existe nenhuma mensagem de sucesso ou de erro** para criar, editar, iniciar, parar, avançar ou remover.

---

## 9. Problemas da tela

Crítica técnica objetiva, não estética:

1. **Hierarquia visual insuficiente para operação ao vivo**: o único diferenciador de "macro ativa" é cor de fundo + borda de 3px (`:601-605`) — sem badge textual, sem ícone, sem animação. Num ambiente de culto com iluminação baixa na sala de operação e visão periférica, uma diferença sutil de cor é um sinal fraco para uma decisão crítica ("isto está rodando agora?").
2. **Nenhuma noção de tempo**: sem contagem de passos ("2 de 4"), sem barra de progresso, sem tempo restante do passo atual. O operador não tem como prever quando a próxima transição vai acontecer — inviabiliza qualquer coordenação com música/liturgia.
3. **Densidade de informação incompatível com o dado real**: o schema suporta `fadeInMs`, `fadeOutMs`, `overlapMs`, `loop`, `mergeMode` por macro — nenhum desses 5 campos é exposto na tela. O operador crê que está controlando a macro, mas está controlando um subconjunto raso dela; pior, **editar zera os campos que não aparecem** (§4), uma armadilha silenciosa.
4. **Ordem dos campos no formulário não segue o fluxo mental do operador**: nome → intervalo global → lista de scripts. Não há agrupamento visual por passo (duração+fade+overlap juntos), forçando o operador a pensar em "um número para todos os passos" quando o motor já suporta valores por passo.
5. **Zero feedback**: nenhuma chamada IPC (`create/update/start/stop/next/remove`) mostra o resultado ao operador (§4, §5). Um `startMacro` que falhe silenciosamente (script inexistente) parece idêntico a um sucesso — o operador só percebe pela ausência de efeito físico no palco, sob pressão, ao vivo.
6. **Identificação de referência quebrada inexistente**: script inexistente aparece como texto normal no `<select>` e na lista de passos (`:343-347,694`) — não há como saber que uma macro vai falhar antes de apertar Start.
7. **Nenhuma confirmação para ações destrutivas**: excluir macro e parar macro ativa são um clique único, irreversível, sem diálogo de confirmação (`:649-654,659-666`) — alto risco de acionamento acidental num touchscreen durante culto.
8. **Sem identificação de "scripts simultâneos"**: como o modelo atual não suporta paralelismo real dentro de um passo (§14), esse problema é hoje moot, mas a UI também não teria como representar isso caso o backend evoluísse — os chips são uma lista linear 1:1 com passos.
9. **Edição de sequência pobre**: adicionar/remover passo é possível, mas não há reordenar (drag), duplicar passo, nem visualização de timeline — é uma lista de `<select>`s empilhados.
10. **Controle ao vivo limitado**: Start/Stop/Next são os únicos controles em tempo real; não há "pular para passo N", "pausar", ou "reiniciar do passo 1" sem parar e iniciar de novo.
11. **Divergência estado visual × main process**: status vem de polling de 200 ms sem push; ver §4 e a lista de 5 divergências específicas identificadas em §16/§10 (macro marcada inativa antes do fade físico terminar, `macro:status` só reporta uma macro quando pode haver várias ativas, `show:load` não recarrega `macroDefs`).
12. **Responsividade nula** (§4/§B): coluna fixa de 300 px, sem breakpoints, conteúdo cortado (não rolado) em janelas estreitas — problemático se o painel for usado num touchscreen menor que o previsto no design.

**Partes a descartar numa reconstrução**: o modal `MacroEditorModal` inteiro (schema incompleto, mapeamento destrutivo de edição) e o card sem indicadores de tempo/progresso.

**Partes reaproveitáveis**: o padrão visual de chips de passo (`:675-697`) é uma base razoável para uma futura timeline, desde que ganhe estado (progresso, erro) por chip; o polling pode ser mantido como fallback mesmo se um push-based state for adicionado; a separação `MacroEditorModal`/`MacroPanel` como dois componentes é um bom ponto de partida estrutural.

---

## 10. Capacidades reais do backend

Confirmado como implementado e efetivamente chamado, ponto a ponto pedido no briefing:

- **Schema de macro**: implícito via `normalizeMacroDef`, sem validador declarativo (§7).
- **Normalização**: `main.js:1442-1456` — coerções seguras (Number, !!), mas sem checagem de existência de script nem de coerência de tempos.
- **Persistência**: `saveMacros`/`loadMacros` (`main.js:1473-1489`), integrada ao `show.saveShow`; `show:load` **não** chama `loadMacros` (§16.5) — bug de sincronização ao trocar de show.
- **IPCs**: todos os 8 existem e funcionam mecanicamente (§5); nenhum valida input de forma robusta.
- **Criação/Atualização/Exclusão**: funcionam; atualização de macro ativa a interrompe sem aviso (`main.js:1506-1519`).
- **Start/Stop/Next/Loop**: implementados no compositor (§6); loop funciona (`_gotoNextStep` reinicia em `index=0` quando `macro.loop`).
- **Duração por passo**: suportada no schema e no runtime (`durationFrames`, incl. `Infinity` para avanço manual); **não exposta na UI** (uma só duração comum para todos os passos).
- **Fade-in/Fade-out**: implementados matematicamente no compositor (§13); **inacessíveis pela UI** (§4/§D).
- **Overlap**: implementado como antecipação da transição de passo (§14); **inacessível pela UI**.
- **Paralelismo dentro de um passo**: **inexistente** — um passo = exatamente um script (§14).
- **Finalização**: existe (fim natural, stop manual, blackout, stopAll), mas sem conceito de "encerramento suave configurável" — ver §12.
- **Erros**: `try/catch` em todos os pontos críticos (`_enterStep`, `OnExecute`), mas todos **engolidos silenciosamente** — só `console.error`, nunca alcança a UI (§17).
- **Hot reload**: watcher de `scripts/` **não** cobre macros — passos ativos não recarregam script alterado (§18).
- **Concorrência**: duas macros simultâneas são suportadas estruturalmente (`Map`), mas competem pelos mesmos canais via merge global e `mergeMode` compartilhado (§15).
- **Blackout/Freeze/Troca de cena**: blackout e "parar tudo" encerram macros corretamente (§16.1); freeze não afeta o runtime da macro, só a saída UDP (§16.2); troca de cena tem o bug do `restoreState` (§16.3).
- **Recuperação após erro**: inexistente — macro fica "morta" (inativa, sem aviso) até ação manual do operador.
- **Estado visual**: divergente do runtime real em pelo menos 5 pontos catalogados (§9.11).
- **Diagnóstico**: inexistente — não há log estruturado, painel de erros, nem histórico de execução.

---

## 11. Matriz funcional

| Capacidade | Classificação | Evidência |
|---|---|---|
| CRUD de macro (criar/editar/excluir) | Funcional com limitações | `main.js:1492-1529`; edição destrói campos avançados (`PainelOperacao.jsx:538-544`) |
| Persistência em show.json | Funcional com limitações | `main.js:1473-1489`; não recarrega em `show:load` (§16.5) |
| Execução (start) | Funcional com limitações | `compositor.js:303-310`; retorna sucesso mesmo com falha de compilação |
| Parada (stop) | Funcional e validada | `compositor.js:313-319` |
| Avanço manual (next) | Funcional e validada | `compositor.js:322-326` |
| Sequência de passos | Funcional e validada | `_advanceMacro`/`_gotoNextStep` (`compositor.js:371-395`) |
| Duração por passo | Funcional com limitações | backend ok; UI só permite valor único global |
| Loop | Funcional com limitações | backend ok; UI nunca grava `loop:true` |
| Fade-in / Fade-out | Funcional com limitações | matemática correta no compositor (§13); UI nunca grava valores > 0 |
| Overlap entre passos | Funcional com limitações | funciona tecnicamente (§14); UI nunca grava valores > 0; comportamento depende de `fadeOutMs` também estar setado |
| Paralelismo real (vários scripts por passo) | Inexistente | schema de passo só aceita 1 `script` (`main.js:1448-1454`) |
| Finalização suave/configurável | Inexistente | não há conceito de "fade global de macro" nem "passo de saída" — ver §12 |
| Tratamento de erro (OnStart/OnExecute/OnTerminate) | Quebrado | erro engolido, sem aviso, macro morre silenciosamente (`compositor.js:353-358,232-243`) |
| Hot reload durante macro ativa | Quebrado (não implementado) | watcher só cobre `scriptMeta`/F-Keys (`main.js:1288-1317`) |
| Concorrência (2 macros simultâneas) | Funcional com limitações | suportado estruturalmente; `mergeMode` e status de UI não escalam para N macros |
| Blackout | Funcional e validada | `main.js:389-393,675-684` |
| Freeze | Funcional e validada (por design) | `artnet.js:237-246`; motor continua rodando por baixo, o que é o comportamento documentado do projeto |
| Troca de cena | Quebrado | `restoreState` ignora macro ativa (`main.js:413-430`) |
| Recuperação após erro | Inexistente | requer ação manual do operador; sem retry nem aviso |
| Estado visual (UI ≈ runtime) | Parcialmente implementada | polling funciona, mas 5 divergências catalogadas (§9.11) |
| Diagnóstico/logs | Inexistente | só `console.error` no processo main, invisível ao operador |
| Validação de referências de script | Inexistente | nenhum ponto do fluxo (criação, edição, load) valida existência do arquivo |
| Não testada em produção real | Não testada | confirmado pelo próprio relato do operador — só teste simples isolado |

Avaliação do "50% do backend" do operador: **subestimado em mecânica, superestimado em robustez**. A mecânica central (máquina de estados de passos, fade, overlap, loop, merge) está ~85-90% implementada e correta no compositor. A robustez operacional (validação, erro, sincronização de estado, hot reload, recuperação) está mais perto de 20-30%. A percepção de "50%" provavelmente reflete a UI, que expõe uma fração pequena do que o backend já sabe fazer.

---

## 12. Análise da finalização abrupta

Investigação direta do relato "quando a macro acaba, ela encerra abruptamente e fim":

- **O último passo recebe fade-out?** Tecnicamente sim, o mecanismo existe: `_gotoNextStep` chama `releaseLayer(cur._layerId, cur.fadeOutFrames)` mesmo quando não há próximo passo, antes de marcar `macro.active=false` (`compositor.js:371-380`). **Mas** `fadeOutFrames` vem de `step.fadeOutMs`, que a UI sempre grava como `0` (`PainelOperacao.jsx:541`). Fade de 0 frames vira `weight=0`/`phase='done'` imediatamente (confirmado por `_tickEnvelope`, `compositor.js:199-210`). Ou seja: **o mecanismo de fade-out existe e é chamado, mas a duração configurada é sempre zero**, tornando-o efetivamente inexistente na prática atual.
- **A macro chama stop ao atingir o fim?** Não exatamente stop — `macro.active=false` é setado diretamente dentro de `_gotoNextStep` (`compositor.js:378-380`), sem passar por `stopMacro`. A diferença importa: `stopMacro` remove a camada imediatamente e sem fade (`compositor.js:313-319`); o fim natural ao menos tenta um `releaseLayer` (com fade, que hoje é 0ms).
- **OnTerminate escreve valores diretamente no universo?** Só se o script implementar `OnTerminate`; se implementar, o valor que ele escrever é o que fica (`_removeLayerInternal`, `compositor.js:189-197`). Se **não** implementar, o `_flushLayerToUniverse` reaplica o **buffer cru do último `OnExecute`, em peso 1**, ignorando o `weight` do fade (`compositor.js:141-147,189-195`) — esse é o ponto tecnicamente responsável pelo "salto" visual: mesmo com fade configurado corretamente, o frame de remoção reescreve o valor pré-fade nos canais tocados.
- **Os canais voltam para cena, zero, ou estado anterior?** Nenhum dos três automaticamente. Ficam **presos no último valor escrito pela camada** (via flush) nos canais que ela tocava, até que outra escrita ocorra (novo script, nova sincronização de cena, blackout). A engine não recompõe a cena base a cada frame — quando não há camadas, `renderFrame` simplesmente retorna (`compositor.js:219,221`). A restauração de cena só acontece via `showStore.js:302-333` (`SceneDmxSync`), que não é acionado pelo fim de uma macro.
- **Existe frame de queda abrupta?** Sim, comprovado: no frame em que a camada atinge `phase:'done'`, ela ainda roda `OnExecute` uma última vez (zerando e repreenchendo o buffer), o merge escreve `buffer × weight≈0` (quase zero), e **no mesmo ciclo** de remoção o flush reescreve o buffer sem peso — dois valores conflitantes no mesmo frame/próximo frame, dependendo de quando exatamente a camada sai da lista `arr` do `renderFrame`.
- **Overlap funciona no último passo?** `overlapFrames` do último passo antecipa o `_gotoNextStep` (§14), mas como não há passo seguinte, seu único efeito é terminar a macro mais cedo — não produz nenhum benefício visual sem um `fadeOutMs` associado.
- **Existe conceito de "encerramento da macro" (diferente de encerramento de passo)?** Não. A macro não tem um fade-out ou passo final próprios — ela herda o fade-out do último passo do usuário, que hoje é sempre zero pela UI.
- **O problema vem do runtime, do schema ou da macro criada pelo usuário?** É uma combinação: (a) schema/runtime **suportam** fade-out por passo, então tecnicamente não é bug de runtime; (b) mas o runtime tem um bug real e independente — o flush em peso 1 no `_removeLayerInternal` ignora o fade e pode reverter o efeito visual mesmo quando `fadeOutMs > 0` for configurado; (c) a UI é a causa prática imediata, por nunca permitir configurar `fadeOutMs`.

### Estratégias de encerramento avaliadas

| Estratégia | Prós | Contras |
|---|---|---|
| Encerrar imediatamente (atual) | Simples, previsível | Visualmente abrupto, já rejeitado pelo operador |
| Fade-out global da macro (envelope aplicado a todos os passos, independente do fade de cada passo) | Consistente independente de como o operador configurou cada passo | Redundante se os passos já tiverem fade próprio; mais um conceito para o operador aprender |
| Fade-out do último passo (usar o `fadeOutMs` do passo final) | Reaproveita mecanismo já existente no compositor; menor esforço de implementação | Depende do operador lembrar de configurar; sem valor default sensato pode voltar ao problema atual |
| Transição para cena ativa | Comportamento "correto" cenicamente (volta ao estado esperado do culto) | Decisão de produto arriscada — pode não ser o que o operador quer (ex.: macro de efeito sobre uma cena que não deve ser tocada); exige acoplar macro a scene state |
| Manter último estado | Já é o comportamento hoje (por acidente, via flush) | Não resolve o "abrupto"; canais ficam presos indefinidamente até nova ação |
| Executar um passo final (dedicado, não repete os anteriores) | Flexível, dá controle total ao operador | Mais complexidade de modelo (passo com papel especial) |
| Executar uma macro de saída | Máxima flexibilidade | Overengineering para o caso comum; complexidade desproporcional ao ganho |

**Recomendação decisiva**: usar o **fade-out do último passo como mecanismo primário**, mas corrigir dois defeitos de runtime que hoje o tornam inútil mesmo quando configurado: (1) o `_flushLayerToUniverse` não deveria reaplicar o buffer em peso integral quando a remoção é por fim de fade — deveria refletir o `weight` final (ou simplesmente não escrever, deixando o merge do próprio `renderFrame` ter feito o trabalho no frame anterior); (2) a UI precisa expor um default sensato para `fadeOutMs` (não zero) em toda macro nova, para que o comportamento "seguro" seja o padrão, não uma opção escondida. Adicionalmente, **oferecer como opção configurável** (não obrigatória) a transição para a cena ativa ao final — como um "modo de encerramento" por macro (`immediate | fade | returnToScene`), decidido pelo operador no momento da criação, não fixo no motor. Isso não deve ser implementado nesta auditoria — é uma recomendação para a reconstrução (§20, §22).

---

## 13. Análise de fades e overlap

Envelope por camada (não por macro inteira), aplicado igualmente a F-Keys, page-scripts e passos de macro:

- Fade-in (`compositor.js:199-204`): `weight = min(1, elapsed/fadeInFrames)`, incrementado a cada frame.
- Fade-out (`~205-209`): `weight = max(0, releaseFromWeight * (1 - elapsed/fadeOutFrames))` — parte do peso em que a camada estava no momento do release, não necessariamente de 1.
- Conversão de tempo: `frames = round(ms/40)` (`main.js:1434-1435,1464-1467`); fade de 0ms vira 0 frames → salto instantâneo de peso.
- O valor composto por canal é `buffer[canal] * weight` (`compositor.js:243-257`) — o fade é multiplicativo sobre o que o script escreve a cada frame, não uma interpolação entre dois valores fixos. Isso significa que se o script mudar o valor do canal durante o fade (ex.: um script de movimento), o fade acompanha esse valor dinamicamente, não apenas um crossfade estático.
- Overlap (`_gotoNextStep`, `compositor.js:371-382`): o passo N+1 é criado quando `frameInStep >= durationFrames - overlapFrames`, ou seja, overlap **antecipa a transição**, não estende a duração total do passo N. Durante a janela de overlap, a camada de N está em `releaseLayer` (fade-out) simultaneamente com a camada de N+1 em fade-in — ambas compostas no mesmo frame pelo merge HTP/linear. Isso é overlap **entre passos sequenciais**, funcionalmente um crossfade — não é paralelismo (ver §14 para a distinção formal pedida pelo auditor).
- Consequência importante: com `overlapMs > 0` mas `fadeOutMs = 0`, não há crossfade visual real — a camada antiga cai a peso zero instantaneamente no frame da transição, apesar de ter "antecipado" a saída. Overlap sem fade é inútil; os dois campos precisam ser configurados juntos, e a UI hoje não permite configurar nenhum dos dois.
- Sem limite hard-coded de camadas simultâneas — se durações forem menores que fades anteriores, camadas podem acumular além de duas.

---

## 14. Análise de paralelismo

Distinção central pedida pelo auditor, confirmada no código: **o modelo atual só tem overlap entre passos sequenciais — não existe paralelismo real dentro de um único passo.**

Auditoria ponto a ponto:

- Dois scripts começarem exatamente no mesmo passo: **não suportado** — `Step.script` é um campo singular (`main.js:1448-1454`); o schema não tem `scripts: []`.
- Três ou mais scripts simultâneos: mesmo limite.
- Ações paralelas com durações diferentes: impossível dentro de um passo (não há sub-ações); entre macros diferentes rodando ao mesmo tempo, sim (mas sem coordenação — são macros independentes competindo pelos mesmos canais via merge global, §15).
- Parar apenas uma ação dentro do passo: não aplicável (passo = 1 ação).
- Grupos de ações: inexistente.
- Overlap entre grupos: inexistente (grupos não existem).
- Branches (passo condicional): inexistente — a sequência é sempre linear, `index+1`, exceto loop que volta a 0.
- Espera (esperar evento externo antes de avançar): parcialmente — `durationFrames: Infinity` (via `durationMs: null`) faz o passo aguardar avanço manual (`nextMacroStep`), mas não há espera por evento (ex.: "esperar até que outro script termine").
- Avanço manual: suportado (`triggerNextStep`/`macro:next`).
- Repetição parcial (repetir só um trecho da sequência, não a macro inteira): inexistente — `loop` reinicia sempre do passo 0.

### Proposta de schema futuro (não implementado, apenas desenho conceitual)

Para permitir paralelismo real dentro de um passo, o passo precisaria migrar de um campo `script` singular para uma lista de ações:

```
Step:
  actions: Action[]        // uma ou mais ações simultâneas
  durationMs: number | null
  fadeInMs, fadeOutMs, overlapMs: number   // aplicáveis ao passo como um todo, ou por ação

Action:
  script: string
  fadeInMs?, fadeOutMs?: number   // override opcional por ação dentro do passo
  weight?: number                  // se o merge precisar de prioridade por ação
```

Cada `Action` viraria sua própria camada no compositor (reaproveitando `addLayer` sem mudança estrutural), todas nascendo/morrendo junto com o passo pai, exceto se ganhassem fade próprio. Isso é compatível com a arquitetura de camadas já existente — o compositor **já suporta N camadas simultâneas**; a limitação é puramente no schema de macro (1 script por passo) e na instanciação em `main.js` (`instantiateMacro` cria uma `makeLayer` por passo, não por ação). A mudança seria de escopo moderado no runtime, mas exigiria repensar a UI do zero (edição de múltiplas ações por passo, não só passos em sequência).

---

## 15. Concorrência e mergeMode

`_mergeMode` é uma variável **global única** no compositor (`compositor.js:45`), não por macro, não por camada. Efeitos confirmados:

- `startMacro` define `_mergeMode` conforme a macro iniciada (`compositor.js:303-309`) — a última macro iniciada "vence" e muda o comportamento de merge de **todos** os scripts ativos no sistema (F-Keys, page-scripts, outras macros).
- `stopMacro` restaura `'htp'` **incondicionalmente** (`compositor.js:313-319`), mesmo se outra macro `linear` continuar ativa — bug real: parar a macro A pode desligar o modo linear que a macro B ainda precisa.
- Fim natural (`_gotoNextStep` no último passo) e falha de compilação (`_enterStep`) **não restauram** `_mergeMode` — uma macro linear pode deixar o sistema preso em modo linear indefinidamente até um `stopMacro`/`stopAllMacros` manual.
- Duas macros simultâneas: suportadas estruturalmente (`_macros` é `Map`, `startMacro` não para outras), mas competem no mesmo merge global — em HTP, vence o maior valor ponderado por canal; em linear, os valores somam e saturam em 255 (podendo produzir resultado inesperado, ex. dois scripts cada um mandando 200 em um canal branco somam para 255 mesmo que nenhum quisesse "full").
- `macro:status` só reporta a primeira macro ativa encontrada na iteração do Map (`compositor.js:398-403`) — sem visibilidade de concorrência para o operador.

---

## 16. Interação com blackout, freeze e cenas

**16.1 Blackout**: `dmx:blackout` chama `stopAllRunningScripts('blackout')` (que inclui `compositor.stopAllMacros()`) e depois `universe.blackout()`, reaplicando baselines de offset (`main.js:389-393,675-684`; `universe.js:89-95`). O botão "Parar tudo" do painel chama `stopAllScripts()` e depois `blackout()` em sequência (`PainelOperacao.jsx:938-942`) — redundante mas correto. **Comportamento correto e validado.**

**16.2 Freeze**: não interage com o runtime de macro de forma alguma. `setFrozen`/`isFrozen` (`artnet.js:173-187`) só controla se `_transmitPacket()` roda dentro de `sendArtDMX` (`artnet.js:237-246`), chamado **depois** de `compositor.renderFrame()` no loop (`engine.js:40-58`). Ou seja: **uma macro pode avançar passos inteiros, terminar, e até começar outra, tudo com o palco físico congelado** — ao descongelar, o palco recebe o estado atual (pós-macro), pulando as transições intermediárias que o Art-Net nunca transmitiu. Isso é o comportamento documentado do projeto para freeze em geral (CLAUDE.md: "Congelar palco bloqueia só envio Art-Net UDP; engine, UI e preview 3D continuam"), então não é um bug — mas é um comportamento que o operador de macro precisa entender explicitamente (uma macro "rodou" sob freeze sem nunca ter sido vista no palco).

**16.3 Troca de cena**: `SceneDmxSync` (`showStore.js:302-333`) dispara `restoreState`, que só considera scripts F-Key e page-script como "rodando" (`anyScriptRunning`, `main.js:413-430`) — **macro ativa não entra nessa checagem**. Consequência: trocar de cena com uma macro (e só ela) ativa pode disparar `universe.blackout()` momentâneo por baixo da macro, antes do próximo frame do compositor reafirmar os canais da macro. **Bug confirmado**, já havia sido identificado na auditoria irmã de paginação/F-Keys.

**16.4 Scene-lock**: protege apenas `color_wheel`/`prism` não-zero de moving heads (`main.js:855-885`); reaplicado após o merge a cada frame (`compositor.js:260`) — funciona igualmente sob macro, sem tratamento especial.

**16.5 Troca de show (`show:load`)**: não chama `loadMacros()` (`main.js:462-482`, confirmado por leitura direta do handler) — abrir outro arquivo de show **não substitui** o registro runtime `macroDefs`; macros do show anterior continuam aparecendo/executáveis até reiniciar o app ou usar `saveAs` (que sim chama `loadMacros`, `:535-547`).

---

## 17. Tratamento de erros

| Ponto de falha | Comportamento | Evidência |
|---|---|---|
| `OnStart` do script do passo lança exceção | Capturada em `_enterStep`; `console.error`; `macro.active=false`; sem restaurar `_mergeMode`; sem chegar à UI | `compositor.js:346-358` |
| `OnExecute` lança exceção em qualquer frame | Camada removida via `_removeLayerInternal(layer,'error')`; `console.error`; a **macro continua marcada ativa** (diferente da falha em `OnStart`) — se a duração do passo for infinita, a macro fica "ativa" sem nenhuma camada, indefinidamente, até ação manual | `compositor.js:230-243` |
| `OnTerminate` lança exceção | Engolida em `try/catch` vazio, sem log sequer | `compositor.js:191-193` |
| Script referenciado não existe | Arquivo não é lido até o passo ser disparado; falha vira o mesmo caminho de erro de `OnStart` (arquivo não encontrado) | `main.js:1459-1467`; `compositor.js:353-358` |
| `macro:create`/`macro:update` com erro de persistência | `try/catch` retorna `{ok:false, error: err.message}` — este é o único caminho que devolve uma mensagem de erro estruturada, mas a UI não a exibe (§4) | `main.js:1492-1519` |
| `macro:remove` com erro de persistência | Sem `try/catch` — rejeita a Promise IPC crua | `main.js:1524-1529` |

Em nenhum caso o operador recebe um alerta visual. O único rastro é `console.error` no processo main (invisível fora do DevTools/terminal), tornando erros de macro efetivamente **silenciosos em produção**.

---

## 18. Hot reload durante macros

O `fs.watch(SCRIPTS_DIR, {recursive:true})` com debounce de 150ms (`main.js:1277-1343`) só percorre `scriptMeta`/`runningScripts` (F-Keys): arquivo removido para e desassocia F-Keys (`~1288-1299`), `mov-preset.js` alterado reinicia F-Keys `mov-*` ativas (`~1303-1310`), outro arquivo alterado reinicia F-Keys ativas com o mesmo basename. **Não percorre `runningPageScripts`, `macroDefs`, `_macros` nem camadas `macro:*`.** Alterar um script durante uma macro ativa não recompila a camada corrente — o passo já compilado continua rodando com o código antigo até a macro sair daquele passo e reentrar nele numa próxima execução (nova compilação via `compileLayer`).

---

## 19. Requisitos da nova tela

**Obrigatórias** (mínimo para uso seguro em culto):
- Lista de macros com indicação clara e inequívoca de "ativa agora" (não só cor de fundo).
- Indicador de passo atual com contagem ("passo N de M") e algum sinal de progresso/tempo restante.
- Criação e edição expondo TODOS os campos do schema real: nome, passos (script, duração, fadeIn, fadeOut, overlap), loop, mergeMode.
- Validação de referência quebrada visível no editor e na lista (script não encontrado em `scripts/`) — antes de salvar e antes de rodar.
- Confirmação obrigatória para excluir macro e para parar macro ativa.
- Feedback de sucesso/erro para toda ação (criar, editar, start, stop, next, remover) — mínimo um toast/mensagem visível.
- Execução de teste (dry-run ou "rodar uma vez e parar") sem exigir sair do editor.
- Proteção contra edição destrutiva de macro ativa (avisar antes de editar/salvar uma macro em execução, já que hoje isso a interrompe silenciosamente).

**Importantes**:
- Preview visual do que a macro fará antes de rodar (lista ordenada com tempos, sem precisar abrir edição).
- Duplicar macro.
- Estado ao vivo detalhado (qual script está tocando, se está em fade-in/hold/fade-out).
- Logs/histórico de execução recente com erros visíveis na própria tela (não só console).
- Uso rápido: macro acessível/disparável sem precisar entrar no editor completo — algo equivalente ao `QuickDispatchPanel` já existente para scripts (`PainelOperacao.jsx:1003` e vizinhança).

**Futuras**:
- Editor visual tipo timeline com drag-and-drop de passos.
- Ações simultâneas dentro de um passo (paralelismo real, §14).
- Modo de encerramento configurável por macro (`immediate | fade | returnToScene`, §12).
- Reordenar passos por arraste.
- Branches/condições.

**Excessos a não construir agora**: editor de curvas de fade customizadas, agendamento por horário/gatilho externo, macro-de-macro (composição recursiva), undo/redo multiusuário — nenhum desses resolve o problema relatado (finalização abrupta, usabilidade) e adicionam complexidade desproporcional ao estágio atual do módulo.

---

## 20. Requisitos do backend futuro

- Validação de existência de script no momento de `create`/`update` (aviso, não necessariamente bloqueio — permitir salvar draft, mas marcar como inválida).
- `mergeMode` por macro/camada em vez de global (pré-requisito para paralelismo seguro entre macro e F-Keys simultâneos, e para múltiplas macros simultâneas coerentes).
- `restoreState`/`anyScriptRunning` deve considerar macro ativa (`main.js:413-430`).
- `show:load` deve chamar `loadMacros()` (paridade com `saveAs`).
- Corrigir `_flushLayerToUniverse` para não reverter fade-out no frame de remoção (§12).
- Superfície de erro estruturada até a UI: `macro:status` (ou um novo canal) deveria incluir `lastError` por macro, não só `{id, stepIndex, loop}`.
- `getActiveMacroStatus` deve retornar todas as macros ativas, não só a primeira (`compositor.js:398-403`).
- Cleanup de `OnTerminate` ao fechar o app (hoje `engine.stop()` não chama nenhum `OnTerminate`, `main.js:1605-1608`/`engine.js:62-67`).
- Modo de encerramento configurável por macro (schema: `endMode`).
- (Futuro, maior escopo) schema de passo com lista de ações para paralelismo real (§14).

---

## 21. Riscos

| Risco | Severidade | Evidência | Mitigação sugerida |
|---|---|---|---|
| Macro falha silenciosamente ao vivo (script inexistente/erro), operador não percebe até o palco não reagir | Crítico | `compositor.js:353-358,230-243`; §17 | Superfície de erro na UI antes de qualquer reconstrução de tela — é o menor esforço com maior impacto |
| `mergeMode` global contamina scripts F-Key simultâneos durante uma macro linear | Alto | `compositor.js:243,308,318`; §15 | Escopar `mergeMode` por camada/macro |
| Troca de cena com macro ativa causa blackout momentâneo | Alto | `main.js:413-430`; §16.3 | Incluir macro em `anyScriptRunning` |
| Edição de macro pela UI apaga fade/overlap/loop/mergeMode configurados fora da UI | Alto | `PainelOperacao.jsx:538-544`; §4 | Preservar campos não editáveis, ou bloquear edição de macros "avançadas" até a UI suportar todos os campos |
| Nenhuma confirmação para excluir/parar macro ativa em touchscreen | Médio-Alto | `PainelOperacao.jsx:649-654,659-666`; §9.7 | Diálogo de confirmação |
| Macro pode ficar "ativa" sem camada (duração infinita + erro em OnExecute), presa até ação manual | Médio | `compositor.js:230-243`; §17 | Detectar e marcar macro inativa quando a última camada falha sem próximo passo agendado |
| `show:load` não recarrega macros, causando inconsistência entre shows | Médio | `main.js:462-482`; §16.5 | Chamar `loadMacros()` em `show:load` |
| Fechar o app com macro ativa não executa `OnTerminate` | Baixo-Médio | `main.js:1605-1608`; `engine.js:62-67` | Cleanup explícito no shutdown |
| Duas macros simultâneas sem visibilidade de status para o operador | Baixo-Médio | `compositor.js:398-403` | Status deve listar todas as macros ativas |
| Responsividade nula pode cortar UI em resoluções não previstas | Baixo | §4/§B | Definir resolução mínima suportada explicitamente, ou adicionar layout responsivo na reconstrução |

---

## 22. Plano futuro em etapas

**Etapa 0 — Rede de segurança mínima (sem redesenho de UI)**: expor erro/sucesso de `start/stop/next/create/update/remove` na UI atual (mesmo que só um texto simples); incluir macro em `anyScriptRunning`; corrigir `stopMacro` para não restaurar `mergeMode` incondicionalmente; `show:load` chamando `loadMacros()`. Baixo risco, resolve os bugs mais graves sem tocar em UX.

**Etapa 1 — Corrigir a finalização abrupta no runtime**: ajustar `_flushLayerToUniverse`/`_removeLayerInternal` para respeitar o fade final; expor `fadeOutMs` (e `fadeInMs`) por passo na UI atual, mesmo antes do redesenho completo, com um default não-zero para macros novas.

**Etapa 2 — Redesenho da tela** (conforme §19 obrigatórias): lista com indicadores de progresso, editor completo (todos os campos do schema), validação de referência, confirmações.

**Etapa 3 — Robustez de backend**: `mergeMode` por macro/camada, status multi-macro, validação de referências no create/update, superfície de diagnóstico.

**Etapa 4 — Paralelismo real** (schema de ações por passo, §14): maior escopo, só depois que as etapas anteriores estiverem estáveis e testadas em produção real (culto).

**Etapa 5 — Funcionalidades futuras** (§19): timeline drag-and-drop, modo de encerramento configurável, branches.

---

## 23. Plano de testes

Testes propostos, todos manuais/observacionais até que exista harness automatizado para o compositor:

1. Macro com um passo (start → aguardar duração → observar transição para fim).
2. Macro com vários passos (verificar ordem, transições, chips de UI).
3. Macro em loop (verificar reinício no passo 0 sem intervenção).
4. Avanço manual (`next`) antes da duração natural expirar.
5. Overlap configurado entre dois passos (verificar crossfade real com fadeOutMs>0).
6. Fade-in isolado (duração 0 no fade-out).
7. Fade-out isolado (duração 0 no fade-in).
8. Interrupção manual (`stop`) no meio de um passo.
9. Blackout com macro ativa.
10. Freeze com macro ativa (avançar passos sob freeze, depois descongelar e observar o salto).
11. Troca de cena com macro ativa (única coisa rodando) — confirmar/negar o blackout momentâneo.
12. Macro referenciando script inexistente (start e observar ausência total de feedback).
13. Macro referenciando script com erro de sintaxe/runtime em `OnExecute`.
14. Duas macros com passos escrevendo os mesmos canais DMX, uma HTP e outra linear.
15. Duas macros simultâneas, ambas HTP, canais diferentes (deve funcionar sem interferência).
16. Macro rodando junto com F-Key ativa nos mesmos canais (mergeMode compartilhado).
17. Fim natural da macro sem loop (observar exatamente o que "abrupto" significa em DMX real, com scriptmeter/osciloscópio de canal se disponível).
18. Fim com fade-out configurado (após correção da Etapa 1) — confirmar que o valor não "salta" de volta.
19. Fim mantendo estado (confirmar que canais ficam presos até nova escrita, documentar isso como comportamento esperado ou não).
20. Reload do renderer (F5/dev reload) com macro ativa — observar se a UI resincroniza corretamente via polling.
21. Alteração de arquivo de script durante macro ativa (confirmar que não recompila o passo corrente, conforme §18).
22. Remoção do arquivo de script referenciado por um passo, com a macro parada, depois start.
23. Execução prolongada durante culto simulado (30-60 min, macro em loop, monitorando memória do processo main e acúmulo de camadas órfãs).

---

## 24. Dúvidas que exigem decisão humana

1. O modo de encerramento (`immediate | fade | returnToScene`) deve ser configurável por macro, ou o projeto prefere um comportamento único e fixo em todo o sistema? (Impacta diretamente o design do schema e da UI.)
2. As duas macros de teste quebradas em `shows/vp.show.json` devem ser apagadas, ou os 7 scripts (`mov-padrao-01..04`, `brut-forte`, `brut-padrao-01`, `brut-padrao-03`) devem ser recriados? Eles não existem em lugar nenhum do repositório, nem em backlog.
3. `mergeMode` por macro deve virar `mergeMode` por camada individual (mais flexível, maior mudança) ou basta escopar por macro (suficiente para o caso relatado, menor mudança)?
4. Vale a pena investir em paralelismo real (múltiplos scripts por passo) agora, ou isso deve ficar estritamente para depois que a tela básica e a finalização estiverem estáveis em produção real? (Auditor recomenda adiar — §22, Etapa 4.)
5. Existe expectativa de suportar telas/resoluções menores que a mesa principal para o Painel de Operação (ex.: tablet dedicado), ou a resolução de operação é fixa e conhecida? Isso decide se responsividade entra como requisito obrigatório ou não na reconstrução.
6. O comportamento de freeze "macro roda por baixo sem transmitir" é aceitável para macros especificamente, ou deveria haver uma opção de pausar o avanço de passos durante freeze? (Hoje é consistente com o resto do sistema, mas macro tem uma dimensão temporal que scripts contínuos não têm.)

---

## 25. Conclusão objetiva

O módulo de macros tem um motor de execução (compositor) tecnicamente sólido e mais completo do que a percepção do operador sugere — fade, overlap, loop e sequenciamento funcionam corretamente no nível do runtime. O problema real não é "macro quebrada", é um **descolamento entre o que o backend sabe fazer e o que a UI permite configurar**: cinco campos inteiros do schema (fadeIn, fadeOut, overlap, loop, mergeMode) são inacessíveis pela tela atual, e editar uma macro configurada por fora os zera silenciosamente. A finalização abrupta relatada é consequência direta disso, agravada por um bug de runtime genuíno (flush em peso integral no `_removeLayerInternal`, que reverte o fade mesmo quando configurado). Robustez operacional — validação, feedback de erro, sincronização de estado com trocas de cena/show — é a área mais fraca e mais arriscada para uso ao vivo em culto, mais do que a mecânica central do sequenciador. Uma reconstrução da tela sem também endereçar essas lacunas de backend (§20, §21) resolveria a usabilidade mas manteria os riscos operacionais silenciosos. A recomendação é tratar a Etapa 0 (§22) como pré-requisito imediato, independente do cronograma de redesenho visual.
