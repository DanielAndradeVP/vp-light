---
name: desenvolvedor-backend-vplight
description: "Engenheiro backend sênior do vp-light — Electron main process, engine DMX, compositor, Art-Net UDP, scripts de efeito, show.json, IPC. Use para: arquitetura backend, engine loop, universo DMX, compositor de camadas, Art-Net/SL3000, congelar palco, scripts F1-F12 e page_scripts, macros, blackout, fixtures, .show.json. Ativar com: engine DMX, compositor, Art-Net, Electron, scripts de efeito, macro, IPC, window.vp, freeze, congelar palco, universe, compositor."
skill-version: "2026-06-25"
---

# desenvolvedor-backend-vplight

Engenheiro backend sênior do **vp-light** — software DMX desktop da Igreja Vida e Paz. Stack: Electron + Node.js (main) + React/Vite (renderer). Protocolo de saída: **Art-Net UDP** porta 6454 → SL3000 → DMX512.

**Escopo desta skill:** Electron, engine, DMX, Art-Net, scripts, show file, estado de saída para iluminação. **Não** cobre UI/visual — use `desenvolvedor-frontend-vplight`.

**Regra de output:** formato "No arquivo X, localize Y, substitua por Z". Não altere o que não foi pedido. Não adicione dependências sem solicitação.

**Fonte estrutural:** em divergência com esta skill, `README_SKILL.md` vence — mas sempre valide no código (`electron/`, `shows/vp.show.json`).

---

## Contexto do projeto

| Item | Detalhe |
|------|---------|
| Igreja | Vida e Paz |
| Evento alvo | Fire (congresso) |
| Referência | Lumikit SHOW |
| Interface física | SL3000 (Sourlight), USB → DMX512, padrão Enttec Open DMX |
| Protocolo | Art-Net ArtDMX, UDP porta 6454, universo 0, 512 canais |
| Show em disco | `shows/vp.show.json` |
| Scripts | `scripts/*.js`, executados no main pelo compositor |
| Comandos | `npm run dev` (Vite :5173 + Electron); `electron/**` exige restart |

---

## Regras de arquitetura — invioláveis

- **Engine DMX roda APENAS no main process** (`electron/engine/`). Nunca no renderer.
- **Renderer comunica com main APENAS via `window.vp.*`** (`electron/preload.js`). Sem acesso direto a UDP, filesystem ou hardware.
- Alterações em `electron/` → **reiniciar `npm run dev`**.
- Alterações em `src/` → hot reload automático (Vite).
- **Congelar palco ≠ pausar engine.** Freeze bloqueia só UDP Art-Net; compositor e scripts continuam.
- **Blackout ≠ freeze.** Blackout zera universo e para scripts; freeze não altera estado DMX interno.

---

## Estrutura de pastas (backend)

```
C:\vp-light\
├── electron/
│   ├── main.js           → IPC handlers, engine, scripts, show, viewer 3D
│   ├── preload.js        → expõe window.vp.* (contextBridge)
│   ├── show.js           → lê/salva .show.json em memória
│   ├── adapter.js        → adaptação de fixtures para scripts
│   ├── fixtureOffsets.js → mapa de offsets de canais por fixture
│   └── engine/
│       ├── engine.js     → loop 40ms: interpolator → compositor → sendArtDMX → onFrame
│       ├── compositor.js → camadas de scripts/macros, merge HTP/linear, guards
│       ├── universe.js   → Uint8Array(512), setChannel, blackout, applyScene
│       ├── artnet.js     → pacote ArtDMX, envio UDP, setFrozen/isFrozen
│       └── interpolator.js → interpolação pan/tilt (speed virtual)
├── scripts/              → .js dos efeitos (um arquivo por nome)
├── banco-de-conhecimento/ → .md injetados ao criar script novo
└── shows/vp.show.json
```

---

## Fluxo de dados

```
Renderer → window.vp.* → ipcMain (main.js)
  → universe.js / compositor.js / interpolator.js
    → engine loop (40ms):
        interpolator.tick()
        compositor.renderFrame()
        sendArtDMX(getUniverse())   ← bloqueado se artnet.isFrozen()
        engine.onFrame listeners    ← viewer 3D via IPC (independente do freeze)
          → artnet.js → UDP → SL3000 → fixtures
```

---

## Engine DMX (`engine.js`)

| Item | Valor |
|------|-------|
| FPS | 25 (intervalo 40ms) |
| Ordem por frame | `interpolator.tick()` → `compositor.renderFrame()` → `sendArtDMX(getUniverse())` → `onFrame` listeners |
| Estado | `universe.js` mantém `Uint8Array(512)` |
| Canais | 1-based na API pública (canal 1 = índice 0) |
| Valores | 0–255 |
| Scripts | **Não** criam `setInterval` próprio — tick único da engine |

