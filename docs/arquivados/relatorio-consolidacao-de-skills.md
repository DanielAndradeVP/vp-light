# Relatório: Consolidação de Skills VP-Light — 2026-06-25

## 1. Todas as skills encontradas

### Escopo principal (consolidadas nesta tarefa)

| Caminho | Tipo | Ação |
|---------|------|------|
| `skills/desenvolvedor-backend-vplight/SKILL.md` | Backend | **OFICIAL** — reescrita |
| `skills/desenvolvedor-frontend-vplight/SKILL.md` | Frontend | **OFICIAL** — reescrita |
| `.agents/skills/desenvolvedor-backend-vplight/` | Backend | Removida (backup em archive) |
| `.agents/skills/desenvolvedor-frontend-vplight/` | Frontend | Removida (backup em archive) |
| `.claude/skills/desenvolvedor-backend-vplight/` | Backend | Removida (backup em archive) |
| `.claude/skills/desenvolvedor-frontend-vplight/` | Frontend | Removida (backup em archive) |

### Outras skills (duplicadas — fase 2)

| Skill | Localizações | Tipo |
|-------|--------------|------|
| `engenheiro-de-prompt-vplight` | skills, .agents, .claude | Prompts |
| `engenheiro-de-script-vplight` | skills, .agents, .claude + references | Scripts DMX |
| `engenheiro-de-normalizacao-vplight` | skills, .agents, .claude | Fixtures |
| `designer-de-cena-vplight` | skills, .agents, .claude | Criativo |
| `criador-de-tarefa-vplight` | skills, .agents, .claude | Notion |
| `fiscal-de-skills-vplight` | skills, .agents, .claude | Auditoria |
| `fiscal-do-sistema` | skills, .agents, .claude | Sync READMEs |
| `alinhador-de-sistema` | skills, .agents, .claude | Sync código |
| `gerador-de-prompts-vplight` | .agents, .claude | CoWork |
| `qa-vplight` | .claude (+ bugs.md) | QA |
| `create-skill` | .agents | Meta Cursor |

### Documentação correlata

- `README_SKILL.md` — fonte estrutural (atualizada v1.3)
- `README.md`, `AGENTS.md`, `CLAUDE.md` — atualizados
- `docs/auditorias/` — auditorias técnicas

---

## 2. Duplicatas backend/frontend

Cada skill existia em **3 cópias** quase idênticas (`skills/`, `.agents/skills/`, `.claude/skills/`). Conteúdo contradizia o código em:

- Loop engine (`compositor.getOutput()` vs `getUniverse()` + `interpolator`)
- IPC (`dmx:getSnapshot` vs `dmx:getUniverse`)
- Art-Net (só broadcast vs multi-interface + freeze)
- Ausência de Viewer 3D, PainelOperacao, congelar palco

---

## 3. Mantido como oficial

| Skill | Caminho |
|-------|---------|
| Backend | `skills/desenvolvedor-backend-vplight/SKILL.md` |
| Frontend | `skills/desenvolvedor-frontend-vplight/SKILL.md` |

Ambas com `skill-version: 2026-06-25`.

---

## 4. Removidos / arquivados

**Arquivo:** `docs/archive/skills-2026-06-25/` — backups `.agents.bak` e `.claude.bak`

**Removidos:**

- `.agents/skills/desenvolvedor-backend-vplight/`
- `.agents/skills/desenvolvedor-frontend-vplight/`
- `.claude/skills/desenvolvedor-backend-vplight/`
- `.claude/skills/desenvolvedor-frontend-vplight/`

---

## 5. Conteúdo final — skill backend (resumo)

Cobre: arquitetura Electron, engine 40ms (interpolator → compositor → artnet), freeze Art-Net, compositor/camadas, scripts OnStart/OnExecute/OnTerminate, IPC completo, show.json, fixtures reais, blackout vs freeze, viewer 3D via onFrame, cuidados palco real.

---

## 6. Conteúdo final — skill frontend (resumo)

Cobre: theme.js, telas (Main, FixturePanel, PainelOperacao, Viewer3D), estados visuais (cena, script, blackout, freeze), PgUp/PgDown, mesa draggable, modo grade, limites de escopo (só visual), IPC como consumidor.

---

## 7. Gaps pendentes

- **Outras 11 skills** ainda duplicadas em `.agents/` e `.claude/` — consolidação fase 2
- **ChatPanel** ainda referencia `.agents/skills/` — pode ser removido ou apontar para `skills/`
- **SceneEditor.jsx** — não roteado
- **Macros** — backend sem UI
- **qa-vplight/bugs.md** — só em `.claude/`
- **README_SKILL** — pode precisar de mais detalhe em Window/3D IPC tables §7

---

## 8. Recomendações de manutenção

1. Editar **somente** `skills/desenvolvedor-*` — nunca recriar cópias
2. Após mudanças em `electron/` → atualizar skill backend
3. Após mudanças em `src/screens/` ou `theme.js` → atualizar skill frontend
4. Rodar `fiscal-do-sistema` após mudanças estruturais no código
5. Rodar `fiscal-de-skills-vplight` contra `README_SKILL.md` §14
6. Reler `shows/vp.show.json` ao atualizar lista de fixtures na skill backend
7. Manter `skill-version` e data no frontmatter ao editar
