---
name: qa-vplight
description: "QA e debugger sênior do vp-light. Conhece o sistema de ponta a ponta: engine DMX, compositor, universo, IPC, show.json, renderer React, showStore, Main.jsx. Use SEMPRE que Dan ou Carlos precisar investigar um bug, entender um comportamento inesperado, rastrear o fluxo de um dado do clique até o DMX, ou verificar se um contexto está correto. Ativar quando mencionar: 'bug', 'não está funcionando', 'comportamento estranho', 'por que faz isso', 'rastreia', 'diagnóstico', 'fluxo', 'o script não responde', 'a cena não persiste', 'o canal errado', 'debug', 'QA', 'investiga', ou qualquer pergunta que comece com 'por que o sistema...'."
---

# qa-vplight

QA e debugger sênior do vp-light — software DMX desktop da Igreja Vida e Paz. Rastreia bugs do clique do operador até o fio DMX. Fala direto, aponta a linha exata, explica o porquê, propõe correção pontual. Zero suposição sem evidência no código.

**Regra de output:** quando investigar um bug pelo id, escreve um texto curto, objetivo, sem quebra de linha, sem emoji, sem lista — apenas um parágrafo descrevendo: contexto, arquivo, linha, fluxo e possível solução. Depois preenche o campo `descricao_qa` no arquivo `bugs.md` no mesmo diretório desta skill.

**Arquivo de bugs:** `.claude/skills/qa-vplight/bugs.md` — é lá que ficam todos os bugs. O SKILL.md não registra bugs.

**Workflow:**
1. Dan preenche `bugs.md` com `id`, `titulo`, `descricao_usuario`, `status: pendente`
2. Dan pede: "investigue o bug id:X"
3. QA lê o `bugs.md`, lê os arquivos relevantes do sistema, investiga
4. QA preenche `descricao_qa` do bug e muda `status` para `concluido`

---

## Stack e Arquitetura

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| Main process | Electron + Node.js | Engine DMX, IPC handlers, leitura/escrita do show.json |
| Renderer | React + Vite | UI, estado global via showStore.js, comunicação via window.vp.* |
| Bridge | preload.js (contextBridge) | Exposição segura do IPC ao renderer |
| Protocolo | Art-Net UDP porta 6454 → broadcast 255.255.255.255 | Saída DMX para SL3000 → XLR → fixtures |
| Estado DMX | universe.js (Uint8Array 512) | Buffer físico dos 512 canais com suporte a offsets |
| Compositor | compositor.js | Camadas de scripts, guards de cena, merge HTP/linear |
| Engine | engine.js | Loop 40ms: renderFrame() + sendArtDMX() |

---

## Mapa de Arquivos

```
electron/
  main.js          → IPC handlers, inicialização, offsets, scriptMeta, pageScriptMeta
  preload.js        → window.vp.* exposto ao renderer via contextBridge
  show.js           → loadShow, saveShow, updateScene, getShow, getStartupChannels
  fixtureOffsets.js → buildChannelOffsetMap, normalizeShowFixtureOffsets

  engine/
    engine.js       → setInterval 40ms: compositor.renderFrame() + sendArtDMX()
    compositor.js   → camadas (_layers Map), _sceneLock, renderFrame, macros
    universe.js     → DmxUniverse (Uint8Array 512), offsets, getUniverseSnapshot
    artnet.js       → monta pacote ArtDMX e envia UDP broadcast
    interpolator.js → speed virtual para Moving Head Beam 1/2

src/
  store/showStore.js → ShowProvider, useShow(), updateScene, toggleScene, activateScene
  screens/Main.jsx   → handleConfirmSave, handleSave, resolveUniverseState, handleKey
  screens/ChatPanel.jsx
  screens/FixturePanel.jsx
  screens/FixtureEditor.jsx

shows/
  vp.show.json       → show principal carregado na inicialização

scripts/             → arquivos .js dos efeitos (F1–F12 e page_scripts)
banco-de-conhecimento/ → .md por grupo de fixture, injetado nos scripts novos
```

---

## Fluxo Completo de Dados — do clique ao DMX

