# Relatório de Implementação — Scripts F1–F12: Páginas, Biblioteca, Hot Reload e Macros

> Data: 2026-07-19. Branch: `feature/scripts-pages-hotreload` (a partir de `main` em `dfeb182`).
> Coordenador: Sonnet 5. Executor de código: MCP `codex-high`. Revisão independente de cada checkpoint de risco: subagente Sonnet 5 (esforço high), sem acesso ao raciocínio do coordenador.
> **Status: Checkpoints 0 a 10 (de 10) implementados, testados, revisados em dupla e commitados.** Implementação concluída e validada automaticamente. Validação visual/física final pendente do operador — ver §14.

---

## 1. Resumo executivo

Os 10 checkpoints planejados foram completados nesta sessão (retomando trabalho de sessão anterior que havia parado no Checkpoint 8A). Cobrem: migração de scripts F1–F12 para um schema de biblioteca + páginas persistido no show, UI de navegação entre páginas, watcher robusto (chokidar) com correlação de rename, hot reload transacional (compile→validate→swap com rollback automático), classificação visual de scripts, instrumentação de performance do motor DMX, estados de erro visíveis na interface, hardening mínimo do runtime de macros, e uma validação integrada final (testes, build, `node --check`, migração em cópia temporária do show real, soak test simulado do motor).

**85 testes automatizados, 7 arquivos, 100% passando.** Build (`vite build` + `electron-builder`) passa sem erros em todos os checkpoints finais. Nenhuma alteração foi feita em `shows/vp.show.json` (arquivo de produção), `scripts/*.js`, backups ou dist como efeito colateral — todo teste com arquivo real usou cópias temporárias, revertidas após validação.

**Mudança de comportamento visível ao operador**: a partir do Checkpoint 4, existe navegação real entre 6+ páginas de scripts (antes só a página 1 era utilizável pela UI); a partir do Checkpoint 7, botões F-Key mostram classificação visual (categoria/velocidade/intensidade); a partir do Checkpoint 8B, scripts em erro mostram selo ⚠ e toast; macros ganham proteções de segurança no Checkpoint 9 sem mudança de UI além de avisos/selos de erro.

---

## 2. Checkpoints executados

| # | Nome | Commit | Testes (acumulado) | Bugs achados na revisão (corrigidos antes do commit) |
|---|---|---|---|---|
| 0 | Rede de segurança | `e65974b` | 6 | 0 |
| 1 | Schema e migração | `d8dcb10` | 14 | 1 crítico (`show:save` sempre falhava) |
| 2 | Biblioteca e associações (CRUD) | `cac5cba` | ~43 | 3 (camada órfã em move/unassign, slot sobrescrito, update sem validar arquivo) |
| 3 | Runtime paginado (identidade por `scriptId`) | `81fbe91` | 43 | 3 (1 achado pelo coordenador antes da revisão + 2 na revisão) |
| 4 | UI das páginas de scripts | `792d1c3` | 60 | 0 registrado (revisão aprovou sem bloqueio) |
| 5 | Watcher robusto (chokidar) | `71f0c34` | 67 | 3 (unlink parava execução antes da janela de correlação de rename; recriação do mesmo arquivo na janela de 2s não cancelava pendência antiga; timeout ausente no close do watcher) |
| 6 | Hot reload transacional (compile→validate→swap) | `a1e2f57` | 67 | 1 (vazamento pequeno em `scriptReloadErrors`) |
| 7 | Classificação visual (categoria/velocidade/intensidade) | `87be5a8` | 70 | 1 (colisão visual entre badges e texto do botão, pior em F10–F12) |
| 8A | Instrumentação de performance do motor DMX | `42069af` | 74 | 0 registrado no commit (revisão rodava no momento do commit, sem achado bloqueante) |
| 8B | Estados de erro visíveis na interface | `8a1d858` | 78 | 2 (`lastError` órfão em script parado após correção do arquivo; tooltip do selo de erro inoperante por `pointerEvents:none`) |
| 9 | Hardening mínimo do runtime de macros | `f1f13be` | 85 | 2 (bloqueio indevido de auto-reinício de macro linear ativa; troca silenciosa de fade/overlap entre passos ao remover passo do meio no editor antigo) |
| 10 | Validação integrada | *(este commit)* | 85 (sem novo código) | — |

