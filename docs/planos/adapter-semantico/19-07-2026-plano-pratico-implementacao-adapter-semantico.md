# Plano Prático — Adapter Semântico de Fixtures (VP-LIGHT)

> Data: 2026-07-19. Coordenador: Sonnet 5 principal. Executor de código: MCP `codex-high`. Revisor técnico independente: subagente Sonnet 5 (esforço high).
> Branch: `feature/semantic-fixture-adapter`, criada a partir de `ea96866` (HEAD de `feature/scripts-pages-hotreload`, já concluída/enviada ao GitHub), em worktree separado: `C:\Users\Admin\Documents\repositorios\vp-light-adapter-worktree`.
> Auditoria de referência: `docs/auditorias/exploracao/adapter-fixtures/19-07-2026-auditoria-completa-adapter-capabilities-fixtures.md`, produzida no commit `cac5cba29e424dca3ecafc7e52e585bc3cf6d493`.

---

## 1. Estado atual e reconciliação com a auditoria

### 1.1 Verificação de HEAD e working tree

- HEAD de `feature/scripts-pages-hotreload`: `ea96866` — working tree limpo, branch já enviada ao GitHub (`git branch -vv` confirma `up to date`). O desenvolvimento anterior (paginação de scripts, watcher, hot reload, macros) está **concluído**, não em andamento — não há conflito real de concorrência com outro agente ativo.
- Branch nova criada com `git worktree add -b feature/semantic-fixture-adapter <dir> ea96866` — isolamento físico total da working tree da branch anterior, sem risco de interferência.

### 1.2 Diff desde o commit auditado (`cac5cba` → `ea96866`)

```
git diff --stat cac5cba29e424dca3ecafc7e52e585bc3cf6d493 ea96866 -- \
  electron/adapter.js electron/main.js electron/show.js electron/fixtureOffsets.js \
  electron/ribaltaPhysicalCalib.js electron/engine/interpolator.js electron/engine/compositor.js \
  electron/preload.js shows/vp.show.json scripts/fire-base.js scripts/mov-preset.js src/viewer3d/

 electron/engine/compositor.js |  70 +++-
 electron/main.js              | 837 +++++++++++++++++++++++++----------------
 electron/preload.js           |  11 +
 3 files changed, 602 insertions(+), 316 deletions(-)
```

**Achado central: `electron/adapter.js`, `electron/show.js`, `electron/fixtureOffsets.js`, `electron/ribaltaPhysicalCalib.js`, `electron/engine/interpolator.js`, `shows/vp.show.json`, `scripts/fire-base.js`, `scripts/mov-preset.js` e `src/viewer3d/` estão byte-idênticos ao commit auditado.** Todo o delta está em `main.js`/`compositor.js`/`preload.js`, e uma inspeção linha a linha do diff (grep por `adapter|fixture|channel|offset|calib|SetChannel|getChannel`) confirma que **nenhuma dessas mudanças toca a cadeia de resolução de canal/fixture/adapter** — são exclusivamente scriptLibrary, páginas, watcher, macros, instrumentação de performance e estados de erro (trabalho da série anterior). **Conclusão: as afirmações técnicas da auditoria sobre a arquitetura de adapter/fixture continuam válidas quanto ao código não ter mudado — mas duas delas foram verificadas diretamente nesta sessão e uma se mostrou factualmente incorreta (ver 1.3).**

### 1.3 Divergências encontradas por investigação direta (não por confiar cegamente na auditoria)

