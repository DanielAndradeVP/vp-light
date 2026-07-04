# Melhoria — `scripts/fire-base.js` integrado ao adapter universal

> Continuação de `plano-adapter-universal.md`. Objetivo: quando você criar ou
> editar uma adaptação de qualquer equipamento no `.show.json` (mapa, transform
> ou preset), **todos os scripts-fire já escritos refletem a mudança sem editar
> nenhum deles** — porque toda escrita da base passa pelo adapter.

---

## 1. Diagnóstico da base atual (o que impede isso hoje)

A `fire-base.js` v1 está correta, mas o adapter só participa em **um** ponto
(`fb_mhColor`, roda de cor dos beams). Três lacunas estruturais:

### LACUNA 1 — escrita cega ao adapter
`fb_set(canal, valor)` recebe só o **número** do canal. Nesse ponto a base já
não sabe de qual fixture/alias o canal veio — impossível consultar
`adapter.value(id, alias, valor)` para aplicar uma correção `transform`.
A informação necessária existia no resolver e foi descartada.

### LACUNA 2 — resolvers perdem o nome do alias
`fb_mh()` devolve `{ panFine: 132, ... }` — a propriedade é camelCase amigável
(`panFine`), mas o alias real do show é `pan_fine`. Sem o alias original, não
há como cruzar com um `transform` que declara `"alias": "pan_fine"`.

### LACUNA 3 — adapter só para cor de beam
Não existe helper genérico para outras rodas (gobo, prisma, macro do PAR) nem
para presets multi-canal. Cada nova adaptação exigiria helper novo — o oposto
de "criar a adaptação no show e os scripts herdarem".

---

## 2. Desenho da solução

### 2.1 Resolvers passam a carregar `{ id, ch }` (alias → canal)

Cada resolver monta um mapa interno `ch` indexado pelo **alias real do show**,
e mantém as propriedades amigáveis apontando para os mesmos números (nenhum
script quebra):

```js
function fb_mh(id) {
  const ch = {};
  for (const alias of ['color_wheel','strobo','fecho_lampada','gobo_wheel',
                       'prism_1','virtual_speed','pan','pan_fine','tilt',
                       'tilt_fine','reset']) {
    ch[alias] = getChannel(id, alias);
  }
  return {
    id, ch,
    // atalhos compatíveis com a v1 (scripts-fire existentes não mudam):
    color: ch.color_wheel, strobo: ch.strobo, dimmer: ch.fecho_lampada,
    gobo: ch.gobo_wheel,   prism: ch.prism_1, speed: ch.virtual_speed,
    pan: ch.pan, panFine: ch.pan_fine, tilt: ch.tilt,
    tiltFine: ch.tilt_fine, reset: ch.reset,
  };
}
```

Mesmo padrão para `fb_rib`, `fb_ribStatic`, `fb_par`, `fb_brut`, `fb_wosh`.
A lista de aliases por família vira constante única (`FB_ALIASES`), documentando
o vocabulário completo de cada equipamento num só lugar.

### 2.2 `fb_write(fx, alias, valor)` — o novo caminho único de escrita

```js
// Toda escrita da base passa a ser: valor do script → correção do adapter →
// canal. Se o engine ainda não expõe adapter.value, degrada para o valor cru.
function fb_adapterValue(id, alias, value) {
  if (typeof adapter !== 'undefined' && typeof adapter.value === 'function') {
    const v = adapter.value(id, alias, value);
    if (v !== null && v !== undefined) return v;
  }
  return value; // identidade — comportamento atual
}

function fb_write(fx, alias, value) {
  const channel = fx.ch ? fx.ch[alias] : null;
  if (channel === null || channel === undefined) return;
  fb_set(channel, fb_adapterValue(fx.id, alias, value));
}
```

- **`fb_set` continua existindo** como primitivo de baixo nível (clamp +
  null-guard), mas os helpers internos da base (`fb_rgb`, `fb_dim`,
  `fb_mhMove`, `fb_mhOpen`, `fb_ribMove`, `fb_ribDim`, `fb_ribLeds`,
  `fb_ribStaticApply`, `fb_blackout*`) migram todos para `fb_write`.
  É essa migração interna que faz **qualquer** transform criado no show
  (ex.: `fix_dimmer` limitando um PAR a 200, `fix_tilt` com offset +6,
  canal invertido) valer automaticamente em todos os 50 scripts.
- **Degradação elegante:** antes do patch no `main.js` (que expõe
  `adapter.value`), `fb_adapterValue` devolve o valor cru — a base funciona
  hoje, byte a byte igual à v1, e "liga" as correções quando o engine for
  atualizado. Preserva o isolamento da fase atual.

### 2.3 Helpers genéricos de adaptação (qualquer roda, qualquer preset)

```js
// Qualquer roda/canal discreto com mapa escalar (tipo 1):
//   fb_wheel(mh, 'gobo_wheel', 'gobo', 'estrela')
//   fb_wheel(par, 'macro', 'macro', 'arco_iris')
function fb_wheel(fx, alias, adapterKey, logical) {
  const dmx = adapter.resolve(fx.id, alias, adapterKey, logical);
  if (dmx !== null) fb_write(fx, alias, dmx);
}

// Preset multi-canal (tipo 3): um nome lógico → vários canais de uma vez.
//   fb_preset(par, 'preset', 'warm')  → red/green/blue do "warm" definidos no show
function fb_preset(fx, adapterKey, logical) {
  if (typeof adapter.preset !== 'function') return false;
  const map = adapter.preset(fx.id, adapterKey, logical);
  if (!map) return false;
  for (const alias in map) fb_write(fx, alias, map[alias]);
  return true;
}
```

