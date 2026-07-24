# Relatório definitivo — mapeamento de equipamentos, adapter semântico e bug do menu de scripts

> Auditoria de reconciliação. Enquanto os relatórios `plano-adapter-universal.md` e
> `melhoria-fire-base-adapter.md` (nesta mesma pasta) estavam sendo escritos, **outra
> sessão/branch reescreveu `electron/adapter.js` por completo** e mesclou isso na
> `main` (commits `Checkpoint 0` a `Checkpoint 10`, merge `feature/semantic-fixture-adapter`).
> Este relatório lê o código **como ele existe agora**, não como os planos antigos
> previam, e responde: o que já foi feito, o que falta, o que está quebrado, e o
> bug do botão direito nas páginas de script 2+.

---

## 1. O que mudou desde os planos antigos (resumo executivo)

| Do plano antigo | Situação real hoje |
|---|---|
| "Adaptar `electron/adapter.js` com bugs 1-4 + tipos transform/preset" | **Substituído.** Ninguém aplicou aquele patch — em vez disso, surgiu um sistema novo e mais ambicioso: `electron/fixtureProfiles/` (perfis por modelo de fixture) + `adapter.js` com API semântica (`setColor`, `setDimmer`, `setMovementSpeed`, `setPanTilt`, `setStrobe`, `setPrism`, `setGobo`, `getCapabilities`). A função antiga `resolve()` **continua existindo, inalterada**, com os mesmos bugs. |
| "Integrar `fire-base.js` ao adapter (fb_write, fb_wheel, fb_preset)" | **Não feito.** `fire-base.js` (428 linhas) só usa `adapter.resolve()` legado, em um único ponto (`fb_mhColor`). Não conhece a API semântica nova (`setColor` etc.) nem os `fixtureProfiles`. |
| "Patch de injeção `fire-` no `main.js`" | **Já feito** (`scriptPrependsFireBase`, `main.js:1094-1098`, e uso em `readScriptCode`, `main.js:1106-1109`). Essa parte do plano antigo foi implementada corretamente. |
| "Sandbox expõe `adapter.value`/`adapter.preset`" | **Não existe.** Em vez disso o sandbox (`main.js:1060-1080`) expõe `adapter.resolve` (legado) **e** `adapter.setColor/setDimmer/setMovementSpeed/setPanTilt/setStrobe/setPrism/setGobo/getCapabilities` (API semântica nova, via `fixtureProfiles`). |

**Conclusão prática:** os dois relatórios antigos (`plano-adapter-universal.md`,
`melhoria-fire-base-adapter.md`) descrevem uma evolução do adapter *legado* que
**não é mais o caminho a seguir** — o projeto já foi para uma arquitetura de perfis
semânticos, mais robusta. Trate aqueles dois relatórios como **históricos/obsoletos
na parte de proposta de schema** (a parte de bugs 1-2 do `resolve()` legado
continua 100% válida, porque essa função não mudou).

---

## 2. Como o adapter semântico funciona hoje (para quem for mapear o resto)

Arquivo novo: `electron/fixtureProfiles/index.js` + um arquivo por modelo
(`movingHeadBeam1.js`, `movingHeadBeam2.js`, `parLedDeluxeLayoutA.js`,
`parLedDeluxeLayoutB.js`). **Só existem esses 4 perfis.**

Cada perfil declara:
```js
{
  id: 'moving-head-beam-2',
  fixtureType: 'moving_head_beam',       // casa com fixture.fixtureType
  match: { name: 'moving head beam 2' }, // desempate quando há >1 fixture do mesmo tipo
  channels: { color: { alias: 'color_wheel' }, dimmer: { alias:'fecho_lampada' }, ... },
  capabilities: {
    color: { type: 'enumerated', status: 'ready' },        // ou 'mapping-incomplete'
    strobe: { type: 'range', status: 'mapping-incomplete' },
    ...
  },
}
```

