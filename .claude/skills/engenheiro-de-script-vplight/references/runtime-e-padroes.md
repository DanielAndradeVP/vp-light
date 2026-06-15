# Runtime do script vp-light - API e padroes

Estado confirmado contra `electron/engine/engine.js`, `electron/engine/compositor.js`, `electron/engine/universe.js` e `electron/main.js`. Documente e use somente o que existe no runtime atual.

> **Mudanca importante de motor:** o vp-light agora usa um **compositor por camadas**. Cada script ativo e uma **camada com buffer proprio** `Uint8Array(512)`. `SetChannel` escreve **no buffer da camada**, nao no universo global. Nao existe mais `setInterval` por script: o unico relogio e o loop de 40ms do `engine.js`, que chama `compositor.renderFrame()`.

## Como o script e executado

Scripts sao arquivos `.js` em `C:\vp-light\scripts\`. O main process le o arquivo e compila com:

```js
new Function('SetChannel', 'getChannel', 'ctx', `
  ${code}
  ctx.OnStart = typeof OnStart === 'function' ? OnStart : null;
  ctx.OnExecute = typeof OnExecute === 'function' ? OnExecute : null;
  ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
`);
```

O mesmo padrao vale para F-key scripts, page scripts e para cada passo de uma macro (todos viram camadas).

Isso nao e um sandbox rigido. O codigo roda no main process e recebe parametros injetados. Mesmo assim, scripts gerados por esta skill **nao devem usar** `setTimeout`, `setInterval`, `fetch`, `require` ou `import`. O timing correto e sempre por contador dentro de `OnExecute`.

## Modelo de camadas (composicao)

- Ao ativar um script, o runtime cria uma **camada**: um `Uint8Array(512)` (buffer) pre-alocado + uma mascara `touched` de canais escritos.
- A cada frame (40ms), o `compositor.renderFrame()`:
  1. para cada camada: `buffer.fill(0)` + `touched.fill(0)` e roda o `OnExecute()` daquela camada;
  2. **mistura** as camadas, canal a canal, **apenas nos canais que alguma camada tocou** — regra **HTP (vence o valor mais forte / max)**;
  3. aplica os **guards** (canais bloqueados por cena ativa e canais de fixtures desabilitadas) **sobre o resultado da mistura**;
  4. grava o resultado no universo (`universe.setChannel`) e o `engine` envia por Art-Net.
- **Canais que nenhuma camada tocou ficam intactos** no universo (cenas e faders manuais sao preservados). Um script so afeta canais que ele realmente escreveu via `SetChannel`.

Consequencia pratica para quem escreve script:
- Dois scripts que escrevem o **mesmo** canal sao misturados por **HTP (max)**, de forma deterministica — nao e "o ultimo a escrever vence".
- Se um script nao escrever um canal num frame, aquele canal nao e zerado pela camada; ele mantem o que ja estava (de cena, fader ou outra camada). Para apagar um canal, escreva `SetChannel(canal, 0)` explicitamente.

## APIs injetadas

```js
SetChannel(canal, valor)
getChannel(fixtureId, alias)
```

### `SetChannel(canal, valor)`

- `canal`: numero DMX publico, 1-512.
- `valor`: 0-255 (o runtime faz clamp).
- Escreve **no buffer da camada do script** e marca o canal como tocado. **Nao** escreve direto no universo.
- A prioridade de cena e o filtro de fixture desabilitada **nao** ficam mais dentro do `SetChannel`; sao aplicados pelo compositor na mistura. O efeito visivel e o mesmo: canal travado por cena ativa nao e sobrescrito pelo script.

### `getChannel(fixtureId, alias)`

- Procura o fixture pelo `id` no show carregado em memoria.
- Normaliza o alias para comparacao: string, sem acento (NFD), `trim()`, lowercase.
- Procura o alias em `fixture.channels` e retorna `fixture.startChannel + index`.
- Retorna `null` se: o fixture nao existir, **o fixture estiver desabilitado (`enabled: false`)**, `channels` nao for array, ou o alias nao existir.

Regra pratica: resolva canais uma vez no `OnStart`, guarde em variaveis globais e valide `null` antes de chamar `SetChannel`.

```js
let dimmer = null;

function OnStart() {
  dimmer = getChannel('fixture_1780805067518_mini_brut_01', 'dimmer');
}

