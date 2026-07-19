# Auditoria completa — Adapter, Capabilities e Fixtures (VP-Light)

**Data da auditoria:** 2026-07-19
**Auditor principal:** Sonnet 5 (raciocínio, cruzamento de evidências, decisões e conclusões)
**Agente executor:** codex-xhigh (MCP), em modo `sandbox: read-only`, `approval-policy: never` — leitura de código, busca de trechos, coleta de evidências com arquivo:linha. Nenhuma decisão arquitetural foi delegada ao executor.

---

## 1. Resumo executivo

O VP-Light já resolve **onde** está um canal (canal absoluto = `startChannel + índice do alias`), mas **não resolve, de forma centralizada, o que aquele canal significa fisicamente** para cada modelo de fixture. Existe um adapter (`electron/adapter.js`) capaz de converter um valor lógico (`"green"`) em um valor DMX (`60`), mas ele:

- é usado por **apenas um script** (`fire-base.js`), que hoje está **inerte** (não injetado no runtime);
- só resolve **um único atributo** na prática: `color_wheel` (via chave `adapters.color`);
- não tem nenhuma noção de **modelo/profile** — cada instância de fixture carrega seu próprio mapa de cor solto dentro do `show.json`, sem schema, sem validação, sem capability declarada;
- não cobre gobo, prism, strobe, dimmer, pan/tilt, focus, zoom, RGB — todos esses continuam sendo escritos com valores DMX crus, hardcoded por script, com tabelas paralelas `MP_M1`/`MP_M2` que só existem porque um humano já testou os dois moving heads e anotou os números certos para cada um.

Em outras palavras: a arquitetura de **resolução de canal** (identidade → posição no barramento) está pronta e é sólida. A arquitetura de **resolução de valor semântico** (intenção → número DMX certo por modelo) **não existe ainda de forma generalizada** — existe apenas como prova de conceito para cor de moving head, e mesmo essa prova de conceito não está em uso pelos 14 scripts ativos.

Isso confirma o diagnóstico do operador: os scripts atuais já "sabem" o pan/tilt/velocidade de cada moving porque um humano mediu e hardcoded esses valores em tabelas por unidade (`MP_M1`, `MP_M2` em `scripts/mov-preset.js`) — não porque existe uma abstração `adapter.setPanTilt()`. Criar 50 novos scripts em cima dessa base repetiria o padrão: cada script precisaria conhecer o moving específico.

**Conclusão central antecipada:** é seguro e recomendável avançar para uma API semântica (`adapter.setColor()`, `adapter.setPrism()`, etc.) apoiada em profiles por modelo + calibração por instância, mas isso **não pode ficar pronto hoje à noite**. O que é factível e necessário antes dos 50 scripts é: (a) formalizar o profile de cor já existente para os dois moving heads (incluindo confirmar se os valores do operador para o Moving 2 substituem ou complementam os do `show.json` atual — ver seção 12), (b) estender esse mesmo padrão para pan/tilt/dimmer/strobe, e (c) só then tratar prism/gobo assim que o Moving 1 for mapeado esta noite.

---

## 2. Commit e ambiente auditados

| Item | Valor |
|---|---|
| Branch | `feature/scripts-pages-hotreload` |
| Commit auditado | `cac5cba29e424dca3ecafc7e52e585bc3cf6d493` — "Checkpoint 2: biblioteca de scripts e associacoes (CRUD)" (2026-07-19 11:33:52 -0300) |
| `git status` no início da auditoria | Apenas arquivos **untracked** de outro agente em andamento: `docs/auditorias/bateamento/paginacao-fkeys-macros.md`, `docs/auditorias/exploracao/macros-vp-light/`, `docs/auditorias/exploracao/paginacao-fkeys-macros/`, `docs/auditorias/exploracao/runtime-scripts-hot-reload/`, `docs/relatorios/2026-07-19-implementacao-scripts-paginas-hotreload.md` |
| Data/hora do início da auditoria | 2026-07-19, 11:41:58 (horário local da máquina) |
| Isolamento | `git worktree add --detach` fixado no commit `cac5cba2` acima, em diretório temporário fora do repositório de trabalho. Toda leitura de código pelo executor ocorreu nesse worktree, não na working tree ativa da outra automação. |
| Alterações feitas na working tree principal | Nenhuma, exceto a criação dos 3 documentos desta entrega, em `docs/auditorias/exploracao/adapter-fixtures/`. |
| Transmissão Art-Net/DMX | Nenhuma. Nenhum processo Electron/engine foi iniciado; toda a investigação foi estática (leitura de arquivo). |
| Observação sobre concorrência | Se o `adapter.js`, `fixtureOffsets.js`, `ribaltaPhysicalCalib.js`, `show.js` ou `shows/vp.show.json` forem alterados pelo outro agente após `cac5cba2`, será necessário um diff curto desses arquivos antes de iniciar a implementação recomendada aqui — esta auditoria não reflete nenhuma mudança posterior a esse commit. |

---

## 3. Arquitetura atual do adapter

Dois níveis coexistem hoje, e é essencial não confundi-los:

1. **Resolução de canal** (`getChannel`) — puramente posicional: acha o índice do alias no array `channels` da fixture e soma ao `startChannel`. Não sabe nada sobre modelo, unidade física ou capability.
2. **Resolução de valor** (`adapter.resolve`) — puramente de lookup: dado um `adapterKey` (hoje só `"color"` é usado) e um `logicalValue` (`"green"`), procura `fixture.adapters[adapterKey][logicalValue]` **na própria instância da fixture no show.json** e devolve o valor DMX, com clamp.

Essas duas resoluções são **independentes** e precisam ser chamadas em conjunto pelo script:

```js
const ch = getChannel(id, 'color_wheel');                 // canal absoluto
const val = adapter.resolve(id, 'color_wheel', 'color', 'green'); // valor DMX
if (ch !== null && val !== null) SetChannel(ch, val);
```

Não existe uma função única `adapter.setColor(fixture, 'green')` que faça as duas coisas. O único lugar do repositório que compõe essas duas chamadas é `scripts/fire-base.js` (`fb_mhColor`, linhas 246-260) — e esse arquivo está inerte (seção 9).

### 3.1 Onde o adapter é criado, importado e injetado

- **Criado/definido em:** `electron/adapter.js` (função pura, sem estado).
- **Importado em:** apenas `electron/main.js:27` (`const fixtureAdapter = require('./adapter')`). Nenhum outro arquivo do projeto importa `electron/adapter.js` diretamente.
- **Envolvido por:** `resolveAdapterValue(...)` em `electron/main.js:1104-1113`, que injeta os três callbacks de acesso ao show (`getShowFixture`, `getFixtureChannelByAlias`, `isFixtureEnabled`) como dependências do `adapter.resolve`.
- **Injetado nos scripts como:** três parâmetros posicionais de uma `new Function('SetChannel', 'getChannel', 'adapter', 'ctx', code)` (`electron/main.js:1153-1163`). **Não são propriedades de `ctx`** — `ctx` só recebe os hooks de ciclo de vida (`OnStart`, `OnExecute`, `OnTerminate`) por fechamento léxico sobre essas três funções.
- **Objeto que chega ao script:** `SetChannel(ch, val)`, `getChannel(fixtureId, alias)`, `adapter.resolve(fixtureId, alias, adapterKey, logicalValue)`.

---

## 4. Fluxo completo script → adapter → canal → compositor → universo → Art-Net

