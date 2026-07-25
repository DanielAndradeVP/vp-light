# Mapeamento detalhado — Moving Head Beam 1 e Moving Head Beam 2

> Levantamento com valores reais, extraído de `shows/vp.show.json` e
> `electron/fixtureProfiles/movingHeadBeam1.js` / `movingHeadBeam2.js`.
> Complementa `relatorio-definitivo-mapeamento-equipamentos.md` e
> `plano-correcoes-moving-menu-cena.md` (nesta mesma pasta) com o detalhe
> canal-a-canal que faltava nos dois.
>
> **Atualizado (1)** — `frost`/`prism_1_rotation_2` (MH1) e `frost`/`focus` (MH2)
> saíram de "sem capability no perfil" e entraram como capability declarada
> (`prismRotation2`, `frost`, `focus`), status `mapping-incomplete`. Só
> declaração de schema — nenhum dado real (`adapters.*`) foi escrito ainda,
> nenhuma função `adapter.set*` foi criada pra elas.
>
> **Atualizado (2)** — a cor do MH1 foi **remedida fisicamente** e reconciliada
> (13 pontos, passo de 10, substituindo o rascunho de junho/2026 em passo de
> 30). `adapters.color` no show e `status` em `movingHeadBeam1.js` já
> atualizados para `ready`. `adapter.setColor` no MH1 já funciona.
>
> **Atualizado (3)** — `strobe` do MH1 **e** do MH2 mapeado fisicamente (mesmos
> 4 valores nos dois: `lento:40, medio:60, rapido:80, extra_rapido:100`).
> Substitui uma anotação antiga no `note` do MH2 (175/190/205) que nunca tinha
> virado dado real do adapter. `adapters.strobe` no show e `status` nos dois
> arquivos de perfil já em `ready`.
>
> Testes de regressão (`npx vitest run`, 133 testes) passaram limpos depois de
> todas as mudanças — os testes sintéticos de `adapter-semantic.test.js` que
> usavam `color`/`strobe` do MH1/MH2 como exemplo de "capability incompleta"
> migraram pra `prism`/`gobo` conforme cada uma virava `ready` de verdade.
>
> **Atualizado (4)** — correção de identidade de canal: o canal DMX 131 do MH1,
> antes chamado `prism_1_rotation_2` (capability `prismRotation2`), na verdade é
> um canal `focus` — igual ao MH2. Não era uma segunda rotação de prisma, era
> nomenclatura errada herdada de um mapeamento anterior. Renomeado em
> `shows/vp.show.json` (array `channels` do MH1), em
> `electron/fixtureProfiles/movingHeadBeam1.js` (`channels.focus` /
> `capabilities.focus`) e em `tests/adapter-semantic.test.js`. Continua
> `status: 'mapping-incomplete'` — foi só correção de nome, nenhum dado real de
> `adapters.focus` foi medido ainda. MH1 e MH2 têm, portanto, a **mesma**
> estrutura de canais nesse ponto (um `prismRotation` + um `focus` cada), ao
> contrário do que este documento afirmava antes.
>
> **Atualizado (5)** — `prism` **e** `focus` mapeados fisicamente nos dois
> beams. `prism`: mesmo valor nos dois (`ligado: 150`), canal 127 no MH1 e 207
> no MH2 (o ponto "desligado" foi calibrado depois — ver "Atualizado (10)").
> `focus`: valores **diferentes** por modelo —
> MH1 `focado: 160` (canal 131), MH2 `focado: 100` (canal 211). `adapters.prism`
> e `adapters.focus` escritos no show; `status` de ambas as capabilities virou
> `ready` nos dois arquivos de perfil. Como não existia função
> `adapter.setFocus` até agora (só `setColor`/`setDimmer`/`setMovementSpeed`/
> `setPanTilt`/`setStrobe`/`setPrism`/`setGobo`), foi criada em
> `electron/adapter.js` espelhando exatamente `setStrobe`/`setPrism` (mesmo
> mecanismo de `mappedValueResult`, mesmos códigos de erro). Nomes lógicos
> (`ligado`, `focado`) foram escolhidos pra seguir a convenção em português já
> usada em `strobe` (`lento`/`medio`/`rapido`) — ajustar se preferir outro
> nome. `npx vitest run` → 137 testes, sem regressão (os dois testes
> sintéticos que usavam `prism` do MH1/MH2 como exemplo de "capability
> incompleta" migraram pra `gobo`, que continua incompleta de verdade).
>
> **Atualizado (6)** — `gobo` mapeado fisicamente, **igual nos dois beams** (5
> padrões): `circulo_bolinhas_finas:10, circulo_bolinhas_medias:20,
> circulo_bolinhas_grossas:30, varios_l:35, circulo_estrelas:45`.
> `adapters.gobo` escrito no show e `status` virou `ready` nos dois arquivos de
> perfil. Como `gobo` deixou de servir de exemplo de "capability incompleta",
> os dois testes sintéticos que dependiam disso migraram: o do MH1 virou uma
> checagem de `VALUE_NOT_SUPPORTED` (nome de gobo fora da tabela) e o do MH2
> virou um teste calibrado igual ao de `prism`/`focus`/`strobe`. Hoje **não
> sobra nenhuma capability incompleta com função `adapter.set*` própria** nos
> dois beams — `prismRotation` e `frost` continuam `mapping-incomplete`, mas
> não existe `setPrismRotation`/`setFrost` ainda (só entram quando alguém
> pedir pra medir esses dois). `npx vitest run` → 138 testes, sem regressão.
>
> **Atualizado (7)** — correção de identidade de canal (mesma natureza da
> "Atualizado (4)", mas no canal de índice 5): o alias `prism_1_rotation` do
> MH1 (canal 128) foi renomeado para `prism_rotation`, igual ao MH2 (canal
> 208). Pura unificação de nome — mesma função física (rotação do prisma),
> nenhum dado novo, `status` continua `mapping-incomplete`. Renomeado em
> `shows/vp.show.json`, `electron/fixtureProfiles/movingHeadBeam1.js`
> (`channels.prismRotation.alias`) e `tests/adapter-semantic.test.js`. Também
> atualizado em `.agents/skills/desenvolvedor-dmx/references/catalogo-fixtures.md`
> (ficha de identidade dos fixtures usada pela skill de scripts DMX).
> `npx vitest run` → 138 testes, sem regressão.
>
> **Atualizado (8)** — `frost` mapeado fisicamente, **mesmo valor nos dois
> beams**: `ligado: 255` (canal 130 no MH1, canal 210 no MH2). `adapters.frost`
> escrito no show; `status` virou `ready` nos dois arquivos de perfil. Assim
> como `focus`, não existia função `adapter.setFrost` até agora — criada
> espelhando `setStrobe`/`setPrism`/`setFocus` (mesmo mecanismo, mesmos
> códigos de erro). Como `frost` nunca tinha servido de exemplo de "capability
> incompleta" em nenhum teste, não houve teste sintético pra migrar. Restou só
> `prismRotation` como capability genuinamente pendente nos dois beams (sem
> `setPrismRotation` no adapter ainda). `npx vitest run` → 140 testes, sem
> regressão.
>
> **Atualizado (9)** — `prismRotation` mapeado fisicamente, com **sentido
> invertido entre os dois beams**: MH1 `rapido:170, medio:150, lento:135`
> (quanto maior o DMX, mais rápido); MH2 `rapido:150, medio:165, lento:180`
> (quanto menor o DMX, mais rápido). `adapters.prismRotation` escrito no show
> (canal 128 no MH1, 208 no MH2); `status` virou `ready` nos dois arquivos de
> perfil. `adapter.setPrismRotation` criada espelhando
> `setStrobe`/`setPrism`/`setFocus`/`setFrost`. Com isso, **todas as
> capabilities declaradas nos profiles do MH1 e MH2 estão `ready`** — nenhuma
> capability incompleta resta nos dois moving heads. `npx vitest run` → 142
> testes, sem regressão.
>
> **Atualizado (10)** — fechamento de uma armadilha real, não uma nova medição:
> `prism` e `frost` tinham só o ponto lógico `"ligado"` calibrado, sem nenhum
> valor de "desligado" — ou seja, um script que quisesse desligar o prisma ou
> o frost do MH1/MH2 não tinha como fazer isso via `adapter.set*` (só via
> `SetChannel` cru com DMX chutado, o que o adapter existe justamente pra
> evitar). Confirmado com o usuário que **DMX 0 = desligado** é fisicamente
> correto para os dois nos dois beams. `adapters.prism` e `adapters.frost`
> ganharam `"desligado": 0` no show (MH1 e MH2); nenhuma mudança de `status`
> (já eram `ready`) nem novo código no adapter — a tabela só ficou mais
> completa. `focus` continua com um único ponto lógico (`"focado"`) porque
> nenhum valor de "focus desligado" foi pedido/medido — não é a mesma
> armadilha, é uma capability que genuinamente só tem um estado calibrado.
> `npx vitest run` → 151 testes, sem regressão.

---

## Legenda dos status

| Status | O que significa | O que fazer |
|---|---|---|
| ✅ **ready** | Canal existe, o perfil sabe disso, e há dado real (`adapters.*`) para traduzir nome lógico → DMX (ou é um valor contínuo direto, tipo dimmer/pan/tilt/speed). `adapter.set*` funciona. | Nada — já pronto. |
| ❌ **mapping-incomplete** | O perfil **já reconhece** a capability (sabe o canal, sabe o tipo), mas `fixture.adapters` **não tem tabela** de valores pra ela ainda. `adapter.set*` sempre falha com `CAPABILITY_NOT_MAPPED`. | Medir os valores reais no equipamento físico, escrever em `adapters.<capability>` no show, depois virar `status: 'ready'` no arquivo de perfil. |
| ⚪ **sem capability no perfil** | O canal existe de verdade no fixture (`channels[]`), mas o arquivo de perfil **nem menciona** esse alias — nem em `channels`, nem em `capabilities`. Não existe função `adapter.set*` pra isso. | Decidir se vale a pena virar uma capability semântica; até lá, só dá pra usar via `getChannel`/`SetChannel` cru. |
| ⚪ **não usado pelo adapter** | O canal **está** declarado no perfil (`channels`), mas nenhuma função do `adapter.js` escreve nele (ex.: `setPanTilt` só toca `pan`/`tilt`, nunca `pan_fine`/`tilt_fine`). | Mesma saída de hoje: `getChannel`/`SetChannel` cru, se precisar. |

Nos três últimos casos, o canal sempre pode ser usado direto pela API crua do
sandbox de scripts, sem depender do adapter:
```js
const ch = getChannel(fixtureId, 'frost');
SetChannel(ch, 128);
```

---

## Moving Head Beam 1 (MH1)

**Fixture:** `startChannel: 123` · 16 canais · `fixtureType: moving_head_beam`
· perfil `moving-head-beam-1` · `panOffset: 40` · `tiltOffset: 4`

| DMX | Alias | Capability | Status |
|---|---|---|---|
| 123 | `color_wheel` | `color` | ✅ ready *(remedido fisicamente — ver §"Cor do MH1")* |
| 124 | `strobo` | `strobe` | ✅ ready |
| 125 | `fecho_lampada` | `dimmer` | ✅ ready |
| 126 | `gobo_wheel` | `gobo` | ✅ ready *(remedido fisicamente — ver §"Gobo")* |
| 127 | `prism_1` | `prism` | ✅ ready *(remedido fisicamente — ver §"Prism e Focus")* |
| 128 | `prism_rotation` | `prismRotation` | ✅ ready *(remedido fisicamente — ver §"Prism Rotation")* |
| 129 | `virtual_speed` | `movementSpeed` | ✅ ready |
| 130 | `frost` | `frost` | ✅ ready *(remedido fisicamente — ver §"Frost")* |
| 131 | `focus` | `focus` | ✅ ready *(remedido fisicamente — ver §"Prism e Focus")* |
| 132 | `pan` | `pan` | ✅ ready |
| 133 | `pan_fine` | — (opcional) | ⚪ não usado pelo adapter |
| 134 | `tilt` | `tilt` | ✅ ready |
| 135 | `tilt_fine` | — (opcional) | ⚪ não usado pelo adapter |
| 136 | `special_random` | — | ⚪ sem capability no perfil |
| 137 | `indefinido` | — | ⚪ sem capability no perfil |
| 138 | `reset` | — | ⚪ sem capability no perfil |

### Cor do MH1 — 13 pontos medidos fisicamente (passo de 10, substitui o rascunho de junho/2026)

| Cor lógica | DMX (canal 123) |
|---|---|
| `white` | 0 |
| `red` | 10 |
| `green` | 20 |
| `blue_medio` | 30 |
| `yellow` | 40 |
| `purple_light` | 50 |
| `blue_light` | 60 |
| `roxo_claro` | 70 |
| `laranja_escuro` | 80 |
| `blue_claro` | 90 |
| `laranja_claro` | 110 |
| `amber` | 120 |
| `magenta` | 130 |

⚠️ **Observação:** a sequência pula de `blue_claro` (90) direto pra
`laranja_claro` (110) — não há ponto medido em 100. Confirmar se é
intencional (sem cor distinta ali) ou se faltou anotar um valor.

A tabela antiga (8 valores, passo de 30, rascunho de 25/06/2026 — commit
`b212b46`, nunca reconciliada) foi **substituída** por esta, medida ponto a
ponto no equipamento físico. `adapters.color` no show e o `status` em
`electron/fixtureProfiles/movingHeadBeam1.js` já foram atualizados para
`ready` — `adapter.setColor(...)` já funciona no MH1.

---

## Moving Head Beam 2 (MH2)

**Fixture:** `startChannel: 203` · 16 canais · `fixtureType: moving_head_beam`
· perfil `moving-head-beam-2` · `tiltOffset: 6`

| DMX | Alias | Capability | Status |
|---|---|---|---|
| 203 | `color_wheel` | `color` | ✅ ready |
| 204 | `strobo` | `strobe` | ✅ ready |
| 205 | `fecho_lampada` | `dimmer` | ✅ ready |
| 206 | `gobo_wheel` | `gobo` | ✅ ready *(remedido fisicamente — ver §"Gobo")* |
| 207 | `prism_1` | `prism` | ✅ ready *(remedido fisicamente — ver §"Prism e Focus")* |
| 208 | `prism_rotation` | `prismRotation` | ✅ ready *(remedido fisicamente — ver §"Prism Rotation")* |
| 209 | `virtual_speed` | `movementSpeed` | ✅ ready |
| 210 | `frost` | `frost` | ✅ ready *(remedido fisicamente — ver §"Frost")* |
| 211 | `focus` | `focus` | ✅ ready *(remedido fisicamente — ver §"Prism e Focus")* |
| 212 | `pan` | `pan` | ✅ ready |
| 213 | `pan_fine` | — (opcional) | ⚪ não usado pelo adapter |
| 214 | `tilt` | `tilt` | ✅ ready |
| 215 | `tilt_fine` | — (opcional) | ⚪ não usado pelo adapter |
| 216 | `special_random` | — | ⚪ sem capability no perfil |
| 217 | `reset` | — | ⚪ sem capability no perfil |
| 218 | *(vazio)* | — | canal sem função definida |

### Cor do MH2 — 15 pontos medidos fisicamente (Checkpoint 4, 19/07/2026, passo de 10)

Em ordem de valor DMX (sequência real da roda):

| Cor lógica | DMX (canal 203) |
|---|---|
| `white` | 0 |
| `red` | 10 |
| `yellow` | 20 |
| `purple_medium` | 30 |
| `green` | 40 |
| `blue_dark` | 50 |
| `white_ice` | 60 |
| `amber_1` | 70 |
| `white_warm` | 80 |
| `orange` | 90 |
| `purple_dark` | 100 |
| `blue_light` | 110 |
| `amber_2` | 120 |
| `yellow_2` | 130 |
| `purple_light` | 140 |

Os dois "âmbar" da anotação original do equipamento foram tratados como
pontos distintos (`amber_1`/`amber_2`), não duplicação. Uso:
`adapter.setColor(fixtureId, "purple_dark")` → escreve `100` no canal 203.

---

## Strobo — 4 pontos medidos fisicamente (mesmos valores no MH1 e no MH2)

| Velocidade lógica | DMX |
|---|---|
| `lento` | 40 |
| `medio` | 60 |
| `rapido` | 80 |
| `extra_rapido` | 100 |

Canal 124 no MH1, canal 204 no MH2 — mesma tabela lógica nos dois. Substitui
uma anotação antiga no `note` do MH2 (175/190/205 lento/medio/rapido) que
nunca tinha virado dado real do adapter — os valores medidos agora são bem
menores. Uso: `adapter.setStrobe(fixtureId, "rapido")` → escreve `80`.

---

## Prism e Focus — medidos fisicamente

| Capability | MH1 (canal) | MH2 (canal) | Valor lógico | DMX |
|---|---|---|---|---|
| `prism` | 127 | 207 | `ligado` | 150 (igual nos dois) |
| `prism` | 127 | 207 | `desligado` | 0 (igual nos dois) |
| `focus` | 131 | 211 | `focado` | 160 no MH1 · 100 no MH2 |

`prism` tem dois pontos lógicos calibrados (`ligado`/`desligado`) — confirmado
com o usuário que DMX 0 = desligado é fisicamente correto nos dois beams; uso:
`adapter.setPrism(fixtureId, "ligado")` ou `adapter.setPrism(fixtureId,
"desligado")`. `focus` tem só um ponto (`focado`) porque nenhum valor de
"focus desligado" foi medido — o valor DMX de `focado` é diferente por
modelo; uso: `adapter.setFocus(fixtureId, "focado")`.

`adapter.setFocus` **não existia** antes desta medição — foi criada em
`electron/adapter.js` espelhando `setStrobe`/`setPrism` (mesmo mecanismo,
mesmos códigos de erro), já que nenhuma função consumia a capability `focus`
até então. Os nomes lógicos `ligado`/`focado` seguem a convenção em português
já usada em `strobe`; renomear é só editar as chaves em
`shows/vp.show.json` (`adapters.prism`/`adapters.focus`) — nenhum script
ainda depende deles.

---

## Gobo — 5 padrões medidos fisicamente (iguais no MH1 e no MH2)

| Padrão | DMX |
|---|---|
| `circulo_bolinhas_finas` | 10 |
| `circulo_bolinhas_medias` | 20 |
| `circulo_bolinhas_grossas` | 30 |
| `varios_l` | 35 |
| `circulo_estrelas` | 45 |

Canal 126 no MH1, canal 206 no MH2 — mesma roda de gobo física nos dois
aparelhos, mesma tabela lógica. Uso: `adapter.setGobo(fixtureId,
"circulo_estrelas")` → escreve `45`.

---

## Frost — medido fisicamente (mesmo valor no MH1 e no MH2)

| Capability | MH1 (canal) | MH2 (canal) | Valor lógico | DMX |
|---|---|---|---|---|
| `frost` | 130 | 210 | `ligado` | 255 (igual nos dois) |
| `frost` | 130 | 210 | `desligado` | 0 (igual nos dois) |

Dois pontos lógicos calibrados (`ligado`/`desligado`) — confirmado com o
usuário que DMX 0 = desligado é fisicamente correto nos dois beams. Uso:
`adapter.setFrost(fixtureId, "ligado")` → escreve `255`;
`adapter.setFrost(fixtureId, "desligado")` → escreve `0`. `adapter.setFrost`
não existia antes desta medição — foi criada
espelhando `setStrobe`/`setPrism`/`setFocus` (mesmo mecanismo, mesmos códigos
de erro).

---

## Prism Rotation — medido fisicamente (sentido invertido entre os dois beams)

| Velocidade lógica | DMX MH1 (canal 128) | DMX MH2 (canal 208) |
|---|---|---|
| `rapido` | 170 | 150 |
| `medio` | 150 | 165 |
| `lento` | 135 | 180 |

⚠️ **Atenção ao sentido:** no MH1, DMX **maior** = rotação **mais rápida**; no
MH2 é o **oposto**, DMX **menor** = mais rápido. Não é erro de digitação — foi
medido assim fisicamente nos dois aparelhos. O adapter abstrai essa diferença:
`adapter.setPrismRotation(fixtureId, "rapido")` sempre gira rápido,
independente do sentido físico de cada modelo. `adapter.setPrismRotation` não
existia antes desta medição — foi criada espelhando
`setStrobe`/`setPrism`/`setFocus`/`setFrost`.

Com isso, **todas as capabilities declaradas nos profiles do MH1 e do MH2
estão `ready`** — não resta nenhuma capability incompleta nos dois moving
heads.

---

## Diferença física entre os dois modelos (não é assimetria de mapeamento)

MH1 é "Moving Head Beam 200W" e MH2 é "MovingHead_Beam 230W_16channels" —
modelos diferentes de verdade, mas na estrutura de canais de prisma/focus
**não há mais diferença** (correção aplicada — ver "Atualizado (4)" no topo
deste documento): o canal 131 do MH1, antes rotulado `prism_1_rotation_2`, era
na verdade um canal `focus` mal nomeado.

- **MH1** tem **um** canal de rotação de prisma (`prism_rotation`, canal 128)
  e **um** canal `focus`, igual ao MH2.
- **MH2** tem **um** canal de rotação de prisma (`prism_rotation`, canal 208)
  e **um** canal `focus`.
- O alias do canal de rotação de prisma também foi unificado: o MH1 usava
  `prism_1_rotation`, renomeado para `prism_rotation` pra casar com o MH2 —
  mesma função física, mesmo nome lógico agora nos dois.
- **MH1** tem `panOffset: 40` além do `tiltOffset: 4`; **MH2** só tem
  `tiltOffset: 6`, sem `panOffset` definido — essa é a diferença física real
  que resta entre os dois.

---

## Status final — todas as capabilities mapeadas

| Capability | MH1 | MH2 |
|---|---|---|
| `color` | ✅ pronto (remedido fisicamente) | ✅ pronto |
| `dimmer` / `movementSpeed` / `pan` / `tilt` | ✅ pronto | ✅ pronto |
| `strobe` | ✅ pronto (remedido fisicamente) | ✅ pronto (remedido fisicamente) |
| `prism` | ✅ pronto (remedido fisicamente) | ✅ pronto (remedido fisicamente) |
| `focus` | ✅ pronto (remedido fisicamente) | ✅ pronto (remedido fisicamente) |
| `gobo` | ✅ pronto (remedido fisicamente) | ✅ pronto (remedido fisicamente) |
| `frost` | ✅ pronto (remedido fisicamente) | ✅ pronto (remedido fisicamente) |
| `prismRotation` | ✅ pronto (remedido fisicamente) | ✅ pronto (remedido fisicamente) |

Não resta nenhuma capability `mapping-incomplete` no MH1 nem no MH2 — o
mapeamento físico dos dois moving heads está completo.

Só resta `prismRotation` pendente nos dois beams — falta medir os valores
físicos e criar `setPrismRotation` em `electron/adapter.js` (mesmo padrão de
`setFocus`/`setFrost`).

Só restam `prismRotation` e `frost` pendentes nos dois beams — mesmo trabalho
de campo (medir no equipamento físico, preencher `adapters.*` no show, e
desta vez também criar `setPrismRotation`/`setFrost` em `electron/adapter.js`,
já que nenhuma das duas tem função própria ainda). Nenhuma é mais específica
de um modelo só.
