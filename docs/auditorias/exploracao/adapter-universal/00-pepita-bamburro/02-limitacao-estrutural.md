# Limitação Estrutural

> Mina: adapter-universal — origem: docs/auditorias/bateamento/plano-adapter-universal.md

## 2. Limitação estrutural (por que hoje NÃO corrige "qualquer canal/valor")

O formato atual só expressa **mapa escalar 1-para-1**:
`nome lógico → um valor DMX em um canal`. Não expressa:

1. **Correção de valor contínuo** — "o dimmer desse PAR satura, limite em 200";
   "o tilt desse moving precisa de +6"; "esse canal é invertido (255=off)".
2. **Faixas (range)** — "strobe lento..rápido é 10..250 nesse modelo; no outro
   é 40..180". Scripts querem pedir `0..1` e cada fixture escala pro seu range.
3. **Preset multi-canal** — "cor 'warm' nesse PAR = red 255, green 140, blue 40"
   (3 canais de uma vez; a roda de cor resolve com 1 canal, RGB não).
4. **Vínculo adapterKey→canal** — hoje o script precisa saber *qual alias*
   escrever além de resolver o valor; o conhecimento fica dividido.
