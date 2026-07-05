# Relatório: Arquitetura, Stack e Fluxo de Scripts — vp-light

**Data:** 28/06/2026  
**Escopo:** sistema de scripts de efeito DMX (F-keys, page scripts, macros)  
**Projeto:** vp-light — software DMX desktop para Igreja Vida e Paz

---

## 1. Visão geral

O vp-light é um aplicativo desktop de controle DMX512 que envia Art-Net UDP para uma interface SL3000 (Sourlight). Os **scripts de efeito** são arquivos JavaScript em `scripts/` que geram looks dinâmicos (piscadas, movimentos, sequências) sobre a base de cenas estáticas salvas no show.

Os scripts **nunca rodam no renderer React**. Toda execução, compilação e composição acontece no **main process** do Electron (Node.js), sincronizada com um relógio único de 40 ms (~25 fps).

---

## 2. Stack tecnológica (escopo scripts)

| Camada | Tecnologia | Papel nos scripts |
|--------|------------|-------------------|
| Runtime desktop | **Electron 33** + **Node.js ≥18** | Main process executa e compila scripts |
| UI | **React 18** + **Vite 5** | Dispara scripts via IPC; não acessa DMX diretamente |
| Ponte IPC | `electron/preload.js` (`contextBridge`) | Expõe `window.vp.toggleScript`, etc. |
| Engine DMX | `electron/engine/` | Loop 40 ms → compositor → Art-Net |
| Scripts | **JavaScript puro** (`.js`) | Sem bundler; lidos do disco em tempo real |
| Persistência | `shows/vp.show.json` | Metadados: F-keys, page_scripts, macros |
| Conhecimento | `banco-de-conhecimento/*.md` | Injetado como comentários em scripts novos |
| Editor externo | VS Code (via `child_process`) | Abertura automática ao criar script |

**Dependências relevantes:** nenhuma biblioteca externa para scripts — apenas APIs nativas (`new Function`, `fs`, `fs.watch`).

---

## 3. Arquitetura em camadas

```
┌─────────────────────────────────────────────────────────────────┐
│  RENDERER (React)                                               │
│  Main.jsx · PainelOperacao.jsx                                  │
│  window.vp.toggleScript / createScript / togglePageScript …     │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC (preload → ipcMain)
┌────────────────────────────▼────────────────────────────────────┐
│  MAIN PROCESS (electron/main.js)                                │
│  scriptMeta · runningScripts · pageScriptMeta · macroDefs       │
│  compileScriptContext · compileLayer · fs.watch(scripts/)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ addLayer / stopLayer / createMacro
┌────────────────────────────▼────────────────────────────────────┐
│  COMPOSITOR (electron/engine/compositor.js)                     │
│  Map<id, camada> — buffer 512 + touched + context + weight      │
│  renderFrame(): OnExecute → merge HTP/linear → universe         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  ENGINE (electron/engine/engine.js) — tick 40 ms                │
│  interpolator.tick() → compositor.renderFrame() → sendArtDMX    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  Art-Net UDP :6454 → SL3000 → DMX512 → fixtures                 │
└─────────────────────────────────────────────────────────────────┘
```

### Regras invioláveis

1. **Engine e scripts só no main process** — o renderer nunca chama `SetChannel` diretamente no hardware.
2. **Relógio único** — scripts não usam `setInterval` próprio; `OnExecute` é chamado pelo compositor a cada frame.
3. **Camadas isoladas** — cada script ativo tem buffer `Uint8Array(512)` próprio; a mescla ocorre depois.
4. **IPC exclusivo** — comunicação renderer ↔ main apenas via `window.vp.*`.

---

## 4. Tipos de script e identificadores

| Tipo | Identificador | Onde persiste | UI principal |
|------|---------------|---------------|--------------|
| **F-key global** | `"F1"` … `"F12"` | `show.json → scripts` | `Main.jsx` (barra F-keys) |
| **Page script** | `page:<pageId>:<sceneKey>` | `show.json → page_scripts` | `Main.jsx` / `PainelOperacao.jsx` |
| **Macro (passo)** | `macro:<id>:<step>:<seq>` | `show.json → macros[]` | `PainelOperacao.jsx` |

