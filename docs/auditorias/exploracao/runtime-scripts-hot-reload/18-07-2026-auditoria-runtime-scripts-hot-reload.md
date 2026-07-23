## Auditoria de runtime de scripts, hot reload, performance e isolamento futuro

**Data:** 18/07/2026
**Escopo:** `docs/auditorias/exploracao/runtime-scripts-hot-reload/`
**Modo:** Read-only. Nenhum arquivo de produção foi alterado. Nenhuma refatoração ou implementação foi realizada.
**Método:** Auditor principal (Sonnet 5) definindo foco e conclusões; agente de exploração (`codex-high`, via MCP) usado exclusivamente para leitura de arquivos, rastreio de fluxo e coleta de evidências. Toda evidência relevante reportada pelo `codex-high` foi conferida diretamente pelo auditor principal lendo o código-fonte (ver arquivos citados abaixo — as linhas foram confirmadas linha a linha nos trechos críticos: `electron/main.js:61-63, 697-714, 1052-1112, 1183-1343`, `electron/engine/compositor.js` completo, `electron/engine/engine.js` completo, `electron/engine/artnet.js:171-256`, `electron/show.js:87-157`, `package.json`).

---

## 1. Resumo executivo

O VP-LIGHT executa scripts de iluminação como **JavaScript compilado dinamicamente via `new Function()`**, rodando **de forma síncrona, dentro do processo main do Electron, no mesmo `setInterval` de 40 ms que também despacha o Art-Net**. Não existe isolamento de processo, worker, timeout, watchdog ou medição de tempo de execução em nenhum ponto do pipeline atual.

Descobertas centrais, todas confirmadas em código:

- **O hot reload de hoje só existe para scripts de F-key ativos.** Page-scripts e passos de macro **não são recarregados automaticamente** quando o arquivo `.js` correspondente é editado (`electron/main.js:1282-1323` só itera `scriptMeta`).
- **O watcher (`fs.watch`, recursivo) não distingui criar/editar/renomear/mover** — tudo passa pelo mesmo callback e a classificação é feita 150 ms depois, checando apenas se o caminho existe (`electron/main.js:1325-1343`, `electron/main.js:1282-1323`). Isso cria uma janela real de perda de associação em rename/move e em salvamentos lentos.
- **Falhas de compilação, de `OnStart` e de `OnExecute` nunca chegam ao operador.** `OnStart` engole exceção silenciosamente (`electron/main.js:1202-1204, 1412; electron/main.js:1110`); falha de compilação retorna `{ok:false,error}` mas **três das quatro telas/fluxos descartam esse retorno sem log nem UI** (`src/screens/Main.jsx:907-915`, `src/screens/PainelOperacao.jsx:762-776`); falha de `OnExecute` só aparece no `console.error` do processo main — invisível numa build empacotada (`electron/engine/compositor.js:228-235`).
- **Não existe nenhuma medição de tempo de frame ou de script.** Busca em todo `electron/` por `performance.now`, `hrtime`, `console.time`, watchdog: zero ocorrências.
- **Um `while(true)` num `OnExecute` bloqueia deterministicamente o processo main inteiro** — engine, compositor, Art-Net, IPC e o próprio watcher de scripts — porque tudo roda no mesmo `setInterval` de 40 ms do mesmo event loop single-thread do Node (`electron/engine/engine.js:34-60`). Medir a duração depois da chamada (`try { fn() } catch`) não interrompe esse laço; a exceção só existiria se o próprio script lançasse.
- **`loadScriptMeta()` não limpa `scriptMeta` antes de repovoar** (`electron/main.js:697-714`), diferente de `loadPageScriptMeta()` que limpa (`electron/main.js:635-638`). Isso é um risco real (não teórico) de "associações fantasma" entre F-keys ao trocar de show.
- **Scene-lock, offsets, calibração física e freeze são inteiramente ortogonais ao ciclo de vida de scripts** — não são recalculados nem afetados por stop/start/hot reload. Isso é uma boa notícia: qualquer evolução de hot reload não precisa se preocupar em preservá-los, pois já são preservados por design atual.
- **Não existe nenhum uso de `worker_threads` em todo o repositório.** `child_process` existe, mas só para abrir o editor de código (`electron/main.js:14, 123-149`) — nunca para executar scripts DMX.

O sistema é adequado ao objetivo original de execução síncrona simples, mas **não tem nenhuma das salvaguardas necessárias** para o cenário do evento: reload seguro, erro visível, medição de frame. As seções 6 a 9 detalham a arquitetura recomendada para a evolução imediata (sem quebrar o modelo síncrono atual) e as seções 11-12 comparam as opções de isolamento real para uma evolução posterior.

---

## 2. Fluxo atual de descoberta e execução

### 2.1 Diretório e descoberta física

- `SCRIPTS_DIR = path.join(__dirname, '..', 'scripts')`, criado se não existir: `electron/main.js:61-63`.
- Handler IPC `script:list` enumera recursivamente com `fs.readdirSync(dir, {withFileTypes:true})`, ignora apenas a subpasta `backlog`, aceita qualquer `.js`: `electron/main.js:1224-1251` (função `collectScripts`, linhas 1230-1245).
- Essa listagem **não associa arquivo a F-key** — apenas devolve `{name, file, color}` para a UI. A associação real fica em três mapas separados no main, cada um com sua própria lógica de descoberta:
  - **F-key scripts** (`scriptMeta`): reconstruído a partir de `show.json.scripts` em `loadScriptMeta()`, tentando primeiro `meta.file` absoluto e caindo para `<SCRIPTS_DIR>/<meta.name>.js` (`electron/main.js:697-714`).
  - **Page-scripts** (`pageScriptMeta`): reconstruído a partir de `show.json.page_scripts` em `loadPageScriptMeta()`, **sempre** via `<SCRIPTS_DIR>/<meta.name>.js` (não tenta caminho absoluto persistido) e **limpa o mapa antes de repovoar** (`electron/main.js:635-651`).
  - **Macros**: cada passo grava `file = path.join(SCRIPTS_DIR, `${s.script}.js`)` e registra uma *factory* (`makeLayer`); a leitura real do arquivo só acontece quando o passo entra em execução (`electron/main.js:1458-1464`, `electron/engine/compositor.js:346-368`).
- Existe um utilitário externo `tools/sync-scripts.js`, não recursivo, não integrado ao processo main — roda apenas manualmente e não participa do runtime.

### 2.2 Leitura e combinação com `mov-preset.js`

- Leitura: `fs.readFileSync(filePath, 'utf-8')` — síncrona, sem cache — em `readScriptCode` (`electron/main.js:1078-1086`).
- Scripts cujo nome (basename) começa com `mov-` e não é `mov-preset.js` recebem o conteúdo de `mov-preset.js` **concatenado como string, antes** do próprio código, separado por duas quebras de linha (`electron/main.js:1069-1084`):
  ```js
  code = fs.readFileSync(MOV_PADRAO_PRESET, 'utf-8') + '\n\n' + code;
  ```
