# Plano de correção — mapeamento dos movings, menu de contexto (página 2+) e trava de cena com script ativo

> Continuação direta de `relatorio-definitivo-mapeamento-equipamentos.md` (nesta
> pasta). Este documento responde objetivamente "o que falta mapear no Moving 1
> e no Moving 2", confirma que adapter/macro já funcionam como mecanismo, e
> monta o plano de correção dos dois bugs que você relatou: o menu de contexto
> nas páginas de script 2+ e a trava de cena quando um script está ativo.

---

## 1. Resposta direta — o que falta mapear em cada Moving

**O mecanismo (adapter semântico + macro) já funciona.** O que falta não é
"fazer o adapter funcionar" — é só **preencher dados de equipamento** que ainda
não foram medidos. Por equipamento:

> **Correção sobre a cor do MH1 (eu tinha errado nisso):** na primeira versão
> deste plano eu disse que a cor do MH1 já estava pronta no show e só um
> status desatualizado no perfil bloqueava. Você apontou que isso estava
> errado — conferi o histórico do git e você tem razão. A tabela de 8 cores
> do MH1 no show é um **rascunho de 25/06/2026** (commit `b212b46`), nunca
> reconciliado fisicamente. Em 19/07/2026 (commit `c2eff27`), a cor do MH2 foi
> refeita com 15 pontos medidos no equipamento — e a própria mensagem desse
> commit registra, como resultado esperado e testado: *"M1 ainda recusado
> (mapping-incomplete)"*. Ou seja, o status `mapping-incomplete` do MH1 é
> **deliberado e correto** — a cor dele genuinamente falta mapear, com a
> tabela de junho tratada como não confiável. Corrigido na tabela abaixo.

### Moving Head Beam 1 (MH1)
| Capability | Status | O que falta |
|---|---|---|
| `dimmer`, `movementSpeed`, `pan`, `tilt` | ✅ pronto | nada |
| `color` | ❌ falta mapear de verdade | A tabela de 8 valores no show é rascunho de junho, nunca reconciliado no equipamento físico (mesmo processo que o MH2 já passou). Precisa medir a roda de cor real do MH1 (ponto a ponto, passo fino) e substituir `adapters.color` no show; só então virar `ready` no perfil. |
| `strobe`, `prism`, `gobo` | ❌ falta mapear de verdade | Nenhum dado no show ainda. Precisa medir no equipamento físico (valores DMX de cada intensidade/padrão de strobo, cada prisma, cada gobo) e escrever em `adapters.strobe` / `adapters.prism` / `adapters.gobo` no `vp.show.json`. |

### Moving Head Beam 2 (MH2)
| Capability | Status | O que falta |
|---|---|---|
| `color`, `dimmer`, `movementSpeed`, `pan`, `tilt` | ✅ pronto (cor já tem 15 tons medidos fisicamente, Checkpoint 4) | nada |
| `strobe`, `prism`, `gobo` | ❌ falta mapear de verdade | Mesma lacuna do MH1 — nenhum dado no show ainda. |

**Ou seja: MH1 e MH2 têm o mesmo tipo de lacuna real** — a diferença é que o
MH2 já passou pela reconciliação física da cor (Checkpoint 4) e o MH1 ainda
não. Strobe/prism/gobo estão igualmente pendentes nos dois.

### 1.1 — Moving_Wosh — esse sim falta (quase) tudo
Diferente dos beams, o Wosh não tem perfil nenhum e é um modelo diferente
(CMY, não roda de cor discreta). Retomando do relatório anterior: precisa (a)
criar um perfil novo pra ele, (b) decidir um tipo de capability para mistura
CMY (hoje só existem `enumerated`/`continuous`/`range`/`rgb`/`rgbw`), e (c)
mapear `gobo2`/`effects_disc`/`cmy_system`/`cmy_speed`. Isso é trabalho de
mapeamento de verdade, maior que o dos beams.

### 1.2 — Ribalta motorizada e Ribalta RGB estática
Sem perfil ainda (mas `setDimmer`/`setMovementSpeed` já funcionam nelas via
alias direto, sem precisar de perfil). Criar perfil só passa a valer a pena
quando você quiser `setColor`/`getCapabilities` nomeados para elas.

### 1.3 — Não existe correção de 1 linha para a cor do MH1 (isso era o meu erro)
Retirado. A cor do MH1 precisa do trabalho de campo de verdade (medir a roda
no equipamento físico e escrever os valores reais em `adapters.color`) antes
de qualquer mudança em `electron/fixtureProfiles/movingHeadBeam1.js`. Mudar o
`status` para `ready` **antes** de medir de verdade recriaria o mesmo problema
que o Checkpoint 4 evitou no MH2: destravaria `setColor` apontando para uma
tabela rascunho não confiável. Essa linha só deve mudar depois que você
terminar de medir — não antes.

