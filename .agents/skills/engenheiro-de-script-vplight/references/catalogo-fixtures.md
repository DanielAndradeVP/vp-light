# Catalogo de fixtures - estado conhecido do show atual

Fonte de verdade operacional pedida para esta skill: `vp.show.light`. Neste checkout, o arquivo de show disponivel para derivacao foi `shows/vp.show.json`; nao invente nada que nao esteja no show atual fornecido pelo usuario.

Use estes `id` e `label` ao escrever scripts. Prefira sempre `getChannel(id, label)` ao numero cru. O numero DMX abaixo existe para conferencia, auditoria e casos em que o usuario pedir explicitamente um canal sem alias.

## Regra de enderecamento

Canal DMX real = `startChannel + indice no array channels`.
Labels vazias (`""`) aparecem como **sem alias**. Elas nao devem ser usadas com `getChannel`; use o numero cru somente se o usuario pedir explicitamente aquele canal.

---

## ParLed Deluxe

Grupo: `ParLed Deluxe`. Fabricante: `Generico`. Modelo: `ParLed Deluxe`. Universo: `0`.
Observacoes confirmaveis: fixtures RGB com `dimmer`, `red`, `green`, `blue`. Labels `pending_label_*` existem no show e podem ser usadas por `getChannel`, mas indicam canais ainda nao identificados; evite usa-las em efeito artistico salvo pedido explicito.

### ParLed_Deluxe_1
- id: `fixture_1780805067518_parled_deluxe_1`
- startChannel: `1`
- channelCount: `8`
- faixa DMX: `1-8`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 1 |
| 1 | pending_label_2 | 2 |
| 2 | pending_label_3 | 3 |
| 3 | pending_label_4 | 4 |
| 4 | dimmer | 5 |
| 5 | red | 6 |
| 6 | green | 7 |
| 7 | blue | 8 |

### ParLed_Deluxe_2
- id: `fixture_1780805067518_parled_deluxe_2`
- startChannel: `9`
- channelCount: `8`
- faixa DMX: `9-16`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 9 |
| 1 | pending_label_2 | 10 |
| 2 | pending_label_3 | 11 |
| 3 | dimmer | 12 |
| 4 | red | 13 |
| 5 | green | 14 |
| 6 | blue | 15 |
| 7 | pending_label_8 | 16 |

### ParLed_Deluxe_3
- id: `fixture_1780805067518_parled_deluxe_3`
- startChannel: `17`
- channelCount: `8`
- faixa DMX: `17-24`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 17 |
| 1 | pending_label_2 | 18 |
| 2 | pending_label_3 | 19 |
| 3 | dimmer | 20 |
| 4 | red | 21 |
| 5 | green | 22 |
| 6 | blue | 23 |
| 7 | pending_label_8 | 24 |

### ParLed_Deluxe_4
- id: `fixture_1780805067518_parled_deluxe_4`
- startChannel: `25`
- channelCount: `8`
- faixa DMX: `25-32`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 25 |
| 1 | pending_label_2 | 26 |
| 2 | pending_label_3 | 27 |
| 3 | dimmer | 28 |
| 4 | red | 29 |
| 5 | green | 30 |
| 6 | blue | 31 |
| 7 | pending_label_8 | 32 |

### ParLed_Deluxe_5
- id: `fixture_1780805067518_parled_deluxe_5`
- startChannel: `33`
- channelCount: `8`
- faixa DMX: `33-40`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 33 |
| 1 | pending_label_2 | 34 |
| 2 | pending_label_3 | 35 |
| 3 | dimmer | 36 |
| 4 | red | 37 |
| 5 | green | 38 |
| 6 | blue | 39 |
| 7 | pending_label_8 | 40 |

### ParLed_Deluxe_6
- id: `fixture_1780805067518_parled_deluxe_6`
- startChannel: `49`
- channelCount: `8`
- faixa DMX: `49-56`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 49 |
| 1 | pending_label_2 | 50 |
| 2 | pending_label_3 | 51 |
| 3 | dimmer | 52 |
| 4 | red | 53 |
| 5 | green | 54 |
| 6 | blue | 55 |
| 7 | pending_label_8 | 56 |

### ParLed_Deluxe_7
- id: `fixture_1780805067518_parled_deluxe_7`
- startChannel: `57`
- channelCount: `8`
- faixa DMX: `57-64`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 57 |
| 1 | pending_label_2 | 58 |
| 2 | pending_label_3 | 59 |
| 3 | dimmer | 60 |
| 4 | red | 61 |
| 5 | green | 62 |
| 6 | blue | 63 |
| 7 | pending_label_8 | 64 |

