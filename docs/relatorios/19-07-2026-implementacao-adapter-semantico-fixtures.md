# Relatório de Implementação — Adapter Semântico de Fixtures (VP-LIGHT)

> Data: 2026-07-19. Coordenador: Sonnet 5 principal. Executor de código: MCP `codex-high`. Revisor técnico independente: subagente Sonnet 5 (esforço high), obrigatório em todo checkpoint de risco.
> **Status: P0 completo. P1 parcial (dimmer/PAR/Viewer3D críticos feitos; strobe/prism/gobo bloqueados pelo data gate do Moving 1, que continua sem medição física).**

---

## 1. Commit-base e branch

- Commit-base: `ea96866` (HEAD de `feature/scripts-pages-hotreload`, série de páginas/hot reload/macros já concluída e enviada ao GitHub nesta mesma sessão de trabalho — não havia conflito real de concorrência, o "outro agente" era este mesmo processo em turno anterior).
- Branch nova: `feature/semantic-fixture-adapter`, criada com `git worktree add -b feature/semantic-fixture-adapter <dir> ea96866` — worktree físico separado (`C:\Users\Admin\Documents\repositorios\vp-light-adapter-worktree`), sem tocar a working tree da branch anterior.
- 9 commits: Checkpoints 0 a 6 e 8 (Checkpoint 7 não existe como commit — bloqueado por data gate, ver §9).

## 2. Delta desde a auditoria (`cac5cba` → `ea96866`)

A auditoria de referência (`docs/auditorias/exploracao/adapter-fixtures/19-07-2026-auditoria-completa-adapter-capabilities-fixtures.md`) foi produzida no commit `cac5cba`. Comparado a `ea96866`: `electron/adapter.js`, `electron/show.js`, `electron/fixtureOffsets.js`, `electron/ribaltaPhysicalCalib.js`, `electron/engine/interpolator.js`, `shows/vp.show.json`, `scripts/fire-base.js`, `scripts/mov-preset.js` e `src/viewer3d/` estavam **byte-idênticos** ao commit auditado — só `electron/main.js`, `electron/engine/compositor.js` e `electron/preload.js` mudaram, e nenhuma dessas mudanças tocou a cadeia de resolução de canal/fixture/adapter (confirmado por grep no diff). As conclusões técnicas da auditoria sobre essa cadeia continuavam válidas, **com uma exceção encontrada por investigação direta**: a auditoria afirmava `channelCount:16` divergindo de "17 aliases" nos moving heads — verificado programaticamente que `channels.length` bate exatamente com `channelCount` (16) nos dois beams, e `validateFixtures()` já lançaria exceção nesse caso (o show carrega hoje sem erro). Nenhuma correção foi necessária nesse ponto — documentado no plano (§1.3) para não repetir a suposição.

## 3. Arquitetura implementada

**Profile por modelo + calibração por instância** (Opção F da auditoria, decisão já fechada, não rediscutida):
- `electron/fixtureProfiles/` — módulo puro (sem `require('electron')`, sem I/O): `movingHeadBeam1.js`, `movingHeadBeam2.js`, `parLedDeluxeLayoutA.js`, `parLedDeluxeLayoutB.js` (um por modelo/layout real confirmado), `index.js` (registro, resolução de profile por fixture via assinatura estrutural — tipo + nome ou presença/ausência de alias —, validação de schema).
- `shows/vp.show.json` continua a fonte de dados de instância (`startChannel`, offsets, `fixture.adapters.color` — o mesmo formato que já existia, sem reescrita de schema).
- **Sem migração obrigatória do show.json**: nenhuma fixture precisou ganhar um campo novo para ser identificada — resolução por heurística (tipo + nome para moving heads; presença/ausência de alias `color_wheel`/`white` para os dois layouts de PAR LED). Campo opcional `fixture.profileId` existe como escape hatch para o futuro, não usado hoje.
- `electron/adapter.js` estendido (mantendo `resolve`/`normalizeKey`/`clampDmx` inalterados) com 8 funções semânticas por injeção de dependência (`getFixture`, `getChannelByAlias`, `isEnabled`, `writeChannel`) — mesmo estilo de `resolve`, 100% testável sem Electron.
- `electron/main.js` (`buildScriptSandbox`) expõe as 8 funções no objeto `adapter` injetado nos scripts, reusando a MESMA `SetChannel`/`getFixtureChannelByAlias`/`isFixtureEnabled` já usadas pela API antiga — nenhum caminho de escrita paralelo, nenhuma duplicação de offset/calibração/interpolador.

