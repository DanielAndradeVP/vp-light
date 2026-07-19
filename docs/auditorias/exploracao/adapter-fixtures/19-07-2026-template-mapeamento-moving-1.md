# Template de mapeamento físico — Moving Head Beam 1

**Para preencher hoje à noite, durante o teste físico do Moving 1.**
Este documento não altera nenhum arquivo do sistema — é só para registrar os valores medidos. Depois de preenchido, ele vira a entrada de dados de `docs/auditorias/exploracao/adapter-fixtures/19-07-2026-auditoria-completa-adapter-capabilities-fixtures.md` (seção 12) e alimenta o `fixture.adapters` do Moving Head 1 em `shows/vp.show.json`.

## Como testar sem risco

- Mude **um canal por vez** e espere o efeito estabilizar antes de mudar o próximo.
- Para pan/tilt: comece sempre pelo **centro conhecido** (ver linha "Frente" na tabela de posições, já medida para o Moving 2) e vá em passos pequenos (10-20 em 10-20) até achar os limites — não pule direto para 0 ou 255.
- Para color wheel/gobo/prism: gire devagar em passos de 5-10 e anote onde CADA transição de cor/gobo/prism acontece, não só o "meio" da faixa.
- Se algo parecer mecanicamente forçado (ruído de motor, batida no fim de curso), pare e anote em "Observações" — não insista no mesmo valor.
- Não é necessário (nem recomendado) testar strobo em velocidade máxima por período prolongado.
- Este teste é 100% local/físico — nenhuma dessas anotações precisa ou deve ser testada via transmissão Art-Net fora do ambiente já em uso normal do operador.

---

## Identificação da fixture (já confirmado no código — não preencher)

| Campo | Valor |
|---|---|
| ID | `fixture_1780805067518_moving_head_beam_1` |
| Nome | Moving Head Beam 1 |
| Start channel | 123 |
| Canais declarados | 16 (nota: array de aliases tem 17 entradas — inconsistência já registrada na auditoria) |
| Offsets já aplicados pelo sistema | `panOffset: 40`, `tiltOffset: 4` (não precisa compensar manualmente — o sistema já soma isso depois) |

---

## Tabela 1 — Canal a canal (mapa geral)

| Canal rel. | Canal abs. | Nome do alias (já no show.json) | Valor mínimo | Valor máximo | Valor de repouso | Valor seguro | Inversão? | Comportamento observado | Observações |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 123 | `color_wheel` | | | | | | | ver Tabela 2 |
| 2 | 124 | `strobo` | | | | | | | ver Tabela 3 |
| 3 | 125 | `fecho_lampada` (dimmer) | | | | | | | |
| 4 | 126 | `gobo_wheel` | | | | | | | ver Tabela 4 |
| 5 | 127 | `prism_1` | | | | | | | ver Tabela 5 |
| 6 | 128 | `prism_1_rotation` | | | | | | | ver Tabela 5 |
| 7 | 129 | `virtual_speed` | — (canal virtual, não sai DMX) | — | — | — | — | — | Já funciona hoje; não precisa medir |
| 8 | 130 | `frost` | | | | | | | |
| 9 | 131 | `prism_1_rotation_2` | | | | | | | confirmar se é realmente um 2º canal de rotação ou resquício |
| 10 | 132 | `pan` | | | | | | | ver Tabela 6 |
| 11 | 133 | `pan_fine` | | | | | | | opcional — só se for usar 16-bit |
| 12 | 134 | `tilt` | | | | | | | ver Tabela 6 |
| 13 | 135 | `tilt_fine` | | | | | | | opcional — só se for usar 16-bit |
| 14 | 136 | `special_random` | | | | | | | |
| 15 | 137 | `indefinido` | | | | | | | confirmar se tem função real ou é canal morto |
| 16 | 138 | `reset` | | | | | | | qual valor dispara reset? volta sozinho a 0? |

---

## Tabela 2 — Color wheel (canal absoluto 123)

Preencha o valor exato testado. Se notar que a cor "segura" numa faixa maior que um único número, preencha também início/fim da faixa.

| Nome semântico | Nome em português | Início da faixa | Fim da faixa | Valor recomendado | Resultado físico | Estabilidade (segura/instável na borda) | Observação |
|---|---|---|---|---|---|---|---|
| `open_white` | Aberto / branco | | | | | | |
| `red` | Vermelho | | | | | | |
| `green` | Verde | | | | | | |
| `blue` | Azul | | | | | | |
| `yellow` | Amarelo | | | | | | |
| `orange` | Laranja | | | | | | |
| `cyan` | Ciano | | | | | | |
| `magenta` | Magenta | | | | | | |
| (outras cores encontradas) | | | | | | | |
| `split` | Cores divididas (split color), se existir | | | | | | |
| `rotation` | Rotação do color wheel, se existir | | | | | | |
| `rotation_speed` | Velocidade da rotação, se existir | | | | | | |

