# Auditoria Completa — VP Light V2

> Auditoria **read-only** conduzida pelo Opus 4.8 (cérebro/análise) com o Codex‑XHigh como executor de leitura em largura (scripts, show.json, frontend).
> Nenhum arquivo do projeto foi alterado. Data: 2026-07-05.
> Todas as afirmações marcadas com `arquivo:linha` foram lidas diretamente no código; o que é interpretação/opinião está marcado como **[análise]**.

---

## 1. Resumo executivo

O **VP Light** é um software local de mesa de luz DMX, feito em **Electron + React**, para operação ao vivo (cultos da Igreja Vida e Paz). Ele monta um universo DMX de 512 canais e envia via **Art‑Net (UDP)** para um nó SL3000 que converte para DMX físico. Roda uma engine própria a **25 fps (40 ms/frame)** que compõe cenas, faders manuais, scripts de efeito (JavaScript por arquivo) e macros, aplica calibração física das ribaltas e transmite o frame. Uma janela 3D independente recebe o mesmo universo por IPC para preview.

**Estado geral: [análise]** o projeto é **coeso, bem comentado e maduro na camada de engine/backend**. O caminho crítico (universo → compositor por camadas HTP → interpolador → calibração física → Art‑Net) é sólido, determinístico (contagem por frames, não por `Date.now()`) e com boas decisões de robustez (buffers pré-alocados, escrita atômica do show, freeze que bloqueia só o UDP). O ponto mais frágil não é o engine em si, e sim **(a) a execução de scripts arbitrários dentro do processo main, na mesma thread do loop DMX**, e **(b) a complexidade acumulada de sincronização de cena/estado entre `main.js`, `showStore.js` e `Main.jsx`**.

**Principais riscos (detalhe nas seções 10 e 11):**
- **Crítico** — um script com laço infinito/pesado no `OnExecute` **congela toda a engine e o Art‑Net** (single-thread; `try/catch` pega exceção, não pega travamento).
- **Crítico/Live** — **Blackout e "Parar tudo" não têm confirmação** e estão em botão, barra de espaço e tela touch; um toque acidental apaga o palco no meio do culto.
- **Alto** — **validação de fixtures só ocorre no save**, não no load; um `show.json` editado à mão ou corrompido carrega e roda com endereçamento inválido.
- **Alto** — **macros salvas no show estão quebradas** (apontam para scripts inexistentes em `scripts/`); falham em silêncio.
- **Médio** — **dupla sincronização de cena** (`showStore` + `Main.jsx` chamam `restoreState`/`setActiveScenes`), risco de corrida/ordem.
- **Médio** — **UI otimista** pode divergir do universo real (fixtures não selecionadas ficam "stale").

**Pontos fortes a preservar:** engine 40 ms, compositor por camadas com envelope em frames, `universe.js` (offset lógico↔físico), `ribaltaPhysicalCalib.js` (soft-offset com joelho + gain), escrita atômica `.tmp`+`rename`, freeze de Art‑Net, isolamento renderer↔main via `preload.js`.

**Prioridade nº 1 de melhoria: [análise]** proteger o loop contra scripts que travam (watchdog/timeout por camada) e adicionar confirmação a ações destrutivas. Depois: unificar a sincronização de cena numa única fonte.

---

## 2. Mapa geral da arquitetura

### Componentes principais
```
┌─────────────────────────── RENDERER (React, sem acesso a hardware) ───────────────────────────┐
│  src/App.jsx  → roteia telas por estado local: main | fixtures | painel                        │
│  src/store/showStore.js → Context global (show, currentPage, activeScenes, seleção)            │
│  src/screens/ → Main.jsx (mesa), FixturePanel/FixtureEditor, PainelOperacao, SceneEditor*,     │
│                 Viewer3D.jsx (janela separada)                                                  │
└───────────────────────────────────────── window.vp.* ─────────────────────────────────────────┘
                                              │  (contextBridge — electron/preload.js)
                                              ▼
┌────────────────────────────────── MAIN PROCESS (Node.js) ──────────────────────────────────────┐
│  electron/main.js  → registra IPC, carrega show, compila/roda scripts, resolve aliases/offsets  │
│  electron/show.js  → load/save .show.json (validação + escrita atômica)                         │
│  electron/adapter.js, fixtureOffsets.js, ribaltaPhysicalCalib.js, engine/ribaltaDebug.js        │
│                                                                                                 │
│  engine/engine.js (loop 40ms) ─► interpolator.tick() ─► compositor.renderFrame() ─►             │
│        ─► sendArtDMX( ribaltaPhysicalCalib.getPhysicalUniverseForArtNet( universe ) )           │
│        ─► onFrame(listeners)  ── universo LÓGICO ──► janela 3D (IPC 'dmx-universe')              │
│  engine/universe.js → Uint8Array(512), offsets lógico↔físico                                    │
│  engine/compositor.js → camadas (script=camada), merge HTP/linear, macros, scene-lock           │
│  engine/artnet.js → UDP 6454: loopback + 1 socket por interface + fallback; freeze              │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │ UDP Art‑Net 6454
                                              ▼   SL3000 → DMX → fixtures
```
\* `SceneEditor.jsx` existe mas **não está roteado no `App.jsx`** (código presente, sem entrada de UI ativa) — ver §8.

