# Catalogo de fixtures - estado conhecido do show atual

Fonte: `shows/vp.show.json` (Vida e Paz - Show Principal). Nao invente nada que nao esteja no show atual fornecido pelo usuario. Se o usuario disser que mudou patch/labels, peca o show novo antes de gerar script.

Use estes `id` e `label` ao escrever scripts. Prefira sempre `getChannel(id, label)` ao numero cru. O numero DMX abaixo existe para conferencia e para casos em que o usuario pedir explicitamente um canal sem alias.

## Regra de enderecamento

Canal DMX real = `startChannel + indice no array channels`. Labels vazias (`""`) sao **sem alias** — nao usar com `getChannel`. Fixtures desabilitadas (`enabled: false`) retornam `null` no `getChannel` e nao recebem DMX.

> **Atencao a um descasamento id x nome:** o id `..._parled_deluxe_6` pertence a um fixture cujo **nome** e `ParLed_Deluxe_9_extra` (start 74). Os nomes 6 a 9 foram remanejados; sempre confirme o id pelo nome antes de gerar.

---

## ParLed Deluxe

Grupo: `ParLed Deluxe`. Universo: `0`. Fixtures RGB com canais de controle.

**Layout dos canais (mudou — nao ha mais `pending_label`):**
- `ParLed_Deluxe_1` tem layout proprio: `['', macro, color_wheel, speed, dimmer, red, green, blue]` (dimmer no indice 4).
- `ParLed_Deluxe_2` a `9` (e o `_9_extra`) tem: `[macro, color_wheel, speed, dimmer, red, green, blue, '']` (dimmer no indice 3).

`macro`, `color_wheel` e `speed` sao canais de **modo/controle**. Para controle RGB manual via script, mantenha `macro=0`, `color_wheel=0`, `speed=0` e use `dimmer` + `red` + `green` + `blue`. `dimmer` e o mestre de intensidade.

| Nome (show) | id | start | dimmer | red | green | blue | macro | color_wheel | speed |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ParLed_Deluxe_1 | `fixture_1780805067518_parled_deluxe_1` | 1  | 5  | 6  | 7  | 8  | 2  | 3  | 4  |
| ParLed_Deluxe_2 | `fixture_1780805067518_parled_deluxe_2` | 9  | 12 | 13 | 14 | 15 | 9  | 10 | 11 |
| ParLed_Deluxe_3 | `fixture_1780805067518_parled_deluxe_3` | 17 | 20 | 21 | 22 | 23 | 17 | 18 | 19 |
| ParLed_Deluxe_4 | `fixture_1780805067518_parled_deluxe_4` | 25 | 28 | 29 | 30 | 31 | 25 | 26 | 27 |
| ParLed_Deluxe_5 | `fixture_1780805067518_parled_deluxe_5` | 33 | 36 | 37 | 38 | 39 | 33 | 34 | 35 |
| ParLed_Deluxe_7 | `fixture_1780805067518_parled_deluxe_7` | 49 | 52 | 53 | 54 | 55 | 49 | 50 | 51 |
| ParLed_Deluxe_8 | `fixture_1780805067518_parled_deluxe_8` | 57 | 60 | 61 | 62 | 63 | 57 | 58 | 59 |
| ParLed_Deluxe_9 | `fixture_1780805067518_parled_deluxe_9` | 65 | 68 | 69 | 70 | 71 | 65 | 66 | 67 |
| ParLed_Deluxe_9_extra | `fixture_1780805067518_parled_deluxe_6` | 74 | 77 | 78 | 79 | 80 | 74 | 75 | 76 |

Indice 0 do `_1` e indice 7 dos demais sao `""` (sem alias). Todos os 8 ParLeds habilitados formam grupo util para chase, wash RGB e simetria.

> **Desabilitado:** `parLed1` (id `fixture_1780805067518`, start 1, `enabled: false`) compartilha os canais 1-8 com o `ParLed_Deluxe_1`. Nao usar — `getChannel` retorna `null`.

---

## Moving Head Beam

Grupo: `Moving Heads`. Modelo: `MovingHead_Beam 230W_16channels`. Universo: `0`. 16 canais.

Notas do show: `color_wheel` 0 = branco; `strobo` 255 = aberto; `dimmer` 0 = off / 255 = max; `gobo` 0 = sem gobo. Indice 6 e sem alias.

### Moving Head Beam 1 — id `fixture_1780805067518_moving_head_beam_1`, start 123 (123-138)
### Moving Head Beam 2 — id `fixture_1780805067518_moving_head_beam_2`, start 203 (203-218)