1. **`channelCount:16` vs. "17 aliases" (auditoria §10/§22 item 8) — NÃO CONFIRMADO, auditoria estava incorreta.** Investigação direta via Node (`shows/vp.show.json` carregado e `f.channels.length` contado programaticamente) mostra que **Moving Head Beam 1 e Beam 2 têm exatamente 16 entradas em `channels`, batendo com `channelCount:16`**. Além disso, `electron/show.js:222-227` (`validateFixtures`) já **lança exceção** se `channelCount !== fx.channels.length` — e o show carrega hoje sem erro (confirmado por teste de migração em cópia temporária nesta sessão e por smoke tests de sessões anteriores). Se houvesse 17 entradas reais, o show nem carregaria. **Nenhuma correção é necessária neste ponto.** Isso é documentado aqui exatamente porque a tarefa pediu para não copiar conclusões da auditoria sem confirmar no código atual.
2. **Divergência de alias na posição 9 entre M1 e M2 — CONFIRMADA.** M1: índice 9 = `prism_1_rotation_2` (função não confirmada). M2: índice 9 = `focus` (capability totalmente diferente). Isso é real e American impacta o desenho de profile (cada modelo declara seus próprios canais; não há problema arquitetural nisso, só not-uniformidade entre os dois moving heads, que profiles por modelo já resolvem nativamente).
3. **`gain` da Ribalta_2: código tem `gain:1`, comentário no próprio arquivo cita `0.915`** (`electron/ribaltaPhysicalCalib.js:71-79`) — confirmado, é uma divergência real e pré-existente. **Fora do escopo desta tarefa** (ribaltas/calibração física não fazem parte do P0 do adapter semântico; já registrado como item P1 pela própria auditoria). Não será tocado.
4. **Moving 1 — template de mapeamento físico (`19-07-2026-template-mapeamento-moving-1.md`) continua 100% vazio nesta sessão** (confirmado por leitura direta, todas as células de valor em branco). O *data gate* do Moving 1 permanece fechado no início desta implementação. O núcleo será implementado sem esses dados, com `mappingStatus: incomplete` para as capabilities pendentes de M1 (cor, prisma, gobo, strobe) — ver §5.
5. **PAR LEDs — dois layouts reais confirmados diretamente no `show.json`** (não só na auditoria): `ParLed_Deluxe_1/5/7` = Layout A (`dimmer,strobo,macro,macro_speed,red,green,blue,white`); `ParLed_Deluxe_2/3/4/8/9` = Layout B (`macro,color_wheel,speed,dimmer,red,green,blue,""`). Isso **contradiz `banco-de-conhecimento/par-led.md`**, que descreve os 9 PARs como idênticos com o layout B — confirmado como uma imprecisão da documentação, não do show.json (fonte de runtime). O profile precisa diferenciar os dois layouts; a documentação do banco de conhecimento não é fonte confiável para isso.

---

## 2. Decisões fechadas (reafirmadas, não rediscutidas)

Ver prompt original — profile por modelo + calibração por instância; compatibilidade total com `SetChannel`/`getChannel`/`adapter.resolve`; adapter semântico pertence ao runtime (não depende de `fire-base.js`); scripts antigos continuam funcionando sem migração obrigatória; fine channels/16-bit fora do P0; freeze inalterado; Moving Wosh fora do núcleo obrigatório; sem aproximação automática de cor; sem invenção de dados físicos para Moving 1/strobe/prism/gobo até os data gates abrirem.

---

## 3. Decisões novas de arquitetura (ADRs)

### ADR-1 — Onde vive a lógica pura vs. onde vive a escrita

A lógica de **resolução** (profile do modelo, tipo de capability, validação, conversão de valor lógico → DMX) fica em módulos **puros, sem I/O, sem `require('electron')`**, testáveis via Node puro:
- `electron/fixtureProfiles/` — schema de profile, registro dos profiles por modelo, resolução de profile por fixture, resolução de capability.
- `electron/adapter.js` (estendido) — funções semânticas (`setColor`, `setDimmer`, `setMovementSpeed`, `setPanTilt`, `setStrobe`, `setPrism`, `setGobo`, `getCapabilities`), recebendo por **injeção de dependência** (mesmo padrão já usado por `resolve`): `getFixture`, `getChannelByAlias`, `isEnabled`, e agora também `writeChannel` (equivalente a `SetChannel` da camada atual). Isso mantém `adapter.js` 100% testável com fakes, sem tocar compositor/engine/Art-Net.

A **escrita real** (`SetChannel` de uma camada específica) continua vivendo em `electron/main.js`, dentro de `buildScriptSandbox(buffer, touched, controlledMask)` — o mesmo lugar onde `SetChannel`/`getChannel`/`adapter.resolve` já são fechados sobre a camada atual. As novas funções semânticas são construídas ali, injetando o `SetChannel` daquela camada específica como `writeChannel`. **Nenhuma duplicação de offset/calibração/interpolador** — a escrita passa pelo mesmo `SetChannel` → buffer → compositor → `_writeChannelToUniverse` (que já decide sozinho: canal virtual → interpolador; canal físico → universo) exatamente como hoje. O adapter semântico **não precisa saber nada sobre interpolador, offset ou calibração de ribalta** — ele só resolve *qual canal* e *qual valor*, e delega a escrita ao mecanismo existente.

