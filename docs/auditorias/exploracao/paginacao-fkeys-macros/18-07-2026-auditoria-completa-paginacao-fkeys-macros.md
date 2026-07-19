# Auditoria Completa — Paginação de F-Keys, Macros e Classificação de Scripts (VP-LIGHT)

> Auditoria **read-only** conduzida pelo **Fable 5** (mente da auditoria) com o **Codex-XHigh** como executor de leitura em largura (2 varreduras delegadas, todas as evidências decisivas revalidadas por leitura direta).
> Nenhum arquivo do projeto foi alterado — este relatório é a única escrita.
> Data: 2026-07-18. Mina: `paginacao-fkeys-macros` (bateamento em `docs/auditorias/bateamento/paginacao-fkeys-macros.md`).
> Toda afirmação com `arquivo:linha` foi lida no código atual. Interpretação/opinião está marcada como **[análise]**.
> Auditorias anteriores usadas como hipótese (e revalidadas): `docs/auditorias/exploracao/v2-atual/05-07-2026-auditoria-completa-vp-light-v2.md` e `docs/auditorias/bateamento/auditoria-fable5-fire-scripts.md`.

---

## 1. Resumo executivo

O VP-LIGHT tem hoje **12 slots de script fixos (F1–F12)**, definidos por três arrays literais idênticos (`Main.jsx:691`, `PainelOperacao.jsx:31`, `tools/sync-scripts.js:16`), associados a scripts por **chave lógica** (`"F1"`, `"F2"`…) persistida em `shows/vp.show.json:1314`. **Não existe hoje nenhum conceito de "página de scripts F1–F12"** — o `page_scripts` do show é outra coisa: scripts pendurados nas teclas de CENA (A–V) por página (`main.js:635`, `main.js:1413`). A boa notícia decisiva desta auditoria: **quase toda a infraestrutura necessária para 5 páginas × 12 slots já existe** — o compositor aceita camadas com qualquer ID string (`compositor.js:82`), já convive com três famílias de ID (`F1`, `page:1:A`, `macro:id:step:seq` — `compositor.js:79`), o show.json já é a fonte única de persistência de scripts/páginas/macros, e há um runtime de macros completo (sequência, fades, overlap, loop) funcional porém **sem nenhum script válido apontado** (as 2 macros salvas referenciam 7 scripts inexistentes — `vp.show.json:1529` vs. inventário de `scripts/`).

Os bloqueios reais para a evolução são poucos e bem localizados: (a) o **ID de camada das F-keys é a própria tecla**, sem página — paginar sem qualificar o ID cria colisão entre páginas; (b) o handler de teclado **não filtra `e.repeat`** (`Main.jsx:1155-1181`) — segurar F1 já hoje liga/desliga o script em rajada; (c) o `mergeMode` do compositor é **global** e as macros o trocam ao iniciar/parar (`compositor.js:308,318`) — efeito colateral sobre scripts F-key simultâneos; (d) **não existe metadado de classificação** de script (a "categoria" atual é regex sobre o nome — `Main.jsx:27`); (e) **zero testes automatizados** no projeto (`package.json` sem script `test`, nenhum `*.test.*`).

**Recomendação decisiva (§15):** arquitetura **C — registro global de scripts com metadados + layout de páginas separado**, ambos persistidos **dentro do show.json** (mecanismo E como transporte), com migração automática das 12 associações atuais e macros tratadas como **tipo de slot** (`type: "macro"`) nas mesmas páginas.

---

## 2. Estado atual do projeto

- Electron 33 + Vite 5 + React 18 + three.js; sem TypeScript, sem lint, sem testes, sem CI (`package.json:1` completo — scripts npm: `start`, `dev`, `dev:linux`, 3 setups, `build`; nenhum `test`; busca por `*.test.*`/`*.spec.*`/jest/vitest/CI configs: vazia).
- Arquivos-chave e tamanhos: `src/screens/Main.jsx` (~3.3k linhas, 3126 não-vazias), `electron/main.js` (~1.6k linhas, termina em 1613), `electron/engine/compositor.js` (~430 linhas).
- `scripts/` tem **15 arquivos .js na raiz e nenhuma subpasta** (verificado por Glob): 4 `brut-*`, 9 `mov-*` (sendo `mov-preset.js` biblioteca injetada + script F10), `fire-base.js` (biblioteca inerte). **O pacote de 50 scripts fire ainda não existe no repositório** — `scripts/backlog/` citado na auditoria de 05-07 **não existe mais**; `fire-base.js:5` declara servir aos "50 scripts-fire", mas nenhum foi criado. O planejamento está em `docs/planejamentos/fire-2026/`.
- Show único: `shows/vp.show.json` — fixtures, 10 páginas de cenas (`show.js:27` cria/normaliza `MAX_PAGE = 10`), 12 F-keys preenchidas, `page_scripts` com só `"1": {}` (`vp.show.json:1311-1313`), 2 macros de teste quebradas (`vp.show.json:1529`).
- Os 12 `file` das F-keys ainda apontam para caminhos absolutos mortos `C:\vp-light\scripts\...` (`vp.show.json:1317` etc.); tudo funciona apenas pelo fallback `SCRIPTS_DIR/<name>.js` (`main.js:703-709`).

---

## 3. Arquitetura geral encontrada

### 3.1 Processos e fronteiras (confirmadas)

- **Renderer** (React) nunca toca hardware; fala com o main só por `window.vp.*` via contextBridge (`electron/preload.js`, ex.: scripts em `preload.js:106-116`).
- **Main process** concentra IPC, show, compilação/execução de scripts, offsets, scene-lock, macros e watch de `scripts/` (`electron/main.js`).
- **Engine** roda só em `electron/engine/` num único `setInterval` de 40 ms / 25 fps (`engine.js:18,40`).

### 3.2 Inicialização

`app.whenReady` (`main.js:1571-1603`): `createWindow()` → `show.loadShow(DEFAULT_SHOW)` → `loadScriptMeta(); loadPageScriptMeta(); loadMacros()` (`main.js:1578`) → `initializeOffsets()` → aplica `startupChannels` (fecho_lampada=255 dos fixtures habilitados — `show.js:230`) → `applyDefaultStartupScene()` → provider de canais desabilitados no compositor (`main.js:1590`) → `engine.start()` → `startScriptsWatch()`. Se o load do show falhar, só `console.warn` e o app segue sem show (`main.js:1584-1586`) — comportamento tolerante já apontado na auditoria v2 e ainda vigente.

### 3.3 Encerramento

Fechar janela é interceptado (`main.js:190` — `window:close-requested` ao renderer); confirmação do renderer libera o close (`main.js:294`). `window-all-closed` → `engine.stop()` + `app.quit()` (`main.js:1605-1608`). `engine.stop()` limpa o interval e fecha sockets (`engine.js:62`). **Não há `before-quit` nem chamada a `stopAllRunningScripts` no shutdown** — `OnTerminate` das camadas não roda ao fechar o app (irrelevante para o palco, pois o processo morre, mas relevante para consistência de contrato).

### 3.4 Estados globais

- Main process: `runningScripts` (`main.js:568`), `runningPageScripts` (`main.js:572`), `scriptMeta`, `pageScriptMeta`, `macroDefs` (`main.js:1437`), `activeSceneChannels`, freeze em `artnet.js:173`.
- Compositor: `_layers` Map (`compositor.js:38`), `_macros` Map (`compositor.js` seção macro), `_mergeMode` global (`compositor.js:243`), `_sceneLockMask/_sceneLockValues` (`compositor.js:49`).
- Renderer: `showStore.js` (Context: `show`, `currentPage` — `showStore.js:143` —, `activeScenes`, seleção) + **muito estado local em `Main.jsx`** (`scripts` em `Main.jsx:672`, `pageScripts`, `blackoutActive`, `artNetFrozen` em `Main.jsx:311`).

### 3.5 Logs, erros, timers

