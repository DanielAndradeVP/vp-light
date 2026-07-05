# Auditoria — Escopo: Frontend (Renderer React)

> Extraído da Auditoria Completa — VP Light (2026-07-05). Documento read-only.
> Todas as afirmações marcadas com `arquivo:linha` foram lidas diretamente no código; o que é interpretação/opinião está marcado como **[análise]**.

---

## Auditoria do frontend

**Arquitetura:** `App.jsx` roteia por estado local `screen` (`main|fixtures|painel`) sob `ShowProvider`. Estado global é **React Context custom** (não Zustand) em `showStore.js`: `show`, `currentPage`, `activeScenes`, `selectedFixtureId`, `loading`, derivando `disabledFixtureChannels`.

**Mesa (`Main.jsx`, 3126 linhas):** cenas nas teclas `A S D F G H J K L Z X C V`; F1–F12 scripts; atalhos globais (números trocam página, espaço = blackout, `Q` = sem cena). Faders são **otimistas** (atualizam estado local e depois chamam `setChannel`, `Main.jsx:1208`). `getUniverse()` só faz polling contínuo (100 ms) **quando o painel de teste está aberto** (`Main.jsx:563`) ou **quando há script rodando e fixture selecionada** (`Main.jsx:1127`) — fora disso, fixtures não selecionadas podem exibir valor **stale**.

**Riscos de UX operacional (do relatório do Codex, verificados):**

| Risco | Onde | Impacto |
|---|---|---|
| **Blackout sem confirmação** (botão + barra de espaço) | `Main.jsx:1179,1610` | toque acidental apaga o palco |
| **Blackout / "Parar tudo" sem confirmação** (tela touch) | `PainelOperacao.jsx:929,938` | mata scripts e apaga cena ao vivo |
| **Abrir show sem confirmação** | `Main.jsx:1591` | troca de show durante o culto |
| **Limpar cena sem confirmação** | `Main.jsx:1006,2992` | apaga cena com um clique |
| **Mover cena sobrescreve destino** sem bloqueio | `Main.jsx:3117` | perde cena existente |
| **UI otimista diverge do backend** (não checa `ok`) | `Main.jsx:1208` | mostra valor não aplicado |
| **Snapshot não-contínuo** | `Main.jsx:563,1127` | cores stale de fixtures não selecionadas |
| **Dupla sincronização de cena** | `showStore.js:322` + `Main.jsx:750` | corrida/ordem inesperada |
| **`ok:false` só loga** | `Main.jsx:868,999` | operador não sabe que falhou |
| **Remover fixture sem confirmação** | `FixturePanel.jsx:91,217` | remove aparelho por engano |
| **`startChannel` sem validação no front** (só `channelCount` clampa) | `FixtureEditor.jsx:37,62` | patch inválido só barra no save do backend |

**`SceneEditor.jsx`:** implementado (preview via `setChannel`, `restoreState` ao abrir, `blackout` ao cancelar) mas **não importado/roteado** em `App.jsx` — a edição de cena hoje acontece dentro de `Main.jsx`. É código órfão a confirmar/remover. **Baixo.**

## Recomendações de melhoria (deste escopo)

1. **Confirmação/hold** para Blackout, "Parar tudo", "Abrir show", "Limpar cena", "Remover fixture". Alternativa a confirmação: **undo** imediato do blackout.
2. **Mover cena sobrescreve destino** sem bloqueio | `Main.jsx:3117` | perde cena existente
3. **Unificar a sincronização de cena** numa única fonte (`showStore.SceneDmxSync` **ou** `Main.jsx`, não ambos).
4. Reconciliar UI com `getUniverse` periódico (mesmo leve) e **tratar `ok:false`** com feedback visual.
5. `SceneEditor.jsx` órfão (não roteado) | `App.jsx`; `SceneEditor.jsx` | código morto | confirmar e remover ou religar
6. **`startChannel` sem validação no front** (só `channelCount` clampa) | `FixtureEditor.jsx:37,62` | patch inválido só barra no save do backend
7. **CP‑3 (consistência UI):** unificar sync de cena e reconciliar snapshot. Critério: UI reflete o universo real em qualquer estado.
