# Relatório técnico — Proposta: 3 fileiras de F-keys para paginação de scripts

**Data:** 2026-07-23
**Autor:** Análise assistida (Claude Code)
**Escopo:** UI de scripts (F1–F12) na tela `Main.jsx`, sem impacto em engine/DMX/Art-Net.

---

## 1. Contexto — como funciona hoje

A paginação de scripts é um sistema **independente** da paginação de cenas (`PgUp`/`PgDw`, cenas ASDFGHJKLZXCV). É um segundo eixo de páginas, dedicado só aos slots F1–F12.

### 1.1 Modelo de dados (`electron/scriptLibrary.js`)

```
scriptPages = {
  pages: [
    { id: 'page-1', name: 'Página 1', order: 1, slots: { F1: {type:'script', id:'parled_static'}, ... } },
    { id: 'page-2', name: 'Página 2', order: 2, slots: { ... } },
    ...
  ]
}
```

- Cada página tem seu **próprio** mapa de slots F1–F12, totalmente independente das outras.
- `minPages = 6` é imposto em `removePage` (não dá pra remover página se restarem ≤ 6) — bate com o que aparece no print (Página 1 a 6 + botão `+`).
- Não há limite máximo de páginas.
- Operações já existentes e prontas: `addPage`, `renamePage`, `reorderPages`, `removePage`, `associateEntry`, `moveEntry`, `unassignEntry`, `resolveScriptSlot`, `buildPageScriptsView` — todas por `pageId` arbitrário. **Nada aqui precisa mudar** para a ideia proposta.

### 1.2 IPC (`electron/main.js` + `preload.js`)

- `scriptPages:add/rename/reorder/remove`
- `scriptLibrary:associate/move/unassign`
- `script:toggleAt(pageId, slot)` → `window.vp.toggleScriptAt`
- `getAllPageScripts(pageId)` → busca os slots preenchidos de **uma** página por vez.

### 1.3 Frontend (`src/screens/Main.jsx` + `src/store/showStore.js`)

- `activeScriptPageId` (estado em `showStore.js:149`) guarda **uma única** página ativa.
- Efeito em `Main.jsx:743`: `window.vp.getAllPageScripts(currentPageId)` — **atenção**: isso na verdade usa `currentPageId` (o id da página de *cenas*, não de scripts) como parâmetro passado a uma chamada que parece de scripts. Vale confirmar se é bug ou uso intencional (ver seção 5, ponto de atenção).
- Renderização atual (`Main.jsx:2579-2657`):
  - **Fileira de abas** "Página 1..6" (`scriptPagesList.map`) — clique troca `activeScriptPageId`; badge vermelho mostra quantos scripts estão rodando naquela página (`scriptPageActivity`).
  - **Uma única fileira de F-keys** (`FKEYS.map`, 12 botões, `Main.jsx:2619-2656`) — renderiza `currentPageScripts[fkey]`, ou seja, os slots da página ativa.
  - Clique no F-key → `handleToggleScript(fkey)` → `toggleScriptAt(activeScriptPageIdRef.current, fkey)`.
  - Clique direito no F-key → menu de criar/editar/limpar script no slot.
  - Clique direito na aba de página → menu de renomear/remover página (`handleScriptPageRightClick`).
- `reorderScriptPages` já existe em `showStore.js:322` mas **não está conectado a nenhuma UI** hoje (sem drag-and-drop nas abas). É funcionalidade morta do ponto de vista de UI atual — relevante porque a nova proposta depende de reordenar páginas entre "bancos".

### 1.4 Restrição de espaço em tela

`electron/main.js:182-183` — janela padrão **1280×800**. A fileira de F-keys atual ocupa `minHeight:42`. Acrescentar 2 fileiras iguais (mais gap) soma aproximadamente **+80px de altura fixa**, num layout que já empilha: barra de páginas de cena, barra de cenas (`minHeight:58`), barra de abas de páginas de script, fileira de F-keys, além do painel de fixture/sidebar ao lado. Isso é o ponto de maior risco de UX da proposta (ver seção 4).

---

