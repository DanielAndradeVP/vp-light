# Relatório — Escopo atual dos Movings (vp-light)

Mapeamento completo do endereçamento, lógica, canais DMX, valores e comportamentos dos moving heads no projeto vp-light. O contexto está espalhado por **quatro camadas** (patch/show, documentação, engine/runtime e scripts) mais uma **quinta camada paralela** (viewer 3D), e há divergências entre elas que precisam ser resolvidas.

---

## 1. Fixtures de moving no projeto

Existem três fixtures de moving no patch (`shows/vp.show.json`):

| Fixture | id | Start CH | Canais | Range DMX | Perfil |
|---|---|---|---|---|---|
| Moving Head Beam 1 (M1) | `fixture_1780805067518_moving_head_beam_1` | 123 | 16 | 123–138 | Magic Dazzle MD-MH702 (beam) |
| Moving Head Beam 2 (M2) | `fixture_1780805067518_moving_head_beam_2` | 203 | 16 | 203–218 | Magic Dazzle MD-MH702 (beam) |
| Moving_Wosh | `fixture_1780805067518_moving_wosh_01` | 171 | 16 | 171–186 | Wash CMY (perfil distinto) |

Calibração física gravada no show por fixture:

| Fixture | panOffset | tiltOffset | virtualPanTiltSpeed |
|---|---|---|---|
| M1 | **40** | **4** | true |
| M2 | (nenhum → 0) | **6** | true |
| Wosh | 0 | 0 | (nulo — não usa speed virtual) |

---

## 2. Arquivos envolvidos e responsabilidade de cada um

O endereçamento e o comportamento dos movings estão distribuídos assim:

**Fonte de verdade do endereçamento (patch)**
- `shows/vp.show.json` — patch real: `id`, `startChannel`, array `channels[]` (aliases por canal), `panOffset`/`tiltOffset`/`virtualPanTiltSpeed`. É a única fonte que os scripts consultam via `getChannel(id, alias)`.

**Documentação**
- `banco-de-conhecimento/moving.md` — tabela de canais, posições pan/tilt medidas no rig, comportamento de pan (M1 anti-horário 450°, M2 horário 540°), quirks. **Está parcialmente desatualizada** (ver seção 6).

**Engine / runtime (main process do Electron)**
- `electron/fixtureOffsets.js` — resolve `panOffset`/`tiltOffset` por fixture. Regras por nome estão **desativadas** (`FIXTURE_OFFSET_RULES = {}`); a fonte única de offset é o `show.json`. Flag `TESTE_ZERO_OFFSET` (hoje `false`) zera todos os offsets no palco para calibração manual.
- `electron/engine/interpolator.js` — pan/tilt suave para fixtures com `virtualPanTiltSpeed:true`. O canal `virtual_speed` **não vai ao DMX**: alimenta o interpolador, que avança `current → target` a cada tick (40 ms). `speed` alto = movimento mais lento (`effectiveSpeed = 255 - speed`).
- `electron/engine/compositor.js` — composição por camadas (cada script é uma camada com buffer próprio), mescla **HTP** por padrão (vence o maior `buffer × weight`), roteia canais: `virtual_speed → setSpeed`, `pan/tilt controlado → setTarget`. Também aplica o **scene lock**.
- `electron/engine/universe.js` — `setChannel` **soma o offset** antes de gravar (físico = lógico + offset, clamped 0–255). É aqui que o `panOffset`/`tiltOffset` do moving vira ângulo físico real.
- `electron/main.js` — cola tudo: `initializeOffsets()` monta o mapa de offset e configura o interpolador (`buildInterpolatorConfig` lê `virtualPanTiltSpeed` e localiza `virtual_speed`/`pan`/`tilt`); `buildMovingHeadSceneLockState` cria o **lock de cor/prisma** dos movings; `setDmxChannelRuntime` roteia canais virtuais/controlados.

