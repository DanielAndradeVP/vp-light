# Relatório — Escopo atual dos PAR LED (vp-light)

Mapeamento completo do endereçamento, lógica, canais DMX, valores e comportamento dos **Par LED Deluxe** no projeto vp-light. O contexto está espalhado por quatro camadas (patch/show, documentação, engine/runtime, scripts) mais a camada paralela do viewer 3D. O achado central: **os PAR LED não têm um layout de canais único** — existem dois perfis distintos no patch — e a documentação, o viewer 3D e a biblioteca `fire-base.js` assumem premissas erradas sobre isso.

---

## 1. Fixtures de PAR LED no patch (shows/vp.show.json)

Existem 9 ids `parled_deluxe_*` mais um fixture de teste legado (`parLed1`). Mapa real de ocupação DMX (canais 1–81):

| id / nome | Start | enabled | Layout | Canal morto |
|---|---|---|---|---|
| `..._parled_deluxe_1` / ParLed_Deluxe_1 | 1 | true | **B** | nenhum (8 funcionais) |
| `..._parled_deluxe_2` / ParLed_Deluxe_2 | 9 | (default on) | **A** | índice 8 (CH 16) |
| `..._parled_deluxe_3` / ParLed_Deluxe_3 | 17 | (default on) | **A** | índice 8 (CH 24) |
| `..._parled_deluxe_4` / ParLed_Deluxe_4 | 25 | **false** | A | desativado (25–32 livres) |
| `..._parled_deluxe_5` / ParLed_Deluxe_5 | 33 | (default on) | **B** | nenhum |
| `..._parled_deluxe_6` / **ParLed_Deluxe_10** | **74** | (default on) | **B** | nenhum |
| `..._parled_deluxe_7` / ParLed_Deluxe_7 | 49 | (default on) | **B** | nenhum |
| `..._parled_deluxe_8` / ParLed_Deluxe_8 | 57 | (default on) | **A** | índice 8 (CH 64) |
| `..._parled_deluxe_9` / ParLed_Deluxe_9 | 65 | (default on) | **A** | índice 8 (CH 72) |
| `fixture_1780805067518` / parLed1 (teste "casa") | 1 | **false** | B-like | canais 3–4 vazios |

`isFixtureEnabled` (main.js) = `enabled !== false`, então `enabled` ausente/`null` conta como **ligado**. Só ParLed_4 e o legado parLed1 estão desligados.

**Faixas DMX livres:** 25–32 (ParLed_4 off), 41–48 (nada), 73 (nada). Ativos: 4 fixtures layout A (2,3,8,9) + 4 layout B (1,5,7 e o id `_6` = "10") = 8 PARs ativos.

---

## 2. Os dois layouts de canais (a raiz de tudo)

Mesmo modelo no papel, **dois perfis diferentes** no patch:

**Layout A** — `[macro, color_wheel, speed, dimmer, red, green, blue, "" (morto)]` (fixtures 2, 3, 4, 8, 9)

| Índice | Alias | Ex. ParLed_2 (start 9) |
|---|---|---|
| 1 | macro | 9 |
| 2 | color_wheel | 10 |
| 3 | speed | 11 |
| 4 | dimmer | 12 |
| 5 | red | 13 |
| 6 | green | 14 |
| 7 | blue | 15 |
| 8 | "" (morto) | 16 |

**Layout B** — `[dimmer, strobo, macro, macro_speed, red, green, blue, white]` (fixtures 1, 5, 7, "10")

| Índice | Alias | Ex. ParLed_1 (start 1) |
|---|---|---|
| 1 | dimmer | 1 |
| 2 | strobo | 2 |
| 3 | macro | 3 |
| 4 | macro_speed | 4 |
| 5 | red | 5 |
| 6 | green | 6 |
| 7 | blue | 7 |
| 8 | white | 8 |

Aliases por layout:
- **Comuns aos dois (resolvem sempre):** `dimmer`, `red`, `green`, `blue`, `macro`.
- **Só no layout A:** `color_wheel`, `speed`.
- **Só no layout B:** `strobo`, `macro_speed`, `white`.
- Posição do `dimmer` e do `macro` **muda** entre A e B — por isso qualquer acesso por número de canal fixo é frágil; só o acesso por alias (`getChannel(id, alias)`) é seguro.

---

## 3. Lógica: o que cada CH e valor executa (banco-de-conhecimento/par-led.md)

A doc descreve o comportamento do firmware (válido sobretudo para o layout A, que tem `macro`/`color_wheel`/`speed`):

**Canal MACRO** (ativa modos internos; depende de SPEED > 0 para ser visível):