8 ADRs registrados no plano (`docs/planos/adapter-semantico/19-07-2026-plano-pratico-implementacao-adapter-semantico.md`), cobrindo: separação lógica pura/escrita; resolução de profile sem migração; `setDimmer`/`setMovementSpeed` sem exigir profile; `setPanTilt` em valores DMX crus (não normalizados) por segurança; tabela padrão de RGB para PAR LED (matemática de cor, não dado medido); tratamento do Moving 1 como `mapping-incomplete`; papel do `fire-base.js`; local/schema dos profiles.

## 4. API final

```js
adapter.resolve(fixtureId, alias, adapterKey, logicalValue)   // INALTERADO — legado
adapter.setColor(fixtureId, colorName)          -> Result
adapter.setDimmer(fixtureId, intensity0to1)     -> Result
adapter.setMovementSpeed(fixtureId, speed0to1)  -> Result   // 0=rápido,1=lento
adapter.setPanTilt(fixtureId, { pan, tilt })    -> Result   // RAW 0-255 por eixo
adapter.setStrobe(fixtureId, intent)            -> Result   // sempre CAPABILITY_NOT_MAPPED hoje
adapter.setPrism(fixtureId, intent)             -> Result   // idem
adapter.setGobo(fixtureId, gobo)                -> Result   // idem
adapter.getCapabilities(fixtureId)              -> introspecção
```
`Result` nunca lança exceção: `{ok:true, ...}` ou `{ok:false, code, fixtureId, capability, requestedValue, message}`. Códigos: `FIXTURE_NOT_FOUND`, `FIXTURE_DISABLED`, `PROFILE_NOT_FOUND`, `PROFILE_INVALID`, `CHANNEL_NOT_FOUND`, `CAPABILITY_NOT_SUPPORTED`, `CAPABILITY_NOT_MAPPED`, `VALUE_NOT_SUPPORTED`, `INVALID_VALUE`, `MAPPING_INCOMPLETE` (este último como valor de `status`, não como `code` de chamada — ver plano §6). Diagnóstico rate-limited (3s por combinação fixtureId+capability+code), nunca mais de 1 log a cada 3s por essa chave — confirmado sob carga de 144 mil chamadas no smoke test (§10).

Guia completo para autores de scripts: `docs/planos/adapter-semantico/19-07-2026-guia-api-semantica-para-scripts.md`.

## 5. Compatibilidade

`SetChannel`, `getChannel`, `adapter.resolve` permanecem exatamente como antes. Os 15 arquivos em `scripts/` (14 ativos + `fire-base.js` inerte) foram recompilados contra a sandbox estendida — todos compilam sem erro, hooks detectados corretamente, nenhuma mudança de comportamento (verificado via reprodução fiel de `readScriptCode`/`compileScriptContext`, já que `electron/main.js` não pode ser importado fora do Electron). `fire-base.js` **não foi tocado nem reativado** (ADR-7) — continua opcional/inerte, decisão documentada, não é dependência do núcleo.

## 6. Mapeamento do Moving 1

**Não medido nesta sessão** — o template `docs/auditorias/exploracao/adapter-fixtures/19-07-2026-template-mapeamento-moving-1.md` continua com todas as células de valor vazias (confirmado por leitura direta duas vezes, no início e ao final da implementação). Profile (`movingHeadBeam1.js`) existe e declara `pan`/`tilt`/`dimmer`/`movementSpeed` como `ready` (já funcionam via canal/offset/interpolador existentes, não são capability nova) e `color`/`strobe`/`prism`/`prismRotation`/`gobo` como `mapping-incomplete`. A tabela antiga de 8 cores que já existia em `shows/vp.show.json` para essa fixture **não foi apagada** (preserva `adapter.resolve()` legado) mas também **não é tratada como confirmada** — `adapter.setColor('Moving Head Beam 1', ...)` sempre retorna `CAPABILITY_NOT_MAPPED` hoje, nunca usa esses valores antigos silenciosamente (ADR-6).