**Scripts de efeito (contrato OnStart/OnExecute/OnTerminate)**
- `scripts/mov-preset.js` — biblioteca compartilhada concatenada no topo de todo `mov-*.js`: posições `MP_M1`/`MP_M2`, separação `MP_MH_GAP=8`, velocidade `MP_MH_SPEED_SLOW=210`, helpers de ribalta. **Também embute um efeito F10 completo** (keyframes + OnStart/OnExecute/OnTerminate).
- `scripts/mov-traj-mh-rib.js`, `mov-traj-rib-alto.js`, `mov-traj-rib-baixo.js` — trajetórias de 8 fases (varreduras pan/tilt amplas 0–255).
- `scripts/mov-desc-branco.js`, `mov-desc-mh-brut.js`, `mov-desc-full-reset.js`, `mov-desc-rib-reset.js`, `mov-desc-seq-fade.js`, `mov-desc-sync-loop.js` — descidas (tilt frente → altar) com reset escondido.
- `scripts/backlog/movings/*` (`mov-padrao-01`, `mov-padrao-base`, `movings-sincronizados`) — **arquivados**; o `script:list` ignora, mas macros ainda os referenciam (ver seção 6).

**Camada paralela — viewer 3D (renderer React, NÃO é a engine)**
- `src/viewer3d/fixtures/movinghead.js` — interpretação visual: `fecho_lampada` binário (liga só em 255), `pan 0–255 → -270°..+270°`, `tilt 0–255 → -135°..+103°`, e a **única tabela color_wheel → cor** do projeto (0=branco, 10=vermelho, 20=verde, …).
- `src/viewer3d/scene.js` — tem um **mapa de canais hard-coded** (`MOVING_HEAD_BEAM_CHANNELS`) com os números absolutos (M1 colorWheel:123, fecho:125, pan:132, tilt:134 / M2 203/205/212/214), independente do patch. Aplica `panOffsetDeg=-90` e `panSign=-1` no M2.

---

## 3. Mapa de canais (layout de 16 canais dos Beams)

Offset relativo ao `startChannel` (M1 = 123, M2 = 203). Aliases **conforme o `show.json`** (a documentação diverge — ver seção 6):

| Índice | Alias M1 (show.json) | CH M1 | Alias M2 (show.json) | CH M2 |
|---|---|---|---|---|
| 1  | color_wheel | 123 | color_wheel | 203 |
| 2  | strobo | 124 | strobo | 204 |
| 3  | fecho_lampada | 125 | fecho_lampada | 205 |
| 4  | gobo_wheel | 126 | gobo_wheel | 206 |
| 5  | prism_1 | 127 | prism_1 | 207 |
| 6  | prism_1_rotation | 128 | prism_rotation | 208 |
| 7  | virtual_speed | 129 | virtual_speed | 209 |
| 8  | frost | 130 | frost | 210 |
| 9  | **prism_1_rotation_2** | 131 | **focus** | 211 |
| 10 | pan | 132 | pan | 212 |
| 11 | pan_fine | 133 | pan_fine | 213 |
| 12 | tilt | 134 | tilt | 214 |
| 13 | tilt_fine | 135 | tilt_fine | 215 |
| 14 | special_random | 136 | special_random | 216 |
| 15 | **indefinido** | 137 | **reset** | 217 |
| 16 | **reset** | 138 | (vazio) | 218 |

Canais efetivamente usados pelos scripts: `color_wheel`, `strobo`, `fecho_lampada`, `prism_1`, `virtual_speed`, `pan`, `pan_fine`, `tilt`. Todos existem nos dois Beams, então os scripts resolvem sem erro. Os canais divergentes (`focus`, `prism_1_rotation_2`, `indefinido`, `reset`) **não são usados** pelos scripts atuais.

### Moving_Wosh (CMY — perfil próprio)
`pan 171, tilt 172, pan_tilt_speed 173, strobo 174, color_wheel 175, cyan 176, magenta 177, gobo2 178, yellow 179, cmy_system 180, cmy_speed 181, effects_disc 182, zoom 183, pan_fine 184, tilt_fine 185`. **Nenhum script usa o Wosh**, ele não tem `virtualPanTiltSpeed`, e o viewer 3D o exclui explicitamente. Orientação pan/tilt nunca foi levantada.

---

## 4. Como CH + valor viram comportamento (fluxo de execução)