Total: **13 bugs reais encontrados e corrigidos por revisão independente antes de qualquer commit**, ao longo de 11 checkpoints de código (0–9). Nenhum foi commitado sem correção.

---

## 3. Checkpoint 0 — Rede de segurança (`e65974b`)

Guard `e.repeat` no handler de teclado (segurar F1 não liga/desliga em rajada), correção de bug de erro descartado no Painel de Operação, limpeza de estado entre shows. 6 testes.

## 4. Checkpoint 1 — Schema e migração (`d8dcb10`)

Schema `scriptLibrary`/`scriptPages` (mínimo 6 páginas) com migração automática e idempotente do bloco legado `scripts`, com backup (`*.pre-script-migration.bak`). Bug crítico corrigido na revisão: `show:save` quebrava sempre.

## 5. Checkpoint 2 — Biblioteca e associações (`cac5cba`)

CRUD completo de biblioteca de scripts (registrar/editar/remover/associar/mover/desassociar), backend/IPC puro, sem UI nova ainda. 3 bugs de camada DMX órfã corrigidos na revisão.

## 6. Checkpoint 3 — Runtime paginado (`81fbe91`)

Migração da identidade de execução de F-Key (`"F1"`) para `scriptId` estável da biblioteca (`"script:<id>"`), eliminando a cache runtime `scriptMeta` e as 4 funções de sincronização que causavam os bugs dos dois checkpoints anteriores. A partir daqui, `show.getShow().scriptLibrary`/`scriptPages` é a única fonte de verdade, sem cache paralela.

## 7. Checkpoint 4 — UI das páginas de scripts (`792d1c3`)

**Primeira vez que a série mexe em `src/` de forma visível ao operador.** Barra de seleção de páginas de scripts na mesa (com indicador de quantidade de scripts ativos por página), F-Keys lidas pela página ativa (antes fixas em `page-1`), evento push `scriptLibrary:changed` substituindo a necessidade de polling para biblioteca/páginas, módulo puro `scriptPagesSelectors.js` compartilhado entre `Main.jsx` e `PainelOperacao.jsx`. Bug corrigido durante a integração: `dmx:blackout` não emitia atualização ao renderer.

## 8. Checkpoint 5 — Watcher robusto com chokidar (`71f0c34`)

`fs.watch(recursive:true)` substituído por `chokidar` com `awaitWriteFinish` (resolve salvamentos atômicos/lentos nativamente). Novo módulo puro `scriptWatcherLogic.js` (correlação de rename testável sem I/O). Registro de arquivos por hash SHA-1, correlação de rename por conteúdo (unlink não para execução imediatamente — fica pendente 2s esperando um add/change com o mesmo hash). 3 bugs de correlação de rename e fechamento do watcher corrigidos na revisão, incluindo um reproduzido empiricamente pelo subagente com um probe real de chokidar.

## 9. Checkpoint 6 — Hot reload transacional (`a1e2f57`)

`compileScriptForSwap`: compila e valida uma nova versão de script **sem tocar em nenhuma camada existente**; só em caso de sucesso (parse OK, pelo menos um hook definido, `OnStart` não lança) a camada antiga é parada e a nova adicionada, em um único tick síncrono. Em falha, a camada antiga nunca é tocada — continua rodando ininterrupta — e o erro fica em `scriptReloadErrors`. Escopo deliberadamente restrito a scripts de F-Key/biblioteca (page-scripts e macros ficaram fora, macros endereçadas no Checkpoint 9). 1 vazamento pequeno corrigido na revisão.

## 10. Checkpoint 7 — Classificação visual (`87be5a8`)

Codificação redundante forma+cor (não só cor, por acessibilidade): velocidade = barras verticais crescentes; intensidade = faixa na base do botão com espessura e cor crescentes; categoria = glifo Unicode no canto superior esquerdo. Módulo puro `scriptClassification.js` + componente compartilhado `ScriptClassificationBadges.jsx`. Bug de colisão visual entre badges e texto do botão (pior em F10–F12) corrigido na revisão.

## 11. Checkpoint 8A — Instrumentação de performance (`42069af`)

