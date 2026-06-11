# README_SKILL — Fonte da verdade estrutural do vp-light

> **Para que serve este arquivo**
> Este é o retrato **estrutural** atual do projeto vp-light. Ele NÃO lista bugs nem
> problemas — descreve apenas como o sistema é montado: pastas, contratos, modelo de
> dados, protocolos e convenções.
>
> Ele tem dois leitores:
> 1. **O desenvolvedor** (humano), que atualiza este arquivo sempre que cria algo novo,
>    corrige um bug que mudou estrutura, adiciona um equipamento ou muda um contrato.
> 2. **A skill `fiscal-de-skills-vplight`** (agente), que lê este arquivo e compara
>    com uma skill-alvo para decidir se a skill ainda está alinhada e "competente".
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
| Versão | 1.1 |
| Última atualização | 2026-06-10 |
| Base | Estado real do código + auditorias técnica e direta |

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
│   └── engine/
│       ├── engine.js    → loop setInterval 40ms (start/stop), conta frames
│       ├── universe.js  → Uint8Array(512), estado dos canais DMX
│       └── artnet.js    → monta pacote ArtDMX e envia UDP broadcast
├── src/
│   ├── App.jsx          → roteador de telas (main ↔ fixtures)
│   ├── main.jsx         → entry point React
│   ├── theme.js         → tokens visuais (cores, tipografia, espaçamento)
│   ├── store/
│   │   └── showStore.js → estado global do renderer (React Context)
│   └── screens/
│       ├── Main.jsx         → mesa principal (fixtures, faders, cenas, scripts, páginas)
│       ├── FixturePanel.jsx → tabela/CRUD de aparelhos
│       ├── FixtureEditor.jsx→ modal de edição de fixture
│       └── SceneEditor.jsx  → editor de cena (existe no código, não roteado no App.jsx)
├── scripts/             → arquivos .js dos efeitos DMX (um por nome) + sync-scripts.js
├── shows/
│   └── vp.show.json     → show padrão carregado na inicialização
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
      → universe.js  (estado dos 512 canais)
        → engine.js  (loop 40ms)
          → artnet.js → UDP broadcast → SL3000 → DMX512 → fixture
```

---

## 6. Engine DMX

| Item | Valor |
|---|---|
| Loop | `setInterval` de **40ms** (≈ **25 fps**) em `engine.js` |
| Estado | `universe.js` mantém `Uint8Array(512)` |
| Canal público | 1-based (canal 1 → índice 0 interno) |
| Faixa de valor | 0–255 (normalizado) |
| Snapshot | `getUniverse()` retorna apenas canais com valor > 0 |
| Protocolo | Art-Net (ArtDMX) sobre UDP |
| Porta | `6454` |
| Destino | broadcast `255.255.255.255` |
| Universo Art-Net | fixo em `0` |
| Pacote | header ArtDMX + 512 bytes do universo |

> **Importante (estrutura de loops):** a engine roda seu próprio `setInterval` de 40ms,
> e **cada script de efeito ativo roda em um `setInterval` próprio de 40ms**. Ou seja,
> há múltiplos loops independentes: 1 de envio Art-Net + 1 por script ativo.

---

## 7. Contratos IPC (estado atual)

> Estas tabelas são o contrato real. `window.vp.<fn>` (renderer) → canal `ipcMain`.
> Uma skill que cite nomes/assinaturas diferentes destes está desatualizada.

### `window.vp.*` — superfície completa exposta no preload

```
// Engine
startEngine()            getEngineStatus()           stopEngine()

// DMX
activateScene(channels)  setChannel(channel, value)  blackout()
restoreState(channels)   setActiveSceneChannels(channels)
setActiveScenes(scenesMap)  getConflicts()  getUniverse()

// Show
loadShow(filePath)  saveShow(showData)  saveShowAs(showData)
getShow()           updateScene(pageId, sceneKey, sceneData)

