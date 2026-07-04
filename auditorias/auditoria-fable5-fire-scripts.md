# Auditoria rápida — VP Light (Fable 5)

## 1. Estado atual
Sistema funcional: Electron + engine 25fps (electron/engine/engine.js) → compositor → Art-Net. 14 scripts ativos em `scripts/`, 1 é biblioteca (`mov-preset.js`, injetada automaticamente só em `mov-*.js`). Show único em `shows/vp.show.json`. Migração Windows→Ubuntu recente, com resíduos.

## 2. Áreas analisadas
`scripts/` (14 arquivos), `scripts/backlog` (9, ignorado para uso), `electron/main.js` (1612 linhas — carga/watch/sandbox de scripts), engine (`compositor`, `universe`, `artnet`, `interpolator`, `ribaltaPhysicalCalib`), `shows/vp.show.json` (24 fixtures), `tools/`, `modo.js`.

## 3. Código morto/duplicado
- **Paths Windows mortos no show**: `vp.show.json` guarda `"file": "C:\\vp-light\\scripts\\..."` — em Linux só funciona pelo fallback `SCRIPTS_DIR/nome.js` (main.js:704-707). Limpar para guardar só o nome.
- **`lerp()` duplicado em 8 scripts** — deveria estar no preset.
- **IDs de fixture hardcoded em todos os 14 scripts** (`fixture_1780805067518_...`), inclusive nos `brut-*`, que **não recebem injeção do preset** (só `mov-*` recebe).
- **`sync-scripts.js` duplicado**: existe em `tools/` e `scripts/backlog/`.
- **`mov-preset.js` com papel duplo**: biblioteca injetada E script standalone registrado em F10 — smell; separar.

## 4. Bugs/riscos
- **ALTO — injeção por prefixo de nome**: scripts fire não chamados `mov-*.js` não recebem o preset silenciosamente (main.js:1071-1074). Precisa estender o mecanismo (por diretório ou marcador) antes de criar o pacote.
- **MÉDIO — paths absolutos Windows no show**: se o fallback falhar (rename), script some sem erro claro.
- **MÉDIO — `main.js` (1612) e `Main.jsx` (3337 linhas)**: risco de regressão em qualquer mexida; não refatorar agora, só não crescer.
- **BAIXO — valores DMX espalhados**: ticks/durações/velocidades mágicos por script (aceitável para efeito, mas posições de rig devem vir do preset — parte já vem via `MP_M1/MP_M2/MP_RIB`).

## 5. Padrões dos scripts atuais
- API sandbox: `OnStart()` + tick implícito, `getChannel(id, nome)` → índice, `SetChannel(idx, valor)`; checar `null` (fixture desabilitado).
- Relógio: 25fps, durações em ticks (40ms).
- Estrutura típica: constantes no topo → resolução de canais no `OnStart` → máquina de fases por tick → warmup (~50 ticks) antes de acender.
- Regra crítica já codificada: calibração física da ribalta é do engine (`ribaltaPhysicalCalib.js`) — **scripts nunca somam offset manual**.
- Convenção de nomes: `mov-*` (movings, com preset), `brut-*` (mini bruts, sem preset).

## 6. Plano em checkpoints
1. **Limpeza segura**: normalizar `file` no show para basename; remover duplicata `sync-scripts.js`; mover `lerp` e IDs de fixture para o preset.
2. **Estender injeção**: fazer `main.js` injetar base compartilhada em `pacote-de-scripts-fire/scripts/*.js` (por diretório, não por prefixo). Confirmar que o watch recursivo já cobre subpastas (usa `recursive: true` — cobre).
3. **Base central** `pacote-de-scripts-fire/base/` (ou `fire-base.js` no padrão de injeção): IDs de fixtures, canais, presets de posição/cor/velocidade, helpers (lerp, fases, flash), init/reset padrão.
4. **Estrutura do pacote**: `pacote-de-scripts-fire/scripts/fire-NN-nome.js`, nomes por categoria (pisca, chase, wash, traj, combo).
5. **50 scripts** (Sonnet 25 + Codex 25), cada um só com coreografia — zero valores de rig locais.
6. **Validação**: carregar cada script sem erro, `getChannel` não-null nos fixtures habilitados, sem canais fora da base, sem duplicação de efeito (matriz efeito × fixture × ritmo).
7. **Doc curta**: 1 README no pacote com API da base e tabela dos 50.

## 7. Critérios de aceite
- Corrigir uma posição/canal = editar **1 arquivo** (base), 0 dos 50 scripts.
- Nenhum ID de fixture ou canal DMX literal dentro dos 50 scripts.
- Todos os 50 com `OnStart` + warmup + reset limpo ao parar.
- 50 efeitos distintos (matriz de verificação preenchida).
- Sistema atual intacto: 14 scripts existentes seguem funcionando.

## 8. Próximos passos (Sonnet + Codex)
1. Sonnet: implementar checkpoints 1–4 (limpeza, injeção por diretório, base, estrutura) e validar com 2 scripts-piloto.
2. Dividir a matriz de 50 efeitos ANTES de codar (evita duplicação entre os dois).
3. Sonnet cria fire-01..25, Codex fire-26..50, ambos consumindo só a base.
4. Rodar validação (checkpoint 6) e gerar README.

## Arquivos-chave
- `electron/main.js:1069-1120` (injeção/compilação)
- `scripts/mov-preset.js` (modelo da base)
- `electron/engine/compositor.js` (camadas/HTP)
- `shows/vp.show.json` (fixtures/canais)
- `electron/ribaltaPhysicalCalib.js` (nunca duplicar nos scripts)