```
Script (OnExecute)
  → getChannel(fixtureId, alias)         [electron/main.js:1077-1102]  → canal absoluto ou null
  → adapter.resolve(id, alias, key, val)  [electron/adapter.js:51-72]   → valor DMX ou null
  → SetChannel(ch, val)                   [electron/main.js:1117-1125] → grava no buffer PRIVADO da camada do script
       (ignora canal fora de 1..512; ignora canal travado por scene-lock; aplica clamp 0-255)

Compositor (a cada frame, 40ms)            [electron/engine/compositor.js:215-260]
  → limpa buffer/touched da camada
  → executa OnExecute do script
  → mescla os canais tocados entre camadas: HTP (max ponderado) ou linear (soma ponderada)
  → _writeChannelToUniverse(canal, valor)  [electron/engine/compositor.js:103-119]
       → se for canal "virtual_speed"      → interpolator.setSpeed(canal, valor)   [não vai ao universo]
       → se for pan/tilt de fixture com virtualPanTiltSpeed → interpolator.setTarget(canal, valor)
       → caso contrário                    → universe.setChannel(canal, valor)
  → applySceneLockToUniverse()             [reaplica canais de color_wheel/prism travados pela scene-lock]

Universe                                    [electron/engine/universe.js:19-45]
  → soma o offset físico do canal (fixtureOffsets, panOffset/tiltOffset por instância)
  → arredonda e clampa 0-255
  → grava no Uint8Array(512) — este é "o universo lógico"

Engine loop (25 fps / 40ms)                 [electron/engine/engine.js:18-58]
  1. interpolator.tick()                    → avança pan/tilt/velocidade interpolados, grava em universe.setChannel
  2. compositor.renderFrame()
  3. getPhysicalUniverseForArtNet(getUniverse())  [electron/ribaltaPhysicalCalib.js:193-207]
       → copia os 512 bytes lógicos para um buffer separado
       → remapeia SOMENTE os canais "tilt" de Ribalta_1 e Ribalta_2 (por nome exato + fixtureType)
  4. sendArtDMX(bufferFisico)                [electron/engine/artnet.js]
       → se _frozen, retorna sem enviar UDP (mas o buffer já foi calculado)
       → senão, envia pacote Art-Net DMX via UDP porta 6454
  5. onFrame(getUniverse())                  → dispara listeners (IPC "dmx-universe" para o Viewer3D)
       ⚠️ onFrame recebe o universo LÓGICO (pré-calibração de ribalta), não o buffer físico enviado ao Art-Net.
```

**Ponto crítico documentado com evidência:** o Viewer3D e o Art-Net podem divergir no tilt das ribaltas, porque o Viewer3D consome `getUniverse()` (lógico) e o Art-Net consome `getPhysicalUniverseForArtNet(...)` (calibrado). Isso é uma divergência real e confirmada, não uma suposição (`electron/engine/engine.js:44-55`; `electron/ribaltaPhysicalCalib.js:193-207`).

**Freeze:** confirmado que bloqueia apenas o envio UDP dentro de `sendArtDMX` (`if (_frozen) return;`), sem afetar interpolador, compositor ou o listener do Viewer3D (`electron/engine/artnet.js`; `electron/engine/engine.js:40-58`). Ao descongelar, `flushArtDMX` envia imediatamente o buffer físico atual, ignorando a flag de freeze (`electron/main.js:325-332`).

---

## 5. Mapa completo de arquivos relacionados

| Arquivo | Papel na cadeia adapter/canal/valor |
|---|---|
| `electron/adapter.js` | Núcleo do adapter: `resolve`, `normalizeKey`, `clampDmx`. Sem estado, sem I/O. |
| `electron/main.js` | Identifica fixture por id/nome; resolve alias → canal absoluto; monta `resolveAdapterValue`; injeta `SetChannel/getChannel/adapter` nos scripts; concatena `mov-preset.js`; scene-lock; alias fallback de `moving_head_beam`. |
| `electron/show.js` | Mantém `currentShow` em memória; único ponto que lê `shows/vp.show.json` do disco; calcula `startupChannels` (na verdade, procura `fecho_lampada` e força 255); valida fixtures (mas não valida o objeto `adapters`). |
| `electron/fixtureOffsets.js` | Converte `panOffset`/`tiltOffset` por instância em mapa canal→offset; `FIXTURE_OFFSET_RULES` hardcoded está **vazio** hoje — a fonte real são os campos da própria fixture no JSON. |
| `electron/ribaltaPhysicalCalib.js` | Calibração física exclusiva de `tilt` para `Ribalta_1`/`Ribalta_2` (por nome exato), aplicada só na cópia enviada ao Art-Net. |
| `electron/engine/compositor.js` | Merge de camadas (HTP/linear), scene-lock, roteamento para universo/interpolador. |
| `electron/engine/universe.js` | Buffer de 512 bytes, aplica offset, clamp, `getUniverse()` (bruto) vs `getUniverseSnapshot()` (lógico sem offset). |
| `electron/engine/interpolator.js` | Pan/tilt/velocidade virtual; não combina fine channels; não conhece `pan_fine`/`tilt_fine`. |
| `electron/engine/engine.js` | Orquestra a ordem exata do frame (seção 4). |
| `electron/engine/artnet.js` | Envio UDP, flag de freeze. |
| `electron/engine/ribaltaDebug.js` | Debug exclusivo da Ribalta_2 via `VP_RIBALTA_DEBUG=1`. |
| `electron/preload.js` | Expõe canais absolutos ao renderer via IPC; **não** expõe `getChannel`/`adapter.resolve` ao renderer. |
| `shows/vp.show.json` | Fonte de verdade das fixtures, incluindo `fixture.adapters.color` (único adapter semântico hoje existente, por instância). |
| `scripts/fire-base.js` | Única biblioteca que usa `adapter.resolve` de fato — hoje **inerte** (não injetada pelo runtime). |
| `scripts/mov-preset.js` | Concatenado automaticamente em todos `mov-*.js`; contém as tabelas hardcoded `MP_M1`/`MP_M2` de posição por unidade. |
| `src/viewer3d/scene.js`, `src/viewer3d/fixtures/*.js` | Resolvedores **paralelos e independentes** do adapter — mapas absolutos hardcoded, com divergências confirmadas em relação ao `show.json` atual (seção 15). |
| `src/screens/Main.jsx`, `src/screens/SceneEditor.jsx`, `src/store/showStore.js` | Resolvedores paralelos no renderer que recalculam `startChannel + índice` por conta própria, sem passar pelo adapter do main process. |

---

## 6. API atual do adapter

### `electron/adapter.js`

| Função | Assinatura | Comportamento | Linha |
|---|---|---|---|
| `normalizeKey` | `(value) → string` | remove acentos, `trim()`, lowercase | `adapter.js:28-33` |
| `clampDmx` | `(value) → number\|null` | converte, arredonda, `null` se não-finito, clamp 0-255 | `adapter.js:35-39` |
| `resolve` | `(getFixture, getChannelByAlias, isEnabled, fixtureId, alias, adapterKey, logicalValue) → number\|null` | busca fixture; exige `enabled`; exige alias presente; lê `fixture.adapters[adapterKey][logicalValue]`; aplica `clampDmx`; qualquer exceção → `null` silencioso, sem log | `adapter.js:51-72` |

Exportação: `module.exports = { resolve, normalizeKey, clampDmx }` (`adapter.js:75`). Só `resolve` é de fato consumido no projeto.

### API exposta ao script (via `main.js`)

| Função | Assinatura | Efeito colateral | Linha |
|---|---|---|---|
| `getChannel` | `(fixtureId, alias) → number\|null` | nenhum (somente leitura) | `main.js:1097-1102`, `1126` |
| `adapter.resolve` | `(fixtureId, alias, adapterKey, logicalValue) → number\|null` | nenhum | `main.js:1127-1130` |
| `SetChannel` | `(canal, valor) → void` | grava no buffer privado da camada; ignora scene-lock e fora de 1-512 | `main.js:1117-1125` |

### Resolução de fixture e canal (`main.js`)

- **Identificação da fixture:** `fixture.id === target` OU `normalizeAlias(fixture.name) === normalizedTarget` (`main.js:1035-1041`). **Não usa** `model`, `profile`, `startChannel`, grupo.
- **Tipo (`fixtureType`/`type`)** só influencia fallbacks de alias para `moving_head_beam` (`dimmer↔fecho_lampada`, `speed↔virtual_speed`, `prism↔prism_1`, `gobo↔gobo_wheel`, `strobo_dimmer↔strobo`) — `main.js:1085-1094`.
- **Canal absoluto:** índice do alias em `fixture.channels` + `fixture.startChannel` (`main.js:1077-1083`).

### Offsets e calibração (funções exportadas)

- `fixtureOffsets.js`: `buildChannelOffsetMap`, `getFixturePanOffset`, `getFixtureTiltOffset`, `normalizeAlias`, `normalizeFixtureOffsets`, `normalizeShowFixtureOffsets`.
- `ribaltaPhysicalCalib.js`: `mapLogicalToPhysicalTilt`, `calibratePhysicalTilt`, `configureFromFixtures`, `getPhysicalUniverseForArtNet`, `getTiltChannelMap`.

---

## 7. Identificação de fixtures — respostas diretas

