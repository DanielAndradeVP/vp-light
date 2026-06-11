# Estrutura de arquivos do vp-light

Use este mapa para escrever o **caminho exato** no início de cada prompt e para classificar frontend vs. backend. Tudo em `electron/` é backend; tudo em `src/` é frontend; `scripts/` é backend (lógica de efeito DMX).

```
vp-light/
├── electron/                    ← BACKEND
│   ├── main.js                  ← processo principal: IPC handlers, engine, scripts
│   ├── preload.js               ← bridge IPC: expõe window.vp.*
│   ├── show.js                  ← lê/salva o .show.json
│   └── engine/
│       ├── engine.js            ← loop 40ms (25fps)
│       ├── universe.js          ← Uint8Array[512] dos canais DMX
│       └── artnet.js            ← pacotes UDP Art-Net para SL3000
├── src/                         ← FRONTEND
│   ├── App.jsx                  ← roteador de telas
│   ├── main.jsx                 ← entry point React
│   ├── screens/
│   │   ├── Main.jsx             ← tela principal: mesa de aparelhos, faders, cenas, scripts e páginas
│   │   ├── ChatPanel.jsx        ← aba Chat do painel direito, com menu de skills locais
│   │   ├── FixturePanel.jsx     ← painel de aparelhos: tabela, novo/remover/duplicar
│   │   └── FixtureEditor.jsx    ← modal: abas Básico e Descrição
│   └── store/
│       └── showStore.js         ← estado global via React Context
├── scripts/                     ← BACKEND
│   └── *.js                     ← scripts de efeito DMX (F1–F12)
├── shows/
│   ├── vp.show.json             ← show padrão carregado na inicialização
│   └── fixture_template.json    ← modelo aberto pelo fluxo "Criar novo aparelho (AI)"
├── .agents/                     ← skills dos agentes VS Code
├── skills/                      ← cópias/skills locais para agentes externos
├── README_SKILL.md              ← documentação estrutural para agentes
├── index.html
├── vite.config.js
└── package.json
```

## Mapa rápido de classificação

| Sintoma / pedido | Lado | Arquivo provável |
|---|---|---|
| Comportamento de cena/página, combinação de canais, estado global | backend | `showStore.js` (estado React) ou `electron/main.js` (engine/IPC) |
| Saída DMX, Art-Net, valores no universo, loop/fps | backend | `electron/engine/universe.js`, `engine.js`, `artnet.js` |
| Scripts de efeito F1–F12 | backend | `scripts/*.js` |
| Salvar/carregar show | backend | `electron/show.js` |
| Nova função exposta ao front (`window.vp.*`) | backend | `electron/preload.js` + `electron/main.js` |
| Layout, fader, botão, cor, espaçamento, modal, tabela visual | frontend | `src/screens/*.jsx` |
| Tela de aparelhos, editor de aparelho | frontend | `FixturePanel.jsx`, `FixtureEditor.jsx` |
| Aba de chat / menu de skills | frontend | `ChatPanel.jsx` |
| Navegação entre telas | frontend | `App.jsx` |

Atenção ao caso comum: `showStore.js` fica em `src/` mas é **lógica de estado (backend)** — o front consome esse estado, mas alterar a lógica de combinação de cenas é tarefa de `/desenvolvedor-backend-vplight`.