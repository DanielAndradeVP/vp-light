# Auditoria — Main Process, IPC e Persistência (electron/main.js, preload.js, show.js)

> Auditoria **read-only**. Executor: **codex-xhigh** (MCP). Auditor principal: Claude (Sonnet 5).
> Nenhum arquivo alterado. `node --check` passou nos 3 arquivos. Data: 2026-07-24.
> `[fato]` = arquivo:linha. `[análise]` = interpretação.

Escopo: `electron/main.js` (2177 linhas), `electron/preload.js`, `electron/show.js`.

---

## Veredito dos pontos de auditorias anteriores

- **Validação de fixtures no load: NÃO foi corrigida.** `validateFixtures()` só roda em save/saveAs (show.js:348,372); `loadShow()` aceita o show sem chamá-la (show.js:286).
- `7fe113f` **não alterou `show.js`** — só acrescentou os handlers globais de exceção em main.js:40.
- Migração de show legado com `scripts` é feita in-place com backup+`.tmp` (show.js:295). Um show sem o campo novo e sem `scripts` legado é migrado **só em memória**, não persistido (show.js:325).
- `b148e2c` alinhou `script:create/edit/clear` entre main/preload (main.js:1156, preload.js:109), mas **não ficou funcionalmente completo**: `script:clear` não tem call site ativo; `script:edit` só é chamado num branch travado por `EXISTING_SCRIPTS_SHOW_VSCODE = false` (Main.jsx:22,3089).
- Macros com script inexistente **deixaram de falhar silenciosamente** — main.js valida antes do start (main.js:2001,2063) e a UI mostra os passos inválidos. (Mas as 2 macros do show atual continuam quebradas — ver relatório de scripts/macros.)
- **Dupla sincronização de cena permanece**: `SceneDmxSync` (showStore.js:363) e `Main.jsx` (Main.jsx:781) repetem as mesmas 3 operações IPC.

---

## electron/show.js — bugs reais

- **[Alto] Validação de fixtures ausente no load** — show.js:286-294 só exige `version`/`fixtures` array/`pages` objeto; `validateFixtures()` (channel overlap, limites 1-512) só roda em save (show.js:211,354,378).
- **[Alto] Save aceita payload incompleto** — `(showData||currentShow)?.fixtures||[]` mascara `fixtures` ausente/null (show.js:353-354); sem validação de `version`/`pages`/`meta`/`scriptLibrary`/`macros` antes de escrever. Um `{}` do renderer pode gerar um show sem `version`/`fixtures` que `loadShow()` rejeitará na próxima abertura.
- **[Alto] Estado em memória muda antes da persistência ser confirmada** — `currentShow = showData` acontece antes do write/rename atômico (show.js:355-364,379-385). Falha de I/O em "Salvar Como" deixa conteúdo novo em memória com o caminho antigo ainda ativo.
- **[Alto] Migração não é transacional** — se o write/rename da migração falhar, o código só loga erro mas segue com `show = migrated` (show.js:317-321): sessão usa schema novo, disco continua no antigo, repete a migração toda vez.
- **[Médio] Colisão de slug na migração** — `"A B"` e `"A-B"` geram o mesmo slug `a-b`; a segunda sobrescreve a primeira sem aviso (show.js:31-39,117-148).
- **[Médio] `scriptSchemaVersion` futuro é tratado como antigo** — condição é só `!== 1` (show.js:295); um schema 2 futuro seria downgradeado.
- **[Médio] Schema de fixtures insuficiente mesmo no save** — permite `channelCount:0`, não exige IDs únicos, não valida aliases duplicados/vazios (show.js:211-245); o show atual já tem 2 aliases vazios numa fixture desabilitada (vp.show.json:243-256).
- **[Médio] Validação superior superficial** — `pages` como array passa (`typeof array === 'object'`); `version: null` passa (só `undefined` é rejeitado) (show.js:289-293).
- `path` importado e não usado (show.js:20).

## electron/main.js — bugs reais