### Fluxo Show File → Estado → UI → Salvamento
`app.whenReady` (`main.js:1571`) → `show.loadShow(DEFAULT_SHOW)` → `loadScriptMeta`/`loadPageScriptMeta`/`loadMacros` → `initializeOffsets` → aplica `startupChannels` (fecho_lampada=255 dos movings, `show.js:230`) → `applyDefaultStartupScene` (cena A da página 1) → `engine.start()`. No renderer, `showStore` chama `window.vp.getShow()` (`showStore.js:148`) e monta o estado. Salvar: `Main.jsx` → `showStore.saveShow` → `window.vp.saveShow` → `main.buildMergedShow` (merge de scripts/páginas/macros) → `show.saveShow` (valida + `.tmp`+`rename`).

### Fluxo Scripts → Engine → Canais
Toggle da F-key (`script:toggle`, `main.js:1214`) → `startScript` lê o `.js` do disco, **prepende `mov-preset.js`** se o nome começa com `mov-` (`main.js:1072`), compila via `new Function(...)` numa sandbox `{SetChannel, getChannel, adapter}` (`main.js:1052`), registra uma **camada** no compositor. A cada frame o compositor roda `OnExecute` de cada camada em seu próprio buffer, mescla por HTP (canal mais forte vence) só nos canais tocados, aplica guards (fixture desabilitada, scene-lock, interpolador) e escreve no universo (`compositor.js:215`).

---

## 3. Inventário de arquivos e áreas

| Área | Arquivo | Função |
|---|---|---|
| Bootstrap main | `electron/main.js` (1613 linhas) | IPC, ciclo de vida, compilação/execução de scripts, offsets, scene-lock, macros, watch de scripts |
| Bridge IPC | `electron/preload.js` | expõe `window.vp.*` (engine, dmx, show, scripts, page_scripts, macros, fixtures) |
| Persistência | `electron/show.js` | load/save `.show.json`, `validateFixtures`, cena default, startup channels |
| Tradução lógica→DMX | `electron/adapter.js` | `adapter.resolve(fixtureId, alias, adapterKey, valorLogico)` a partir de `fixture.adapters` |
| Offsets pan/tilt | `electron/fixtureOffsets.js` | mapa `{canal: offset}`; regra por nome hoje **vazia** (`FIXTURE_OFFSET_RULES={}`) |
| Calibração ribalta | `electron/ribaltaPhysicalCalib.js` | tilt lógico→físico (gain + soft-offset com joelho); só no caminho Art‑Net |
| Loop | `electron/engine/engine.js` | setInterval 40 ms; interpolator→compositor→artnet→onFrame |
| Estado DMX | `electron/engine/universe.js` | `Uint8Array(512)`, offsets, snapshot lógico, `detectConflicts` |
| Composição | `electron/engine/compositor.js` | camadas, envelope por frames, merge HTP/linear, macros, scene-lock |
| Rede | `electron/engine/artnet.js` | Art‑Net UDP: loopback + socket por interface + fallback; freeze |
| Interpolação | `electron/engine/interpolator.js` | speed virtual: pan/tilt suave por tick, canal virtual não vai ao DMX |
| Debug | `electron/engine/ribaltaDebug.js` | logs de Ribalta_2 sob `VP_RIBALTA_DEBUG=1` |
| Estado UI | `src/store/showStore.js` | React Context: `show`, `currentPage`, `activeScenes`, seleção; `SceneDmxSync` |
| Mesa | `src/screens/Main.jsx` (3126 linhas) | faders, cenas ASDFGHJKLZXCV, F1–F12, atalhos, blackout, freeze, teste, 3D |
| Aparelhos | `src/screens/FixturePanel.jsx` / `FixtureEditor.jsx` | CRUD de fixtures |
| Painel | `src/screens/PainelOperacao.jsx` (941 linhas) | painel de operação (touch) |
| Editor de cena | `src/screens/SceneEditor.jsx` | **não roteado** (ver §8) |
| 3D | `src/screens/Viewer3D.jsx`, `src/viewer3d/*` | preview 3D (janela separada) |
| Scripts ativos | `scripts/*.js` (15) | efeitos F1–F12 (mov-*, brut-*), `fire-base.js` (biblioteca **inerte**), `mov-preset.js` (preset injetado) |
| Scripts inativos | `scripts/backlog/**` | protótipos; alguns referenciados por macros quebradas |
| Show | `shows/vp.show.json` | show padrão (24 fixtures, 10 páginas, 12 cenas na pág.1, 12 F-keys, 2 macros) |
| Backups | `shows/vp.show_backup.json`, `*.bak_offset_*` | cópias **manuais** (não há rotação automática) |
| Ferramentas | `tools/sync-scripts.js`, setup win/linux | associação de scripts a F-keys; instalação |

