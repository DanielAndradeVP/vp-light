# Execução E Aceite

> Mina: adapter-universal — origem: docs/auditorias/bateamento/plano-adapter-universal.md

## 6. Ordem de execução e validação

1. Corrigir BUG 1 e 2 + testes de unidade puros (`node`, sem Electron) cobrindo:
   chave acentuada/maiúscula, adapterKey maiúsculo, `_default`, canal null.
2. Adicionar `value()`/`preset()` + testes (identidade sem transform; ordem
   invert→scale→offset→clamp; preset com alias inexistente → ignorado).
3. Expor no sandbox (`main.js`) e reiniciar `npm run dev`.
4. Regressão: rodar os 14 scripts atuais — nenhum usa `value`/`preset`, e
   `resolve` mantém contrato → comportamento idêntico.

## 7. Critérios de aceite

- Editar um `transform` no show corrige o canal em **todos** os scripts que
  escrevem via base comum, sem tocar em nenhum script.
- Adapter novo com chave "Azul Claro" funciona (BUG 1 morto).
- Fixture sem adapters se comporta byte a byte como hoje.
- Toda falha de adaptação aparece uma vez no console do main com o motivo.
