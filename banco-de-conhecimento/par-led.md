# Par LED Deluxe — Banco de Conhecimento
Banco de conhecimento dos Par LEDs: cores primárias, secundárias, dimmer, strobo, modo e speed.
## Visão Geral
9 fixtures do mesmo modelo (Par LED Deluxe), 8 canais cada, comportamento idêntico.
Diferem apenas no startChannel. Todos têm **7 canais funcionais** — 1 canal morto por fixture.

> **ParLed_Deluxe_4** está com `enabled: false` no show — fora de escopo; não usar canais DMX 25–32.

## Fixtures no Patch
|Nome           |Start|Canais|Canal morto (abs)          |
|---------------|-----|------|---------------------------|
|ParLed_Deluxe_1|1    |8     |canal 1 — índice 1 (morto) |
|ParLed_Deluxe_2|9    |8     |canal 16 — índice 8 (morto)|
|ParLed_Deluxe_3|17   |8     |canal 24 — índice 8 (morto)|
|ParLed_Deluxe_4|25   |8     |— (desativado, enabled:false) |
|ParLed_Deluxe_5|33   |8     |canal 40 — índice 8 (morto)|
|ParLed_Deluxe_6|41   |8     |canal 48 — índice 8 (morto)|
|ParLed_Deluxe_7|49   |8     |canal 56 — índice 8 (morto)|
|ParLed_Deluxe_8|57   |8     |canal 64 — índice 8 (morto)|
|ParLed_Deluxe_9|65   |8     |canal 72 — índice 8 (morto)|

## Mapa de Canais (índice relativo ao fixture, base 1)
|Índice|Alias      |ParLed_1 abs|ParLed_2 abs|Função                          |
|------|-----------|------------|------------|--------------------------------|
|1     |"" (morto) |1           |—           |Sem função. Apenas no ParLed_1. |
|2     |macro      |2           |10          |Modo/função especial (ver §A)   |
|3     |color_wheel|3           |11          |Seleção de cor estática (ver §B)|
|4     |speed      |4           |12          |Velocidade do macro e do strobo |
|5     |dimmer     |5           |13          |Intensidade geral 0–255         |
|6     |red        |6           |14          |Vermelho 0–255                  |
|7     |green      |7           |15          |Verde 0–255                     |
|8     |blue       |8           |16          |Azul 0–255                      |
|—     |"" (morto) |—           |16          |Sem função. ParLed_2–9 apenas.  |

Fórmula canal absoluto para ParLed_2 a 9:
canal_abs = startChannel + (índice - 2)
Ex: ParLed_Deluxe_3 (start=17) → macro=18, color_wheel=19, speed=20, dimmer=21, red=22, green=23, blue=24

## §A — Canal MACRO (índice 2)
Ativa modos internos do firmware. Depende do canal SPEED estar > 0 para ser visível.
Quanto maior o SPEED, mais rápida a execução. Usar SPEED=255 para auditar.

|Faixa DMX|Comportamento                                                           |
|---------|------------------------------------------------------------------------|
|0–10     |Sem função / apagado                                                    |
|11–50    |Branco estático (não muda, independe do SPEED)                          |
|51–100   |Sequência automática de cores com fade — ciclo §A.1                     |
|101–200  |Sequência automática de cores com fade — ciclo §A.2                     |
|201–255  |Sequência automática de cores com strobo (cada cor pisca antes de mudar)|

MACRO=255 + SPEED=255 → paleta de cores em velocidade máxima com strobo contínuo.

### §A.1 Sequência fade (MACRO 51–100)
Hardcoded no firmware, repete em loop:
vermelho → verde → azul → amarelo → azul claro → roxo → branco →
amarelo → roxo → vermelho → azul claro → verde → azul escuro →
amarelo → roxo → azul escuro → branco → (reinicia)

### §A.2 Sequência fade (MACRO 101–200)
Hardcoded no firmware, repete em loop:
azul claro → roxo → vermelho → azul claro → azul escuro →
roxo → branco → amarelo → verde → branco → roxo → vermelho → (reinicia)

## §B — Canal COLOR_WHEEL (índice 3)
Seleciona cor estática quando MACRO=11. SPEED não afeta cor estática.
Para cor estática: MACRO=11, COLOR_WHEEL=valor abaixo, SPEED=0.

|Valor DMX|Cor              |
|---------|-----------------|
|40       |Vermelho         |
|50       |Verde            |
|60       |Azul escuro      |
|70       |Amarelo          |
|80       |Azul claro (cyan)|
|90       |Roxo             |
|100      |Branco           |
|110      |Amarelo          |
|120      |Roxo             |
|130      |Branco + Vermelho|
|140      |Azul claro       |
|150      |Branco + Verde   |
|160      |Branco + Azul    |

Valores entre os listados não foram auditados — podem produzir transições.
Valores abaixo de 40 não foram mapeados.
Para strobo em cor específica: MACRO=255, COLOR_WHEEL=valor, SPEED=255.

## §C — Canal SPEED (índice 4)
0 = função do MACRO invisível. 1–255 = velocidade crescente. 255 = máximo.
Controla tanto a velocidade das sequências (§A) quanto a frequência do strobo.

## Exemplos de Script
```js
// Vermelho estático — ParLed_Deluxe_1
SetChannel(2, 11);   // macro: cor estática
SetChannel(3, 40);   // color_wheel: vermelho
SetChannel(4, 0);    // speed: 0
SetChannel(5, 255);  // dimmer

// Sequência de cores fade — ParLed_Deluxe_1
SetChannel(2, 80);   // macro: ciclo §A.1
SetChannel(3, 0);    // color_wheel: sem cor fixa
SetChannel(4, 255);  // speed: máximo
SetChannel(5, 255);  // dimmer

// Strobo azul claro — ParLed_Deluxe_1
SetChannel(2, 255);  // macro: modo strobo
SetChannel(3, 80);   // color_wheel: azul claro
SetChannel(4, 255);  // speed: máximo
SetChannel(5, 255);  // dimmer

// Apagar — ParLed_Deluxe_1
SetChannel(2, 0);
SetChannel(3, 0);
SetChannel(4, 0);
SetChannel(5, 0);
```

## Quirks
- Canal 1 do ParLed_Deluxe_1 é morto: não enviar valores.
- Canal 8 (último) dos ParLed_Deluxe_2–9 é morto: não enviar valores.
- MACRO sem SPEED > 0 não produz efeito visual.
- Canais red/green/blue (índices 6–8) não foram auditados — comportamento RGB padrão esperado.
- Sequências §A.1 e §A.2 são hardcoded no firmware: não é possível reordenar as cores via DMX.
- LEDs físicos do ParLed_Deluxe_1 podem estar parcialmente queimados — protocolo idêntico aos demais.