---

## 4. Fluxo de execução ao vivo (runtime)

1. **A cada 40 ms** (`engine.js:40`): `ribaltaDebug.tickFrame()` → `interpolator.tick()` (avança pan/tilt suaves e grava no universo) → `compositor.renderFrame()` → `sendArtDMX(getPhysicalUniverseForArtNet(getUniverse()))` → notifica `frameListeners` com o **universo lógico** (janela 3D).
2. **Compositor por frame** (`compositor.js:215`): avança macros; para cada camada faz `tickEnvelope` (weight), zera buffer/touched e roda `OnExecute`; mescla HTP nos canais tocados; aplica scene-lock; remove camadas que terminaram fade-out.
3. **Operador aperta uma cena (letra):** renderer chama `activateScene`/`setActiveSceneChannels`/`restoreState`. Com scripts ativos, `restoreState` **mescla** (não faz blackout total) e pula canais ainda controlados por camadas (`main.js:395,413`). Sem scripts, faz `blackout` + reaplica a cena.
4. **Fader manual:** `dmx:setChannel` → `setDmxChannelRuntime` → decide entre canal virtual (speed), canal controlado (interpolador) ou `universe.setChannel` (`main.js:888`). Offset físico é somado no `universe.setChannel` e subtraído no snapshot (renderer sempre vê valor lógico).
5. **Script F-key:** vira camada; escreve por cima da base da cena nos canais que controla; ao parar, `OnTerminate` + flush do buffer ao universo, ignorando canais ainda dominados por outra camada (`compositor.js:141`).
6. **Blackout / Sem cena / Freeze:** blackout para todos os scripts + zera universo + reaplica baselines de offset. Freeze só suprime o envio UDP (engine, UI e 3D seguem).
7. **Art‑Net:** copia 512 bytes num pacote pré-alocado e envia para loopback + broadcast por interface; se `frozen`, retorna sem enviar (`artnet.js:237`).

---

## 5. Auditoria da engine / DMX / Art‑Net

**Funcionamento (bem estruturado):**
- Loop único a 25 fps, sem loops paralelos; a janela 3D reaproveita o mesmo ciclo via `onFrame` (`engine.js:28`, `main.js:288`). **[preservar]**
- `universe.js` valida canal (1–512) e normaliza valor (0–255) em toda escrita (`universe.js:24,32`). Separação **lógico↔físico** por offset é elegante e mantém o fader do operador em 0 mesmo com calibração aplicada.
- Compositor usa **contagem por frames** para fades (determinístico, imune a jitter de `Date.now()`), buffers pré-alocados (sem GC por frame), e HTP como default para crossfade sem "dip" (`compositor.js:22-28`). **[preservar]**
- `artnet.js` resolve corretamente o problema real de múltiplas interfaces no Windows (socket vinculado ao IP de cada interface), com re-enumeração a cada 10 s e recuperação do socket loopback após N erros. **[preservar]**
- `ribaltaPhysicalCalib.js` é a peça mais sofisticada: mapeia tilt lógico→físico com **gain** (erro que cresce) + **soft-offset com joelho** (erro constante sem zona morta), aplicado **só** no buffer de Art‑Net, sem contaminar cena/3D (`ribaltaPhysicalCalib.js:199`). **[preservar]**

