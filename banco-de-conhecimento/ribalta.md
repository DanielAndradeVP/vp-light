Banco de conhecimento das Ribaltas RGB: acender, cores primárias, secundárias e especial.

# Ribaltas — Banco de Conhecimento

## Visão Geral

Fabricante: Light Party. Modelo: Ribalta.
Barra de LEDs com 8 células independentes, tilt motorizado, dimmer mestre, strobo e função especial.
Duas unidades no patch: Ribalta_1 (esquerda/B) e Ribalta_2 (direita/A), com tilt de repouso diferente.
Cores obtidas por ativação seletiva das 8 células — cada célula é um canal independente.
Todos os LEDs em 255 = branco cheio. Combinações produzem cores e efeitos.

Também existem 4 unidades ribalta-rgb-static (estáticas, sem tilt) com 6 canais cada: dimmer, RGB, strobo e special.

## Fixtures no Patch

| Nome                  | Posição   | Start Ch | Canais | DMX Range | Tilt Funcional | Speed Funcional |
|-----------------------|-----------|----------|--------|-----------|----------------|-----------------|
| Ribalta_1             | Esquerda  | 258      | 13     | 258–270   | 110            | 90              |
| Ribalta_2             | Direita   | 271      | 13     | 271–283   | 105            | 90              |
| ribalta-rgb-static_1  | Static 1  | 284      | 6      | 284–289   | —              | —               |
| ribalta-rgb-static_2  | Static 2  | 290      | 6      | 290–295   | —              | —               |
| ribalta-rgb-static_3  | Static 3  | 296      | 6      | 296–301   | —              | —               |
| ribalta-rgb-static_4  | Static 4  | 302      | 6      | 302–307   | —              | —               |

## Mapa de Canais — Ribalta_1 e Ribalta_2 (13 canais)

Ordem física dos canais (índice 1-based relativo ao startChannel):

| Índice | Alias    | DMX 0               | Valor funcional       | DMX 255            | Observações                            |
|--------|----------|---------------------|-----------------------|--------------------|----------------------------------------|
| 1      | tilt     | posição mínima      | R1=110 / R2=105       | posição máxima     | Mover sempre com speed ajustado        |
| 2      | speed    | máximo rápido       | sugestão: 90          | mínimo lento       | 0=mais rápido, 255=mais lento; ajustar conforme a cena |
| 3      | dimmer   | apagado             | —                     | 100% intensidade   | Mestre global — afeta todas as células |
| 4      | led_1    | célula 1 off        | —                     | célula 1 100%      | LED individual                         |
| 5      | led_2    | célula 2 off        | —                     | célula 2 100%      | LED individual                         |
| 6      | led_3    | célula 3 off        | —                     | célula 3 100%      | LED individual                         |
| 7      | led_4    | célula 4 off        | —                     | célula 4 100%      | LED individual                         |
| 8      | led_5    | célula 5 off        | —                     | célula 5 100%      | LED individual                         |
| 9      | led_6    | célula 6 off        | —                     | célula 6 100%      | LED individual                         |
| 10     | led_7    | célula 7 off        | —                     | célula 7 100%      | LED individual                         |
| 11     | led_8    | célula 8 off        | —                     | célula 8 100%      | LED individual                         |
| 12     | strobo   | strobo off          | —                     | strobo rápido      | 0=desligado; qualquer valor > 0 ativa  |
| 13     | function | modo normal (0)     | —                     | programa máximo    | 0=controle DMX manual; evitar >0 ao vivo |

## Mapa de Canais — ribalta-rgb-static (6 canais)

| Índice | Alias   | DMX 0      | DMX 255        | Observações                                      |
|--------|---------|------------|----------------|--------------------------------------------------|
| 1      | dimmer  | apagado    | 100%           | Mestre — necessário para RGB funcionar           |
| 2      | red     | off        | vermelho 100%  | Requer dimmer > 0                                |
| 3      | green   | off        | verde 100%     | Requer dimmer > 0                                |
| 4      | blue    | off        | azul 100%      | Requer dimmer > 0                                |
| 5      | strobo  | off        | strobo rápido  | 0=desligado                                      |
| 6      | special | off (0–5)  | —              | Independente do dimmer; sobrescreve RGB quando ativo |

## Valores Importantes

