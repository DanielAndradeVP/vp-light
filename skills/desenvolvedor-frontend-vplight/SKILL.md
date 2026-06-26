---
name: desenvolvedor-frontend-vplight
description: "Desenvolvedor frontend sênior do vp-light — interface React/Vite, telas, componentes, theme.js, estados visuais, preview 3D. Use para: layout, botões, faders, modais, Main.jsx, FixturePanel, PainelOperacao, Viewer3D, congelar palco, blackout, cenas, F-keys, PgUp/PgDown, design system. Ativar com: interface, frontend, visual, layout, componente, tela, botão, fader, modal, theme, Congelar Palco, 3D, preview."
skill-version: "2026-06-25"
---

# desenvolvedor-frontend-vplight

Desenvolvedor frontend sênior do **vp-light** — responsável por **toda** a camada visual. Stack: React 18 + Vite 5, estilos **inline em JSX**, tokens em `src/theme.js`. Sem biblioteca de UI externa, sem CSS externo.

**Escopo:** interface, estado visual, interação, telas, painéis, preview 3D, comunicação com backend via `window.vp.*` (apenas consumo — não implementar IPC). **Não** cobre engine/DMX/Art-Net — use `desenvolvedor-backend-vplight`.

O visual **já está no padrão desejado**. Desenvolva em cima do design system existente; não migre para outro estilo.

**Regra de output:** "No arquivo X, localize Y, substitua por Z". Não reescreva arquivo inteiro sem necessidade. Não adicione dependências.

---

## Stack frontend

| Item | Valor |
|------|-------|
| Framework | React 18 |
| Build | Vite 5, porta 5173 em dev |
| Estado global | React Context — `src/store/showStore.js` |
| Estilo | Inline JSX + `src/theme.js` |
| 3D | Three.js em `src/viewer3d/scene.js` |
| Comando | `npm run dev` — hot reload em `src/**` sem restart |

**Não existe** pasta `src/components/` — telas ficam em `src/screens/`.

---

## Roteamento (`App.jsx`)

| Tela | Arquivo | Acesso |
|------|---------|--------|
| Mesa principal | `Main.jsx` | padrão |
| Aparelhos | `FixturePanel.jsx` | top bar "Aparelhos" |
| Painel de Operação | `PainelOperacao.jsx` | top bar "Painel de Operação" |
| Viewer 3D | `Viewer3D.jsx` | janela separada via `window.vp.open3DViewer()` |
| Editor de cena | `SceneEditor.jsx` | existe no código, **não roteado** |

---

## Design system — `src/theme.js`

Estilo **flat**, alto contraste, teal escuro. Cantos retos (`radius` 0–2px). Profundidade por cor/borda, não sombra (exceto modal).

### Paleta principal

| Token | Hex | Uso |
|-------|-----|-----|
| `bg` / `bgDarker` | `#26363c` / `#000` | fundos |
| `panel` / `panelDark` | `#35484f` / `#24343a` | painéis |
| `border` / `borderSoft` | `#8db8b8` / `#5f8588` | bordas |
| `accent` / `active` | `#00d000` / `#00ff00` | destaque verde |
| `warn` / `danger` | `#ff3333` / `#cc2222` | alerta, blackout, freeze |
| `text` | `#ffffff` | texto principal |

Tipografia: `Arial, Helvetica, sans-serif`, tamanhos densos 10–14px.

### Padrão de consumo

```js
import theme from '../theme.js';
const C = {
  bg: theme.colors.bgDarker,
  surface: theme.colors.panel,
  border: theme.colors.borderSoft,
  text: theme.colors.text,
};
```

Prefira `theme.components.*` (button, sceneButton, fKeyButton, panel, table, modal) quando existir.

---

## `Main.jsx` — layout principal

### Top bar

Botões: Salvar, Abrir, Aparelhos, Painel de Operação, Painel de Teste, 3D, **Congelar Palco**, SEM CENA, **BLACKOUT**.

Componente auxiliar: `TopBtn` — suporta `danger`, `active`, `accentActive`.

### Corpo

1. **Mesa de aparelhos** (esquerda) — fixtures draggables, rubber-band, snap grid 40px
2. **Painel direito** (redimensionável) — faders da fixture selecionada (cabeçalho "Descrição")

### Barra inferior

- **PgUp / PgDown** — navegação de páginas (1–10)
- **Teclas de cena** — `A,S,D,F,G,H,J,K,L,Z,X,C,V`
- **F-keys** — `F1`–`F12` para scripts globais

---

## Estados visuais importantes

### Cena ativa

- `activeScenes` no `showStore` — array de refs `pageId:sceneKey`
- Botão de cena com borda/destaque quando `activeSceneMatches(ref, currentPageId, key)`
- Máximo 3 cenas ativas (lógica no store/handlers)

### Script ativo

- Scripts F-key: estado `scripts` em `Main.jsx` (`running: true`)
- Page scripts: `pageScripts` por página
- F-key / tecla de cena com indicador visual de script vs cena

### Blackout

- Estado `blackoutActive` — botão `BLACKOUT` / `BLACKOUT ON` (vermelho, `danger`)
- Ao ativar: para scripts na UI e chama `window.vp.blackout()`
- **Não** é o mesmo que congelar palco

### Congelar palco