- Logging: só `console.*`; nenhum arquivo de log, nenhuma lib (busca por electron-log/winston/pino: vazia). IPC devolve `{ok:false, error}` (ex.: `main.js:1200`). Erros de `OnStart`/`OnTerminate` são **engolidos sem log** (`main.js:1203`, `compositor.js:192`). Erro de `OnExecute` loga e remove a camada (`compositor.js:230-236`).
- Inventário completo de timers (13): engine 40 ms (`engine.js:40`); refresh de interfaces Art-Net 10 s (`artnet.js:162`); debounce do watch 150 ms (`main.js:1332`); no renderer, toasts 3 s, polling de universo 100 ms (`Main.jsx:566`), conflitos 100 ms (`Main.jsx:783`), sidebar com script ativo 100 ms (`Main.jsx:1132`), delay de boot 500 ms (`Main.jsx:710`), e no Painel: macros 200 ms (`PainelOperacao.jsx:517`), scripts 300 ms (`PainelOperacao.jsx:744`), page-scripts 300 ms (`PainelOperacao.jsx:755`). **Nenhum script de `scripts/` usa `setTimeout`/`setInterval`/`Date.now`/`performance.now`** (busca integral vazia) — todo tempo é contado em ticks de 40 ms.

---

## 4. Fluxo completo da execução DMX

**Operador → palco (fluxo F-key, o mais relevante para esta auditoria):**

1. Tecla física F1 → `keydown` global (`Main.jsx:1184-1187`) → `handleKey` (`Main.jsx:1155`) → `FKEYS.includes(key)` → `e.preventDefault()` → `handleToggleScript('F1')` (`Main.jsx:1181`). Clique no botão → **mesma função** (`Main.jsx:2565` `onClick → handleToggleScript(fkey)`).
2. `handleToggleScript` → `window.vp.toggleScript(fkey)` (`Main.jsx:860-872`) → IPC `script:toggle` (`preload.js:106`) → handler (`main.js:1214-1222`).
3. Se já roda: `stopRunningScript(fkey)` → `compositor.stopLayer(fkey)` (`main.js:667-673`) → `OnTerminate` + flush do buffer ao universo pulando canais de outras camadas (`compositor.js:189-196`, `compositor.js:141-148`).
4. Se não roda: `startScript(fkey)` lê o arquivo (path salvo → fallback `SCRIPTS_DIR/<name>.js`, `main.js:703-709`), **prepende `mov-preset.js` se o basename começa com `mov-`** (`main.js:1072-1084`), compila com `new Function('SetChannel','getChannel','adapter','ctx', code)` (`main.js:1088-1098`), roda `OnStart` (erro engolido, `main.js:1202-1204`), registra camada `compositor.addLayer(fkey, {buffer, touched, controlledMask, context, onError})` (`main.js:1206-1209`) e marca `runningScripts[fkey]` (`main.js:1210`).
5. A cada 40 ms (`engine.js:41-48`): `ribaltaDebug.tickFrame()` → `interpolator.tick()` → `compositor.renderFrame()` → `sendArtDMX(ribaltaPhysicalCalib.getPhysicalUniverseForArtNet(getUniverse()))` → `frameListeners` (universo lógico → janela 3D via IPC).
6. Dentro do `renderFrame` (`compositor.js:215-266`): avança macros; para cada camada: envelope → `buffer.fill(0)`/`touched.fill(0)` → `OnExecute()` em try/catch (exceção remove camada, `compositor.js:230-236`); merge só nos canais tocados — **HTP por padrão** (`compositor.js:243-257`); guards (canal desabilitado, interpolador via `_writeChannelToUniverse`, `compositor.js:104-119`); `applySceneLockToUniverse()` (`compositor.js:260`); remove camadas com fade-out concluído.
7. `universe.setChannel` soma offset físico e clampa (`universe.js:41`); snapshot para a UI devolve valor lógico sem offset (`universe.js:114`); `artnet.js` monta o pacote e, **se `_frozen`, retorna sem transmitir** (`artnet.js:237`).

**Fluxo de cena:** letra A–V → `handleKey` (`Main.jsx:1174-1177`): se existe page-script naquela tecla, `handleTogglePageScript`; senão `handleActivateScene` → `toggleScene` no store (`showStore.js:229`) → mudança de `activeScenes` dispara **dois** efeitos que mandam IPC: `SceneDmxSync` no store (`showStore.js:320` — `setActiveSceneChannels` → `setActiveScenes` → `restoreState`) **e** o efeito próprio de `Main.jsx:738` — a dupla sincronização apontada na auditoria v2 continua exatamente igual. `dmx:restoreState` (`main.js:413-433`): com script/page-script rodando faz merge pulando canais controlados (`main.js:395-411,424-425`); sem scripts, `universe.blackout()` + reaplicação. **O teste `anyScriptRunning` não considera macros** (`main.js:415-416`).

---

## 5. Arquitetura atual dos scripts

### 5.1 Contrato e sandbox

Um script é um `.js` com hooks opcionais `OnStart`/`OnExecute`/`OnTerminate`, compilado por `new Function` recebendo `SetChannel`, `getChannel`, `adapter`, `ctx` (`main.js:1088-1098`). `SetChannel` respeita scene-lock, valida 1–512, clampa 0–255, marca `touched` e `controlledMask` (`main.js:1053-1059`). `adapter.resolve` traduz valor lógico via `fixture.adapters` (`adapter.js:51-69`); hoje **só `fire-base.js` chama adapter** (`fire-base.js:257`) — os 13 scripts de efeito usam `getChannel` + valores diretos.

### 5.2 Três famílias de execução (mesmo motor, três registradores)

| Família | Registro | ID de camada | Disparo |
|---|---|---|---|
| F-key | `runningScripts` (`main.js:568`) | `"F1"`…`"F12"` (`main.js:1206`) | `script:toggle` (`main.js:1214`) |
| Page-script | `runningPageScripts` (`main.js:572`) | `"page:{pageId}:{sceneKey}"` (`main.js:1413`) | `page_script:toggle` (`main.js:1393`) |
| Macro step | `_macros` no compositor | `"macro:{id}:{step}:{seq}"` (`compositor.js:360` região) | `macro:start/next` (`main.js:1521-1523`) |

**[análise]** Isto é a prova de que o compositor é agnóstico ao esquema de ID — paginar F-keys exige apenas uma quarta convenção de ID (ex.: `fkey:{page}:{slot}`), não uma mudança de engine.

### 5.3 Injeção de preset e classificação por nome

- Injeção de `mov-preset.js` é **por prefixo do basename** (`mov-*`, exceto ele próprio — `main.js:1072-1076`). `fire-base.js` não é injetado em nada (inerte, autodeclarado em `fire-base.js:10`). Confirma o achado da auditoria fire: qualquer pacote novo que não se chame `mov-*` fica sem base silenciosamente.
- A única "classificação" existente é **regex sobre o nome** para agrupar o modal de scripts existentes (`Main.jsx:18-25` categorias; `Main.jsx:27-35` `classifyExistingScriptByName`). Nomes enganosos persistem (`mov-traj-rib-alto/baixo` não tocam ribalta — cabeçalhos `scripts/mov-traj-rib-alto.js:1`, `mov-traj-rib-baixo.js:1`: "Trajetória 8 fases MH"). **Não há nenhum campo de velocidade/intensidade em lugar nenhum.**

### 5.4 Watch de scripts

`fs.watch(SCRIPTS_DIR, {recursive:true})` (`main.js:1328`) com debounce 150 ms (`main.js:1332`): arquivo removido → para e desassocia F-keys que apontavam para ele (`main.js:1288-1299`); `mov-preset.js` alterado → reinicia todas as F-keys `mov-*` ativas (`main.js:1303-1310`); outro arquivo alterado → reinicia F-keys ativas com o mesmo basename. **O watcher só percorre `scriptMeta` — não reinicia page-scripts nem passos de macro.**

---

## 6. Arquitetura atual dos botões F1–F12 — as 22 perguntas

