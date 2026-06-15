Banco de conhecimento dos Moving Heads: pan, tilt, orientação zero, cores, gobo, prisma, foco, strobo, speed, modo e especial.

# Moving Heads — Banco de Conhecimento

## Fixtures no Patch

| Nome               | Start Channel | Canais | DMX Range |
|--------------------|---------------|--------|-----------|
| Moving Head Beam 1 | 123           | 16     | 123–138   |
| Moving_Wosh        | 171           | 16     | 171–186   |
| Moving Head Beam 2 | 203           | 16     | 203–218   |

## Posição Física (Moving Head Beam 1 e Beam 2)

Mesma treliça das ribaltas, fundo do gride, aproximadamente 3 metros acima do altar. O altar tem
cerca de 3 metros de comprimento.

- **Moving Head Beam 1 (M1):** ponta **esquerda** da treliça.
- **Moving Head Beam 2 (M2):** ponta **direita** da treliça.

## Orientação de Pan e Tilt — valores de referência

> Pontos de orientação para programar, não limites rígidos. Outros valores de pan/tilt podem e
> devem ser usados conforme o efeito. **Os valores de tilt abaixo são provisórios** (ainda serão
> conferidos no rig, como foi feito com as ribaltas); o pan já reflete o comportamento real.

### Pan — comportamento geral

- **Pan 0:** ambos os movings virados para a parede do fundo. O fecho de luz **não é visível** (bate direto na parede). A partir de **pan 25** o fecho começa a aparecer. Abaixo de 25 o raio pode não ser visível — não impede uso criativo, apenas não pausar aqui esperando ver o feixe.
- **M1:** parte do pan 0 na **extrema direita** e gira **somente no sentido anti-horário**. Rotação total de **450 graus** até o limite.
- **M2:** parte do pan 0 e gira no **sentido horário** — oposto ao M1, ideal para trabalho em par. Rotação total de **540 graus** (90 graus a mais que o M1). **Atenção redobrada nisso em movimentos simétricos:** o curso de pan dos dois não é igual.

> Não existe um "offset fixo" de pan entre os dois; a frente simétrica usa **pan=84 nos dois**.
> Use a tabela de posições base abaixo (valores medidos no rig), não um cálculo de offset.

### Posições base (medidas)

| Posição                                   | M1 (pan / tilt) | M2 (pan / tilt) |
|-------------------------------------------|-----------------|-----------------|
| Nivelado para frente (simétrico)          | 84 / 36         | 84 / 32         |
| Fecho na ponta do altar                   | 84 / 78         | 82 / 72         |
| Fecho apontado pro chão, em linha reta    | 84 / 144        | 82 / 125        |
| Lateral (paredes laterais da igreja)      | 42 / 35         | 44 / 26         |

### Observação de efeito

Quando o **M1** está com pan entre 0 e 82 e tilt no máximo (255), ao aumentar o pan pela primeira
vez até 82 com tilt máximo ele cria um efeito visual como se estivesse **voltando ao ponto zero** —
útil como efeito de movimento após uma rotação completa.

## Mapa de Canais — Moving Head Beam 1 e Beam 2

Ambos os Beams têm o mesmo layout de 16 canais (offset relativo ao startChannel):

| Índice | Alias           | Canal Beam 1 | Canal Beam 2 |
|--------|-----------------|--------------|--------------|
| 1      | color_wheel     | 123          | 203          |
| 2      | strobo          | 124          | 204          |
| 3      | fecho_lampada   | 125          | 205          |
| 4      | gobo_wheel      | 126          | 206          |
| 5      | prism_1         | 127          | 207          |
| 6      | prism_rotation  | 128          | 208          |
| 7      | virtual_speed   | 129          | 209          |
| 8      | frost           | 130          | 210          |
| 9      | focus           | 131          | 211          |
| 10     | pan             | 132          | 212          |
| 11     | pan_fine        | 133          | 213          |
| 12     | tilt            | 134          | 214          |
| 13     | tilt_fine       | 135          | 215          |
| 14     | special_random  | 136          | 216          |
| 15     | reset           | 137          | 217          |
| 16     |                 | 138          | 218          |

## Uso em Scripts DMX

> Canais: M1 pan=132, tilt=134, fecho_lampada=125, virtual_speed=129 · M2 pan=212, tilt=214, fecho_lampada=205, virtual_speed=209. Tilt provisório.

```js
// Nivelado para frente (simétrico) — posição neutra
SetChannel(125, 255); SetChannel(132, 84); SetChannel(134, 36); // Beam 1 fecho_lampada/pan/tilt
SetChannel(205, 255); SetChannel(212, 84); SetChannel(214, 32); // Beam 2 fecho_lampada/pan/tilt
```

```js
// Fecho apontado pro chão em linha reta (centro do altar)
SetChannel(132, 84);  SetChannel(134, 144); // Beam 1
SetChannel(212, 82);  SetChannel(214, 125); // Beam 2
```

```js
// Laterais (paredes laterais da igreja)
SetChannel(132, 42); SetChannel(134, 35); // Beam 1
SetChannel(212, 44); SetChannel(214, 26); // Beam 2
```

```js
// Apagar os dois Beams (OnTerminate) — zera dimmer
SetChannel(125, 0); // Beam 1
SetChannel(205, 0); // Beam 2
```

## Mapa de Canais — Moving_Wosh

Moving wash com sistema CMY — fixture distinto dos Beams. Orientação de pan/tilt própria, ainda
não levantada.

| Índice | Alias           | Canal DMX |
|--------|-----------------|-----------|
| 1      | pan             | 171       |
| 2      | tilt            | 172       |
| 3      | pan_tilt_speed  | 173       |
| 4      | strobo          | 174       |
| 5      | color_wheel     | 175       |
| 6      | cyan            | 176       |
| 7      | magenta         | 177       |
| 8      | gobo2           | 178       |
| 9      | yellow          | 179       |
| 10     | cmy_system      | 180       |
| 11     | cmy_speed       | 181       |
| 12     | effects_disc    | 182       |
| 13     | zoom            | 183       |
| 14     | pan_fine        | 184       |
| 15     | tilt_fine       | 185       |
| 16     | (sem função)    | 186       |

## Comportamentos e Quirks

- **Curso de pan diferente entre M1 e M2:** M1 gira anti-horário até 450°, M2 horário até 540°. Movimentos simétricos precisam compensar essa diferença, não espelhar valor por valor.
- **Frente simétrica = pan 84 nos dois.** Não usar modelo de offset fixo; usar as posições base medidas.
- **Feixe só aparece a partir de pan ~25;** em pan 0 o feixe bate na parede do fundo e não é visto.
- **Tilt dos Beams é provisório** — conferir no rig antes de fixar cenas estáticas críticas.
- **dimmer=0 apaga** independentemente de pan/tilt/cor. Zerar dimmer no OnTerminate.
