# Objetivo e Contexto da Mina

Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## Objetivo central (o contrato)

Continuação de `plano-adapter-universal.md`. Quando uma adaptação de qualquer
equipamento for criada ou editada no `.show.json` (mapa, transform ou preset),
**todos os scripts-fire já escritos refletem a mudança sem editar nenhum
deles** — porque toda escrita da base passa pelo adapter.

## Mapa dos escopos desta pepita-bamburro

| Arquivo | Escopo |
|---|---|
| 01-lacunas-da-base-atual.md | Diagnóstico: as 3 lacunas estruturais da fire-base v1 |
| 02-resolvers-id-ch.md | Resolvers com `{id, ch}` e constante `FB_ALIASES` |
| 03-fb-write-caminho-unico.md | `fb_write`/`fb_adapterValue` como caminho único de escrita |
| 04-helpers-genericos.md | `fb_wheel`, `fb_preset`, `fb_parColor`, `fb_mhColor` |
| 05-semantica-e-invariantes.md | Correção no blackout de propósito e o que NÃO muda |
| 06-fluxo-e-ressalvas.md | Fluxo resultante e ressalvas de cache/reload |
| 07-execucao-validacao-aceite.md | Ordem de execução, validação e critérios de aceite |

## Pontos a validar (registro da mente da exploração)

1. **Contagem de scripts:** o bruto fala em "todos os 50 scripts"; a mina
   adapter-universal fala em "14 scripts atuais". Contagem real em 05/07/2026:
   15 arquivos `.js` em `scripts/`, sendo 1 scripts-fire.
   Se a contagem for usada como critério de aceite, prevalece a contagem real.
2. **"Byte a byte equivalente à v1"** deve ser lido como equivalência de
   writes/DMX (diff de `SetChannel` vazio no teste de identidade), não como
   identidade literal do arquivo fonte.
3. **"Zero restart para valores"** vale apenas para valores de adapters;
   mudar `startChannel`/aliases de um fixture pede restart do script
   (F-key off/on), e editar o `.show.json` direto no disco exige reload do
   show no app.
