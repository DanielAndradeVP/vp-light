# README_SKILL — Fonte da verdade estrutural do vp-light

> **Para que serve este arquivo**
> Este é o retrato **estrutural** atual do projeto vp-light. Ele NÃO lista bugs nem
> problemas — descreve apenas como o sistema é montado: pastas, contratos, modelo de
> dados, protocolos e convenções.
>
> Ele tem dois leitores:
> 1. **O desenvolvedor** (humano), que atualiza este arquivo sempre que cria algo novo,
>    corrige um bug que mudou estrutura, adiciona um equipamento ou muda um contrato.
> 2. **A skill `fiscal-do-sistema`** (agente), que lê este arquivo após mudanças no código
>    e mantém `README.md` e este documento sincronizados.
>
> **Regra de ouro:** se uma informação aqui mudar, qualquer skill que repita essa
> informação precisa ser revisada. Este arquivo é o que vence em caso de divergência.

---

## 0. Como manter este arquivo

- Atualize a seção relevante **e** registre a mudança em [§13 Histórico](#13-historico-de-mudancas).
- Suba o número em [§ Versão do documento](#versao-do-documento) a cada alteração estrutural.
- Mantenha factual e estrutural. Nada de "isso está quebrado" — isso vai em auditoria, não aqui.
- Se adicionar/renomear contrato IPC, fixture, script, tela ou token de cor: reflita aqui.

### Versão do documento

| Campo | Valor |
|---|---|
| Versão | 1.3 |
| Última atualização | 2026-06-28 |
| Base | Estado real do código (jun/2026) |

---

## 1. Identidade do projeto

| Item | Valor |
|---|---|
| Nome | vp-light |
| Para | Igreja Vida e Paz |
| Função | Software DMX desktop para controle de iluminação cênica ao vivo |
| Evento alvo | Fire (congresso) |
| Referência de comportamento | Lumikit SHOW |
| Interface física | SL3000 (Sourlight), padrão Enttec Open DMX, USB → DMX512 |
| Universos | 1 universo, 512 canais |

---

## 2. Stack e versões

| Camada | Tecnologia |
|---|---|
| Desktop | Electron `^33` |
| Renderer | React `^18` + Vite `^5` |
| Main process | Node.js (engine DMX) |
| Build | electron-builder `^24` (target Windows `nsis`) |
| Estado renderer | React Context (sem libs externas de estado) |
| Empacotamento | `appId: br.vidaepaz.vplight`, `productName: vp-light` |

Scripts npm:

- `npm run dev` → Vite na porta 5173 + Electron (concurrently + wait-on).
- `npm run start` → abre Electron direto.
- `npm run build` → `vite build` + `electron-builder`.

Regra de hot reload:

- `src/**` → hot reload automático (Vite). Não precisa reiniciar.
- `electron/**` → **precisa reiniciar `npm run dev`**.

---

## 3. Estrutura de pastas (real)

```
C:\vp-light\
├── electron/
│   ├── main.js          → IPC handlers, inicia engine, carrega show, executa scripts
│   ├── preload.js       → expõe window.vp.* (contextBridge)
│   ├── show.js          → lê/salva o .show.json, mantém show em memória
│   ├── fixtureOffsets.js→ offsets pan/tilt por fixture (calibração física)
│   └── engine/
│       ├── engine.js    → loop setInterval 40ms (start/stop), compositor + envio Art-Net
│       ├── compositor.js→ composição por camadas, guards, envelopes e macros
│       ├── universe.js  → Uint8Array(512), estado dos canais DMX (+ offsets pan/tilt)
│       ├── artnet.js    → ArtDMX: loopback + broadcast por interface + fallback global
│       └── interpolator.js → interpolação de movimento (pan/tilt)
├── src/
│   ├── App.jsx          → roteador: main | fixtures | painel
│   ├── main.jsx         → entry point React
│   ├── theme.js         → tokens visuais (cores, tipografia, espaçamento)
│   ├── store/
│   │   └── showStore.js → estado global do renderer (React Context)
│   ├── screens/
│   │   ├── Main.jsx         → mesa principal (fixtures, faders, cenas, scripts, páginas)
│   │   ├── PainelOperacao.jsx → tela ao vivo: macros, scripts rápidos, cenas
│   │   ├── Viewer3D.jsx     → janela 3D (aberta via IPC; consome dmx-universe)
│   │   ├── FixturePanel.jsx → tabela/CRUD de aparelhos
│   │   ├── FixtureEditor.jsx→ modal de edição de fixture
│   │   └── SceneEditor.jsx  → editor de cena (existe no código, não roteado no App.jsx)
│   └── viewer3d/        → cena Three.js e modelos por tipo de fixture
├── scripts/             → arquivos .js dos efeitos DMX (um por nome) + sync-scripts.js
├── banco-de-conhecimento/ → notas .md por grupo de aparelho para injeção em scripts novos
├── shows/
│   ├── vp.show.json     → show padrão carregado na inicialização
│   └── fixture_template.json → modelo do fluxo "Criar novo aparelho (AI)"
├── .agents/skills/      → skills ativas dos agentes
├── skills-desabilitadas/→ skills arquivadas (fora do runtime)
├── docs/                → auditorias
├── index.html
├── vite.config.js
└── package.json
```

> **Nome do arquivo de show:** é `shows/vp.show.json`. (Nomes antigos como
> `vida-e-paz.show.json` não são mais usados.)

---

## 4. Regras de arquitetura — invioláveis

- **Engine DMX roda APENAS no main process** (`electron/engine/`). Nunca no renderer.
- **Renderer comunica com o main APENAS via `window.vp.*`** (definido em `preload.js`). O renderer nunca toca hardware/UDP/filesystem direto.
- Alterações visuais → `src/screens/` e `src/theme.js`.
- Estado global do renderer → `src/store/showStore.js`.
- IPC, engine ou scripts → `electron/` (requer reiniciar `npm run dev`).
- Nunca adicionar dependências externas sem ser solicitado.

---

## 5. Fluxo de dados

```
Usuário interage → React (src/screens/)
  → window.vp.* (electron/preload.js)
    → ipcMain handlers (electron/main.js)
      → universe.js / compositor.js
        → engine.js  (loop 40ms: renderFrame + sendArtDMX)
          → artnet.js → UDP (loopback + broadcast por interface) → SL3000 → DMX512 → fixture
```

---

## 6. Engine DMX

| Item | Valor |
|---|---|
| Loop | `setInterval` de **40ms** (≈ **25 fps**) em `engine.js` |
| Estado | `universe.js` mantém `Uint8Array(512)` |
| Composição de scripts | `compositor.js` executa camadas e escreve o resultado no universo |
| Canal público | 1-based (canal 1 → índice 0 interno) |
| Faixa de valor | 0–255 (normalizado) |
| Snapshot | `getUniverse()` retorna apenas canais com valor > 0 |
| Protocolo | Art-Net (ArtDMX) sobre UDP |
| Porta | `6454` |
| Universo Art-Net | fixo em `0` |
| Pacote | header ArtDMX + 512 bytes do universo |
| Envio loopback | `127.0.0.1:6454` — viewer 3D e receptor local |
| Envio por interface | um socket UDP por interface IPv4 ativa, broadcast dirigido da sub-rede |
| Fallback global | `255.255.255.255` se nenhuma interface disponível |
| Refresh interfaces | reenumera a cada **10s** (`IFACE_REFRESH_MS`) |
| Freeze | `artnet:setFrozen` suprime envio para rede real; loopback continua |

> **Importante (estrutura de loops):** existe um relógio principal de 40ms em `engine.js`.
> A cada frame ele chama `compositor.renderFrame()` e depois `sendArtDMX(getUniverse())`.
> Scripts de efeito não criam `setInterval` próprio para renderização.

### Compositor de scripts

| Item | Valor |
|---|---|
| Arquivo | `electron/engine/compositor.js` |
| Unidade de execução | camada identificada por `F1`, `page:<pageId>:<sceneKey>` ou `macro:<id>:<step>:<seq>` |
| Buffer por camada | `Uint8Array(512)` para valores + `Uint8Array(512)` para máscara `touched` |
| Tick de script | `OnExecute` chamado dentro de `renderFrame()` |
| Merge padrão | `htp` (maior valor ponderado por canal) |
| Merge alternativo | `linear` (soma ponderada com clamp 255) |
| Guards | fixture desabilitado + canais travados por cena ativa aplicados na composição |
| Escrita final | `universe.setChannel()` chamado pelo compositor após merge |

Macros no compositor:

- Criadas em memória por `createMacro(id, steps, options)`.
- Passo: `{ makeLayer, durationFrames, fadeInFrames, fadeOutFrames, overlapFrames }`.
- `durationFrames: Infinity` avança só por trigger manual (`triggerNextStep`).
- `fadeInFrames`, `fadeOutFrames` e `overlapFrames` são contados em frames de 40ms.
- `startMacro` ativa o primeiro passo; `stopMacro` encerra camadas da macro; `removeMacro` para e remove.
- `stopAllMacros()` é chamado junto de blackout/shutdown via `stopAllRunningScripts`.

---

## 7. Contratos IPC (estado atual)

> Estas tabelas são o contrato real. `window.vp.<fn>` (renderer) → canal `ipcMain`.
> Uma skill que cite nomes/assinaturas diferentes destes está desatualizada.

### `window.vp.*` — superfície completa exposta no preload

```
// Window
closeApp()  onWindowCloseRequested(callback)

// Visualizador 3D
open3DViewer()  onViewer3DClosed(callback)  onDmxUniverse(callback)

// Engine
startEngine()  stopEngine()  getEngineStatus()

// DMX
activateScene(channels)  setChannel(channel, value)  setChannelRange(channels, value)
blackout()  restoreState(channels)  getUniverse()  getConflicts()
setActiveSceneChannels(channels, parLedChs?)  setActiveScenes(scenesMap)
setFixtureSpeed(fixtureId, value)  setMovingHeadSpeed(...)  setRibaltaSpeed(...)

// Art-Net (renderer)
setArtNetFrozen(frozen)

// Show
loadShow(filePath)  saveShow(showData)  saveShowAs(showData)
getShow()  updateScene(pageId, sceneKey, sceneData)

// Scripts
listScripts()  createScript(fkey, name, options)  editScript(fkey, filePath)
clearScript(fkey)  toggleScript(fkey)  getAllScripts()  stopAllScripts()
onScriptsChanged(callback)

// Page scripts
createPageScript(pageId, sceneKey, name)  editPageScript(pageId, sceneKey)
clearPageScript(pageId, sceneKey)  togglePageScript(pageId, sceneKey)
getAllPageScripts(pageId)

// Macros
createMacro(id, def)  updateMacro(id, def)  startMacro(id)  stopMacro(id)
nextMacroStep(id)  removeMacro(id)  macroList()  macroStatus()

// Fixtures
openFixtureTemplate()
```

> **Main-only (não exposto no preload):** `artnet:getInterfaces` → `artnet.getActiveInterfaces()`.

### Window

| `window.vp` | Canal IPC | Entrada | Retorno/evento |
|---|---|---|---|
| `closeApp()` | `window:closeApp` | — | `{ ok }` |
| `onWindowCloseRequested(callback)` | evento `window:close-requested` | callback | unsubscribe function |

### Visualizador 3D

| `window.vp` | Canal IPC / evento | Entrada | Retorno/evento |
|---|---|---|---|
| `open3DViewer()` | `window:open3DViewer` | — | `{ ok }` |
| `onViewer3DClosed(callback)` | evento `viewer3d:closed` | callback | unsubscribe function |
| `onDmxUniverse(callback)` | evento `dmx-universe` | callback(channels) | unsubscribe function |

Janela separada carrega `Viewer3D.jsx`; main envia snapshot do universo a cada frame via `dmx-universe`.

### Engine

| `window.vp` | Canal IPC | Retorno |
|---|---|---|
| `startEngine()` | `engine:start` | `{ running: true }` |
| `stopEngine()` | `engine:stop` | `{ running: false }` |
| `getEngineStatus()` | `engine:status` | `{ running, frames }` |

### DMX

| `window.vp` | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `activateScene(channels)` | `dmx:activateScene` | `{ [canal]: valor }` | `{ ok: true }` |
| `setChannel(channel, value)` | `dmx:setChannel` | `number, number` | `{ ok: true }` |
| `setChannelRange(channels, value)` | `dmx:setChannelRange` | `number[], number` | `{ ok, count }` |
| `setFixtureSpeed(fixtureId, value)` | `custom:speed` | id, 0–255 | `{ ok }` |
| `setMovingHeadSpeed(fixtureId, value)` | `custom:speed` | id, 0–255 | `{ ok }` |
| `setRibaltaSpeed(fixtureId, value)` | `custom:speed` | id, 0–255 | `{ ok }` |
| `blackout()` | `dmx:blackout` | — | `{ ok: true }` |
| `restoreState(channels)` | `dmx:restoreState` | `{ [canal]: valor }` | `{ ok: true }` |
| `setActiveSceneChannels(channels, parLedChs?)` | `dmx:setActiveSceneChannels` | mapa, array opcional | `{ ok: true }` |
| `setActiveScenes(scenesMap)` | `dmx:setActiveScenes` | `{ [id]: { name, channels } }` | `{ ok: true }` |
| `getConflicts()` | `dmx:getConflicts` | — | lista de conflitos |
| `getUniverse()` | `dmx:getUniverse` | — | `{ [canal]: valor }` (apenas > 0) |

### Art-Net (renderer)

| `window.vp` | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `setArtNetFrozen(frozen)` | `artnet:setFrozen` | `boolean` | `{ ok, frozen }` |

### Show

| `window.vp` | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `loadShow(filePath)` | `show:load` | path opcional | `{ ok, show, path }` |
| `saveShow(showData)` | `show:save` | show completo | `{ ok, message }` |
| `saveShowAs(showData)` | `show:saveAs` | show completo | `{ ok, path }` |
| `getShow()` | `show:get` | — | `{ ok: true, show }` |
| `updateScene(pageId, sceneKey, sceneData)` | `show:updateScene` | page, key, scene | `{ ok }` |

### Scripts

| `window.vp` | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `listScripts()` | `script:list` | — | `{ ok, files }` |
| `createScript(fkey, name, options)` | `script:create` | F-key, nome, opções | `{ ok, name, file }` |
| `editScript(fkey, filePath)` | `script:edit` | F-key, path opcional | `{ ok, file }` |
| `clearScript(fkey)` | `script:clear` | F-key | `{ ok: true }` |
| `toggleScript(fkey)` | `script:toggle` | F-key | `{ ok, running }` |
| `getAllScripts()` | `script:getAll` | — | `{ [fkey]: { name, file, running } }` |
| `stopAllScripts()` | `script:stopAll` | — | `{ ok }` |
| `onScriptsChanged(callback)` | evento `scripts:changed` | callback | unsubscribe function |

> **Identificador de script é a F-key** (`"F1"`…`"F12"`), não o nome do arquivo.

`script:create(fkey, name, options)`:

- `options.groups?: string[]` injeta, como comentários, os arquivos `.md` correspondentes de `banco-de-conhecimento/`.
- Se `groups.length > 0`, o arquivo do script é reescrito para garantir a injeção do banco.
- Sem grupos, o arquivo só é criado se ainda não existir.
- `options.skipOpenEditor === true` evita abrir o editor externo.

### Page scripts

| `window.vp` | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `createPageScript(pageId, sceneKey, name)` | `page_script:create` | page, tecla, nome | `{ ok, name, file }` |
| `editPageScript(pageId, sceneKey)` | `page_script:edit` | page, tecla | `{ ok, file }` |
| `clearPageScript(pageId, sceneKey)` | `page_script:clear` | page, tecla | `{ ok: true }` |
| `togglePageScript(pageId, sceneKey)` | `page_script:toggle` | page, tecla | `{ ok, running }` |
| `getAllPageScripts(pageId)` | `page_script:getAll` | page | `{ [sceneKey]: { name, file, running } }` |

### Macros

| `window.vp` | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `createMacro(id, def)` | `macro:create` | id, definição | `{ ok, steps }` ou `{ ok:false, error }` |
| `updateMacro(id, def)` | `macro:update` | id, definição | `{ ok, steps }` ou `{ ok:false, error }` |
| `startMacro(id)` | `macro:start` | id | `{ ok }` |
| `stopMacro(id)` | `macro:stop` | id | `{ ok }` |
| `nextMacroStep(id)` | `macro:next` | id | `{ ok }` |
| `removeMacro(id)` | `macro:remove` | id | `{ ok }` |
| `macroList()` | `macro:list` | — | `MacroDef[]` |
| `macroStatus()` | `macro:status` | — | status da macro ativa |

`macro:create` / `macro:update` aceitam:

```js
{
  name: "Nome exibido",
  steps: [
    { script, durationMs, fadeInMs, fadeOutMs, overlapMs }
  ],
  mergeMode: "htp" | "linear",
  loop: boolean
}
```

- `steps[].script` (ou `name`) resolve `C:\vp-light\scripts\<script>.js`.
- `durationMs == null` ou `"infinite"` vira passo manual até `nextMacroStep`.
- Tempos são convertidos para frames de 40ms no main.
- Definições persistem em `show.json` → `macros[]` via `saveMacros()` no main.

### Fixtures

| `window.vp` | Canal IPC | Entrada | Retorno |
|---|---|---|---|
| `openFixtureTemplate()` | `fixture:openTemplate` | — | `{ ok, file }` |

---

## 8. Modelo de dados — `.show.json`

Blocos de topo: `version`, `meta`, `fixtures`, `pages`, `page_scripts`, `scripts`, `macros`.

```json
{
  "version": "1.0",
  "meta": {
    "name": "Vida e Paz — Show Principal",
    "createdAt": "2025-01-01",
    "notes": "Show base para o Fire. Salvar antes de sair!",
    "viewport": {
      "grid": { "zoom": 1, "panX": 0, "panY": 0 }
    }
  },
  "fixtures": [
    {
      "id": "fixture_1780805067518",
      "name": "parLed1",
      "startChannel": 1,
      "channelCount": 8,
      "channels": ["dimmer", "strobo", "", "", "red", "green", "blue", "white"],
      "posX": 338,
      "posY": 357,
      "panOffset": 0,
      "tiltOffset": 0,
      "enabled": true
    }
  ],
  "pages": {
    "1": {
      "name": "LOUVOR",
      "scenes": {
        "A": { "name": "roxo", "color": "#aa00aa", "channels": { "1": 255, "5": 255, "7": 255 } }
      }
    }
  },
  "page_scripts": {
    "1": {
      "A": { "name": "script-da-cena-a", "file": "C:\\vp-light\\scripts\\script-da-cena-a.js" }
    }
  },
  "scripts": {
    "F1": { "name": "louvorzao-branco-fogo", "file": "C:\\vp-light\\scripts\\louvorzao-branco-fogo.js" }
  },
  "macros": [
    {
      "id": "macro-louvor",
      "name": "Macro Louvor",
      "mergeMode": "htp",
      "loop": false,
      "steps": [
        {
          "script": "louvorzao-branco-fogo",
          "durationMs": 2000,
          "fadeInMs": 400,
          "fadeOutMs": 400,
          "overlapMs": 200
        }
      ]
    }
  ]
}
```

Contrato implícito:

- `fixtures[].startChannel` é **1-based**.
- Canal real de um parâmetro = `startChannel + índice no array channels`.
- `channels` (do fixture) é um array de **aliases**; posição com `""` = canal sem função definida.
- `pages` é objeto indexado por string numérica (`"1"`, `"2"`…).
- `scenes` é objeto indexado por tecla de cena (ver §9).
- `scene.channels` é mapa `{ "canal": valor }`, normalmente só valores > 0.
- `page_scripts` é objeto `{ [pageId]: { [sceneKey]: { name, file } } }`.
- `scripts` é objeto indexado por F-key (`"F1"`…`"F12"`), com `{ name, file, color? }`.
- `macros` é array de definições `{ id, name, mergeMode, loop, steps[] }`; persistido pelo main em `show:save`.
- `meta.viewport.grid` persiste zoom e pan da mesa (`zoom`, `panX`, `panY`).
- `fixtures[].panOffset` / `tiltOffset`: calibração física; universo grava `físico = lógico + offset` em aliases `pan`/`tilt`; renderer vê valores lógicos.
- Ao carregar metadados de script, o main resolve o arquivo por `name` relativo a `SCRIPTS_DIR`; caminho absoluto salvo em `file` não é fonte de verdade portátil.
- Em `show:save`, `scriptMeta` do main é a única fonte de verdade de `scripts`; entradas removidas por `script:clear` não são herdadas do disco/renderer.
- Em `show.js`, `scripts` só é preservado do `currentShow` quando `showData.scripts == null`; `scripts: {}` é estado legítimo após limpar todos.
- `page_scripts` é mesclado a partir do show atual, renderer e `pageScriptMeta`, com `pageScriptMeta` vencendo em runtime.
- Fixture com `enabled: false` permanece no show, mas seus canais são ignorados em validação de overlap ativo e bloqueados nos caminhos DMX/script quando não houver fixture habilitado cobrindo o mesmo canal.

Campos de fixture lidos mas opcionais (presentes no painel): `manufacturer`, `model`,
`fixtureType`, `universe`, `group`, `par`, `rdm`, `note`, `observation`, `enabled`,
`panOffset`, `tiltOffset`, `virtualPanTiltSpeed`.

---

## 9. Sistema de cenas e páginas

- **Teclas de cena (SCENE_KEYS)** — ordem real definida em `Main.jsx`:
  `['A','S','D','F','G','H','J','K','L','Z','X','C','V']`
  (linha do meio + início da linha de baixo do teclado). **Não é A–M alfabético.**
- Cenas pertencem a uma **página**; a navegação de páginas é por `PgUp`/`PgDw`.
- Cada cena guarda `{ name, color, channels }`, onde `channels = { "canalNum": valor }`.
- Operações de cena na UI: ativar/desativar (toggle), salvar (modal nome + cor), limpar.

---

## 10. Scripts de efeito

| Item | Valor |
|---|---|
| Local | `C:\vp-light\scripts\*.js` (um arquivo por script) |
| Execução | `new Function()` no **main process** |
| Tick | `OnExecute` chamado pelo `compositor.renderFrame()` no loop único de 40ms |
| Saída | `SetChannel` escreve no buffer da camada, não direto no `universe` |
| Vínculo global | botões/teclas **F1–F12** |
| Vínculo por página | `page_scripts[pageId][sceneKey]` |
| Lifecycle | `OnTerminate` é chamado ao desativar, ao limpar/toggle ou no blackout |
| Edição | abre o arquivo em editor externo (VS Code) via processo do main |

Contrato obrigatório de cada script:

```js
function OnStart()     { }   // chamado 1x ao ativar
function OnExecute()   { }   // chamado a cada 40ms
function OnTerminate() { }   // chamado ao desativar
```

APIs injetadas disponíveis dentro do script:

- `SetChannel(canal, valor)` → marca canal no buffer da camada (`buffer` + `touched`).
- `getChannel(fixtureId, alias)` → resolve canal DMX real pelo alias normalizado do fixture.

Prioridade/guards:

- Canais bloqueados por cena ativa são informados ao main via `setActiveSceneChannels`.
- O main repassa esse mapa ao compositor por `compositor.setSceneLock(activeSceneChannels)`.
- Fixtures `enabled:false` são consultadas por provider injetado em `compositor.setDisabledChannelsProvider`.
- Guards são aplicados pelo compositor sobre o resultado mesclado, não dentro de cada script.

Criação de script com banco de conhecimento:

- `src/screens/Main.jsx` oferece grupos: `par-led`, `ribalta`, `moving`, `brut`, `fita-led`.
- `script:create` recebe `options.groups` e injeta o conteúdo de `banco-de-conhecimento/<grupo>.md` como comentários no topo.
- Seleção individual de fixture ativa o grupo correspondente para fins de injeção.
- Arquivos atualmente esperados em `banco-de-conhecimento/`: `par-led.md`, `ribalta.md`, `moving.md`, `brut.md`, `fita-led.md`.

Utilitário: `scripts/sync-scripts.js` é uma ferramenta de terminal que associa scripts
da pasta às F-keys, escrevendo direto no `shows/vp.show.json`.

Macros:

- Macro é um sequenciador backend de scripts existentes.
- Cada passo referencia `script` (nome do arquivo em `scripts/`) e é compilado em camada no disparo.
- Crossfade é feito por envelope de peso (`fadeInFrames`/`fadeOutFrames`) e `overlapFrames`.
- `mergeMode` pode ser `htp` ou `linear`.
- UI principal de macros: `PainelOperacao.jsx`; contrato IPC completo em §7.

---

## 11. Fixtures e telas (comportamento)

- Aparecem como blocos arrastáveis em `Main.jsx`; posição salva em `posX`/`posY`.
- Rubber-band selection: arrastar área seleciona múltiplos; clicar no vazio desmarca.
- Painel direito de `Main.jsx` (**Descrição**): faders ao vivo da fixture selecionada; funções personalizadas por tipo.
- CRUD de fixtures em `FixturePanel.jsx` (novo, editar, remover, duplicar) + `FixtureEditor.jsx`.
- `PainelOperacao.jsx`: operação ao vivo — macros, abas F-keys / page-scripts / cenas.
- `App.jsx` roteia `main` | `fixtures` | `painel`.

---

## 12. Design system — paleta atual

> A paleta **atual** é teal/verde-escuro (não é mais "preto/cinza/branco", nem azul).
> Fonte: `src/theme.js`. Tipografia base: `Arial, Helvetica, sans-serif`.

```
bg:            #26363c      surface:        #35484f
bgDark:        #1d2b30      surfaceAlt:     #2d3f45
bgDarker:      #000000      surfaceRaised:  #40545c
border:        #8db8b8      panel:          #35484f
borderSoft:    #5f8588      panelDark:      #24343a
text:          #ffffff      textSecondary:  #c8dddd
textMuted:     #9bb4b7      textDisabled:   #6f8588
primary:       #8db8b8      accent:         #00d000
active:        #00ff00      warn:           #ff3333
danger:        #cc2222      selection:      #4e6b73
buttonBg:      #000000      buttonSurface:  #233237      buttonHover: #30464d
```

`theme.js` também define `typography` e `spacing` (tokens `xxs`…`xl`).

---

## 13. Histórico de mudanças

> O desenvolvedor preenche aqui a cada nova feature, correção estrutural, equipamento
> ou mudança de contrato. Mais recente no topo.

- **2026-06-28** — Sincronizado com estado atual: Art-Net multi-interface + freeze, viewer 3D, PainelOperacao, macros completas (CRUD/list/status + persistência), offsets pan/tilt, remoção do ChatPanel, skills em `.agents/skills/` vs `skills-desabilitadas/`, IPC ampliado (stopAllScripts, custom:speed, setArtNetFrozen).
- **2026-06-13** — Atualizado para arquitetura de scripts por `compositor.js`: camadas, tick único da engine, macros/crossfade, IPC de macros, `page_scripts`, injeção de `banco-de-conhecimento` e regras de persistência de `scripts`.
- **2026-06-10** — Atualizado para documentar lifecycle de scripts: `OnTerminate` é chamado em clear/toggle/blackout.
- **2026-06-10** — Criação do README_SKILL.md a partir do estado real do código e das auditorias.

---

## 14. Checklist de validação de skill (uso do fiscal-de-skills ou auditoria manual)

Uma skill-alvo está **alinhada** quando bate com este README em:

1. Nome do arquivo de show (`vp.show.json`).
2. Estrutura de pastas e nomes de telas (Main, PainelOperacao, Viewer3D, FixturePanel, FixtureEditor, SceneEditor não roteado).
3. Contratos IPC: nomes, assinaturas e identificador por F-key (§7), incluindo viewer 3D, Art-Net freeze, macros CRUD/list/status, stopAllScripts, custom:speed.
4. Specs da engine e Art-Net: 40ms/25fps, loopback + broadcast por interface, porta 6454, universo 0, compositor por camadas, freeze (§6).
5. Modelo `show.json`: blocos `version/meta/fixtures/pages/page_scripts/scripts/macros`, `meta.viewport`, `enabled:false`, offsets pan/tilt e contrato de canais (§8).
6. SCENE_KEYS `ASDFGHJKLZXCV` (não A–M) (§9).
7. Contrato de scripts: `OnStart/OnExecute/OnTerminate` + `SetChannel` em buffer de camada + `getChannel` (§10).
8. Paleta atual teal/verde do `theme.js` (§12).
9. Skills ativas só em `.agents/skills/`; arquivadas em `skills-desabilitadas/` (§3).