Módulo puro `perfStats.js` (tracker de duração, 5 faixas de classificação, rate-limit de aviso). `compositor.renderFrame()` e `engine.js` instrumentados por estágio (interpolator/compositor/artnet/listeners/total), medindo duração por camada e por frame, sem alterar nenhuma condição, valor DMX ou ordem de chamada (confirmado linha a linha contra a versão anterior). IPC `performance:getSnapshot` sob demanda. Nota explícita já registrada no código: a medição detecta scripts lentos que retornam, **não detecta nem interrompe um loop infinito** (limitação estrutural do single-thread, documentada, não um watchdog).

## 12. Checkpoint 8B — Estados de erro visíveis na interface (`8a1d858`)

Estados implementados em `scriptLibrary.computeScriptStatus`: `missing-file`, `last-valid-running`, `onstart-error`, `compile-error`, `reload-error`, `running`, `stopped` — precedência `missingFile > lastError > compileError > running/stopped`. `lastError` propagado do main process até os slots de página (`Main.jsx` e `PainelOperacao.jsx` via o mesmo seletor). Selo `⚠` em `ScriptClassificationBadges` no canto superior direito (sem sobrepor F1–F12, nome do script, ícone de categoria, barras de velocidade ou faixa de intensidade), com tooltip funcional. Toast disparado apenas na transição para estado de erro (rate-limited via `Set` em `useRef`, não repete a cada snapshot); `last-valid-running` fica fora do toast intrusivo mas mantém o selo visual.

2 bugs encontrados e corrigidos na revisão independente antes do commit:
1. `lastError` de scripts **parados** (não rodando) ficava órfão indefinidamente após o arquivo ser corrigido no disco, porque o watcher só revalida scripts em execução. Corrigido: `handleScriptAddOrChange` agora limpa `scriptReloadErrors` de entradas paradas quando a checagem estática do arquivo volta a passar.
2. Tooltip do selo de erro nunca aparecia na prática porque o `<span>` tinha `pointerEvents:'none'`, bloqueando o hover. Corrigido removendo essa propriedade apenas do selo de erro.

Testes: 78 (7 arquivos). Build OK.

## 13. Checkpoint 9 — Hardening mínimo de macros (`f1f13be`)

Duas auditorias completas (`docs/auditorias/exploracao/macros-vp-light/` e `docs/auditorias/exploracao/runtime-scripts-hot-reload/`) foram revalidadas contra o código atual antes da implementação. Sete itens implementados:

1. **Recarga ao trocar de show**: `loadMacros()` agora limpa `macroDefs`/`macroStepErrors` e chama `compositor.clearMacros()` (nova função) antes de repovoar; `show:load` passou a chamar `loadMacros()` (antes só chamava `loadPageScriptMeta()`, deixando macros do show anterior fantasmas em memória).
2. **`compositor.hasActiveControlLayers([excludeIds])`**: nova API que consulta o estado real do compositor (`_layers.size > 0`, com exclusão opcional de IDs) — toda camada (F-Key, page-script, passo de macro em fade-in/hold/fade-out) vive no mesmo `_layers`, então essa API cobre macro ativa corretamente. Substitui o cálculo manual `Object.keys(runningScripts)+runningPageScripts` em `dmx:restoreState`, corrigindo o blackout momentâneo ao trocar de cena com só uma macro ativa.
3. **Referências inválidas**: `validateMacroReferences` (pura, recalculada sob demanda) checa script vazio/arquivo ausente por passo. `macro:list` expõe `valid`/`invalid`/`invalidSteps`/`lastError`; `macro:start` recusa iniciar macro com passo inválido **sem apagar a macro**, retornando erro explícito.
4. **Erros durante execução de macro**: `onError` no `addLayer` de cada passo (dentro de `_enterStep`) limpa o estado do passo e chama `_gotoNextStep` para avançar automaticamente (ou encerrar se era o último passo) em vez de deixar a macro "ativa" presa com uma camada morta. Notificação via `setMacroStepErrorHandler` (novo), registrada em `macroStepErrors` (Map em `main.js`, mesmo padrão do Checkpoint 8B).
5. **`mergeMode` global**: `startMacro` bloqueia iniciar uma macro `linear` quando há **outras** camadas ativas (excluindo as da própria macro, para permitir reiniciar a si mesma), retornando erro explícito em vez de contaminar o merge global silenciosamente. HTP continua funcionando sem restrição.
6. **Proteção da tela antiga**: `PainelOperacao.jsx` `handleSaveMacro` agora preserva `mergeMode`/`loop`/`fadeInMs`/`fadeOutMs`/`overlapMs` de uma macro avançada em vez de zerá-los a cada edição pela UI simples; aviso visível no modal quando a macro tem campos avançados; selo de macro inválida e de `lastError` na lista; botão Start desabilitado para macro inválida; alerta explícito quando o start falha.
7. **Hot reload em macros**: sem mudança funcional (deliberado — risco de quebrar a máquina de estados do sequenciador fora de escopo). Confirmado e documentado em comentário: um passo ainda não iniciado sempre compila a versão nova do arquivo (compilação lazy, automática); um passo **já ativo** não é recarregado a quente nesta fase — a versão nova só entra em vigor quando a macro reentra nesse passo (loop ou reinício manual).