## 2. A ideia proposta (resumo para validar entendimento)

Em vez de 1 fileira de F1–F12 reaproveitada para as 6 páginas de scripts (troca por abas), a ideia é:

- Mostrar **3 fileiras de F-keys simultâneas** (F1–F12 × 3), cada fileira vinculada a **uma página de scripts diferente**.
- A fileira de baixo (a que já existe) continua sendo a "Página 1".
- Um botão alterna entre dois **bancos** de 3 páginas: banco A = páginas 1–3 (uma por fileira), banco B = páginas 4–6.
- Objetivo: acessar scripts de até 3 equipamentos diferentes **sem trocar de página**, eliminando o clique extra de "mudar de aba" toda vez que o script do próximo aparelho está em outra página.

Esse entendimento está correto e é tecnicamente viável com o modelo de dados atual, sem migração de schema.

---

## 3. Escopo técnico necessário para implementar

### 3.1 Frontend — `src/screens/Main.jsx`

1. **Substituir o bloco "PÁGINAS DE SCRIPTS" (abas) + "F-KEYS" (fileira única)** por um bloco novo:
   - 3 fileiras de 12 botões, cada fileira mapeada a `scriptPagesList[bankIndex*3 + rowIndex]`.
   - Cada fileira precisa buscar os scripts da sua própria página (hoje só existe `currentPageScripts` para uma página).
   - Um pequeno rótulo/handle por fileira (nome da página, ex.: "Página 1") no lugar das abas — mantém acesso ao menu de contexto (renomear/remover) que hoje vive na aba.
2. **Botão de alternância de banco** (ex.: "▲/▼" ou "Bank 1-3 / 4-6"), substituindo a navegação por abas individuais.
3. Indicador de atividade (`scriptPageActivity`) por fileira, não mais por aba — reaproveita `getPageActivitySummary` já existente.
4. Ajustar `handleToggleScript` / `handleScriptRightClick` para receberem também o `pageId` da fileira clicada (hoje dependem implicitamente de `activeScriptPageIdRef`, que deixa de fazer sentido como "página única ativa").

### 3.2 Estado — `src/store/showStore.js`

- **Substituir/estender** `activeScriptPageId` (página única) por algo como `scriptPageBankIndex` (0 ou 1, ou `0..N` se o número de páginas crescer além de 6).
- `toggleScriptAtActivePage` (`showStore.js:316-318`) hoje assume uma única página ativa — precisa virar `toggleScriptAtRow(pageId, slot)` recebendo o `pageId` explícito da fileira.
- Decidir o que substitui `activeScriptPageIdRef` nos handlers de teclado físico (se houver atalho de teclado que dispara scripts pela página ativa — checar se há binding de teclado global para isso, não identificado nesta análise superficial, vale conferir).

### 3.3 Seletor novo — `src/store/scriptPagesSelectors.js`

- Função utilitária para "agrupar em bancos de 3": `getScriptPageBanks(scriptLibrarySnapshot, bankSize = 3)` → `[[page1,page2,page3], [page4,page5,page6], ...]`.
- Precisa decidir política para número de páginas que não seja múltiplo de 3 (ex.: 7ª página criada via `+`) — ver decisão em aberto na seção 4.

### 3.4 Busca de dados — `Main.jsx` / `window.vp.getAllPageScripts`

- Hoje só se busca 1 página por vez. Com 3 fileiras visíveis, é preciso buscar 3 páginas em paralelo:
  - Opção simples (sem tocar IPC): disparar `getAllPageScripts(pageId)` 3× via `Promise.all` no `useEffect`.
  - Opção otimizada (toca IPC): criar `getPageScriptsBatch(pageIds[])` em `preload.js` + `main.js` para uma única viagem IPC. Não é obrigatório para o MVP, mas evita 3 round-trips a cada troca de banco.
- **Nenhuma mudança é necessária em `electron/scriptLibrary.js` nem em `electron/show.js`** — o modelo de slots por página já suporta isso nativamente.

### 3.5 Reordenar páginas entre fileiras/bancos

