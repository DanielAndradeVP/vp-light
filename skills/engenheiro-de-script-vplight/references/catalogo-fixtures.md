# Catalogo de fixtures — estado conhecido do show atual

Fonte unica de verdade: `shows/vp.show.json` (Vida e Paz — Show Principal). Este arquivo **nao** e lido pelo runtime: o motor opera sobre o `currentShow` em memoria. Use este catalogo apenas como referencia para gerar scripts. Se Dan disser que mudou patch, labels ou equipamentos, peca o show atualizado antes de gerar qualquer script.

## Regra de enderecamento

Canal DMX real = `startChannel + indice no array channels` (1-based). **O `startChannel` e a verdade** — campos `note`/`observation` de cada fixture podem conter faixas DMX defasadas e nao devem ser usados. Labels vazias (`""`) sao **sem alias** e nao resolvem em `getChannel`. Fixtures com `enabled: false` retornam `null` em `getChannel` e nao recebem DMX.

Prefira sempre `getChannel(id, alias)` ao numero cru; o numero existe para conferencia.

## Sumario (apenas fixtures ativos)

| Grupo | Fixtures ativos | Canais DMX ocupados |
|---|---:|---:|
| Par LEDs | 9 | 72 |
| Moving Heads (2 Beam + 1 Wosh) | 3 | 48 |
| Ribaltas (2 com tilt + 4 RGB estaticas) | 6 | 50 |
| Mini Bruts | 4 | 4 |
| Fita LED | 1 | 1 |
| **Total** | **23** | **175** |

Fixtures inativos (`enabled: false`): 1 (`parLed1`) — ver secao final.

---

## Par LEDs

Grupo: `ParLed Deluxe`. Universo `0`. `fixtureType: par_led`. 8 canais cada (`channelCount: 8`).

**Dois layouts de canais distintos:**
- `ParLed_Deluxe_1`: `['', macro, color_wheel, speed, dimmer, red, green, blue]` — indice 0 sem alias; `dimmer` no indice 4.
- `ParLed_Deluxe_2` ate `_9` e `_9_extra`: `[macro, color_wheel, speed, dimmer, red, green, blue, '']` — indice 7 sem alias; `dimmer` no indice 3.

`macro`, `color_wheel` e `speed` sao canais de modo/controle. Para controle RGB manual via script, mantenha `macro=0`, `color_wheel=0`, `speed=0` e use `dimmer` (mestre de intensidade) + `red` + `green` + `blue`.

> **Descasamento id x nome:** o fixture de nome `ParLed_Deluxe_9_extra` tem id `..._parled_deluxe_6` (start 74). Os nomes 6–9 foram remanejados; confirme sempre o id pelo nome.

| Nome (show) | id | start | channelCount | faixa DMX | dimmer | red | green | blue | macro | color_wheel | speed |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|
| ParLed_Deluxe_1 | `fixture_1780805067518_parled_deluxe_1` | 1 | 8 | 1–8 | 5 | 6 | 7 | 8 | 2 | 3 | 4 |
| ParLed_Deluxe_2 | `fixture_1780805067518_parled_deluxe_2` | 9 | 8 | 9–16 | 12 | 13 | 14 | 15 | 9 | 10 | 11 |
| ParLed_Deluxe_3 | `fixture_1780805067518_parled_deluxe_3` | 17 | 8 | 17–24 | 20 | 21 | 22 | 23 | 17 | 18 | 19 |
| ParLed_Deluxe_4 | `fixture_1780805067518_parled_deluxe_4` | 25 | 8 | 25–32 | 28 | 29 | 30 | 31 | 25 | 26 | 27 |
| ParLed_Deluxe_5 | `fixture_1780805067518_parled_deluxe_5` | 33 | 8 | 33–40 | 36 | 37 | 38 | 39 | 33 | 34 | 35 |
| ParLed_Deluxe_7 | `fixture_1780805067518_parled_deluxe_7` | 49 | 8 | 49–56 | 52 | 53 | 54 | 55 | 49 | 50 | 51 |
| ParLed_Deluxe_8 | `fixture_1780805067518_parled_deluxe_8` | 57 | 8 | 57–64 | 60 | 61 | 62 | 63 | 57 | 58 | 59 |
| ParLed_Deluxe_9 | `fixture_1780805067518_parled_deluxe_9` | 65 | 8 | 65–72 | 68 | 69 | 70 | 71 | 65 | 66 | 67 |
| ParLed_Deluxe_9_extra | `fixture_1780805067518_parled_deluxe_6` | 74 | 8 | 74–81 | 77 | 78 | 79 | 80 | 74 | 75 | 76 |