- Não há `require()`, AST transform, namespacing ou marcador de origem. Preset e script alvo compartilham o mesmo escopo de função — identificadores do preset ficam visíveis ao script e vice-versa; colisões de `const`/`let` quebram a compilação inteira sem indicar qual dos dois arquivos é o culpado (o erro reporta apenas a linha do código concatenado).
- Se `mov-preset.js` não existir, o script é compilado sozinho, sem aviso (`electron/main.js:1080-1084`) — uma falha de deployment (preset ausente) só aparece depois, como erro de `ReferenceError` dentro do script.
- `fire-base.js`, citado no CLAUDE.md como "biblioteca de helpers atualmente inerte", **de fato não tem nenhum ramo de injeção em `readScriptCode`** — confirma que está inerte também do ponto de vista de runtime, não só de intenção.

### 2.3 Compilação e execução

- Mecanismo: `new Function('SetChannel', 'getChannel', 'adapter', 'ctx', código_concatenado)` (`electron/main.js:1088-1098`). Não há `vm.Script`, não há `eval()`, não há `require()` dinâmico do script.
- Depois de injetar o código-fonte, o wrapper copia para `ctx` os identificadores `OnStart`, `OnExecute`, `OnTerminate` se existirem como função no escopo, senão `null` (`electron/main.js:1093-1095`).
- `buildScriptSandbox` (nome enganoso — não há isolamento de segurança real, apenas argumentos controlados) constrói `SetChannel`/`getChannel`/`adapter` fechados sobre `buffer`, `touched`, `controlledMask` da camada (`electron/main.js:1052-1067`). `SetChannel` já aplica scene-lock e clamp 0-255 (`electron/main.js:1053-1060`).
- `ctx` é criado **uma vez por compilação**, dentro de `compileScriptContext` (`electron/main.js:1088-1099`), chamado por `startScript` (F-key, `electron/main.js:1183-1211`), pelo handler `page_script:toggle` (`electron/main.js:1393-1419`) e por `compileLayer` (macros, `electron/main.js:1104-1112`).
- `buffer`, `touched` e `controlledMask` são três `Uint8Array(512)` **por camada**, pré-alocados uma vez na criação da camada e reutilizados (`.fill(0)`) a cada frame (`electron/engine/compositor.js:225-227`) — não há alocação por frame, boa prática já presente.
- Execução:
  - `OnStart()` roda **imediatamente**, uma única vez, no momento da criação da camada, envolto em `try{}catch(e){}` que **descarta silenciosamente qualquer exceção** (`electron/main.js:1110, 1202-1204, 1412`).
  - `OnExecute()` roda **a cada frame** (25 fps / 40 ms), dentro de `compositor.renderFrame()`, que por sua vez é chamado dentro do `setInterval` do engine (`electron/engine/engine.js:40-43`, `electron/engine/compositor.js:223-237`).
  - `OnTerminate()` roda ao remover a camada (stop manual, hot reload, erro, fim de fade-out, blackout), envolto em `try{}catch(e){}` que também descarta a exceção (`electron/engine/compositor.js:189-193`).
- Nada disso roda em worker, `vm` isolado ou processo separado — tudo executa in-process, no mesmo thread que atende IPC, watcher e o próprio loop de frame.

---

## 3. Fluxo atual do watcher

### 3.1 Mecanismo

Único watcher no runtime: `fs.watch(SCRIPTS_DIR, { recursive: true }, callback)` — `electron/main.js:1325-1343`. Confirmado: **não há `chokidar`** nem qualquer outra dependência de watching em `package.json` (linhas 18-29) nem no código-fonte.

```js
scriptsWatcher = fs.watch(SCRIPTS_DIR, { recursive: true }, (_eventType, filename) => {
  if (!filename) return;
  const key = String(filename);
  clearTimeout(scriptWatchTimers[key]);
  scriptWatchTimers[key] = setTimeout(() => {
    delete scriptWatchTimers[key];
    try { handleScriptFileEvent(key); }
    catch (e) { console.error('[scripts:watch] erro ao processar', key, e.message); }
  }, 150);
});
```
`electron/main.js:1328-1338`.

Pontos estruturais:

- `_eventType` (que distinguiria `'change'` de `'rename'`) **é recebido e imediatamente descartado** — toda a lógica depende de checar `fs.existsSync()` 150 ms depois (`electron/main.js:1285-1286`).
- Debounce de 150 ms **por chave de filename**, via `setTimeout`/`clearTimeout` indexado num objeto plano `scriptWatchTimers` (`electron/main.js:1280, 1331-1337`). Não é uma fila — é um mapa de timers independentes.
- Erros de inicialização do watcher só vão para `console.error`; não há fallback (nenhum polling, nenhum watcher por subdiretório) (`electron/main.js:1340-1342`).
- O watcher é iniciado **depois** do engine (`electron/main.js:1599-1602`) e **nunca é fechado** — não há `scriptsWatcher.close()` em lugar nenhum do repositório; ao encerrar o app, apenas o engine é parado (`electron/main.js:1605-1608`).
- Não há tratamento específico por plataforma. O mesmo `fs.watch({recursive:true})` roda em Windows e Linux; a opção `recursive` historicamente tem suporte e comportamento nativo diferentes entre essas plataformas, e o código não detecta nem compensa isso — apenas captura erro síncrono de inicialização (`electron/main.js:1340-1342`). Como o time de produção está em Windows (evidenciado por `process.platform === 'win32'` sendo o ramo de branding ativo, `electron/main.js:46-52`), esse risco é menor no evento específico, mas é uma dívida arquitetural relevante para qualquer deploy Linux futuro.

### 3.2 Classificação por tipo de evento (feita 150 ms depois, não no momento do evento)

```js
function handleScriptFileEvent(filename) {
  if (!filename || !filename.endsWith('.js')) return;
  const file = path.join(SCRIPTS_DIR, filename);
  const exists = fs.existsSync(file);
  if (!exists) { /* remoção */ }
  else if (filename === 'mov-preset.js') { /* reload em cascata dos mov-* ativos */ }
  else { /* reload do F-key ativo cujo basename bate */ }
  emitScriptsChanged();
}
```
`electron/main.js:1282-1323`.

- Filtro de extensão é **case-sensitive** e feito **dentro** do handler, não no callback do `fs.watch` — logo todo evento (inclusive de arquivos temporários) ainda passa pelo debounce de 150 ms antes de ser descartado (`electron/main.js:1328-1337` cria o timer sempre; `electron/main.js:1283` descarta depois).
- `exists === false` 150 ms depois do evento é o **único** sinal de remoção. Não há diferenciação entre "arquivo apagado", "arquivo temporariamente ausente durante um save atômico lento" ou "arquivo renomeado".

---

## 4. Comportamento por tipo de alteração

