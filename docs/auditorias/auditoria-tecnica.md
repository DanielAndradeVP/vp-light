# Auditoria tecnica do vp-light

Data da auditoria: 2026-06-10

Esta auditoria cobre o estado atual do projeto `vp-light` sem aplicar correcoes. O objetivo e registrar a arquitetura, os contratos entre processos, o modelo de dados, os fluxos existentes, os bugs observados e as pontas soltas que devem orientar o proximo ciclo de desenvolvimento.

## 1. Visao geral da arquitetura

O `vp-light` e um aplicativo desktop Electron com renderer em React/Vite e engine DMX em Node.js no processo principal.

Fluxo macro:

```text
Usuario
  -> React renderer (src/)
  -> window.vp.* (electron/preload.js)
  -> ipcMain handlers (electron/main.js)
  -> universe.js
  -> engine.js
  -> artnet.js
  -> UDP broadcast 255.255.255.255:6454
  -> SL3000 / Art-Net bridge
  -> DMX512 / fixtures
```

Separacao atual:

- `electron/main.js`: janela Electron, IPC, engine, show em memoria, scripts F1-F12.
- `electron/preload.js`: bridge segura `window.vp.*`.
- `electron/show.js`: leitura/escrita do arquivo `.show.json`.
- `electron/engine/universe.js`: estado dos 512 canais DMX.
- `electron/engine/engine.js`: loop de envio a 25fps.
- `electron/engine/artnet.js`: pacote ArtDMX e UDP broadcast.
- `src/store/showStore.js`: estado global do renderer via React Context.
- `src/screens/Main.jsx`: mesa principal, cenas, scripts, faders, fixtures, paginas e paineis.
- `src/screens/FixturePanel.jsx`: configuracao/lista de aparelhos.
- `src/screens/FixtureEditor.jsx`: edicao basica de fixture.
- `src/screens/SceneEditor.jsx`: editor de cena legado/desconectado do fluxo atual.
- `scripts/*.js`: efeitos DMX executados pelo main process.
- `shows/vp.show.json`: show padrao carregado na inicializacao.

## 2. Estado dos arquivos principais

### `package.json`

Scripts:

- `npm run dev`: roda Vite na porta 5173 e depois abre Electron.
- `npm run start`: abre Electron diretamente.
- `npm run build`: roda `vite build` e `electron-builder`.

Dependencias principais:

- Electron 33.
- React 18.
- Vite 5.
- Sem bibliotecas de estado externas.

Estado observado:

- `vite build` compila o renderer.
- `electron-builder` falha no Windows por falta de privilegio para criar symlinks ao extrair `winCodeSign`. Isso e problema de ambiente/permissao, nao erro de compilacao React.

### `vite.config.js`

Configura React, base relativa `./`, build para `dist`, servidor em `5173` e suporte JSX em arquivos `.js` dentro de `src/`.

### `index.html`

Entry point do renderer. Inclui fonte Roboto via Google Fonts, mas a UI atual usa majoritariamente Arial/Segoe via estilos inline e `theme.js`. Ha potencial inconsistencia visual e dependencia de rede desnecessaria para a fonte.

### `electron/main.js`

Responsabilidades atuais:

- Cria a janela Electron.
- Em dev, carrega `http://localhost:5173` e abre DevTools.
- Em build, carrega `dist/index.html`.
- Carrega `shows/vp.show.json` na inicializacao.
- Inicia a engine DMX automaticamente.
- Registra IPC de engine, DMX, show e scripts.
- Mantem `scriptMeta`, `runningScripts` e `activeSceneChannels`.
- Executa scripts via `new Function()`.
- Abre scripts no VS Code usando `spawn`/`execFile` e caminhos comuns do Windows.

Pontos fortes:

- Main process e a unica camada que toca engine, filesystem e UDP.
- Scripts rodam no main, nao no renderer.
- Ha tentativa robusta de abrir VS Code.
- Engine inicia automaticamente, reduzindo friccao operacional.

Pontos de risco:

- `dmx:blackout` zera universo, mas nao para scripts ativos.
- `dmx:restoreState` aplica canais recebidos, mas nao zera canais que ficaram fora do novo estado.
- `script:create` sempre deriva o arquivo por nome em `SCRIPTS_DIR`; quando usado para associar script existente, pode reusar/criar pelo nome e nao pelo `selectedExisting.file` do renderer.
- `loadScriptMeta()` adiciona scripts ao `scriptMeta`, mas nao limpa metadados anteriores antes de carregar outro show.
- `show:save` mescla `pages` preservando paginas antigas do `currentShow`; isso evita perda acidental, mas pode impedir remocao intencional de paginas.
- Logs de `show:save` sao verbosos e podem poluir console durante operacao.