| Pergunta | Resposta confirmada em código |
|---|---|
| Usa nome de exibição? | Sim, como fallback normalizado (`main.js:1035-1041`). |
| Usa ID? | Sim, com prioridade sobre o nome. |
| Usa tipo? | Só para fallback de alias em `moving_head_beam`. |
| Usa profile/modelo? | **Não.** `model` no JSON é só metadado descritivo. |
| Usa start channel para identificar? | Não — `startChannel` só entra depois que a fixture já foi encontrada, para calcular o canal absoluto. |
| Usa aliases (campo dedicado)? | Não existe campo `aliases`; o próprio array `channels` funciona como lista de aliases lógicos por posição. |
| Fine channels | Existem como aliases independentes (`pan_fine`, `tilt_fine`); **não há combinação 16-bit em nenhum lugar do pipeline**. |
| Valores enumerados | Suportados via lookup exato de propriedade (`fixture.adapters[key][valor]`). |
| Intervalos/ranges contínuos | **Não suportados.** Não há interpretação de `{min,max}` nem interpolação de faixa no adapter. |
| Clamp | Sim, em `clampDmx`, em `SetChannel`, no compositor e no universo (defesa em profundidade). |
| Normalização | Sim, de `adapterKey`/`logicalValue`/nome de fixture (remoção de acento, lowercase, trim). |
| Fallback | Só para os poucos aliases citados de `moving_head_beam`; não há fallback entre cores/valores. |
| Falhas silenciosas | **Sim.** `adapter.resolve` e `getChannel` retornam `null` sem log em qualquer falha (fixture inexistente, alias ausente, exceção). Isso é um risco (seção 16). |
| Logs | Não há logging de erro no adapter. |
| Cache | Não há cache no adapter; cada chamada refaz a busca. |
| Lê o show diretamente? | Não — recebe callbacks; quem lê o show é `main.js`/`show.js`. |
| Estado global / concorrência | O adapter é puro/sem estado. O estado compartilhado real é `currentShow` em `show.js` (todas as camadas leem o mesmo show) e os buffers por camada no compositor (isolados por script). Não há mutação cruzada entre scripts nesse ponto. |
| Canal errado por nome parecido | Risco teórico presente: a identificação por nome usa `normalizeAlias`, que pode colidir se dois fixtures tiverem nomes que normalizam igual — não observado no show atual, mas não há validação de unicidade de nome normalizado em `validateFixtures`. |

---

## 8. Resolução de atributos — como `color_wheel` funciona hoje

Duas operações independentes, ambas necessárias:

1. **Canal absoluto:** índice de `"color_wheel"` no array `channels` da fixture + `startChannel`.
   - Moving Head Beam 1: índice 0 + `startChannel=123` → canal **123**.
   - Moving Head Beam 2: índice 0 + `startChannel=203` → canal **203**.
2. **Valor lógico → DMX:** `fixture.adapters.color[logicalValue]`, **específico da instância**, não do modelo.
   - Beam 1 (`shows/vp.show.json:302-312`): `white:0, red:30, green:60, blue_light:90, yellow:120, purple:150, blue:180, amber:210`.
   - Beam 2 (`shows/vp.show.json:348-357`): `white:0, red:16, yellow:48, purple_dark:80, green:112, blue_dark:144, white_2:176, amber:208`.

Isso já prova, no código real, exatamente o que o operador descreveu: **o mesmo `color_wheel` verde é 60 no Beam 1 e 112 no Beam 2** — hoje resolvido corretamente pelo `adapter.resolve`, mas usado por **zero scripts ativos**. Os 14 scripts em produção escrevem sempre `0` (branco/aberto) nesse canal, exceto um pulso inicial `1→0` em alguns.

---

## 9. Inventário de uso nos scripts

15 arquivos em `scripts/`. Nenhum escreve canal absoluto literal em `SetChannel` (ex.: `SetChannel(132, ...)`) — todo canal passa por `getChannel`. Isso é uma boa notícia: **a portabilidade de endereço já está resolvida**. O problema é a portabilidade de **valor semântico**.

| Script | Categoria(s) | Fixtures | Atributos | Risco de portabilidade | Observação |
|---|---|---|---|---|---|
| `brut-fita-full.js` | (c) canal semântico via getChannel, (e) valor DMX fixo, (f) ID hardcoded, (i) não usa adapter | B01–B04, Fita LED | `dimmer` | Baixo/médio | Nível fixo 200 |
| `brut-pisca-lados.js` | (c)(e)(f)(i) | B01–B04 | `dimmer` | Baixo/médio | Grupos físicos esquerda/direita hardcoded |
| `brut-pisca-cruz.js` | (c)(e)(f)(i) | B01–B04 | `dimmer` | Baixo/médio | Grupos 1+4 / 2+3 |
| `brut-pisca-combo.js` | (c)(e)(f)(i) | B01–B04 | `dimmer` | Médio | Endereços em comentário; ordem física hardcoded em `CHASE_SEQUENCE` |
| `mov-desc-branco.js` | (c)(e)(f)(h)(i) | MH1/MH2, B01–04, Fita | roda/cor, strobo, fecho, prisma, pan/tilt/speed, dimmer | **Alto** | `color_wheel`/`prism_1` sempre 0; posições `mov-preset` |
| `mov-desc-full-reset.js` | idem | idem | idem | **Alto** | Reset oculto após descida |
| `mov-desc-mh-brut.js` | idem | idem (+ fita) | idem | **Alto** | Também toca fita apesar do nome |
| `mov-desc-rib-reset.js` | idem | MH1/MH2, fita | idem | **Alto** | Nome cita "rib" mas não toca ribalta |
| `mov-desc-sync-loop.js` | idem | MH1/MH2, Rib1/Rib2, B01–04, fita | atributos completos de MH + ribalta | **Alto** | Maior alcance de fixtures; assume 8 LEDs por ribalta |
| `mov-desc-seq-fade.js` | idem | MH1/MH2, Rib1/Rib2, fita | idem | **Alto** | Máquina de estados de descida MH/ribalta |
| `mov-traj-rib-alto.js` | idem | somente MH1/MH2 | shutter, roda, pan/fine, tilt, speed | **Alto** | Não toca ribalta apesar do nome |
| `mov-traj-rib-baixo.js` | idem | somente MH1/MH2 | idem | **Muito alto** | Usa extremos crus `pan/tilt = 0/128/255` |
| `mov-traj-mh-rib.js` | idem | MH1/MH2, Rib1/Rib2 | MH completo + ribalta completa | **Alto** | 8 fases MH, 7 fases ribalta |
| `mov-preset.js` | (c)(e)(f)(h)(i) | MH1/MH2, fita, 4 ribaltas RGB estáticas (desativadas) | movimento, shutter, RGB, dimmer | **Muito alto** | Biblioteca injetada + efeito standalone (F4); contém `MP_M1`/`MP_M2` |
| `fire-base.js` | **(b) adapter parcial**, (c)(e)(f)(h) | catálogo amplo (MH, Wosh, ribaltas, bruts, fita, PARs) | resolvers amplos; único uso real de `adapter.resolve` (cor MH) | Médio/alto se ativado sem migração | **Inerte** — não injetado pelo loader hoje |

**Conclusão do inventário:** nenhum script usa o adapter integralmente; apenas um (`fire-base.js`) o usa parcialmente e está fora de operação. Todos os 14 scripts ativos dependem de: ID de fixture hardcoded, valores DMX hardcoded (posição, velocidade, shutter, roda sempre em 0) e, nos scripts de trajetória, geometria física do rig hardcoded (`MP_M1`/`MP_M2`, `MP_MH_GAP`). Trocar o modelo de um moving head hoje **quebraria silenciosamente** o comportamento visual desses 12 scripts `mov-*`, porque os valores de posição/velocidade não seriam recalculados — continuariam sendo os números certos apenas para os moving heads atuais.

---

## 10. Inventário de fixtures

24 fixtures cadastradas em `shows/vp.show.json` (ativas e desativadas). Não há campo `aliases` dedicado nem `profile`; `model`/`fixtureType` são metadados descritivos que **não** participam da resolução de canal ou valor.

