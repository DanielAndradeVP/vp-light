# Fluxo Resultante e Ressalvas
> Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## 3. Fluxo resultante (o contrato que você queria)

```
você edita/cria adapters no vp.show.json (mapa | transform | preset)
        │            (sem tocar em script nenhum)
        ▼
script-fire chama helper da base (fb_dim, fb_mhMove, fb_wheel, fb_preset…)
        ▼
fb_write(fx, alias, valor) → adapter.value/resolve/preset (lê o show AO VIVO)
        ▼
SetChannel na camada → compositor → engine → Art-Net
```

- `adapter.*` lê o show em memória a cada chamada → correções valem no tick
  seguinte, mesmo com o script rodando.
- Duas ressalvas para o guia: (a) **números de canal** são cacheados no
  `OnStart` — mudar `startChannel`/aliases de um fixture pede restart do
  script (F-key off/on); mudar só *valores* de adapters não pede nada;
  (b) editar o `.show.json` direto no disco exige o show recarregado no app —
  edições feitas pela UI já atuam na memória.