### `electron/preload.js`

Expoe `window.vp` com:

Engine:

- `startEngine()`
- `stopEngine()`
- `getEngineStatus()`

DMX:

- `activateScene(channels)`
- `setChannel(channel, value)`
- `blackout()`
- `restoreState(channels)`
- `setActiveSceneChannels(channels)`
- `setActiveScenes(scenesMap)`
- `getConflicts()`
- `getUniverse()`

Show:

- `loadShow(filePath)`
- `saveShow(showData)`
- `saveShowAs(showData)`
- `getShow()`
- `updateScene(pageId, sceneKey, sceneData)`

Scripts:

- `listScripts()`
- `createScript(fkey, name, options)`
- `editScript(fkey, filePath)`
- `clearScript(fkey)`
- `toggleScript(fkey)`
- `getAllScripts()`

Estado:

- Bridge esta alinhada com a arquitetura.
- Nao ha validacao forte dos argumentos no preload; ele repassa tudo ao main.

### `electron/show.js`

Responsabilidades:

- Ler JSON do disco.
- Validar campos minimos: objeto, `version`, `fixtures` array, `pages` objeto.
- Guardar `currentShow` e `currentShowPath`.
- Salvar com arquivo temporario e rename.
- Atualizar uma cena em memoria.

Lacunas:

- Nao valida fixture: `id`, `name`, `startChannel`, `channelCount`, canais dentro de 1-512, sobreposicao.
- Nao valida paginas/cenas: letras validas, formato de `channels`, cor, nome.
- `updateScene()` nao remove cena vazia; quem remove e o store do renderer. No main, uma cena vazia enviada diretamente vira entrada vazia.
- Nao ha historico, backup ou recuperacao em caso de JSON corrompido.

### `electron/engine/universe.js`

Modelo:

- `Uint8Array(512)`.
- Canal DMX 1-based no contrato publico.
- Indice interno 0-based.
- Valores normalizados para 0-255.
- Snapshot retorna somente canais com valor > 0.

Funcoes:

- `setChannel(channel, value)`
- `applyScene(channelMap)`
- `blackout()`
- `getUniverse()`
- `getUniverseSnapshot()`
- `setActiveScenes(scenesMap)`
- `detectConflicts()`

Problemas:

- `applyScene()` aplica mapa incremental. Nao representa "estado completo" do universo.
- `setActiveScenes()` usa `Object.assign`, acumulando cenas antigas. Quando uma cena e desativada, ela pode continuar no mapa de conflitos.
- `detectConflicts()` considera conflito qualquer canal presente em mais de uma cena, mesmo se valores forem iguais. Isso pode ser intencional, mas precisa ser definido.

### `electron/engine/engine.js`

Responsabilidades:

- `start()` cria `setInterval` de 40ms.
- Envia `getUniverse()` para `sendArtDMX`.
- Conta frames.
- `stop()` limpa intervalo e fecha socket.

Estado:

- Simples e correto.
- Nao tenta fazer logica de composicao DMX.
- Usa buffer bruto, evitando snapshot/alocacao por frame.

Risco:

- Se `sendArtDMX` ou callback UDP gerar muitos logs, pode impactar console, mas nao ha bloqueio evidente no loop.

### `electron/engine/artnet.js`

Responsabilidades:

- Monta pacote ArtDMX de 530 bytes.
- Header pre-alocado.
- Copia 512 bytes do universo para o pacote.
- Envia UDP broadcast para porta 6454.
- Recria socket apos erros consecutivos.

Estado:

- Adequado para 1 universo.
- Universe Art-Net fixo em 0.
- Broadcast fixo em `255.255.255.255`.

Lacunas:

- Sem configuracao de IP alvo, interface de rede ou universo.
- Sem telemetria acessivel ao renderer sobre falhas UDP.

### `src/main.jsx` e `src/App.jsx`

`main.jsx` monta `<App />`.

`App.jsx` faz roteamento simples em memoria:

- `main`
- `fixtures`

Nao ha rota para `SceneEditor.jsx`. O editor de cena existe, mas nao e acessivel pelo fluxo atual.