| Alteração | Comportamento real hoje | Evidência |
|---|---|---|
| Editar F-key script ativo | Localizado por `path.basename(meta.file) === filename` em `scriptMeta`; `stopRunningScript` → `startScript` síncronos. Se a nova versão falhar, **fica parado, sem rollback**. | `electron/main.js:1311-1317`, `1183-1211` |
| Editar F-key script inativo (associado mas parado) | Nada acontece além de `emitScriptsChanged()`. Não compila, não valida. | `electron/main.js:1319-1322` |
| Editar `mov-preset.js` | Reinicia **todos** os `mov-*` ativos cujo `scriptPrependsMovPreset()` é true. O próprio `mov-preset.js`, se rodando standalone, **não** é reiniciado por esse ramo (a função o exclui de si mesma). | `electron/main.js:1303-1310`, `1071-1076` |
| Criar script novo | Só emite `scripts:changed`; **nenhuma associação automática** a F-key/page/macro. | `electron/main.js:1319-1322` |
| Remover script (arquivo apagado do disco) | Para o F-key ativo correspondente, **apaga a entrada de `scriptMeta`** e persiste o show (`saveScriptMeta()`). Comparação por igualdade estrita de string `meta.file === file` — sensível a diferenças de representação de caminho. | `electron/main.js:1288-1300` |
| Renomear/mover script | Sem handler dedicado. Depende de o SO reportar dois eventos (nome antigo + novo). Nome antigo → tratado como remoção (associação apagada). Nome novo → tratado como criação (**sem reassociação automática**). Resultado: **o botão perde o script**. | `electron/main.js:1288-1300` + `1319-1322` |
| Alterar biblioteca base (`mov-preset.js`) enquanto script alvo está em subpasta | `scriptPrependsMovPreset` usa `path.basename`, então funciona mesmo em subpasta — mas o reload do próprio arquivo em subpasta (ramo genérico) **falha** por comparar `path.basename(meta.file)` com `filename` que pode conter separador de subpasta (ex.: `casamento\efeito.js` vs. `efeito.js`). | `electron/main.js:1284-1285` vs. `1313` |
| Múltiplas alterações rápidas (< 150 ms) | Colapsadas pelo debounce por chave de filename — apenas um reload. | `electron/main.js:1331-1337` |
| Múltiplas alterações rápidas (> 150 ms entre si) | Cada uma dispara um ciclo completo `OnTerminate` → `OnStart` independente — nenhuma coalescência. | `electron/main.js:1311-1317`, `1183-1211` |
| Editor salva por temp+rename (ex.: VSCode) | Cenário comum funciona **na maioria dos casos** porque o debounce de 150 ms tende a esperar a troca terminar antes de checar `exists`. **Não há garantia**: se a janela entre apagar o destino e recriar for maior que 150 ms, a associação é apagada permanentemente e a recriação não a restaura (ver §5). | `electron/main.js:1331-1337`, `1285-1300`, `1319-1322` |
| Script temporariamente inválido (editor ainda escrevendo) | Sem verificação de tamanho estável / checksum / retry. Se `handleScriptFileEvent` disparar no meio de uma escrita não atômica, o `readFileSync` pode capturar conteúdo parcial → erro de sintaxe → script para sem rollback. | `electron/main.js:1078-1085`, `1197-1201` |

---

## 5. Falhas e riscos encontrados

Consolidação priorizada (mais crítico primeiro para o cenário do evento):

1. **`while(true)` ou script pesado trava o processo main inteiro, não só a camada.** Como tudo roda no mesmo `setInterval` de 40 ms (`electron/engine/engine.js:40-58`) no mesmo thread que atende IPC e o watcher, um laço infinito em `OnExecute` interrompe: envio Art-Net, atualização do viewer 3D, resposta a toggle de outros F-keys, blackout, freeze, e o próprio `handleScriptFileEvent` do watcher. Não existe timeout, `setImmediate` de escape, nem qualquer split de trabalho. **Confirmado por leitura direta — não há absolutamente nenhum mecanismo de interrupção no código.**

2. **Erros nunca chegam ao operador — em nenhum dos quatro pontos de falha:**
   - `OnStart`: exceção descartada em `try{}catch(e){}` sem log nem retorno (`electron/main.js:1110, 1202-1204, 1412`).
   - Compilação (F-key manual): retorna `{ok:false, error}`, mas o retorno de `startScript()` **é ignorado pelo próprio watcher** durante hot reload (`electron/main.js:1314-1315` não usa o valor de retorno de `startScript(fkey)`).
   - Compilação (toggle manual, `Main.jsx`): mensagem só vai para `console.warn` do renderer (`src/screens/Main.jsx:868-870`) — invisível numa build empacotada sem DevTools abertos.
   - Compilação (page-script): retorno com `error` é **descartado silenciosamente** por `Main.jsx` (`src/screens/Main.jsx:907-915`, sem `else`/log) e pelo Painel de Operação, que além disso tem um bug de comparação (`result?.ok != null` é `true` mesmo quando `ok:false`, gravando `running: undefined`) (`src/screens/PainelOperacao.jsx:762-776`).
   - `OnExecute`: mensagem só em `console.error` do processo main (`electron/engine/compositor.js:228-235`); o callback `onError` de F-key e de page-script descartam o objeto de exceção antes de notificar a UI (`electron/main.js:1206-1209`, `1413-1416`).
   - **Resultado prático:** o único sinal visível ao operador é o botão "apagar" (deixar de aparecer como `running`), e isso é **indistinguível** de parada manual, blackout, ou stop por hot reload malsucedido.

3. **Hot reload cobre apenas F-key scripts ativos.** Page-scripts e passos de macro não são recarregados pelo watcher em nenhuma circunstância (`electron/main.js:1282-1323` só itera `scriptMeta`). Um operador editando um script usado por uma macro ou por uma cena (page-script) durante o evento **precisa reiniciar manualmente** essa macro/cena — o watcher não avisa nem ajuda.

4. **Falha de compilação em hot reload não tem rollback.** `startScript(fkey)` é chamado depois de `stopRunningScript` já ter removido a camada antiga; se a nova versão falhar ao compilar, **o script fica parado** — não há "manter a última versão válida rodando" (`electron/main.js:1314-1315`). Isso é o oposto do requisito do evento.

5. **Rename/move real perde a associação da F-key permanentemente.** Sem handler dedicado de rename, o par de eventos (nome antigo removido / nome novo criado) resulta em: associação antiga apagada e persistida (`saveScriptMeta()`), e o arquivo novo **não** ganha associação automática (`electron/main.js:1288-1322`). Isso é o cenário mais perigoso citado no prompt de auditoria ("salvamento incompleto" pode virar isso se a janela sem arquivo exceder 150 ms).

6. **`loadScriptMeta()` não limpa `scriptMeta` antes de repovoar** (`electron/main.js:697-714`), diferente de `loadPageScriptMeta()` (`635-638`). Trocar de show na mesma sessão pode manter F-keys "fantasma" do show anterior, que **voltam a ser persistidas** no próximo save porque `buildMergedShow()` serializa todo `scriptMeta` atual sem filtrar pelo show carregado (`electron/main.js:585-592`). Confirmado como risco real: `loadScriptMeta()` roda no boot, em `show:load` e depois de `show:saveAs` (`electron/main.js:1574-1579`, `462-481`, `535-547`).

7. **Comparação de path por igualdade estrita de string** em remoção (`meta.file === file`, `electron/main.js:1292`) e por basename em reload genérico (`path.basename(meta.file) === filename`, `electron/main.js:1313`) — nenhuma normalização (`path.resolve`, `realpathSync`, lower-case no Windows). Scripts em subpastas recarregam via `mov-preset` (usa basename) mas **não** recarregam via o ramo genérico quando o F-key aponta para uma subpasta, porque `filename` do watcher recursivo inclui o separador de subpasta e `path.basename(meta.file)` não.