## 7. Mapeamento do Moving 2

**Reconciliado nesta sessão.** `shows/vp.show.json` — `adapters.color` do Moving Head Beam 2 substituído pelos 15 pontos medidos fisicamente pelo operador (passo de 10), substituindo a tabela antiga de 8 valores (passo de 16/32): `white:0, red:10, yellow:20, purple_medium:30, green:40, blue_dark:50, white_ice:60, amber_1:70, white_warm:80, orange:90, purple_dark:100, blue_light:110, amber_2:120, yellow_2:130, purple_light:140`. Os dois "âmbar" da anotação original tratados como pontos distintos (`amber_1`/`amber_2`), não como duplicação de anotação — decisão explícita, não uma suposição. Confirmado que nenhum script ativo referenciava os valores antigos (só `fire-base.js`, inerte, usa `adapter.resolve` com cor). `color`, `dimmer`, `movementSpeed`, `pan`, `tilt` = `ready`; `strobe`/`prism`/`gobo` = `mapping-incomplete` (nenhum valor confirmado para nenhum dos dois moving heads).

## 8. PAR LED — Layout A e Layout B

Dois layouts reais confirmados diretamente no `show.json` (contradizendo `banco-de-conhecimento/par-led.md`, que descreve os 9 PARs como idênticos):
- **Layout A** (`ParLed_Deluxe_1/5/7` + `ParLed_Deluxe_9_extra`, id `..._parled_deluxe_6`): `dimmer,strobo,macro,macro_speed,red,green,blue,white` — RGBW.
- **Layout B** (`ParLed_Deluxe_2/3/4/8/9`): `macro,color_wheel,speed,dimmer,red,green,blue,""` — RGB.

`adapter.setColor(fixtureId, colorName)` funciona nos dois, usando uma tabela padrão de cores RGB (`red, green, blue, white, yellow, cyan, magenta, purple` — definição matemática do espaço aditivo de cor, não dado medido do equipamento, ADR-5), sempre zerando os canais de cor antes de aplicar a nova (nunca mistura com o estado anterior). `white` usa o canal dedicado no Layout A (branco "de verdade") e mistura RGB (`r=g=b=255`) no Layout B (única forma fisicamente possível sem canal branco). Testado com dados reais do show (`tests/adapter-real-show.test.js`) para as duas instâncias reais de cada layout.

## 9. Pan, tilt e movement speed

Preservados via mecanismo já existente (interpolador, offsets) — `adapter.setPanTilt`/`setMovementSpeed` são wrappers finos sobre `getChannel`+`SetChannel`, sem duplicar offset/calibração/interpolador (confirmado por revisão independente linha a linha). `setPanTilt` aceita valores DMX crus 0-255 por eixo (não normalizado) — decisão deliberada (ADR-4): normalizar exigiria dados físicos do Moving 1 que não existem, e M1/M2 giram ângulos diferentes (450° vs 540°), então um 0-1 linear seria inventado, não medido. `setMovementSpeed` preserva a convenção `0=rápido,1=lento` do interpolador sem inverter. Ambos testados em moving heads (via `virtual_speed`), ribalta (canal físico direto), mini brut e fita de LED (`setDimmer` apenas, `setMovementSpeed` não se aplica) — todos sem exigir profile registrado (ADR-3).

## 10. Strobe

**Não mapeado.** Estrutura já existe (`setStrobe` resolve fixture, profile, capability, checa `status`) mas nenhum moving head tem faixa de strobo confirmada — sempre `CAPABILITY_NOT_MAPPED`. Confirmado por revisão que, quando os dados chegarem, só o `status` do profile precisa mudar (nenhuma mudança de código em `adapter.js`).

## 11. Prism

**Não mapeado**, mesma situação do strobe. `PRISM_READY` (M1 e M2) = `false`.

## 12. Gobo