// Scripts
listScripts()                 createScript(fkey, name, options)
editScript(fkey, filePath)    clearScript(fkey)
toggleScript(fkey)            getAllScripts()
```

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
| `blackout()` | `dmx:blackout` | — | `{ ok: true }` |
| `restoreState(channels)` | `dmx:restoreState` | `{ [canal]: valor }` | `{ ok: true }` |
| `setActiveSceneChannels(channels)` | `dmx:setActiveSceneChannels` | `{ [canal]: valor }` | `{ ok: true }` |
| `setActiveScenes(scenesMap)` | `dmx:setActiveScenes` | `{ [id]: { name, channels } }` | `{ ok: true }` |
| `getConflicts()` | `dmx:getConflicts` | — | lista de conflitos |
| `getUniverse()` | `dmx:getUniverse` | — | `{ [canal]: valor }` (apenas > 0) |

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

> **Identificador de script é a F-key** (`"F1"`…`"F12"`), não o nome do arquivo.

---

## 8. Modelo de dados — `.show.json`

Blocos de topo: `version`, `meta`, `fixtures`, `pages`, `scripts`.

```json
{
  "version": "1.0",
  "meta": {
    "name": "Vida e Paz — Show Principal",
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
        "A": { "name": "roxo", "color": "#aa00aa", "channels": { "1": 255, "5": 255, "7": 255 } }
      }
    }
  },
  "scripts": {
    "F1": { "name": "louvorzao-branco-fogo", "file": "C:\\vp-light\\scripts\\louvorzao-branco-fogo.js" }
  }
}
```

Contrato implícito:

- `fixtures[].startChannel` é **1-based**.
- Canal real de um parâmetro = `startChannel + índice no array channels`.
- `channels` (do fixture) é um array de **aliases**; posição com `""` = canal sem função definida.
- `pages` é objeto indexado por string numérica (`"1"`, `"2"`…).
- `scenes` é objeto indexado por tecla de cena (ver §9).
- `scene.channels` é mapa `{ "canal": valor }`, normalmente só valores > 0.
- `scripts` é objeto indexado por F-key (`"F1"`…`"F12"`), com `{ name, file }`.

Campos de fixture lidos mas opcionais (presentes no painel): `manufacturer`, `model`,
`fixtureType`, `universe`, `group`, `par`, `rdm`, `note`.

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
| Tick | `setInterval` próprio de 40ms por script ativo |
| Vínculo | botões/teclas **F1–F12** |
| Lifecycle | `OnTerminate` é chamado ao desativar, ao limpar/toggle ou no blackout |
| Edição | abre o arquivo em editor externo (VS Code) via processo do main |

Contrato obrigatório de cada script:

```js
function OnStart()     { }   // chamado 1x ao ativar
function OnExecute()   { }   // chamado a cada 40ms
function OnTerminate() { }   // chamado ao desativar
```

API injetada disponível dentro do script: `SetChannel(canal, valor)`.

Convenção de prioridade prevista: canais bloqueados por cena ativa são informados ao
main via `setActiveSceneChannels` / `activeSceneChannels`, e o `SetChannel` interno
deve respeitar esse mapa.

Utilitário: `scripts/sync-scripts.js` é uma ferramenta de terminal que associa scripts
da pasta às F-keys, escrevendo direto no `shows/vp.show.json`.

---

## 11. Fixtures (comportamento na mesa)

- Aparecem como blocos arrastáveis em `Main.jsx`; posição salva em `posX`/`posY`.
- Rubber-band selection: arrastar área seleciona múltiplos; clicar no vazio desmarca.
- O painel do fixture selecionado mostra faders ao vivo; cada fader chama `setChannel()` em tempo real.
- CRUD de fixtures em `FixturePanel.jsx` (novo, editar, remover, duplicar) + `FixtureEditor.jsx`.

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

- **2026-06-10** — Atualizado para documentar lifecycle de scripts: `OnTerminate` é chamado em clear/toggle/blackout.
- **2026-06-10** — Criação do README_SKILL.md a partir do estado real do código e das auditorias.

---

## 14. Checklist de validação de skill (uso da sync-skills)

Uma skill-alvo está **alinhada** quando bate com este README em:

1. Nome do arquivo de show (`vp.show.json`).
2. Estrutura de pastas e nomes de telas (inclui `SceneEditor.jsx` existente mas não roteado).
3. Contratos IPC: nomes, assinaturas e identificador por F-key (§7).
4. Specs da engine: 40ms/25fps, Art-Net, porta 6454, broadcast, universo 0, loops independentes (§6).
5. Modelo `show.json`: blocos `version/meta/fixtures/pages/scripts` e contrato de canais (§8).
6. SCENE_KEYS `ASDFGHJKLZXCV` (não A–M) (§9).
7. Contrato de scripts: `OnStart/OnExecute/OnTerminate` + `SetChannel` (§10).
8. Paleta atual teal/verde do `theme.js` (§12).