> Os `note` de `ParLed_Deluxe_7` ("DMX 57-64") e `ParLed_Deluxe_9` ("DMX 74-81") estao **defasados** — ignore; vale o `startChannel` (49 e 65). Os indices sem alias (`""`) sao indice 0 no `_1` e indice 7 nos demais.

Os 9 ParLeds formam grupo util para chase, wash RGB e simetria.

---

## Moving Heads

Grupo: `Moving Heads`. Universo `0`. Inclui dois Beam (`moving_head_beam`) e um Wosh (`moving_head`).

### Moving Head Beam — atencao a duas particularidades

> **1. Os dois beams NAO tem o mesmo array de canais.** Nunca copie numero de um beam para o outro; resolva por `getChannel(id, alias)`.

> **2. Fallback de alias (so para `fixtureType: moving_head_beam`).** A engine traduz alguns aliases antes de procurar no array: `dimmer` → `dimmer` ou `fecho_lampada`; `speed` → `speed` ou `virtual_speed`; `prism` → `prism` ou `prism_1`; `gobo` → `gobo` ou `gobo_wheel`; `strobo_dimmer` → `strobo_dimmer` ou `strobo`. Use os aliases logicos (`dimmer`, `speed`, `prism`, `gobo`) — funcionam nos dois beams.

> **3. Roteamento por interpolador.** Ambos tem `virtualPanTiltSpeed: true`. Os canais `pan`, `tilt` e `virtual_speed` (alias `speed`) **nao** vao direto ao universo: o compositor os entrega ao interpolador. `speed` define a velocidade da varredura (0 = rapido, 255 = lento) e nunca aparece como DMX cru; `pan`/`tilt` viram alvos perseguidos suavemente. Basta escrever via `SetChannel`/`getChannel`.

> **4. Offsets de pan/tilt sao calibracao fisica e forcados por nome no runtime.** O `main.js` sobrescreve, ao carregar o show: Beam 1 `panOffset = 44`, Beam 2 `panOffset = 0`. O `tilt` segue o show (Beam 1 = 4, Beam 2 = 6). O universo grava `fisico = logico + offset`; ou seja, **escreva valores logicos** de pan/tilt no script (0 = base) — o offset e somado automaticamente. Nao some o offset manualmente. (Detalhe em `runtime-e-padroes.md`.)

Notas: `color_wheel` 0 = branco; `strobo` 255 = aberto (com `dimmer`/`fecho_lampada` em 255); `dimmer` 0 = off / 255 = max; `gobo` 0 = sem gobo.

**Moving Head Beam 1** — id `fixture_1780805067518_moving_head_beam_1` · start 123 · channelCount 16 · DMX 123–138 · `panOffset: 44` · `tiltOffset: 4`

| idx | label real | DMX | alias logico p/ getChannel |
|---:|---|---:|---|
| 0 | color_wheel | 123 | `color_wheel` |
| 1 | strobo | 124 | `strobo` |
| 2 | fecho_lampada | 125 | `dimmer` (fallback) / `fecho_lampada` |
| 3 | gobo_wheel | 126 | `gobo` (fallback) / `gobo_wheel` |
| 4 | prism_1 | 127 | `prism` (fallback) / `prism_1` |
| 5 | prism_1_rotation | 128 | `prism_1_rotation` |
| 6 | virtual_speed | 129 | `speed` (fallback) / `virtual_speed` — **interpolador** |
| 7 | frost | 130 | `frost` |
| 8 | prism_1_rotation_2 | 131 | `prism_1_rotation_2` |
| 9 | pan | 132 | `pan` — **interpolador** |
| 10 | pan_fine | 133 | `pan_fine` |
| 11 | tilt | 134 | `tilt` — **interpolador** |
| 12 | tilt_fine | 135 | `tilt_fine` |
| 13 | special_random | 136 | `special_random` |
| 14 | indefinido | 137 | `indefinido` (sem funcao definida) |
| 15 | reset | 138 | `reset` |

**Moving Head Beam 2** — id `fixture_1780805067518_moving_head_beam_2` · start 203 · channelCount 16 · DMX 203–218 · `tiltOffset: 6`