---

## 2. Confirmação — adapter e macro já operam como mecanismo

Você comentou que "já tá funcionando o adapter e todo o escopo de operação de
equipamentos, inclusive o conceito de macro". Confirmando com precisão, para
não misturar "mecanismo funciona" com "dado está completo":

- **Adapter semântico** (`setColor/setDimmer/setMovementSpeed/setPanTilt/
  setStrobe/setPrism/setGobo/getCapabilities`): mecanismo 100% funcional e
  testado. O que falta é só dado de fixture (§1), não código.
- **Macro** (`compositor.createMacro/startMacro/stopMacro/triggerNextStep`):
  é um recurso independente do adapter — sequencia **camadas de script**
  (fade-in/hold/fade-out, HTP ou linear), não depende de nenhum perfil de
  fixture nem de `adapters.*` no show. Já funciona hoje para qualquer script,
  mapeado ou não. Nenhuma ação pendente aqui.

---

## 3. Correção — menu de contexto não funciona nas páginas de script 2+

Diagnóstico já fechado no relatório anterior (§6). Resumo do plano de execução:

### 3.1 Causa raiz (recapitulando)
- Frontend (`src/screens/Main.jsx:703`): `legacyScriptCreationSupported =
  activeScriptPageId === 'page-1'` desliga "Scripts Existentes" e "Criar/Editar
  Script" fora da Página 1.
- Backend (`electron/main.js`, handler `script:create`, linhas 1156-1231):
  tem `'page-1'` **hardcoded** em duas chamadas (`resolveScriptSlot` e
  `forceAssociateEntry`) — por isso o guard do frontend existe (evita criar o
  script na página errada silenciosamente).
- A infraestrutura page-aware já existe (`scriptLibrary:associate`,
  `scriptLibrary:move`, `scriptLibrary:register` já aceitam `pageId`) — só
  essa IPC de criação ficou de fora da migração.

### 3.2 Passos da correção
1. `electron/main.js` — adicionar parâmetro `pageId` na assinatura da IPC
   `script:create` (default `'page-1'` para não quebrar chamadas antigas);
   trocar as duas ocorrências hardcoded de `'page-1'` (linhas ~1212 e ~1220)
   pelo `pageId` recebido.
2. `electron/preload.js` — atualizar `createScript` para repassar o `pageId`
   como argumento extra da invocação IPC.
3. `src/screens/Main.jsx` — nos 3 pontos que chamam
   `window.vp.createScript(...)` (linha 912 — "Criar Script"; linhas 3029 e
   3043 — confirmar "Scripts Existentes"), passar `activeScriptPageId`.
4. `src/screens/Main.jsx:703` — remover (ou fixar em `true`) o
   `legacyScriptCreationSupported`, já que a IPC passa a respeitar a página
   certa.
5. **Teste manual obrigatório antes de considerar pronto:** ir para a Página
   2, clicar direito num F-key livre → "Criar Script" → confirmar que o
   script aparece **na Página 2** (não migra sozinho pra Página 1) → testar
   "Mover para..." e "Desassociar" continuam funcionando depois.

### 3.3 Workaround (usar até a correção entrar)
Criar/editar na Página 1 → botão direito no mesmo F-key → "Mover para..." →
escolher a página e o slot de destino.

---

## 4. Correção — cena não muda enquanto um script está ativo ("trava")

### 4.1 O que você reportou
"Eu tenho um script selecionado, coloco uma cena (ex.: strobo), mudo pra outra
cena e ela não muda — só muda se eu desativar o script."

### 4.2 Causa raiz encontrada (investigação nova, feita agora)

O compositor faz o merge de camadas por frame usando três buffers por script:
`buffer` (valores), `touched` (quais canais o script escreveu **neste tick**)
e `controlledMask` (quais canais essa camada "possui"). A cada frame,
`compositor.renderFrame()` reseta `buffer` e `touched` antes de chamar
`OnExecute()` de novo — isso está certo, é o comportamento documentado:

```js
// electron/engine/compositor.js:247-248
layer.buffer.fill(0);
layer.touched.fill(0);
```

**Só que `controlledMask` nunca é resetado.** Ele é alocado uma vez quando o
script inicia (`new Uint8Array(512)` em `electron/main.js`) e cada
`SetChannel` marca `controlledMask[idx] = 1` — mas nada nunca volta esse bit
pra 0. Resultado: **um canal que o script tocou uma única vez (no `OnStart`,
num warmup, numa fase que só acontece às vezes) fica marcado como "controlado
por esse script" para sempre, enquanto ele estiver rodando** — mesmo que o
script não escreva mais naquele canal em nenhum tick posterior.