1. **Onde os 12 slots são definidos?** Arrays literais: `Main.jsx:691` (`const FKEYS = ['F1',…,'F12']`), `PainelOperacao.jsx:31`, `tools/sync-scripts.js:16`. Renderização: `Main.jsx:2556-2589` (map sobre FKEYS na barra inferior) e `PainelOperacao.jsx:797-817` (grade 6 colunas).
2. **Hardcoded?** Sim — três cópias independentes do mesmo array; não existe `SLOT_COUNT` nem geração.
3. **O número 12 espalhado?** Como quantidade de slots aparece só via os três arrays (o literal `12` avulso no código é font-size/canais de cena — ex.: `Main.jsx:2572`). O acoplamento é por **enumeração**, não por número.
4. **Associação por posição, tecla, ID ou nome?** Por **chave lógica da tecla** (`"F1"`) no objeto `show.scripts` (`vp.show.json:1314-1344`), com `{name, file, color}`. O runtime usa a mesma chave como ID de camada e índice de `runningScripts`/`scriptMeta`. Não há ID estável de script separado da tecla.
5. **Tecla chama script direto ou camada de comando?** Há uma camada fina: tecla → `handleToggleScript` → IPC `script:toggle` → `startScript`/`stopRunningScript`. Não existe um "command registry"; a F-key é simultaneamente atalho, identidade e endereço do script.
6. **Botão visual e atalho usam a mesma fonte?** Sim em `Main.jsx`: ambos chamam `handleToggleScript` (`Main.jsx:2565` clique; `Main.jsx:1181` tecla) e leem `scripts[fkey]` do mesmo estado local. O Painel tem handler próprio mas chama o mesmo IPC (`PainelOperacao.jsx:762`).
7. **Alterar um sem o outro?** Não há como divergirem funcionalmente hoje (mesma função). Visualmente sim: o estado local `scripts` de `Main.jsx` e o polling de 300 ms do Painel podem exibir estados diferentes por instantes. **[análise]** baixa relevância hoje; vira risco com paginação se cada tela mantiver seu snapshot.
8. **Estado de "script rodando"?** Fonte da verdade: `runningScripts` no main (`main.js:568`); a UI recebe `{...meta, running}` por `getAllScripts` (`main.js:1253`) e pelo push `scripts:changed` (`main.js:1263`); `Main.jsx` guarda cópia local (`Main.jsx:672,708-721`); Painel usa polling 300 ms.
9. **Script ativo após troca de página?** Sim — trocar `currentPage` é só estado do renderer (`showStore.js:143`), nenhum IPC de stop é enviado (evidência do efeito de página: `Main.jsx:725-733` só busca page-scripts e filtra cenas ativas). Como hoje as F-keys não são paginadas, isso é inócuo; **com paginação vira a questão central** (script ativo sem botão visível).
10. **Momentâneo vs. alternável vs. contínuo?** O sistema só conhece **toggle** (`main.js:1214-1222`). Não há modo momentâneo (press-and-hold) nem auto-stop; scripts são todos contínuos até toggle/blackout/erro.
11. **Pressionar e soltar?** Não há listener `keyup` em `Main.jsx` (confirmado por leitura do arquivo). E não há filtro `e.repeat` (busca por `repeat` em `src/` só acha CSS grid) — **tecla segurada gera toggles repetidos** na cadência do auto-repeat do SO.
12. **Múltiplos scripts simultâneos?** Sim — cada F-key é uma camada independente; iniciar outra F-key não para as demais (`main.js:1214`: só a própria fkey é toggled); sem limite de quantidade (`compositor.js:101` só expõe contagem).
13. **Dois scripts no mesmo canal?** Merge **HTP**: vence `buffer[i] * weight` maior (`compositor.js:243-257`); em modo `linear` (só ativado por macro) soma com clamp 255. Ordem de inserção não importa.
14. **Como um script é interrompido?** Toggle da mesma tecla, `script:stopAll`, blackout, remoção do arquivo (watcher), exceção em `OnExecute`, ou substituição por edição do arquivo (restart pelo watcher). Sempre via `stopLayer` → `OnTerminate` → flush respeitando outras camadas (`compositor.js:189-196,141-148`).
15. **Iniciar outro script no mesmo aparelho?** Nenhuma exclusividade por fixture: as duas camadas disputam canal a canal por HTP enquanto rodam; ao parar uma, o flush pula canais que a outra ainda controla (`controlledMask` cumulativa, `main.js:1059`; `compositor.js:121-133`).
16. **Cores dos botões?** `scripts[fkey].color` do show (`Main.jsx:2559`: `script?.color || fKeyStyle.background`), fallback branco do tema (`theme.js:129`). Cores salvas hoje: `#ff8800` (F1-F3, F9, F10), `#ff6699` (F4-F8), `#000000` (F11, F12) (`vp.show.json:1318-1373`). Definidas na criação/edição pela UI (`Main.jsx:887`), salvas pelo main (`main.js:1160`, default `#000000` em `main.js:1117`), preservadas no save (`main.js:690-693`).
17. **As cores significam o quê?** **Só estilo visual escolhido manualmente.** Nenhum código lê a cor para decidir comportamento; a paleta atual até se correlaciona com família (laranja≈brut, rosa≈mov-desc) mas F9/F10 laranja são `mov-*` — **[análise]** não há semântica confiável.
18. **Estado salvo entre reinicializações?** Persistem: associações/cores das F-keys (`saveScriptMeta`, `main.js:686-695`, chamado em create/clear — `main.js:1160,1174`), page_scripts, macros, show inteiro. **Não persistem:** `running` (toggle não salva nada — `main.js:1214-1222`), macro ativa/passo, freeze (`artnet.js:173` volta a false), página atual do renderer (`showStore.js:143` inicia em `'1'` e o load reseta — `showStore.js:153`).
19. **Atalhos conflitantes?** Internos: F-keys não colidem com cenas (A–V), números (páginas), espaço (blackout), Q (sem cena), Esc (modais — `Main.jsx:1136`). Ressalvas: (a) as letras de cena e F-keys **não checam Ctrl/Alt/Meta** (só os números checam — `Main.jsx:1165`), então Ctrl+F5, Ctrl+A etc. também disparam ações da mesa; (b) input focado desarma tudo (guard de editable — `Main.jsx:1158-1164`).
20. **F1–F12 no Electron/SO?** Nenhum `globalShortcut`/`accelerator`/menu registrado (import do Electron: `main.js:13` — só app, BrowserWindow, ipcMain, dialog, nativeImage; busca integral vazia). Em janela Electron sem menu, F1–F12 chegam ao renderer; o `preventDefault` (`Main.jsx:1181`) suprime defaults de navegador. **[análise]** F11 fullscreen/F12 devtools são os únicos com default relevante em dev, ambos suprimidos pelo preventDefault no keydown.
21. **Clique vs. tecla?** Mesmo caminho (`handleToggleScript`), com 2 diferenças: clique faz `stopPropagation` (não preventDefault) e não passa pelo guard de campo editável; tecla sofre auto-repeat (item 11). Painel: só clique, sem teclado.
22. **Testes?** **Nenhum.** Sem framework, sem specs, sem CI (evidência §2).

### Tabela — arquivos para a futura implementação de paginação

| Arquivo | Classificação | Motivo |
|---|---|---|
| `src/screens/Main.jsx` | **Alteração obrigatória** | FKEYS, handleKey, handleToggleScript, render da barra, estado `scripts` |
| `electron/main.js` | **Alteração obrigatória** | `scriptMeta`/`runningScripts` por página, IPC toggle com página, IDs de camada, saveScriptMeta |
| `electron/preload.js` | **Alteração obrigatória** | assinatura dos canais de script (página no payload) |
| `electron/show.js` | **Alteração obrigatória** | normalização/validação do novo bloco de páginas de scripts no load/save |
| `shows/vp.show.json` | **Alteração obrigatória** | novo schema (registry + layout) com migração das 12 entradas |
| `src/screens/PainelOperacao.jsx` | Provável alteração | segunda UI de F-keys (grade 6×2) e MacroPanel |
| `src/store/showStore.js` | Provável alteração | se a página de scripts virar estado global (recomendado) |
| `src/theme.js` | Provável alteração | tokens de badge/indicador de classificação |
| `tools/sync-scripts.js` | Provável alteração | terceiro FKEYS hardcoded; hoje escreve path absoluto e ignora cor |
| `electron/engine/compositor.js` | Provável alteração | escopo do mergeMode por macro (pré-requisito de macros em slots); IDs já são livres |
| `src/App.jsx` | Apenas validação | roteamento não muda |
| `electron/engine/engine.js` | Apenas validação | loop não muda |
| `electron/engine/universe.js` | **Não deve ser alterado** | núcleo estável (offsets lógico↔físico) |
| `electron/engine/artnet.js` | **Não deve ser alterado** | freeze/sockets estáveis |
| `electron/engine/interpolator.js` | **Não deve ser alterado** | speed virtual estável |
| `electron/ribaltaPhysicalCalib.js`, `fixtureOffsets.js`, `adapter.js` | **Não deve ser alterado** | calibração/tradução independem de paginação |
| `scripts/*.js` (15) | Apenas validação | contrato OnStart/OnExecute/OnTerminate não muda |
| `src/viewer3d/*`, `Viewer3D.jsx` | **Não deve ser alterado** | consome onFrame, indiferente |