- Estado `artNetFrozen` — sincronizado com main via `getArtNetFrozen` no mount
- Top bar: `❄ CONGELAR PALCO` → ativo: `❄ PALCO CONGELADO` (`danger`, vermelho)
- Barra lateral do painel direito: botão `freeZe` — mesmo handler `handleToggleArtNetFreeze`
- IPC: `window.vp.setArtNetFrozen(next)` — **só bloqueia UDP Art-Net**
- UI, mesa, faders e **viewer 3D continuam** atualizando normalmente

### Viewer 3D

- Botão top bar `3D` / `3D (aberto)` — `window.vp.open3DViewer()`
- Janela separada; universo via IPC `onDmxUniverse`, não Art-Net
- `viewer3DActive` sincronizado com `onViewer3DClosed`

---

## Páginas vs cenas ativas

- `currentPage` no `showStore` — string `"1"`…`"10"`
- PgUp/PgDown alteram página na UI
- Ao mudar de página: `activeScenes` é **filtrado** para manter só cenas da página atual — cenas de outras páginas saem da seleção visual, **scripts F-key não são afetados**
- **Não confundir** mudança de página com desativar cena no palco — `resolveUniverseState` recalcula conforme cenas ainda ativas

---

## Mesa de aparelhos

- Grid 40px (`GRID` em `showStore.js`)
- Snap ao soltar; sem sobreposição visual durante arraste
- Rubber-band: arrastar área seleciona múltiplos; mover arrasta todos
- Clicar vazio desmarca seleção
- Botão lateral `mode` — alterna layout manual vs agrupado (`gridMode`, `mode2Layout`)
- Modo agrupado: `Z+`, `Z-`, `ZFit`, `GRADE`/`PADRÃO`, `ajuste`

---

## Painel direito — Descrição

- Faders dos canais da fixture selecionada (ou multi-seleção agrupada por label)
- Cores/valores acompanham `universeSnapshot` (polling `getUniverse`)
- Funções personalizadas por tipo (ex.: Ribalta ALL ON via `setChannelRange`)
- Speed virtual para moving/ribalta — `setFixtureSpeed` etc.

---

## `FixturePanel.jsx`

- Tela full-screen: tabela de fixtures
- CRUD: novo, editar, remover, duplicar
- **Criar (Manual):** abre `FixtureEditor.jsx`
- **Criar (AI):** abre `shows/fixture_template.json` no VS Code

---

## `FixtureEditor.jsx`

Modal com abas **Básico** e **Descrição** — campos de fixture (name, startChannel, channels[], group, etc.).

---

## `PainelOperacao.jsx`

Tela full-screen de operação — acessível pela top bar. Fechar volta para `Main`.

---

## Teclas de cena — menu de contexto

| Estado da tecla | Opções |
|-----------------|--------|
| Vazia | Salvar Cena, Criar Script |
| Com cena | Salvar, Mover para…, Limpar Cena |
| Com script | Editar Script, Remover Script |

Cena e script na mesma tecla são **mutuamente exclusivos**.

---

## Scripts — UI de criação

Modal com nome + **Banco de conhecimento** (checkboxes: Par LEDs, Ribaltas, Moving Heads, Bruts, Fita LED). Seleção visual apenas — IPC `script:create` com `options.groups`.

---

## Sincronização com backend (IPC)

O frontend **chama** `window.vp.*` — não implementa handlers.

| Ação UI | Chamada típica |
|---------|----------------|
| Fader ao vivo | `setChannel`, `setChannelRange` |
| Ativar cena | `toggleScene` (store) + `resolveUniverseState` |
| Blackout | `blackout()` |
| Congelar palco | `setArtNetFrozen(bool)` |
| Salvar show | `saveShow(showData)` |
| Toggle script | `toggleScript(fkey)` / `togglePageScript` |
| Universo para cores na mesa | `getUniverse()` periódico |

Alterações em `electron/preload.js` exigem restart do app.

---

## Princípios de UI para palco

- Contraste e legibilidade sob pressão primeiro
- Estados ativo/selecionado/desabilitado **inequívocos** — use `warn`/`danger` para freeze e blackout
- Densidade controlada nas barras de cena e F-keys
- Feedback visual em salvar/abrir (toast em `Main.jsx`)
- Hierarquia por luminosidade e borda, não sombra

---

## Limites — disciplina absoluta

Altere **apenas** apresentação: estilo, layout, tipografia, cor, estrutura JSX visual.

**Não tocar** (salvo pedido explícito):

- Lógica de handlers, `resolveUniverseState`, scripts, cenas
- `showStore.js` (lógica de estado)
- Qualquer arquivo em `electron/`
- `shows/vp.show.json`

---

## Comandos

```bash
npm run dev    # Vite + Electron — hot reload em src/
npm run start  # Electron direto
npm run build  # build produção
```

---

## Problemas conhecidos / pontos de atenção

- `SceneEditor.jsx` não está no roteador — não assumir que está acessível
- Botão lateral `BO` na barra do painel direito ainda sem handler (placeholder)
- Macros sem UI — só backend
- Ao mudar página, cenas de outras páginas somem da seleção — documentar para o operador

---

## Relação com skill backend

| Tópico | Frontend | Backend |
|--------|----------|---------|
| Congelar palco | botão + `artNetFrozen` | `artnet.setFrozen` |
| Blackout | botão + estado visual | `universe.blackout` + stop scripts |
| Scripts | F-keys, indicadores | compositor, `OnExecute` |
| 3D preview | botão abrir janela | `engine.onFrame` → IPC |

Para contratos IPC completos → `desenvolvedor-backend-vplight` ou `README_SKILL.md` §7.
