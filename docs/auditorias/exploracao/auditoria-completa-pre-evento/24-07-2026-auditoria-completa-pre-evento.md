# Auditoria Completa Pré-Evento — vp-light

> Auditoria **read-only** conduzida por Claude (Sonnet 5) como auditor principal (raciocínio, cruzamento de evidências, priorização), com **codex-xhigh** (2 frentes, até bater o limite de uso da conta) e **subagentes Claude** (5 frentes restantes) como executores de leitura em largura.
> Nenhum arquivo do projeto foi alterado. Data: **2026-07-24** — o relatório de prontidão de 23/07 registra o evento como sendo no dia seguinte, ou seja, **hoje**.
> Todas as afirmações citadas com `arquivo:linha` nos relatórios de área foram lidas diretamente no código; interpretação está marcada como `[análise]`.

**Cobertura**: todo `electron/` (main, preload, show, adapter, fixtureOffsets, ribaltaPhysicalCalib, scriptLibrary, scriptWatcherLogic, engine/*), todo `src/` (screens, store, viewer3d, components), todo `scripts/*.js` ativo, `shows/vp.show.json` completo (24 fixtures), os 4 commits mais recentes (`7fe113f`, `65b56e4`, `67bb327`, `b148e2c`), suíte de testes (142/142 passando), e varredura de TODO/console.log/debugger em todo o repositório. Relatórios detalhados por área em [`00-pepita-bamburro/`](00-pepita-bamburro/).

---

## 1. Resumo executivo

O sistema está **funcionalmente pronto e testado** (142/142 testes passando, build gerado com sucesso, nenhum TODO/FIXME/debugger esquecido no código) — mas esta auditoria encontrou **12 achados Críticos** e **~30 Altos** distribuídos por todas as camadas, vários deles com risco direto de operação ao vivo hoje. Nenhum é do tipo "o app não abre"; todos são do tipo "em uma condição específica, ao vivo, algo trava, apaga ou mostra o estado errado".

Dois padrões atravessam praticamente todos os relatórios de área e por isso ganham peso extra nesta síntese:

1. **Falta de isolamento na execução de scripts do usuário.** `new Function` roda scripts sincronamente na mesma thread do loop DMX de 40ms, sem watchdog/timeout. Encontrado de forma **independente por duas frentes diferentes** (engine core e main/IPC) — convergência que reforça a confiança do achado. Um script com laço infinito paralisa Art-Net, UI, blackout e o próprio botão de fechar o app.
2. **Fontes de verdade duplicadas para o mesmo dado.** A resolução de canal DMX (`startChannel`+offset) existe em pelo menos 4-5 lugares diferentes (`showStore.js`, `Main.jsx`, `SceneEditor.jsx`, e um mapa **hardcoded por ID de fixture** em `viewer3d/scene.js`); a sincronização de cena ativa é disparada de pelo menos 3 pontos (`showStore.js`, `Main.jsx`, `resolveUniverseState`). Essa duplicação já causou bugs reais no passado (troca de canal Mini_Brut, colisão macro/dimmer do PAR LED) — ambos confirmados corrigidos hoje, mas a estrutura que os produziu continua idêntica.

**Achado mais urgente para hoje**: o commit `b148e2c`, aplicado nesta reforma de páginas de script, **remapeou silenciosamente as teclas 1/2/3** (deixaram de trocar página de cena) e **dessincronizou o painel de operação touch (`PainelOperacao.jsx`) do novo modelo de páginas do `Main.jsx`** — sem menção na mensagem do commit, sem teste cobrindo. Ver seção 2.

---

## 2. Top 5 para checar/decidir HOJE antes do evento

Isto não é a lista completa (ver seção 3) — é o corte do que tem chance real de aparecer ao vivo nas próximas horas.

1. **Teclas 1/2/3 não trocam mais página de cena** — agora escolhem a fileira de F-keys "em uso" (introduzido por `b148e2c`, hoje/ontem). Se o operador confia em atalho de teclado por memória, avisar a equipe antes do culto. [`24-07-2026-auditoria-regressao-commits-testes.md`]
2. **O painel de operação touch pode mostrar uma página de scripts diferente da que está ativa na tela principal** após qualquer troca de banco/fileira em `Main.jsx` — checar visualmente as duas telas lado a lado antes de começar. [`24-07-2026-auditoria-regressao-commits-testes.md`]
3. **Nenhuma ação destrutiva tem confirmação** (Blackout, Parar Tudo, Remover aparelho, Limpar cena) — isso não é novo, mas o "Parar tudo" e "BLACKOUT" ficam lado a lado no painel touch. Instruir a equipe a ter cuidado físico com esses dois botões. [`24-07-2026-auditoria-frontend-store.md`]
4. **Duas macros salvas no show (`teste-0101`, `teste020202`) são 100% inoperantes** (apontam para scripts que não existem) — estão bloqueadas com segurança (não vão travar nada), mas não tentem usá-las achando que fazem algo. Considerar remover da lista para não confundir quem estiver operando. [`24-07-2026-auditoria-scripts-macros.md`]
5. **Ribalta_2 pode não estar com a calibração de gain que o comentário do código promete** (`gain:1` no código vs. `0.915` no comentário, divergência conhecida desde 19/07). Se o sintoma físico original (Ribalta_2 "adiantando" em relação à Ribalta_1 conforme sobe o tilt) ainda existir no rig, ele não foi corrigido pelo software. Vale um check visual rápido das duas ribaltas em movimento antes de subir ao vivo. [`24-07-2026-auditoria-adapters-fixtures-calibracao.md`]

Também vale saber, sem ação necessária: `fire-base.js` (a biblioteca para os futuros scripts `fire-*.js`) está corretamente implementada mas **nunca foi testada com um script real** — não tentem estrear um script `fire-*.js` novo, não testado, ao vivo hoje. E `adapter.setFocus`/`setFrost`/`setPrismRotation` (foco, frost e rotação de prisma dos Moving Head Beam) **vão quebrar com erro se algum script tentar usá-los** — os dados físicos estão prontos, mas a função não foi conectada à sandbox de scripts.

---

## 3. Achados críticos e altos consolidados (cross-referenciados)

### Crítico

| # | Achado | Área(s) | Convergência |
|---|---|---|---|
| C1 | Script com laço infinito/trabalho pesado em `OnExecute`/`OnStart`/`OnTerminate` paralisa toda a engine (Art-Net, UI, IPC, blackout) — `new Function` síncrono sem watchdog/timeout; `7fe113f` ("blinda engine") não resolveu isso. | Engine core + Main/IPC | **Achado idêntico, descoberto de forma independente por 2 frentes diferentes.** |
| C2 | Path traversal em `script:create`/`page_script:create`/passos de macro — nome/caminho não validado antes da escrita/execução; permite escrever e (via macro) executar arquivo fora de `scripts/`. | Main/IPC | — |
| C3 | Remoção/fade de camada de script pode reaplicar o efeito em 100% em vez de zerar — buffer/`touched` não são limpos antes de `OnTerminate`/flush; cenário oficialmente suportado (template gera `OnTerminate` vazio). Pode deixar canais "presos" no último efeito. | Engine core | — |
| C4 | Zero confirmação em qualquer ação destrutiva do app (Blackout, Parar Tudo, Remover aparelho, Limpar cena, Remover página) — `window.confirm` tem 0 ocorrências em todo `src/`. | Frontend | — |
| C5 | `FixturePanel.jsx` fecha a tela como se tivesse salvo mesmo quando `saveShow()` falha (ex.: canais sobrepostos) — sem `await`/checagem de retorno. | Frontend | — |
| C6 | `b148e2c` remapeou as teclas 1/2/3 (deixam de trocar página de cena) sem aviso e sem teste. | Regressão de commits | Ver seção 2, item 1. |
| C7 | `b148e2c` dessincroniza `PainelOperacao.jsx` do novo modelo de páginas de scripts de `Main.jsx`. | Regressão de commits | Ver seção 2, item 2. |
| C8 | `adapter.setFocus`/`setFrost`/`setPrismRotation` implementados, testados e com dados físicos prontos, mas **ausentes do objeto `adapter` injetado na sandbox de scripts** (`main.js:1060-1079`) — qualquer script real que os chame recebe `TypeError`. | Adapters/Fixtures | Testes unitários não pegaram porque testam o módulo isolado, não a sandbox — mesma classe de "lacuna de wiring" observada em C1/C2 (camada de dados/módulo pronta, camada de integração não). |

*(C2/C1 já contêm as duas descobertas independentes de "new Function sem isolamento" da tabela de riscos de segurança do relatório de Main/IPC — não repetidas aqui como itens separados.)*

### Alto (resumo — detalhes completos nos relatórios de área)

- **Engine**: salvar o show reseta o interpolador (movings saltam para zero, `speed`/`target` apagados) — risco direto de salvar durante o culto; Stop/Start perde permanentemente os sockets Art-Net por interface; modo `linear` de macro persiste após erro/término; troca de show não zera canais do show anterior; fixture desabilitada não é zerada; offsets saturados corrompem snapshot; hooks assíncronos escapam do isolamento; **Ribalta_2 com gain divergente do comentário (ver seção 2, item 5 — confirmado por 2 frentes: engine core e adapters)**.
- **Main/IPC**: fixtures sem validação no load (só no save); troca de show não limpa universo/scene-lock; load pode falhar depois de instalar parcialmente o show novo; "Limpar/Desassociar" script pode deixar camada DMX ativa e órfã; criação de script pode sobrescrever arquivo existente sem backup; save aceita schema incompleto; migração de schema não-transacional; sem `requestSingleInstanceLock` (2 instâncias = 2 engines brigando pelo Art-Net); Viewer 3D recebe o mesmo preload privilegiado da janela principal; build empacotado provavelmente não consegue salvar show/scripts (ASAR somente-leitura) — **verificar isso especificamente na versão instalada, não só rodando pelo repositório**.
- **Frontend**: indicador de `blackoutActive` é estado local por tela e mente ao navegar entre `Main`/`PainelOperacao`; mapas de canal DMX duplicados em 4-5 lugares (raiz dos bugs de canal já corrigidos); "Editar Script" funciona para cena mas está bloqueado para F-key.
- **Scripts/macros**: `mov-desc-branco.js` (tecla F5) tem glitch de luz acesa a cada ciclo (~12,4s) por falta de tempo de reposicionamento do motor; as 2 macros quebradas do show; `fire-base.js` nunca exercitado ponta a ponta.
- **Viewer3D**: `Moving_Wosh` (habilitada no show) não tem nenhuma representação no preview 3D; `scene.js` não lê o show.json em runtime (causa raiz da classe de bug de canal hardcoded).
- **Regressão**: `console.error` sem rate-limit nos novos try/catch de `engine.js` (risco de flood de log em falha recorrente); escopo do commit `b148e2c` maior do que a mensagem descreve.

### Médio / Baixo
Ver cada relatório de área — volume grande (dívida técnica, código morto, duplicação, validações incompletas) sem risco direto de operação ao vivo hoje. Destaques de código morto notáveis: `SceneEditor.jsx` não roteado (desde 05/07, ainda assim); `scripts/backlog/` e `scripts/casamento/` não existem mais (mecanismo de exclusão no código ficou órfão); ~16 canais IPC sem consumidor no renderer; `removeLayer()`/`applyScene()`/`restoreState()` exportados no engine sem uso real.

---

## 4. O que está genuinamente bem

- **Testes**: 142/142 passando, suíte roda em <2s, sem regressão introduzida pelos commits recentes.
- **Zero TODO/FIXME/HACK/XXX/`debugger`** esquecido em todo o código de produção.
- **Bugs de canal do 3D relatados em 23/07 (Mini_Brut 02/03, colisão macro/dimmer PAR LED Layout A) — confirmados corrigidos**, verificação campo a campo contra o show.json real.
- **Mapeamento físico dos Moving Head Beam 1 e 2 — dados corretos e sem colisão** (validado programaticamente contra as 7 tabelas de capability de cada um).
- **Macros com script inexistente já não falham mais em silêncio** — bloqueadas com erro explícito e visível na UI antes de tentar rodar (correção anterior, ainda válida).
- **`package.json`/`vite.config.js`/scripts de `tools/`** (exceto `sync-scripts.js`) sem problemas de higiene.
- **`fire-base.js`**: mecanismo de auto-injeção reativado corretamente, sem bug de duplicação — só falta ser exercitado com um script real.

---

## 5. Índice dos relatórios detalhados (`00-pepita-bamburro/`)

1. [24-07-2026-auditoria-engine-core.md](00-pepita-bamburro/24-07-2026-auditoria-engine-core.md) — engine/compositor/universe/artnet/interpolator/calibração física (executor: codex-xhigh)
2. [24-07-2026-auditoria-main-ipc-persistencia.md](00-pepita-bamburro/24-07-2026-auditoria-main-ipc-persistencia.md) — main.js/preload.js/show.js, segurança (executor: codex-xhigh)
3. [24-07-2026-auditoria-adapters-fixtures-calibracao.md](00-pepita-bamburro/24-07-2026-auditoria-adapters-fixtures-calibracao.md) — adapter semântico, profiles, calibração de ribalta
4. [24-07-2026-auditoria-scripts-macros.md](00-pepita-bamburro/24-07-2026-auditoria-scripts-macros.md) — scriptLibrary, scripts F1-F12, macros, fire-base
5. [24-07-2026-auditoria-frontend-store.md](00-pepita-bamburro/24-07-2026-auditoria-frontend-store.md) — telas React, showStore
6. [24-07-2026-auditoria-viewer3d.md](00-pepita-bamburro/24-07-2026-auditoria-viewer3d.md) — preview 3D
7. [24-07-2026-auditoria-regressao-commits-testes.md](00-pepita-bamburro/24-07-2026-auditoria-regressao-commits-testes.md) — regressão dos 4 commits mais recentes, testes, build, tooling

---

## 6. Nota metodológica

O plano original era usar **codex-xhigh** como executor único das 7 frentes (regra do projeto para auditorias). O codex-xhigh entregou as 2 primeiras frentes (engine core, main/IPC) com achados densos e precisos, e então **atingiu o limite de uso da conta ChatGPT/Codex** (retoma só em 2026-07-29). As 5 frentes restantes foram migradas para subagentes Claude em paralelo, seguindo o mesmo protocolo de evidência (`[fato]`/`[análise]`, `arquivo:linha`, leitura integral dos arquivos-alvo, cruzamento com `shows/vp.show.json`). Onde as duas fontes de execução (codex e Claude) encontraram o mesmo problema de forma independente — caso do risco de script sem isolamento (C1) e da divergência de gain da Ribalta_2 —, isso é destacado explicitamente acima como reforço de confiança do achado.