### `src/store/showStore.js`

Estado global:

- `show`
- `currentPage`
- `activeScene`
- `selectedFixtureId`
- `loading`

Acoes:

- `saveShow`
- `loadShow`
- `addFixture`
- `updateFixture`
- `removeFixture`
- `duplicateFixture`
- `activateScene`
- `blackout`
- `updateScene`
- `setShow`

Pontas soltas:

- `activeScene` singular esta obsoleto em relacao a `Main.jsx`, que usa `activeScenes` local.
- O store sabe carregar/salvar show, mas nao possui operacoes formais de paginas.
- `updateScene()` atualiza estado local e chama IPC sem aguardar resultado.
- `loadShow()` reseta `currentPage` e `activeScene`, mas nao conversa com `Main.jsx` para resetar `activeScenes`, scripts, live values ou universo.
- `duplicateFixture()` copia `startChannel`, causando sobreposicao DMX por padrao.

### `src/screens/Main.jsx`

Responsabilidades acumuladas:

- Mesa de fixtures.
- Drag de fixtures.
- Rubber-band selection.
- Faders do fixture selecionado.
- Painel direito com abas `Chat` e `Descricao`.
- Redimensionamento do painel direito.
- Painel de teste com polling do universo.
- Barra de cenas.
- Navegacao de paginas por `PgUp`/`PgDw`.
- Blackout.
- Controle de scripts F1-F12.
- Modal de criacao/edicao/lista de scripts.
- Modal de salvar cena.
- Modal de mover script.
- Modal de conflitos.
- Atalhos de teclado.

Estado local relevante:

- `activeScenes`
- `blackoutActive`
- `liveValues`
- `testValues`
- `conflicts`
- `rightPanelTab`
- `rightPanelWidth`
- `dragging`
- `selection`
- `multiSelected`
- `scripts`
- `scriptMenu`
- `createModal`
- `moveModal`
- `contextMenu`
- `saveModal`

Pontos fortes:

- A tela principal entrega boa parte do fluxo operacional real.
- Faders enviam DMX ao vivo.
- Cenas podem ser ativadas/desativadas e salvas por pagina.
- Scripts podem ser operados sem sair da tela.
- Pagina atual agora e tratada como numero (`currentPageNumber`/`currentPageId`).

Problemas e inconsistencias:

- `activeScenes` nao fica no store e nao e resetado automaticamente ao trocar pagina.
- Ao ir para uma pagina que nao existe no JSON, a UI mostra o numero, mas a pagina e virtual. Ela so passa a existir se salvar uma cena.
- `pgDw()` incrementa indefinidamente, sem limite e sem criacao formal de pagina.
- `resolveUniverseState()` chama `restoreState(merged)`, mas o main so aplica incrementalmente. Canais antigos podem permanecer ligados.
- Blackout da UI zera o universo, mas scripts ativos continuam rodando no main.
- `blackoutActive` pode ficar incoerente se o usuario mexer em cenas/scripts/faders depois.
- Faders alteram `liveValues` e DMX diretamente, mas esse estado nao e uma fonte de verdade global.
- Salvar cena usa `liveValues`; dependendo do fluxo, pode salvar apenas o que passou pelos faders ou cena ativa, nao necessariamente o universo real.
- `handleKey` depende de funcoes recriadas a cada render; funciona, mas dificulta estabilidade e leitura.
- Polling de conflitos a cada 100ms fica sempre ativo, mesmo sem cenas.
- Polling do painel de teste tambem usa IPC a cada 100ms quando aberto.
- Aba `Chat` e botoes laterais do painel direito sao placeholders.
- Muitos estilos inline duplicam valores de `theme.js`, reduzindo valor do tema central.

### `src/screens/FixturePanel.jsx`

Responsabilidades:

- Lista fixtures em tabela estilo configuracao.
- Filtra fixtures.
- Novo, editar, remover, duplicar.
- Salvar e voltar.

Estado:

- Visual bem mais completo que funcionalidade.
- Muitas abas/botoes aparecem desabilitados como placeholders.

Problemas:

- Novo fixture nasce em canal 1, causando conflito com fixtures existentes.
- Duplicar fixture copia o mesmo endereco DMX.
- Nao ha validacao de universo/canal/sobreposicao.
- Campos de rodape sao somente leitura.

### `src/screens/FixtureEditor.jsx`