### F-keys vs page scripts vs cenas

- **F-keys:** efeitos manuais independentes da página; podem rodar junto com cenas ativas.
- **Page scripts:** uma tecla de cena (`A`–`V`) pode ter **cena OU script**, nunca os dois na mesma tecla.
- **Macros:** sequenciador que referencia scripts **já existentes** em `scripts/`; cada passo vira uma camada com fade-in/out e overlap.

---

## 5. Contrato do script (API)

Todo arquivo em `scripts/*.js` deve expor três funções de lifecycle:

```js
function OnStart()     { }  // 1× ao ativar (resolver canais, reset de estado)
function OnExecute()   { }  // a cada 40 ms — escrever DMX no buffer da camada
function OnTerminate() { }  // ao parar, blackout, erro ou remoção de arquivo
```

### APIs injetadas na sandbox

| API | Descrição |
|-----|-----------|
| `SetChannel(canal, valor)` | Escreve 0–255 no buffer da camada (canal DMX 1-based). Marca `touched` e `controlledMask`. |
| `getChannel(fixtureId, alias)` | Resolve canal DMX pelo ID do fixture + alias (`dimmer`, `pan`, `red`, …). Retorna `null` se fixture desabilitado ou alias inexistente. |
| `adapter.resolve(fixtureId, alias, adapterKey, valorLogico)` | Conversão de valores lógicos para DMX (ex.: calibração ribalta). |

A compilação usa `new Function()` com o código lido do disco:

```js
// electron/main.js — compileScriptContext
const fn = new Function('SetChannel', 'getChannel', 'adapter', 'ctx', `
  ${code}
  ctx.OnStart = typeof OnStart === 'function' ? OnStart : null;
  ctx.OnExecute = typeof OnExecute === 'function' ? OnExecute : null;
  ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
`);
```

**Importante:** `SetChannel` escreve no **buffer da camada**, não diretamente no universo global. O compositor mescla todas as camadas antes de chamar `universe.setChannel()`.

---

## 6. Fluxo completo — ativar um script F-key

```mermaid
sequenceDiagram
  participant UI as Main.jsx
  participant Pre as preload.js
  participant Main as main.js
  participant Comp as compositor.js
  participant Eng as engine.js
  participant Art as artnet.js

  UI->>Pre: toggleScript("F5")
  Pre->>Main: ipc script:toggle
  Main->>Main: readScriptCode(meta.file)
  Main->>Main: compileScriptContext → ctx
  Main->>Main: ctx.OnStart()
  Main->>Comp: addLayer("F5", { buffer, touched, context })
  Main-->>UI: { ok: true, running: true }

  loop A cada 40 ms
    Eng->>Comp: renderFrame()
    Comp->>Comp: buffer.fill(0); touched.fill(0)
    Comp->>Comp: ctx.OnExecute()
    Comp->>Comp: merge HTP/linear por canal touched
    Comp->>Eng: universe.setChannel(...)
    Eng->>Art: sendArtDMX(universo)
  end

  UI->>Pre: toggleScript("F5") [parar]
  Pre->>Main: script:toggle
  Main->>Comp: stopLayer("F5")
  Comp->>Comp: OnTerminate() + flush buffer → universo
  Main-->>UI: { ok: true, running: false }
```

### Passos detalhados

1. **Operador** clica no botão F-key na mesa (`Main.jsx`).
2. **Renderer** chama `window.vp.toggleScript(fkey)`.
3. **Main** lê o arquivo `.js` associado em `scriptMeta[fkey]`.
4. **Compilação:** cria buffer 512, compila com `new Function`, executa `OnStart()`.
5. **Registro:** `compositor.addLayer(fkey, layer)` — camada entra no mapa `_layers`.
6. **A cada tick (40 ms):** `engine.js` chama `compositor.renderFrame()`:
   - Zera buffer/touched de cada camada.
   - Chama `OnExecute()` de cada script ativo.
   - Mescla canais tocados (HTP = max ponderado; linear = soma com clamp 255).
   - Aplica guards (fixture desabilitado, interpolador pan/tilt).
   - Escreve no universo DMX.