**Frágil / risco:**
- **Scripts rodam na thread do loop.** `compileScriptContext` usa `new Function` e `OnExecute` é chamado dentro do `renderFrame` (`compositor.js:228`). O `try/catch` remove a camada em caso de **exceção**, mas **não protege contra laço infinito ou trabalho pesado** — isso trava o `setInterval`, e o Art‑Net para (palco congela no último frame). **Crítico para operação ao vivo.**
- **Guard de canais desabilitados é recomputado com frequência.** `getDisabledFixtureChannelSet()` percorre todos os fixtures a cada chamada e é invocado **por canal** em `setDmxChannelRuntime`/`isDmxChannelEnabled`/`filterDisabledFixtureChannels` (`main.js:802,823,827`). Numa cena de 92 canais isso multiplica varreduras. No compositor está correto (uma vez por frame via provider). **[análise]** ineficiência O(fixtures×canais) no caminho de cena; hoje tolerável (24 fixtures) mas é dívida.
- **`engine:stop` exposto** (`preload`? não — só `stopEngine`, `preload.js:38`) encerra o loop **e** fecha sockets, parando também a janela 3D. Não há UI óbvia chamando; risco baixo, mas é um botão de desligar tudo acessível por IPC.
- **`detectConflicts`** (`universe.js:160`) compara apenas cenas em `_activeScenesMap`; não detecta conflito cena×script×fader. É um detector parcial.

---

## 6. Auditoria de fixtures e endereçamento

Fonte: `shows/vp.show.json` (24 fixtures), lido integralmente pelo Codex‑XHigh. O campo de tipo usado é **`fixtureType`** (`type` está vazio em todos).

**Resumo de endereçamento (habilitados):** faixas `1‑8, 9‑16, 17‑24, 33‑40, 49‑56, 57‑64, 65‑72, 74‑81` (ParLeds), `123‑138` (Moving Head Beam 1), `171‑186` (Moving_Wosh, tipo `moving_head`), `203‑218` (Moving Head Beam 2), `258‑270`/`271‑283` (Ribalta_1/2), `400,401,402,410` (Mini Bruts), `404` (Fita).

**Achados:**
- ✅ **Sem sobreposição** entre fixtures habilitados; nada fora de 1–512; `channelCount` bate com `channels.length` em todos.
- ⚠️ **`startChannel` duplicado no canal 1:** `ParLed_Deluxe_1` (habilitado) e `parLed1` (`enabled:false`). Como um está desabilitado, `validateFixtures` aceita (`show.js:112`) e `getDisabledFixtureChannelSet` mantém 1–8 habilitado (regra: só bloqueia canal sem nenhum dono habilitado, `main.js:802`). Correto, porém é um fixture-fantasma que confunde. **Baixo.**
- ⚠️ **Gap no canal 73** entre `ParLed_Deluxe_9` (65‑72) e `ParLed_Deluxe_10` (start 74). Provavelmente intencional (patch físico), mas não documentado. **Baixo.**
- ⚠️ **`Moving_Wosh`** (`moving_head`, 171‑186, habilitado) ocupa 16 canais e **nenhum script o controla** (scripts miram `moving_head_beam`). É controlável só por fader manual — possível equipamento legado/fantasma reservando 16 canais no meio do patch. **[análise] Médio** (ocupa espaço e pode ser ligado por engano em cena/teste).
- ⚠️ **Aliases divergentes entre os dois Moving Head Beam:** Beam 1 usa `prism_1_rotation`/`prism_1_rotation_2`; Beam 2 usa `prism_rotation`/`focus`; **Beam 2 tem um alias final vazio `""`** (16º canal). `getFixtureAliasCandidates` (`main.js:1020`) já contorna parte disso com fallbacks (`prism`→`prism_1`, `dimmer`→`fecho_lampada`, etc.), mas o alias vazio pode casar por engano em buscas de alias vazio. **Médio.**
- ⚠️ **Ribaltas RGB estáticas 1‑4** e `ParLed_Deluxe_4` e `parLed1` estão `enabled:false` — cobririam 25‑32 e 284‑307. Não interferem, mas inflam o show. **Baixo.**

**Validações existentes:** `validateFixtures` (`show.js:87`) cobre `channelCount==channels.length`, `startChannel` inteiro ≥1, fim ≤512 e não-sobreposição entre habilitados. **Não valida** unicidade de aliases, `adapters`, nem canais das cenas. E **só roda no save** (ver §9). **[análise]**

---

## 7. Auditoria dos scripts