> Referência do Moving 2 já medida pelo operador (não copiar direto para o Moving 1 — os valores DMX quase certamente serão diferentes; serve só de guia de quantas cores esperar): branco 0, vermelho 10, amarelo 20, roxo médio 30, verde 40, azul escuro 50, branco gelo 60, âmbar 70/120, branco amarelado 80, laranja 90, roxo escuro 100, azul claro 110, amarelo 2 130, roxo claro 140.

---

## Tabela 3 — Strobe/shutter (canal absoluto 124)

| Estado | Início da faixa | Fim da faixa | Valor recomendado | Resultado físico | Estabilidade | Observação |
|---|---|---|---|---|---|---|
| Fechado (obturador fechado) | | | | | | |
| Aberto (sem strobo) | | | | | | |
| Strobo lento | | | | | | |
| Strobo médio | | | | | | |
| Strobo rápido | | | | | | |
| Strobo aleatório (se existir) | | | | | | |
| Outras faixas encontradas | | | | | | |

---

## Tabela 4 — Gobo (canal absoluto 126)

| Nome semântico | Início da faixa | Fim da faixa | Valor recomendado | Resultado físico (descrição do gobo) | Shake? | Rotação/indexação | Estabilidade | Observação |
|---|---|---|---|---|---|---|---|---|
| `open` (sem gobo) | | | | | | | | |
| `gobo_1` | | | | | | | | |
| `gobo_2` | | | | | | | | |
| `gobo_3` | | | | | | | | |
| (continuar conforme quantidade real do gobo wheel) | | | | | | | | |
| `shake` | | | | | | | | |
| `rotation` | | | | | | | | |
| `rotation_speed` | | | | | | | | |

---

## Tabela 5 — Prism (canais absolutos 127 = ativação, 128 = rotação, 131 = ?)

| Estado | Início da faixa | Fim da faixa | Valor recomendado | Resultado físico | Estabilidade | Observação |
|---|---|---|---|---|---|---|
| Off (prisma desligado) | | | | | | |
| On (prisma ligado) | | | | | | |
| Tipo/nº de faces do prisma | | | | (descrever quantas faces/facetas aparentam) | | |
| Rotação sentido horário | | | | | | |
| Rotação sentido anti-horário | | | | | | |
| Velocidade de rotação — lenta | | | | | | |
| Velocidade de rotação — rápida | | | | | | |
| Canal 131 (`prism_1_rotation_2`) — função real | | | | | | confirmar se é 2º prisma, refinamento de rotação, ou canal morto |

---

## Tabela 6 — Movimento (pan/tilt, canais absolutos 132/134, fine 133/135)

⚠️ Teste pan/tilt em passos pequenos. Não force até o fim de curso repetidamente.

| Referência | Valor pan | Valor tilt | Observação |
|---|---|---|---|
| Pan mínimo (limite físico seguro) | | | |
| Pan centro | | | |
| Pan máximo (limite físico seguro) | | | |
| Tilt mínimo (limite físico seguro) | | | |
| Tilt centro | | | |
| Tilt máximo (limite físico seguro) | | | |
| Posição "Frente" (mesma referência usada no Moving 2: pan 84 / tilt 32-36) | | | comparar com M2 para checar simetria do rig |
| Posição "Altar" (M2: pan 82 / tilt 72) | | | |
| Posição "Chão" (M2: pan 82 / tilt 125) | | | |
| Posição "Lateral" (M2: pan 44 / tilt 26) | | | |
| Zona morta / folga mecânica perceptível | | | |
| Inversão de pan (sentido horário/anti-horário em relação ao M2) | | | M2 gira horário; confirmar se M1 gira anti-horário como já suposto na documentação |
| `pan_fine`/`tilt_fine` — testar se realmente refina a posição ou é canal sem efeito perceptível | | | só relevante se for implementar 16-bit |
| `movement_speed` (via `virtual_speed`) — já funciona hoje | — | — | não precisa medir; o sistema já usa isso |

---

## Observações finais livres

(espaço para qualquer comportamento inesperado, ruído, necessidade de recalibração, diferença notada em relação ao Moving 2, etc.)

```



```