Responsabilidades:

- Editar nome.
- Editar numero de canais.
- Editar canal de inicio.
- Editar nomes dos canais.
- Salvar fixture.

Problemas:

- Nao valida `startChannel + channelCount - 1 <= 512`.
- Nao alerta sobre sobreposicao.
- Nao valida nome vazio.
- Nao edita `manufacturer`, `model`, `fixtureType`, `universe`, `group`, `par`, `rdm`, `note`, embora o painel liste esses campos.
- Chama `updateFixture()` e depois `window.vp.saveShow(updatedShow)` diretamente. Isso mistura fluxo de estado do store com persistencia direta.

### `src/screens/SceneEditor.jsx`

Estado:

- Editor de cena por fixture e canal.
- Aplica preview ao vivo.
- Salva via `updateScene`.
- Cancela com blackout.

Problemas:

- Nao esta roteado em `App.jsx`.
- Estilo visual parece anterior ao tema atual.
- Usa `currentPageData`, entao pode editar cena errada se `pageId` divergir da pagina corrente.
- Ao salvar nao persiste imediatamente no disco, apenas atualiza memoria/store via `updateScene`.
- Cancela sempre com blackout, o que pode apagar estado que existia antes de abrir.

### `src/theme.js`

Centraliza paleta, tipografia, espacamento, bordas e componentes.

Estado:

- Existe e e importado em telas.
- Varias telas ainda usam cores hardcoded, entao o tema nao e fonte unica de verdade.
- Paleta atual e azul/cinza/verde, divergindo da regra antiga de preto/cinza/branco descrita na skill/README.

### `shows/vp.show.json`

Estado atual:

- `version`: `1.0`.
- `meta`: nome e notas.
- `fixtures`: 1 fixture, `parLed1`, canais 1-8.
- `pages`: somente pagina `"1"`, com cena `A`.
- `scripts`: F1-F6 associados.

Implicacoes:

- Troca para pagina 2+ mostra pagina sem cenas porque elas nao existem no JSON.
- Scripts estao associados a arquivos absolutos em `C:\vp-light\scripts`.
- F1, F4 e F6 usam o mesmo script `louvorzao-branco-fogo`.

### `scripts/*.js`

Contrato esperado:

- `OnStart()`
- `OnExecute()`
- `OnTerminate()`
- API disponivel: `SetChannel(canal, valor)`

Scripts atuais:

- `altar-roxo-profundo.js`: fade de entrada para roxo.
- `f1-color-pingpong.js`: fade RGBW ping-pong com strobo.
- `louvorzao-branco-fogo.js`: branco com strobo hardware.
- `rgb-loop.js`: alterna RGB a cada 3s.
- `vermelho-vivo.js`: vermelho com pulso no dimmer.
- `teste-02.js`: template vazio.
- `sync-scripts.js`: utilitario interativo para associar scripts ao show.

Pontos de atencao:

- Scripts assumem hardcoded o patch do `parLed1`.
- Comentario em `f1-color-pingpong.js` cita `shows/vida-e-paz.show.json`, mas o show atual e `shows/vp.show.json`.
- Scripts sao executados com `new Function()`, sem sandbox real alem da funcao injetada.
- `OnTerminate()` chama `SetChannel`, mas se o canal esta bloqueado por cena ativa, o proprio `SetChannel` do main pode ignorar a escrita.

## 3. Contratos IPC atuais

### Engine

| Renderer | Canal IPC | Retorno |
|---|---|---|
| `window.vp.startEngine()` | `engine:start` | `{ running: true }` |
| `window.vp.stopEngine()` | `engine:stop` | `{ running: false }` |
| `window.vp.getEngineStatus()` | `engine:status` | `{ running, frames }` |

### DMX

| Renderer | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `activateScene(channels)` | `dmx:activateScene` | `{ [canal]: valor }` | `{ ok: true }` |
| `setChannel(channel, value)` | `dmx:setChannel` | `number, number` | `{ ok: true }` |
| `blackout()` | `dmx:blackout` | - | `{ ok: true }` |
| `restoreState(channels)` | `dmx:restoreState` | `{ [canal]: valor }` | `{ ok: true }` |
| `getUniverse()` | `dmx:getUniverse` | - | `{ [canal]: valor }` apenas > 0 |
| `setActiveScenes(scenesMap)` | `dmx:setActiveScenes` | `{ [id]: { name, channels } }` | `{ ok: true }` |
| `getConflicts()` | `dmx:getConflicts` | - | lista de conflitos |
| `setActiveSceneChannels(channels)` | `dmx:setActiveSceneChannels` | `{ [canal]: valor }` | `{ ok: true }` |