8. **Falta de fallback se `fs.watch({recursive:true})` falhar ao iniciar** — captura o erro e só loga no console; a aplicação continua rodando sem hot reload nenhum, sem avisar o operador (`electron/main.js:1340-1342`).

9. **`mov-preset.js` ausente é silencioso.** Se o arquivo não existir, o script `mov-*` é compilado sozinho — qualquer referência a identificador do preset vira `ReferenceError` em runtime, sem indicação de que a causa raiz é um preset faltando (`electron/main.js:1080-1084`).

10. **Nenhuma medição de performance existe.** Busca completa em `electron/` por `performance.now`, `hrtime`, `console.time`, `watchdog`, `frameBudget`, `slowFrame`: zero resultados. Não há nenhum ponto de instrumentação para se apoiar — a evolução imediata (seção 8) parte do zero.

---

## 6. Hot reload atual versus hot reload necessário

| Requisito do evento | Hoje | Gap |
|---|---|---|
| Não reiniciar o VP-LIGHT | ✅ Watcher já faz hot reload sem restart do app | — |
| Não reiniciar a engine DMX | ✅ Engine roda contínua; só a camada é trocada | — |
| Não interromper scripts não relacionados | ✅ Reload é por F-key/basename — outros F-keys não são tocados. ⚠️ Exceção: editar `mov-preset.js` reinicia **todos** os `mov-*` ativos de uma vez (comportamento em cascata pode ser surpreendente se o operador só queria testar um efeito) | Parcial — cascata do preset precisa ser comunicada/visível |
| Não perder o estado atual do palco | ✅ Scene-lock, offsets, calibração, freeze são ortogonais ao reload (confirmado em código, seção 2 e riscos) | — |
| Não deixar canais presos | ⚠️ `_flushLayerToUniverse` no stop escreve o último buffer conhecido da camada antiga nos canais tocados não controlados por outra camada — não é "preso", mas gera até 1 frame (~40 ms) com o valor antigo até o `OnExecute` da nova camada rodar no próximo tick | Aceitável, mas não documentado nem medido |
| Não provocar blackout/frame zerado | ✅ Confirmado: como stop+start do watcher rodam de forma **síncrona, no mesmo tick de JS** (dentro do callback do `setTimeout` do debounce), é estrutural e garantidamente impossível que `compositor.renderFrame()` execute *entre* o `stopLayer` e o `addLayer` — o single-thread do Node garante run-to-completion. Não há frame zerado por corrida. | — |
| Estado visual = runtime | ❌ Erros de reload não aparecem na UI (seção 5, item 2) | Gap crítico |
| Não quebrar macros/outros consumidores do arquivo | ❌ Macros e page-scripts **não são recarregados** — continuam rodando a versão antiga em memória até serem reiniciados manualmente | Gap crítico |
| Não depender só do console para erros | ❌ Todos os 4 pontos de falha vão só para console (seção 5, item 2) | Gap crítico |
| Rollback para última versão válida em falha | ❌ Não existe — hoje "falhar" = "ficar parado" | Gap crítico |

**Conclusão da seção:** a mecânica de baixo nível (buffers isolados por camada, single-thread garantindo atomicidade de troca) já é uma boa base. O que falta é inteiramente na **camada de decisão e de feedback**: validar antes de substituir, decidir se substitui, e avisar o operador do resultado.

---

## 7. Arquitetura transacional recomendada (evolução imediata — não implementar agora)

Fluxo proposto, mapeado sobre as funções que já existem hoje:

```
1. fs.watch dispara evento (existente: electron/main.js:1328)
2. Debounce por chave "canônica" (path.resolve + lowercase no Windows), não pelo filename cru
   → resolve o bug de basename/subpasta (achado 7) e de rename (achado 5)
3. Reconciliação: comparar snapshot anterior do diretório com o atual
   (novo: precisa de um Set{caminho→mtime/hash} mantido pelo watcher,
   hoje inexistente — cada evento é tratado isoladamente sem memória do estado anterior)
4. Ler a nova versão (reusa readScriptCode, main.js:1078-1086)
5. Compilar em contexto TEMPORÁRIO, com buffer/touched/controlledMask PRÓPRIOS,
   SEM remover a camada ativa (muda compileScriptContext para não depender
   de startScript já ter chamado stopRunningScript primeiro — hoje a ordem é
   stop-then-start, main.js:1311-1317; precisa virar compile-then-swap)
6. Validar estrutura: JS parseável (a própria new Function já falha aqui),
   e verificar que ao menos um hook (OnStart/OnExecute/OnTerminate) existe
   como função — hoje não há checagem alguma disso, um arquivo vazio
   compila e "roda" sem fazer nada, silenciosamente
7. Executar OnStart da nova camada de forma controlada — CAPTURAR a exceção
   (hoje já é try/catch, main.js:1202-1204) mas em vez de descartar,
   retornar o erro para a camada de decisão
8. Só depois do sucesso de OnStart: substituir a camada antiga pela nova
   em um único tick síncrono (stopLayer(old) + addLayer(new) sem await
   entre os dois — replica a garantia de atomicidade já existente hoje,
   seção 6, linha "blackout/frame zerado")
9. Em falha (sintaxe, OnStart lança, hooks ausentes): NÃO tocar na camada
   ativa. Ela continua rodando exatamente como estava.
10. Emitir para o renderer um evento novo, ex. "scripts:reload-result"
    { fkey|page|macro, ok, error, timestamp } — hoje só existe
    "scripts:changed" (main.js:1262-1266) que não carrega mensagem de erro
11. Nunca criar frame intermediário zerado — já garantido pelo single-thread
    (seção 6), só precisa ser preservado ao mover de stop-then-start para
    compile-then-swap
12. Nunca interromper scripts não relacionados — já garantido hoje pela
    indexação por fkey/id de camada; deve se estender a page-scripts e
    macros quando o reload passar a cobri-los também
```

### Casos a tratar separadamente na implementação futura

- **Edição de script ativo (F-key):** fluxo completo acima.
- **Edição de script inativo:** apenas validar e cachear resultado (compilar em background), sem tocar em camada nenhuma — hoje nem isso acontece (achado, seção 4).
- **Criação de script:** apenas notificar a lista (`script:list`); continua sem associação automática — correto manter assim, é decisão do operador escolher F-key.
- **Remoção de script ativo:** manter a camada rodando com a última versão válida em memória (hoje ela é morta imediatamente, `electron/main.js:1288-1300`) — decisão de produto a confirmar com o Dan: "arquivo sumiu" pode ser acidente de editor, não intenção de parar o efeito ao vivo.
- **Remoção de script inativo:** comportamento atual (apagar associação) está OK.
- **Rename/move:** precisa de correlação por conteúdo/hash entre o evento de "sumiço" e o evento de "aparecimento" na mesma janela de debounce, para preservar a associação — hoje isso simplesmente não existe.
- **Alteração de biblioteca base (`mov-preset.js`):** manter o comportamento em cascata, mas cada reload individual deve seguir o fluxo transacional (um `mov-*` com erro não deve derrubar os outros nem ficar sem rollback) — hoje `startScript(fkey)` é chamado sem checar sucesso, em loop, para cada `mov-*` ativo (`electron/main.js:1305-1310`).
- **Várias alterações em sequência rápida:** o debounce por chave canônica (item 2 acima) já resolve a maior parte; adicionar um "generation counter" por script para descartar reloads obsoletos que terminem de compilar fora de ordem (ex.: script A dispara reload lento, script A muda de novo antes do primeiro terminar).
- **Salvamento incompleto / script temporariamente inválido:** a validação da etapa 6 (parse + hooks) filtra a maioria dos casos de escrita parcial, porque `new Function` falha em JS incompleto. Ainda assim, adicionar uma checagem de "tamanho estável" (comparar `fs.statSync().size` duas vezes com pequeno intervalo) reduziria a chance de ler no meio de uma gravação não atômica.