---

## 7. Mapa de arquivos e responsabilidades

| Arquivo | Responsabilidade | Chamado por | Chama | Estado que lê/altera |
|---|---|---|---|---|
| `electron/main.js` | IPC, ciclo de vida, compilar/rodar scripts (F-key `main.js:1180-1222`, page-script `main.js:1393-1419`, macro `main.js:1434-1533`), scene-lock (`main.js:861-887`), blackout (`main.js:389-393`), restoreState (`main.js:413-433`), watch (`main.js:1276-1340`) | renderer via IPC; app lifecycle | show.js, compositor, universe, artnet, interpolator, adapter | `runningScripts`, `scriptMeta`, `pageScriptMeta`, `macroDefs`, `activeSceneChannels` |
| `electron/preload.js` | superfície `window.vp.*` (`preload.js:106-116` scripts; macros; page_scripts) | renderer | ipcRenderer | — |
| `electron/show.js` | load/save atômico (`show.js:185`), normaliza 10 páginas (`show.js:27`), startupChannels (`show.js:230`), preserva `scripts.color` (`show.js:166`) | main.js | fs | show em memória |
| `electron/engine/engine.js` | loop 40 ms (`engine.js:40-56`), frameListeners | main.js | interpolator, compositor, artnet, calib | frameCount |
| `electron/engine/compositor.js` | camadas/envelope/merge/scene-lock/macros (`compositor.js:215-266`, `278-334`) | engine, main.js | universe, interpolator | `_layers`, `_macros`, `_mergeMode`, scene-lock |
| `electron/engine/universe.js` | buffer 512, offsets, snapshot lógico (`universe.js:41,114`), detectConflicts (`universe.js:163-179` — só cenas ativas) | compositor, main.js | — | `_buffer`, `_channelOffsets`, `_activeScenesMap` |
| `electron/engine/artnet.js` | UDP 6454, freeze (`artnet.js:173,237`), refresh ifaces 10 s (`artnet.js:162`) | engine, main.js | dgram | `_frozen`, sockets |
| `src/store/showStore.js` | Context global + `SceneDmxSync` (`showStore.js:320-333`) | App/telas | window.vp | `show`, `currentPage`, `activeScenes` |
| `src/screens/Main.jsx` | mesa completa: atalhos (`Main.jsx:1155-1187`), F-keys (`Main.jsx:2556-2589`), blackout (`Main.jsx:386-409`), freeze (`Main.jsx:411-427`), cenas, page-scripts (`Main.jsx:907`) | App.jsx | window.vp, showStore | `scripts`, `pageScripts`, `blackoutActive`, `artNetFrozen` |
| `src/screens/PainelOperacao.jsx` | touch: F-keys por polling (`PainelOperacao.jsx:740-755`), MacroPanel (`PainelOperacao.jsx:517,564,999`), Parar tudo (`PainelOperacao.jsx:938`) | App.jsx | window.vp | cópias locais por polling |
| `tools/sync-scripts.js` | associação manual arquivo→F-key; só raiz de `scripts/` (`tools/sync-scripts.js:20`); grava `{name,file}` sem cor (`tools/sync-scripts.js:134-141`) | manual (`node tools/sync-scripts.js`) | fs | reescreve show.json |

`SceneEditor.jsx` continua **não roteado** em `App.jsx` (App monta apenas main/fixtures/painel — `App.jsx:12-19`) — código órfão, sem impacto na paginação.

---

## 8. Regras de negócio confirmadas

**Regras confirmadas pelo código (a preservar):**

- **R1 — Toggle por tecla:** F-key ativa para; inativa inicia (`main.js:1214-1222`).
- **R2 — Simultaneidade livre com HTP:** múltiplos scripts convivem; canal disputado → maior valor ponderado vence (`compositor.js:243-257`).
- **R3 — Parada limpa em cascata:** stop → `OnTerminate` → flush do buffer ao universo **pulando canais que outra camada ainda controla** (`compositor.js:141-148,189-196`).
- **R4 — Blackout é global e destrutivo para scripts:** para F-keys + page-scripts + macros e zera o universo reaplicando baselines de offset (`main.js:389-393,675-684`; `universe.js:92`).
- **R5 — Freeze congela só o UDP:** engine/UI/3D continuam (`artnet.js:237,241`); ao descongelar, flush imediato (`main.js:327`).
- **R6 — Cena convive com script:** `restoreState` com script ativo faz merge sem blackout e pula canais controlados (`main.js:413-433`).
- **R7 — Scene-lock:** cor/prisma dos `moving_head_beam` com valor ≠0 na cena ficam travados contra scripts (`main.js:861-887`; `SetChannel` bloqueia em `main.js:1054`; reaplicação pós-merge em `compositor.js:260`).
- **R8 — Speed virtual:** canal `virtual_speed` nunca vai ao DMX; pan/tilt de fixtures com `virtualPanTiltSpeed` passam pelo interpolador (`interpolator.js:84-148`; guard no compositor `compositor.js:108-116`; guard no fader `main.js:891`).
- **R9 — Calibração da ribalta é do engine:** aplicada só no buffer Art-Net (`engine.js:44`); scripts nunca somam offset (confirmado: nenhum script ativo manipula offset).
- **R10 — Injeção de preset por prefixo:** `mov-*` recebe `mov-preset.js` concatenado (`main.js:1072-1084`).
- **R11 — Startup:** fecho_lampada=255 + cena A da página 1 (`show.js:230`; `main.js:1580-1582`).
- **R12 — Persistência imediata de associação:** criar/limpar F-key salva o show na hora (`main.js:1160,1174`); rodar/parar não persiste.
- **R13 — Fonte da verdade de runtime é o main:** recarregar o renderer não mata scripts; a UI se reidrata via `getAllScripts` (`main.js:568`; `Main.jsx:708-721`).

**Comportamento aparentemente intencional:** prioridade page-script > cena na mesma tecla (`Main.jsx:1175`); blackout da `Main` não limpa `activeScenes` (para poder "desfazer" reaplicando — `Main.jsx:386-390`) enquanto o do store limpa (`showStore.js:244` via Painel) — **duas semânticas de blackout diferentes por tela**.

**Comportamento acidental (não regra):** toggles em rajada com tecla segurada (sem `e.repeat`); Ctrl/Alt+letra disparando cena/F-key (filtro de modificador só nos números — `Main.jsx:1165`); macro ativa não conta como "script rodando" no `restoreState` (`main.js:415-416`) → trocar cena com só macro ativa faz `universe.blackout()` momentâneo sob a macro; `mergeMode` global trocado por macro afeta scripts F-key simultâneos (`compositor.js:308,318`).

**Débito técnico:** 3 cópias de FKEYS; paths absolutos mortos no show; `fire-base.js` inerte; cor sem semântica; dupla sync de cena; zero testes.

### Matriz — evento × script em execução

| Evento | Efeito sobre script F-key rodando | Evidência |
|---|---|---|
| Troca de página (cenas) | **Continua rodando**; nenhum IPC de stop | `Main.jsx:725-733` (efeito só busca page-scripts/filtra cenas) |
| Outra F-key pressionada | Ambos rodam; disputa por HTP | `main.js:1214`; `compositor.js:250` |
| Clique em outro botão | Idem teclado (mesma função) | `Main.jsx:2565` |
| Blackout (espaço/botão/touch) | **Parado** (OnTerminate) + universo zerado | `main.js:389-393,675-684` |
| Freeze | Continua rodando; só UDP suprimido | `artnet.js:237` |
| Troca de cena | Continua; cena não sobrescreve canais controlados | `main.js:424-425,395-411` |
| Fechar o programa | Processo morre; `engine.stop()`; **sem OnTerminate** | `main.js:1605-1608` |
| Recarregar renderer | Continua no main; UI re-sincroniza | `main.js:568`; `Main.jsx:708-721` |
| Erro em OnExecute | Camada removida, `running` limpo, UI notificada; mensagem de erro **não** chega ao operador | `compositor.js:230-236`; `main.js:1208` |
| Desconexão da interface DMX | Engine segue; sockets re-enumerados a cada 10 s; envio a loopback continua | `artnet.js:162`; auditoria v2 §5 revalidada |
| Edição do arquivo do script | Reiniciado pelo watcher (debounce 150 ms) | `main.js:1311-1317` |
| Remoção do arquivo | Parado e desassociado | `main.js:1288-1299` |