### ParLed_Deluxe_8
- id: `fixture_1780805067518_parled_deluxe_8`
- startChannel: `65`
- channelCount: `8`
- faixa DMX: `65-72`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 65 |
| 1 | pending_label_2 | 66 |
| 2 | pending_label_3 | 67 |
| 3 | dimmer | 68 |
| 4 | red | 69 |
| 5 | green | 70 |
| 6 | blue | 71 |
| 7 | pending_label_8 | 72 |

### ParLed_Deluxe_9
- id: `fixture_1780805067518_parled_deluxe_9`
- startChannel: `74`
- channelCount: `8`
- faixa DMX: `74-81`

| indice | label | DMX |
|---:|---|---:|
| 0 | pending_label_1 | 74 |
| 1 | pending_label_2 | 75 |
| 2 | pending_label_3 | 76 |
| 3 | dimmer | 77 |
| 4 | red | 78 |
| 5 | green | 79 |
| 6 | blue | 80 |
| 7 | pending_label_8 | 81 |

Pares e grupos uteis: todos os `ParLed_Deluxe_1..9` formam grupo util para chase, wash RGB e simetria por posicao fisica. A ordem fisica deve ser confirmada quando importar para um efeito espacial, porque o catalogo so confirma patch DMX.

---

## Moving Head Beam

Grupo: `Moving Heads`. Fabricante: `Light Party`. Modelo: `MovingHead_Beam 230W_16channels`. Universo: `0`.
Observacoes confirmaveis: moving beam com pan/tilt, color wheel, strobo, dimmer, gobo, prism, frost, focus, speed, reset e control. Nota do show: color_wheel 0 = branco; strobo 255 = aberto; dimmer 0 = off / 255 = max; gobo 0 = sem gobo; tilt operacional 170-255. O indice 6 e sem alias.

### Moving Head Beam 1
- id: `fixture_1780805067518_moving_head_beam_1`
- startChannel: `123`
- channelCount: `16`
- faixa DMX: `123-138`

| indice | label | DMX |
|---:|---|---:|
| 0 | color_wheel | 123 |
| 1 | strobo | 124 |
| 2 | dimmer | 125 |
| 3 | gobo | 126 |
| 4 | prism | 127 |
| 5 | prism_rotation | 128 |
| 6 | sem alias | 129 |
| 7 | frost | 130 |
| 8 | focus | 131 |
| 9 | pan | 132 |
| 10 | pan_fine | 133 |
| 11 | tilt | 134 |
| 12 | tilt_fine | 135 |
| 13 | speed | 136 |
| 14 | reset | 137 |
| 15 | control | 138 |

### Moving Head Beam 2
- id: `fixture_1780805067518_moving_head_beam_2`
- startChannel: `203`
- channelCount: `16`
- faixa DMX: `203-218`

| indice | label | DMX |
|---:|---|---:|
| 0 | color_wheel | 203 |
| 1 | strobo | 204 |
| 2 | dimmer | 205 |
| 3 | gobo | 206 |
| 4 | prism | 207 |
| 5 | prism_rotation | 208 |
| 6 | sem alias | 209 |
| 7 | frost | 210 |
| 8 | focus | 211 |
| 9 | pan | 212 |
| 10 | pan_fine | 213 |
| 11 | tilt | 214 |
| 12 | tilt_fine | 215 |
| 13 | speed | 216 |
| 14 | reset | 217 |
| 15 | control | 218 |

Pares e grupos uteis: `Moving Head Beam 1` e `Moving Head Beam 2` sao par natural para movimento espelhado, chase de dimmer/strobo, prism e gobo sincronizados.

---

## Ribaltas

Grupo: `Ribaltas`. Fabricante: `Light Party`. Modelo: `Ribalta`. Universo: `0`.
Observacoes confirmaveis: 13 canais com tilt, speed, dimmer, `led_1..led_8`, strobo e function. Nota do show: LEDs 1-8 em 255 = branco cheio; strobe 0 = desligado; special/function 0 = modo normal. `Ribalta_1` e ESQUERDA (B), tilt funcional 110 e speed 190. `Ribalta_2` e DIREITA (A), tilt funcional 105 e speed 90.

### Ribalta_1
- id: `fixture_1780805067518_ribalta_1`
- startChannel: `258`
- channelCount: `13`
- faixa DMX: `258-270`

| indice | label | DMX |
|---:|---|---:|
| 0 | tilt | 258 |
| 1 | speed | 259 |
| 2 | dimmer | 260 |
| 3 | led_1 | 261 |
| 4 | led_2 | 262 |
| 5 | led_3 | 263 |
| 6 | led_4 | 264 |
| 7 | led_5 | 265 |
| 8 | led_6 | 266 |
| 9 | led_7 | 267 |
| 10 | led_8 | 268 |
| 11 | strobo | 269 |
| 12 | function | 270 |