15 scripts ativos em `scripts/` (backlog fora do runtime). Todos implementam `OnStart/OnExecute/OnTerminate`, todos resolvem canais por `getChannel(fixtureId, alias)` (sem número mágico literal), e **nenhum** usa `Date.now`/`setTimeout`/`setInterval`/`require` — bom sinal de disciplina (evidência completa no relatório do Codex, §15).

**Por família:**
- **Moving (mov‑*):** trajetórias e descidas do Moving Head Beam; recebem `mov-preset.js` concatenado (`main.js:1072`). Muito estado manual (fases, ticks). Vários **nomes enganosos**: `mov-traj-rib-alto`, `mov-traj-rib-baixo`, `mov-desc-rib-reset` têm "rib" no nome mas **não tocam ribalta** (Codex confirmou por linha). **Baixo (confusão de operação).**
- **Bruts (brut‑*):** piscas dos Mini Bruts + fita; simples e seguros (valores fixos 200/0), zeram no `OnTerminate`. `brut-pisca-cruz`/`brut-pisca-lados` têm `SetChannel` sem clamp local, mitigado por constantes fixas — o clamp final existe no compositor/`SetChannel` da sandbox (`main.js:1057`). **Baixo.**
- **`mov-preset.js`:** duplo papel — biblioteca de helpers injetada **e** script F10 standalone com hooks próprios; misturar as duas responsabilidades é confuso. **Médio (manutenção).**
- **`fire-base.js`:** biblioteca rica (IDs, resolvers `fb_*`, cores via adapter, grupos, presets, movimentos, blackout) — **mas nenhum script ativo a usa** e ela **não é injetada** em lugar nenhum. É **código morto/uma migração inacabada** (confirmado pelos docs em `docs/planejamentos/plano-adapter-universal.md` e `docs/auditorias/*fire*`). **Médio (dívida).**

**Duplicação relevante [dívida]:** helper `ch(c,v)` com clamp e `lerp/clamp01/spulse` repetidos em todos os `mov-desc-*`; estrutura `DESCEND_TICKS/RESET_TICKS/LOOP` idêntica em 3 arquivos; a sequência MH de 8 fases duplicada em 3 arquivos de trajetória. Candidatos naturais a virar base comum — que é justamente o que `fire-base.js` pretendia ser.

**Riscos de script:**
- `brut-fita-full` mantém dimmer 200 enquanto ativo (esperado). Nenhum script identificado deixa canal "preso" após `OnTerminate` — todos zeram. **[análise] Baixo**, mas depende do `OnTerminate` rodar (garantido por `_removeLayerInternal`, `compositor.js:189`).
- **Conflito com cena:** `mov-desc-sync-loop` toca MH+ribalta+bruts+fita por frame — alto potencial de disputa com cenas; mitigado pelo scene-lock (cor/prisma) e pelo merge-sem-blackout do `restoreState`. **Médio.**

---

## 8. Auditoria do frontend

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

---

## 9. Auditoria de persistência e arquivos

- **Escrita atômica:** `saveShow`/`saveShowAs` gravam em `.tmp` e fazem `renameSync` (`show.js:186,205`) — evita `show.json` parcial/corrompido. **[preservar]**
- **Merge cuidadoso no save:** `buildMergedShow` (`main.js:585`) preserva scripts/páginas/macros do runtime do main sobre o snapshot possivelmente defasado do renderer; `show.saveShow` ainda preserva `scripts.color` e faz fallback se `scripts` vier `null` (`show.js:161`). Boa defesa contra apagar dados ao salvar. **[preservar]**
- **Validação assimétrica:** `saveShow`/`saveShowAs` chamam `validateFixtures`; **`loadShow` NÃO valida endereçamento** — só exige `version`, `fixtures`, `pages` (`show.js:133`). Um `show.json` editado à mão com sobreposição/estouro **carrega e roda**. **Alto.**
- **Backup:** os arquivos `vp.show_backup.json` e `*.bak_offset_*` são **cópias manuais**; não há rotação/backup automático antes de salvar. Perda de show por save ruim é possível (mitigada só pelo git). **Médio.**
- **Startup tolerante demais:** se `loadShow` lançar no boot, o `catch` (`main.js:1584`) só faz `warn` e o app segue com engine rodando **sem show** (universo vazio, sem scripts). **Baixo/Médio.**
- **Caminhos de script portáveis:** `loadScriptMeta` tenta o caminho absoluto salvo e cai para `<name>.js` relativo ao `SCRIPTS_DIR` (`main.js:697`) — bom para portabilidade entre PCs.
- **Versionamento:** `git status` no início mostrava docs deletados/movidos não commitados. `.bak` e `.tmp` no diretório `shows/` podem sujar o repo. **[análise] Baixo.**