### ADR-2 — Resolução de profile por fixture: sem migração obrigatória do show.json

Em vez de adicionar um campo `profileId` obrigatório em toda fixture do `show.json` (dual-write/migração arriscada e desnecessária para 20 fixtures já estáveis), o profile é **inferido por assinatura estrutural**:
- `moving_head_beam` + nome normalizado `"moving head beam 1"` → profile `moving-head-beam-1`; `"moving head beam 2"` → `moving-head-beam-2`. (Só existem 2 unidades reais; não há ambiguidade.)
- `par_led` + presença do alias `color_wheel` no array `channels` → profile `par-led-deluxe-layout-b`; ausência de `color_wheel` (e presença de `white`) → profile `par-led-deluxe-layout-a`.
- Qualquer outro `fixtureType` (ribalta, mini_brut, fita_led, moving_head/Wosh) → **sem profile registrado no P0** (retorna `PROFILE_NOT_FOUND` para `setColor`/`setPrism`/`setGobo`/`setStrobe`; ver ADR-3 para `setDimmer`/`setMovementSpeed`, que não dependem de profile).
- Campo opcional `fixture.profileId` no show.json **é suportado e tem prioridade sobre a inferência**, como escape hatch para o futuro (3º moving head, PAR com layout diferente, etc.) — não é usado por nenhuma fixture hoje, não exige migração.

Isso satisfaz "um terceiro profile pode ser adicionado sem alterar o núcleo" (critério de aceite) e evita qualquer edição de `shows/vp.show.json` além da reconciliação de cor do Moving 2 (item já decidido, §5).

### ADR-3 — `setDimmer`/`setMovementSpeed` não exigem profile registrado

Dimmer e movement speed são capabilities **universais e não específicas de modelo** (0–255 contínuo, sem tabela de calibração por valor lógico). Diferente de cor/prisma/gobo, elas funcionam por **resolução de alias direta** (reaproveitando `getFixtureChannelByAlias`, que já tem fallback `dimmer↔fecho_lampada` e `speed↔virtual_speed` para `moving_head_beam` — `main.js:998-1008`), **independente de haver um profile registrado para aquele tipo de fixture**. Isso permite que os 50 scripts novos usem `adapter.setDimmer()`/`adapter.setMovementSpeed()` em **qualquer** fixture (moving, PAR, ribalta, mini brut, fita), não só nas 4 com profile de cor — sem exigir profiles para Ribalta/MiniBrut/FitaLed/Wosh nesta tarefa. `setColor`/`setPrism`/`setGobo`/`setStrobe` continuam exigindo profile (retornam `PROFILE_NOT_FOUND` sem um).

### ADR-4 — `setPanTilt` em P0 é passthrough RAW (0–255), não normalizado

Normalizar pan/tilt em 0–1 exigiria uma faixa física segura por unidade — que **não existe para o Moving 1** (data gate fechado) e é **fisicamente não-linear entre M1 e M2** (M1 gira 450° anti-horário; M2 gira 540° horário — um mapeamento linear 0–1 idêntico para os dois seria uma normalização inventada, não uma medição). Por segurança ("não provocar movimento brusco", "não inventar valores físicos"), `adapter.setPanTilt(fixtureId, {pan, tilt})` no P0 aceita **valores DMX crus 0–255 por eixo**, idêntico semanticamente a `SetChannel(getChannel(id,'pan'), pan); SetChannel(getChannel(id,'tilt'), tilt)` — zero risco novo, só açúcar sintático (resolve os dois canais de uma vez, com erro estruturado se um deles não existir). Uma versão normalizada/em graus, com zona de segurança por unidade, fica para **P2**, condicionada ao mapeamento físico completo dos dois moving heads. Isso é uma divergência deliberada do exemplo conceitual do prompt (`{pan:0.5, tilt:0.35}`) — documentada e justificada, não uma omissão.