`adapter.getCapabilities(deps, fixtureId)` devolve esse mapa `capabilities` para
inspeção. `adapter.setColor/setStrobe/setPrism/setGobo` **exigem** um perfil
resolvido com a capability em `status:'ready'` — sem isso, falham com um código
de erro (`PROFILE_NOT_FOUND`, `CAPABILITY_NOT_SUPPORTED`, `CAPABILITY_NOT_MAPPED`).

**Ponto crítico que muda a estratégia de mapeamento:** `setDimmer`,
`setMovementSpeed` e `setPanTilt` **NÃO passam pelo sistema de perfis**. Eles
resolvem o canal direto por alias literal (`dimmer`, `speed`, `pan`, `tilt`) via
`getChannelByAlias`, igual ao `getChannel` do sandbox. Ou seja: **essas três
capabilities já funcionam em qualquer fixture que tenha esses aliases no
`channels[]` do show — sem precisar criar perfil nenhum.** Só `color`, `strobe`,
`prism` e `gobo` exigem perfil (porque dependem de mapa lógico→DMX, não de um
valor contínuo direto).

---

## 3. Mapeamento por equipamento — o que está pronto e o que falta (testado agora, contra o show real)

Testei cada função semântica contra `shows/vp.show.json` tal como está hoje. Tabela
completa (✅ funciona · ⚠️ funciona mas com ressalva · ❌ falha):

| Fixture | color | dimmer | movementSpeed | pan/tilt | strobe | prism | gobo |
|---|---|---|---|---|---|---|---|
| **Moving Head Beam 1** | ❌ falta mapear de verdade (ver §3.2 — corrigido) | ✅ | ✅ | ✅ | ❌ sem perfil de dado | ❌ sem perfil de dado | ❌ sem perfil de dado |
| **Moving Head Beam 2** | ✅ | ✅ | ✅ | ✅ | ❌ sem dado no show | ❌ sem dado no show | ❌ sem dado no show |
| **Moving_Wosh** (`moving_head`, não `moving_head_beam`) | ❌ sem perfil | ❌ **sem perfil E sem canal `dimmer`/`fecho_lampada`** | ❌ **sem perfil E alias `speed` não casa com `pan_tilt_speed`** | ✅ (não depende de perfil) | ❌ sem perfil | ❌ sem perfil | ❌ sem perfil |
| **Ribalta_1 / Ribalta_2** (motorizada) | ❌ sem perfil | ✅ | ✅ | — (não tem pan/tilt, tem `tilt` só) | ❌ sem perfil | — | — |
| **Ribalta RGB estática (×4)** | ❌ sem perfil (tem `red/green/blue` mas nenhum perfil `rgb` foi criado pra ela) | ✅ | — | — | ❌ sem perfil | — | — |
| **Mini Brut (×4)** | — (só 1 canal: dimmer) | ✅ | — | — | — | — | — |
| **Fita LED** | — (só 1 canal: dimmer) | ✅ | — | — | — | — | — |
| **PAR LED Deluxe (layout A, com `white`)** | ✅ (rgbw) | ✅ | — | — | ❌ sem dado no show | — | — |
| **PAR LED Deluxe (layout B, com `color_wheel`)** | ✅ (rgb) | ✅ | — | — | ❌ sem dado no show | — | — |

`—` = a fixture não tem essa capability fisicamente (não é uma lacuna).

### 3.1 — Confirma exatamente sua suspeita, com uma reviravolta

Você disse: *"acho que o moving 2 tem só a cor, tilt, pan e speed mapeado, falta
o restante dele e falta tudo do outro"*. Testei e é **quase exatamente isso**,
com uma inversão importante:

- **Moving Head Beam 2** = o que você chamou de "moving 2": tem `color` + `dimmer`
  + `movementSpeed` + `pan/tilt` prontos. Falta `strobe`, `prism`, `gobo`
  (nenhum dado no show, perfil corretamente marca como incompleto — não é bug,
  é trabalho que falta de fato).
- **Moving Head Beam 1** — falta mapear de verdade, igual ao MH2 (ver §3.2 —
  correção da minha leitura anterior, que estava errada).
