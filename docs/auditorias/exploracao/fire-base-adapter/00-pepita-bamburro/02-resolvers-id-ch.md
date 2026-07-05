# Resolvers com ID e Canal
> Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## 2.1 Resolvers passam a carregar `{ id, ch }` (alias → canal)

Cada resolver monta um mapa interno `ch` indexado pelo **alias real do show**,
e mantém as propriedades amigáveis apontando para os mesmos números (nenhum
script quebra):

```js
function fb_mh(id) {
  const ch = {};
  for (const alias of ['color_wheel','strobo','fecho_lampada','gobo_wheel',
                       'prism_1','virtual_speed','pan','pan_fine','tilt',
                       'tilt_fine','reset']) {
    ch[alias] = getChannel(id, alias);
  }
  return {
    id, ch,
    // atalhos compatíveis com a v1 (scripts-fire existentes não mudam):
    color: ch.color_wheel, strobo: ch.strobo, dimmer: ch.fecho_lampada,
    gobo: ch.gobo_wheel,   prism: ch.prism_1, speed: ch.virtual_speed,
    pan: ch.pan, panFine: ch.pan_fine, tilt: ch.tilt,
    tiltFine: ch.tilt_fine, reset: ch.reset,
  };
}
```

Mesmo padrão para `fb_rib`, `fb_ribStatic`, `fb_par`, `fb_brut`, `fb_wosh`.
A lista de aliases por família vira constante única (`FB_ALIASES`), documentando
o vocabulário completo de cada equipamento num só lugar.