### Ribalta_1 e Ribalta_2
- **Branco cheio:** dimmer=255, led_1 a led_8 todos=255
- **Apagar:** todos os 13 canais = 0
- **Posicionar (sem mover bruscamente):** definir speed antes de alterar tilt
  - Ribalta_1: speed=?(sugestão: 90), tilt=110
  - Ribalta_2: speed=?(sugestão: 90), tilt=105
- **Strobo desligado:** strobo=0
- **Strobo lento:** strobo=40–80
- **Strobo rápido:** strobo=180–255
- **Modo DMX manual:** function=0 (sempre manter 0 para controle via script)

### ribalta-rgb-static
- **Acender RGB:** dimmer > 0 + pelo menos um canal de cor (red/green/blue) > 0
- **Branco manual:** dimmer=255, red=255, green=255, blue=255
- **Vermelho:** dimmer=255, red=255, green=0, blue=0
- **Verde:** dimmer=255, red=0, green=255, blue=0
- **Azul:** dimmer=255, red=0, green=0, blue=255
- **Apagar:** todos os 6 canais = 0
- **Special ativo:** sobrescreve RGB; dimmer não é necessário

## Canais DMX Absolutos

### Ribalta_1 (start=258)

| Canal DMX | Alias    |
|-----------|----------|
| 258       | tilt     |
| 259       | speed    |
| 260       | dimmer   |
| 261       | led_1    |
| 262       | led_2    |
| 263       | led_3    |
| 264       | led_4    |
| 265       | led_5    |
| 266       | led_6    |
| 267       | led_7    |
| 268       | led_8    |
| 269       | strobo   |
| 270       | function |

### Ribalta_2 (start=271)

| Canal DMX | Alias    |
|-----------|----------|
| 271       | tilt     |
| 272       | speed    |
| 273       | dimmer   |
| 274       | led_1    |
| 275       | led_2    |
| 276       | led_3    |
| 277       | led_4    |
| 278       | led_5    |
| 279       | led_6    |
| 280       | led_7    |
| 281       | led_8    |
| 282       | strobo   |
| 283       | function |

### ribalta-rgb-static (6 canais cada)

| Fixture               | dimmer | red | green | blue | strobo | special |
|-----------------------|--------|-----|-------|------|--------|---------|
| ribalta-rgb-static_1  | 284    | 285 | 286   | 287  | 288    | 289     |
| ribalta-rgb-static_2  | 290    | 291 | 292   | 293  | 294    | 295     |
| ribalta-rgb-static_3  | 296    | 297 | 298   | 299  | 300    | 301     |
| ribalta-rgb-static_4  | 302    | 303 | 304   | 305  | 306    | 307     |

## Canal 6 (special) — 21 Marcos

Gap 149–159 é reservado/indefinido (não é um marco controlável). Special=0 desativa o canal.

| Valor  | Marco | Comportamento                                                                                   |
|--------|-------|-------------------------------------------------------------------------------------------------|
| 0–5    | 1     | Off — sem cor; controle RGB via canais 2-4 ativo                                                |
| 6–16   | 2     | Vermelho sólido                                                                                 |
| 17–27  | 3     | Verde sólido                                                                                    |
| 28–38  | 4     | Azul sólido                                                                                     |
| 39–49  | 5     | Amarelo sólido                                                                                  |
| 50–60  | 6     | Roxo sólido                                                                                     |
| 61–71  | 7     | Azul claro sólido                                                                               |
| 72–82  | 8     | Branco sólido                                                                                   |
| 83–93  | 9     | Chase 3 LEDs — 7 cores em sequência: vermelho, verde, azul, amarelo, azul claro, roxo, branco   |
| 94–104 | 10    | Chase 5 LEDs — mesma sequência de 7 cores                                                       |
| 105–114| 11    | Chase 10 LEDs — mesma sequência de 7 cores                                                      |
| 115–126| 12    | Acende 3 LEDs progressivos mantendo anteriores acesos, inverte no azul — 7 cores em sequência   |
| 127–137| 13    | Encontro de LEDs do centro — 3 do início + 3 do final convergindo — 7 cores em sequência        |
| 138–148| 14    | Padrão duplo — convergência ao centro + chase linear 3 LEDs — cor branca                        |
| 160–181| 15    | Base fraca de cor + 3 LEDs fortes em sequência de cores alternadas: vermelho/verde, verde/azul, azul/vermelho, vermelho/azul claro, verde/roxo, azul/amarelo |
| 182–192| 16    | Pulso vermelho-fogo: vermelho dominante + traço de verde, intensidade sobe e desce              |
| 193–203| 17    | Pulso verde: intensidade sobe e desce                                                           |
| 204–214| 18    | Pulso azul escuro: intensidade sobe e desce                                                     |
| 215–225| 19    | Pulso roxo: intensidade sobe e desce                                                            |
| 226–236| 20    | Pulso amarelo: intensidade sobe e desce                                                         |
| 237–255| 21    | Sequência de pulsos — percorre as 5 cores acima em cadeia, transicionando quando a cor atual chega perto do zero |