1. **Script** chama `SetChannel(canal, valor)` com o valor **lógico** (0–255), sempre resolvendo o canal por `getChannel(id, alias)` no `OnStart` (nunca número cru — confirmado: zero `SetChannel(<número>)` nos `mov-*`).
2. **Compositor** mescla as camadas (HTP) e, ao escrever cada canal, decide o roteamento:
   - `virtual_speed` (CH 129/209) → `interpolator.setSpeed` — **não vai ao DMX**, só ajusta a suavidade.
   - `pan`/`tilt` (CH 132/134 e 212/214) → `interpolator.setTarget` — vira **alvo**, não valor imediato.
   - qualquer outro canal → `universe.setChannel` direto.
3. **Interpolador** (`tick()` a cada 40 ms) avança pan/tilt de `current` para `target` com passo proporcional a `255 - speed`, e escreve via `universe.setChannel`.
4. **Universe** soma `panOffset`/`tiltOffset` do fixture → valor **físico** no buffer → Art-Net.

Regra prática: pan/tilt **nunca teleportam** (passam pelo interpolador); cor, prisma, fecho, strobo são imediatos. `virtual_speed` controla a velocidade do movimento, não um canal físico.

### Comportamento de pan/tilt documentado (moving.md)
- **Frente simétrica = pan 84 nos dois** (não usar offset fixo calculado; usar posições medidas).
- M1 parte da extrema direita e gira **anti-horário até 450°**; M2 gira **horário até 540°** — cursos diferentes; movimentos simétricos precisam compensar, não espelhar valor a valor.
- Feixe só aparece a partir de **pan ~25**; em pan 0 bate na parede do fundo.
- Tilt dos Beams é **provisório** (ainda não conferido no rig).
- `fecho_lampada = 0` apaga independente de pan/tilt/cor → zerar no `OnTerminate`.

### Posições base (medidas no rig — em `moving.md` e parcialmente em `MP_M1`/`MP_M2`)
| Posição | M1 pan/tilt | M2 pan/tilt |
|---|---|---|
| Nivelado frente (simétrico) | 84 / 36 | 84 / 32 |
| Fecho na ponta do altar | 84 / 78 | 82 / 72 |
| Fecho no chão em linha reta | 84 / 144 | 82 / 125 |
| Lateral (paredes da igreja) | 42 / 35 | 44 / 26 |

### Scene lock (cor/prisma)
`buildMovingHeadSceneLockState` (main.js) trava, por cena ativa, apenas os canais `color_wheel` e `prism_*` dos movings: uma cena pode fixar a cor/prisma e os scripts **não conseguem sobrescrever**. Na prática os scripts escrevem `color_wheel=0`/`prism=0` todo frame, então há uma disputa silenciosa entre cena e script nesses canais.

---

## 5. Associação a F-keys e macros (show.json)

| Tecla | Script | Observação |
|---|---|---|
| F4 | **mov-preset** | O próprio preset rodando como efeito (header dele diz "Destino: F10") |
| F5 | mov-desc-branco | |
| F6 | mov-desc-full-reset | |
| F7 | mov-desc-rib-reset | |
| F8 | mov-traj-mh-rib | |
| F9 | mov-traj-rib-alto | |
| F10 | mov-traj-rib-baixo | |
| F11 | mov-desc-seq-fade | |
| F12 | mov-desc-sync-loop | |

Macros definidas (`macros[]`): `teste-0101` referencia `mov-padrao-01..04`; `teste020202` referencia `brut-forte`, `brut-padrao-01/03`, `mov-padrao-01`. **Vários desses scripts não existem** (só `mov-padrao-01` está no backlog; `02/03/04` não existem em lugar nenhum) — macros quebradas.

---

## 6. Pontos que precisam ser corrigidos, centralizados ou documentados

### A. Endereçamento duplicado em 3+ fontes (centralizar — prioridade alta)
Os números de canal vivem em: (1) `show.json` (patch), (2) `moving.md` (doc) e (3) `scene.js` **hard-coded** (`MOVING_HEAD_BEAM_CHANNELS` com 123/125/132/134…). Se o patch mudar de endereço, o **viewer 3D quebra silenciosamente** e a doc fica mentindo. O 3D deveria resolver os canais a partir do patch (como os scripts fazem via alias), não hard-coded.