- **"O outro"** — se você quis dizer o **Moving_Wosh** (a outra cabeça móvel,
  modelo CMY), a situação é pior do que "falta tudo mapear": **o Wosh não tem
  perfil nenhum e nem pode usar os atalhos diretos de dimmer/speed**, porque:
  - não existe canal `dimmer` nem `fecho_lampada` nele (channels reais:
    `pan, tilt, pan_tilt_speed, strobo, color_wheel, cyan, magenta, gobo2,
    yellow, cmy_system, cmy_speed, effects_disc, zoom, pan_fine, tilt_fine`);
  - o alias `speed` não encontra `pan_tilt_speed` porque a tabela de fallback de
    alias (`getFixtureAliasCandidates`, `main.js:1008-1017`) só existe para
    `fixtureType === 'moving_head_beam'` — o Wosh é `moving_head` (tipo
    diferente), então cai fora dessa tabela;
  - é uma cabeça **CMY** (cyan/magenta/yellow subtrativo), não uma roda de cor
    discreta como os beams — o modelo de perfil atual (`enumerated`/`rgb`/`rgbw`)
    **não tem um tipo para CMY ainda**. Mapear "cor" no Wosh exige decidir esse
    tipo novo antes de criar o perfil dele.
  - **Se** você quis dizer **Moving Head Beam 1** como "o outro": ele tem
    dimmer/speed/pan/tilt prontos igual ao MH2 — mas a cor **genuinamente
    falta mapear**, ver §3.2 (correção de uma leitura errada que eu tinha
    feito nesta mesma seção).

### 3.2 — CORREÇÃO: eu estava errado — a cor do MH1 falta mapear de verdade, não é bug de metadado

Na primeira versão deste relatório eu afirmei que a cor do MH1 já estava
"pronta" no show e que só um status desatualizado no perfil bloqueava —
**isso estava errado, e o histórico do git prova o contrário.**

`shows/vp.show.json` tem, para o Moving Head Beam 1, uma tabela de 8 cores
(`white:0, red:30, green:60, blue_light:90, yellow:120, purple:150, blue:180,
amber:210`). Rastreei a origem: essa tabela foi adicionada em **25/06/2026**,
commit `b212b46` ("Adicionando adapter e ajustando scripts") — um primeiro
rascunho, no mesmo commit em que o adapter e os presets de moving foram
introduzidos.

