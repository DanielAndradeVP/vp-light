# Guia do Adapter Semântico — para autores de scripts VP-LIGHT

> Para quem vai escrever os 50 novos scripts (ou qualquer script novo). Referência rápida, não repete a arquitetura interna — isso está em `docs/planos/adapter-semantico/19-07-2026-plano-pratico-implementacao-adapter-semantico.md`.

## O que mudou

Antes, um script precisava saber o canal DMX exato e o valor físico certo para cada equipamento:
```js
SetChannel(203, 40); // "verde" no Moving Head Beam 2 — só funciona NESSE moving, nesse canal
```
Agora, para as capabilities já mapeadas, o script só declara a intenção:
```js
adapter.setColor('Moving Head Beam 2', 'green'); // funciona em qualquer fixture com cor mapeada
adapter.setColor('Moving Head Beam 1', 'green');  // mesma chamada, resolve pro equipamento certo (quando mapeado)
adapter.setColor('ParLed_Deluxe_1', 'green');      // mesma chamada, agora em RGBW
```
`SetChannel`, `getChannel` e `adapter.resolve` continuam existindo e funcionando exatamente como antes — nenhum script antigo precisa mudar. Use a API semântica nos scripts novos sempre que a capability já estiver pronta; caia para `getChannel`/`SetChannel` só quando precisar de algo que a API semântica ainda não cobre.

## Identificação de fixture

Todas as funções aceitam `fixtureId` **ou** o nome exato da fixture no show (ex.: `'Moving Head Beam 2'`, `'ParLed_Deluxe_1'`, `'Ribalta_1'`) — mesma regra já usada por `getChannel`.

## Resultado de cada chamada

Toda função semântica retorna um objeto, nunca lança exceção:

**Sucesso:**
```js
{ ok: true, fixtureId, capability, channel, value }              // capability de canal único
{ ok: true, fixtureId, capability, channels: {...}, values: {...} } // capability RGB/RGBW ou panTilt
```

**Falha** (sempre confira `result.ok` antes de assumir sucesso):
```js
{ ok: false, code, fixtureId, capability, requestedValue, message }
```

### Códigos de erro

| Código | Significado |
|---|---|
| `FIXTURE_NOT_FOUND` | Não existe fixture com esse id/nome no show. |
| `FIXTURE_DISABLED` | A fixture existe mas está desabilitada no show. |
| `PROFILE_NOT_FOUND` | Esse tipo/modelo de fixture não tem profile semântico registrado ainda — capability não modelada. |
| `CAPABILITY_NOT_SUPPORTED` | Essa fixture (ou esse tipo) não tem essa capability — nunca vai ter, por natureza do equipamento (ex.: `setPrism` num PAR LED). |
| `CAPABILITY_NOT_MAPPED` | A capability existe no equipamento, mas ainda não foi medida/calibrada (ex.: `setPrism` num moving head antes da medição física). Pode virar `ready` no futuro sem o script mudar. |
| `VALUE_NOT_SUPPORTED` | O valor pedido (nome de cor, intent de strobe/gobo) não existe na tabela dessa fixture. **Nunca é escolhido um valor aproximado** — se não existe, falha. |
| `CHANNEL_NOT_FOUND` | Inconsistência interna entre o profile e os dados reais da fixture — reporte se aparecer, não é esperado em uso normal. |
| `INVALID_VALUE` | O argumento passado está malformado (não é número, não é string, objeto incompleto). |

**Um script robusto sempre trata a falha** — mesmo que hoje a capability esteja pronta, ela pode ficar temporariamente indisponível (fixture desabilitada pelo operador, por exemplo). Padrão recomendado:
```js
const result = adapter.setColor('Moving Head Beam 1', 'green');
if (!result.ok) {
  // Não pare o script inteiro por uma falha de uma capability — decida o que
  // fazer (ignorar, tentar outra coisa, ou simplesmente não fazer nada neste frame).
}
```

## Cor — `adapter.setColor(fixtureId, colorName)`

- **Moving head (color wheel)**: `colorName` precisa ser um dos nomes **exatos** já calibrados para aquela unidade. Hoje:
  - **Moving Head Beam 2** (pronto): `white, red, yellow, purple_medium, green, blue_dark, white_ice, amber_1, white_warm, orange, purple_dark, blue_light, amber_2, yellow_2, purple_light`.
  - **Moving Head Beam 1**: ainda `CAPABILITY_NOT_MAPPED` (aguardando medição física do operador). Use `getCapabilities` para checar antes de contar com isso.
- **PAR LED (RGB/RGBW)**: `colorName` é um nome padrão de cor (`red, green, blue, white, yellow, cyan, magenta, purple`) — funciona em **qualquer** PAR LED, layout A (RGBW) ou B (RGB), sem o script precisar saber qual layout é. `setColor` sempre zera os canais de cor antes de aplicar a nova (nunca mistura com a cor anterior).
- Cor inexistente na tabela → `VALUE_NOT_SUPPORTED`, nunca uma aproximação.