---

## 8. Medição de performance recomendada

Pontos de instrumentação propostos, todos sobre código hoje sem nenhuma medição (confirmado, seção 5, item 10):

- **Duração de cada `OnExecute`:** envolver a chamada em `electron/engine/compositor.js:230-231` com `performance.now()` antes/depois. Custo de medir é desprezível (chamada nativa, sem alocação) e **não interfere na semântica atual do try/catch**.
- **Duração total do compositor por frame:** medir em torno de `compositor.renderFrame()` dentro de `electron/engine/engine.js:43`.
- **Duração total do frame (compositor + Art-Net + listeners):** medir do início ao fim do callback do `setInterval` em `electron/engine/engine.js:40-57`.
- **Contadores de frames acima do orçamento:** orçamento de referência = 40 ms (FPS=25, `electron/engine/engine.js:18-19`). Sugestão de limiares:
  - **< 30 ms:** dentro do orçamento com margem.
  - **30-40 ms:** no limite — logar em taxa reduzida (ex.: 1 a cada 25 ocorrências).
  - **40-45 ms:** frame estourado uma vez — provavelmente tolerável visualmente (jitter imperceptível em iluminação).
  - **> 45 ms e principalmente > 100 ms:** degradação perceptível — priorizar alerta ao operador.
- **Média, máximo e percentis:** manter um buffer circular curto (ex.: últimas 150-300 amostras = 6-12s a 25fps) em memória, sem persistir em disco, para expor via IPC sob demanda (não empurrar a cada frame — isso criaria overhead de IPC constante).
- **Identificação do script responsável:** como cada camada já tem `_id` (`electron/engine/compositor.js:94`), a medição de `OnExecute` por camada já nasce com o identificador certo — não precisa de infraestrutura nova, só armazenar `{id, duration}` por frame.
- **Rate limit dos avisos:** essencial — o prompt do Dan já observa "logs limitados e úteis, sem inundação". Um script consistentemente lento não deve gerar um log por frame (25/s). Sugestão: alerta imediato na primeira ocorrência, depois no máximo 1 aviso a cada 2-5 segundos por script, com contagem agregada ("script X excedeu o orçamento 47 vezes nos últimos 5s").
- **Aviso visual ao operador:** reaproveitar o canal de eventos IPC já existente (`scripts:changed`/preload `onScriptsChanged`, `electron/preload.js:114-120`) estendendo o payload, ou criar um evento dedicado `engine:frame-warning` — não existe hoje nenhum canal para isso.

### Diferenciação exigida pelo prompt

- **Script lento que retorna:** captável pela medição de duração de `OnExecute` (acima) — o `try/catch` já existente em `electron/engine/compositor.js:230-235` não precisa mudar, só ganhar medição em volta.
- **Frame lento acumulado por várias camadas:** captável pela medição do frame total — nenhuma camada individual pode estar "lenta" isoladamente, mas a soma ultrapassa 40 ms. Isso só aparece medindo o frame inteiro, não script a script.
- **Exceção:** já tratado pelo `try/catch` existente (`electron/engine/compositor.js:232-235`) — a camada é removida e `onError` dispara. O que falta é propagar a mensagem real ao operador (seção 9).
- **Bloqueio infinito (`while(true)`):** **não é detectável por medição pós-chamada.** Ver seção 10 — este é o limite estrutural do modelo síncrono atual.
- **Atraso causado por logging, UI, IPC ou Art-Net:** medir o frame **total** (não só `renderFrame()`) separa esse caso — se `renderFrame()` for rápido mas o frame total for lento, o atraso está no envio Art-Net ou nos `frameListeners` (viewer 3D), não nos scripts. `electron/engine/engine.js:44-55` já isola essas etapas o suficiente para instrumentar cada uma separadamente.

**Ponto explícito exigido pelo prompt:** medir a duração de uma chamada síncrona (`const t0 = performance.now(); fn(); const dt = performance.now() - t0;`) **não interrompe** a execução de `fn()`. Se `fn()` contém `while(true){}`, o `performance.now()` de início roda, a chamada `fn()` nunca retorna, e o `performance.now()` de fim **nunca é alcançado** — o processo trava exatamente como trava hoje sem medição nenhuma. Medição pós-chamada é diagnóstico, não é proteção.

---

## 9. Tratamento de erros recomendado

Objetivo: garantir "erros visíveis para o operador" e "proteção contra exceções" sem alterar o modelo síncrono ainda.

- **Parar de descartar exceções de `OnStart`.** Hoje: `try { ctx.OnStart(); } catch (e) {}` em três lugares (`electron/main.js:1110, 1202-1204, 1412`). Proposta: capturar `e.message` e devolver via o mesmo canal de retorno que já existe para erro de compilação (`{ok:false, error}`), sem lançar — preservando a garantia de que uma falha de `OnStart` não derruba o processo.
- **Não ignorar o retorno de `startScript()` no watcher.** Hoje `electron/main.js:1314-1315` chama `startScript(fkey)` e descarta o resultado. Proposta: usar o retorno para decidir se emite erro (parte central da arquitetura transacional da seção 7).
- **Corrigir os três pontos do renderer que descartam erro silenciosamente:**
  - `src/screens/Main.jsx:907-915` (page-script toggle) — falta um `else` que trate `result.error`.
  - `src/screens/PainelOperacao.jsx:762-776` — corrigir a checagem `result?.ok != null` (verdadeira mesmo com `ok:false`) para `result?.ok === true` antes de atualizar `running`, e tratar o `else` com o erro.
  - `src/screens/Main.jsx:868-870` — hoje só `console.warn`; precisa de um canal visual (o componente já tem um sistema de toast usado para save, `src/screens/Main.jsx:317-350, 3293-3304` — é natural reaproveitar o mesmo `setToast` para erros de script).
- **Diferenciar visualmente "parado por erro" de "parado normalmente".** Hoje ambos os estados colapsam em `running:false` (`electron/main.js:1253-1259`, renderizado só pela borda em `src/screens/Main.jsx:2558-2583`). Proposta: acrescentar um terceiro estado (`error: true/false` ou `status: 'ok'|'stopped'|'error'`) no payload de `buildAllScripts()` e no evento `scripts:changed`, e um estilo visual distinto (ex.: borda vermelha) nos dois componentes de tela.
- **Rate limit de logs no console do processo main** também é necessário mesmo antes de qualquer UI nova — hoje um script cuja `OnExecute` falha em todo frame por algum motivo transitório causaria (uma vez removida a camada, isso já não se repete — mas vale confirmar que não há re-tentativa automática que reintroduza a camada em loop de falha).
- **Mensagem de erro deve incluir o `_id` da camada** (`electron/engine/compositor.js:94`) para que o operador saiba exatamente qual F-key/page/macro falhou, não apenas "um script falhou".