---

## 9. Acoplamentos diretos e indiretos

1. **Tecla = identidade = endereço**: a string `"F1"` é ao mesmo tempo atalho de teclado, chave de persistência (`show.scripts.F1`), chave de runtime (`runningScripts.F1`, `scriptMeta.F1`) e ID de camada no compositor (`main.js:1206`). Paginar exige quebrar esse acoplamento em (página, slot) → scriptId.
2. **Três cópias do array FKEYS** (Main, Painel, tool) — qualquer mudança de capacidade exige tocar 3 arquivos.
3. **Dupla sincronização de cena** (`showStore.js:320-333` + `Main.jsx:738-778`) — qualquer mudança em cenas/página passa por dois caminhos concorrentes de IPC.
4. **Estado visual duplicado**: `Main.jsx` (push + estado local) vs. `PainelOperacao.jsx` (polling 200–300 ms) para os mesmos scripts/macros.
5. **`mergeMode` global** no compositor acopla macros a scripts F-key simultâneos (`compositor.js:243,308,318`).
6. **Injeção por prefixo de nome** acopla comportamento de runtime à convenção de nomenclatura de arquivo (`main.js:1072-1076`).
7. **`handleKey` recriado a cada render** (deps com funções não-memoizadas — `Main.jsx:1182`): hoje correto (cleanup simétrico, `Main.jsx:1184-1187`), mas qualquer closure adicionada ali (ex.: página de scripts) precisa entrar nas deps ou usar ref, senão executa com página velha.
8. **`sync-scripts.js` grava caminho absoluto** (`tools/sync-scripts.js:134`) que o load só tolera graças ao fallback por nome (`main.js:703-709`) — acoplamento frágil a máquina/SO.

---

## 10. Problemas e débitos técnicos

| Sev. | Problema | Evidência | Impacto na meta (5 páginas/50 scripts/20 macros) |
|---|---|---|---|
| **Crítico** | `OnExecute` na thread do loop sem watchdog — laço pesado congela engine+Art-Net | `compositor.js:228-236`; nenhuma medição de duração | 50 scripts novos multiplicam a exposição; macros encadeiam scripts não testados ao vivo |
| **Crítico** | Auto-repeat do teclado gera toggles em rajada (sem `e.repeat`, sem keyup) | `Main.jsx:1155-1181`; busca `repeat` vazia | já é bug hoje; com paginação, rajada + troca de página = estado imprevisível |
| **Alto** | Macros do show quebradas: 7 scripts referenciados inexistentes; falha vira `console.error` e macro fica inativa | `vp.show.json:1529-1580`; `main.js:1459`; `compositor.js` `_enterStep` try/catch | as 20 macros futuras precisam de validação de refs no load/UI |
| **Alto** | `mergeMode` global trocado por macro afeta scripts simultâneos | `compositor.js:243,308,318` | bloqueia macros compartilhando palco com scripts sem correção de escopo |
| **Alto** | `restoreState` ignora macros no teste `anyScriptRunning` → blackout momentâneo sob macro ativa | `main.js:415-416` | quebra a regra R6 para macros |
| **Alto** | Paths absolutos mortos (`C:\vp-light\...`) persistidos e regravados; tool não-recursiva e sem cor | `vp.show.json:1317`; `tools/sync-scripts.js:20,134` | migração de schema deve normalizar para nome/relativo |
| **Médio** | Erro de script em runtime não chega ao operador (só console) | `main.js:1208,1265`; erros de OnStart/OnTerminate engolidos (`main.js:1203`, `compositor.js:192`) | com 50 scripts, diagnóstico ao vivo fica cego |
| **Médio** | Cor de botão sem semântica; classificação por regex de nome | `Main.jsx:27-35`; §6 q.17 | é exatamente o que a Fase 4 precisa substituir |
| **Médio** | Dupla sync de cena e dois blackouts com semânticas diferentes | `showStore.js:320,244`; `Main.jsx:738,386` | qualquer estado novo de página deve escolher UMA casa |
| **Médio** | `fire-base.js` rico e inerte; injeção só `mov-*` | `fire-base.js:10`; `main.js:1072` | os 50 scripts fire dependem de resolver isso (já mapeado em `docs/planejamentos/fire-2026/`) |
| **Médio** | Zero testes/CI; build só empacota (`files` inclui `scripts/**` e `shows/**`) | `package.json` | refatoração de F-keys sem rede de proteção |
| **Baixo** | Delay artificial de 500 ms para carregar F-keys no boot da UI | `Main.jsx:710` | janela em que atalhos F1–F12 não fazem nada |
| **Baixo** | `detectConflicts` só cobre cenas (não scripts/faders) | `universe.js:163-179` | indicador de conflito não enxergará scripts paginados |
| **Baixo** | SceneEditor órfão; `Moving_Wosh`/alias `""` (v2 §6) seguem no show | `App.jsx:12-19` | ruído, sem impacto direto |

---

## 11. Análise da classificação lento/rápido

**Fato:** não existe hoje nenhum dado que permita classificar um script sem executá-lo ou ler seu código. Nome (regex `Main.jsx:27`) e cor (manual) são os únicos proxies, ambos não confiáveis (nomes enganosos comprovados; cores repetidas entre famílias distintas).

**Categorias comportamentais recomendadas [análise], em dois eixos ortogonais + tipo:**

- `categoria` (tipo do efeito): `movimento` | `strobe` | `estatico` | `transicao` | `sequencia` | `utilitario`. Os 13 scripts atuais já se encaixam: `mov-traj-*`=movimento, `mov-desc-*`=transicao/sequencia, `brut-pisca-*`=strobe, `brut-fita-full`=estatico, `mov-desc-full-reset`=utilitario.
- `velocidade`: `lento` | `medio` | `rapido` (cadência percebida).
- `intensidade`: `suave` | `moderado` | `intenso` (agressividade visual — um strobe é sempre `intenso`, mesmo lento).

Combinações pedidas pelo objetivo (movimento+lento, strobe+intenso, sequência+moderado) emergem naturalmente de eixos separados em vez de uma taxonomia única gigante.

**Representação visual (não só cor):** manter a cor de fundo como **família/página** (já existe no schema) e adicionar: (a) **badge textual curto** no canto do botão (ex.: `LEN`/`MED`/`RAP` ou ícone ▲/■/●), (b) **borda lateral** de 3-4 px codificando intensidade, (c) **tooltip** com descrição. O botão já renderiza 2 linhas (`Main.jsx:2589`) e comporta um terceiro elemento pequeno. **[análise]** Isto atende acessibilidade (forma+texto+cor redundantes) sem redesenhar a barra.

**Modelo de metadados recomendado (sem implementar):**

Campos **necessários**:
- `id` (estável, slug único — desacopla da tecla e do arquivo)
- `name` (basename do arquivo, sem extensão — mantém compat com fallback `main.js:707`)
- `label` (texto curto do botão; hoje é o name, longo demais)
- `categoria`, `velocidade`, `intensidade` (enums acima)
- `color` (herda o campo já existente)
- `status`: `estavel` | `experimental` | `desativado` (slots podem apontar para script em desenvolvimento sem expô-lo)

Campos **úteis, segunda ordem**:
- `descricao` (tooltip), `tags` (busca no modal de scripts existentes), `grupos` (fixtures afetados — a UI de criação já coleta `groups`, `Main.jsx:887`), `loop: true/false` (informativo)

Campos que seriam **excesso de arquitetura** hoje **[análise]**:
- `canaisAfetados` — derivável em runtime pela `controlledMask` já existente; duplicaria verdade.
- `estrategiaDeCancelamento` — o engine já define uma única estratégia (OnTerminate+flush); campo sem consumidor.
- `prioridade` — HTP resolve concorrência hoje; prioridade explícita é feature nova, não metadado.
- `possibilidadeDeCombinacao` — idem: tudo combina via HTP por design.
- `paginaSugerida`/`ordemSugerida` — layout pertence ao bloco de páginas, não ao script (separação registry × layout).
- `modoDeAtivacao` (momentâneo/toggle) — só existe toggle; adicionar o campo antes do comportamento é especulação.
- `duracao` — scripts são contínuos por contrato; macros têm `durationMs` por passo, que já existe (`vp.show.json:1537`).