Isso é usado em `dmx:restoreState` (chamado toda vez que você troca de cena,
via `resolveUniverseState` → `window.vp.restoreState`) assim:

```js
// electron/main.js:437-456
const anyScriptRunning = compositor.hasActiveControlLayers();
if (anyScriptRunning) {
  applyDmxChannelMap(filterSceneMapByActiveScripts(filtered), 'restoreState/merge');
  // filterSceneMapByActiveScripts (main.js:419-435) descarta, da nova cena,
  // TODO canal que esteja em compositor.getActiveControlledChannels() —
  // que por sua vez é a UNIÃO de todos os controlledMask (main.js:173-183,
  // compositor.js).
}
```

Ou seja: com qualquer script rodando, trocar de cena **silenciosamente
ignora** qualquer canal da nova cena que aquele script tenha tocado alguma vez
desde que começou a rodar — mesmo que já tenha parado de tocar esse canal há
muitos ticks. Se a "cena de strobo" usa um canal (ex.: `strobo` ou `dimmer` de
um Mini Brut/PAR) que o script ativo tocou em algum momento do próprio ciclo
dele, esse canal fica preso no valor antigo pra sempre — até você desativar o
script, o que dispara `resolveUniverseState` de novo
(`Main.jsx:902-904`) **sem** nenhum script rodando, e aí `dmx:restoreState`
cai no outro caminho (`universe.blackout()` + aplica tudo sem filtro),
finalmente mostrando a cena certa. É exatamente o comportamento que você
descreveu, ponto a ponto.

**Isso é um bug, não é comportamento pretendido** — o próprio comentário do
código diz "canais **ainda** controlados" (main.js:445) e "máscara... que
outras camadas **ainda** controlam" (compositor.js:141), ou seja, a intenção
sempre foi refletir o controle **atual/corrente**, não o controle **histórico
acumulado**. A implementação diverge da própria intenção documentada.

### 4.3 Correção proposta

Resetar `controlledMask` junto com `buffer`/`touched`, no mesmo lugar e na
mesma cadência — trata os três como o mesmo tipo de estado (válido só no
tick atual):

```diff
  // electron/engine/compositor.js:246-248, dentro do loop de renderFrame()
  for (const layer of arr) {
    _tickEnvelope(layer);
    layer.buffer.fill(0);
    layer.touched.fill(0);
+   if (layer.controlledMask) layer.controlledMask.fill(0);
    const fn = layer.context && layer.context.OnExecute;
```

Com isso, `getActiveControlledChannels()` passa a refletir só o que os
scripts **realmente tocaram no último tick executado** — igual ao que os
comentários já diziam que deveria acontecer. Efeito colateral verificado:
**nenhum**, porque:
- `_getOthersControlledMask`/`_flushLayerToUniverse` (usado ao parar um
  script) passam a considerar só o controle *atual* de outras camadas, o que
  é estritamente mais correto (hoje pode bloquear um flush por causa de um
  canal que a outra camada tocou há muito tempo e não toca mais).
- O ganho pretendido do `controlledMask` (não deixar a cena brigar com o
  script nos canais que ele efetivamente anima) continua intacto — só deixa
  de se aplicar a canais que o script **não anima mais**.

### 4.4 Passos da correção
1. Aplicar o `fill(0)` em `compositor.js` (diff acima).
2. Teste manual: ativar um script que tenha uma fase inicial tocando um canal
   X e depois pare de tocá-lo (ex.: um warmup); ativar uma cena que define
   canal X; trocar de cena; confirmar que o canal X agora atualiza
   normalmente sem precisar desativar o script.
3. Teste de regressão do comportamento que o `controlledMask` deveria manter:
   rodar um script de moving (pan/tilt contínuo) + cena qualquer → confirmar
   que trocar de cena **não** reseta o pan/tilt do moving enquanto ele
   continua sendo tocado a cada tick (esse é o caso que a proteção existe
   para preservar, e precisa continuar funcionando).
4. Rodar os scripts atuais (14 scripts + fire-base quando houver scripts-fire
   reais) parado/rodando/trocando cena, de olho em qualquer regressão visível.

Não apliquei essa correção ainda — é uma mudança no motor (`compositor.js`),
usado em produção; aguardando sua confirmação antes de tocar.

---

## 5. Ordem de execução recomendada

1. **§4** — corrigir o `controlledMask` no compositor (mais impactante no uso
   diário: destrava cenas presas por scripts ativos).
2. **§3** — corrigir a IPC `script:create` para respeitar a página ativa
   (destrava criar/editar script fora da Página 1).
3. Em paralelo, você mede fisicamente o que falta de verdade (§1: cor do MH1;
   strobe/prism/gobo dos dois beams; Wosh; ribaltas) — trabalho de campo, não
   depende de nenhuma das correções de código acima.