`adapter.setMovementSpeed(fixtureId, value0to1)` **mantém a convenção já existente do interpolador** (`0 = rápido, 255 = lento` — `interpolator.js:29`): o valor normalizado 0–1 é mapeado linearmente para 0–255 nesse mesmo sentido (não invertido), documentado explicitamente para autores de scripts, para não introduzir uma segunda convenção conflitante com o `custom:speed` IPC já existente.

### ADR-5 — `setColor` para RGB/RGBW usa uma tabela padrão de cores, não medida

Para moving heads (`color_wheel`, mecanismo `enumerated`), os nomes de cor válidos são **exatamente** as chaves já medidas/calibradas em `fixture.adapters.color` daquela instância — nenhuma cor fora dessa lista é aceita (retorna `VALUE_NOT_SUPPORTED`), nada é inventado. Para PAR LED (RGB/RGBW), não existe "medição" possível — R/G/B são um espaço de cor matemático padrão, não uma calibração física do equipamento. Uma tabela pequena e padrão (`red, green, blue, white, yellow, cyan, magenta`) converte nome → `{r,g,b[,w]}`, documentada explicitamente como **definição de espaço de cor, não dado físico medido** — a mesma cor "green" (`0,255,0`) é válida para qualquer fixture RGB do mercado, por definição do modelo aditivo de cores. `white` usa o canal `white` dedicado quando ele existe (Layout A, RGBW: `w=255,rgb=0`, luz branca "de verdade"); usa `r=g=b=255` quando não existe (Layout B, RGB puro, única aproximação fisicamente possível). Isso é a única "invenção" deste plano, e é deliberadamente restrita a matemática de cor padrão — nunca a um valor específico de canal físico de um equipamento (color wheel, prisma, gobo, strobe permanecem estritamente vindos de medição).

**Comportamento obrigatório de limpeza (do prompt):** `setColor` em fixture RGB/RGBW sempre zera os 3-4 canais de cor antes de escrever os valores da cor pedida — nunca deixa resíduo de uma cor anterior misturado. Não toca no canal `macro` (nem em `strobo`/`macro_speed`) — só nos canais de cor, conforme exigido.

### ADR-6 — Moving 1: cor tratada como `mapping-incomplete` mesmo já existindo uma tabela antiga no show.json