---

## 12. Análise das cinco páginas

**O que o código já oferece de reaproveitável:**
- Compositor aceita qualquer ID de camada (`compositor.js:82`) — `fkey:2:F7` funciona sem tocar no engine.
- Padrão de chave composta já provado nos page-scripts: `psKey = "${pageId}:${sceneKey}"` (`main.js:579`) e camada `page:{k}` (`main.js:1413`).
- Persistência por bloco no show.json com load/save dedicado já é o padrão (scripts/page_scripts/macros — `main.js:686-714`, `655-665`, `1473-1481`).
- O renderer já pagina cenas com `currentPage` + teclas numéricas + PgUp/PgDw (`Main.jsx:1165-1171,1189-1195`) — o mecanismo de UI é replicável.

**Decisões de comportamento que o código atual implica [análise]:**
- **Script ativo ao trocar página de scripts: deve continuar rodando** — é o comportamento consistente com tudo no sistema (troca de página de cenas não para nada; runtime vive no main; recarga da UI não para nada). Parar scripts na troca criaria a única exceção do sistema e apagaria efeito ao vivo. Consequência obrigatória: a UI precisa de **indicador de "scripts ativos em outra página"** (badge no seletor de página), senão nasce o risco "script ativo sem botão visível".
- **Toggle continua endereçando (página_do_slot, slot)**, não "página visível": apertar F1 com página 3 ativa alterna o script do slot 1 da página 3; se o script do slot 1 da página 1 estiver rodando, ele NÃO é afetado. IDs de camada page-qualified garantem isso.
- **Página ativa de scripts** deve ser estado do renderer (como `currentPage` de cenas), **independente** da página de cenas — cenas e scripts têm cadências de operação diferentes. Persistência da página selecionada entre sessões: desnecessária (cenas hoje não persistem e ninguém reclamou — `showStore.js:143`); basta iniciar na página 1.
- **Slots vazios**: já funcionam hoje (F4 sem script → `handleToggleScript` retorna cedo; botão rende sem label). Manter: slot vazio = no-op silencioso.
- **Troca de página por teclado**: não usar números (colidiria com páginas de cenas). Candidatos sem conflito: `Shift+F1..F5` ou `Ctrl+PgUp/PgDn` — decisão de UX para o Dan (§19).

---

## 13. Análise das macros

**O que já existe (reaproveitável e substancial):**
- Runtime completo no compositor: `createMacro/startMacro/stopMacro/triggerNextStep/stopAllMacros/getActiveMacroStatus` (`compositor.js:278-334` e exports), passos com `durationFrames` (inclusive `Infinity` para avanço manual), `fadeIn/fadeOut/overlapFrames` (`compositor.js:283-287`), loop, avanço automático com overlap (`_advanceMacro`), camadas por passo com ID único.
- IPC completo (`macro:create/update/start/stop/next/remove/list/status` — `main.js:1492-1533`), normalização (`main.js:1442-1457`), persistência (`main.js:1473-1481`).
- UI mínima funcional no Painel (MacroPanel: `PainelOperacao.jsx:517,564,999`) — start/stop/next com polling de status.
- Blackout e "Parar tudo" já encerram macros (`main.js:683`).

**O que falta / está quebrado:**
1. As 2 macros salvas referenciam 7 scripts inexistentes (§10) — hoje **nenhuma macro do show funciona**; erro fica no console (`_enterStep` try/catch), invisível ao operador.
2. `mergeMode` global (§10) — macro linear ativa muda o merge de TODOS os scripts; e `stopMacro` restaura 'htp' incondicionalmente mesmo se outra macro linear ainda estiver ativa (`compositor.js:318`).
3. `restoreState` não considera macro como script ativo (`main.js:415-416`).
4. Macro não recebe injeção de preset por passo? Recebe — `instantiateMacro` usa `compileLayer` (`main.js:1459-1461` → `main.js:1104-1112` → `readScriptCode` com injeção) — **ok, mesma tubulação dos F-keys**.
5. Sem conceito de "passos paralelos" (executar 2 scripts simultâneos num passo): o overlap entre passos consecutivos é o único paralelismo. Para "combinação simultânea" plena, o schema de passo precisaria aceitar lista de scripts. **[análise]** overlap cobre parte dos casos; passos multi-script são extensão natural do mesmo runtime.
6. Sem tratamento configurável de erro (passo que falha desativa a macro inteira — `_enterStep`).

**Recomendação arquitetural (decisiva):** tratar macro como **tipo de item de slot** — um slot de página aponta para `{type:"script", id}` ou `{type:"macro", id}` — **compartilhando as 5 páginas de F-keys**, sem área/modo próprio. Razões: (a) o operador ganha 60 slots endereçáveis por tecla — 20 macros cabem, p.ex., numa página dedicada "MACROS" por convenção de layout, o que dá o benefício de "área própria" sem custo de um segundo sistema de botões; (b) o compositor já trata macro como fonte de camadas igual a script — a distinção é só no disparo (`macro:start/stop` vs `script:toggle`), trivial de rotear pelo `type` do slot; (c) um modo "scripts/macros" alternável dobraria o estado de UI e criaria o risco de o operador apertar F3 no modo errado ao vivo; (d) a faixa separada de botões não tem espaço físico na barra atual (12 botões + páginas). O MacroPanel do Painel touch permanece como UI de gestão/depuração. **Pré-requisitos antes de macros entrarem em slots:** corrigir escopo do mergeMode, incluir macros no `anyScriptRunning`, validar refs de passos no load com aviso na UI.

---

## 14. Comparação das alternativas arquiteturais

| Critério | A) 5 arrays hardcoded | B) Config central de páginas+slots | C) Registro de scripts + layout separado | D) Geração automática por arquivos | E) Config dentro do show |
|---|---|---|---|---|---|
| Vantagens | nenhum design novo | 1 fonte para UI+atalhos | metadados (classificação) independentes do layout; macros = mesmo mecanismo de referência; script pode aparecer em 2 páginas sem duplicar metadado | zero manutenção manual | reaproveita load/save/merge/backup atômico existentes; migração natural do bloco `scripts` |
| Desvantagens | 60 slots hardcoded, 3× os problemas atuais | metadado de script fica preso ao slot (duplicado se script em 2 páginas) | um nível a mais de indireção (slot→id→meta) | classificação lento/rápido **não é dedutível do arquivo** (comprovado: nomes mentem, §5.3); ordem/página instáveis; arquivo novo aparece sem curadoria | por si só não define ESTRUTURA, só o transporte |
| Riscos | explosão de condicionais; regressão certa | migrar de B para C depois = 2ª migração | ids órfãos (mitigável com validação no load) | script em desenvolvimento vira botão ao vivo | show.json cresce (aceitável: já carrega cenas de 92 canais) |
| Compatibilidade com arquitetura atual | alta (é o padrão atual) | alta | **alta — espelha exatamente o trio scripts/page_scripts/macros já existente** | média (watcher existe, mas fluxo de associação é curado — `sync-scripts.js` é interativo) | máxima (é o mecanismo vigente) |
| Facilidade para macros | péssima | média (macro vira slot, mas sem registro próprio) | **ótima** (slot referencia id tipado; macros já têm registro `macroDefs`) | ruim (macro não é arquivo .js) | boa |
| Testabilidade | ruim | boa | **ótima** (validador de show pode checar registry×layout×arquivos sem UI) | média | boa |

**Nota sobre D:** vale como **ferramenta de apoio dev** (evolução do `sync-scripts.js`: escanear `scripts/`, propor entradas de registry faltantes), nunca como fonte de layout em runtime.

---

## 15. Recomendação final decisiva

**Adotar a alternativa C — registro global de scripts + layout de páginas separado — persistida dentro do show.json (E como transporte).** Sem "depende":