**Não mapeado**, mesma situação. `GOBO_READY` (M1 e M2) = `false`.

## 13. Fire-base

**Decisão documentada, arquivo intocado** (ADR-7): `scripts/fire-base.js` permanece opcional e inerte (não injetado automaticamente pelo runtime). Já tem a forma certa (helpers sobre `getChannel`/`SetChannel`/`adapter.resolve`) para futuramente consumir a API semântica nova, mas migrá-lo/reativá-lo é trabalho de uma fase futura, não bloqueante para os 50 scripts novos (que podem chamar `adapter.setColor()` etc. diretamente).

## 14. Viewer3D

Duas correções críticas aplicadas em `src/viewer3d/scene.js` (Checkpoint 8), ambas revisadas e aprovadas independentemente:
1. **Mini_Brut_02/03**: canais estavam trocados em relação ao show real (`402`/`401` → corrigido para bater com `startChannel` real de cada unidade).
2. **PAR LED Layout A** (unidades 1, 5, 6, 7): a tabela `PARLED_CHANNELS` assumia a estrutura do Layout B para essas 4 unidades (que na verdade são Layout A) — `dimmer`/`red`/`green`/`blue` corrigidos para os canais reais (a unidade 7 tinha até `macro` e `dimmer` colididos no mesmo canal 49, um bug real eliminado). As chaves `macro`/`color_wheel`/`speed` foram **removidas** (não corrigidas) para essas 4 unidades — o comportamento de macro/strobo do Layout A nunca foi medido/documentado (só o Layout B tem a tabela confirmada em `banco-de-conhecimento/par-led.md`); simular um comportamento não confirmado seria pior do que cair no modo RGB direto já seguro em `parled.js`.

**Não corrigido nesta sessão (dívida documentada)**: canal `white` (RGBW) nunca é lido no preview do Layout A (exigiria lógica de blend nova em `parled.js`, não só dado de tabela); divergência cosmética de rótulo (o preview mostra "ParLed_Deluxe_6" para a fixture cujo nome real no show é "ParLed_Deluxe_9_extra" — o `id`/canal já está correto, só o texto do rótulo diverge); divergência Viewer3D pré/pós-calibração física de ribalta (Viewer3D lê o universo lógico, Art-Net usa a cópia calibrada — comportamento documentado desde a auditoria original, não tocado); divergência de `gain` da Ribalta_2 entre código (`1`) e documentação (`0.915`) — fora do escopo do adapter, é calibração física de ribalta.

## 15. Testes

**131 testes automatizados, 10 arquivos, 100% passando** (85 herdados da branch anterior + 46 novos desta implementação: 11 de `fixture-profiles.test.js`, 21 de `adapter-semantic.test.js`, 14 de `adapter-real-show.test.js`). Nenhum teste envia Art-Net. Cobertura:
- Profiles: validação de schema, resolução por heurística (tipo/nome/alias), profileId explícito, fixture nula/sem channels, capability rgb/rgbw com canal pendente vs. pronto.
- Adapter (fakes sintéticos): cor enumerada e RGB/RGBW, zeragem de canais, branco dedicado vs. misturado, dimmer, movement speed (convenção preservada), pan/tilt cru, strobe/prism/gobo mapping-incomplete, `getCapabilities`, `FIXTURE_DISABLED`, `CAPABILITY_NOT_SUPPORTED` vs. `CAPABILITY_NOT_MAPPED`, diagnóstico rate-limited.
- Adapter contra `shows/vp.show.json` **real** (não fakes): Moving 2 com os 15 valores novos, Moving 1 recusado, PAR Layout A e B reais, fixture desabilitada real (`ParLed_Deluxe_4`), fallbacks reais de dimmer/speed do moving head, ribalta/mini brut/fita LED sem profile, Moving_Wosh falhando honesto (sem inventar canal).

## 16. Build

`npm run build` (`vite build` + `electron-builder`) — sucesso, instalador NSIS gerado sem erros, em todos os checkpoints finais desta sessão.

## 17. Smoke tests