| Faixa DMX | Comportamento |
|---|---|
| 0–10 | Sem função / RGB direto |
| 11–50 | Branco estático ou cor do `color_wheel` (independe do SPEED) |
| 51–100 | Sequência automática de cores com fade — ciclo §A.1 |
| 101–200 | Sequência automática com fade — ciclo §A.2 |
| 201–255 | Sequência de cores com strobo |

**Canal COLOR_WHEEL** (cor estática quando MACRO=11; SPEED não afeta): 40=vermelho, 50=verde, 60=azul escuro, 70=amarelo, 80=cyan, 90=roxo, 100=branco, 110=amarelo, 120=roxo, 130=branco+vermelho, 140=cyan, 150=branco+verde, 160=branco+azul. Abaixo de 40 não mapeado.

**Canal SPEED**: 0 = efeito do macro invisível; 1–255 = velocidade crescente das sequências e do strobo.

Receitas da doc: cor estática = `macro=11, color_wheel=<cor>, speed=0, dimmer=255`; fade = `macro=80, speed=255`; strobo em cor = `macro=255, color_wheel=<cor>, speed=255`; apagar = tudo 0. **RGB direto** = deixar `macro` ≤ 10 e escrever `red/green/blue`.

As sequências §A.1 e §A.2 são hardcoded no firmware (não reordenáveis por DMX). Canais red/green/blue não foram auditados a fundo (comportamento RGB padrão esperado).

---

## 4. Como os PAR LED são acionados (runtime)

Fluxo idêntico ao restante do rig: script → `SetChannel(canal, valor)` (canal resolvido por `getChannel(id, alias)` no `OnStart`) → compositor mescla camadas em **HTP** → `universe.setChannel` grava no buffer → Art-Net. Diferenças em relação aos movings:

- **Sem offset** e **sem interpolador**: os PAR não têm `pan`/`tilt`/`virtual_speed`, então nenhum canal deles passa por `interpolator` nem por `panOffset`/`tiltOffset`. Valor lógico = valor físico.
- **Sem scene lock**: `buildMovingHeadSceneLockState` trava cor/prisma apenas de `moving_head_beam`; os PAR não são travados por cena.
- **Guard de `enabled`**: canais de ParLed_4 e do parLed1 legado entram em `disabledChannels`; `getChannel` retorna `null` e `SetChannel` é ignorado nesses canais.

Quem escreve nos PAR hoje:
- **`scripts/fire-base.js`** — biblioteca do "pacote-de-scripts-fire". Tem o registro `FB_ID.PAR` com os 9 ids e o resolvedor `fb_par(id)` que pega `dimmer/red/green/blue/white/strobo` por alias (white/strobo viram `null` no layout A e `fb_set` ignora). É a fonte única pretendida de ids/canais.
- **`scripts/backlog/…`** — cenas que usam PAR: `completo-noite-roxa.js`, `completo-oceano-profundo.js`, `aurora-vermelha.js`, `completo-tempestade-roxa.js`, `explosao-dourada.js`, `madrugada-azul.js`, `noite-rosa.js`, `movings/mov-padrao-01.js`. Resolvem `dimmer/red/green/blue` por alias e usam **RGB direto** (não tocam macro). Como estão no `backlog/`, são arquivados e não contam como efeitos ativos.
- **Nenhuma F-key** no `show.json` aponta para script de PAR (F1–F12 são brut/moving). Ou seja, **hoje não há efeito de PAR amarrado a tecla** — só via os scripts do backlog / pacote fire.

`modo.js` alterna produção/desenvolvimento ligando/desligando ParLed_Deluxe_1 (igreja) vs parLed1 (teste "casa"), que compartilham os canais 1–8.

---

## 5. Camada paralela — viewer 3D

- **`src/viewer3d/fixtures/parled.js`** interpreta o macro/color_wheel/speed exatamente como a doc (§A.1/§A.2 hardcoded como arrays RGB, `COLOR_WHEEL_STOPS` interpolado, strobo 2–20 Hz) e cai em **RGB direto** quando `macro ≤ 10` ou `speed = 0`.
- **`src/viewer3d/scene.js`** tem o mapa `PARLED_CHANNELS` com números absolutos por fixture. O comentário diz corretamente que "os layouts NÃO são uniformes… mapa por fixtureId", **mas os valores foram preenchidos como se todos fossem layout A** — o que está errado para os fixtures de layout B. Exemplos:
  - ParLed_1 (layout B): real `dimmer=1`; o mapa usa `dimmer:5` (que é o `red` real) e inventa `macro:2/color_wheel:3/speed:4`.
  - ParLed_5 (start 33): `macro:30/color_wheel:31/speed:32` caem **fora** da faixa do fixture (na faixa do ParLed_4 desativado); `dimmer:33` acerta por coincidência.
  - ParLed_7 (start 49): `dimmer:49` **e** `macro:49` apontam para o mesmo canal.
  - Fixture `_6` ("10", start 74): `dimmer:77` (na verdade `macro_speed`), quando o dimmer real é 74.
  - Corretos: ParLed_2, 3, 8, 9 (layout A) e o 4 desativado.