---

## 10. Dívidas técnicas e problemas encontrados

| Sev. | Área | Problema | Evidência | Impacto | Sugestão |
|---|---|---|---|---|---|
| **Crítico** | Engine/Scripts | `OnExecute` roda na thread do loop; laço infinito/pesado trava engine e Art‑Net (try/catch só pega throw) | `compositor.js:228-236` | palco congela ao vivo | watchdog/timeout por camada; medir duração do frame e derrubar camada lenta; validar script antes de ativar |
| **Crítico** | UX/Live | Blackout e "Parar tudo" sem confirmação (botão, espaço, touch) | `Main.jsx:1179,1610`; `PainelOperacao.jsx:929,938` | apaga palco no culto | confirmação/hold, ou "undo" imediato do blackout |
| **Alto** | Persistência | `loadShow` não valida endereçamento (só save valida) | `show.js:133` vs `show.js:87` | show inválido roda | rodar `validateFixtures` também no load (modo aviso, não crash) |
| **Alto** | Macros | Macros do show apontam para scripts inexistentes em `scripts/` (estão no backlog) | show `macros` refs `mov-padrao-01..04`, `brut-*`; só `scripts/backlog/movings/mov-padrao-01.js` existe; `instantiateMacro` usa `SCRIPTS_DIR/<script>.js` (`main.js:1461`) | macro falha em silêncio | mover scripts p/ `scripts/`, ou validar refs e sinalizar na UI; macros sem UI (§preload "UI a fazer") |
| **Médio** | Frontend | Dupla sincronização de cena (`showStore` + `Main.jsx`) | `showStore.js:322`; `Main.jsx:750` | corrida/ordem | centralizar sync numa fonte única |
| **Médio** | Frontend | UI otimista sem checar `ok`; snapshot stale fora de teste/script | `Main.jsx:1208,563,1127` | UI diverge do palco | reconciliar com `getUniverse` periódico; tratar `ok:false` |
| **Médio** | Scripts | `fire-base.js` + backlog = migração inacabada/código morto | `fire-base.js` inteiro; não injetado | confusão/dívida | decidir: adotar fire-base como base comum e migrar, ou arquivar |
| **Médio** | Fixtures | `Moving_Wosh` habilitado e sem controle; alias `""` no Beam 2; aliases de prisma divergentes | show.json | canal ligável por engano / match errado | revisar patch; padronizar aliases; remover alias vazio |
| **Médio** | Persistência | Sem backup automático antes de salvar | `show.js:153` | perda de show | backup rotativo antes do rename |
| **Baixo** | Engine | `getDisabledFixtureChannelSet` recomputado por canal | `main.js:802,888` | ineficiência | memoizar por show carregado |
| **Baixo** | Frontend | `SceneEditor.jsx` órfão (não roteado) | `App.jsx`; `SceneEditor.jsx` | código morto | confirmar e remover ou religar |
| **Baixo** | Scripts | Nomes `*-rib-*` que não tocam ribalta | `mov-traj-rib-alto/baixo`, `mov-desc-rib-reset` | confusão | renomear |
| **Baixo** | Offsets | `fixtureOffsets.FIXTURE_OFFSET_RULES={}` (regra por nome desativada) | `fixtureOffsets.js:9` | passthrough — comentários podem enganar | documentar que a fonte é o show.json |

---

## 11. Riscos críticos para operação ao vivo (culto/evento)

1. **Script trava o palco** — laço/OnExecute pesado congela o loop e o Art‑Net. Mitigação atual: nenhuma contra travamento (só contra exceção). **Ação recomendada antes de mexer: watchdog.**
2. **Blackout/"Parar tudo" acidental** — sem confirmação, acessível por espaço e touch.
3. **Trocar/abrir show por engano** — botão "Abrir" sem prompt durante o culto.
4. **Blackout apaga o `fecho_lampada` dos movings** (universo→0). Re-acender depende da cena reaplicar `fecho_lampada=255`; lâmpadas de descarga têm delay de re-strike. **[análise]** sem um "lamp on" separado do blackout, um blackout no meio do culto pode deixar movings apagando/re-acendendo com atraso.
5. **Show inválido carregado** (edição manual/corrupção) roda sem validação no load.
6. **Macro quebrada** disparada não faz nada (silêncio) — operador espera efeito e não recebe.
7. **Divergência UI×palco** — cor/valor exibido pode não refletir o DMX real de fixtures não selecionadas.
8. **Dependência de rede** — se a interface do SL3000 mudar de sub-rede, o `refreshIfaceSockets` (10 s) recompõe sockets, mas há janela de até ~10 s; freeze e loopback ajudam mas não substituem o nó.