- Recompilação dos 15 scripts reais (`scripts/*.js`) contra a sandbox estendida — todos OK, hooks detectados corretamente, `fire-base.js` confirmado sem hooks (inerte).
- Teste de performance: 1000 frames simulados × 18 fixtures habilitadas × 8 funções semânticas = 144.000 chamadas em 469ms (0,47ms por frame em média, ~1,2% do orçamento de 40ms) — muito acima da margem necessária para uso real por frame (um script real chamaria poucas funções em 1-2 fixtures por frame, não todas em todas). Diagnóstico rate-limited confirmado funcionando sob essa carga (não gerou milhares de logs repetidos).
- Migração/carregamento do show real (com a cor nova do M2) validado via `electron/show.js` puro (sem Electron) em cópia temporária — `validateFixtures()` passa, 24 fixtures intactas.
- **Boot completo do Electron NÃO foi possível nesta sessão** — `ELECTRON_RUN_AS_NODE=1` fixado neste ambiente sandboxed impede `app`/`BrowserWindow` reais (mesma limitação já registrada no relatório da série anterior de páginas/hot reload). Não contornado.

## 18. Validação física

**Não realizada nesta sessão** — não há hardware físico conectado a este ambiente. Nenhuma transmissão Art-Net ocorreu em nenhum teste ou smoke test.

### Roteiro de validação física recomendado (baixa agressividade, ordem sugerida)

1. Dimmer baixo em uma fixture por vez (`adapter.setDimmer`, intensidade ~0.2) — confirmar resposta física antes de qualquer outro teste.
2. Cor: `adapter.setColor('Moving Head Beam 2', 'green')` — confirmar visualmente que o color wheel bate no ponto esperado (canal 203, valor 40); repetir para 2-3 outras cores da tabela nova.
3. `adapter.setColor` em um PAR de cada layout (ex.: `ParLed_Deluxe_1` e `ParLed_Deluxe_2`) com a mesma cor — confirmar resultado visual equivalente apesar do mecanismo diferente (RGBW vs RGB).
4. Movement speed em faixa segura (0.3-0.5) no Moving Head Beam 2 — confirmar que a convenção `0=rápido,1=lento` corresponde à experiência física esperada.
5. Pan/tilt dentro dos limites já conhecidos (`banco-de-conhecimento/moving.md` — ex. "frente" pan 84/tilt 32 no M2) — não usar valores fora do já mapeado.
6. **Não testar** `setStrobe`/`setPrism`/`setGobo` fisicamente ainda — sempre retornam erro estruturado, nada será transmitido.
7. Moving 1 e Moving 2 simultaneamente com a mesma intenção de dimmer/velocidade — confirmar múltiplas fixtures sem interferência.
8. PAR Layout A e Layout B simultâneos com a mesma cor — confirmar visualmente.
9. **Quando o Moving 1 for medido fisicamente**: preencher o template já existente (`19-07-2026-template-mapeamento-moving-1.md`), atualizar `movingHeadBeam1.js` (só o profile e, se aplicável, `shows/vp.show.json`), rodar os testes de novo, e só então avançar para strobe/prism/gobo (Checkpoint 7, ainda pendente).

## 19. Capabilities prontas vs. incompletas

| Capability | Moving 1 | Moving 2 | PAR Layout A | PAR Layout B | Ribalta/MiniBrut/Fita | Moving Wosh |
|---|---|---|---|---|---|---|
| `color` | mapping-incomplete | **ready** | **ready** | **ready** | sem profile (PROFILE_NOT_FOUND) | sem profile |
| `dimmer` | ready | ready | ready | ready | **ready** (sem profile, ADR-3) | sem canal (CAPABILITY_NOT_SUPPORTED) |
| `movementSpeed` | ready | ready | — (sem canal) | — (sem canal) | **ready** (ribalta; sem profile) | sem canal |
| `pan`/`tilt` | ready | ready | — | — | — | — (fora do núcleo, ver §21) |
| `strobe` | mapping-incomplete | mapping-incomplete | mapping-incomplete | mapping-incomplete | sem profile | sem profile |
| `prism`/`gobo` | mapping-incomplete | mapping-incomplete | não suportada (PAR não tem) | não suportada | sem profile | sem profile |