1. **Novo bloco `scriptLibrary`** no show.json: mapa `scriptId → {name, label, categoria, velocidade, intensidade, color, status, descricao?, tags?, grupos?}` (campos do §11). O `name` mantém o contrato de resolução de arquivo atual (`SCRIPTS_DIR/<name>.js`, `main.js:707`), eliminando paths absolutos.
2. **Novo bloco `scriptPages`**: `{ "1": { name, slots: { F1: {type:"script"|"macro", id} , … F12 } }, … "5": {...} }`. Slot vazio = ausente. 5 páginas iniciais, N no futuro sem mudança de código (mesmo padrão `MAX_PAGE` de cenas).
3. **Migração automática no load** (`show.js`, mesmo lugar que normaliza `pages` — `show.js:27`): show antigo com bloco `scripts` → gera `scriptLibrary` (ids = names, classificação `status:"estavel"` + eixos default `medio/moderado` para curadoria posterior) + `scriptPages["1"]` com as 12 associações atuais. **Compatibilidade total: os 12 scripts atuais viram a página 1 sem intervenção manual.**
4. **Runtime no main**: `runningScripts` passa a ser indexado por `"{pageId}:{slot}"` (padrão `psKey` já provado — `main.js:579`); camada `fkey:{pageId}:{slot}`; IPC `script:toggle(pageId, slot)` com fallback do formato antigo durante a transição.
5. **Renderer**: `activeScriptPage` (estado no showStore, separado do `currentPage` de cenas); barra F1–F12 renderiza do layout da página ativa; handler de teclado ganha guard `if (e.repeat) return` (correção obrigatória incluída); seletor de página de scripts com badge "● ativo" em páginas com script rodando.
6. **Macros**: entram como `type:"macro"` nos mesmos slots (recomendação do §13), **somente após** os 3 pré-requisitos (mergeMode com escopo, macros no `anyScriptRunning`, validação de refs).

Rejeito explicitamente: **A** (multiplica o débito atual por 5), **B** puro (metadado preso ao slot inviabiliza a classificação visual limpa e o reuso de script em 2 páginas), **D** como fonte de verdade (classificação não é dedutível de arquivo — evidência dos nomes enganosos), **E sem estrutura** (transporte sem separar registry de layout repetiria o acoplamento tecla=identidade).

---

## 16. Registro de riscos

| # | Risco | Prob. | Impacto | Evidência | Mitigação | Teste necessário |
|---|---|---|---|---|---|---|
| R01 | Auto-repeat: tecla segurada gera N toggles | **Alta** | Alto (palco pisca ao vivo) | sem `e.repeat` em `Main.jsx:1155-1181` | guard `e.repeat` no handler | segurar F1 2 s → exatamente 1 toggle |
| R02 | Script pesado/laço trava engine+Art-Net | Média | **Crítico** | `compositor.js:228-236` sem watchdog | orçamento de ms por OnExecute; derrubar camada lenta | script com `while(true)` → camada removida, Art-Net vivo |
| R03 | Script ativo sem botão visível após troca de página | **Alta** (com paginação) | Alto (operador perde controle do efeito) | troca de página não para nada (`Main.jsx:725-733`) | indicador de página com scripts ativos + lista global "ativos" | ativar F1 pág.1, ir à pág.3 → badge na pág.1; F1 na pág.3 não afeta o da pág.1 |
| R04 | Colisão de ID de camada entre páginas | Certa se não tratado | Alto | camada = `"F1"` (`main.js:1206`) | ID `fkey:{page}:{slot}` | 2 páginas com script no slot 1 rodando juntos |
| R05 | Closure com página antiga no handler de teclado | Média | Alto (F-key dispara script da página errada) | `handleKey` recriado por render, deps manuais (`Main.jsx:1182`) | página via ref (padrão `pageScriptsRef` já usado — `Main.jsx:1175`) + teste | trocar página e apertar F1 imediatamente → script da página nova |
| R06 | Listeners duplicados de keydown | Baixa | Alto | hoje cleanup correto (`Main.jsx:1184-1187`); risco em refatoração | manter useEffect único; teste de contagem | espionar addEventListener após 10 re-renders → 1 ativo |
| R07 | Troca de página durante tecla pressionada | Média | Médio | keydown sem keyup pareado | endereçar toggle no keydown à página do momento do evento | pressionar F1 e trocar página antes de soltar → 1 toggle na página original |
| R08 | Dois scripts no mesmo canal com resultado inesperado | Média | Médio | HTP global (`compositor.js:250`); sem exclusividade por fixture | manter HTP; documentar; indicador de conflito estendido a camadas | 2 scripts no mesmo dimmer → maior vence; parar 1 → outro mantém |
| R09 | mergeMode global trocado por macro afeta scripts | **Alta** (quando macros voltarem a funcionar) | Alto | `compositor.js:308,318` | mergeMode por escopo/camada antes de macros em slots | macro linear + script HTP simultâneos → script inalterado |
| R10 | Slot apontando para script inexistente | **Alta** (já ocorre nas macros) | Médio | `vp.show.json:1529` refs quebradas; F-key: `loadScriptMeta` só associa se arquivo existe (`main.js:710`) | validação registry×layout×fs no load, aviso visual no slot | slot com id órfão → botão marcado "inválido", toggle retorna erro controlado |
| R11 | IDs duplicados no registry | Baixa | Médio | não há validação de unicidade hoje (schema novo) | validador no load/save | show com id duplicado → aviso, primeiro vence |
| R12 | Configuração inválida (página fora de 1–5, slot desconhecido) | Média | Médio | `show.js` normaliza páginas de cenas (`show.js:27`), nada para scripts ainda | normalizar no load (padrão existente) | show com `scriptPages["9"]` → clampado/ignorado com warn |
| R13 | Vazamento de timers no renderer | Média | Médio | 8 intervals/timeouts em Main/Painel (§3.5), cleanup manual | revisar cleanups ao mexer; teste de contagem | trocar de tela 20× → sem crescimento de intervals |
| R14 | Renderer reiniciado enquanto engine roda | Baixa | Baixo (comportamento hoje é correto) | `main.js:568`; re-hidratação `Main.jsx:708` | preservar: novo estado de página deve re-hidratar do main | reload com script ativo → botão volta aceso na página certa |
| R15 | Diferença clique vs. teclado | Baixa | Baixo | mesmo handler (`Main.jsx:2565,1181`); Painel sem teclado | manter função única por slot | clique e tecla no mesmo slot → efeitos idênticos |
| R16 | Cores sem significado consistente / estado visual ≠ real | Média | Médio | cor manual (§6 q.17); blackout otimista marca `running:false` sem confirmar (`Main.jsx:394-407`); Painel com polling 300 ms | classificação do §11; reconciliar via `scripts:changed` | blackout → estado visual = `getAllScripts` do main |
| R17 | Perda de compatibilidade com os 12 scripts atuais | Baixa (com migração) | **Crítico** | bloco `scripts` atual (`vp.show.json:1314`) | migração automática no load + show antigo em backup | abrir show antigo → 12 slots na página 1 idênticos, toggle ok |
| R18 | Scripts não cancelados / canal preso ao parar | Baixa | Médio | flush respeita outras camadas (`compositor.js:141-148`); OnTerminate garantido exceto no shutdown (`main.js:1605`) | preservar tubulação; incluir stopAll no quit se necessário | parar cada um dos 15 scripts → universo sem resíduo |
| R19 | Performance com macros + múltiplos efeitos | Baixa | Médio | merge O(512×camadas) (`compositor.js:244-251`); buffers pré-alocados | medir frame time com 12 camadas + 2 macros | 14 camadas ativas → frame < 40 ms sustentado |
| R20 | Erro de execução invisível ao operador | **Alta** | Médio | erro OnExecute só console (`main.js:1208`) | payload de erro no `scripts:changed` + toast | script que lança → aviso visível com nome do slot |

---

## 17. Plano futuro de implementação (etapas pequenas — NÃO executar agora)

**Etapa 0 — Rede de segurança mínima.** Guard `e.repeat` no `handleKey`; validação de refs de macro no load com warn. Arquivos: `Main.jsx`, `main.js`. Checkpoint: comportamento atual intacto + R01 eliminado. Rollback: revert (2 mudanças pontuais). Critério: segurar tecla = 1 toggle; macro quebrada loga aviso claro.