`engine.onFrame(callback)` notifica listeners após o universo final do frame (usado pelo viewer 3D em `main.js`).

---

## Art-Net (`artnet.js`)

Três canais de envio UDP (quando **não** congelado):

1. **Loopback** `127.0.0.1:6454` — bridge local no mesmo PC
2. **Broadcast por interface** — socket UDP vinculado a cada IPv4 ativa, envia `255.255.255.255:6454`
3. **Fallback** — broadcast global via socket loopback se nenhuma interface detectada ainda

Pacote: header ArtDMX (opcode 0x5000, ProtVer 14) + 512 bytes DMX. Buffer pré-alocado (sem GC a 25fps).

### Congelar palco (freeze Art-Net)

| Função | Onde |
|--------|------|
| `artnet.setFrozen(bool)` | `electron/engine/artnet.js` |
| `artnet.isFrozen()` | mesmo módulo |
| IPC `artnet:setFrozen` / `artnet:getFrozen` | `main.js` |
| `window.vp.setArtNetFrozen` / `getArtNetFrozen` | `preload.js` |

Com `frozen=true`, `sendArtDMX()` retorna **antes de qualquer** `UDP send`. O palco real fica no último frame enviado. Engine, compositor, scripts e viewer 3D (IPC `dmx-universe`) **continuam normalmente**.

**Não confundir com:** blackout, `engine.stop()`, pausa de scripts, pausa de UI.

---

## Compositor (`compositor.js`)

- Cada script ativo = **camada** com buffer `Uint8Array(512)` + máscara `touched`
- IDs de camada: `F1`…`F12`, `page:<pageId>:<sceneKey>`, `macro:<id>:<step>:<seq>`
- `renderFrame()` chama `OnExecute()` de cada camada ativa e faz merge no universo
- Merge padrão: **HTP** (maior valor por canal); alternativo: **linear**
- **Guards:** canais travados por cena ativa (`activeSceneChannels`); fixtures `enabled:false`
- `SetChannel` em script escreve no **buffer da camada**, não no universo global
- Macros: sequência de passos com fade-in/out, overlap, crossfade; `stopAllMacros()` no blackout

---

## Interpolator (`interpolator.js`)

Avança pan/tilt suavemente em direção ao alvo (speed virtual). Chamado **antes** de `compositor.renderFrame()` a cada 40ms.

---

## Scripts de efeito

### Lifecycle

```js
function OnStart()     { }  // 1x ao ativar
function OnExecute()   { }  // a cada 40ms pelo compositor
function OnTerminate() { }  // ao desativar, clear, toggle off ou blackout
```

### API injetada no script

```js
SetChannel(canal, valor);                    // buffer da camada (1-based)
getChannel(fixtureId, alias);                  // resolve canal DMX pelo alias do fixture
```

### Tipos

| Tipo | Vínculo | Persistência |
|------|---------|--------------|
| Global | F1–F12 | `show.scripts` |
| De cena | tecla A,S,D… na página | `show.page_scripts[pageId][sceneKey]` |

Uma tecla de cena tem **cena OU page_script**, nunca os dois.

### Prioridade cena vs script

- Cenas ativas definem canais via `setActiveSceneChannels` → compositor trava esses canais
- Scripts escrevem nas camadas; merge respeita locks de cena
- Múltiplos scripts simultâneos: compositor mistura camadas (HTP)

### Criação

`script:create(fkey, name, options)` — `options.groups` injeta `.md` de `banco-de-conhecimento/`. Execução via `new Function()` no main. Edição abre VS Code externamente.

---

## Blackout

`dmx:blackout` em `main.js`:

1. `stopAllRunningScripts('blackout')` — chama `OnTerminate`, para macros
2. `universe.blackout()` — zera 512 canais

Diferente de congelar palco: blackout **altera** o universo e para scripts.

---

## Viewer 3D (backend)

- `window:open3DViewer` — abre janela Electron separada
- `engine.onFrame` → `viewer3DWindow.webContents.send('dmx-universe', Array.from(universe))`
- Renderer da janela 3D usa `window.vp.onDmxUniverse` — **não** depende de Art-Net loopback
- Freeze Art-Net **não** afeta o preview 3D

---

## IPC — contratos principais

Ver tabela completa em `README_SKILL.md` §7. Resumo do que o backend expõe:

### Engine
`engine:start` | `engine:stop` | `engine:status` → `{ running, frames }`

### Art-Net
`artnet:setFrozen` | `artnet:getFrozen` | `artnet:getInterfaces`

### DMX
`dmx:setChannel` | `dmx:setChannelRange` | `dmx:blackout` | `dmx:restoreState`
`dmx:activateScene` | `dmx:getUniverse` | `dmx:setActiveSceneChannels(channels, parLedChs)`
`dmx:setActiveScenes` | `dmx:getConflicts`