**Fora de escopo, deliberadamente não tocado**: `_flushLayerToUniverse` reaplicar o buffer em peso integral no frame de remoção (bug de finalização abrupta, já documentado na auditoria, não corrigido aqui); reset incondicional de `mergeMode` para `'htp'` dentro de `stopMacro` (pode desligar o modo linear de outra macro ainda ativa — conhecido, não corrigido); paralelismo por passo (múltiplos scripts simultâneos); editor visual novo de macros; macros em slot F-Key; criação das 20 macros do evento.

2 bugs encontrados e corrigidos na revisão independente antes do commit:
1. `hasActiveControlLayers()` sem exclusão bloqueava indevidamente uma macro linear já ativa de reiniciar a si mesma (ex.: duplo clique de Start). Corrigido adicionando o parâmetro `excludeIds` e passando `macro._activeLayerIds`.
2. `handleSaveMacro` casava passos por índice para preservar fade/overlap — removendo um passo do meio no editor, os passos seguintes herdavam silenciosamente o fade/overlap do passo **errado** (deslocamento de índice). Corrigido carregando os campos originais (`_orig`) direto em cada objeto de passo do draft, sobrevivendo a remoção/reordenação independente de posição.

Testes: 85 (7 arquivos, +7 novos em `tests/compositor.test.js`). Build OK.

## 14. Checkpoint 10 — Validação integrada

### 14.1 Testes automatizados

```
npm run test
Test Files  7 passed (7)
     Tests  85 passed (85)
```

`git diff --check`: limpo, sem marcadores de conflito nem espaço em branco problemático.

`node --check` em todos os arquivos críticos do main process e da engine:
```
electron/main.js                  OK
electron/preload.js               OK
electron/show.js                  OK
electron/scriptLibrary.js         OK
electron/scriptWatcherLogic.js    OK
electron/engine/compositor.js     OK
electron/engine/engine.js         OK
```

### 14.2 Build

`npm run build` (`vite build` + `electron-builder`): sucesso, instalador NSIS gerado (`dist/vp-light Setup 1.0.0.exe`) sem erros. Único aviso é o padrão do Vite sobre chunk `viewer3d` acima de 500kB (pré-existente, não relacionado a este trabalho).

### 14.3 Migração do show real em cópia temporária

`shows/vp.show.json` real (produção, ainda no schema legado — `scriptSchemaVersion: undefined`, bloco `scripts` antigo, 2 macros já quebradas conforme a auditoria) foi **copiado** para um diretório temporário fora do repositório e migrado via `electron/show.js` (módulo puro, sem dependência de `electron`) diretamente por Node, duas vezes seguidas:

- 1ª carga: migração executa, gera `scriptSchemaVersion: 1`, 12 entradas de `scriptLibrary`, 6 páginas de script, 2 macros preservadas (agora sujeitas à validação do Checkpoint 9), bloco legado `scripts` removido, 24 fixtures e 10 páginas de cena intocadas, backup `.pre-script-migration.bak` gerado.
- 2ª carga: idempotente (mesmo conjunto de chaves de `scriptLibrary`).