| idx | label real | DMX | alias logico p/ getChannel |
|---:|---|---:|---|
| 0 | color_wheel | 203 | `color_wheel` |
| 1 | strobo | 204 | `strobo` |
| 2 | fecho_lampada | 205 | `dimmer` (fallback) / `fecho_lampada` |
| 3 | gobo_wheel | 206 | `gobo` (fallback) / `gobo_wheel` |
| 4 | prism_1 | 207 | `prism` (fallback) / `prism_1` |
| 5 | prism_rotation | 208 | `prism_rotation` |
| 6 | virtual_speed | 209 | `speed` (fallback) / `virtual_speed` — **interpolador** |
| 7 | frost | 210 | `frost` |
| 8 | focus | 211 | `focus` |
| 9 | pan | 212 | `pan` — **interpolador** |
| 10 | pan_fine | 213 | `pan_fine` |
| 11 | tilt | 214 | `tilt` — **interpolador** |
| 12 | tilt_fine | 215 | `tilt_fine` |
| 13 | special_random | 216 | `special_random` |
| 14 | reset | 217 | `reset` |
| 15 | (sem alias, `""`) | 218 | — |

**Diferencas (nao espelhar por indice):** Beam 1 tem `prism_1_rotation_2` (131), `indefinido` (137) e `reset` em **138**; Beam 2 tem `focus` (211), `reset` em **217** e o canal 218 sem alias. O par util para movimento espelhado e `pan`/`tilt` via alias.

### Posicionamento fisico — Beam 1 (M1) e Beam 2 (M2)

Mesma trelica das ribaltas, fundo do gride, ~3m acima do altar. **M1 = ponta esquerda, M2 = ponta direita.**

Pan (real): `pan` 0 = feixe na parede do fundo, nao visivel; a partir de ~25 o feixe aparece. M1 parte do 0 na extrema direita e gira **so anti-horario** (~450 graus); M2 gira **horario** (~540 graus, 90 a mais que M1). Frente simetrica usa **pan=84 nos dois**.

| Posicao | M1 (pan/tilt) | M2 (pan/tilt) |
|---|---|---|
| Nivelado pra frente (simetrico) | 84 / 36 | 84 / 32 |
| Fecho na ponta do altar | 84 / 78 | 82 / 72 |
| Fecho pro chao, reto | 84 / 144 | 82 / 125 |
| Lateral (paredes) | 42 / 35 | 44 / 26 |

> Valores de `tilt` sao **provisorios** (a confirmar no rig); `pan` ja reflete o real. Sao orientacao, nao limite.

### Moving Wosh

id `fixture_1780805067518_moving_wosh_01` · start 171 · channelCount 16 · DMX 171–186 · `fixtureType: moving_head`. Modelo `Acme 575W`. Cor por **CMY subtrativo** (nao RGB). **Sem** fallback de alias e **sem** `virtualPanTiltSpeed` (pan/tilt vao direto ao universo).

| idx | label | DMX |
|---:|---|---:|
| 0 | pan | 171 |
| 1 | tilt | 172 |
| 2 | pan_tilt_speed | 173 |
| 3 | strobo | 174 |
| 4 | color_wheel | 175 |
| 5 | cyan | 176 |
| 6 | magenta | 177 |
| 7 | gobo2 | 178 |
| 8 | yellow | 179 |
| 9 | cmy_system | 180 |
| 10 | cmy_speed | 181 |
| 11 | effects_disc | 182 |
| 12 | zoom | 183 |
| 13 | pan_fine | 184 |
| 14 | tilt_fine | 185 |
| 15 | (sem alias, `""`) | 186 |

Branco CMY: cyan/magenta/yellow em 0. Cor saturada por logica subtrativa. Orientacao fisica de pan/tilt do Wosh ainda nao levantada.

---

## Ribaltas

### Ribaltas com tilt

Grupo `Ribaltas`. `fixtureType: ribalta`. Universo `0`. channelCount 13: `tilt, speed, dimmer, led_1..led_8, strobo, function`.

Notas: `led_1..8` em 255 = branco cheio; `dimmer` e mestre (com LEDs em 255 mas `dimmer=0` fica apagado); `strobo` 0 = desligado; `function` 0 = modo DMX manual (manter 0 ao vivo); `speed` inverso (0 = rapido, 255 = lento), manter igual nas duas (par).

**Ribalta_1** — id `fixture_1780805067518_ribalta_1` · start 258 · DMX 258–270 (ESQUERDA / "B")
**Ribalta_2** — id `fixture_1780805067518_ribalta_2` · start 271 · DMX 271–283 (DIREITA / "A")

| idx | label | Ribalta_1 | Ribalta_2 |
|---:|---|---:|---:|
| 0 | tilt | 258 | 271 |
| 1 | speed | 259 | 272 |
| 2 | dimmer | 260 | 273 |
| 3 | led_1 | 261 | 274 |
| 4 | led_2 | 262 | 275 |
| 5 | led_3 | 263 | 276 |
| 6 | led_4 | 264 | 277 |
| 7 | led_5 | 265 | 278 |
| 8 | led_6 | 266 | 279 |
| 9 | led_7 | 267 | 280 |
| 10 | led_8 | 268 | 281 |
| 11 | strobo | 269 | 282 |
| 12 | function | 270 | 283 |