**Etapa 1 — Schema + migração (sem UI nova).** Definir `scriptLibrary`/`scriptPages` em `show.js` (normalização no load, geração a partir do bloco `scripts` legado; save grava ambos os formatos durante a transição). Arquivos: `show.js`, `shows/vp.show.json` (gerado), validador opcional em `tools/`. Depende de: nada. Checkpoint: app abre, 12 F-keys funcionam exatamente como antes (lendo do formato novo). Rollback: load volta a ler só o bloco legado (que continua sendo gravado). Critério: diff funcional zero na operação.

**Etapa 2 — Runtime paginado no main.** `scriptMeta`/`runningScripts` por `"{page}:{slot}"`; camada `fkey:{page}:{slot}`; IPC novo `script:toggle(pageId, slot)` mantendo o antigo como alias para página 1. Arquivos: `main.js`, `preload.js`. Depende de: Etapa 1. Checkpoint: UI antiga (ainda sem seletor) opera a página 1 pelo alias. Rollback: alias antigo permanece; remover handlers novos. Critério: toggles, blackout, watch e stopAll funcionam com as chaves novas.

**Etapa 3 — UI de páginas de scripts.** `activeScriptPage` no showStore; seletor (5 botões) na barra; F1–F12 renderizando do layout; badge de página com scripts ativos; handler de teclado endereçando `(activeScriptPage, slot)` via ref. Arquivos: `Main.jsx`, `showStore.js`, `theme.js`, `PainelOperacao.jsx`. Depende de: Etapa 2. Checkpoint: trocar página muda os 12 botões; scripts de outras páginas seguem rodando com indicador. Rollback: seletor escondido = página 1 fixa (equivale ao atual). Critério: matriz do §8 preservada em todas as páginas.

**Etapa 4 — Classificação visual.** Preencher eixos no `scriptLibrary` dos 15 scripts (curadoria manual do Dan); badge+borda+tooltip nos botões. Arquivos: `Main.jsx`, `theme.js`, show. Depende de: Etapa 3. Critério: significado legível sem depender de cor (teste de daltonismo simulado).

**Etapa 5 — Macros em slots.** Pré-requisitos: mergeMode com escopo por camada/macro (`compositor.js`), macros no `anyScriptRunning` (`main.js:415`), validação de refs. Depois: `type:"macro"` no slot, toggle roteando para `macro:start/stop`. Arquivos: `compositor.js`, `main.js`, `Main.jsx`. Depende de: Etapas 1–3. Checkpoint: macro válida dispara por F-key; blackout/freeze se comportam como a matriz. Rollback: slots macro desabilitados por flag de status. Critério: macro linear simultânea a script HTP não altera o script.

**Etapa 6 — Hardening.** Watchdog de OnExecute (R02); erro de script visível (R20); atualização do `sync-scripts.js` (recursivo, grava name relativo, escreve registry). Independente das etapas 3–5, pode adiantar. Critério: script `while(true)` derrubado sem congelar Art-Net.

Cada etapa: testar com palco de teste + Viewer3D + saída Art-Net antes de operação real (mesmo protocolo da auditoria v2 §14).

---

## 18. Plano de testes (a propor — não implementar)

Hoje não há harness; **[análise]** o caminho de menor atrito é Vitest para unidades puras (show.js normalização/migração, compositor com mocks de universe) + testes manuais roteirizados para o ao vivo, dado que o engine depende de timers e UDP.

| # | Teste | Tipo |
|---|---|---|
| T01 | F1 executa o slot 1 da página ativa; F12 o slot 12 | integração UI→main |
| T02 | Trocar de página não recria listeners (contagem de keydown = 1) | unidade/DOM |
| T03 | Clique e tecla no mesmo slot produzem o mesmo resultado | integração |
| T04 | Slot vazio → no-op sem erro | unidade |
| T05 | Slot com id órfão → `{ok:false}` controlado + aviso visual | unidade + UI |
| T06 | Página inválida no show → normalizada para faixa 1–5 com warn | unidade (show.js) |
| T07 | Script rodando mantém-se após troca de página; badge aparece | integração |
| T08 | Blackout em qualquer página para tudo (F-keys, page-scripts, macros) e zera universo com baselines | integração |
| T09 | Freeze em qualquer página: engine segue, UDP mudo, unfreeze flusha | integração |
| T10 | Tecla mantida 2 s → 1 toggle (e.repeat) | unidade/DOM |
| T11 | Troca rápida de páginas (10×/s) + toggles → sem camada órfã nem estado divergente | stress |
| T12 | Badges de velocidade/intensidade renderizam por metadado, legíveis sem cor | UI |
| T13 | Show legado (bloco `scripts` atual) migra para página 1 com os 12 scripts idênticos | unidade (migração) |
| T14 | Macro por slot: start/stop/next, loop, overlap; erro num passo → estado consistente e aviso | integração |
| T15 | Macro linear + script HTP simultâneos → merge do script inalterado (pós-fix de escopo) | unidade (compositor) |
| T16 | Frame time < 40 ms com 12 camadas + 2 macros ativas | performance |
| T17 | Sem vazamento: intervals/listeners estáveis após 30 trocas de tela/página | stress |
| T18 | `npm run build` empacota com o novo schema (files já incluem shows/scripts) | build |
| T19 | UI utilizável em 1280×720 e 1920×1080 com seletor de páginas + badges | manual |
| T20 | Reload do renderer com scripts em 2 páginas → estado visual re-hidratado correto | integração |

---

## 19. Dúvidas que realmente exigem decisão humana (Dan)

1. **Atalho de troca de página de scripts**: `Shift+F1..F5`, `Ctrl+PgUp/PgDn`, ou só mouse/touch? (números já são das páginas de cenas — `Main.jsx:1165`).
2. **Curadoria da classificação** dos 15 scripts atuais (velocidade/intensidade/categoria) — ninguém além do operador sabe o efeito real no palco; nomes comprovadamente enganam.
3. **Destino das 2 macros quebradas** do show: apagar, ou recriar os 7 scripts `mov-padrao-*`/`brut-*` (não existem mais no repo — nem em backlog)?
4. **Página dedicada a macros** (convenção de layout: pág. 5 = MACROS) ou macros misturadas com scripts nas 5 páginas? (A arquitetura recomendada suporta ambos sem mudança de código.)
5. **Comportamento do blackout**: manter as duas semânticas atuais (Main preserva `activeScenes` para desfazer; Painel limpa) ou unificar? Afeta o teste T08.
6. **Destino do `fire-base.js`**: será a base injetada do pacote fire-2026 (exige estender a injeção por diretório/marcador — `main.js:1072`) ou arquivado? Decisão já pendente desde a auditoria fire; a paginação não depende dela, mas os 50 scripts sim.
7. **Persistir a página de scripts ativa entre sessões?** Recomendo que não (consistente com cenas); confirmar preferência de operação.

---

## 20. Conclusão objetiva

O sistema atual é **um bom terreno** para a evolução pedida: engine e compositor não precisam de mudança estrutural para paginação (IDs de camada livres, três famílias já convivendo), o show.json já é a fonte única de persistência com escrita atômica, e o runtime de macros existe e funciona — só está desconectado de scripts reais. Os 12 slots atuais são hardcoded por enumeração em exatamente três arquivos, a associação é por chave de tecla, e o acoplamento central a quebrar é **tecla = identidade = endereço do script**.

O caminho recomendado (§15) — registro de scripts com metadados + layout de páginas, dentro do show.json, com migração automática e macros como tipo de slot — preserva todas as 13 regras de negócio confirmadas (§8), não toca nos arquivos marcados como intocáveis (§6-tabela) e se implementa em 7 etapas pequenas com rollback (§17). Antes de qualquer etapa de paginação, duas correções são inegociáveis: guard de `e.repeat` no teclado e validação/aviso de referências quebradas — e, antes de macros entrarem em slots, o escopo do `mergeMode` e a inclusão de macros no `anyScriptRunning`. O maior risco sistêmico segue sendo o já apontado na auditoria v2 e revalidado aqui: **scripts rodam na thread do loop DMX sem watchdog** — com 50 scripts novos e 20 macros, esse risco escala, e o watchdog deve entrar no plano (Etapa 6) antes do pacote fire chegar ao palco.

O projeto está completamente mapeado para a segunda tarefa (implementação da paginação) começar com segurança.

---
*Fim da auditoria. Read-only: nenhum arquivo do projeto foi alterado além deste relatório.*