- Como cada fileira é fixa por posição (`bankIndex*3 + rowIndex`), o operador precisa poder **decidir qual página cai em qual fileira** (ex.: querer o equipamento X sempre na fileira do meio).
- `reorderScriptPages` já existe no store mas não tem UI. Escopo adicional: UI simples de reordenar (drag nas etiquetas das fileiras, ou um menu "mover página para cima/baixo" no menu de contexto já existente em `handleScriptPageRightClick`).

### 3.6 Sem mudanças necessárias em

- `electron/engine/*` (compositor, universe, artnet, interpolator) — a troca é puramente de apresentação/roteamento de qual página está visível; a execução de scripts (`script:toggleAt`) já é agnóstica a isso.
- `electron/show.js` (schema do show.json) — `scriptPages` já é uma lista de páginas com slots independentes.
- `shows/*.show.json` — nenhuma migração de dados necessária.

---

## 4. Decisões em aberto (validar antes de implementar)

1. **Orçamento de altura de tela**: 1280×800 já está com layout cheio (barra de páginas de cena + cenas + abas de script + F-keys + sidebar). Acrescentar +2 fileiras (~80px) pode empurrar conteúdo para fora da área visível em telas touch menores. Precisa de teste visual antes de codar em definitivo — talvez reduzir a altura de cada botão F-key (hoje 36–42px) para caber as 3 fileiras no mesmo espaço vertical, com texto menor.
2. **Mais de 6 páginas**: hoje não há teto. Se o usuário criar uma 7ª página (`+`), como isso aparece nos bancos? Opções:
   - (a) travar em exatamente 6 páginas (2 bancos fixos, remove o botão `+` ou bloqueia acima de 6);
   - (b) permitir N bancos de 3 e o botão de alternância cicla entre eles (1-3 → 4-6 → 7-9 → volta).
3. **O que substitui as abas clicáveis**: hoje dá pra ir direto pra "Página 4" com 1 clique. No novo modelo, se a página 4 está no banco B, o operador precisa 1 clique no botão de banco + já enxerga as 3 fileiras — ok. Mas se o usuário tiver o hábito de pular direto para uma página específica por nome, essa navegação nomeada precisa de um atalho equivalente (ex.: dropdown ou clique no rótulo da fileira abre um seletor de qual página ocupar aquela fileira).
4. **Bug/uso intencional a confirmar**: `Main.jsx:743` chama `window.vp.getAllPageScripts(currentPageId)` usando o id da **página de cena**, não `activeScriptPageId`. Isso parece inconsistente com o resto do código, que trata scripts como paginação separada de cenas. Recomendo confirmar com teste manual (mudar página de cena com PgUp e ver se a fileira de F-keys muda mesmo sem trocar de aba de script) antes de construir a feature nova em cima desse comportamento — se for bug, ele afeta diretamente qual página aparece nas fileiras.

---

## 5. Estimativa de esforço

| Item | Complexidade | Arquivos |
|---|---|---|
| Seletor de "bancos de páginas" | Baixa | `scriptPagesSelectors.js` |
| Estado de banco ativo + toggle | Baixa | `showStore.js` |
| Render de 3 fileiras + botão de banco | Média | `Main.jsx` (bloco ~2579–2657) |
| Busca paralela de 3 páginas | Baixa (ou média se criar IPC batch) | `Main.jsx`, opcional `preload.js`/`main.js` |
| UI de reordenar página → fileira | Média | `Main.jsx`, `showStore.js` (já existe `reorderScriptPages` no backend) |
| Ajuste de layout/altura para caber em 1280×800 | Média (depende de teste visual) | `Main.jsx`, possivelmente `theme.js` |

**Sem alterações em**: engine DMX, Art-Net, schema do show.json, `electron/scriptLibrary.js`, `electron/show.js`. É uma mudança concentrada em apresentação (React) + um ajuste pequeno de estado, o que mantém o risco baixo para o restante do sistema de iluminação.

**Recomendação de sequência**: validar decisão 1 (altura) com um protótipo visual rápido (só CSS, sem lógica nova) antes de implementar a lógica de bancos — é o maior risco de a ideia não caber fisicamente na tela do console.
