# Runtime do script vp-light - API e padroes

Estado confirmado contra `electron/main.js` e `electron/engine/engine.js`. Documente e use somente o que existe no runtime atual.

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

Para page scripts, o mesmo padrao e usado com `page_script:toggle`.

Isso nao e um sandbox rigido. O codigo roda no main process e recebe parametros injetados. Mesmo que globais do ambiente possam existir, scripts gerados por esta skill nao devem usar `setTimeout`, `setInterval`, `fetch`, `require` ou `import`. O timing correto e sempre por contador dentro de `OnExecute`.

## APIs injetadas

```js
SetChannel(canal, valor)
getChannel(fixtureId, alias)
```

### `SetChannel(canal, valor)`

- `canal`: numero DMX publico, 1-512.
- `valor`: 0-255.
- O valor final e escrito no universo DMX por `universe.setChannel`.
- Se o canal estiver presente em `activeSceneChannels`, o runtime ignora a escrita do script.

### `getChannel(fixtureId, alias)`

- Procura o fixture pelo `id` no show carregado em memoria.
- Normaliza o alias para comparacao: string, sem acento, `trim()`, lowercase.
- Procura o alias em `fixture.channels`.
- Retorna `fixture.startChannel + index`.
- Retorna `null` se o fixture nao existir, se `channels` nao for array ou se o alias nao existir.

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

- `OnStart`: chamado uma vez ao ativar, se existir.
- `OnExecute`: chamado a cada tick de 40ms, se existir.
- `OnTerminate`: chamado ao parar por toggle/clear/blackout ou quando `OnExecute` gera erro, se existir.

Nenhum outro hook e reconhecido pelo runtime atual. Nao ha validacao estrutural obrigatoria: se o arquivo compila mas nao define hooks, o script pode ativar e ficar sem efeito. Por isso, sempre gere os tres hooks.

Variaveis globais do arquivo persistem entre chamadas de `OnExecute` porque o codigo e avaliado uma vez na ativacao e as funcoes capturadas permanecem no contexto.

## Timing real

- Engine DMX: `electron/engine/engine.js` usa `FPS = 25` e `INTERVAL_MS = Math.round(1000 / FPS)`, resultando em 40ms.
- Envio Art-Net: `setInterval(() => sendArtDMX(getUniverse()), INTERVAL_MS)`.
- Script F-key: cada script ativo usa seu proprio `setInterval(..., 40)`.
- Page script: cada page script ativo tambem usa seu proprio `setInterval(..., 40)`.

Tabela de referencia:

| velocidade | ciclos | tempo aproximado |
|---|---:|---:|
| muito rapido | 2-4 | 80-160ms |
| rapido | 6-8 | 240-320ms |
| medio | 12-15 | 480-600ms |
| lento | 25-30 | 1000-1200ms |
| muito lento | 50+ | 2000ms+ |

## Prioridade de cenas ativas

O renderer informa ao main os canais bloqueados por cenas ativas via `dmx:setActiveSceneChannels`. O `SetChannel` interno dos scripts faz:

```js
if (ch in activeSceneChannels) return;
universe.setChannel(ch, val);
```

Consequencia: o script nao sobrescreve nenhum canal presente em cena ativa, independentemente do valor guardado no mapa, inclusive 0. Nao use a regra antiga "cena ativa com valor > 0 vence"; a regra atual e presenca da chave no mapa.

## Blackout

`dmx:blackout` chama `stopAllRunningScripts('blackout')` antes de `universe.blackout()`. Isso para scripts F-key e page scripts antes de zerar o universo.

Ao parar um script, o runtime limpa o intervalo, chama `OnTerminate` se existir e remove o script de `runningScripts` ou `runningPageScripts`.

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

Tambem existem scripts associados a `pageId + sceneKey`:

- `page_script:create(pageId, sceneKey, name)`
- `page_script:edit(pageId, sceneKey)`
- `page_script:clear(pageId, sceneKey)`
- `page_script:toggle(pageId, sceneKey)`
- `page_script:getAll(pageId)`

Eles usam o mesmo runtime, as mesmas APIs injetadas, o mesmo lifecycle e o mesmo tick de 40ms.

## Padroes seguros de efeito

- **Strobe**: alterna dimmer/LED entre 0 e valor por contador.
- **Chase**: avanca um indice por N ciclos.
- **Fade**: incrementa/decrementa valor por tick dentro de 0-255.
- **Ping pong**: fade ou chase com `dir = 1` / `-1`, invertendo nos limites.
- **Simetria**: pares naturais recebem valores espelhados ou sincronizados no mesmo frame.
- **Movimento**: pan/tilt incremental; respeite as faixas operacionais documentadas no catalogo.

Todo efeito deve zerar no `OnTerminate` todos os canais que tocou.