---

## 10. Limitações inevitáveis do mesmo thread

Isso não é uma lacuna de implementação — é uma restrição estrutural do modelo atual, e deve ser comunicada ao Dan sem meias-palavras antes do evento:

- **O processo main do Electron é single-thread** (Node.js clássico). O `setInterval` do engine (`electron/engine/engine.js:40-58`), o watcher de scripts (`electron/main.js:1328-1338`), todos os handlers IPC (`ipcMain.handle(...)`, dezenas ao longo de `main.js`) e a compilação/execução de scripts (`new Function`, seção 2.3) competem pelo **mesmo** event loop.
- Um `OnExecute` com `while(true){}` (ou qualquer laço sem `await`/yield) **bloqueia esse thread indefinidamente**. Enquanto bloqueado:
  - Nenhum outro `OnExecute` de nenhuma outra camada roda.
  - Nenhum pacote Art-Net é enviado (o palco fica congelado no último frame enviado antes do travamento — não um "blackout", mas um "freeze" não intencional).
  - Nenhum IPC do renderer é respondido — os botões da interface (toggle, blackout, freeze) **param de funcionar**, porque o handler correspondente também está na fila do mesmo event loop.
  - O watcher de scripts não processa novos eventos — mesmo que o operador corrija o script culpado, o hot reload não roda até o laço travado ser resolvido.
  - Em resumo: um único script mal escrito pode travar o show inteiro, não apenas o próprio efeito.
- **Nenhuma medição pós-chamada resolve isso** (demonstrado tecnicamente na seção 8, último parágrafo). Um watchdog que rode "no mesmo thread" (ex.: um segundo `setInterval` que checa se o frame anterior demorou muito) também não ajuda a *interromper* o laço travado — ele só consegue **detectar depois do fato**, e mesmo essa detecção não roda, porque o próprio `setInterval` do watchdog está no mesmo event loop bloqueado.
- A única forma de **interromper de fato** um `while(true)` é rodá-lo em um contexto que possa ser **terminado de fora** — outro thread (`worker_threads`, que pode ser encerrado com `worker.terminate()`) ou outro processo (`child_process`, que pode receber `SIGKILL`). Isso é detalhado na seção 11 e é, por definição, fora do escopo desta evolução imediata.
- **Conclusão prática para o evento:** a evolução imediata (seções 7-9) reduz drasticamente a frequência e o impacto de problemas comuns (erro de sintaxe, exceção, script lento que retorna, reload malsucedido), mas **não protege contra um script com loop infinito**. Esse risco residual precisa ser mitigado operacionalmente até a evolução posterior existir: revisão visual do código antes de ativar em cena, e evitar laços `while`/`for` sem condição de saída clara nos scripts novos criados durante o evento.

---

## 11. Comparação das opções de isolamento

| Critério | A. `worker_threads` | B. `child_process` (1 processo p/ engine de scripts) | C. Processo dedicado p/ toda engine | D. 1 worker por script | E. Runtime instrumentado / transform de código | F. Manter síncrono atual |
|---|---|---|---|---|---|---|
| **Interrompe loop infinito de verdade?** | Sim — `worker.terminate()` mata a thread mesmo em laço travado | Sim — `process.kill()`/SIGKILL | Sim, mas mata a engine inteira (todas as camadas) | Sim, e de forma isolada por script | Parcial — só se o transform inserir checkpoints de yield (`while(true){ if(deadline) throw }`); um `while(true){}` sem nenhuma chamada instrumentada dentro continua intransponível | Não — demonstrado na seção 10 |
| **Custo por frame (40ms de orçamento)** | Baixo-médio: `postMessage`/`SharedArrayBuffer` tem overhead de alguns µs-ms por chamada, mas é in-process (mesma máquina, sem IPC de SO) | Médio-alto: serialização via stdio/IPC de processo, mais lento que worker_threads | Médio-alto: idem, mas só uma vez por frame (todas as camadas de uma vez), não por script | Alto: overhead de postMessage multiplicado pelo número de scripts ativos simultâneos | Baixo: roda no mesmo processo, sem serialização — mas custo de instrumentar cada iteração de laço | Nenhum overhead adicional (já é o caso hoje) |
| **Custo de serializar 512 canais** | Baixo com `SharedArrayBuffer` (zero-copy) ou baixo com `Uint8Array` transferível (`transferList`) | Alto se via JSON; baixo-médio se usar pipe binário bruto — exige código de framing customizado | Igual a B, mas uma vez por frame agregando todas as camadas | Igual a A, multiplicado pelo número de scripts | Nenhum — mesmo processo | Nenhum (já é o caso hoje) |
| **Compatível com `OnStart`/`OnExecute`/`OnTerminate`** | Sim, com wrapper que reencaminha as chamadas via mensagens | Sim, mesmo princípio | Sim | Sim | Sim, hooks preservados; só a implementação interna do laço precisa mudar | Sim (já é o caso) |
| **Compatível com `ctx`** | Precisa recriar/serializar — objetos de função (`ctx.OnStart` etc.) não atravessam a fronteira de worker diretamente; precisa de um protocolo de RPC dentro do worker | Mesmo problema, agravado (processo separado, sem acesso a memória compartilhada de objetos JS) | Mesmo problema | Mesmo problema | Nenhuma mudança — `ctx` continua sendo objeto JS normal no mesmo processo | Sem mudança (já funciona) |
| **Compatível com `adapter`/`getChannel`** | Precisa expor via RPC dentro do worker (funções não são transferíveis, só dados) — o worker chamaria `SetChannel`/`getChannel` localmente sobre um buffer compartilhado, e o adapter (que depende de `getShowFixture`, `isFixtureEnabled`, etc. do main) precisaria ser replicado ou consultado via mensagem | Mesmo problema, agravado por não haver memória compartilhada nativa | Mesmo problema | Mesmo problema, x N processos | Sem mudança | Sem mudança |
| **Compatível com macros** | Sim, mas o sequenciador (`compositor.js`, `_advanceMacro`, `_enterStep`) precisaria orquestrar múltiplos workers coordenados por frame — complexidade de sincronização não trivial | Similar, com latência de IPC de processo adicional a cada troca de passo | Sim, mais simples de coordenar porque é um único processo de destino | Complexo — cada passo de macro trocaria de worker | Sim, sem mudança estrutural no sequenciador | Sim (já funciona) |
| **Latência** | Baixa (mesma máquina, sem syscalls de rede/pipe pesados) | Média (IPC de processo tem mais overhead que postMessage) | Média | Média-alta (overhead multiplicado) | Nenhuma adicional | Nenhuma (baseline) |
| **Complexidade de implementação** | Alta — precisa de protocolo de RPC para `ctx`/`adapter`/`SetChannel`, gestão de ciclo de vida de workers, tratamento de crash de worker | Alta, e maior que A por falta de memória compartilhada nativa | Média-alta — mais simples que D/A porque é 1:1 com o modelo atual (uma engine, não uma engine por script) | Muito alta — N workers para gerenciar, sincronizar e recuperar | Média — não muda a arquitetura de processos, mas exige um transformador de AST/bytecode para inserir checkpoints, e mesmo assim não cobre 100% dos casos de loop infinito | Nenhuma (já implementado) |
| **Risco para o evento ao vivo (se migrado às pressas)** | Alto se feito sem tempo de teste — mudança de fronteira de execução é uma reescrita de praticamente todo `main.js` de scripts | Alto, maior que A | Médio-alto — mais contido, mas ainda uma mudança grande de arquitetura | Muito alto — maior complexidade, maior superfície de bugs novos | Médio — mudança mais cirúrgica, mas cobertura parcial pode dar falsa sensação de segurança | Nenhum risco de migração (é não fazer nada) — mas mantém o risco residual da seção 10 |
| **Estratégia de migração sugerida** | Prova de conceito isolada primeiro (1 script simples via worker), medir overhead real de `SetChannel` a 25fps antes de expandir | Não recomendado como primeira escolha — `worker_threads` já resolve o mesmo problema com menos overhead | Viável como evolução de médio prazo depois de validar A em escala menor | Não recomendado — complexidade não compensa o ganho de isolamento por script individual quando a maioria dos crashes é por camada, não por múltiplos scripts simultâneos | Viável como complemento a A/C (ex.: instrumentar loops só nos scripts que rodam dentro do worker, como camada extra de defesa) | É o estado atual — manter apenas com as mitigações da seção 7-9 |