Mesmo layout (canal Beam 1 / Beam 2):

| indice | label | Beam 1 | Beam 2 |
|---:|---|---:|---:|
| 0 | color_wheel | 123 | 203 |
| 1 | strobo | 124 | 204 |
| 2 | dimmer | 125 | 205 |
| 3 | gobo | 126 | 206 |
| 4 | prism | 127 | 207 |
| 5 | prism_rotation | 128 | 208 |
| 6 | (sem alias) | 129 | 209 |
| 7 | frost | 130 | 210 |
| 8 | focus | 131 | 211 |
| 9 | pan | 132 | 212 |
| 10 | pan_fine | 133 | 213 |
| 11 | tilt | 134 | 214 |
| 12 | tilt_fine | 135 | 215 |
| 13 | speed | 136 | 216 |
| 14 | reset | 137 | 217 |
| 15 | control | 138 | 218 |

Par natural para movimento espelhado, chase de dimmer/strobo, prism e gobo sincronizados.

### Posicionamento fisico — Moving Head Beam 1 (M1) e Beam 2 (M2)

Mesma treliça das ribaltas, fundo do gride, ~3m acima do altar (altar ~3m de comprimento). **M1 = ponta esquerda, M2 = ponta direita.**

**Pan (comportamento real):**
- `pan` 0 — ambos virados para a parede do fundo; o feixe bate na parede e **nao e visivel**. A partir de `pan` ~25 o feixe aparece. Abaixo de 25 pode nao ver o raio (uso criativo ok; nao pausar aqui esperando ver o feixe).
- **M1** parte do pan 0 na extrema direita e gira **so anti-horario** — curso total ~450 graus.
- **M2** parte do pan 0 e gira **horario** (oposto ao M1, ideal para par) — curso total ~540 graus (90 a mais que o M1). Movimentos simetricos precisam compensar essa diferenca; nao espelhar valor por valor cegamente.
- A frente simetrica usa **pan=84 nos dois** (nao ha modelo de offset fixo).

**Posicoes base medidas (pan / tilt):**

| Posicao | M1 (pan/tilt) | M2 (pan/tilt) |
|---|---|---|
| Nivelado para frente (simetrico) | 84 / 36 | 84 / 32 |
| Fecho na ponta do altar | 84 / 78 | 82 / 72 |
| Fecho apontado pro chao, reto | 84 / 144 | 82 / 125 |
| Lateral (paredes laterais) | 42 / 35 | 44 / 26 |

> **Os valores de `tilt` dos movings sao provisorios** (a confirmar no rig); o `pan` ja reflete o real. Estes valores sao orientacao, nao limite — outros pan/tilt podem ser usados.

**Efeito:** com M1 em pan entre 0 e 82 e tilt no maximo (255), ao aumentar o pan pela primeira vez ate 82 com tilt maximo ele cria a ilusao de "voltar ao ponto zero" — util como remate apos uma rotacao completa.

---

## Ribaltas (com tilt)

Grupo: `Ribaltas`. Modelo: `Ribalta`. Universo: `0`. 13 canais: tilt, speed, dimmer, `led_1..led_8`, strobo, function.

Notas do show: `led_1..8` em 255 = branco cheio; `strobo` 0 = desligado; `function` 0 = modo DMX manual (manter 0 ao vivo). `speed` e inverso (0 = mais rapido, 255 = mais lento); manter igual nas duas (par).

### Ribalta_1 — id `fixture_1780805067518_ribalta_1`, start 258 (258-270)
### Ribalta_2 — id `fixture_1780805067518_ribalta_2`, start 271 (271-283)

| indice | label | Ribalta_1 | Ribalta_2 |
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

`dimmer` e mestre: com `led_1..8` em 255 mas `dimmer=0`, o fixture fica apagado. Par esquerda/direita para varredura, ping-pong, chase LED a LED e acentos brancos.

### Posicionamento fisico — Tilt (Ribalta_1 e Ribalta_2)

Centro da treliça do fundo do gride, ~3m de altura, parte traseira do altar. As duas formam par, mesma orientacao. **Valores de referencia (orientacao, nao limite). Faixa util: 90 a 200. Ponto fixo mais importante: 145.**