---

## 12. O que preservar (não reescrever sem necessidade)

- **`engine.js` loop único de 40 ms** e o padrão `onFrame` para a janela 3D.
- **`universe.js`** e o modelo lógico↔físico por offset (fader do operador sempre em valor lógico).
- **`compositor.js`**: camadas com envelope contado em **frames**, merge HTP como default, buffers pré-alocados, scene-lock de cor/prisma, flush no `OnTerminate` que respeita canais de outras camadas.
- **`ribaltaPhysicalCalib.js`**: soft-offset com joelho + gain, aplicado só no buffer Art‑Net (não contamina cena/3D).
- **`artnet.js`**: estratégia de socket por interface para o problema de múltiplas redes no Windows; freeze que bloqueia só o UDP.
- **`show.js`**: escrita atômica `.tmp`+`rename` e o merge defensivo de scripts/cores no save.
- **`preload.js`**: superfície `window.vp.*` bem isolada; `contextIsolation:true`, `nodeIntegration:false`.

---

## 13. Recomendações de melhoria

**Correções urgentes (antes do próximo culto crítico):**
1. **Watchdog de script**: medir o tempo de `OnExecute` por camada; se estourar um orçamento (ex.: 5–8 ms) derrubar a camada e avisar a UI. Opcional: validar/compilar o script num teste seco antes de ativar.
2. **Confirmação/hold** para Blackout, "Parar tudo", "Abrir show", "Limpar cena", "Remover fixture". Alternativa a confirmação: **undo** imediato do blackout.
3. **Validar endereçamento no load** (`validateFixtures` em modo aviso, sem derrubar o app) e sinalizar na UI.

**Curto prazo:**
4. Consertar/validar **macros**: mover os scripts referenciados para `scripts/` ou marcar refs quebradas; completar a UI de macro ou desabilitar o recurso.
5. **Unificar a sincronização de cena** numa única fonte (`showStore.SceneDmxSync` **ou** `Main.jsx`, não ambos).
6. Reconciliar UI com `getUniverse` periódico (mesmo leve) e **tratar `ok:false`** com feedback visual.
7. Revisar patch: decidir sobre `Moving_Wosh`, o alias `""` do Beam 2 e os fixtures `enabled:false`.

**Refatorações futuras:**
8. Decidir o destino do **`fire-base.js`/adapter universal**: adotar como base comum e migrar os `mov-*`/`brut-*` (elimina a duplicação de `ch/lerp/spulse/fases`), ou arquivar formalmente.
9. Memoizar `getDisabledFixtureChannelSet` por show carregado.
10. Separar `mov-preset.js` (biblioteca) do script F10 standalone.
11. Renomear scripts `*-rib-*` que não tocam ribalta.

**Documentação necessária:** patch DMX oficial (planilha canal→fixture→alias), contrato de um script (hooks + sandbox), e o modelo de calibração (offset vs gain vs knee).

**Validações automatizadas desejáveis:** teste de `validateFixtures` + um linter de show (sobreposição, aliases duplicados, refs de macro, cenas com canais fora de fixture habilitado) rodável por `node tools/…`.

---

## 14. Próximos checkpoints sugeridos (estabilização futura — não implementar agora)

- **CP‑1 (segurança ao vivo):** watchdog de script + confirmação/undo de blackout. Critério: script infinito não trava o Art‑Net; blackout acidental é reversível.
- **CP‑2 (integridade de dados):** validação no load (modo aviso) + backup rotativo antes do save + linter de show. Critério: show inválido é sinalizado, nunca silenciosamente rodado.
- **CP‑3 (consistência UI):** unificar sync de cena e reconciliar snapshot. Critério: UI reflete o universo real em qualquer estado.
- **CP‑4 (macros):** consertar refs + UI mínima ou desativar. Critério: nenhuma macro falha em silêncio.
- **CP‑5 (limpeza de scripts):** decisão fire-base + deduplicação + renomes. Critério: uma base comum, sem código morto ambíguo.