| Fixture | Start–fim | Canais | Tipo | Estado | Adapter semântico hoje |
|---|---:|---:|---|---|---|
| Moving Head Beam 1 | 123–138 | 16 (17 aliases declarados — inconsistência) | `moving_head_beam` | ativo | `adapters.color` (8 cores) |
| Moving Head Beam 2 | 203–218 | 16 (17 aliases declarados — inconsistência) | `moving_head_beam` | ativo | `adapters.color` (8 cores) |
| Moving_Wosh | 171–186 | 16 | `moving_head` | ativo | nenhum |
| ParLed_Deluxe_1 | 1–8 | 8 | `par_led` (layout A) | ativo | nenhum |
| ParLed_Deluxe_2 | 9–16 | 8 | `par_led` (layout B) | ativo | nenhum |
| ParLed_Deluxe_3 | 17–24 | 8 | `par_led` (layout B) | ativo | nenhum |
| ParLed_Deluxe_4 | 25–32 | 8 | `par_led` (layout B) | **desativado** | nenhum |
| ParLed_Deluxe_5 | 33–40 | 8 | `par_led` (layout A) | sem `enabled` explícito | nenhum |
| ParLed_Deluxe_9_extra (`_6`) | 74–81 | 8 | `par_led` (layout A) | sem `enabled` explícito | nenhum |
| ParLed_Deluxe_7 | 49–56 | 8 | `par_led` (layout A) | sem `enabled` explícito | nenhum |
| ParLed_Deluxe_8 | 57–64 | 8 | `par_led` (layout B) | sem `enabled` explícito | nenhum |
| ParLed_Deluxe_9 | 65–72 | 8 | `par_led` (layout B) | sem `enabled` explícito | nenhum |
| parLed1 (teste) | 1–8 | 8 | `par_led` | **desativado** | nenhum |
| Ribalta_1 | 258–270 | 13 | `ribalta` | ativo | nenhum (calibração física sim) |
| Ribalta_2 | 271–283 | 13 | `ribalta` | ativo | nenhum (calibração física sim) |
| ribalta-rgb-static_1..4 | 284–307 | 6 cada | `ribalta_rgb_static` | **desativadas (4)** | nenhum |
| Fita_Led | 404 | 1 | `fita_led` | ativo | nenhum |
| Mini_Brut_01 | 400 | 1 | `mini_brut` | ativo | nenhum |
| Mini_Brut_02 | 402 | 1 | `mini_brut` | ativo | nenhum |
| Mini_Brut_03 | 401 | 1 | `mini_brut` | ativo | nenhum |
| Mini_Brut_04 | 410 | 1 | `mini_brut` | ativo | nenhum |

**Achado relevante — dois layouts de PAR LED coexistem no mesmo modelo nominal "ParLed Deluxe":**

- **Layout A** (`_1`, `_5`, `_6`, `_7`): `dimmer, strobo, macro, macro_speed, red, green, blue, white`.
- **Layout B** (`_2`, `_3`, `_4`, `_8`, `_9`): `macro, color_wheel, speed, dimmer, red, green, blue, (vazio)`.

Isso contradiz `banco-de-conhecimento/par-led.md`, que descreve os 9 PARs como idênticos. Qualquer script "genérico para PAR LED" precisa lidar com essa divergência real — não é uma hipótese, é o estado atual do `show.json`.

**Achado relevante — inconsistência de contagem de canais nos moving heads:** `channelCount: 16` está declarado, mas o array `channels` tem 17 entradas em ambos os beams (`shows/vp.show.json:272-288`, `320-336`). Vale confirmar/corrigir antes de basear qualquer profile nisso.

**Moving Head 1 — o que falta:** valores de `gobo_wheel`, `prism_1`, `prism_1_rotation` **não estão documentados em lugar nenhum do repositório** (nem código, nem `banco-de-conhecimento/`). Somente os aliases/canais existem. Não foram inventados valores aqui.

---

## 11. Matriz de capabilities

Ver documento dedicado: [`19-07-2026-matriz-capabilities-fixtures.md`](./19-07-2026-matriz-capabilities-fixtures.md).

---

## 12. Comparação Moving 1 × Moving 2

| Atributo | Canal rel. M1 | Canal rel. M2 | Canal abs. M1 | Canal abs. M2 | Tipo | Valor/range M1 | Valor/range M2 | Status | Evidência |
|---|---|---|---|---|---|---|---|---|---|
| `color_wheel` | 1 | 1 | 123 | 203 | enumerado (adapter) | `white0,red30,green60,blue_light90,yellow120,purple150,blue180,amber210` | `white0,red16,yellow48,purple_dark80,green112,blue_dark144,white_2 176,amber208` | **Mapeado no código (via adapter), mas divergente dos valores fornecidos pelo operador para o M2** ⚠️ | `shows/vp.show.json:302-312`, `348-357` |
| `strobo` | 2 | 2 | 124 | 204 | contínuo/faixa | não documentado | nota JSON cita 175/190/205 e fecho=255 | Parcial (só M2 tem nota) | `shows/vp.show.json:319-347` |
| `fecho_lampada` (dimmer) | 3 | 3 | 125 | 205 | contínuo | usa 255 nos scripts | usa 255 nos scripts | Funcional, sem faixa fina documentada | scripts `mov-*` |
| `gobo_wheel` | 4 | 4 | 126 | 206 | enumerado | **NÃO ENCONTRADO** | **NÃO ENCONTRADO** | **Pendente — nenhum script usa** | busca global |
| `prism_1` | 5 | 5 | 127 | 207 | enumerado | **NÃO ENCONTRADO** (scripts só escrevem 0) | **NÃO ENCONTRADO** (idem) | **Pendente** | `mov-desc-*.js` |
| `prism_1_rotation` (M1) / `prism_rotation` (M2) | 6 | 6 | 128 | 208 | contínuo | **NÃO ENCONTRADO** | **NÃO ENCONTRADO** | **Pendente** | nomes de alias já divergem entre M1/M2 |
| `virtual_speed` | 7 | 7 | 129 | 209 | virtual (não sai DMX) | usado (210 nos scripts) | usado (210 nos scripts), nota JSON diz invertido | Funcional | `electron/engine/interpolator.js` |
| `frost` | 8 | 8 | 130 | 210 | ? | **NÃO ENCONTRADO** | **NÃO ENCONTRADO** | Pendente | — |
| `prism_1_rotation_2` (M1) / `focus` (M2) | 9 | 9 | 131 | 211 | — | alias **diferente** entre unidades | alias **diferente** entre unidades | **Os dois moving heads não são canal-compatíveis a partir daqui** | `shows/vp.show.json:280`, `328` |
| `pan` | 10 | 10 | 132 | 212 | contínuo, interpolado | offset `panOffset:40` | sem `panOffset` declarado | Funcional (via interpolador) | `electron/main.js:824-842` |
| `pan_fine` | 11 | 11 | 133 | 213 | fine (não combinado 16-bit) | não usado pelos scripts atuais | não usado | Existe canal, sem uso semântico | — |
| `tilt` | 12 | 12 | 134 | 214 | contínuo, interpolado | offset `tiltOffset:4` | offset `tiltOffset:6` | Funcional | `shows/vp.show.json:298-301`, `346-347` |
| `tilt_fine` | 13 | 13 | 135 | 215 | fine | não usado | não usado | Existe canal, sem uso | — |
| `special_random` | 14 | 14 | 136 | 216 | ? | **NÃO ENCONTRADO** | **NÃO ENCONTRADO** | Pendente | — |
| 15º alias (M1: `indefinido`) | 15 | 15 | 137 | 217 | ? | desconhecido | `reset` no M2 nesta posição — **alias nº15 diverge entre unidades** | Confirma que o layout de 17 posições já não é idêntico entre M1/M2 | `shows/vp.show.json:283-284`, `331` |
| `reset` (M1, posição 16) / vazio (M2, posição 16) | 16 | 16 | 138 | 218 | ? | reset | canal 16 vazio no M2 | Divergente | `shows/vp.show.json:286-288`, `333-335` |

**Posições físicas (pan/tilt) já testadas para os dois** — documentadas em `banco-de-conhecimento/moving.md:7-43`, mas **não conectadas ao adapter**; hoje vivem hardcoded em `scripts/mov-preset.js` como `MP_M1`/`MP_M2`:

| Posição | Pan/Tilt M1 | Pan/Tilt M2 |
|---|---|---|
| Frente | 84/36 | 84/32 |
| Altar | 84/78 | 82/72 |
| Chão | 84/144 | 82/125 |
| Lateral | 42/35 | 44/26 |

**Sobre os valores de `color_wheel` do Moving 2 fornecidos pelo operador nesta tarefa** (branco 0, vermelho 10, amarelo 20, roxo médio 30, verde 40, azul escuro 50, branco gelo 60, âmbar 70, branco amarelado 80, laranja 90, roxo escuro 100, azul claro 110, âmbar 2 120, amarelo 2 130, roxo claro 140):