- **[Alto] Trocar de show não limpa o universo anterior** — sem `blackout()`/reset de `activeSceneChannels` no fluxo `show:load` (main.js:499-509); canais só presentes no show antigo continuam latched.
- **[Alto] Load pode retornar erro após já instalar parcialmente o novo show** — `loadShow()` seta `currentShow`/`currentShowPath` antes de `loadPageScriptMeta`/`loadMacros` rodarem, que podem lançar em dados malformados (main.js:502-508,661-675,1976-2029) — main e renderer ficam divergentes.
- **[Alto] Load inválido interrompe scripts antes de confirmar que o arquivo é usável**, sem restauração no catch (main.js:499-513).
- **[Alto] "Limpar/Desassociar" pode deixar camada DMX órfã** — fluxo ativo do renderer chama `scriptLibrary:unassign`, que remove a associação **sem parar** `runningScripts[id]` (main.js:1559-1572; Main.jsx:946-949). F-key some do botão mas a camada continua escrevendo DMX até blackout/Parar tudo.
- **[Alto] Criação de script pode sobrescrever código existente** — se qualquer grupo de conhecimento for selecionado, o arquivo é reescrito mesmo se já existir, sem backup (main.js:1160-1200).
- **[Alto] Criação de script escreve antes de validar show/slot/nome** — pode deixar arquivo órfão no disco se não houver show carregado ou o slot for inválido (main.js:1186-1225).
- **[Médio] "Editar Script" de F-key está inacessível** — única chamada de `editScript()` presa num branch de constante `false` (Main.jsx:22,3089-3102) — consequência colateral de `b148e2c`.
- **[Médio]** Page scripts/macros não têm a mesma validação de hooks que F-keys — `compileLayer()` engole erro de `OnStart` silenciosamente (main.js:1146-1153,1927-1945).
- **[Médio]** Erro de compilação de macro pode não chegar a `macroStepErrors`/UI (main.js:2063-2072,2152-2154; compositor.js:394-420).
- **[Médio]** `macro:update` pode deixar definição e compositor divergentes se a nova definição for malformada (main.js:2047-2055); `macro:remove` sem try/catch em volta de `saveMacros()` (main.js:2075-2081).
- **[Médio]** Múltiplas macros podem rodar simultaneamente, mas `macro:status` só reporta a primeira (main.js:2094; compositor.js:452-457).
- **[Médio]** Referência de page script temporariamente ausente é apagada silenciosamente no próximo save (main.js:630-675).
- **[Médio]** Watcher de arquivo só verifica consumidores F-key ao remover um script — não cobre page scripts nem passos de macro ativos (main.js:1720-1729).
- **[Baixo]** IPCs DMX retornam `{ok:true}` mesmo para canal inválido (main.js:372-385; universe.js:41-45).
- **[Baixo]** `show:saveAs` interrompe macros ativas via `loadMacros()`→`clearMacros()` (main.js:562-574,2018-2029).

## Segurança

- **[Crítico] Path traversal em `script:create`/`page_script:create`/macros** — o caminho é montado direto de `name` antes de qualquer validação segura (main.js:1156-1158,1892-1902,1987-2008; o helper seguro de `scriptLibrary.js:14-18` só é chamado depois da escrita). `name = "..\\fora"` escreve fora de `scripts/`. `groups` também é concatenado sem validação antes de um `readFileSync` (main.js:1171-1176) — pode incorporar conteúdo de outro `.md` acessível. Entradas de `scriptLibrary` vindas do show não são revalidadas no load (main.js:1297-1303) — um `.show.json` editado à mão com `script: "..\\outro\\payload"` é aceito.
- **[Crítico] `new Function` não isola nada** — o script inteiro roda no processo principal com acesso efetivo a engine, filesystem, IPC e Art-Net (main.js:1114-1124). Combinado com o traversal acima, um show malicioso ou renderer comprometido pode chegar a execução de código no main.
- **[Alto] `show:load(filePath)` aceita path arbitrário do IPC** (preload.js:83; main.js:485-503) — sem restrição de extensão/diretório; esse mesmo caminho pode ser sobrescrito depois por `saveShow`.
- **[Alto] Viewer 3D recebe o mesmo `preload.js` privilegiado da janela principal** — inclui escrita de shows/scripts, macro start, blackout, encerramento do app; handlers não validam `event.sender` (main.js:179-193,226-237; preload.js:10-159). `contextIsolation`/`nodeIntegration` corretos, mas sem `sandbox:true` nem bloqueio de navegação visível.