function OnExecute() {
  if (dimmer !== null) SetChannel(dimmer, 255);
}
```

## Lifecycle reconhecido

Somente estes tres hooks sao capturados:

```js
function OnStart() {}
function OnExecute() {}
function OnTerminate() {}
```

- `OnStart`: chamado uma vez ao ativar, se existir. **Nao** use o `OnStart` para "pintar" canais que precisam persistir — todo frame o buffer e zerado antes do `OnExecute`. O que tiver que aparecer no palco deve ser escrito no `OnExecute`. Use o `OnStart` so para resolver canais e inicializar estado/contadores.
- `OnExecute`: chamado a cada tick de 40ms pelo compositor, se existir.
- `OnTerminate`: chamado ao parar por toggle/clear/blackout ou quando `OnExecute` gera erro, se existir. Deve zerar tudo que o script tocou (contrato; o universo tambem e reconstruido ao parar).

Variaveis globais do arquivo persistem entre chamadas de `OnExecute` porque o codigo e avaliado uma vez na ativacao.

## Timing real

- Engine DMX: `electron/engine/engine.js` usa `FPS = 25` → `INTERVAL_MS = 40ms`.
- Loop unico: `setInterval(() => { compositor.renderFrame(); sendArtDMX(getUniverse()); }, 40)`.
- **Nao existe** `setInterval` por script nem por page script. Todo `OnExecute` roda dentro do `renderFrame` do compositor, no mesmo tick de 40ms.

Tabela de referencia (ciclos de `OnExecute`):

| velocidade | ciclos | tempo aproximado |
|---|---:|---:|
| muito rapido | 2-4 | 80-160ms |
| rapido | 6-8 | 240-320ms |
| medio | 12-15 | 480-600ms |
| lento | 25-30 | 1000-1200ms |
| muito lento | 50+ | 2000ms+ |

## Prioridade de cenas ativas

O renderer informa ao main os canais bloqueados por cenas ativas via `dmx:setActiveSceneChannels`. O compositor, ao gravar o resultado da mistura, pula qualquer canal presente nesse mapa:

```js
if (ch in sceneLock) continue; // canal travado por cena ativa nao recebe a mistura dos scripts
```

Consequencia: o script nao sobrescreve nenhum canal presente em cena ativa, independentemente do valor no mapa, inclusive 0. A regra atual e **presenca da chave no mapa** (nao "valor > 0 vence").

## Fixtures desabilitadas

Canais de fixtures com `enabled: false` sao ignorados na composicao (o compositor nao grava esses canais) e `getChannel` retorna `null` para elas. Nao escreva scripts para fixtures desabilitadas.

## Blackout

`dmx:blackout` chama `stopAllRunningScripts('blackout')` antes de `universe.blackout()`. Isso para **F-key scripts, page scripts e macros** antes de zerar o universo. Parar um script remove a camada dele do compositor e chama `OnTerminate`.

## F-key scripts

Handlers atuais:

- `script:create(fkey, name, options)`
- `script:edit(fkey, filePath)`
- `script:clear(fkey)`
- `script:toggle(fkey)`
- `script:list()`
- `script:getAll()`

O identificador operacional e a F-key (`F1`...`F12`), nao o nome do arquivo.

## Page scripts

Scripts associados a `pageId + sceneKey` (teclas de cena A/S/D...):

- `page_script:create(pageId, sceneKey, name)`
- `page_script:edit(pageId, sceneKey)`
- `page_script:clear(pageId, sceneKey)`
- `page_script:toggle(pageId, sceneKey)`
- `page_script:getAll(pageId)`

Usam o mesmo runtime, as mesmas APIs injetadas, o mesmo lifecycle e o mesmo modelo de camada. Uma tecla de cena guarda **ou** cena **ou** page script — nunca os dois.

## Macros (contexto)

Uma macro e uma sequencia de scripts existentes, com envelope de fade-in/fade-out e overlap (crossfade). Cada passo vira uma camada com peso (weight) que sobe/desce conforme o envelope; a mistura segue HTP por padrao (ou linear). Para esta skill: escreva scripts normais — eles funcionam tanto soltos (F-key/page, weight=1) quanto como passo de macro. Nao escreva logica de sequenciamento dentro do script; isso e responsabilidade da macro. IPC: `createMacro`, `startMacro`, `stopMacro`, `nextMacroStep`, `removeMacro`, `macroList`, `macroStatus`.

## Padroes seguros de efeito

- **Strobe**: alterna dimmer/LED entre 0 e valor por contador.
- **Chase**: avanca um indice por N ciclos.
- **Fade**: incrementa/decrementa valor por tick dentro de 0-255.
- **Ping pong**: fade ou chase com `dir = 1` / `-1`, invertendo nos limites.
- **Simetria**: pares naturais recebem valores espelhados ou sincronizados no mesmo frame.
- **Movimento**: pan/tilt incremental; respeite as faixas e posicoes documentadas no catalogo (orientacao fisica real das ribaltas e movings).

Todo efeito escreve no `OnExecute` (nao no `OnStart`) e zera no `OnTerminate` todos os canais que tocou.