## Dimmer — `adapter.setDimmer(fixtureId, intensity)`

`intensity` é 0–1 (0 = apagado, 1 = máximo). Funciona em **qualquer** fixture com canal de dimmer — moving heads (via `fecho_lampada`), PAR LED, ribalta, mini brut, fita de LED — não precisa de profile registrado.

## Velocidade de movimento — `adapter.setMovementSpeed(fixtureId, speed)`

`speed` é 0–1, **`0 = rápido, 1 = lento`** (mesma convenção do fader de velocidade já usado no projeto — não inverta ao escrever seu script). Funciona em moving heads (via `virtual_speed`, controla o interpolador) e ribaltas (canal físico direto).

## Pan/Tilt — `adapter.setPanTilt(fixtureId, { pan, tilt })`

**Valores DMX crus (0–255), não normalizados.** Isso é intencional nesta fase: os dois moving heads giram ângulos físicos diferentes (M1 ~450°, M2 ~540°) e o Moving 1 ainda não tem mapeamento físico completo — uma normalização 0–1 "bonita" hoje seria inventada, não medida. Use as posições já validadas em `banco-de-conhecimento/moving.md` (ex.: frente = pan 84/tilt 36 no M1, pan 84/tilt 32 no M2) até uma API normalizada existir (planejada para depois do evento, quando o mapeamento físico dos dois estiver completo).

```js
adapter.setPanTilt('Moving Head Beam 2', { pan: 84, tilt: 32 }); // "frente", medido no rig
```

## O que ainda NÃO está pronto (retornam `CAPABILITY_NOT_MAPPED` hoje)

- `adapter.setStrobe(fixtureId, intent)` — nenhum moving head tem faixa de strobo confirmada ainda.
- `adapter.setPrism(fixtureId, intent)` — nenhum moving head tem valores de prisma confirmados.
- `adapter.setGobo(fixtureId, gobo)` — nenhum moving head tem valores de gobo confirmados.

Essas três funções **já existem e já resolvem sozinhas** assim que os dados chegarem (o time de implementação só precisa atualizar o profile do equipamento, não reescrever nada) — mas até lá, chame-as se quiser (o retorno vem estruturado), só não conte com elas funcionando em scripts do evento atual.

## Verificando o que uma fixture suporta — `adapter.getCapabilities(fixtureId)`

```js
const caps = adapter.getCapabilities('Moving Head Beam 1');
// { ok:true, fixtureId, profileId:'moving-head-beam-1', capabilities: { color: {type:'enumerated', status:'mapping-incomplete'}, dimmer: {..., status:'ready'}, ... } }
```
Use isso em `OnStart` (não em todo frame — é só introspecção, não precisa checar 25×/segundo) para decidir se o script vai usar `adapter.setColor` ou cair para um comportamento alternativo, dependendo se `capabilities.color.status === 'ready'`.

## Fixtures sem profile ainda (Ribalta, Mini Brut, Fita LED, Moving_Wosh)

`setColor`/`setPrism`/`setGobo`/`setStrobe` retornam `PROFILE_NOT_FOUND` nessas fixtures (elas não têm um modelo semântico registrado ainda — não é bug, só não foi feito nesta etapa). `setDimmer`/`setMovementSpeed` funcionam normalmente nelas (não dependem de profile). O `Moving_Wosh` especificamente não tem alias de dimmer/speed simples (é um modelo diferente, CMY, com mais canais) — `setDimmer`/`setMovementSpeed` nele retornam `CAPABILITY_NOT_SUPPORTED` por enquanto; use `getChannel`/`SetChannel` direto se precisar controlá-lo hoje.

## Resumo de exemplo — mesma intenção, equipamentos diferentes

```js
function OnExecute() {
  // Mesma cor pedida para 3 tipos de fixture diferentes:
  adapter.setColor('Moving Head Beam 2', 'green'); // color wheel, valor 40
  adapter.setColor('ParLed_Deluxe_1', 'green');     // RGBW: red=0,green=255,blue=0,white=0
  adapter.setColor('ParLed_Deluxe_2', 'green');     // RGB:  red=0,green=255,blue=0

  adapter.setDimmer('Moving Head Beam 2', 1);
  adapter.setDimmer('ParLed_Deluxe_1', 1);
  adapter.setDimmer('Ribalta_1', 1);

  adapter.setMovementSpeed('Moving Head Beam 2', 0.3); // rápido-médio
}
```

Nenhuma dessas chamadas precisa conhecer canal absoluto, valor DMX, ou diferença de layout entre os equipamentos.