Resultado: **a prévia 3D dos PAR de layout B (1, 5, 7, "10") lê canais errados** e não modela strobo/white.

---

## 6. Pontos a corrigir, centralizar ou documentar

### A. Documentação desatualizada — prioridade alta (`par-led.md`)
- Afirma "9 fixtures do mesmo modelo, 8 canais cada, comportamento idêntico, diferem só no startChannel" e um layout único. **Falso**: há dois layouts (A e B). Documentar os dois perfis e quais fixtures usam cada um.
- Diz que ParLed_1 tem canal morto no índice 1. **Falso**: ParLed_1 é layout B, 8 canais funcionais (dimmer…white), sem canal morto.
- A tabela de starts (…41, 49, 57, 65) não bate: **não há fixture em 41–48**; o "6º" fixture é o id `parled_deluxe_6` nomeado **"ParLed_Deluxe_10"** em **start 74**.
- Layout B tem `strobo`, `macro_speed` e `white` — nenhum documentado.

### B. Nomenclatura / identidade confusa do fixture `_6` (corrigir)
O id `fixture_1780805067518_parled_deluxe_6` tem `name` "ParLed_Deluxe_10" e vive em 74, longe da sequência. id, nome e endereço contam três histórias diferentes. Padronizar id↔nome↔posição.

### C. Mapa 3D `PARLED_CHANNELS` errado para layout B (corrigir/centralizar)
Preenchido assumindo layout A. Deve ser derivado do patch (por alias, como os scripts fazem) em vez de números escritos à mão — senão a prévia mente e qualquer remapeamento de canal quebra em silêncio. Faltam também `strobo`/`white` no modelo visual.

### D. Comentário invertido em `fire-base.js` (corrigir)
`fb_par` diz "white/strobo só existem no layout A → null no layout B". É o **inverso**: `white`/`strobo` existem no **layout B**; no layout A é que retornam `null`. Sem impacto funcional (o `fb_set` ignora `null`), mas induz a erro quem for editar.

### E. Dois perfis de hardware conviverem (decidir/documentar)
Metade dos PAR usa `macro/color_wheel/speed` (layout A) e metade usa `dimmer/strobo/macro/macro_speed/white` (layout B). Efeitos que dependam de `color_wheel`/`speed` **não funcionam** nos de layout B, e efeitos de `strobo`/`white` não existem no layout A. Para efeitos uniformes no rig inteiro, o denominador comum seguro é **RGB direto + dimmer** (macro = 0). Documentar isso como regra de projeto — é o que os scripts do backlog já fazem na prática.

### F. Endereços livres / legado (documentar)
25–32 (ParLed_4 off), 41–48 e 73 estão livres — registrar como reserva ou realocar. O fixture legado `parLed1` (off) sobrepõe 1–8 do ParLed_Deluxe_1; a troca é feita por `modo.js`. Deixar isso explícito na doc para não parecer conflito de patch.

### G. Sem efeito de PAR em F-key (decidir)
Nenhuma tecla aciona PAR isoladamente hoje; o uso vem de cenas completas no `backlog/`. Se PAR sozinho precisa de acionamento ao vivo, criar um `par-*.js` ativo e amarrar a uma F-key.

---

## 7. Resumo do escopo atual

Os PAR LED são **8 fixtures ativos de um mesmo modelo, mas com dois perfis DMX diferentes** (4 em layout A com `color_wheel/speed`, 4 em layout B com `strobo/macro_speed/white`), acessados com segurança por alias via `getChannel`. Na camada de hardware/engine tudo funciona: os scripts usam o subconjunto comum (dimmer + RGB, RGB direto), sem offset, sem interpolador e sem scene lock. **Os problemas são de consistência e documentação**, não de operação: a base de conhecimento descreve um layout único que não existe; o mapa do viewer 3D está errado para os fixtures de layout B (prévia mente); a `fire-base.js` tem um comentário invertido; e há ruído de identidade/endereço (o "ParLed_Deluxe_10" em 74, canais livres em 41–48, o legado parLed1 sobreposto). Centralizar a fonte de verdade no patch (por alias), atualizar a doc com os dois perfis e derivar o mapa 3D do próprio show resolveria a maior parte dos riscos silenciosos.