### Show

| Renderer | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `loadShow(filePath)` | `show:load` | path opcional | `{ ok, show, path }` ou erro |
| `saveShow(showData)` | `show:save` | show completo | `{ ok, message }` ou erro |
| `saveShowAs(showData)` | `show:saveAs` | show completo | `{ ok, path }` ou erro |
| `getShow()` | `show:get` | - | `{ ok: true, show }` |
| `updateScene(pageId, sceneKey, sceneData)` | `show:updateScene` | page, key, scene | `{ ok }` ou erro |

### Scripts

| Renderer | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `listScripts()` | `script:list` | - | `{ ok, files }` |
| `createScript(fkey, name, options)` | `script:create` | F-key, nome, opcoes | `{ ok, name, file }` |
| `editScript(fkey, filePath)` | `script:edit` | F-key e path opcional | `{ ok, file }` ou erro |
| `clearScript(fkey)` | `script:clear` | F-key | `{ ok: true }` |
| `toggleScript(fkey)` | `script:toggle` | F-key | `{ ok, running }` ou erro |
| `getAllScripts()` | `script:getAll` | - | `{ [fkey]: { name, file, running } }` |

## 4. Estrutura do `show.json`

Formato observado:

```json
{
  "version": "1.0",
  "meta": {
    "name": "Vida e Paz - Show Principal",
    "createdAt": "2025-01-01",
    "notes": "Show base para o Fire. Salvar antes de sair!"
  },
  "fixtures": [
    {
      "id": "fixture_1780805067518",
      "name": "parLed1",
      "startChannel": 1,
      "channelCount": 8,
      "channels": ["dimmer", "strobo", "", "", "red", "green", "blue", "white"],
      "posX": 338,
      "posY": 357
    }
  ],
  "pages": {
    "1": {
      "name": "LOUVOR",
      "scenes": {
        "A": {
          "name": "roxo",
          "color": "#aa00aa",
          "channels": {
            "1": 255,
            "5": 255,
            "7": 255
          }
        }
      }
    }
  },
  "scripts": {
    "F1": {
      "name": "louvorzao-branco-fogo",
      "file": "C:\\vp-light\\scripts\\louvorzao-branco-fogo.js"
    }
  }
}
```

Contrato implicito:

- `fixtures[].startChannel` e 1-based.
- Canal real de um parametro: `startChannel + indice`.
- `pages` e um objeto indexado por string numerica.
- `scenes` e um objeto indexado por tecla de cena.
- `scene.channels` e mapa `{ "canal": valor }`, normalmente apenas valores > 0.
- `scripts` e um objeto indexado por `F1` a `F12`.

Campos usados parcialmente:

- `manufacturer`, `model`, `fixtureType`, `universe`, `group`, `par`, `rdm`, `note` sao lidos em `FixturePanel`, mas nao sao editados pelo `FixtureEditor`.

## 5. Ciclo de vida do engine DMX

1. Electron fica pronto.
2. `main.js` cria a janela.
3. `main.js` carrega `shows/vp.show.json`.
4. `loadScriptMeta()` popula `scriptMeta`.
5. `engine.start()` inicia intervalo de 40ms.
6. A cada tick:
   - `engine.js` pega referencia do universo via `getUniverse()`.
   - `artnet.js` copia os 512 bytes para o pacote ArtDMX.
   - pacote e enviado por UDP broadcast.
7. Ao fechar janela:
   - scripts em execucao recebem `OnTerminate()`.
   - engine para.
   - socket UDP fecha.

Observacao importante: scripts tambem usam intervalo proprio de 40ms. Portanto ha pelo menos dois loops: envio Art-Net e execucao de cada script ativo.

## 6. Modelo de estado do renderer

Estado global (`showStore`):

- show carregado.
- pagina atual.
- fixture selecionado.
- estado loading.
- activeScene singular antigo.

Estado local da tela principal:

- cenas ativas multiplas.
- blackout ativo.
- valores de fader ao vivo.
- scripts carregados/rodando.
- modais e menus.
- conflitos.
- painel direito.
- selecao/drag de fixtures.