### Ribalta_2
- id: `fixture_1780805067518_ribalta_2`
- startChannel: `271`
- channelCount: `13`
- faixa DMX: `271-283`

| indice | label | DMX |
|---:|---|---:|
| 0 | tilt | 271 |
| 1 | speed | 272 |
| 2 | dimmer | 273 |
| 3 | led_1 | 274 |
| 4 | led_2 | 275 |
| 5 | led_3 | 276 |
| 6 | led_4 | 277 |
| 7 | led_5 | 278 |
| 8 | led_6 | 279 |
| 9 | led_7 | 280 |
| 10 | led_8 | 281 |
| 11 | strobo | 282 |
| 12 | function | 283 |

Pares e grupos uteis: ribaltas esquerda/direita para varredura, ping-pong, chase LED a LED e acentos brancos.

---

## Fita Led

Fabricante: `FitaLedDimmer`. Modelo: `Fita de Led`. Fixture type: `fita_led`.
Observacoes confirmaveis: dimmer-only. O show atual nao define `universe` nem `group` para este fixture.

### Fita_Led
- id: `fixture_1780805067518_fita_led`
- startChannel: `404`
- channelCount: `1`
- faixa DMX: `404-404`

| indice | label | DMX |
|---:|---|---:|
| 0 | dimmer | 404 |

Uso pratico: impacto de brilho ou preenchimento simples; nao ha cor, strobo ou movimento documentado no show.

---

## Mini Bruts

Grupo: `Mini Bruts`. Fabricante: `Generico`. Modelo: `Halogeno (controlado via Hack Dimmer DMX)`. Universo: `0`.
Observacoes confirmaveis: cada fixture tem um unico canal `dimmer`, 0 = off e 255 = max. Sao aparelhos halogenos nao-DMX adaptados via hack dimmer. O patch nao e sequencial na numeracao fisica/nome.

### Mini_Brut_01
- id: `fixture_1780805067518_mini_brut_01`
- startChannel: `400`
- channelCount: `1`
- faixa DMX: `400-400`

| indice | label | DMX |
|---:|---|---:|
| 0 | dimmer | 400 |

### Mini_Brut_02
- id: `fixture_1780805067518_mini_brut_02`
- startChannel: `402`
- channelCount: `1`
- faixa DMX: `402-402`

| indice | label | DMX |
|---:|---|---:|
| 0 | dimmer | 402 |

### Mini_Brut_03
- id: `fixture_1780805067518_mini_brut_03`
- startChannel: `401`
- channelCount: `1`
- faixa DMX: `401-401`

| indice | label | DMX |
|---:|---|---:|
| 0 | dimmer | 401 |

### Mini_Brut_04
- id: `fixture_1780805067518_mini_brut_04`
- startChannel: `410`
- channelCount: `1`
- faixa DMX: `410-410`

| indice | label | DMX |
|---:|---|---:|
| 0 | dimmer | 410 |

Pares e grupos uteis: grupo de impacto/flash dimmer-only. Para chase visual, confirme a ordem fisica; a ordem DMX atual e 400, 401, 402, 410, enquanto os nomes sao 01, 02, 03, 04 se ordenados por canal.

---

## Moving Wosh

Grupo: `Moving Heads`. Fabricante: `Acme`. Modelo: `575W`. Universo: `0`.
Observacoes confirmaveis: moving head de 16 canais com pan/tilt, speed, strobo, color wheel, CMY, gobo2, effects disc, zoom e canais fine. Mistura de cor por CMY subtrativo, nao RGB. Canal DMX 186 esta sem alias porque o perfil recebido nao informou funcao.

### Moving_Wosh
- id: `fixture_1780805067518_moving_wosh_01`
- startChannel: `171`
- channelCount: `16`
- faixa DMX: `171-186`

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
| 15 | sem alias | 186 |

Uso pratico: para branco CMY, mantenha cyan/magenta/yellow em 0. Para cor saturada, use logica subtrativa: vermelho aproximado = magenta + yellow altos e cyan baixo.

---

## Resumo de fixtures ativos

- ParLed Deluxe: `ParLed_Deluxe_1` a `ParLed_Deluxe_9`.
- Moving Heads: `Moving Head Beam 1`, `Moving Head Beam 2`, `Moving_Wosh`.
- Ribaltas: `Ribalta_1`, `Ribalta_2`.
- Dimmer-only: `Fita_Led`, `Mini_Brut_01`, `Mini_Brut_02`, `Mini_Brut_03`, `Mini_Brut_04`.

Nenhum fixture fora desta lista deve ser tratado como ativo sem receber um novo show do usuario.