- `fb_mhColor(mh, nome)` vira açúcar sobre `fb_wheel(mh, 'color_wheel',
  'color', nome)` — assinatura idêntica, scripts existentes intactos.
- Cor de PAR ganha caminho híbrido: `fb_parColor(par, nome)` tenta
  `fb_preset` primeiro (se você criou presets de cor no show) e cai para as
  constantes RGB da base se não houver — ou seja, **você pode redefinir as
  cores de culto no show sem recompilar nada**, e a base tem fallback são.

### 2.4 Regra de semântica: correção vale até no blackout (de propósito)

`fb_blackout*` também migra para `fb_write`. Isso é deliberado:
- Canal **invertido** (`invert: true`): blackout precisa passar pelo transform
  (0 lógico → 255 físico = desligado de verdade).
- `min` num transform é um **piso permanente**, inclusive no blackout — é o
  comportamento correto para "nunca deixar esse canal abaixo de X", e o guia
  deve avisar que piso ≠ correção de brilho (para isso, `scale`).

### 2.5 O que NÃO muda

- Nenhuma assinatura pública da v1 muda (`fb_allMH`, `fb_mhMove`, `fb_rgb`,
  `fb_flashOn`, keyframes, blackouts — tudo igual para quem escreve script).
- IDs, presets de rig (`FB_MH1_POS` etc.) e helpers de coreografia intactos.
- Continua biblioteca pura: sem `OnStart/OnExecute/OnTerminate`, inerte até
  ser injetada. O isolamento da fase atual é mantido.

---

## 3. Fluxo resultante (o contrato que você queria)

```
você edita/cria adapters no vp.show.json (mapa | transform | preset)
        │            (sem tocar em script nenhum)
        ▼
script-fire chama helper da base (fb_dim, fb_mhMove, fb_wheel, fb_preset…)
        ▼
fb_write(fx, alias, valor) → adapter.value/resolve/preset (lê o show AO VIVO)
        ▼
SetChannel na camada → compositor → engine → Art-Net
```

- `adapter.*` lê o show em memória a cada chamada → correções valem no tick
  seguinte, mesmo com o script rodando.
- Duas ressalvas para o guia: (a) **números de canal** são cacheados no
  `OnStart` — mudar `startChannel`/aliases de um fixture pede restart do
  script (F-key off/on); mudar só *valores* de adapters não pede nada;
  (b) editar o `.show.json` direto no disco exige o show recarregado no app —
  edições feitas pela UI já atuam na memória.

---

## 4. Ordem de execução

| # | Passo | Depende de |
|---|---|---|
| 1 | Implementar plano do adapter (bugs + `value`/`preset` + sandbox) | `plano-adapter-universal.md` |
| 2 | fire-base v2: `FB_ALIASES` + resolvers com `{id, ch}` (§2.1) | — (retrocompatível, pode até anteceder o 1 graças à degradação §2.2) |
| 3 | `fb_adapterValue` + `fb_write` + migrar helpers internos (§2.2) | 2 |
| 4 | `fb_wheel` / `fb_preset` / `fb_parColor` (§2.3) | 1, 3 |
| 5 | Atualizar harness `tools/validate-fire.js` com stubs de `adapter.value`/`preset` (identidade) + teste com transform fake provando a correção aplicada | 3 |
| 6 | Atualizar `guia-fire-base-como-usar.md` (novas funções + ressalvas §3) | 4 |

## 5. Validação (mesmo método da v1)

1. Compilar a base v2 no sandbox exato do engine sobre o show real — parse OK,
   ciclo de vida ausente, resolvers batendo com os canais conhecidos
   (MH1 pan=132, bruts 400/401/402/410, PAR layout B, `enabled:false` → null).
2. **Teste de identidade:** sandbox SEM `adapter.value` → cada helper produz
   exatamente os mesmos `SetChannel` da v1 (diff de writes vazio).
3. **Teste de correção:** sandbox COM `adapter.value` e um transform fake
   (`dimmer scale 0.5, max 100`) → `fb_dim(par, 255)` escreve 100; remover o
   transform → volta a escrever 255 sem recompilar o script.
4. **Teste de preset:** `fb_preset(par, 'preset', 'warm')` escreve os 3 canais
   definidos no show; alias inexistente no preset é ignorado sem erro.

## 6. Critérios de aceite

- Criar/editar uma adaptação (mapa, transform ou preset) de **qualquer**
  equipamento no show altera o comportamento de **todos** os scripts-fire que
  usam aquele fixture — zero edição de script, zero restart para valores.
- Sem adapters definidos, a base v2 é byte a byte equivalente à v1.
- Scripts escritos contra a v1 (exemplos do guia) rodam inalterados na v2.
- Nenhum script-fire contém `SetChannel` cru, ID literal ou número de canal —
  o checklist do guia e o harness continuam sendo o gate.