- Esse mapeamento **não existe hoje em nenhum lugar do repositório** — nem no `show.json` (que tem apenas 8 valores em passos de 16 ou 32, ver acima), nem no `banco-de-conhecimento/`, nem nos scripts.
- Há uma tabela parcial e diferente no preview 3D (`src/viewer3d/fixtures/movinghead.js:38-50`), com valores em passos de 10 mas cores diferentes das citadas pelo operador (ex.: 20=verde no viewer, mas o operador mediu 20=amarelo) — **são conjuntos de dados independentes**, não a mesma fonte.
- **Recomendação:** o `show.json` atual (`adapters.color` do M2) precisa ser **substituído** pelos 15 valores medidos fisicamente pelo operador, pois são uma medição direta e mais granular. Antes de aplicar, confirmar os pontos levantados pelo operador (faixas exatas vs. valores únicos, cores intermediárias, duplicidade do "Âmbar: 70" — ver seção "Dúvidas humanas").
- Isso também expõe que os 8 valores atuais no `show.json` para o M2 provavelmente **já estão desatualizados/imprecisos** frente à medição mais recente do operador — mais um motivo para não usar o `show.json` atual como verdade absoluta sem revisão.

---

## 13. Pan, tilt, fine e speed

- Pan/tilt funcionam bem hoje porque passam por **resolução de canal semântica** (`getChannel`) e por um **interpolador dedicado** (`electron/engine/interpolator.js`), não porque passam pelo adapter de valor.
- `virtual_speed` é um canal **puramente virtual**: nunca é escrito no universo DMX; alimenta `interpolator.setSpeed()`, que decide a velocidade de aproximação do pan/tilt ao alvo a cada tick de 40ms (`main.js:953-968`; `interpolator.js:74-153`).
- **Fine channels (`pan_fine`/`tilt_fine`) existem como aliases**, mas **não há combinação coarse+fine em 16-bit em lugar nenhum** — nem no adapter, nem no compositor, nem no interpolador, nem no Viewer3D. Hoje são, na prática, canais órfãos (resolvíveis, mas não usados semanticamente pelos scripts ativos).
- **Offsets físicos** (`panOffset`/`tiltOffset`) são aplicados dentro do `universe.setChannel`, **depois** do compositor e **antes** do Art-Net — de forma transparente para o script (o script nunca precisa somar/subtrair offset).
- **Calibração física de ribalta** é aplicada **só na cópia enviada ao Art-Net**, depois de tudo (offset já embutido no universo lógico que ela recebe como entrada). Não há duplicação de aplicação — cada camada (offset genérico vs. calibração física de ribalta) atua uma vez, em pontos diferentes do pipeline, mas atenção: se uma ribalta tiver `tiltOffset` não-zero futuramente, o valor que chega à calibração já viria deslocado, compondo os dois efeitos — hoje ambos os `tiltOffset` de ribalta são `0`, então essa composição não está em teste.
- **Moving heads não passam pela calibração física** (ela é restrita por nome exato a `Ribalta_1`/`Ribalta_2`).
- **Viewer3D recebe o universo lógico (pré-calibração de ribalta)** — só isso já foi discutido na seção 4; para pan/tilt de moving head não há divergência adicional, pois eles não passam por calibração física alguma hoje.
- Resolução de fixture, conversão semântica, calibração física, offset de show e visualização 3D são, hoje, **quatro camadas fisicamente separadas no código**, na ordem: resolução (main.js) → offset (universe.js) → calibração de ribalta (ribaltaPhysicalCalib.js, só Art-Net) → Viewer3D (lê antes da calibração). Não há sobreposição indevida hoje, mas a arquitetura não impede que aconteça se alguém aplicar calibração duas vezes no futuro — não há guard-rail formal contra isso.

---

## 14. Color wheel e cores semânticas

- **Moving head com color wheel:** já resolvido tecnicamente (adapter + `fixture.adapters.color`), mas **não usado pelos scripts ativos** e com dados desatualizados frente à medição mais recente do operador (seção 12).
- **PAR LED RGB/RGBW:** não existe hoje nenhuma função que converta `"green"` em `R=0,G=255,B=0`. Os PAR LEDs sequer têm scripts ativos de efeito — são controlados só por cenas estáticas do `show.json`. `fire-base.js` (inerte) tem resolvers de canal RGB, mas não uma função de cor semântica para RGB.
- **Fixture sem suporte à cor solicitada:** hoje, `adapter.resolve` retorna `null` silenciosamente. Não há warning, não há erro visível ao operador, não há fallback aproximado. Este é um risco real de "falha silenciosa" que a arquitetura futura precisa eliminar (ver critérios de aceitação).

---

## 15. Shutter e strobe

- Canal `strobo`/`fecho_lampada` (moving head) e `strobo` (ribalta) existem e são escritos hoje com valores crus (`0`/`255` na maioria dos scripts). Não há suporte semântico para "strobo médio/rápido/lento".
- Nota do `show.json` do Beam 2 documenta 3 valores de strobo (175/190/205), mas nenhum script os utiliza — todos usam apenas `0`/`255`.
- PAR LED layout A tem alias `strobo` dedicado; layout B **não tem** alias `strobo` — o strobo do layout B é feito via macro interno do aparelho (faixa 201-255 do canal `macro`, conforme `banco-de-conhecimento/par-led.md`). Isso já é, por si só, uma prova de que a mesma "intenção" (strobo) precisa de tratamento **por layout/modelo**, não um único canal fixo.

---

## 16. Prism

- Alias existe nos dois moving heads (`prism_1` no M1, `prism_1` também no M2 — mas a rotação já diverge de nome: `prism_1_rotation` no M1 vs `prism_rotation` no M2).
- **Nenhum valor de ativação/rotação de prisma foi encontrado em código ou documentação para nenhum dos dois moving heads.** Os scripts ativos só escrevem `0` (prisma desligado) nesse canal.
- Isso é exatamente o caso de uso que a auditoria pediu para analisar com cuidado: os dois moving heads podem ter faixas DMX totalmente diferentes para o "mesmo" efeito visual de prisma, e a arquitetura recomendada (seção 20/21) precisa abstrair isso sem forçar as duas unidades a compartilhar faixa.

---

## 17. Gobo

- Alias `gobo_wheel` existe nos dois moving heads.
- **Nenhum script ativo usa gobo.** Nenhuma tabela de valores existe em código ou documentação.
- Idêntico ao caso do prisma: é capability **presente na definição, mas totalmente não usada e não mapeada** hoje.

---

## 18. PAR LEDs

- 9 unidades "ParLed Deluxe" nominalmente, mas **dois layouts de canal reais e divergentes** (seção 10).
- **Nenhum script ativo dirige os PAR LEDs dinamicamente.** Eles hoje só recebem valores das cenas estáticas do `show.json` (`parled_static`, `parled_strobo`, `red_static`, etc.). Isso está **estático por ausência de scripts**, não por limitação técnica: o compositor e o universo já suportam escrita por frame sem throttling (confirmado por não haver cache/lock que impeça isso).
- O compositor não tem nenhuma restrição técnica contra chase, onda, alternância, fade, pulso, grupos pares/ímpares, sequência esquerda→direita, ou combinação com moving heads/ribaltas/mini bruts — tudo isso é possível **hoje**, criando apenas os scripts. O que falta é decidir se a intenção semântica ("green" em RGB vs. "green" em color wheel) já deve nascer abstraída ou se os primeiros scripts de PAR LED podem, por ora, usar canais RGB crus (que já são bem resolvidos hoje via `getChannel`).
- `fire-base.js` já tem resolvers de canal para PAR LED (RGB, dimmer, strobo), mas está inerte — pode servir de base direta para os novos scripts assim que for reativado/injetado.
- O Viewer3D representa RGB dinamicamente (recalcula a cada frame), mas **não lê o canal `white`** (RGBW não é representado) e tem mapas de canal hardcoded que **já divergem do `show.json` atual** para os PARs `_1`, `_5`, `_6`, `_7`. Isso é um risco de o operador ver uma cor no preview diferente da que sai fisicamente.

---

## 19. Ribaltas e mini bruts

