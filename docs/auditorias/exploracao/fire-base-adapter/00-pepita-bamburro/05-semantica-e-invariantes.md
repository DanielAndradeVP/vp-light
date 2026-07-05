# Semântica e Invariantes
> Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## 2.4 Regra de semântica: correção vale até no blackout (de propósito)

`fb_blackout*` também migra para `fb_write`. Isso é deliberado:
- Canal **invertido** (`invert: true`): blackout precisa passar pelo transform
  (0 lógico → 255 físico = desligado de verdade).
- `min` num transform é um **piso permanente**, inclusive no blackout — é o
  comportamento correto para "nunca deixar esse canal abaixo de X", e o guia
  deve avisar que piso ≠ correção de brilho (para isso, `scale`).

## 2.5 O que NÃO muda

- Nenhuma assinatura pública da v1 muda (`fb_allMH`, `fb_mhMove`, `fb_rgb`,
  `fb_flashOn`, keyframes, blackouts — tudo igual para quem escreve script).
- IDs, presets de rig (`FB_MH1_POS` etc.) e helpers de coreografia intactos.
- Continua biblioteca pura: sem `OnStart/OnExecute/OnTerminate`, inerte até
  ser injetada. O isolamento da fase atual é mantido.
