# Auditoria — Telas React (Renderer) e Store Global

> Auditoria **read-only**. Executor: subagente Claude (general-purpose). Auditor principal: Claude (Sonnet 5).
> Nenhum arquivo alterado. Data: 2026-07-24.
> `[fato]` = arquivo:linha. `[análise]` = interpretação.

Escopo: `App.jsx`, `Main.jsx` (3582 linhas), `PainelOperacao.jsx` (1078 linhas), `FixturePanel.jsx`, `FixtureEditor.jsx`, `SceneEditor.jsx`, `showStore.js`, `scriptClassification.js`, `scriptPagesSelectors.js`, `ScriptClassificationBadges.jsx`.

---

## Bugs reais

### [Crítico] `FixturePanel.jsx` — "Confirmar" ignora falha de salvamento
- [fato] `FixturePanel.jsx:102-105`: `saveShow()` (async) é chamada sem `await`/checagem de retorno; `onClose()` roda sempre. Compare com `FixtureEditor.jsx:79-83`, que faz a checagem corretamente com `window.alert`.
- [análise] Se uma edição de fixture gerar sobreposição de canal DMX (rejeitada por `validateFixtures`, electron/show.js:211-239), a tela **fecha como se tivesse salvo** — o show em disco não muda, sem nenhum aviso. Risco real se a equipe ajustar endereçamento minutos antes do culto.

### [Crítico] Nenhuma confirmação em nenhuma ação destrutiva do app inteiro
- [fato] `grep "window.confirm"` em todo `src/` → **0 ocorrências**. Sem confirmação: Blackout (`Main.jsx:1678-1680`, tecla `Space` `Main.jsx:1240`, botão touch `PainelOperacao.jsx:1039-1047`), "Parar tudo" (`PainelOperacao.jsx:1048-1055`), Remover aparelho (`FixturePanel.jsx:91-95`), Limpar cena (`Main.jsx:1053-1057`), Remover página de scripts (`Main.jsx:2757-2772`), Desassociar/Limpar script (`Main.jsx:2833-2861`).
- [fato, ponto positivo] O atalho `Space` para blackout já é protegido contra foco em campo de texto e contra auto-repeat (`Main.jsx:1206-1213`).
- [análise] No `PainelOperacao.jsx` (tela touch de operação ao vivo), BLACKOUT e "Parar tudo" ficam lado a lado, sempre visíveis, tamanho normal de botão — sem nenhuma barreira contra toque acidental. Situação idêntica à auditoria de 05/07, sem mudança.

### [Alto] Indicador de `blackoutActive` mente entre telas
- [fato] `Main.jsx:318` e `PainelOperacao.jsx:996` — cada um mantém `blackoutActive` como **estado local independente** (não vem do `showStore` nem da engine). `App.jsx:12-19` desmonta/remonta o componente ao trocar de tela.
- [análise] Cenário: operador ativa BLACKOUT no `PainelOperacao` (palco apagado), volta para `Main` (`←`) — `Main.jsx` remonta com `blackoutActive=false`, o botão mostra "inativo" mesmo com o palco realmente apagado (ou vice-versa). Risco de decisão errada do operador ao vivo.

### [Alto] Mapas de canal DMX hardcoded triplicados/quadruplicados (raiz da classe de bug já conhecida)
- [fato] Resolução de `startChannel+offset` está duplicada em pelo menos 4 lugares: `showStore.js:40-45`, `Main.jsx:1328-1333` (ativa), `SceneEditor.jsx:100,163` (inline), e **`src/viewer3d/scene.js:875-925`** (tabelas estáticas indexadas por `id` literal de fixture — pior caso, ver relatório de Viewer3D). Os próprios comentários do `scene.js` admitem que essa tabela já ficou errada uma vez (Mini_Brut 02/03) e precisou ser corrigida manualmente. Uma edição de fixture no `FixtureEditor` **não propaga** para o preview 3D.
- [fato] `Main.jsx:234-258` (`getFixtureDmxChannelList`/`getDisabledFixtureChannelSet`) é uma 5ª cópia dessa lógica, mas **inalcançável em runtime**: `Main.jsx:324` usa `storeDisabledFixtureChannels || getDisabledFixtureChannelSet(...)`, e o valor do contexto é sempre um `Set` (mesmo vazio = truthy) — o lado direito do `||` nunca executa. Código morto por trás de uma condição sempre verdadeira.

### [Médio] `parLedChs` enviado mas ignorado no backend
- [fato] `Main.jsx:383,794` monta e envia `parLedChs` a `window.vp.setActiveSceneChannels`; `electron/main.js:475` recebe como `_parLedChs` e nunca usa. O comentário em `Main.jsx:1339-1341` descreve um mecanismo de "coexistência cena+script para PAR LED" que **não existe de fato** no lock atual (`buildMovingHeadSceneLockState`, main.js:844-869, só trata `moving_head_beam`). A versão "oficial" em `showStore.js:383` nem envia esse segundo argumento — mais uma divergência entre as duas implementações duplicadas de sincronização de cena.