- **Ribalta_1** e **Ribalta_2** têm mapa de canal idêntico (`tilt, speed, dimmer, led_1..8, strobo, function`), mas calibração física própria por unidade (`offset:-20, knee:40` em ambas; `gain` só declarado para Ribalta_2 no código atual — divergência com a documentação, que cita `gain:0.915` para a Ribalta_2, enquanto o código tem `gain:1`; vale confirmar qual está correto antes de confiar cegamente na calibração hoje).
- **Debug exclusivo da Ribalta_2** via `VP_RIBALTA_DEBUG=1` — não existe equivalente para Ribalta_1.
- **Calibração física atinge as duas ribaltas** (não é exclusiva da Ribalta_2, ao contrário do que o debug sugere).
- 4 ribaltas RGB estáticas existem no show mas estão **desativadas**; só `mov-preset.js` já as trata (com RGB fixo em 255) caso um dia sejam reativadas.
- **Mini bruts:** 4 unidades, cada uma com 1 canal (`dimmer`), controlados por 4 scripts diferentes hoje (estático, cruz, lados, combo) — todos dinâmicos exceto `brut-fita-full.js` (nível fixo). Não há limitação técnica para expandir os padrões.
- O Viewer3D troca os canais de Mini_Brut_02/03 em relação ao JSON atual (JSON: B02=402, B03=401; viewer usa o inverso) — mais uma divergência de mapeamento hardcoded no preview a corrigir.

---

## 20. Viewer3D e representação visual

Riscos confirmados de divergência entre o Viewer3D e a realidade física/DMX:

1. **Ribalta:** Viewer3D lê universo pré-calibração física; Art-Net usa pós-calibração. Tilt visual pode não bater com o tilt físico real.
2. **PAR LED:** mapas de canal hardcoded em `src/viewer3d/scene.js` já divergem do `show.json` atual para pelo menos 4 unidades; canal `white` (RGBW) não é lido — o preview nunca mostrará branco puro do canal W.
3. **Mini Brut:** canais de B02/B03 trocados no viewer em relação ao show.
4. **Moving head:** o modelo 3D usa perfil textual "Magic Dazzle MD-MH702" como rótulo do preview (não é o modelo real declarado no JSON) e ignora `special_random`.
5. Nenhum desses resolvedores do Viewer3D passa pelo adapter — são tabelas independentes, então qualquer futura mudança no adapter/show precisa ser replicada manualmente lá, ou o Viewer3D vai divergir silenciosamente. Isso é um risco arquitetural de longo prazo além do escopo dos 50 scripts, mas vale registrar.

---

## 21. Calibração, offsets e adapter — resumo de camadas

| Camada | Onde | Quando no pipeline | Transparente para o script? |
|---|---|---|---|
| Resolução de canal (alias→absoluto) | `main.js` | Antes de `SetChannel` | Sim, via `getChannel` |
| Resolução de valor semântico | `adapter.js` | Antes de `SetChannel` | Sim, via `adapter.resolve` (quando usado) |
| Merge de camadas (HTP/linear) | `compositor.js` | A cada frame, depois de `OnExecute` | Sim |
| Offset físico (pan/tilt) | `universe.js` (dados de `fixtureOffsets.js`) | Ao gravar no universo | Sim |
| Interpolação pan/tilt/speed | `interpolator.js` | A cada tick, antes do universo | Sim |
| Calibração física de ribalta | `ribaltaPhysicalCalib.js` | Só na cópia para Art-Net, no fim do frame | Sim para o script, mas **invisível ao Viewer3D** |
| Envio Art-Net | `artnet.js` | Fim do frame | — |

---

## 22. Problemas e riscos (consolidado)

| # | Risco | Severidade | Evidência |
|---|---|---|---|
| 1 | Falha silenciosa: `adapter.resolve`/`getChannel` retornam `null` sem log em qualquer erro | **Alta** | `adapter.js:70-72`, `main.js:1097-1102` |
| 2 | Nenhum script ativo usa o adapter — arquitetura semântica existe mas está desconectada da prática | **Alta** | Seção 9 |
| 3 | `fire-base.js`, único consumidor real do adapter, está inerte | **Alta** | `main.js` `readScriptCode` só trata `mov-preset.js` |
| 4 | Valores de `color_wheel` do M2 no `show.json` provavelmente desatualizados frente à medição mais recente do operador | **Alta** | Seção 12 |
| 5 | Nenhum valor de gobo/prism mapeado para M1 nem M2 | **Alta** (bloqueante para scripts que usem esses atributos) | Seção 16/17 |
| 6 | Moving Head 1 ainda sem nenhum valor físico confirmado (pan/tilt/cor/prism/gobo) | **Alta** | Aguardando mapeamento de hoje à noite |
| 7 | Dois layouts de canal diferentes sob o mesmo "modelo" ParLed Deluxe | **Média/Alta** | Seção 10 |
| 8 | Inconsistência `channelCount:16` vs. 17 aliases nos dois beams | **Média** | Seção 10 |
| 9 | Divergência de alias na posição 15 entre M1 (`indefinido`) e M2 (`reset`) | **Média** | Seção 12 |
| 10 | Viewer3D com mapas hardcoded divergentes do show atual (PAR, mini brut) e sem leitura de `white` | **Média** | Seção 20 |
| 11 | Viewer3D lê universo pré-calibração de ribalta; Art-Net usa pós-calibração | **Média** | Seção 4/20 |
| 12 | `gain` de calibração da Ribalta_2 diverge entre código (`1`) e documentação (`0.915`) | **Média** | Seção 19 |
| 13 | Sem validação de schema para `fixture.adapters` — `validateFixtures` não cobre esse campo | **Baixa/Média** | `show.js:198-246` |
| 14 | Sem cache no adapter — não é problema de performance no volume atual, mas cada chamada refaz toda a busca | **Baixa** | `adapter.js:51-72` |
| 15 | Scripts `mov-*` fortemente acoplados à geometria física do rig via `MP_M1`/`MP_M2` — qualquer novo moving exigiria nova tabela | **Alta para escalabilidade, não bloqueante para hoje** | `mov-preset.js` |

---

## 23. Modelo de dados recomendado

Avaliação das opções pedidas:

| Opção | Manutenção | Reuso | Duplicação | Segurança | Compat. c/ scripts atuais | Facilidade 3º moving | Facilidade correção | Testabilidade |
|---|---|---|---|---|---|---|---|---|
| A. Tudo no `adapter.js` | Ruim (código vira dado) | Ruim | Alta | Ok | Alta | Ruim | Ruim | Ok |
| B. Tudo no `show.json` (atual, parcial) | Ok para poucos casos; ruim em escala | Nenhum (cada instância duplica) | **Alta — já observada** (M1/M2 têm listas de cor totalmente redigitadas) | Ok | Alta (é o que já existe) | Ruim (copiar tudo de novo) | Ok (edita JSON) | Ruim (sem schema) |
| C. Só no profile da fixture | Boa | Ótimo | Baixa | Ok | Precisa migração | Ótima | Ok | Boa |
| D. Arquivos separados por modelo | Boa | Ótimo | Baixa | Ok | Precisa migração | Ótima | Boa | Boa |
| E. Registry central de capabilities | Boa, mas mais abstrato | Ótimo | Baixa | Ok | Precisa migração maior | Ótima | Boa | Ótima |
| **F. Mistura controlada: profile por modelo + calibração por instância** | **Boa** | **Ótimo** | **Baixa** | **Ok** | **Alta — pode coexistir com `fixture.adapters` atual durante a transição** | **Ótima** | **Ótima** | **Boa** |

### Recomendação decisiva: **Opção F**

Separar explicitamente:

**Profile/modelo** (arquivo por modelo, ex. `electron/fixtureProfiles/movingHeadBeam200W.js` e `movingHeadBeam230W16ch.js`, ou uma pasta `electron/profiles/*.json`):
- lista de canais/aliases esperados;
- tipo de cada capability (`continuous`, `enumerated`, `fine16`, `range`, `compound`);
- ranges físicos (min/max, zona morta);
- resolução coarse/fine.

**Instância física** (permanece em `shows/vp.show.json`, no objeto da fixture):
- `startChannel`, `panOffset`/`tiltOffset`, `enabled`;
- os **valores calibrados** daquele profile para aquela unidade específica (ex.: a tabela de cor do color wheel, que já existe hoje como `fixture.adapters.color` — este objeto passa a ser "os números medidos para ESTA unidade daquele profile", não um adapter improvisado por instância sem relação com modelo nenhum).

Isso aproveita 100% do que já existe (`fixture.adapters.color` continua sendo o lugar dos valores calibrados) e adiciona a peça que falta: um **profile** que declara *quais* capabilities aquele modelo tem e *que tipo* de dado cada uma exige, permitindo validar e dar erro claro quando uma fixture não suporta algo, em vez de retornar `null` silenciosamente.

---

## 24. API semântica recomendada

Adotar uma extensão do `adapter` atual (mantendo `resolve`/`getChannel` como estão, para não quebrar scripts legados) com uma camada nova por cima:

```js
adapter.setColor(fixtureId, 'green')          // resolve canal + valor e já escreve, ou retorna {ok:false, reason}
adapter.setStrobe(fixtureId, 'medium')
adapter.setPrism(fixtureId, 'on' | 'rotate_clockwise' | value)
adapter.setGobo(fixtureId, 'gobo_3')
adapter.setMovementSpeed(fixtureId, 0.4)       // 0..1 normalizado
adapter.setPanTilt(fixtureId, panDeg, tiltDeg) // ou 0..1 normalizado, a decidir com o operador
adapter.getCapabilities(fixtureId)             // introspecção: o que essa fixture suporta
```

Cada função:
1. Resolve o profile do modelo daquela fixture (por um campo novo, ex. `fixture.profileId`, OU inferido do `model`/`fixtureType` atual durante a migração).
2. Verifica se a capability existe no profile. Se não existir → **retorno estruturado de erro** (`{ok:false, reason:'capability_not_supported', capability:'prism'}`), nunca falha silenciosa.
3. Converte a intenção semântica no valor/canal certo daquela instância (usando os dados de calibração hoje já presentes em `fixture.adapters`).
4. Chama `SetChannel` internamente — o script não precisa mais compor `getChannel` + `adapter.resolve` + `SetChannel` manualmente (embora essa API de baixo nível continue disponível para casos avançados).

**Tipos de capability e tratamento:**

- **Continuous** (dimmer, pan, tilt, speed, zoom, focus): entrada normalizada (0-1) ou em unidade natural (graus), convertida para 0-255 pelo profile, com clamp e zona morta física quando aplicável.
- **Fine/16-bit** (pan+pan_fine): a API recebe um valor normalizado/graus e o profile decide se combina em 16-bit (`coarse = value >> 8`, `fine = value & 0xFF`) ou usa só o coarse quando o fine não é semanticamente necessário. Hoje nenhum fixture combina isso — será uma capability nova, não uma que já existe e precisa só ser exposta.
- **Enumerated** (cores, gobos, prisma on/off): lookup exato no mapa de calibração da instância, dentro do profile do modelo. Se a chave não existir na instância mas existir no profile como "capability declarada", isso é um erro de dados (calibração faltando), diferente de "capability não suportada pelo modelo".
- **Range** (rotação de color wheel, prism rotation, gobo shake): guardar `{min,max}` ou tabela de sub-faixas por modelo; a API recebe intenção (`'rotate_clockwise'`, velocidade 0-1) e escolhe o ponto dentro da faixa.
- **Compound** (`setColor` em RGB vs. color wheel; `setPanTilt` 16-bit): a função semântica decide, olhando o profile, se o canal alvo é RGB (`setRGB`) ou color wheel (`lookup`) — o script não sabe nem precisa saber qual dos dois é.

---

## 25. Compatibilidade com scripts existentes

- **Manter a API atual** (`SetChannel`, `getChannel`, `adapter.resolve`) funcionando exatamente como hoje — os 14 scripts ativos continuam rodando sem alteração.
- **Adicionar a API semântica nova** ao lado, sem substituir nada.
- Classificação dos usos raw atuais:
  - **Aceitável temporariamente:** todo o uso de `getChannel` + valores crus de posição/velocidade nos scripts `mov-*` — já funciona, migrar tem custo e não é urgente para os 50 scripts novos, contanto que os novos scripts não repitam esse padrão para atributos ainda não mapeados (cor, prism, gobo).
  - **Deve migrar quando o Moving 1 for mapeado:** os pontos onde `color_wheel`/`prism_1`/`gobo_wheel` são hoje escritos como `0` fixo — esses scripts deveriam passar a usar a API semântica assim que ela existir, para não continuar ignorando as capabilities reais dos equipamentos.
  - **Perigoso:** `mov-traj-rib-baixo.js`, que usa extremos crus `pan/tilt=0/255` — se algum dia rodar em outro modelo sem os mesmos limites físicos, pode gerar movimento brusco. Recomendo migrar este cedo para uma API com zona de segurança (`setPanTilt` com clamp por profile).
  - **Necessário manter raw por enquanto:** `mov-preset.js` (`MP_M1`/`MP_M2`), pois contém posições físicas específicas do rig atual que ainda não têm equivalente semântico ("frente", "altar", "chão", "lateral") — podem virar presets nomeados no profile futuramente, mas não é bloqueante.
- Não bloquear scripts legados: a API antiga não deve ser removida nem gerar warning obrigatório — apenas os novos scripts para os 50 efeitos devem, sempre que possível, preferir a API semântica assim que ela cobrir o atributo necessário.

---

## 26. Estratégia de migração

1. Formalizar o profile de `color_wheel` para os dois beams (já existe como dado; falta o profile declarativo).
2. Estender o mesmo padrão para `dimmer`/`strobo`/`prism`/`gobo` assim que os valores forem medidos (Moving 1 hoje à noite; Moving 2 já parcialmente medido pelo operador nesta tarefa).
3. Criar `adapter.setColor`/`setPrism`/`setGobo`/`setStrobe`/`setMovementSpeed`/`setPanTilt` como camada nova sobre o `resolve` atual.
4. Migrar `fire-base.js` para essa API nova (ele já é a única biblioteca com intenção de abstração) e reativá-lo como base para os 50 scripts.
5. Scripts `mov-*` existentes continuam como estão — não é obrigatório reescrevê-los agora.
6. Novos scripts (os 50) nascem usando a API semântica sempre que a capability já estiver mapeada; usam `getChannel`/`SetChannel` cru apenas para o que ainda não tiver profile (ex.: gobo, antes do Moving 1 ser mapeado).

---

## 27. Testabilidade

**Testes unitários propostos (sem hardware, sem Art-Net):**
- resolver fixture por id e por nome normalizado;
- resolver canal por alias, incluindo alias ausente → `null`;
- resolver capability presente/ausente no profile;
- valor semântico → DMX para color wheel de M1 vs. M2 (mesma intenção, valores diferentes);
- RGB/RGBW: `setColor('green')` → canais corretos por layout A e B de PAR LED;
- pan/tilt 8-bit atual (sem fine);
- pan/tilt 16-bit (quando a capability for implementada) — combinação coarse/fine;
- prism/gobo por modelo, assim que houver valores;
- strobe por faixa (quando existir tabela);
- capability ausente → erro estruturado, não `null` silencioso;
- fixture inexistente → erro claro;
- alias/nome duplicado ou colidente após normalização;
- profile inválido/ausente;
- clamp e valor fora de faixa;
- múltiplas fixtures simultâneas não vazam estado entre si.

**Testes de integração propostos:**
- script usando `setColor('green')` em M1 e M2 simultaneamente → valores DMX diferentes, resultado visual esperado igual;
- script usando moving + PAR LED com a mesma intenção de cor;
- script usando prism nos dois movings (quando mapeado);
- script dinâmico de PAR LED (chase/fade) rodando por vários frames — verificar buffer do compositor;
- composição HTP entre duas camadas tocando o mesmo canal;
- comparação Viewer3D vs. universo lógico vs. buffer físico (ribalta) — reproduzir a divergência já identificada nesta auditoria, como teste de regressão;
- Art-Net **nunca** é exercitado nesses testes (mock do `artnet.js` ou verificação apenas do buffer antes do envio UDP).

---

## 28. Critérios de aceitação (adapter "pronto" para os 50 scripts)

1. `adapter.setColor(fixtureId, 'green')` produz o valor certo tanto no Moving 1 quanto no Moving 2, usando os dados calibrados de cada unidade.
2. O script não conhece o valor DMX de color wheel nem o canal físico — só a intenção.
3. A mesma chamada de cor funciona também em PAR LED RGB/RGBW (mesmo nome semântico, resultado físico diferente por tipo de fixture).
4. Fixture sem a capability solicitada retorna erro/aviso explícito — nunca falha silenciosa.
5. Pan/tilt continuam funcionando como hoje (via interpolador).
6. Fine channels funcionam quando implementados (nenhum script quebra por isso não existir ainda).
7. Fixtures 8-bit continuam funcionando sem alteração.
8. Speed funciona nos equipamentos compatíveis (moving heads via `virtual_speed`; ribaltas via canal físico `speed`).
9. Strobe funciona com faixas específicas por modelo, quando mapeado.
10. Prism funciona nos dois moving heads apesar dos mapas diferentes, assim que os valores existirem.
11. Gobo funciona conforme o profile de cada moving, assim que os valores existirem.
12. Scripts legados (`mov-*`, `brut-*`) continuam funcionando sem alteração.
13. Múltiplos scripts simultâneos continuam funcionando (camadas isoladas, sem mutação cruzada).
14. Viewer3D não diverge silenciosamente do DMX físico — pelo menos os casos já identificados (ribalta, PAR LED, mini brut) precisam ser corrigidos ou sinalizados.
15. Nenhum script novo precisa usar `startChannel` hardcoded.
16. Nenhuma informação de protocolo do modelo (valores DMX de cor/prism/gobo) fica espalhada pelos scripts — só no profile/calibração.
17. O mapeamento do Moving 1 pode ser preenchido (via o template desta entrega) sem alterar o algoritmo central do adapter — só adiciona dados.
18. Um terceiro modelo de moving (ex.: o já existente `Moving_Wosh`) pode ganhar profile próprio sem reescrever o núcleo do adapter — hoje o Wosh já prova que layouts diferentes coexistem; falta só dar a ele o mesmo tratamento de profile.
19. Testes automatizados cobrem as conversões principais listadas na seção 27.