### B. moving.md desatualizada vs patch real (documentar/corrigir)
- A doc afirma que "ambos os Beams têm o mesmo layout de 16 canais" — **falso**: no índice 9 o M1 é `prism_1_rotation_2` e o M2 é `focus`; o `reset` está em posições diferentes (M1 no CH 138, M2 no CH 217), e o M1 tem um `indefinido` no CH 137. A doc lista `reset` no 137 para o M1 — divergente do patch (138).
- A doc menciona só `panOffset` (Beam 1 = 40, Beam 2 = 0), mas o patch tem **tiltOffset 4 (M1) e 6 (M2)** não documentados.
- Aliases inconsistentes entre M1/M2 no próprio patch (`prism_1_rotation` vs `prism_rotation`) — padronizar.

### C. Posição de "estacionamento" (OnTerminate) inconsistente entre scripts
- `mov-desc-*` zeram pan e tilt (`pan=0`, `tilt=0`).
- `mov-traj-*` e `mov-preset` estacionam em `PAN_L` / `TILT_MID`.
Resultado: parar um efeito deixa os movings em posições diferentes conforme qual efeito rodou. Definir **uma posição-home única** (idealmente no preset) e usar em todos.

### D. Preset acumula duas responsabilidades (refatorar)
`mov-preset.js` é biblioteca **e** um efeito F10 completo ao mesmo tempo (define `OnStart/OnExecute/OnTerminate`). Como é concatenado no topo de todo `mov-*.js`, ele depende de o `OnExecute` do arquivo-alvo sobrescrever o do preset via hoisting — frágil. Além disso o header diz "Destino: F10" mas ele está amarrado ao **F4**, e o F10 é outro script. Separar a biblioteca (só helpers/constantes) do efeito.

### E. Valores no preset sem lastro na doc (documentar/confirmar no rig)
`MP_M1.PAN_R=120`, `MP_M1.TILT_MID=110`, `MP_M2.TILT_MID=100`, `MP_M2.PAN_R=44`/`PAN_L=50` não aparecem na tabela de posições medidas. Como o próprio `moving.md` avisa que **não existe offset fixo** e que os cursos de pan de M1 (450°) e M2 (540°) são diferentes, o espelhamento simples `mh.pan ± MP_MH_GAP` usado em F10/trajetórias **contraria a orientação da doc** para movimentos simétricos. Confirmar esses valores no rig e/ou documentar como aproximações.

### F. Macros quebradas (corrigir)
`macros[]` no show referencia scripts inexistentes/arquivados (`mov-padrao-02/03/04`, `brut-forte`, `brut-padrao-*`). Recriar os scripts, reapontar para os atuais, ou remover as macros de teste.

### G. Tabela color_wheel → cor só existe no 3D (centralizar/documentar)
O mapeamento de valor de `color_wheel` para cor (0=branco, 10=vermelho, …90=ciano) só está em `movinghead.js`. Os scripts sempre usam `color_wheel=0` (branco) e não há tabela central de cores dos movings. Documentar no banco de conhecimento e, se útil, expor via preset para os scripts.

### H. Moving_Wosh subintegrado (documentar/decidir escopo)
Tem mapa de canais documentado mas: nenhum script o usa, não entra no interpolador (`virtualPanTiltSpeed` nulo), o 3D o ignora e a orientação pan/tilt nunca foi medida. Decidir se entra no escopo ou fica explicitamente fora.

### I. Calibração de tilt provisória
O tilt físico é "provisório" na doc; o 3D já recalibrou o teto visual para 103° (`TILT_MAX_DEG`). Antes de fixar cenas estáticas críticas, conferir tilt no rig e alinhar doc + `MP_*` + 3D.

---

## 7. Resumo do escopo atual

Os movings hoje são **dois beams idênticos em uso** (M1/M2), controlados por scripts que resolvem canais por alias a partir do patch, com pan/tilt suavizados por um interpolador via `virtual_speed` e offset físico somado na saída. O comportamento está **funcional e consistente na camada de scripts** (sem canais crus, com `OnTerminate` zerando fecho/strobo). Os riscos concentram-se na **falta de centralização**: endereçamento repetido em três lugares (com o 3D hard-coded), documentação desatualizada em relação ao patch, posição-home divergente entre scripts, o preset acumulando papéis, macros apontando para scripts que não existem, e o Moving_Wosh sem integração. Nada disso quebra a operação atual dos Beams, mas cada divergência é um ponto de falha silenciosa quando o patch ou o rig mudarem.