Par esquerda/direita para varredura, ping-pong, chase LED a LED e acentos brancos.

> **`tiltOffset` forcado por nome no runtime:** Ribalta_1 = 23, Ribalta_2 = 3 (o `main.js` define isso ao carregar; o show.json nao traz `tiltOffset` no Ribalta_2). Como nos beams, o universo faz `fisico = logico + offset` — escreva o `tilt` em valor logico.

**Posicionamento — tilt (par, mesma orientacao):** faixa util 90–200; ponto fixo principal 145.

| `tilt` | Posicao / efeito | Uso |
|---:|---|---|
| 90 | Nivelada na horizontal, luz rasante pelo altar. | Louvor / atmosfera. |
| 145 | Aponta pra beirada frontal do altar (pulpito). | **Estatico principal** (pregacao). |
| 200 | Reto pra baixo, cascata atras dos guitarristas. | Cascata/textura central. |
| 255 | Extremo (beirada do painel de LED). | So em movimento de curso completo. |

### Ribaltas RGB estaticas (sem tilt)

`fixtureType: ribalta_rgb_static`. channelCount 6: `dimmer, red, green, blue, strobo, special`. Acende com `dimmer` > 0 + cor; branco = RGB juntos. `special` (efeitos internos por marco) sobrescreve o RGB quando != 0 e independe do `dimmer`.

| Nome | id | start | faixa DMX | dimmer | red | green | blue | strobo | special |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| ribalta-rgb-static_1 | `fixture_1780805067518_ribalta_rgb_static_1` | 284 | 284–289 | 284 | 285 | 286 | 287 | 288 | 289 |
| ribalta-rgb-static_2 | `fixture_1780805067518_ribalta_rgb_static_2` | 290 | 290–295 | 290 | 291 | 292 | 293 | 294 | 295 |
| ribalta-rgb-static_3 | `fixture_1780805067518_ribalta_rgb_static_3` | 296 | 296–301 | 296 | 297 | 298 | 299 | 300 | 301 |
| ribalta-rgb-static_4 | `fixture_1780805067518_ribalta_rgb_static_4` | 302 | 302–307 | 302 | 303 | 304 | 305 | 306 | 307 |

> Marcos do canal `special` estao no banco-de-conhecimento (`ribalta.md`). Em script, use valores exatos de marco; nao calcule faixas.

---

## Mini Bruts

Grupo `Mini Bruts`. `fixtureType: mini_brut`. Halogenos via hack dimmer DMX. channelCount 1: `dimmer` (0 = off, 255 = max). **Patch nao sequencial.**

| Nome | id | start = canal dimmer |
|---|---|---:|
| Mini_Brut_01 | `fixture_1780805067518_mini_brut_01` | 400 |
| Mini_Brut_02 | `fixture_1780805067518_mini_brut_02` | 401 |
| Mini_Brut_03 | `fixture_1780805067518_mini_brut_03` | 402 |
| Mini_Brut_04 | `fixture_1780805067518_mini_brut_04` | 410 |

> **Enderecamento confirmado por Dan: 400 / 401 / 402 / 410** (os `startChannel` do show). Os campos `note` de cada fixture trazem numeros diferentes (409/402/401/410) — estao **defasados, ignore-os**. A ordem DMX e crescente (400, 401, 402, 410); para um chase, confira so qual fixture esta em qual posicao fisica no palco.

---

## Fita LED

id `fixture_1780805067518_fita_led` · start 404 · channelCount 1 · canal `dimmer` (404). `fixtureType: fita_led`. Dimmer-only; sem cor/strobo/movimento. Util para impacto de brilho ou preenchimento.

---

## Fixtures inativos (`enabled: false`) — NAO usar

| Nome | id | enabled | observacao |
|---|---|---|---|
| parLed1 | `fixture_1780805067518` | false | Fixture de teste (casa). Layout `[dimmer, strobo, '', '', red, green, blue, white]`, start 1. |

Por que existe: e um fixture de teste de bancada, mantido no patch mas desativado para a igreja. `getChannel('fixture_1780805067518', ...)` retorna **`null`** (filtro de `enabled`). Ele declara os canais 1–8, **os mesmos** do `ParLed_Deluxe_1` (ativo). Como o `_1` esta ativo e ocupa 1–8, o filtro de canais desabilitados **nao** bloqueia 1–8 — entao nao ha conflito de saida; apenas nao se deve enderecar este id. Nenhum script deve referenciar `parLed1`.

---

Nenhum fixture fora deste catalogo deve ser tratado como ativo sem um novo show de Dan.