---

## 29. Priorização — P0, P1, P2

### P0 — obrigatório antes de criar os 50 scripts

- Confirmar e registrar os valores de `color_wheel` do Moving 2 (reconciliar `show.json` atual com a medição nova do operador — ver dúvidas humanas).
- Preencher o template do Moving 1 (pan/tilt/cor/strobe no mínimo; prism/gobo se o tempo permitir hoje à noite).
- Implementar `adapter.setColor()` cobrindo moving head (color wheel) e PAR LED (RGB/RGBW), com erro estruturado para fixture sem suporte.
- Implementar `adapter.setMovementSpeed()`/expor `virtual_speed` de forma semântica (já existe o mecanismo; só falta a função de conveniência).
- Corrigir a inconsistência `channelCount:16` vs. 17 aliases nos beams antes de basear um profile nisso.
- Decidir e documentar se `fire-base.js` será reativado como base dos 50 scripts (ele já tem os resolvers certos) — se sim, ativar a concatenação equivalente à de `mov-preset.js` para os arquivos que dependerem dele.

### P1 — importante antes do evento

- `adapter.setPrism()`/`adapter.setGobo()`, assim que os dois moving heads tiverem valores medidos.
- `adapter.setStrobe()` com faixas por modelo.
- Corrigir divergências de mapeamento do Viewer3D (PAR LED, mini brut, ribalta pré/pós calibração).
- Resolver a divergência de `gain` de calibração da Ribalta_2 entre código e documentação.
- Adicionar logging não-silencioso para falhas de resolução (mesmo que só em modo debug).
- Validar schema básico de `fixture.adapters` em `validateFixtures`.

### P2 — depois do evento

- Registry central de capabilities completo, com introspecção (`getCapabilities`).
- Suporte formal a 16-bit (fine channels) para pan/tilt.
- Editor visual de fixture/profile.
- Importação automática de manual de fabricante.
- RDM, curvas avançadas de dimmer, zonas mortas configuráveis via UI.
- Unificar os resolvedores paralelos do renderer (`Main.jsx`, `SceneEditor.jsx`, `viewer3d/scene.js`) para consumirem a mesma fonte de profile que o adapter do main process, eliminando as tabelas hardcoded divergentes.

---

## 30. Arquivos que a futura implementação deverá alterar

- `electron/adapter.js` — adicionar funções semânticas (`setColor`, `setPrism`, `setGobo`, `setStrobe`, `setMovementSpeed`, `setPanTilt`, `getCapabilities`), preservando `resolve`/`normalizeKey`/`clampDmx`.
- `electron/main.js` — expor as novas funções na sandbox do script (ao lado de `SetChannel`/`getChannel`/`adapter`); adicionar validação de profile na identificação de fixture.
- `shows/vp.show.json` — atualizar `adapters.color` do Moving Head 2 conforme reconciliação da seção 12; adicionar dados equivalentes para o Moving Head 1 após o mapeamento de hoje.
- Novo(s) arquivo(s) de profile por modelo (local sugerido: `electron/profiles/` ou `electron/fixtureProfiles/`) — um por modelo físico (`movingHeadBeam200W`, `movingHeadBeam230W16ch`, `movingWosh575W`, `parLedDeluxeLayoutA`, `parLedDeluxeLayoutB`, `ribalta`, `miniBrut`, `fitaLed`).
- `scripts/fire-base.js` — candidato natural a virar a base real dos 50 scripts, uma vez reativado e ajustado à nova API.
- `electron/show.js` — estender `validateFixtures` para checar consistência básica de `adapters` e do próprio `channelCount` vs. tamanho de `channels`.
- `src/viewer3d/scene.js` e `src/viewer3d/fixtures/*.js` — corrigir divergências de mapeamento identificadas (não bloqueante para os 50 scripts, mas registrado como dívida).

---

## 31. Dúvidas humanas

Somente decisões que dependem do operador — não podem ser resolvidas lendo código:

1. **Reconciliação do color wheel do Moving 2:** os 15 valores medidos hoje (passo de 10, de 0 a 140) substituem totalmente os 8 valores atuais do `show.json` (passo de 16/32)? Ou os 8 atuais eram já uma primeira tentativa a ser descartada?
2. **"Âmbar: 70" duplicado na anotação:** confirmar se é mesmo duplicação de anotação (tratando como um único âmbar) ou se há evidência física de que 70 e 120 são tons diferentes e ambos devem ser mantidos como capabilities distintas (`amber_1`, `amber_2`).
3. **Faixas vs. valores exatos:** cada cor do color wheel ocupa só o valor exato testado ou uma faixa em torno dele? Isso muda a estrutura de dados (lookup exato vs. range) e só o operador, testando fisicamente os valores intermediários (ex. 31-39 antes do verde 40), pode confirmar.
4. **Comportamento para capability ausente:** quando um script pedir `setGobo()` em uma fixture sem gobo (ex. PAR LED), o comportamento desejado é erro bloqueante, warning silencioso no console, ou no-op documentado?
5. **Cor aproximada é aceitável?** Se um script pedir uma cor que não existe exatamente no color wheel de um moving, o sistema pode escolher a mais próxima automaticamente, ou isso deve sempre falhar explicitamente?
6. **Freeze e animações:** o freeze deve continuar bloqueando só o Art-Net (comportamento atual), ou para os novos 50 scripts o operador quer que freeze também pause certas animações lógicas (ex. parar o "movimento" do interpolador, não só o envio)?
7. **Política de valores seguros:** para pan/tilt de um moving ainda não mapeado (ou mapeado parcialmente), qual o valor de repouso seguro a assumir por padrão nos novos scripts?
8. **Nomes semânticos desejados para gobos e prismas:** o operador tem preferência de nomenclatura (`gobo_3` vs. nomes descritivos como `gobo_estrela`) para facilitar a operação ao vivo?
9. **Resolução real de operação:** os 50 scripts serão operados via F-keys, via biblioteca de scripts recém-criada, ou ambos? Isso não muda o adapter, mas muda a prioridade de quais capabilities precisam de nome amigável primeiro.
10. **Necessidade de suporte a um terceiro modelo no curto prazo:** o `Moving_Wosh` (já cadastrado no show, com CMY, zoom e mais canais) entra no escopo dos 50 scripts agora, ou fica para depois do evento?

---

## 32. Conclusão decisiva

O adapter atual é uma fundação correta, mas incompleta e desconectada da prática: a peça que funciona (`adapter.resolve` + `fixture.adapters.color`) é exatamente o padrão certo a generalizar, mas hoje só existe para cor, só é usada por um script inerte, e os valores do Moving 2 nela provavelmente já estão desatualizados frente à medição feita nesta tarefa. Não há nada de errado na resolução de canal (`getChannel`) — ela já é portátil e não precisa de retrabalho. O trabalho real e necessário antes dos 50 scripts é: (1) reconciliar e formalizar os dados de cor do Moving 2, (2) preencher o Moving 1 com o template desta entrega, e (3) construir as 5-6 funções semânticas do adapter (`setColor`, `setMovementSpeed`, e os stubs de `setPrism`/`setGobo`/`setStrobe` com erro explícito até os valores existirem) apoiadas num profile por modelo, sem quebrar nenhum script legado. Isso é factível no prazo, porque reaproveita quase inteiramente a infraestrutura já existente — não exige reescrever o pipeline de canal, offset, compositor ou Art-Net, todos já corretos e auditados nesta entrega.