### [Médio] Comentário "único ponto de restoreState" está desatualizado
- [fato] `showStore.js:363` afirma ser o "único ponto de restoreState", mas há pelo menos 3 chamadores: `showStore.js:387`, `Main.jsx:795` (espelhado), e `resolveUniverseState()` em `Main.jsx:372-389` (chamado por blackout/toggle de script/page-script). Reforça e detalha o achado de "dupla sincronização de cena" já confirmado pela frente de Main/IPC.

### [Médio] Assimetria "Editar Script": bloqueado para F-key, liberado para cena
- [fato] `Main.jsx:3089` esconde "Abrir no VS Code" para F-keys atrás de `EXISTING_SCRIPTS_SHOW_VSCODE=false` (linha 22). Já o menu de contexto de scripts de cena (`Main.jsx:3184-3191`) chama `window.vp.editPageScript(...)` sem gate nenhum, e o handler correspondente funciona normalmente (main.js:1905-1910). Inconsistência provavelmente não intencional.

### [Médio] Hack hardcoded por ID literal de fixture no painel lateral
- [fato] `Main.jsx:2520-2524` — regex `/^fixture_1780805067518_parled_deluxe_[2-9]$/` com exceção manual para `_6`, para esconder o canal 8 na sidebar. Se essas fixtures forem removidas e recriadas (`FixturePanel.jsx:68` gera novo `id` via `Date.now()+random`), a regra para de funcionar silenciosamente.

---

## Código morto
- `SceneEditor.jsx` — **confirmado ainda não roteado** em `App.jsx` (só importa `Main`, `FixturePanel`, `PainelOperacao`). Mesmo se religado hoje, o comportamento não bateria com o app atual (ex.: dá blackout automático ao cancelar, diferente do fluxo real de `Main.jsx`).
- `Main.jsx:234-258` (ver "Bugs reais" acima) — inalcançável por `Set` sempre truthy.
- `scriptClassification.js:18-20` (`CATEGORY_OPTIONS`, `SPEED_OPTIONS`, `INTENSITY_OPTIONS`) — nunca importados; `Main.jsx:2903-2933` hardcoda a mesma lista inline nos `<select>` do modal "Editar Script". Duas fontes de verdade para o mesmo domínio.
- `toggleScriptAtActivePage` importado em `Main.jsx:315` mas nunca chamado ali (só `PainelOperacao.jsx:801` usa) — sinal de que as duas telas divergiram no modelo de seleção de página ativa de scripts.

## Pontos de melhoria
- Dois paradigmas diferentes de "página de scripts ativa" entre `Main.jsx` (3 fileiras simultâneas + bancos, estado local) e `PainelOperacao.jsx` (aba única, `activeScriptPageId` do contexto) — nunca colidem em runtime (telas não coexistem), mas divergem de modelo mental para o mesmo dado.
- Ausência sistemática de confirmação em ações destrutivas deveria virar um componente `ConfirmModal` reutilizável — o app já tem um bom exemplo (`exitModalOpen`, `Main.jsx:3263-3290`, "Sair do vp-light" com Sim/Não).

## Riscos operacionais ao vivo
- **Confirmado explicitamente**: a nova arquitetura de paginação de scripts (F1-F12 multi-página via `scriptLibrarySnapshot`) está consistente em ambas as telas, **sem nenhum resíduo do modelo antigo** de lista fixa F1-F12 (item pedido pela tarefa, checado e sem achado negativo).
- Blackout/Parar tudo sem confirmação (detalhado acima) — risco inalterado desde 05/07.
- Indicador de blackout que mente entre telas — risco de decisão errada do operador.
- Salvamento de fixture sem feedback de erro — risco de configuração corrompida silenciosamente pré-evento.
- Preview 3D pode divergir do DMX real após qualquer edição de fixture (não afeta a saída Art-Net real, mas afeta a confiança do operador no preview).

## Resumo priorizado

**Crítico**
1. Zero confirmação em ações destrutivas (Blackout, Parar tudo, Remover aparelho, Limpar cena, Remover página de scripts) em todo o app.
2. `FixturePanel.jsx` "Confirmar" ignora falha de `saveShow()` — pode fechar como se tivesse salvo mesmo com erro de validação.

**Alto**
3. `blackoutActive` é estado local por tela, reseta ao navegar entre `Main`/`PainelOperacao` — pode mentir sobre o estado real do palco.
4. Mapas de canal DMX duplicados em 4-5 lugares (incluindo o hardcoded de `viewer3d/scene.js`) — raiz de bugs já ocorridos (Mini_Brut, PAR LED).

**Médio**
5. `parLedChs` enviado mas ignorado no backend; comentário descreve mecanismo de coexistência cena+script inexistente.
6. Comentário "único ponto de restoreState" desatualizado (3+ chamadores reais).
7. Assimetria "Editar Script" F-key (bloqueado) vs. cena (liberado).
8. Hack hardcoded por ID literal de fixture na sidebar.

**Baixo**
9. `SceneEditor.jsx` continua não roteado.
10. Código morto: `getFixtureDmxChannelList`/`getDisabledFixtureChannelSet` locais inalcançáveis; opções de classificação duplicadas; `toggleScriptAtActivePage` importado sem uso em `Main.jsx`.