Consequencia: a fonte de verdade esta dividida. O show fica no store, mas o estado operacional do palco fica quase todo dentro de `Main.jsx`.

## 7. Pontos de sincronizacao main/renderer

Pontos atuais:

- Carregamento inicial: main carrega show; renderer chama `getShow()`.
- Salvar: renderer manda show completo; main mescla scripts e paginas.
- Cenas: renderer chama `activateScene`, `restoreState`, `setActiveSceneChannels` e `setActiveScenes`.
- Conflitos: renderer envia cenas ativas; main calcula; renderer faz polling.
- Scripts: main guarda `scriptMeta` e `runningScripts`; renderer consulta `getAllScripts`.
- Universo: main guarda DMX real; renderer consulta snapshot apenas no painel de teste.

Riscos:

- Main nao sabe sozinho quais cenas estao ativas; depende do renderer.
- Renderer nao sabe sozinho quais scripts ainda estao vivos se um script cair por erro no main; so atualiza quando o usuario interage.
- Universo real pode divergir de `liveValues`.
- `activeSceneChannels` pode ficar desatualizado ao trocar show/pagina/blackout.

## 8. Bugs e comportamentos inconsistentes

1. Blackout nao encerra scripts ativos.
2. `restoreState` nao zera canais antigos.
3. `setActiveScenes` acumula cenas antigas.
4. Paginas podem ser navegadas sem existir no show.
5. Troca de pagina nao reseta cenas ativas locais.
6. `activeScene` singular no store conflita com `activeScenes` local.
7. `SceneEditor.jsx` existe mas nao esta conectado.
8. Duplicar fixture duplica endereco DMX.
9. Novo fixture sempre nasce no canal 1.
10. Editor de fixture nao valida faixa 1-512 nem sobreposicao.
11. Campos exibidos no painel de fixtures nao sao editaveis.
12. Scripts usam canais hardcoded e podem quebrar com mudanca de patch.
13. `sync-scripts.js` altera `show.json` fora do aplicativo, enquanto o app tambem mantem show em memoria.
14. README e comentarios citam detalhes antigos (`vida-e-paz.show.json`, atalhos A-M) que nao batem totalmente com o estado atual.
15. `electron-builder` falha no ambiente atual por symlink de `winCodeSign`.

## 9. Pontas soltas por fluxo

### Paginas

- Ha botao `PgUp`/`PgDw`.
- Ha `currentPage`.
- Ha cenas por pagina no JSON.
- Falta criar, nomear, remover e persistir pagina vazia.
- Falta resetar estado operacional ao trocar pagina.

### Cenas

- Ativar/desativar funciona em nivel UI.
- Salvar cena existe via menu de contexto.
- Limpar cena existe.
- Falta composicao completa de universo.
- Falta limpar canais que sairam do estado.
- Falta definir prioridade clara entre cena, fader manual e script.

### Scripts

- Criar, editar, listar, mover, limpar e tocar/parar existem.
- Falta matar scripts no blackout.
- Falta notificar renderer quando script para por erro.
- Falta associar script existente preservando path de forma inequivoca.
- Falta sandbox/limites de execucao.

### Fixtures

- CRUD basico existe.
- Posicionamento existe.
- Faders por fixture existem.
- Falta patch seguro.
- Falta cadastro completo de fabricante/modelo/universo/grupo.

### Build/producao

- Renderer compila.
- Empacotamento falha por permissao de symlink.
- App nao tem icone.
- Build inclui `electron/**/*` e `dist/**/*`, mas nao inclui explicitamente `shows/**/*` nem `scripts/**/*`. Em app empacotado, o show padrao e scripts podem nao estar presentes conforme esperado.

## 10. Prioridades tecnicas recomendadas

Sem corrigir nesta auditoria, mas para organizar desenvolvimento:

1. Definir fonte de verdade para estado operacional: cenas ativas, blackout, scripts e universo.
2. Implementar substituicao completa do universo ao restaurar estado.
3. Fazer blackout parar scripts e limpar estados relacionados.
4. Corrigir `setActiveScenes` para substituir o mapa, nao acumular.
5. Formalizar paginas: criar, persistir, navegar e resetar estado por pagina.
6. Consolidar `activeScenes` no store.
7. Validar patch de fixtures.
8. Conectar ou remover `SceneEditor.jsx`.
9. Revisar build para incluir `shows` e `scripts`.
10. Atualizar README/AGENTS/CLAUDE para refletir estado real.