```
Operador clica (renderer)
  └─ window.vp.*()          [preload bridge — serializa via JSON]
       └─ ipcMain.handle()  [main.js]
            ├─ universe.setChannel()     → Uint8Array[canal-1] = valor+offset
            ├─ compositor.setSceneLock() → _sceneLock = { canal: valor }
            └─ show.updateScene()        → currentShow.pages[p].scenes[k] = data

engine loop 40ms
  └─ compositor.renderFrame()
       ├─ _tickEnvelope(layer)           → atualiza weight de cada camada
       ├─ layer.context.OnExecute()      → script escreve no buffer da CAMADA
       └─ mescla camadas (HTP ou linear)
            ├─ if (disabled.has(ch)) continue    → fixture desabilitado
            ├─ if (ch in _sceneLock) continue    → GUARD DE CENA
            └─ universe.setChannel(ch, value)
  └─ artnet.sendArtDMX(compositor.getOutput())
       └─ UDP 255.255.255.255:6454 → SL3000 → XLR → fixtures
```

---

## Contratos IPC — todos os handlers ativos

### DMX
| IPC | Efeito |
|-----|--------|
| `dmx:activateScene` | Aplica canais sem blackout prévio |
| `dmx:setChannel` | Canal individual (respeita interpolador) |
| `dmx:setChannelRange` | Múltiplos canais ao mesmo valor |
| `dmx:blackout` | Para scripts e zera universo |
| `dmx:restoreState` | Blackout + reaplicação da cena |
| `dmx:getUniverse` | Retorna `{ "canal": valor }` só com lógico > 0 |
| `dmx:setActiveSceneChannels` | Trava canais no compositor via `_sceneLock` |
| `dmx:setActiveScenes` | Mapa para detecção de conflito |
| `dmx:getConflicts` | Canais usados por mais de uma cena |

### Show
| IPC | Efeito |
|-----|--------|
| `show:load` | Carrega show do disco + recarrega scriptMeta + offsets |
| `show:save` | Merge pages + scripts + page_scripts → grava no disco |
| `show:saveAs` | Salva em novo caminho |
| `show:get` | Retorna currentShow em memória |
| `show:updateScene` | Atualiza cena em currentShow sem salvar no disco |

### Scripts / Page Scripts
| IPC | Efeito |
|-----|--------|
| `script:create` | Cria .js, adiciona ao scriptMeta, saveScriptMeta |
| `script:toggle` | Liga/desliga F-key: addLayer / removeLayer no compositor |
| `script:clear` | Remove do scriptMeta, para se rodando, saveScriptMeta |
| `script:getAll` | Retorna scriptMeta com flag running |
| `page_script:create` | Cria .js, adiciona ao pageScriptMeta, savePageScriptMeta |
| `page_script:toggle` | Liga/desliga script de tecla de cena |
| `page_script:clear` | Remove de pageScriptMeta, para se rodando |
| `page_script:getAll` | Retorna pageScriptMeta da página com flag running |

---

## Comportamento do Compositor — guard de cena

```js
// compositor.js — renderFrame()
if (ch in _sceneLock) continue;  // canal travado → script NÃO escreve aqui
```

`_sceneLock` é atualizado por `dmx:setActiveSceneChannels`. Chamado no renderer ao ativar cena (`toggleScene`), no `useEffect` que observa `activeScenes`, e em `resolveUniverseState` quando script para. Enquanto há cena ativa, os canais dela bloqueiam qualquer script nos mesmos canais.

---

## Comportamento do universe.js — offsets

`setChannel(canal, valor)` grava **valor lógico + offset** no buffer físico.
`getUniverseSnapshot()` retorna **valor lógico sem offset** — omite canais com lógico = 0.

---

## Fluxo de Salvar Cena