## 20. Riscos restantes

- Nenhum script ativo depende do adapter semântico hoje — risco de regressão em produção é nulo (confirmado por grep, nenhum `SetChannel` hardcoded com os valores antigos de cor do M2, `fire-base.js` continua inerte).
- `_lastDiagnosticAt` (Map de rate-limit em `adapter.js`) cresce por combinação única de fixtureId+capability+code — teoricamente ilimitado, praticamente bounded pelo conjunto finito de fixtures/capabilities/códigos do show (~20×8×9), sem risco real de vazamento de memória (validado sob 144 mil chamadas repetidas — o Map não cresceu além do esperado, já que as chaves se repetem).
- Divergência cosmética de rótulo no Viewer3D (`ParLed_Deluxe_6` vs. nome real `ParLed_Deluxe_9_extra`) — não afeta canal/DMX, só o texto exibido.

## 21. Itens P2 (não implementados, fora do escopo desta tarefa)

Fine channels/16-bit para pan/tilt; registry completa com introspecção avançada/editor visual; importação automática de manual de fabricante; RDM, curvas avançadas de dimmer, zonas mortas configuráveis via UI; unificação dos resolvedores paralelos do renderer (`Main.jsx`, `SceneEditor.jsx`, `viewer3d/scene.js`) numa única fonte de profile; suporte formal ao Moving Wosh (CMY, zoom — hoje fora do núcleo, `setDimmer`/`setMovementSpeed` falham honestamente nele); reescrita/reativação de `fire-base.js` sobre a API nova; canal `white` do Viewer3D; correção do rótulo cosmético do Viewer3D; migração dos 14 scripts legados para a API semântica (não obrigatória); criação dos 50 scripts novos (fora do escopo desta implementação).

## 22. Rollback

```
git worktree remove C:/Users/Admin/Documents/repositorios/vp-light-adapter-worktree
git branch -D feature/semantic-fixture-adapter   # se necessário descartar tudo
```
`feature/scripts-pages-hotreload` e `main` não são afetadas por nenhuma ação desta tarefa. Reverter só os checkpoints mais recentes:
```
git reset --hard c2eff27   # volta pro Checkpoint 4, descarta 5/6/8
git reset --hard eea20a9   # volta pro Checkpoint 6, descarta 8
```

## 23. Status real para iniciar os 50 scripts

**Pronto para os scripts que usam**: cor no Moving Head Beam 2 e em qualquer PAR LED (os dois layouts), dimmer e velocidade de movimento em qualquer fixture com esses canais, pan/tilt cru nos dois moving heads. Isso já cobre uma fração relevante dos 50 scripts planejados (qualquer efeito de cor/dimmer/movimento nos equipamentos já mapeados).

**Ainda bloqueado**: qualquer script que precise de cor no Moving Head Beam 1, ou de strobe/prisma/gobo em qualquer moving head — aguardando medição física (template já pronto, arquitetura já pronta para receber os dados sem reescrever nada).

**Implementado e testado automaticamente**: toda a arquitetura de profiles, a API semântica completa (incluindo os stubs estruturais de strobe/prism/gobo), a integração com o runtime, a reconciliação de cor do Moving 2, dimmer/movement speed universais, e as duas correções do Viewer3D.

**Testado sem hardware**: compatibilidade com os 15 scripts existentes, performance sob carga simulada, migração do show com os dados novos.

**Não testado fisicamente**: nenhuma capability foi validada com o rig real ligado — roteiro físico de baixa agressividade está pronto em §18, mas não foi executado (sem hardware disponível neste ambiente).

**Pendente de dados (não de código)**: Moving 1 completo (cor, pan/tilt fino se necessário) e strobe/prism/gobo dos dois moving heads.

**Não implementado**: os 50 scripts em si (fora do escopo desta tarefa, por instrução explícita).

Não declaro esta implementação "pronta para o evento" nem "totalmente validada" — está pronta como **fundação arquitetural completa e testada automaticamente**, com um subconjunto de capabilities já utilizável pelos scripts novos hoje, e o restante desbloqueado assim que os dados físicos existirem, sem necessidade de tocar o núcleo.