## Riscos operacionais

- **[Crítico]** Loop infinito de script congela todo o controle DMX (mesmo achado do relatório de engine — convergência entre as duas frentes).
- **[Alto]** I/O e compilação síncronos (`fs.*Sync`) competem com o tick de 40ms — salvar show grande ou editar scripts pode atrasar frames Art-Net ao vivo.
- **[Alto]** Sem `requestSingleInstanceLock` — abrir o executável duas vezes cria dois engines enviando Art-Net para o mesmo destino.
- **[Alto, condicional ao build empacotado]** `shows/`/`scripts/` resolvidos por `__dirname`, incluídos no pacote sem `extraResources` — no ASAR padrão isso tende a ser somente-leitura; save/criação de script pode falhar na versão instalada mesmo funcionando pelo repositório.
- **[Médio]** Encerramento aguarda watcher (até 2s) antes de `engine.stop()`, sem blackout final — luzes podem permanecer no último look por até 2s após fechar o app.
- **[Médio]** Handlers globais de exceção só logam e continuam — sem garantia de estado consistente depois, sem alerta visual ao operador.

## Código morto / IPC órfão

- 57 handlers `ipcMain.handle`; só `artnet:getInterfaces` não tem ponte no preload.
- Handlers com ponte mas **sem consumidor efetivo** no renderer atual: `engine:start/stop/status`, `performance:getSnapshot`, `dmx:activateScene`, `custom:speed` (3 aliases), `show:saveAs`, `script:toggle`/`getAll`, `scriptLibrary:register/remove`, `scriptLibrary:associate`, `scriptPages:reorder`, `script:edit` (branch morto), `script:clear` (sem call site).
- Evento `scripts:changed` emitido (main.js:1653) sem nenhum listener no renderer.
- `scriptGenerationCounters` incrementado e nunca lido; parâmetro `_parLedChs` chega ao main e é ignorado (main.js:475-479 — **confirmado também pela frente de frontend**, que mostra o renderer calculando e enviando esse array à toa); parâmetros `reason` não usados em 2 funções.

## Resumo priorizado

**Crítico**
1. Path traversal em criação de script/page-script/macro permite escrever e (via macro) executar fora de `scripts/`.
2. `new Function` sem isolamento — combinado ao traversal, é execução de código no processo principal.
3. (Convergente com engine) Loop infinito em script paralisa Art-Net/IPC/UI/blackout.

**Alto** (12 itens — ver corpo do relatório): fixtures sem validação no load; troca de show não limpa universo; load pode falhar após instalar parcialmente; "Limpar/Desassociar" deixa camada órfã; criação de script sobrescreve/deixa órfão; save aceita schema incompleto; save muda memória antes de confirmar disco; migração não-transacional; build empacotado provavelmente read-only para shows/scripts; sem single-instance lock; Viewer 3D com preload privilegiado sem validar sender; `show:load` aceita path arbitrário.

**Médio**: script:edit/clear órfãos pós-`b148e2c`; dupla sincronização de cena; compile/OnStart de macro/page-script sem feedback; colisão de slug na migração; watcher não cobre page-scripts/macros; múltiplas macros com status incorreto; page-scripts somem no save seguinte; I/O síncrono compete com o loop de 40ms.

**Baixo**: IPCs DMX aceitam canal inválido e retornam sucesso; `show:saveAs` interrompe macro ativa; 16 canais IPC/1 evento órfãos; estado/argumentos mortos (`scriptGenerationCounters`, `_parLedChs`, `reason`); import `path` não usado.
