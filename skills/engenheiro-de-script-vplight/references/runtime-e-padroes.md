# Runtime do script vp-light — API e padroes

Estado confirmado contra `electron/engine/engine.js`, `electron/engine/compositor.js`, `electron/engine/interpolator.js`, `electron/engine/artnet.js`, `electron/engine/universe.js`, `electron/main.js` e `electron/preload.js`. Cada secao cita o arquivo e a linha de origem. Documente e use **somente** o que existe no runtime atual.

> **Motor atual: compositor por camadas.** Cada script ativo e uma camada com buffer proprio `Uint8Array(512)`. `SetChannel` escreve **no buffer da camada**, nao no universo. Nao existe `setInterval` por script: o unico relogio e o loop de 40ms do `engine.js`.

> **O `.md` nao participa do runtime.** O motor resolve fixtures sobre o `currentShow` em memoria (`show.getShow()`), nunca sobre este catalogo. Este documento e referencia para gerar scripts.

---

## Loop DMX

- `engine.js:16-17` — `FPS = 25` → `INTERVAL_MS = Math.round(1000/FPS)` = **40ms**.
- `engine.js:28-33` — loop unico por `setInterval`, na ordem: `interpolator.tick()` → `compositor.renderFrame()` → `sendArtDMX(getUniverse())`.
- Nao existe `setInterval` por script nem por page script. Todo `OnExecute` roda dentro do `renderFrame`, no mesmo tick de 40ms.

Tabela de referencia (ciclos de `OnExecute`):

| velocidade | ciclos | tempo aprox. |
|---|---:|---:|
| muito rapido | 2–4 | 80–160ms |
| rapido | 6–8 | 240–320ms |
| medio | 12–15 | 480–600ms |
| lento | 25–30 | 1000–1200ms |
| muito lento | 50+ | 2000ms+ |

---

## Execucao de scripts