`shows/vp.show.json` já tem `fixture.adapters.color` para o Moving 1 (8 valores: white/red/green/blue_light/yellow/purple/blue/amber). A auditoria não sinalizou essa tabela como suspeita (só a do M2), mas o prompt desta tarefa é explícito: "Moving 1 — data gate... Não inventar: cores... antes dos dados do Moving 1: profile incompleto, mappingStatus: incomplete". Interpretação adotada: **tratar a tabela antiga do M1 como não confirmada nesta rodada de trabalho**, exatamente como a tabela antiga do M2 foi tratada antes da nova medição chegar. Decisão concreta:
- O campo `fixture.adapters.color` do M1 **não é apagado nem alterado** no `show.json` (preserva `adapter.resolve()` legado, caso algum script futuro chame diretamente).
- No profile novo (`moving-head-beam-1.js`), a capability `color` é declarada com `status: 'mapping-incomplete'` — `adapter.setColor('MH1', ...)` retorna `CAPABILITY_NOT_MAPPED` até o operador confirmar/preencher o template do Moving 1 e o profile ser atualizado (Fase 3, condicionada ao data gate).
- Quando os dados chegarem: só o objeto de dados do profile/instância muda; nenhuma lógica central é alterada (critério de aceite #17).

### ADR-7 — `fire-base.js` permanece intocado nesta tarefa (Caminho A, não implementado ainda)

Decisão documentada, sem alteração de arquivo: `scripts/fire-base.js` continua **opcional e inerte** (não injetado automaticamente). Ele já tem a forma certa (helpers de alto nível sobre `getChannel`/`SetChannel`/`adapter.resolve`) para um dia consumir a API semântica nova, mas migrá-lo e reativá-lo é trabalho de "Fase 6" (pós-P0, condicionado ao P0 estar estável) — não bloqueia os 50 scripts, que podem chamar `adapter.setColor()` etc. diretamente. Não concatenar automaticamente em nenhum script (risco de colisão de nomes/hot reload já documentado na auditoria). Se houver tempo após o P0/P1, uma tarefa futura decide entre reescrever `fire-base.js` sobre a API nova ou extrair helpers para um módulo auxiliar — não decidido nem implementado agora, apenas mantido como está.

### ADR-8 — Local dos profiles e nomes de arquivo

`electron/fixtureProfiles/`:
- `index.js` — registro central: `getProfile(profileId)`, `listProfiles()`, `resolveProfileForFixture(fixture)` (heurística do ADR-2), `validateProfile(profile)`.
- `movingHeadBeam1.js`, `movingHeadBeam2.js`, `parLedDeluxeLayoutA.js`, `parLedDeluxeLayoutB.js` — um profile por modelo/layout real confirmado.
- Nenhum profile para Ribalta/MiniBrut/FitaLed/Wosh nesta tarefa (não necessário — ver ADR-3; podem ser adicionados depois sem tocar o núcleo).

---

## 4. Schema de profile (final)

```js
// electron/fixtureProfiles/movingHeadBeam2.js
module.exports = {
  id: 'moving-head-beam-2',
  label: 'Moving Head Beam 230W (16ch)',
  fixtureType: 'moving_head_beam',
  match: { name: 'moving head beam 2' },      // usado por resolveProfileForFixture (ADR-2)
  channels: {
    color:         { alias: 'color_wheel' },
    dimmer:        { alias: 'fecho_lampada' },
    strobe:        { alias: 'strobo' },
    prism:         { alias: 'prism_1' },
    prismRotation: { alias: 'prism_rotation' },
    gobo:          { alias: 'gobo_wheel' },
    movementSpeed: { alias: 'virtual_speed' },
    pan:           { alias: 'pan' },
    panFine:       { alias: 'pan_fine', optional: true },
    tilt:          { alias: 'tilt' },
    tiltFine:      { alias: 'tilt_fine', optional: true },
  },
  capabilities: {
    color:         { type: 'enumerated', status: 'ready' },        // fonte: fixture.adapters.color (instância)
    dimmer:        { type: 'continuous', status: 'ready' },
    movementSpeed: { type: 'continuous', status: 'ready' },
    pan:           { type: 'continuous', status: 'ready' },
    tilt:          { type: 'continuous', status: 'ready' },
    strobe:        { type: 'range',      status: 'mapping-incomplete' },
    prism:         { type: 'enumerated', status: 'mapping-incomplete' },
    prismRotation: { type: 'range',      status: 'mapping-incomplete' },
    gobo:          { type: 'enumerated', status: 'mapping-incomplete' },
  },
};
```

`movingHeadBeam1.js` é idêntico em forma, mas com `color.status: 'mapping-incomplete'` (ADR-6) e `channels.prismRotation.alias: 'prism_1_rotation'` (nome diferente do M2).

```js
// electron/fixtureProfiles/parLedDeluxeLayoutA.js  (RGBW: dimmer,strobo,macro,macro_speed,red,green,blue,white)
module.exports = {
  id: 'par-led-deluxe-layout-a',
  fixtureType: 'par_led',
  match: { hasAlias: 'white', missingAlias: 'color_wheel' },
  channels: {
    dimmer: { alias: 'dimmer' }, strobe: { alias: 'strobo' },
    macro: { alias: 'macro', optional: true }, macroSpeed: { alias: 'macro_speed', optional: true },
    red: { alias: 'red' }, green: { alias: 'green' }, blue: { alias: 'blue' }, white: { alias: 'white' },
  },
  capabilities: {
    color:  { type: 'rgbw', status: 'ready' },
    dimmer: { type: 'continuous', status: 'ready' },
    strobe: { type: 'range', status: 'mapping-incomplete' },
  },
};

// electron/fixtureProfiles/parLedDeluxeLayoutB.js  (RGB: macro,color_wheel,speed,dimmer,red,green,blue,"")
module.exports = {
  id: 'par-led-deluxe-layout-b',
  fixtureType: 'par_led',
  match: { hasAlias: 'color_wheel' },
  channels: {
    macro: { alias: 'macro', optional: true }, colorWheel: { alias: 'color_wheel', optional: true },
    speed: { alias: 'speed', optional: true }, dimmer: { alias: 'dimmer' },
    red: { alias: 'red' }, green: { alias: 'green' }, blue: { alias: 'blue' },
  },
  capabilities: {
    color:  { type: 'rgb', status: 'ready' },
    dimmer: { type: 'continuous', status: 'ready' },
    strobe: { type: 'range', status: 'mapping-incomplete' },   // via macro 201-255 — P1
  },
};
```

Separação mantida à risca: **profile nunca contém `startChannel`, `enabled`, offsets ou calibração de instância** — isso continua só em `shows/vp.show.json`.

---

## 5. Data gates

```
MOVING1_COLOR_READY   = false  (template vazio nesta sessão)
MOVING1_PAN_TILT_READY = true  (canais/offset já funcionam hoje via interpolador; não é uma capability nova)
STROBE_READY (M1 e M2)  = false (nenhum valor confirmado em nenhum dos dois — nem M2 tem faixa validada, só uma nota não usada)
PRISM_READY  (M1 e M2)  = false (nenhum valor confirmado em nenhum dos dois)
GOBO_READY   (M1 e M2)  = false (nenhum valor confirmado em nenhum dos dois)
```
Enquanto falsos: a capability existe no profile (`status: 'mapping-incomplete'`), a API existe e responde `{ok:false, code:'CAPABILITY_NOT_MAPPED'}` — nunca um número inventado, nunca uma exceção.

---

## 6. Códigos de erro — semântica exata

| Código | Quando ocorre |
|---|---|
| `FIXTURE_NOT_FOUND` | `getShowFixture` não encontra a fixture por id/nome |
| `FIXTURE_DISABLED` | Fixture existe, `enabled === false` |
| `PROFILE_NOT_FOUND` | Nenhum profile registrado corresponde a esta fixture (nem por inferência, nem por `profileId` explícito) — capability inteira não modelada |
| `PROFILE_INVALID` | Profile malformado (defensivo; validado no boot via `validateProfile`, não deve ocorrer em runtime com profiles próprios) |
| `CHANNEL_NOT_FOUND` | Profile declara a capability com um alias, mas esse alias não existe de fato no array `channels` desta instância (drift entre profile e dado real) |
| `CAPABILITY_NOT_SUPPORTED` | Profile existe, mas não declara essa capability (ex.: `setPrism` num PAR LED) |
| `CAPABILITY_NOT_MAPPED` | Capability declarada no profile, mas `status: 'mapping-incomplete'` (dados de calibração ainda não existem) |
| `VALUE_NOT_SUPPORTED` | Capability madura (`status:'ready'`), mas o valor lógico pedido não está na enumeração daquela instância/modelo |
| `INVALID_VALUE` | Entrada malformada (não numérica, fora de tipo esperado, objeto incompleto em `setPanTilt`) |
| `MAPPING_INCOMPLETE` | Usado no campo `status` de `getCapabilities()` (não é um `code` de erro de chamada — é o rótulo de introspecção da capability) |

Regras gerais: nenhuma função semântica lança exceção; todas retornam `{ok:false, code, fixtureId, capability, requestedValue, message}` em falha; log de diagnóstico rate-limited (reaproveitando o padrão já usado em `perfStats.js`/`compositor.js` — no máximo 1 aviso a cada poucos segundos por combinação `fixtureId+capability+code`), nunca 25/s.

---

## 7. API final exposta aos scripts

```js
adapter.resolve(fixtureId, alias, adapterKey, logicalValue)   // INALTERADO — legado
adapter.setColor(fixtureId, colorName)          -> Result
adapter.setDimmer(fixtureId, intensity0to1)     -> Result
adapter.setMovementSpeed(fixtureId, speed0to1)  -> Result   // 0=rápido,1=lento (convenção do interpolador)
adapter.setPanTilt(fixtureId, { pan, tilt })    -> Result   // RAW 0-255 por eixo (P0); normalizado fica em P2
adapter.setStrobe(fixtureId, intent)            -> Result   // stub estrutural — CAPABILITY_NOT_MAPPED até P1
adapter.setPrism(fixtureId, intent)             -> Result   // idem
adapter.setGobo(fixtureId, gobo)                -> Result   // idem
adapter.getCapabilities(fixtureId)              -> { ok, fixtureId, profileId, capabilities }
```
`Result` de sucesso: `{ ok: true, fixtureId, capability, ...detalhe (channel/channels, value/values) }`.
`Result` de falha: `{ ok: false, code, fixtureId, capability, requestedValue, message }`.

`SetChannel`, `getChannel` permanecem exatamente como hoje — nenhum script legado precisa mudar.

---

## 8. Checkpoints

| # | Nome | Escopo | Arquivos permitidos | Revisão obrigatória do subagente? |
|---|---|---|---|---|
| 0 | Plano e reconciliação | Este documento | `docs/planos/adapter-semantico/*` | Não |
| 1 | Profiles e validação | `fixtureProfiles/` completo + testes puros | `electron/fixtureProfiles/**`, `tests/fixture-profiles.test.js` | Sim (schema/resolução de capability) |
| 2 | Runtime do adapter semântico | Estender `adapter.js` (DI), sem tocar main.js ainda | `electron/adapter.js`, `tests/adapter-semantic.test.js` | Sim (integração com runtime) |
| 3 | Integração na sandbox de scripts | Fiar `buildScriptSandbox` às novas funções | `electron/main.js` (só a função `buildScriptSandbox` e vizinhança imediata) | Sim (nenhuma duplicação de offset/calibração) |
| 4 | Cor: Moving 2 + PAR A/B | Reconciliar cores do M2 no show.json; testes de cor | `shows/vp.show.json` (só bloco `adapters.color` do M2), `tests/adapter-semantic.test.js` | Sim (color wheel) |
| 5 | Dimmer e movement speed | Testes cobrindo várias fixtures | `tests/adapter-semantic.test.js` | Sim (pan/tilt/speed/offset) |
| 6 | Documentação para autores de scripts | Guia de uso da API | `docs/planos/adapter-semantico/*` ou novo doc | Não |
| 7 | (P1, condicional) Strobe/Prism/Gobo | Só se dados do M1 chegarem nesta sessão | `electron/fixtureProfiles/*`, `shows/vp.show.json` | Sim (todas: color wheel, prism, gobo, strobe) |
| 8 | (P1, condicional) Viewer3D crítico | PAR/MiniBrut/white — só divergências críticas | `src/viewer3d/**` | Sim (Viewer3D) |
| 9 | Validação integrada final | testes, build, relatório | — | Sim (validação final) |

Commits pequenos, um por checkpoint aprovado. `git diff --check` + `npm run test` + `npm run build` antes de cada commit.

---

## 9. Arquivos proibidos nesta tarefa (todos os checkpoints)

`electron/engine/artnet.js`, `electron/engine/universe.js` (exceto leitura), `electron/engine/compositor.js` (merge/HTP — não deve mudar), `electron/ribaltaPhysicalCalib.js`, `electron/fixtureOffsets.js`, `electron/engine/engine.js`, qualquer `scripts/mov-*.js`/`brut-*.js` existente, `scripts/mov-preset.js`, `scripts/fire-base.js` (ADR-7), qualquer coisa em `feature/scripts-pages-hotreload` (branch/worktree distinto).

## 10. Riscos

- Confundir "dado padrão de cor RGB" com "dado físico inventado" — mitigado pelo ADR-5, documentado explicitamente, sujeito a revisão do subagente.
- Profile mal inferido para uma 10ª unidade de PAR LED futura com layout diferente — mitigado pelo escape hatch `profileId` (ADR-2).
- Regressão em scripts legados por mudança em `buildScriptSandbox` — mitigado por só adicionar propriedades ao objeto `adapter`, nunca remover/alterar `resolve`/`SetChannel`/`getChannel`.
- Dados do Moving 1 chegarem no meio da sessão — plano já particiona o trabalho para absorver isso sem reescrever o núcleo (checkpoint 7 condicional).

## 11. Critérios de aceite

Ver seção "CRITÉRIOS DE ACEITAÇÃO DO P0" do prompt original — usados literalmente como checklist do Checkpoint 9 (validação integrada).

## 12. Rollback

```
git worktree remove C:/Users/Admin/Documents/repositorios/vp-light-adapter-worktree
git branch -D feature/semantic-fixture-adapter   # se necessário descartar tudo
```
A branch `feature/scripts-pages-hotreload` e `main` não são afetadas por nenhuma ação desta tarefa.
