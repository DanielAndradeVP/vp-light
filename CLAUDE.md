# Estrutura do projeto vp-light

## Pastas e arquivos principais

```
C:\vp-light\
├── electron/
│   ├── main.js          → processo principal: IPC handlers, inicia engine, carrega show
│   ├── preload.js       → expõe window.vp.* para o renderer (ponte IPC)
│   ├── show.js          → lê e salva o arquivo .show.json do disco
│   └── engine/
│       ├── engine.js    → loop 40ms que envia DMX (start/stop)
│       ├── universe.js  → array de 512 canais DMX (setChannel, blackout, applyScene)
│       └── artnet.js    → monta e envia pacote UDP Art-Net para 255.255.255.255:6454
│
├── src/
│   ├── App.jsx          → roteador de telas (main ↔ fixtures)
│   ├── main.jsx         → entry point React
│   ├── store/
│   │   └── showStore.js → estado global: fixtures, páginas, cenas, aparelho selecionado
│   └── screens/
│       ├── Main.jsx         → tela principal: mesa de aparelhos, faders, cenas A-M, páginas
│       ├── FixturePanel.jsx → painel de aparelhos: tabela, novo/remover/duplicar
│       └── FixtureEditor.jsx→ modal de edição: abas Básico e Descrição
│
├── shows/
│   └── vida-e-paz.show.json → arquivo de show padrão carregado na inicialização
│
├── index.html       → entry point HTML
├── vite.config.js   → configuração do Vite (hot reload, JSX em .js)
└── package.json     → dependências e scripts (npm run dev)
```

## Regras de arquitetura

- Engine DMX roda APENAS em electron/engine/ (main process Node.js)
- Renderer (React) NUNCA acessa hardware diretamente
- Renderer se comunica com o main APENAS via window.vp.* (definido no preload.js)
- Alterações visuais → mexer em src/screens/
- Alterações de estado global → mexer em src/store/showStore.js
- Alterações de IPC ou engine → mexer em electron/ e reiniciar npm run dev
- Arquivos em src/ têm hot reload automático ao salvar (não precisa reiniciar)

## Fluxo de dados

Usuário clica → React (src/screens/) → window.vp.* (preload.js) → ipcMain (electron/main.js) → universe.js → engine.js → artnet.js → UDP → SL3000 → DMX → fixture