### Notas de leitura da tabela

- **`ctx`, `adapter` e `getChannel` são o maior obstáculo técnico em todas as opções que envolvem outra thread/processo**, porque hoje são **funções JavaScript vivas fechadas sobre estado do main** (`electron/main.js:1052-1067`), não dados serializáveis. Qualquer isolamento real exige reformular esse contrato como um protocolo de mensagens (o script chama `SetChannel(ch, val)` → isso vira uma mensagem para o main → o main aplica no buffer real), o que **muda a latência de escrita de canal de "síncrona e imediata" para "assíncrona por mensagem"**, um impacto arquitetural que se propaga por toda a base de scripts existente (todos os `mov-*`, `brut-*`, etc. em `scripts/`).
- **512 canais por frame é uma carga pequena** (512 bytes) — a preocupação de custo de serialização é mais sobre *frequência* (25×/s por camada) do que sobre *tamanho*. `SharedArrayBuffer` resolve isso de forma quase gratuita para as opções A/D.

---

## 12. Recomendação final para isolamento futuro

**Recomendação: opção A (`worker_threads`), com escopo "um worker para toda a engine de scripts" (equivalente a C, mas usando threads em vez de processos) — não um worker por script (D).**

Justificativa:

- `worker_threads` é a única opção que interrompe loop infinito de verdade (`worker.terminate()`) **com overhead de comunicação significativamente menor** que `child_process`, porque pode compartilhar memória via `SharedArrayBuffer` — essencial para não adicionar latência perceptível a 25fps.
- Consolidar **todos os scripts ativos em um único worker** (em vez de um worker por script) evita a explosão de complexidade de D, mantém a estrutura do compositor (`_layers` como Map único, seção 2) praticamente intacta — o compositor continuaria compondo camadas, só que as camadas seriam preenchidas por mensagens vindas do worker em vez de chamadas de função diretas no mesmo processo.
- Isso preserva compatibilidade estrutural com macros (sequenciamento continua no processo main/compositor, só a execução de `OnExecute` migra) e não exige redesenhar o sequenciador de macro do zero.
- `child_process` (B) resolveria o mesmo problema de isolamento, mas com overhead maior e sem `SharedArrayBuffer` nativo — só se justificaria se um dia for necessário isolar por completo (ex.: sandbox de segurança contra código malicioso, o que não é o caso aqui — os scripts são escritos pelo próprio operador de confiança).
- Runtime instrumentado (E) é interessante como **complemento**, não substituto: mesmo dentro do worker, inserir checkpoints de tempo em loops (`for`/`while`) detectados por transformação de AST adicionaria uma segunda camada de defesa (o script se autolimita antes mesmo de precisar do `terminate()` externo), mas não deve ser a única linha de defesa porque não cobre 100% dos padrões de loop.
- Manter o modelo síncrono (F) permanece **aceitável apenas com as mitigações imediatas das seções 7-9** e com disciplina operacional restrita durante o evento (seção 10) — não é uma recomendação de longo prazo.

**O que não implementar:** um worker por script (D) — a complexidade de orquestração (sincronizar N workers a cada frame de 40ms, sem introduzir jitter por espera de mensagens) supera o benefício, já que a maioria dos incidentes reais é por script individual travando, não por necessidade de isolamento cruzado entre scripts simultâneos.

---

## 13. Plano imediato (antes do evento)

Ordem sugerida por impacto/esforço, tudo dentro do modelo síncrono atual (nenhum item aqui requer isolamento de thread/processo):

1. Corrigir os três pontos do renderer que descartam erros silenciosamente (seção 9) — menor esforço, maior visibilidade imediata para o operador.
2. Parar de descartar exceção de `OnStart` — devolver `{ok:false,error}` como já é feito para falha de compilação.
3. Usar o retorno de `startScript()` no watcher (`electron/main.js:1314-1315`) para decidir se emite erro, em vez de ignorá-lo.
4. Adicionar campo de erro/status ao payload de `scripts:changed` / `buildAllScripts()`, e diferenciação visual mínima (ex.: borda vermelha) nas duas telas.
5. Implementar a arquitetura transacional da seção 7 para F-key scripts (compile-then-swap em vez de stop-then-start), incluindo rollback em falha.
6. Corrigir a comparação de path (basename vs. path relativo com subpasta) no ramo genérico de reload (`electron/main.js:1313`).
7. Instrumentar medição de duração de `OnExecute` e de frame total (seção 8), com rate limit de log.
8. Corrigir `loadScriptMeta()` para limpar `scriptMeta` antes de repovoar, alinhando com `loadPageScriptMeta()`.
9. Estender hot reload para page-scripts (mesmo mecanismo do item 5, reaproveitando `pageScriptMeta`).
10. Avaliar com o Dan a decisão de produto do item "remoção de script ativo" (seção 7) — hoje mata a camada; pode ser desejável manter rodando a última versão válida.

## 14. Plano posterior (sem prazo do evento)

1. Prova de conceito isolada de `worker_threads` executando `OnExecute` de um único script simples, medindo overhead real de `SetChannel` a 25fps via `SharedArrayBuffer`.
2. Desenhar o protocolo de mensagens que substitui as chamadas diretas de `SetChannel`/`getChannel`/`adapter.resolve` por mensagens (ou por leitura/escrita direta em `SharedArrayBuffer` para os casos de alta frequência).
3. Migrar a execução de `OnExecute`/`OnStart`/`OnTerminate` de todos os scripts para dentro de um único worker dedicado à "engine de scripts", mantendo o compositor (merge de camadas, envelopes de macro) no processo main.
4. Avaliar complementarmente runtime instrumentado (transform de AST para checkpoints em loops) como segunda camada de defesa dentro do próprio worker.
5. Extender hot reload transacional (seção 7) para macros, cobrindo o gap identificado na seção 5, item 3.
6. Reavaliar `fs.watch({recursive:true})` para um deploy Linux, dado o comportamento historicamente divergente dessa opção entre plataformas (seção 3.1) — hoje mitigado apenas porque o ambiente de produção é Windows.

