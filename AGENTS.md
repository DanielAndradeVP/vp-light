# Estrutura do projeto vp-light

## Pastas e arquivos principais

```
C:\vp-light\
├── electron/
│   ├── main.js          → processo principal: IPC, ciclo de vida, show, scripts, macros, aliases/offsets
│   ├── preload.js       → contextBridge: expõe window.vp.* para renderer (engine, dmx, show, scripts, fixtures)
│   ├── show.js          → load/save .show.json, validação no save, cena default e startupChannels
│   ├── adapter.js       → traduz alias lógico/adapters de fixture para canal/valor DMX
│   ├── fixtureOffsets.js→ offsets pan/tilt por canal (mapa lógico↔físico)
│   ├── ribaltaPhysicalCalib.js → calibração física das ribaltas no caminho Art-Net
│   └── engine/
│       ├── engine.js    → loop 40ms: ribaltaDebug + interpolator + compositor + Art-Net + onFrame
│       ├── compositor.js→ camadas de scripts/macros, envelopes, merge HTP/linear e scene-lock
│       ├── universe.js  → Uint8Array(512), offsets, snapshot lógico e detectConflicts
│       ├── artnet.js    → UDP Art-Net 6454; freeze bloqueia só saída UDP
│       ├── interpolator.js → pan/tilt speed virtual (canal virtual não sai no DMX)
│       └── ribaltaDebug.js → debug de Ribalta_2 via VP_RIBALTA_DEBUG=1
│
├── src/
│   ├── App.jsx          → roteador local de telas (main | fixtures | painel)
│   ├── main.jsx         → entry point React
│   ├── theme.js         → tokens visuais
│   ├── viewer3d-main.jsx→ entry point da janela separada do preview 3D
│   ├── store/
│   │   └── showStore.js → Context global: show, currentPage, activeScenes, seleção e SceneDmxSync
│   ├── screens/
│   │   ├── Main.jsx           → mesa, faders, cenas ASDFGHJKLZXCV, F1–F12, atalhos, blackout, freeze, 3D
│   │   ├── FixturePanel.jsx   → CRUD de aparelhos
│   │   ├── FixtureEditor.jsx  → modal de edição de fixture
│   │   ├── PainelOperacao.jsx → painel touch de operação
│   │   ├── SceneEditor.jsx    → editor implementado, mas não roteado no App.jsx
│   │   └── Viewer3D.jsx       → tela do preview 3D
│   └── viewer3d/
│       ├── scene.js           → cena/câmera/render do preview 3D
│       └── fixtures/          → modelos 3D de ribalta, parled, movinghead, minibrut e fita LED
│
├── scripts/
│   ├── *.js             → scripts ativos F1–F12; mov-*, brut-*, fire-base.js e mov-preset.js
│   ├── mov-preset.js    → preset injetado automaticamente em scripts mov-*
│   └── fire-base.js     → biblioteca de helpers atualmente inerte/não injetada
│
├── shows/
│   ├── vp.show.json     → show padrão (fixtures, páginas, cenas, F-keys e macros)
│   ├── fixture_template.json → template/base de fixture
│   ├── arquivo_migracao_lumikit.json → referência de migração Lumikit
│   └── vp.show_backup.json / *.bak_offset_* → backups manuais, sem rotação automática
│
├── tools/
│   ├── sync-scripts.js  → associação/sincronização de scripts com F-keys
│   └── setup/run/kill   → scripts auxiliares de instalação e ambiente dev
│
├── docs/
│   ├── auditorias/      → relatórios de auditoria e inventários técnicos
│   │   └── bateamento/  → diretório de bateamento dentro das auditorias
│   ├── planejamentos/   → planos técnicos e migrações
│   ├── relatorios/      → relatórios operacionais por fixture/área
│   └── arquivados/      → documentação antiga/consolidada
│
├── banco-de-conhecimento/ → fichas por tipo de fixture (moving, ribalta, par-led, brut, fita LED)
├── .agents/skills/      → única pasta oficial de skills do projeto (SKILL.md por pasta)
├── assets/icons/        → ícones do aplicativo
├── public/viewer3d/     → assets estáticos usados pelo preview 3D
├── index.html
├── vite.config.js
└── package.json
```

## Skills oficiais

A única pasta de skills do projeto é `.agents/skills/`. Se a skill não estiver em `.agents/skills/<nome>/SKILL.md`, ela não existe para este projeto. Qualquer outra pasta não é fonte de skills do projeto.

Skills atualmente presentes em `.agents/skills/`:

- Backend/engine: `desenvolvedor-backend`
- Frontend/UI: `desenvolvedor-frontend`
- Scripts DMX: `desenvolvedor-dmx-vplight`

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


## Escopo e Estrutura de Auditorias

Toda leitura de auditorias existentes ou escrita de novas auditorias deve seguir rigorosamente a estrutura de pastas e a semântica de classificação por volume e robustez de dados descrita abaixo:

### 1. Definição do Escopo Bruto (Exploração e Mina)
* **Diretório:** `docs/auditorias/exploracao/[nome-da-mina]/`
* **Regra:** O nível `exploracao` padroniza a fase de descoberta técnica. A variável `mina` representa o escopo bruto do projeto atual contido dentro desta fase. Este identificador deve estar predefinido antes de qualquer criação.

### 2. Auditorias de Grande Porte (Pepita Bamburro)
* **Diretório:** `docs/auditorias/exploracao/[nome-da-mina]/pepita-bamburro/`
* **Regra de Nomeação:** A pasta `pepita-bamburro` herda contextualmente o nome da `mina` definido no escopo bruto.
* **Conceito:** Reservado exclusivamente para a auditoria "maior e mais robusta", centralizando o relatório principal, mais denso e de maior impacto do projeto.

### 3. Auditorias de Médio Porte (Pepitas)
* **Diretório:** `docs/auditorias/exploracao/[nome-da-mina]/pepita-01/`, `docs/auditorias/exploracao/[nome-da-mina]/pepita-02/` ...
* **Conceito:** Destinado a relatórios sólidos e visíveis de forma isolada, mas de menor escala que o bloco principal, representando entregas valiosas, porém segmentadas.

---
⚠️ **Diretriz de Execução:** Antes de iniciar a escrita, valide se o caminho completo até a `[nome-da-mina]` dentro de `exploracao/` já existe. Toda `pepita-bamburro` criada deve estar obrigatoriamente vinculada a este escopo bruto predefinido.