7. **Art-Net** envia os 512 bytes (salvo se freeze ativo na rede real).
8. **Ao parar:** `stopLayer` → `OnTerminate()` → flush final nos canais não controlados por outras camadas → remove camada.

---

## 7. Compositor — mescla e prioridade

### Modelo de camada

Cada camada contém:

- `buffer: Uint8Array(512)` — valores DMX do frame atual.
- `touched: Uint8Array(512)` — máscara de canais escritos neste frame.
- `controlledMask: Uint8Array(512)` — canais que o script já controlou (para restoreState).
- `context` — funções `OnStart` / `OnExecute` / `OnTerminate`.
- `weight` + `phase` — envelope para macros (fade-in/out).

### Prioridade script vs cena

- Cenas ativas formam a **base** do universo via `restoreState` / `activateScene`.
- Scripts **sobrescrevem** nos canais que tocam a cada frame.
- Ao parar um script, `restoreState` reaplica cenas nos canais liberados (`getActiveControlledChannels()` evita resetar canais ainda dominados por outro script).

### Modos de mescla entre camadas de script

| Modo | Comportamento | Uso |
|------|---------------|-----|
| **HTP** (padrão) | `max(buffer × weight)` por canal | F-keys, page scripts, macros padrão |
| **linear** | `clamp(Σ buffer × weight)` | Opcional por macro (`mergeMode: 'linear'`) |

### Guards aplicados na composição

- Fixtures com `enabled: false` — canais ignorados.
- Canais pan/tilt com speed virtual — roteados ao `interpolator` em vez de escrita direta.
- Calibração física ribalta — aplicada na saída Art-Net (`ribaltaPhysicalCalib.js`), não nos scripts.

---

## 8. Page scripts

Fluxo idêntico ao das F-keys, com diferenças de metadados:

- Chave de camada: `page:<pageId>:<sceneKey>` (ex.: `page:1:A`).
- Estado runtime: `runningPageScripts`, `pageScriptMeta`.
- IPC: `page_script:create|edit|clear|toggle|getAll`.
- Uma tecla de cena com script **substitui** a cena estática naquela tecla.

---

## 9. Macros — sequenciador de scripts

As macros **não são arquivos `.js` separados**. São definições JSON em `show.json`:

```json
{
  "id": "intro-louvor",
  "name": "Intro Louvor",
  "mergeMode": "htp",
  "loop": false,
  "steps": [
    {
      "script": "brut-pisca-cruz",
      "durationMs": 8000,
      "fadeInMs": 500,
      "fadeOutMs": 500,
      "overlapMs": 1000
    },
    {
      "script": "mov-traj-mh-rib",
      "durationMs": null,
      "fadeInMs": 300,
      "fadeOutMs": 300,
      "overlapMs": 0
    }
  ]
}
```

- `durationMs: null` → passo infinito até `nextMacroStep(id)` manual.
- Tempos convertidos em frames: `msToFrames(ms) = round(ms / 40)`.
- Cada passo compila o script via `compileLayer(file)` no momento do disparo (`makeLayer` factory).
- Crossfade: passo N inicia fade-out enquanto passo N+1 faz fade-in (`overlapFrames`).

---

## 10. Persistência e metadados

### Estrutura no `vp.show.json`

```json
{
  "scripts": {
    "F5": {
      "name": "mov-preset",
      "file": "C:\\vp-light\\scripts\\mov-preset.js",
      "color": "#8db8b8"
    }
  },
  "page_scripts": {
    "1": {
      "A": { "name": "meu-efeito", "file": "..." }
    }
  },
  "macros": [ /* array de definições */ ]
}
```