Scripts sao arquivos `.js` em `C:\vp-light\scripts\`. O main process compila cada um numa camada via `compileLayer` (`main.js:792-813`):

```js
// main.js:797-810
const SetChannel = (ch, val) => {
  if (ch < 1 || ch > 512) return;
  const idx = ch - 1;
  buffer[idx] = Math.max(0, Math.min(255, Math.round(Number(val))));
  touched[idx] = 1;
};
const getChannel = (fixtureId, alias) => getFixtureChannel(fixtureId, alias);
const fn = new Function('SetChannel', 'getChannel', 'ctx', `
  ${code}
  ctx.OnStart = typeof OnStart === 'function' ? OnStart : null;
  ctx.OnExecute = typeof OnExecute === 'function' ? OnExecute : null;
  ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
`);
fn(SetChannel, getChannel, ctx);
if (typeof ctx.OnStart === 'function') { try { ctx.OnStart(); } catch (e) {} } // main.js:811
```

O mesmo padrao vale para F-key scripts, page scripts e cada passo de macro (todos viram camadas). Variaveis globais do arquivo persistem entre chamadas de `OnExecute` porque o codigo e avaliado **uma vez** na ativacao.

Nao e um sandbox rigido (roda no main process), mas os parametros injetados sao **somente** `SetChannel`, `getChannel` e `ctx`. Ver "Restricoes de scripts".

---

## APIs disponiveis

### `SetChannel(canal, valor)` — `main.js:797-802`

- `canal`: numero DMX 1–512 (fora disso e ignorado, `main.js:798`).
- `valor`: clamp para 0–255 com `Math.round` (`main.js:800`).
- Escreve **no buffer da camada** e marca `touched[idx]=1`. **Nao** escreve direto no universo.
- Prioridade de cena e filtro de fixture desabilitada **nao** ficam no `SetChannel`; sao aplicados pelo compositor na mistura.

### `getChannel(fixtureId, alias)` — `main.js:803` → `getFixtureChannel`, `main.js:783-787`

- Retorna o canal DMX 1-based do alias, ou **`null`**.
- Retorna `null` se: o fixture nao existir; estiver **desabilitado** (`enabled: false`); `channels` nao for array; ou o alias nao existir.

Regra pratica: resolva canais uma vez no `OnStart`, guarde em variaveis globais e valide `null` antes de `SetChannel`.

```js
let dimmer = null;
function OnStart() { dimmer = getChannel('fixture_1780805067518_mini_brut_01', 'dimmer'); }
function OnExecute() { if (dimmer !== null) SetChannel(dimmer, 255); }
```

---

## `getFixtureChannel()` — resolucao de canal por fixture + alias (`main.js:737-787`)

1. `getShowFixture` (`main.js:737-744`): pega `show.getShow()` e procura no `fixtures` por `id === alvo` **ou** `normalizeAlias(name) === normalizeAlias(alvo)`. Ou seja, aceita id **ou** nome.
2. `normalizeAlias` (`main.js:645-649`): `String → NFD (remove acento) → trim → lowercase`. Aplica-se tanto ao alvo quanto a cada label.
3. `isFixtureEnabled` (`main.js:651-653`): `fixture.enabled !== false`. `getFixtureChannel` retorna `null` se a fixture estiver desabilitada (`main.js:785`).
4. `getFixtureChannelByAlias` (`main.js:762-768`): procura o alias normalizado em `fixture.channels` e retorna `(startChannel || 1) + index`; `null` se nao achar.
5. **Fallback de alias** (`getFixtureAliasCandidates`, `main.js:770-780`): **apenas** quando `fixtureType === 'moving_head_beam'`. Expande: `dimmer`→[`dimmer`,`fecho_lampada`]; `speed`→[`speed`,`virtual_speed`]; `prism`→[`prism`,`prism_1`]; `gobo`→[`gobo`,`gobo_wheel`]; `strobo_dimmer`→[`strobo_dimmer`,`strobo`]. Para qualquer outro `fixtureType` o alias tem que bater exatamente (apos normalizacao).

---

## Modelo de camadas (composicao) — `compositor.js`

- Ao ativar um script, cria-se uma **camada**: `Uint8Array(512)` (buffer) + mascara `touched`, com `weight` e `phase` (`compositor.js:57-71`). F-keys e page-scripts soltos nascem com `weight=1`, `phase 'hold'` (`compositor.js:61-62`).
- A cada frame, `renderFrame` (`compositor.js:116-175`):
  1. avanca macros (`:118`);
  2. para cada camada: `_tickEnvelope` → `buffer.fill(0)` + `touched.fill(0)` → `OnExecute()` (`:125-138`). Se `OnExecute` lanca, a camada e **removida** e `OnTerminate` chamado (`:133-137`, via `_removeLayerInternal :91-98`);
  3. mistura canal a canal **so nos canais tocados** (`:145-169`): **HTP/max** por padrao (`:151`, `out = max(buffer*weight)`), ou soma linear se a macro pediu `'linear'` (`:151`);
  4. **guards** sobre o resultado: pula canal de fixture desabilitada (`:155`) e canal travado por cena ativa (`:156`);
  5. **roteamento** (`:160-168`): canal virtual → `interpolator.setSpeed` (`:160-163`); canal controlado → `interpolator.setTarget` (`:164-167`); senao `universe.setChannel` (`:168`);
  6. remove camadas que terminaram fade-out (`:172-174`).

Consequencias para quem escreve script:
- Dois scripts no **mesmo** canal sao misturados por **HTP (max)**, deterministico — nao e "o ultimo a escrever vence".
- Canal nao escrito por nenhuma camada num frame **mantem** o valor que ja estava (cena, fader, outra camada) — `:153`. Para apagar, escreva `SetChannel(canal, 0)` explicitamente.

---

## Interpolador (pan/tilt/speed virtuais) — `interpolator.js`

Fixtures com `virtualPanTiltSpeed: true` (os dois Moving Head Beam) tem `pan`, `tilt` e `virtual_speed` roteados pelo interpolador, **nao** direto ao universo:

- `engine.js:29` chama `interpolator.tick()` a cada 40ms, **antes** de `sendArtDMX` — pan/tilt avancam suavemente em direcao ao alvo.
- `compositor.js:160-167`: o valor composto de um canal virtual vira `setSpeed`; o de um canal controlado vira `setTarget`.
- `interpolator.js:19-21`: a `speed` (0 = rapido, 255 = lento) define a velocidade da varredura (`UNITS_AT_128 = 5` units/tick a speed=128).

Em script: escreva o **alvo** normalmente — `SetChannel(getChannel(id,'pan'), v)` — e ajuste `speed`/`virtual_speed`. Nao espere ver esses canais no universo cru.

---

## Offsets de canal (calibracao fisica de pan/tilt)

Alguns fixtures recebem um offset fisico em pan/tilt, **forcado por NOME** no carregamento do show — sobrescreve o que estiver no show.json:

- `normalizeRuntimeFixtureFields` (`main.js:528-551`): Moving Head Beam 1 → `panOffset = 44`; Moving Head Beam 2 → `panOffset` removido (0); Ribalta_1 → `tiltOffset = 23`; Ribalta_2 → `tiltOffset = 3`.
- `getFixturePanOffset` (`main.js:574-583`) e `getFixtureTiltOffset` (`main.js:585-590`) repetem esses valores por nome; o `tilt` dos beams segue o show.json (Beam 1 = 4, Beam 2 = 6).
- `buildChannelOffsetMap` (`main.js:553-572`) mapeia `{ canalPan/Tilt: offset }` e `initializeOffsets` (`main.js:603-607`) injeta em `universe.setChannelOffsets`.

Como o universo aplica:
- `universe.setChannel`: **fisico = logico + offset**, clamped 0–255 (`universe.js:8,43-44`).
- `getUniverseSnapshot` subtrai o offset — o renderer sempre ve o valor logico (`universe.js:107-121`).
- No blackout o offset e mantido como baseline fisico (pan logico 0 do Beam 1 ainda sai fisicamente 44) (`universe.js:48-56`).

Para quem escreve script: **escreva valores logicos** de `pan`/`tilt` (0 = base). O offset e calibracao fisica transparente, aplicado na camada do universo (apos a interpolacao, no caso dos beams). Nunca some o offset manualmente.

## Lifecycle reconhecido

Capturados em `main.js:806-808`; chamados pelo runtime:

```js
function OnStart() {}      // uma vez na ativacao (main.js:811)
function OnExecute() {}    // a cada tick de 40ms (compositor.js:129-132)
function OnTerminate() {}  // ao parar/erro (compositor.js:94-96)
```

- `OnStart`: so para resolver canais e inicializar estado/contadores. **Nao** pinte canais aqui — todo frame o buffer e zerado antes do `OnExecute` (`compositor.js:127`). O que aparece no palco deve ser escrito no `OnExecute`.
- `OnExecute`: chamado a cada 40ms se existir.
- `OnTerminate`: chamado ao remover a camada — por toggle/clear/blackout, fade-out de macro, ou erro em `OnExecute` (`compositor.js:94-96`). Deve zerar tudo que o script tocou (contrato).

---

## Prioridade de cenas ativas

O renderer informa os canais travados por cena via `dmx:setActiveSceneChannels` (`preload.js:46`). O compositor guarda esse mapa em `_sceneLock` (`compositor.js:41,47`) e, ao gravar o resultado, pula qualquer canal presente:

```js
if (ch in _sceneLock) continue; // compositor.js:156
```

A regra e **presenca da chave** no mapa, nao "valor > 0 vence": o script nao sobrescreve nenhum canal de cena ativa, inclusive os com valor 0.

---

## Fixtures desabilitadas

Canais de fixtures `enabled: false` sao ignorados na composicao (`disabled.has(ch)` → `continue`, `compositor.js:143,155`) e `getChannel` retorna `null` para elas. O provider de canais desabilitados (`getDisabledChannels`, `main.js:655-681`) so marca um canal como desabilitado se **nenhuma** fixture ativa o usa — ou seja, se uma fixture ativa compartilha o canal de uma desabilitada, o canal **continua** valido. Nao escreva scripts para fixtures desabilitadas.

---

## Restricoes de scripts

Parametros injetados sao apenas `SetChannel`, `getChannel`, `ctx` (`main.js:804`). Scripts gerados por esta skill **nao devem usar**:

- `setTimeout` / `setInterval` — o unico relogio e o tick de 40ms; timing deve ser por **contador** dentro de `OnExecute`.
- `fetch`, `require`, `import` — nao ha necessidade e quebra o contrato do compositor.
- `Date.now()` para timing — use contador de frames (deterministico, preso ao tick).

Todo efeito escreve no `OnExecute` (nao no `OnStart`) e zera no `OnTerminate` todos os canais que tocou.

---

## Blackout

O handler `dmx:blackout` (`main.js:243-247`, exposto por `preload.js:44`) chama `stopAllRunningScripts('blackout')` **antes** de `universe.blackout()`. `stopAllRunningScripts` (`main.js:485-494`) para F-key scripts, page scripts **e** macros (`compositor.stopAllMacros()`). Parar um script remove a camada do compositor e dispara `OnTerminate`.

---

## F-key scripts / Page scripts / Macros

Handlers expostos via `window.vp.*` (`preload.js:84-113`):

- **F-key** (`preload.js:85-90`): `script:list/create/edit/clear/toggle/getAll`. Identificador operacional e a F-key (`F1`…`F12`), nao o nome do arquivo.
- **Page script** (`preload.js:100-104`): `page_script:create/edit/clear/toggle/getAll`, associados a `pageId + sceneKey`. Uma tecla de cena guarda **ou** cena **ou** page script, nunca os dois. Mesmo runtime/APIs/lifecycle/camada.
- **Macro** (`preload.js:107-113`): `macro:create/start/stop/next/remove/list/status`. Cada passo vira uma camada com envelope de fade-in/out e overlap (crossfade), peso (weight) e mistura HTP por padrao ou linear (`compositor.js:187-208`). Escreva scripts normais: funcionam soltos (weight=1) e como passo de macro. Nao escreva logica de sequenciamento dentro do script.

---

## Protocolo Art-Net — `artnet.js`

- **Porta** `6454` (`artnet.js:28`). **Universo** `0` (`artnet.js:40`, header). **OpCode** ArtDMX `0x5000` LE (`:37`), ProtVer 14 (`:38`), Length 512 (`:41`).
- Pacote de 530 bytes (18 de header + 512 DMX), pre-alocado e reusado por frame (`:34`, sem GC a 25fps).
- Tres canais de envio (`sendArtDMX`, `:178-219`): (1) loopback `127.0.0.1` (`:29,183-199`); (2) broadcast por interface — um socket UDP por interface IPv4 ativa, vinculado ao IP local, enviando `255.255.255.255:6454` (`:207-212`); (3) fallback broadcast global se nenhuma interface foi detectada (`:216-218`).
- Interfaces re-enumeradas a cada 10s (`:31,162-165`). `closeSocket` fecha tudo ao parar o engine (`:238-255`).

Scripts nao tocam Art-Net diretamente — escrevem no universo via o compositor, e o `engine` envia.

---

## Arquitetura IPC — `preload.js`

O renderer (React) **nunca** acessa hardware diretamente; tudo passa por `window.vp.*` (contextBridge, `preload.js:10`), que faz `ipcRenderer.invoke(...)` para handlers no main. Categorias expostas: engine (`startEngine/stopEngine/getEngineStatus`, `:19-21`), DMX (`activateScene`, `setChannel`, `setChannelRange`, `blackout`, `setActiveSceneChannels`, `getUniverse`, etc., `:28-54`), show (`loadShow/saveShow/getShow/updateScene`, `:60-82`), scripts/page scripts/macros (`:85-113`) e fixtures (`:116`).

Para esta skill: o script gerado **nao** chama `window.vp.*` — ele so usa `SetChannel`/`getChannel` dentro de `OnStart`/`OnExecute`/`OnTerminate`. A camada IPC e como o operador ativa/desativa o script e as cenas, nao algo que o script controla.

---

## Padroes seguros de efeito

- **Strobe**: alterna dimmer/LED entre 0 e valor por contador.
- **Chase**: avanca um indice por N ciclos.
- **Fade**: incrementa/decrementa valor por tick dentro de 0–255.
- **Ping pong**: fade ou chase com `dir = 1`/`-1`, invertendo nos limites.
- **Simetria**: pares naturais recebem valores espelhados/sincronizados no mesmo frame.
- **Movimento**: pan/tilt incremental; respeite faixas e posicoes do catalogo. Nos Moving Head Beam (virtualPanTiltSpeed), `pan`/`tilt` sao alvos do interpolador e `speed`/`virtual_speed` define a velocidade — escreva o alvo via `SetChannel(getChannel(id,'pan'), v)`.