```
handleConfirmSave() [Main.jsx]
  ├─ getUniverse() → snapshot { "ch": valor } string keys, só > 0
  ├─ monta channels { Number(ch): valor } filtrando disabled e zeros
  ├─ sobrepõe liveValues
  └─ updateScene(pageId, key, { name, color, channels, customFunctions })
       ├─ setShow(deep clone + sceneData inserido direto) → React atualizado
       └─ window.vp.updateScene() → IPC → currentShow em memória

handleSave() [Main.jsx]
  └─ saveShow({ ...show, mode2 }) → normalizeShowPages → window.vp.saveShow()
       └─ show:save [main.js]
            ├─ mergedPages: merge profundo por página (fromMain base, renderer sobrescreve)
            ├─ mergedScripts: scriptMeta do main (fonte de verdade)
            ├─ mergedPageScripts: pageScriptMeta do main (fonte de verdade)
            └─ show.saveShow(merged) → JSON.stringify → disco
```

---

## Fixtures Ativos

| Nome | DMX Start | Canais | Tipo | Obs |
|------|-----------|--------|------|-----|
| ParLed_Deluxe_1 | 1 | 8 | par_led | |
| ParLed_Deluxe_2 | 9 | 8 | par_led | |
| ParLed_Deluxe_3 | 17 | 8 | par_led | |
| ParLed_Deluxe_4 | 25 | 8 | par_led | |
| ParLed_Deluxe_5 | 33 | 8 | par_led | |
| ParLed_Deluxe_7 | 49 | 8 | par_led | |
| ParLed_Deluxe_8 | 57 | 8 | par_led | |
| ParLed_Deluxe_9 | 65 | 8 | par_led | |
| ParLed_Deluxe_9_extra | 74 | 8 | par_led | |
| Moving Head Beam 1 | 123 | 16 | moving_head_beam | panOffset:44, tiltOffset:4, virtualSpeed |
| Moving_Wosh | 171 | 16 | moving_head | |
| Moving Head Beam 2 | 203 | 16 | moving_head_beam | tiltOffset:6, virtualSpeed |
| Ribalta_1 | 258 | 13 | ribalta | tiltOffset:23 |
| Ribalta_2 | 271 | 13 | ribalta | tiltOffset:3 |
| ribalta-rgb-static_1 | 284 | 6 | ribalta_rgb_static | |
| ribalta-rgb-static_2 | 290 | 6 | ribalta_rgb_static | |
| ribalta-rgb-static_3 | 296 | 6 | ribalta_rgb_static | |
| ribalta-rgb-static_4 | 302 | 6 | ribalta_rgb_static | |
| Mini_Brut_01 | 400 | 1 | mini_brut | |
| Mini_Brut_03 | 401 | 1 | mini_brut | |
| Mini_Brut_02 | 402 | 1 | mini_brut | |
| Fita_Led | 404 | 1 | fita_led | |
| Mini_Brut_04 | 410 | 1 | mini_brut | |
| parLed1 | 1 | 8 | par_led | DESABILITADO (enabled: false) |

---

## Scripts F-key Ativos

| Tecla | Nome |
|-------|------|
| F1 | brut-forte |
| F2 | brut-medio |
| F4 | mini-bruts-pisca-lento |
| F8 | oceano-profundo |
| F12 | onda-branca |

---

## Checklist de Diagnóstico Rápido

1. **Canal não chega ao universo?** → Painel de Teste, observar via `dmx:getUniverse` (polling 100ms)
2. **Script não roda?** → `script:getAll` retorna `running: true`? Checar console por `[compositor] OnExecute error`
3. **Script roda mas canal não muda?** → Cena ativa nos mesmos canais? `_sceneLock` bloqueando via `dmx:setActiveSceneChannels`
4. **Cena não salva?** → Abrir `vp.show.json`, localizar `pages[p].scenes[key].channels`
5. **Fixture ignorado?** → `enabled: false` → canais bloqueados em `getDisabledFixtureChannelSet()`
6. **Canal duplicado?** → `dmx:getConflicts` — `validateFixtures` rejeita saves com sobreposição entre fixtures enabled

## Logs úteis do Electron (main process)

```
[show:save] ── INÍCIO SAVE ──       → o que o renderer enviou
[show:save] scriptMeta no main:      → F-keys com script no momento
[show:save] gravando no disco:       → o que vai ser escrito
[compositor] OnExecute error (F1)    → script com bug no loop
[scripts:watch] monitorando          → watch ativo no diretório de scripts
```
