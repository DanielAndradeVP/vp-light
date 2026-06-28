Banco de conhecimento das Ribaltas RGB: acender, cores primárias, secundárias e especial.

# Ribaltas — Banco de Conhecimento

## Visão Geral

Fabricante: Light Party. Modelo: Ribalta.
Barra de LEDs com 8 células independentes, tilt motorizado, dimmer mestre, strobo e função especial.
Duas unidades com tilt no patch: Ribalta_1 e Ribalta_2 — par, mesma orientação de tilt.
Cores obtidas por ativação seletiva das 8 células — cada célula é um canal independente.
Todos os LEDs em 255 = branco cheio. Combinações produzem cores e efeitos.

> **Fora de escopo:** `ribalta-rgb-static_1` … `_4` existem no `vp.show.json` com `enabled: false`. Não documentar, não referenciar em scripts/cenas e não usar canais DMX 284–307.

## Posição Física (Ribalta_1 e Ribalta_2)

Centro da treliça do fundo do gride, parte traseira do altar, aproximadamente 3 metros de altura.
As duas formam um par e compartilham a mesma orientação de tilt.

## Orientação de Tilt — valores de referência (canal `tilt`)

> Estes são pontos de orientação para quem programa, não limites rígidos. Outros valores de tilt
> podem e devem ser usados conforme o efeito; o que está abaixo é o mapa dos pontos mais úteis.
> **Faixa útil: 90 a 200.** O **145 é o ponto fixo mais importante**. O 255 só faz sentido em movimento.

| Tilt | Posição / efeito | Uso |
|------|------------------|-----|
| 90   | Ribalta nivelada na horizontal. Maior impacto visual — luz rasante pelo altar, abre o ambiente, cria profundidade. | Posição principal para **louvor** e momentos de atmosfera. Abaixo de 90 perde ângulo bom — só para explorar movimento, não parar aqui. |
| 145  | Aponta para a beirada frontal do altar — cai exatamente sobre o púlpito. | **Posição principal de uso estático.** Ilumina ministro / pastor / púlpito. Usar em pregação. |
| 200  | Apontada reto para baixo (vertical). Efeito de cascata atrás dos guitarristas, no centro do altar. Fica a ~1 palmo do painel de LED — não atrapalha, mas o reflexo no painel deixa visualmente forte. | Cascata / textura no centro. |
| 255  | Extremo do curso — aponta para a beirada superior do painel de LED. Fica feio parada. | **Sem uso estático.** Só em movimentos que exploram o curso completo do tilt. |

Ribalta_1 e Ribalta_2 usam a mesma orientação. Pequenas diferenças por unidade podem exigir um
ajuste fino de ~5 DMX no tilt de uma delas para alinhar fisicamente — calibrar no rig.

## Fixtures no Patch

| Nome      | Posição | Start Ch | Canais | DMX Range | Tilt estático principal |
|-----------|---------|----------|--------|-----------|-------------------------|
| Ribalta_1 | Par     | 258      | 13     | 258–270   | 145 (ver Orientação de Tilt) |
| Ribalta_2 | Par     | 271      | 13     | 271–283   | 145 (ver Orientação de Tilt) |

## Mapa de Canais — Ribalta_1 e Ribalta_2 (13 canais)

| Índice | Alias    | DMX 0           | Faixa útil          | DMX 255          | Observações                            |
|--------|----------|-----------------|---------------------|------------------|----------------------------------------|
| 1      | tilt     | posição mínima  | 90–200 (145 estático) | posição máxima | Mover sempre com speed ajustado        |
| 2      | speed    | máximo rápido   | sugestão: 90        | mínimo lento     | 0=mais rápido, 255=mais lento          |
| 3      | dimmer   | apagado         | —                   | 100% intensidade | Mestre global — afeta todas as células |
| 4–11   | led_1…led_8 | célula off   | —                   | célula 100%      | LED individual por canal               |
| 12     | strobo   | strobo off      | 40–80 lento / 180–255 rápido | strobo rápido | 0=desligado                     |
| 13     | function | modo normal (0) | —                   | programa máximo  | 0=controle DMX manual; evitar >0 ao vivo |

## Valores Importantes

- **Branco cheio:** dimmer=255, led_1 a led_8 todos=255
- **Apagar:** todos os 13 canais = 0
- **Posicionar (sem mover bruscamente):** definir speed antes de alterar tilt. Speed igual nas duas.
- **Tilt de louvor (rasante):** tilt=90
- **Tilt estático principal (púlpito/pregação):** tilt=145
- **Tilt cascata (vertical no centro):** tilt=200
- **Strobo lento:** strobo=40–80 — **Strobo rápido:** strobo=180–255 — **off:** strobo=0
- **Modo DMX manual:** function=0 (sempre manter 0 para controle via script)

## Canais DMX Absolutos

### Ribalta_1 (start=258)
tilt=258, speed=259, dimmer=260, led_1=261, led_2=262, led_3=263, led_4=264, led_5=265, led_6=266, led_7=267, led_8=268, strobo=269, function=270

### Ribalta_2 (start=271)
tilt=271, speed=272, dimmer=273, led_1=274, led_2=275, led_3=276, led_4=277, led_5=278, led_6=279, led_7=280, led_8=281, strobo=282, function=283

## Uso em Scripts DMX

```js
// Ribalta_1 e Ribalta_2 — branco cheio no tilt estático principal (145, púlpito)
SetChannel(259, 90);  // speed (igual nas duas)
SetChannel(258, 145); // tilt estático principal
SetChannel(260, 255); // dimmer mestre
for (let ch = 261; ch <= 268; ch++) SetChannel(ch, 255); // led_1..led_8

SetChannel(272, 90);  // speed Ribalta_2
SetChannel(271, 145); // tilt
SetChannel(273, 255); // dimmer
for (let ch = 274; ch <= 281; ch++) SetChannel(ch, 255); // led_1..led_8
```

```js
// Tilt de louvor (rasante, horizontal) — abre o ambiente
SetChannel(259, 90); SetChannel(258, 90); // Ribalta_1
SetChannel(272, 90); SetChannel(271, 90); // Ribalta_2
```

```js
// Apagar ambas as Ribaltas (OnTerminate)
for (let ch = 258; ch <= 270; ch++) SetChannel(ch, 0); // Ribalta_1
for (let ch = 271; ch <= 283; ch++) SetChannel(ch, 0); // Ribalta_2
```

## Comportamentos e Quirks

- **Faixa útil de tilt = 90 a 200.** 145 é o ponto estático principal (púlpito); 90 é louvor (rasante); 255 só em movimento.
- **Speed igual nas duas:** são um par — speed diferente faz uma chegar antes da outra e o movimento fica assimétrico. Sugestão inicial: 90.
- **Tilt+speed antes de ligar LEDs:** evita movimento visível durante a cena.
- **Speed é inverso:** DMX 0 = mais rápido; DMX 255 = mais lento.
- **Dimmer é mestre nas Ribalta_1/2:** com led_1–8 em 255, se dimmer=0 o fixture fica apagado.
- **function=0 sempre nas Ribalta_1/2:** valores > 0 ativam modos automáticos que ignoram o DMX. Nunca enviar > 0 ao vivo.
- **Strobo=0 = off:** sempre zerar no OnTerminate para não deixar strobo ativo entre cenas.
