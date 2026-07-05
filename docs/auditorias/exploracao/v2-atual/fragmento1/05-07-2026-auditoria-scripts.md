# Auditoria — Escopo: Scripts de Iluminação

> Extraído da Auditoria Completa — VP Light (2026-07-05). Documento read-only.
> Todas as afirmações marcadas com `arquivo:linha` foram lidas diretamente no código; o que é interpretação/opinião está marcado como **[análise]**.

---

## Auditoria dos scripts

15 scripts ativos em `scripts/` (backlog fora do runtime). Todos implementam `OnStart/OnExecute/OnTerminate`, todos resolvem canais por `getChannel(fixtureId, alias)` (sem número mágico literal), e **nenhum** usa `Date.now`/`setTimeout`/`setInterval`/`require` — bom sinal de disciplina (evidência completa no relatório do Codex).

**Por família:**
- **Moving (mov‑*):** trajetórias e descidas do Moving Head Beam; recebem `mov-preset.js` concatenado (`main.js:1072`). Muito estado manual (fases, ticks). Vários **nomes enganosos**: `mov-traj-rib-alto`, `mov-traj-rib-baixo`, `mov-desc-rib-reset` têm "rib" no nome mas **não tocam ribalta** (Codex confirmou por linha). **Baixo (confusão de operação).**
- **Bruts (brut‑*):** piscas dos Mini Bruts + fita; simples e seguros (valores fixos 200/0), zeram no `OnTerminate`. `brut-pisca-cruz`/`brut-pisca-lados` têm `SetChannel` sem clamp local, mitigado por constantes fixas — o clamp final existe no compositor/`SetChannel` da sandbox (`main.js:1057`). **Baixo.**
- **`mov-preset.js`:** duplo papel — biblioteca de helpers injetada **e** script F10 standalone com hooks próprios; misturar as duas responsabilidades é confuso. **Médio (manutenção).**
- **`fire-base.js`:** biblioteca rica (IDs, resolvers `fb_*`, cores via adapter, grupos, presets, movimentos, blackout) — **mas nenhum script ativo a usa** e ela **não é injetada** em lugar nenhum. É **código morto/uma migração inacabada** (confirmado pelos docs em `docs/planejamentos/plano-adapter-universal.md` e `docs/auditorias/*fire*`). **Médio (dívida).**

**Duplicação relevante [dívida]:** helper `ch(c,v)` com clamp e `lerp/clamp01/spulse` repetidos em todos os `mov-desc-*`; estrutura `DESCEND_TICKS/RESET_TICKS/LOOP` idêntica em 3 arquivos; a sequência MH de 8 fases duplicada em 3 arquivos de trajetória. Candidatos naturais a virar base comum — que é justamente o que `fire-base.js` pretendia ser.

**Riscos de script:**
- `brut-fita-full` mantém dimmer 200 enquanto ativo (esperado). Nenhum script identificado deixa canal "preso" após `OnTerminate` — todos zeram. **[análise] Baixo**, mas depende do `OnTerminate` rodar (garantido por `_removeLayerInternal`, `compositor.js:189`).
- **Conflito com cena:** `mov-desc-sync-loop` toca MH+ribalta+bruts+fita por frame — alto potencial de disputa com cenas; mitigado pelo scene-lock (cor/prisma) e pelo merge-sem-blackout do `restoreState`. **Médio.**

## Recomendações de melhoria (deste escopo)

1. Consertar/validar **macros**: mover os scripts referenciados para `scripts/` ou marcar refs quebradas; completar a UI de macro ou desabilitar o recurso.
2. Decidir o destino do **`fire-base.js`/adapter universal**: adotar como base comum e migrar os `mov-*`/`brut-*` (elimina a duplicação de `ch/lerp/spulse/fases`), ou arquivar formalmente.
3. Separar `mov-preset.js` (biblioteca) do script F10 standalone.
4. Renomear scripts `*-rib-*` que não tocam ribalta.
5. contrato de um script (hooks + sandbox)
6. **CP‑5 (limpeza de scripts):** decisão fire-base + deduplicação + renomes. Critério: uma base comum, sem código morto ambíguo.