| `tilt` | Posicao / efeito | Uso |
|---:|---|---|
| 90  | Nivelada na horizontal. Luz rasante pelo altar, abre o ambiente, da profundidade. | Posicao principal de **louvor**/atmosfera. Abaixo de 90 perde angulo — so para movimento. |
| 145 | Aponta para a beirada frontal do altar — cai no pulpito. | **Estatico principal.** Ilumina ministro/pastor/pulpito (pregacao). |
| 200 | Reto para baixo (vertical). Cascata atras dos guitarristas, centro do altar; reflexo forte no painel de LED. | Cascata/textura central. |
| 255 | Extremo — beirada superior do painel de LED. Feia parada. | Sem uso estatico; so em movimento de curso completo. |

---

## Ribaltas RGB estaticas (sem tilt)

Grupo de 4 ribaltas RGB fixas (sem motor de tilt). 6 canais: `dimmer`, `red`, `green`, `blue`, `strobo`, `special`. `dimmer` > 0 + canal de cor para acender; `special` (efeitos internos por marco zero) sobrescreve o RGB quando != 0 e independe do dimmer.

| Nome | id | start | dimmer | red | green | blue | strobo | special |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ribalta-rgb-static_1 | `fixture_1780805067518_ribalta_rgb_static_1` | 284 | 284 | 285 | 286 | 287 | 288 | 289 |
| ribalta-rgb-static_2 | `fixture_1780805067518_ribalta_rgb_static_2` | 290 | 290 | 291 | 292 | 293 | 294 | 295 |
| ribalta-rgb-static_3 | `fixture_1780805067518_ribalta_rgb_static_3` | 296 | 296 | 297 | 298 | 299 | 300 | 301 |
| ribalta-rgb-static_4 | `fixture_1780805067518_ribalta_rgb_static_4` | 302 | 302 | 303 | 304 | 305 | 306 | 307 |

> Detalhes dos marcos do canal `special` estao no banco-de-conhecimento (`ribalta.md`). Em script, usar valores exatos de marco; nao calcular faixas.

---

## Fita Led

- id: `fixture_1780805067518_fita_led`, start 404, 1 canal: `dimmer` (404). Dimmer-only; sem cor/strobo/movimento. Impacto de brilho ou preenchimento.

---

## Mini Bruts

Grupo: `Mini Bruts`. Halogenos via hack dimmer DMX. 1 canal `dimmer` cada (0 = off, 255 = max). Patch nao sequencial.

| Nome | id | start = canal dimmer |
|---|---|---:|
| Mini_Brut_01 | `fixture_1780805067518_mini_brut_01` | 400 |
| Mini_Brut_02 | `fixture_1780805067518_mini_brut_02` | 401 |
| Mini_Brut_03 | `fixture_1780805067518_mini_brut_03` | 402 |
| Mini_Brut_04 | `fixture_1780805067518_mini_brut_04` | 410 |

Grupo de impacto/flash. Para chase visual, confirmar ordem fisica (ordem DMX e 400, 401, 402, 410).

---

## Moving Wosh

Grupo: `Moving Heads`. Modelo: `Acme 575W`. Universo: `0`. 16 canais, cor por **CMY subtrativo** (nao RGB). Canal 186 sem alias.

- id: `fixture_1780805067518_moving_wosh_01`, start 171 (171-186).

| indice | label | DMX |
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
| 15 | (sem alias) | 186 |

Branco CMY: cyan/magenta/yellow em 0. Cor saturada: logica subtrativa (vermelho aproximado = magenta + yellow altos, cyan baixo). Orientacao fisica de pan/tilt do Wosh ainda nao levantada.

---

## Resumo de fixtures ativos

- **ParLed Deluxe** (RGB, aliases macro/color_wheel/speed/dimmer/red/green/blue): `ParLed_Deluxe_1..5`, `ParLed_Deluxe_7`, `ParLed_Deluxe_8`, `ParLed_Deluxe_9`, `ParLed_Deluxe_9_extra` (este ultimo com id `..._parled_deluxe_6`).
- **Moving Heads (Beam, pan/tilt)**: `Moving Head Beam 1`, `Moving Head Beam 2`.
- **Moving Head (CMY)**: `Moving_Wosh`.
- **Ribaltas com tilt**: `Ribalta_1`, `Ribalta_2`.
- **Ribaltas RGB estaticas**: `ribalta-rgb-static_1..4`.
- **Dimmer-only**: `Fita_Led`, `Mini_Brut_01..04`.
- **Desabilitada (nao usar)**: `parLed1`.

Nenhum fixture fora desta lista deve ser tratado como ativo sem um novo show do usuario.
