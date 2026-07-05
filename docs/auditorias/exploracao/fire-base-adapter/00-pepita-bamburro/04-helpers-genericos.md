# Helpers Genéricos de Adaptação
> Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## 2.3 Helpers genéricos de adaptação (qualquer roda, qualquer preset)

```js
// Qualquer roda/canal discreto com mapa escalar (tipo 1):
//   fb_wheel(mh, 'gobo_wheel', 'gobo', 'estrela')
//   fb_wheel(par, 'macro', 'macro', 'arco_iris')
function fb_wheel(fx, alias, adapterKey, logical) {
  const dmx = adapter.resolve(fx.id, alias, adapterKey, logical);
  if (dmx !== null) fb_write(fx, alias, dmx);
}

// Preset multi-canal (tipo 3): um nome lógico → vários canais de uma vez.
//   fb_preset(par, 'preset', 'warm')  → red/green/blue do "warm" definidos no show
function fb_preset(fx, adapterKey, logical) {
  if (typeof adapter.preset !== 'function') return false;
  const map = adapter.preset(fx.id, adapterKey, logical);
  if (!map) return false;
  for (const alias in map) fb_write(fx, alias, map[alias]);
  return true;
}
```

- `fb_mhColor(mh, nome)` vira açúcar sobre `fb_wheel(mh, 'color_wheel',
  'color', nome)` — assinatura idêntica, scripts existentes intactos.
- Cor de PAR ganha caminho híbrido: `fb_parColor(par, nome)` tenta
  `fb_preset` primeiro (se você criou presets de cor no show) e cai para as
  constantes RGB da base se não houver — ou seja, **você pode redefinir as
  cores de culto no show sem recompilar nada**, e a base tem fallback são.