Cada checkpoint deve ser feito **isolado, com o palco de teste**, e validado no `Viewer3D` + saída Art‑Net antes de subir para operação real.

---

## 15. Delegações feitas ao Codex‑XHigh

| Tarefa delegada | Arquivos analisados | Resultado retornado | Como o Opus usou |
|---|---|---|---|
| **Auditar scripts ativos** (read-only) | 15 `.js` de `scripts/` (mov‑*, brut‑*, `fire-base.js`, `mov-preset.js`) | Tabela por script (hooks, uso de adapter, ids/canais fixos, risco); padrões duplicados; confirmação de que `fire-base.js` é inerte; nenhum `Date.now`/timer/require | Base da §7 e das dívidas de duplicação/código morto; cruzei com `main.js` (injeção de `mov-preset`, sandbox) |
| **Auditar show.json + fixtures** | `shows/vp.show.json`, `shows/fixture_template.json` | Inventário de 24 fixtures; mapa de endereçamento (sem sobreposição; dup no canal 1; gap no 73; `Moving_Wosh`); aliases dos movings/ribaltas; páginas/cenas; scripts/macros; alias `""` no Beam 2 | Base da §6 e §11; identifiquei as macros e cruzei com o filesystem (§10) |
| **Auditar frontend** | `App.jsx`, `showStore.js`, `Main.jsx`, `SceneEditor.jsx`, `FixturePanel.jsx`, `FixtureEditor.jsx`, `PainelOperacao.jsx` | Roteamento; Context global; faders otimistas; polling de `getUniverse`; tabela de riscos de UX; `SceneEditor` órfão; dupla sync | Base da §8 e dos riscos de §10/§11 |

O Opus leu diretamente (não delegou) todo o núcleo de runtime: `main.js`, `engine.js`, `compositor.js`, `universe.js`, `artnet.js`, `interpolator.js`, `show.js`, `adapter.js`, `fixtureOffsets.js`, `preload.js`, `ribaltaPhysicalCalib.js`, `ribaltaDebug.js`, `tools/sync-scripts.js` — para interpretar riscos com precisão.

---

## 16. Comandos executados

| Comando | Motivo | Resultado | Alterou arquivos? |
|---|---|---|---|
| `Glob **/*`, `Glob {electron,src,...}/**/*`, `Glob *.{js,json,...}` | inventário da estrutura real | mapa de pastas/arquivos | Não |
| `ls -la scripts/backlog/movings/` + `grep -o '"script":...' shows/vp.show.json` | confirmar refs de macro vs arquivos existentes | macros apontam para scripts ausentes em `scripts/` | Não (leitura) |
| Codex‑XHigh ×3 (`sandbox: read-only`, `approval-policy: never`) | varredura em largura (scripts/show/frontend) | relatórios com evidência | Não (sandbox read-only) |

Nenhum comando destrutivo, nenhum `git`/`npm`/build, nenhuma escrita no projeto além **deste relatório** em `docs/auditorias/`.

---

## 17. Conclusão final

- **O projeto está entendível?** Sim. A arquitetura é clara, bem comentada e com separação correta renderer↔main. O fluxo ponta a ponta está mapeado nesta auditoria com evidência de código.
- **Está seguro para mexer?** **Com cuidado.** A camada de engine/DMX é robusta e deve ser preservada. Os pontos sensíveis para qualquer mudança são: **(1)** a execução de scripts na thread do loop, **(2)** a sincronização de cena espalhada entre `main.js`/`showStore.js`/`Main.jsx`, e **(3)** o `restoreState` com merge condicional a scripts ativos. Mexer nesses três sem teste no palco é arriscado.
- **Áreas que exigem mais cuidado:** compositor/scene-lock, `restoreState`, offsets/calibração de ribalta, e o `Main.jsx` (3126 linhas, muito estado e atalhos globais).
- **Primeira melhoria recomendada:** **watchdog de script + confirmação/undo de blackout** (protege diretamente a operação ao vivo, com baixo acoplamento ao resto).
- **A pior coisa a fazer sem auditoria:** refatorar o `restoreState`/scene-lock ou a sincronização de cena "no susto", ou trocar o modelo de offset lógico↔físico — qualquer erro aí gera blackout errado, canal preso ou movings desalinhados **no meio do culto**. Também: apagar `fire-base.js`/backlog sem antes confirmar que as **macros** e uma futura base comum não dependem deles.

---
*Fim da Auditoria Completa — VP Light. Documento read-only; nenhuma alteração de código foi feita.*