### Fonte de verdade em runtime

| Dado | Runtime (main) | Persistência |
|------|------------------|--------------|
| F-keys | `scriptMeta`, `runningScripts` | `show.json → scripts` |
| Page scripts | `pageScriptMeta`, `runningPageScripts` | `show.json → page_scripts` |
| Macros | `macroDefs` + compositor `_macros` | `show.json → macros` |

No `show:save`, o main **mescla** metadados runtime com dados do renderer (`buildMergedShow`) — entradas removidas por `script:clear` não são restauradas do renderer.

---

## 11. Hot reload de scripts (`fs.watch`)

O main monitora `scripts/` recursivamente (debounce 150 ms):

| Evento | Comportamento |
|--------|---------------|
| Arquivo `.js` modificado | Para e reinicia scripts F-key/page que usam esse arquivo |
| `mov-preset.js` modificado | Recarrega **todos** os `mov-*.js` ativos (preset concatenado) |
| Arquivo removido | Para script, remove de `scriptMeta` se associado |
| Arquivo novo | Notifica renderer (`scripts:changed`); **não** associa F-key automaticamente |

Scripts `mov-*` (exceto `mov-preset.js`) recebem concatenação automática do preset:

```js
// readScriptCode — main.js
code = fs.readFileSync(MOV_PADRAO_PRESET) + '\n\n' + code;
```

O preset (`mov-preset.js`) centraliza IDs de fixtures, posições pan/tilt, cores ParLed e helpers ribalta.

---

## 12. Integração com blackout e shutdown

| Ação | Efeito nos scripts |
|------|-------------------|
| `blackout()` | `stopAllRunningScripts('blackout')` → `OnTerminate` em todos + `compositor.stopAllMacros()` + universo zerado |
| `stopAllScripts()` | Para F-keys e page scripts; emite `scripts:changed` |
| Fechar janela | Scripts recebem `OnTerminate`; engine para |
| Erro em `OnExecute` | Camada removida automaticamente; callback `onError` limpa `runningScripts` |

---

## 13. IPC — superfície completa (scripts)

### F-keys (`window.vp.*`)

| Função | Canal IPC | Retorno |
|--------|-----------|---------|
| `listScripts()` | `script:list` | `{ ok, files[] }` |
| `createScript(fkey, name, options)` | `script:create` | `{ ok, name, file, color }` |
| `editScript(fkey, filePath?)` | `script:edit` | Abre VS Code |
| `clearScript(fkey)` | `script:clear` | Remove associação F-key |
| `toggleScript(fkey)` | `script:toggle` | `{ ok, running }` |
| `getAllScripts()` | `script:getAll` | `{ [fkey]: { name, file, running, color } }` |
| `stopAllScripts()` | `script:stopAll` | Para todos |
| `onScriptsChanged(cb)` | evento `scripts:changed` | Push em tempo real |

`createScript` opções: `{ groups?, skipOpenEditor?, color? }` — `groups` injeta `banco-de-conhecimento/<grupo>.md` como comentários.

### Page scripts

`createPageScript`, `editPageScript`, `clearPageScript`, `togglePageScript`, `getAllPageScripts`.

### Macros

`createMacro`, `updateMacro`, `startMacro`, `stopMacro`, `nextMacroStep`, `removeMacro`, `macroList`, `macroStatus`.

---

## 14. Organização dos arquivos em `scripts/`

```
scripts/
├── mov-preset.js          → biblioteca compartilhada (injetada em mov-*)
├── mov-traj-*.js          → trajetórias moving head + ribalta
├── mov-desc-*.js          → sequências descritivas / reset
├── brut-*.js              → efeitos Mini Brut
└── backlog/               → scripts arquivados (ignorados em script:list)
    ├── bruts/
    ├── movings/
    └── all-fixtures/
```

Convenção de nomenclatura:

- `mov-*` — moving heads / ribaltas motorizadas (usam preset).
- `brut-*` — mini bruts.
- Comentários no topo descrevem o efeito e fixtures envolvidos.

---

## 15. Telas React envolvidas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/screens/Main.jsx` | Barra F1–F12, CRUD de scripts, page scripts por tecla de cena, modal de criação com grupos do banco |
| `src/screens/PainelOperacao.jsx` | Operação ao vivo: macros, dispatch pad F-keys/page scripts |
| `src/store/showStore.js` | Estado global do show (não guarda `running` — vem do main via IPC) |

O renderer **não** calcula DMX de scripts; apenas reflete flags `running` e dispara toggles.

---

## 16. Viewer 3D e scripts

O preview 3D recebe o universo final via IPC (`dmx-universe`), independente do freeze Art-Net. Labels dos scripts ativos são enviados por `viewer3d:active-scripts` a partir de `runningScripts`, page scripts e passo atual de macro.

---

## 17. Ferramentas auxiliares

| Ferramenta | Local | Função |
|------------|-------|--------|
| `tools/sync-scripts.js` | raiz | Associa scripts da pasta às F-keys no `vp.show.json` |
| `scripts/backlog/sync-scripts.js` | backlog | Cópia/arquivo legado |

---

## 18. Diagrama de contexto — onde cada peça vive

```
                    ┌──────────────┐
                    │  .show.json  │
                    │ scripts      │
                    │ page_scripts │
                    │ macros       │
                    └──────┬───────┘
                           │ load/save
┌─────────────┐    IPC     ┌▼────────────┐    compile    ┌─────────────┐
│  React UI   │◄──────────►│  main.js    │──────────────►│ scripts/*.js│
│  Main.jsx   │            │ scriptMeta  │   fs.watch    │ (disco)     │
│  PainelOp.  │            │ macroDefs   │◄──────────────┤             │
└─────────────┘            └──────┬──────┘               └─────────────┘
                                  │
                           ┌──────▼──────┐
                           │ compositor  │◄── camadas (F-key, page, macro)
                           └──────┬──────┘
                                  │
                           ┌──────▼──────┐     ┌──────────┐
                           │  universe   │────►│ artnet   │──► DMX real
                           │ 512 canais  │     │ UDP 6454 │
                           └─────────────┘     └──────────┘
                                  │
                                  └── onFrame ──► Viewer 3D (IPC)
```

---

## 19. Decisões de design (scripts)

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Onde executar | Main process only | Latência previsível; sem acesso DMX no renderer |
| Tick | 40 ms único no engine | Evita múltiplos timers competindo |
| Compilação | `new Function` + sandbox mínima | Simples; hot reload ao salvar arquivo |
| Saída | Buffer por camada + merge | Vários efeitos simultâneos com HTP |
| Identificador F-key | `"F1"`…`"F12"`, não nome do arquivo | Um botão fixo pode apontar para qualquer `.js` |
| Preset mov-* | Concatenação em `readScriptCode` | Reuso de IDs/posições sem módulos ES |
| Editor | VS Code externo | Operador edita JS com ferramentas completas |

---

## 20. Referências no código

| Conceito | Arquivo principal |
|----------|-------------------|
| IPC handlers scripts | `electron/main.js` |
| Sandbox SetChannel/getChannel | `electron/main.js` → `buildScriptSandbox` |
| Compositor e macros | `electron/engine/compositor.js` |
| Loop 40 ms | `electron/engine/engine.js` |
| Contratos IPC | `electron/preload.js`, `README_SKILL.md` §7–§10 |
| UI F-keys | `src/screens/Main.jsx` |
| UI ao vivo | `src/screens/PainelOperacao.jsx` |
| Exemplo script | `scripts/brut-pisca-cruz.js` |
| Preset moving | `scripts/mov-preset.js` |

---

*Relatório gerado a partir do estado atual do repositório vp-light. Em caso de divergência com documentação antiga, o código em `electron/` prevalece.*
