# Estrutura do projeto vp-light

## Pastas e arquivos principais

```
C:\vp-light\
├── electron/
│   ├── main.js          → processo principal: IPC handlers, inicia engine, carrega show
│   ├── preload.js       → expõe window.vp.* para o renderer (ponte IPC)
│   ├── show.js          → lê e salva o arquivo .show.json do disco
│   └── engine/
│       ├── engine.js    → loop 40ms: interpolator + compositor + sendArtDMX + onFrame
│       ├── compositor.js→ camadas de scripts/macros, merge HTP
│       ├── universe.js  → array de 512 canais DMX
│       ├── artnet.js    → Art-Net UDP (freeze bloqueia só saída UDP)
│       └── interpolator.js → pan/tilt speed virtual
│
├── src/
│   ├── App.jsx          → roteador de telas (main ↔ fixtures ↔ painel)
│   ├── main.jsx         → entry point React
│   ├── theme.js         → tokens visuais
│   ├── store/
│   │   └── showStore.js → estado global: fixtures, páginas, cenas
│   └── screens/
│       ├── Main.jsx           → mesa, faders, cenas ASDFGHJKLZXCV, F-keys
│       ├── FixturePanel.jsx   → CRUD de aparelhos
│       ├── FixtureEditor.jsx  → modal de edição
│       ├── PainelOperacao.jsx → painel de operação
│       └── Viewer3D.jsx       → preview 3D (janela separada)
│
├── .agents/skills/      → skills ativas dos agentes (SKILL.md por pasta)
├── skills-desabilitadas/→ skills arquivadas (fora do runtime)
├── shows/
│   └── vp.show.json     → show padrão
│
├── index.html
├── vite.config.js
└── package.json
```

## Skills oficiais

Todas em `.agents/skills/<nome>/SKILL.md`:

- Backend/engine: `desenvolvedor-backend`
- Frontend/UI: `desenvolvedor-frontend`
- Scripts DMX: `desenvolvedor-dmx`
- Sync documentação: `fiscal-do-sistema`
- Criar skills: `create-skill`

## Regras de arquitetura

- Engine DMX roda APENAS em electron/engine/ (main process Node.js)
- Renderer (React) NUNCA acessa hardware diretamente
- Renderer se comunica com o main APENAS via window.vp.* (definido no preload.js)
- Alterações visuais → mexer em src/screens/ e src/theme.js
- Alterações de estado global → mexer em src/store/showStore.js
- Alterações de IPC ou engine → mexer em electron/ e reiniciar npm run dev
- Arquivos em src/ têm hot reload automático ao salvar (não precisa reiniciar)
- Congelar palco bloqueia só envio Art-Net UDP; engine, UI e preview 3D continuam

## Fluxo de dados

Usuário clica → React (src/screens/) → window.vp.* (preload.js) → ipcMain (electron/main.js) → compositor/universe → engine.js → artnet.js → UDP → SL3000 → DMX → fixture

Preview 3D: engine.onFrame → IPC dmx-universe (independente do freeze Art-Net)