O arquivo real `shows/vp.show.json` **não foi tocado** (confirmado por `git status`/`git diff` antes e depois) — todo o teste rodou sobre a cópia temporária, que não faz parte do repositório.

### 14.4 Soak test simulado do motor (sem Electron GUI, sem Art-Net físico)

O ambiente desta sessão tem `ELECTRON_RUN_AS_NODE=1` fixado, o que **impede o boot real do processo Electron com `app`/`BrowserWindow`** (confirmado: `require('electron')` retorna undefined para `app` nesse modo). Isso é diferente do ambiente da sessão anterior (que conseguiu bootar o processo main completo, conforme relatório anterior) — não é uma regressão deste código, é uma característica do sandbox atual. Por isso, o smoke test de boot completo do Electron **não pôde ser executado nesta sessão** e fica pendente de validação manual numa máquina normal (§14.6).

Como alternativa automatizada dentro do que o ambiente permite, `electron/engine/engine.js` e `electron/engine/compositor.js` são módulos Node puros (sem `require('electron')`), então foi possível exercitar o motor real diretamente:

- **Soak funcional (50.000 frames renderizados, equivalente a ~33 minutos de show a 25fps)**: 2 camadas persistentes tipo F-Key + 1 macro de 3 passos em loop (fade-in/overlap/fade-out) + toggle periódico de uma camada extra. Resultado: **0 exceções não capturadas**, `layerCount` sempre baixo e estável (3–5), heap cresceu ~1,5MB ao longo do teste — consistente com o vazamento **já conhecido e classificado como não bloqueante** de `_layerStats` acumulando uma entrada por transição de passo de macro (medido nesta sessão: ~34 entradas/minuto simulado, projeção para um evento de 3h ≈ 6.000 entradas / ~8MB — não é evidência de impacto maior que o já registrado, então **não foi corrigido**, conforme instrução explícita).
- **Soak do caminho de erro (5.000 frames, macro de 1 passo cujo `OnExecute` sempre lança exceção, em loop)**: `maxLayerCount` nunca passou de 1 (nenhuma camada morta acumulada), a macro nunca ficou presa ("ativa sem camada") entre frames, 5.000 notificações de erro entregues corretamente via `setMacroStepErrorHandler` — confirma que o mecanismo de auto-avanço do Checkpoint 9 é robusto mesmo no cenário mais adverso (falha em 100% das execuções).

Nenhum pacote Art-Net foi transmitido durante esses testes (a engine standalone usada aqui não inicializa socket UDP fora do fluxo normal do `main.js`; em nenhum momento houve tentativa de transmissão a equipamento físico).

### 14.5 O que foi validado automaticamente (Checkpoints 0–10)

- Todo o CRUD de biblioteca/páginas de script, migração de schema, resolução de slot por página, execução simultânea de camadas por `scriptId`.
- Lógica pura de correlação de rename do watcher (`scriptWatcherLogic.js`).
- Precedência de estados de erro de script (`computeScriptStatus`) e ausência de regressão nos seletores de página.
- Classificação visual (módulo puro `scriptClassification.js`).
- Instrumentação de performance (`perfStats.js`) e suas faixas de classificação.
- As 7 áreas do hardening de macros (recarga em troca de show, `hasActiveControlLayers`, validação de referências, recuperação de erro em passo de macro, bloqueio de macro linear insegura, preservação de campos avançados no editor antigo, e a confirmação/documentação da limitação de hot reload em passo ativo) — incluindo os 2 cenários de borda encontrados na revisão independente (auto-reinício de macro linear, remoção de passo do meio).
- Migração do show **real** de produção contra o schema novo, em cópia isolada, idempotente.
- Estabilidade de memória/ausência de exceções do motor ao longo de uma janela simulada equivalente a ~33 minutos de show contínuo, incluindo um cenário de falha permanente de script dentro de macro.

### 14.6 O que NÃO foi validado nesta sessão (pendente do operador)

Sem GUI real disponível neste ambiente (bloqueio estrutural, não contornável sem desativar uma proteção do sandbox — o que não foi feito), os itens abaixo **precisam de validação manual numa máquina normal antes do evento**:

- Abrir as 6 páginas de script pela UI real e confirmar a navegação/indicador de página ativa.
- Ativar scripts em 3 páginas diferentes simultaneamente e confirmar que não há interferência entre elas.
- Confirmar visualmente a classificação (ícone de categoria, barras de velocidade, faixa de intensidade) nos 12 botões F-Key e no Painel de Operação.
- Provocar um erro de sintaxe numa cópia de script associado, confirmar que a versão anterior continua rodando (`last-valid-running`), corrigir o arquivo e confirmar que o selo de erro some sozinho (sem precisar reiniciar o script manualmente — comportamento novo do Checkpoint 8B revisado).
- Testar o watcher com salvamento real via editor (ex.: VSCode, que salva por arquivo temporário + rename) e confirmar que a associação sobrevive.
- Testar blackout, freeze e troca de cena com uma macro ativa (HTP e, separadamente, tentar uma linear — confirmar que a linear é bloqueada quando outra camada já está ativa, e funciona quando está sozinha).
- Testar a edição de uma macro com campos avançados (fade/overlap/loop configurados só via show.json ou versão futura da tela) pela tela atual e confirmar que esses campos realmente sobrevivem ao salvar.
- Execução prolongada real (30+ minutos, idealmente as ~3h do evento) com o app de verdade, monitorando console/Gerenciador de Tarefas para confirmar que o crescimento de memória projetado (~8MB por `_layerStats`) se mantém irrelevante na prática.
- Confirmar que nenhuma transmissão Art-Net indesejada ocorre antes de autorização explícita do operador ao testar qualquer um dos itens acima com o rig físico conectado.

### 14.7 Roteiro manual objetivo (curto)

1. Abrir o app numa máquina com display, `npm run dev`.
2. Abrir as 6 páginas de script uma a uma pela barra de páginas; confirmar troca visual e F-Keys corretas por página.
3. Ativar 1 script em cada uma de 3 páginas diferentes; confirmar que os 3 continuam rodando ao trocar de página (indicador de "N ativo(s)" na aba da página).
4. Conferir selo de categoria/velocidade/intensidade em pelo menos 3 F-Keys com scripts diferentes.
5. Editar uma cópia de um script ativo introduzindo um erro de sintaxe; salvar; confirmar selo `⚠` + toast + tooltip com a mensagem; confirmar que o script continua com a última versão válida rodando.
6. Corrigir o arquivo; salvar; confirmar que o selo some sozinho, sem reiniciar manualmente.
7. Testar Blackout e Freeze com pelo menos um script ativo; confirmar comportamento esperado (blackout apaga tudo; freeze só bloqueia saída Art-Net, motor continua).
8. No Painel de Operação, criar uma macro HTP simples (2–3 passos) e uma segunda tentando `mergeMode:'linear'` enquanto a primeira ainda está ativa — confirmar que a linear é recusada com mensagem de erro, e que iniciar a linear sozinha (sem nada mais ativo) funciona.
9. Trocar de cena com só a macro HTP ativa; confirmar que não há blackout momentâneo.
10. Trocar de show (abrir outro `.show.json` ou o mesmo de novo) com uma macro ativa; confirmar que ela some da lista e não reaparece "fantasma".

---

## 15. Testes não executados / limitações conhecidas

- **Boot completo do Electron (GUI real)** não foi possível nesta sessão (`ELECTRON_RUN_AS_NODE=1` no ambiente) — mitigado com validação Node-pura da engine/compositor e da migração do show real, mas não substitui o teste real de UI.
- **`electron/main.js` continua sem harness de teste unitário direto** (limitação estrutural já registrada desde o relatório anterior — `require('electron')` no topo do módulo). Os bugs de `main.js` encontrados nesta e nas sessões anteriores (show:save, camadas órfãs, `lastError` órfão, `macro:start`) foram todos pegos por revisão de código, não por teste automatizado.
- **Sem harness de componente para telas React** (`Main.jsx`, `PainelOperacao.jsx`) — mudanças de UI (Checkpoints 4, 7, 8B, 9) foram validadas por revisão de código e, em checkpoints anteriores a este, por smoke test de boot; validação visual/interativa real fica para o operador (§14.6).
- **Vazamento conhecido em `_layerStats`** (uma entrada por transição de passo de macro, nunca liberada) — medido nesta sessão (~34 entradas/min simulado), classificado como não bloqueante para um evento de 3h (~8MB projetado). Não corrigido, conforme instrução explícita.
- **`_flushLayerToUniverse` reaplica peso integral no frame de remoção** — bug de finalização abrupta de macro já documentado na auditoria de macros, fora do escopo do Checkpoint 9, não corrigido.
- **`stopMacro` reseta `mergeMode` para `'htp'` incondicionalmente** — pode desligar o modo linear de outra macro ainda ativa; conhecido, não corrigido (fora do escopo mínimo do Checkpoint 9).
- **Paralelismo real dentro de um passo de macro** (múltiplos scripts simultâneos por passo) não existe — schema de passo continua aceitando só 1 script.
- **Editor visual de macros continua o mesmo modal simples** — não foi reconstruído (fora de escopo), apenas protegido contra apagar campos avançados silenciosamente.
- **As 20 macros do evento não foram criadas** — fora de escopo desta série de checkpoints.