## 15. Plano de testes

Todos os testes abaixo podem ser feitos manualmente contra o código atual (sem nenhuma mudança), para documentar o comportamento hoje, e reexecutados depois de cada item do plano imediato para validar a correção:

1. Editar um script F-key ativo válido → confirmar reload sem interrupção de outros F-keys.
2. Editar um script F-key ativo introduzindo erro de sintaxe → hoje: script para e fica parado sem aviso; depois da correção: deve continuar rodando a versão anterior e mostrar erro.
3. Fazer `OnStart` da nova versão lançar exceção → hoje: exceção descartada silenciosamente, camada nova ainda é adicionada (potencialmente com estado inconsistente); depois: deve impedir a troca e preservar a versão anterior.
4. Fazer `OnExecute` lançar exceção → confirmar que a camada é removida (comportamento já correto hoje) e que o erro aparece ao operador (gap a corrigir).
5. Salvar o mesmo arquivo várias vezes em menos de 1 segundo → confirmar debounce de 150ms colapsando em um único reload.
6. Simular salvamento via arquivo temporário + rename (ex.: replicar o padrão do VSCode) → confirmar se a associação sobrevive; testar variando o atraso entre apagar/recriar acima e abaixo de 150ms.
7. Criar script novo → confirmar que aparece em `script:list` mas sem associação automática.
8. Remover script inativo → confirmar que não afeta nada em execução.
9. Remover script ativo → confirmar comportamento atual (camada morre, associação apagada) versus comportamento decidido no item 10 do plano imediato.
10. Renomear script ativo → confirmar perda de associação (comportamento atual) e medir se a correção da seção 7 resolve.
11. Alterar `mov-preset.js` com múltiplos `mov-*` ativos → confirmar reload em cascata de todos, e que um erro em um deles não impede o reload dos demais.
12. Recarregar dois scripts ativos que usam a mesma base (`mov-preset.js`) simultaneamente → confirmar que cada um recompila de forma independente (sem contaminação de estado entre as duas concatenações).
13. Garantir que scripts não relacionados não reiniciem — validar tocando um F-key script enquanto outros 3-4 estão ativos, monitorando se `OnStart`/`OnTerminate` disparam apenas no alvo.
14. Garantir que não existe frame zerado — validar via log de universo (ou capture de pacotes Art-Net) durante um hot reload, confirmando que os canais tocados pela camada antiga mantêm o último valor até o próximo `OnExecute` da nova camada.
15. Garantir que a última versão válida continua ativa após falha de reload (depende da implementação da seção 7 — hoje falha).
16. Garantir que o operador vê o erro — checklist manual nas 4 telas/fluxos (Main F-key, Main page-script, Painel F-key, Painel page-script).
17. Medir script que leva 5, 15, 30, 45 e 100 ms num `OnExecute` sintético (`const t0=Date.now(); while(Date.now()-t0<N){}`) e confirmar que a instrumentação da seção 8 classifica corretamente cada faixa (dentro do orçamento / no limite / estourado / degradação perceptível).
18. Ativar várias camadas cuja soma de `OnExecute` ultrapassa 40ms individualmente saudáveis, e confirmar que a medição de frame total (não só por-script) capta o estouro agregado.
19. Demonstrar tecnicamente que `while(true)` bloqueia o thread: rodar um `OnExecute` com `while(true){}` e observar que: (a) o Art-Net para de ser enviado, (b) outro F-key toggle não responde, (c) o próprio watcher de scripts para de reagir a novos saves — todos os três efeitos devem ocorrer simultaneamente, confirmando que é o mesmo thread.

## 16. Arquivos que uma futura implementação deverá alterar

Levantamento por área, baseado no mapeamento desta auditoria:

**Evolução imediata (seções 7-9):**
- `electron/main.js` — `readScriptCode`, `compileScriptContext`, `compileLayer`, `startScript`, `handleScriptFileEvent`, `startScriptsWatch`, `loadScriptMeta`, handlers `script:toggle`/`page_script:toggle`, `buildAllScripts`, `emitScriptsChanged`.
- `electron/engine/compositor.js` — `renderFrame` (instrumentação de duração por camada e por frame), `_removeLayerInternal` (propagação de erro com `_id`).
- `electron/engine/engine.js` — instrumentação de duração total do frame no `setInterval`.
- `electron/preload.js` — payload estendido de `onScriptsChanged` / novo canal de erro.
- `src/screens/Main.jsx` — tratamento de erro em `handleToggleScript` e no toggle de page-script; novo estado visual de erro.
- `src/screens/PainelOperacao.jsx` — correção do bug `result?.ok != null`; tratamento de erro.
- `src/store/showStore.js` — se o estado de scripts/erro precisar ser centralizado em vez de local por tela.

**Evolução posterior (seções 11-12, isolamento):**
- Novo módulo de worker (ex.: `electron/engine/scriptWorker.js`) hospedando a execução de `OnStart`/`OnExecute`/`OnTerminate`.
- `electron/main.js` — reformular `buildScriptSandbox`/`compileScriptContext` como protocolo de mensagens em vez de closures diretas.
- `electron/adapter.js` — expor `resolve()` de forma consultável pelo worker (mensagem ou réplica de estado).
- `electron/engine/compositor.js` — adaptar `addLayer`/`renderFrame` para consumir buffers atualizados via `SharedArrayBuffer` em vez de chamada de função síncrona direta.
- `electron/engine/interpolator.js`, `electron/engine/universe.js` — confirmar que continuam recebendo os valores finais sem mudança de contrato (hoje já são consumidos só pelo compositor, devem seguir assim).

---

## 17. Conclusão objetiva

O runtime de scripts do VP-LIGHT funciona hoje sobre um modelo simples, previsível e — para o caso comum de scripts corretos — funcional: compilação via `new Function`, camadas isoladas por buffers próprios, hot reload real para F-keys ativos, e boa separação entre estado de palco (scene-lock, offsets, calibração, freeze) e ciclo de vida de scripts. Nenhuma dessas garantias de estado precisa ser tocada pela evolução recomendada.

Os problemas centrais não são de arquitetura de dados, são de **decisão e de feedback**: o sistema decide substituir uma camada sem primeiro confirmar que a substituta funciona, e não tem nenhum canal para contar ao operador o que deu errado. Ambos os problemas são resolvíveis dentro do modelo síncrono atual, sem esperar por isolamento real — e é isso que a seção 13 prioriza para antes do evento.

O problema que **não é resolvível dentro do modelo atual** é o `while(true)`/laço infinito: isso é uma limitação estrutural do single-thread do Node, demonstrável e sem solução parcial — qualquer medição pós-chamada, watchdog no mesmo thread, ou timeout cooperativo falha exatamente da mesma forma que falha hoje. A única solução real é isolamento com poder de terminação externa (`worker_threads` recomendado, seção 12), que é trabalho de migração arquitetural relevante e não deve ser tentado sob pressão de prazo do evento — o risco de uma migração malfeita é maior que o risco residual de manter o modelo síncrono com as mitigações imediatas e disciplina operacional (revisão de código antes de ativar em cena, evitar laços sem condição de saída).