Em **19/07/2026**, o commit `c2eff27` ("Checkpoint 4: reconciliação de cor do
Moving Head Beam 2") **refez a tabela de cor do MH2** com 15 pontos medidos
fisicamente no equipamento (passo de 10, contra os 8 valores rascunho
anteriores, passo de 16/32) — e a própria mensagem desse commit registra,
como resultado esperado e testado (`tests/adapter-real-show.test.js`):
> *"M1 ainda recusado (mapping-incomplete)"*

Ou seja: **isso não foi esquecimento** — foi uma decisão deliberada, testada
e revisada (revisão independente aprovou sem correções): o MH2 passou por
reconciliação física e ficou `ready`; o MH1 manteve a tabela rascunho de junho,
nunca reconciliada da mesma forma, e por isso continua `mapping-incomplete`
de propósito. O status do perfil está certo — quem está errado sou eu, na
versão anterior deste relatório, ao chamar isso de bug.

**Conclusão correta:** a cor do MH1 **falta mapear de verdade**, com o mesmo
tipo de trabalho de campo que `strobe`/`prism`/`gobo` dos dois beams exigem —
medir as cores reais da roda do MH1 no equipamento físico (não usar a tabela
de junho como se fosse validada) e então atualizar `adapters.color` no show.
Só depois disso o status do perfil deve virar `ready` — e nesse ponto, sim, é
só mudar a linha do `movingHeadBeam1.js`, mas como consequência do mapeamento
ter sido feito, não como correção de um bug isolado.

### 3.3 — O que genuinamente falta mapear (isso sim é trabalho de mapeamento de verdade)

Em ordem de prioridade prática:

1. **Perfil do Moving_Wosh** — o mais urgente e o mais trabalhoso, porque exige:
   (a) decidir um tipo de capability `cmy` (hoje só existem `enumerated`,
   `continuous`, `range`, `rgb`, `rgbw` — ver `fixtureProfiles/index.js:14`);
   (b) mapear `gobo2` e `effects_disc` (rodas de efeito) e `cmy_system`/`cmy_speed`;
   (c) adicionar `pan_tilt_speed` como alias de `movementSpeed` — hoje o helper
   de fallback de alias só cobre `moving_head_beam`, precisa cobrir `moving_head`
   também (ou dar um alias próprio no perfil, já que agora o `channels` do
   perfil pode declarar `movementSpeed: { alias: 'pan_tilt_speed' }` diretamente
   — não depende do fallback do `main.js` se o perfil existir).
2. **`color` do MH1** — a tabela atual (8 valores) é o rascunho de junho/2026,
   nunca reconciliado fisicamente (§3.2). Medir a roda de cor real do MH1 no
   equipamento (mesmo processo do Checkpoint 4 do MH2: passo fino, ponto a
   ponto) e substituir `adapters.color` no show; só então virar `ready` no
   `movingHeadBeam1.js`.
3. **`strobe`/`prism`/`gobo` do MH1 e do MH2** — genuinamente sem dado no show
   (`fixture.adapters` só tem a chave `color`). Precisa medir no equipamento
   físico e preencher `adapters.strobe`/`adapters.prism`/`adapters.gobo` no
   show, e então trocar o `status` de `mapping-incomplete` para `ready` nos dois
   arquivos de perfil.
4. **Perfil da Ribalta motorizada** (`ribalta`) — hoje não existe perfil, então
   `setColor`/`getCapabilities` úteis não funcionam nela (mas `setDimmer` e
   `setMovementSpeed` já funcionam via alias direto, sem perfil).
5. **Perfil da Ribalta RGB estática** — tem `red/green/blue`, só falta criar
   o perfil (`fixtureType: 'ribalta_rgb_static'`, `capabilities.color: {type:'rgb'}`)
   para ganhar `setColor` com nomes por nome ("red", "warm" etc.) em vez de só
   RGB numérico cru.
6. **Mini Brut / Fita LED** — só têm 1 canal (dimmer). Não há nada de
   semântico a mapear além do que já funciona (`setDimmer`).

---

## 4. Bugs confirmados na função legada `resolve()` (ainda presentes, ainda usados por `fire-base.js`)

A função antiga não foi tocada pela reescrita — só ganhou vizinhos novos. Os
bugs do `plano-adapter-universal.md` **continuam reais** porque `fire-base.js`
ainda depende dela (`fb_mhColor` → `adapter.resolve`):

- **BUG 1 (confirmado de novo agora):** `resolve()` normaliza a *consulta* mas
  compara contra as chaves cruas do mapeamento. Reproduzido:
  ```
  adapters.color = { "Azul Claro": 77 }
  resolve(..., "color", "Azul Claro") → null   (deveria ser 77)
  ```
  Enquanto os nomes de cor usados no show forem sempre minúsculos/sem espaço
  (como são hoje: `white`, `blue_light`, `purple_medium` etc.), o bug não morde.
  Mas qualquer nome novo digitado com espaço ou maiúscula quebra silenciosamente.
- **BUG 2 (ainda presente):** checagem falsy do canal em vez de `=== null`
  (`electron/adapter.js`, função `resolve`, condição
  `if (!getChannelByAlias(fixture, alias)) return null;`).
- **A API semântica nova tem o MESMO tipo de bug**, num lugar diferente:
  `mappedValueResult()` (usada por `setStrobe`/`setPrism`/`setGobo`) normaliza
  `requestedValue` mas compara contra `mapping[logical]` sem normalizar as
  chaves do mapeamento — herda a mesma assimetria do BUG 1. Ainda não morde
  porque nenhuma fixture tem dado de strobe/prism/gobo no show ainda (§3.3).
  **Corrigir isso ANTES de popular esses mapas**, ou o mesmo bug vai se repetir
  assim que alguém digitar um valor lógico com maiúscula/espaço.

**Recomendação:** corrigir BUG 1/2 num só lugar reaproveitável (uma função
`normalizedLookup(mapping, key)` chamada tanto por `resolve()` quanto por
`mappedValueResult()`), antes de continuar preenchendo mapas novos — assim o
mesmo bug não é corrigido duas vezes em dois lugares.

---

## 5. `fire-base.js` — ainda não integrado ao adapter semântico (ação pendente)

Confirmado por leitura: `scripts/fire-base.js` (428 linhas, todas as seções 1-12
do design original) só usa `adapter.resolve()` uma vez, dentro de `fb_mhColor`.
Não usa `adapter.setColor/setDimmer/setMovementSpeed/setPanTilt` em lugar nenhum.

Isso significa que hoje, se você escrever um script-fire usando os helpers da
base (`fb_dim`, `fb_mhMove`, `fb_ribMove` etc.), ele **nunca vai se beneficiar**
de nenhum perfil novo que você mapear — porque esses helpers escrevem direto
via `fb_set`/`SetChannel`, sem consultar o adapter semântico em nenhum ponto
além da cor do beam.

Duas opções, **não fiz nenhuma ainda** (aguardando sua decisão, porque mexe na
base compartilhada por todos os scripts-fire futuros):

- **Opção A — mínima:** manter `fb_mhColor` como está (via `resolve()` legado)
  e criar `fb_wheel(fx, adapterKey, logical)` genérico só para `strobe/prism/gobo`
  quando você terminar de mapear o item 2 do §3.3 — sem tocar no resto da base.
- **Opção B — a do `melhoria-fire-base-adapter.md`, adaptada:** migrar os
  resolvers da base para também guardar `fx.id`, e trocar `fb_mhColor` para
  chamar `adapter.setColor(fx.id, nome)` (API semântica nova) em vez de
  `adapter.resolve`. Ganha diagnóstico melhor (códigos de erro), mas exige medir
  cuidadosamente o retorno (`{ok, code, message}`) em vez do `null` simples de
  hoje — muda o contrato interno da base.

Recomendo esperar você terminar o mapeamento do §3.3 antes de decidir; mapear
primeiro, decidir a integração depois (mapear com o `resolve()` legado
continua seguro, ele só tem os bugs do §4, que valem a pena corrigir de
qualquer forma).

---

## 6. Bug relatado — botão direito nos scripts não funciona na Página 2 em diante

**Causa raiz confirmada, nos dois lados (frontend e backend).**

### 6.1 — Frontend: dois dos quatro itens do menu ficam travados fora da Página 1

`src/screens/Main.jsx:703`:
```js
const legacyScriptCreationSupported = activeScriptPageId === 'page-1';
```
Esse flag é usado para desabilitar **"Scripts Existentes"** (linha 2714-2725) e
**"Criar Script" / "Editar Script"** (linha 2726-2746) do menu de contexto do
F-key sempre que a página de scripts ativa não é a primeira — os itens ficam
com `cursor:'not-allowed'` e cor cinza (`#555`), e o `onClick` tem um
`if (!legacyScriptCreationSupported) return;` logo na primeira linha, ou seja,
clicar neles **não faz literalmente nada** em qualquer página além da Página 1.
Isso bate exatamente com o que você reportou.

Os outros dois itens do menu — **"Mover para..."** (linha 2747) e
**"Desassociar"** (linha 2778) — **não** têm esse guard, e funcionam em
qualquer página, desde que já exista um script associado ao slot.

### 6.2 — Backend: o guard existe porque a IPC por trás é hardcoded para "page-1"

Não é só um cadeado de UI por precaução — `electron/main.js`, handler
`ipcMain.handle('script:create', ...)` (linhas 1156-1231), que é chamado tanto
por "Criar Script" quanto por "Scripts Existentes" (linhas 912, 3029, 3043 do
`Main.jsx`), tem a página **hardcoded**:
```js
const previous = scriptLibraryLogic.resolveScriptSlot(
  library, current.scriptPages, 'page-1', fkey          // ← 'page-1' fixo
);
...
pages = scriptLibraryLogic.forceAssociateEntry(library, current.scriptPages, id, 'page-1', fkey); // ← idem
```
Ou seja: **se o guard do frontend não existisse**, clicar em "Criar Script"
estando na Página 3 criaria/associaria o script silenciosamente na **Página 1**,
enquanto você olha pra Página 3 achando que criou ali — um bug pior (dado
indo pro lugar errado sem aviso) do que o atual (botão simplesmente não reage).
O guard do item 6.1 foi provavelmente colocado de propósito como uma trava de
segurança temporária, sem terminar a migração da IPC para ser page-aware.

### 6.3 — Confirmação de que a infraestrutura page-aware já existe (o conserto é pequeno)

O sistema novo de biblioteca de scripts **já é** page-aware — só essa IPC
específica de criação que ficou para trás:
- `ipcMain.handle('scriptLibrary:associate', (_, id, pageId, slot) => ...)` — já aceita `pageId`.
- `ipcMain.handle('scriptLibrary:move', (_, id, pageId, slot) => ...)` — já aceita `pageId` (é o que "Mover para..." usa).
- `ipcMain.handle('scriptLibrary:register', ...)` — já cria uma entrada na biblioteca sem depender de página nenhuma.

### 6.4 — Workaround imediato (sem mexer em código, pode usar hoje)

1. Vá para a **Página 1** de scripts.
2. Clique com o botão direito num F-key livre → **"Criar Script"** (ou
   **"Scripts Existentes"** para reaproveitar um script já criado) — funciona
   normalmente na Página 1.
3. Ainda na Página 1, clique com o botão direito **nesse mesmo F-key** →
   **"Mover para..."** → escolha a página de destino (2, 3...) e o slot.
4. O script agora existe na página desejada.

### 6.5 — Correção definitiva recomendada (não apliquei — é mudança de comportamento, prefiro sua confirmação antes)

1. Adicionar um parâmetro `pageId` na IPC `script:create` (default `'page-1'`
   para não quebrar chamadas antigas), e trocar as duas ocorrências de
   `'page-1'` hardcoded (main.js:1212, 1220) pelo `pageId` recebido.
2. Nos 3 pontos do `Main.jsx` que chamam `window.vp.createScript(...)`
   (linhas 912, 3029, 3043), passar `activeScriptPageId` como esse novo
   parâmetro.
3. Remover (ou simplesmente fixar em `true`) o `legacyScriptCreationSupported`
   de `Main.jsx:703`, já que a IPC passa a respeitar a página certa.
4. Testar: criar script na Página 2 diretamente, confirmar que ele aparece
   assignado na Página 2 (não na 1) e que "Mover para..."/"Desassociar"
   continuam funcionando depois disso.

Não apliquei essa correção agora porque muda o comportamento de uma IPC usada
em produção (véspera/pós-evento) — prefiro sua confirmação antes de tocar
nisso, já que o workaround do §6.4 resolve o caso de uso imediato.

---

## 7. Ordem de prioridade recomendada (o que fazer primeiro)

1. **Decidir e aplicar a correção do menu de contexto (§6.5)** — impacta o uso
   diário do app; o workaround do §6.4 cobre a urgência entretanto.
2. **Corrigir BUG 1/2 do `resolve()`/`mappedValueResult()` juntos** (§4) — antes
   de popular novos mapas de cor do MH1, strobe/prism/gobo, ou cor do Wosh,
   para não herdar o mesmo bug nos dados novos.
3. **Mapear o que falta de verdade** (§3.3, em ordem): cor do MH1 (medição
   física, igual ao Checkpoint 4 do MH2) → perfil do Wosh (com tipo `cmy`
   novo) → strobe/prism/gobo do MH1/MH2 → perfil da ribalta motorizada →
   perfil da ribalta RGB estática.
4. **Só depois** decidir a integração `fire-base.js` ↔ adapter semântico (§5),
   com o mapeamento já estável.