## Uso em Scripts DMX

```js
// Acender Ribalta_1 em branco cheio na posição funcional
SetChannel(259, 90);  // speed — sugestão; ajustar conforme a cena
SetChannel(258, 110); // tilt funcional
SetChannel(260, 255); // dimmer mestre
SetChannel(261, 255); SetChannel(262, 255); SetChannel(263, 255); SetChannel(264, 255);
SetChannel(265, 255); SetChannel(266, 255); SetChannel(267, 255); SetChannel(268, 255);

// Acender Ribalta_2 em branco cheio na posição funcional
SetChannel(272, 90);  // speed — sugestão; usar o mesmo valor da Ribalta_1
SetChannel(271, 105); // tilt funcional
SetChannel(273, 255); // dimmer mestre
SetChannel(274, 255); SetChannel(275, 255); SetChannel(276, 255); SetChannel(277, 255);
SetChannel(278, 255); SetChannel(279, 255); SetChannel(280, 255); SetChannel(281, 255);
```

```js
// Apagar ambas as Ribaltas (OnTerminate)
for (let ch = 258; ch <= 270; ch++) SetChannel(ch, 0); // Ribalta_1
for (let ch = 271; ch <= 283; ch++) SetChannel(ch, 0); // Ribalta_2
```

```js
// ribalta-rgb-static_1: acender em vermelho via RGB
SetChannel(284, 255); // dimmer
SetChannel(285, 255); // red
SetChannel(286, 0);   // green
SetChannel(287, 0);   // blue

// ribalta-rgb-static_1: efeito special (marco 4 — azul sólido, valor 30)
SetChannel(284, 0);   // dimmer não importa para special
SetChannel(285, 0); SetChannel(286, 0); SetChannel(287, 0); // RGB zerado
SetChannel(289, 30);  // special — azul sólido (marco 4, faixa 28-38)
```

```js
// Apagar todas as ribalta-rgb-static
for (let ch = 284; ch <= 307; ch++) SetChannel(ch, 0);
```

```js
// Strobo nas ribalta-rgb-static (branco + strobo)
SetChannel(284, 255); // dimmer R-S1
SetChannel(285, 255); SetChannel(286, 255); SetChannel(287, 255); // RGB branco
SetChannel(288, 120); // strobo velocidade média
```

## Comportamentos e Quirks

- **Speed igual nas duas:** são um par — speed diferente faz uma chegar antes da outra e o movimento fica assimétrico. O valor exato fica a critério da cena; sugestão inicial: 90.
- **Tilt antes de ligar LEDs:** enviar tilt+speed antes de acionar células evita movimento visível durante a cena.
- **Speed é inverso:** DMX 0 = mais rápido; DMX 255 = mais lento.
- **Dimmer é mestre nas Ribalta_1/2:** com led_1–8 em 255, se dimmer=0 o fixture fica apagado.
- **function=0 sempre nas Ribalta_1/2:** valores > 0 ativam modos automáticos que ignoram controle DMX. Nunca enviar > 0 ao vivo.
- **Special independe do dimmer:** nas ribalta-rgb-static, o canal special funciona mesmo com dimmer=0.
- **Special sobrescreve RGB:** quando special > 5, os canais red/green/blue são ignorados. Zerar special para retornar ao controle RGB.
- **Gap 149–159 no canal special:** este intervalo não produz efeito controlável. Evitar.
- **Strobo=0 = off:** sempre zerar no OnTerminate para não deixar strobo ativo entre cenas.