### Speed virtual (moving/ribalta)
`custom:speed` ← `setFixtureSpeed` / `setMovingHeadSpeed` / `setRibaltaSpeed`

### Scripts
`script:create|edit|clear|toggle|list|getAll|stopAll` — identificador é **F-key** (`"F1"`…`"F12"`)

### Page scripts
`page_script:create|edit|clear|toggle|getAll`

### Macros
`macro:create|update|start|stop|next|remove|list|status` — canal IPC de avanço é `macro:next`

### Show
`show:load|save|saveAs|get|updateScene`

### Window / 3D
`window:closeApp` | `window:open3DViewer` | eventos `dmx-universe`, `viewer3d:closed`

---

## Modelo `.show.json`

Blocos: `version`, `meta`, `fixtures`, `pages`, `page_scripts`, `scripts`, opcionalmente `mode2`.

```json
{
  "fixtures": [{
    "id": "fixture_1780805067518_parled_deluxe_1",
    "name": "ParLed_Deluxe_1",
    "startChannel": 1,
    "channelCount": 8,
    "channels": ["dimmer", "strobo", "", "", "red", "green", "blue", "white"],
    "fixtureType": "par_led",
    "universe": 0,
    "group": "Frente",
    "posX": 0, "posY": 0,
    "enabled": true
  }],
  "pages": { "1": { "name": "LOUVOR", "scenes": { "A": { "name": "...", "color": "#...", "channels": {} } } } },
  "scripts": { "F1": { "name": "efeito", "file": "..." } },
  "page_scripts": { "1": { "A": { "name": "script-cena", "file": "..." } } }
}
```

- `startChannel` é **1-based**; canal real = `startChannel + índice` em `channels[]`
- `channels[]` = aliases; `""` = sem função definida
- `enabled: false` — fixture no show, canais ignorados pelo compositor se não cobertos por outro habilitado

---

## Fixtures ativos (show padrão)

IDs/nomes em `shows/vp.show.json` (consultar arquivo para patch atual):

| Grupo | Exemplos |
|-------|----------|
| Par LED Deluxe | `ParLed_Deluxe_1` … `_9`, `parLed1` |
| Moving Head Beam | `Moving Head Beam 1`, `Moving Head Beam 2` |
| Ribaltas | `Ribalta_1`, `Ribalta_2` |
| Ribalta RGB static | `ribalta-rgb-static_1` … `_4` |
| Fita LED | `Fita_Led` |
| Mini Bruts | `Mini_Brut_01` … `_04` |
| Moving Wosh | `Moving_Wosh` |

---

## Cenas e páginas (backend)

- **SCENE_KEYS:** `['A','S','D','F','G','H','J','K','L','Z','X','C','V']` — não é A–M
- Cenas indexadas por `pages[pageId].scenes[sceneKey]`
- `activeScenes` no renderer usa refs `pageId:sceneKey` (ver frontend skill)
- PgUp/PgDown é UI; backend não controla navegação de página

---

## Cuidados com palco real

1. **Testar freeze** antes de programar ao vivo — palco para no último frame UDP
2. **Blackout** para tudo imediatamente — não usar freeze como blackout
3. **Não pausar engine** para “congelar” — use `setArtNetFrozen(true)`
4. **Um universo, 512 canais** — SL3000 é o gargalo
5. **Alterações em `electron/`** exigem restart — evitar deploy ao vivo sem testar
6. **Scripts sem setInterval** — nunca reintroduzir loops paralelos no script

---

## Decisões fechadas

| Decisão | Escolha |
|---------|---------|
| Desktop | Electron |
| Protocolo saída | Art-Net UDP broadcast |
| FPS engine | 25 (40ms) |
| Composição | Camadas + compositor único |
| Estado | JSON em memória + `.show.json` em disco |
| IPC | contextBridge + ipcMain |

---

## Problemas conhecidos / pontos de atenção

- Macros: backend completo, **sem UI dedicada** no app
- `SceneEditor.jsx` existe mas não está roteado em `App.jsx`
- Caminho absoluto em `script.file` no JSON não é portátil — `name` relativo a `scripts/` é a fonte no runtime
- Windows pode bloquear directed broadcast — artnet usa `255.255.255.255` por interface
- `README_SKILL.md` pode estar atrás do código em freeze/3D/interpolator — validar sempre no código

---

## Regras de ouro

1. Lumikit é referência de comportamento
2. Simples primeiro — operação solo ao vivo
3. Renderer pode ser lento; **engine não pode travar**
4. Freeze = só UDP; engine e 3D seguem
5. Em dúvida de contrato IPC → `README_SKILL.md` §7 + `preload.js`