## 16. Débitos técnicos (para trabalho futuro, fora desta série)

1. Extrair mais lógica de `electron/main.js` para módulos puros testáveis (padrão já estabelecido por `scriptLibrary.js`/`scriptWatcherLogic.js`/`perfStats.js`), reduzindo a superfície que só revisão manual consegue cobrir.
2. Corrigir `_flushLayerToUniverse` para respeitar o `weight` no frame de remoção (resolve a finalização abrupta de macro na raiz, não só via fade-out configurado).
3. `mergeMode` por camada/macro em vez de global (permitiria macros linear e HTP simultâneas sem risco de contaminação, e um `stopMacro` que não precise resetar globalmente).
4. Limitar/expirar entradas de `_layerStats` para IDs de passo de macro (hoje cresce sem limite, atualmente inofensivo na escala medida).
5. Redesenho completo da tela de macros (indicador de progresso, todos os campos do schema editáveis, confirmação para ações destrutivas) — mapeado em detalhe na auditoria de macros, não iniciado.
6. Schema de passo de macro com lista de ações (paralelismo real) — mudança de escopo moderado, avaliada e adiada deliberadamente pela auditoria.

## 17. Procedimento de rollback

```
git checkout main
git branch -D feature/scripts-pages-hotreload   # opcional
```
Commit-base: `dfeb182` em `main` (intocada durante toda a sessão).

Para reverter só os checkpoints mais recentes (preservando os anteriores):
```
git reset --hard 42069af   # volta pro Checkpoint 8A, descarta 8B/9/10
git reset --hard 8a1d858   # volta pro Checkpoint 8B, descarta 9/10
git reset --hard f1f13be   # volta pro Checkpoint 9, descarta 10
```
(Use com cautela — `reset --hard` descarta trabalho não commitado. Neste ponto da branch não há mudanças pendentes de código, só documentação.)

Backups: `backups/pre-scripts-pages-2026-07-19/` (show + scripts/ originais, fora do git, de sessão anterior). Nenhum backup adicional foi necessário nesta sessão porque nenhuma migração real foi commitada — `shows/vp.show.json` permanece no schema legado no HEAD desta branch, e será migrado automaticamente (com backup `.pre-script-migration.bak` gerado pelo próprio `show.js`) na primeira vez que o app real carregar o show de produção com este código.

## 18. Status real da versão para o evento

**Implementação concluída e validada automaticamente**: todos os 10 checkpoints planejados estão commitados, com 85 testes automatizados passando, build de produção funcional, `node --check` limpo em todos os arquivos críticos, migração do show real validada (em cópia) e um soak test simulado do motor sem exceções nem vazamentos anômalos.

**Validação visual/física final pendente do operador**: não houve, nesta sessão, nenhuma interação real de UI (cliques, teclado) nem boot do processo Electron completo (bloqueio de ambiente, não do código), nem qualquer transmissão Art-Net a hardware físico. O roteiro manual do §14.7 deve ser executado numa máquina normal, com display e (se possível) o rig físico, antes de considerar esta branch pronta para o evento. Recomendação: reservar tempo para esse roteiro manual completo — que inclui especificamente os cenários de macro linear bloqueada, recuperação de erro de script e troca de show com macro ativa, todos novos nesta sessão — antes de qualquer decisão de merge para produção.
