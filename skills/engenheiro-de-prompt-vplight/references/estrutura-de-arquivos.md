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
│       ├── compositor.js        ← camadas de scripts/macros
│       ├── universe.js          ← Uint8Array[512] dos canais DMX
│       ├── artnet.js            ← pacotes UDP Art-Net
│       └── interpolator.js      ← pan/tilt speed virtual
├── src/                         ← FRONTEND
│   ├── App.jsx                  ← roteador de telas
│   ├── main.jsx                 ← entry point React
│   ├── theme.js                 ← tokens visuais
│   ├── screens/
│   │   ├── Main.jsx             ← tela principal: mesa, faders, cenas, scripts, páginas
│   │   ├── FixturePanel.jsx     ← painel de aparelhos
│   │   ├── FixtureEditor.jsx    ← modal de edição
│   │   ├── PainelOperacao.jsx   ← painel de operação
│   │   └── Viewer3D.jsx         ← preview 3D (janela separada)
│   └── store/
│       └── showStore.js         ← estado global via React Context
├── scripts/                     ← BACKEND
│   └── *.js                     ← scripts de efeito DMX (F1–F12)
├── shows/
│   ├── vp.show.json             ← show padrão
│   └── fixture_template.json
├── skills/                      ← fonte oficial das skills dos agentes
├── README_SKILL.md
├── index.html
├── vite.config.js
└── package.json
```

## Mapa rápido de classificação

| Sintoma / pedido | Lado | Arquivo provável |
|---|---|---|
| Comportamento de cena/página, combinação de canais, estado global | backend | `showStore.js` ou `electron/main.js` |
| Saída DMX, Art-Net, freeze, valores no universo | backend | `electron/engine/*.js` |
| Scripts de efeito F1–F12 | backend | `scripts/*.js` |
| Salvar/carregar show | backend | `electron/show.js` |
| Nova função exposta ao front (`window.vp.*`) | backend | `preload.js` + `main.js` |
| Layout, fader, botão, cor, modal | frontend | `src/screens/*.jsx`, `theme.js` |
| Navegação entre telas | frontend | `App.jsx` |

Atenção: `showStore.js` fica em `src/` mas é **lógica de estado (backend)**.
