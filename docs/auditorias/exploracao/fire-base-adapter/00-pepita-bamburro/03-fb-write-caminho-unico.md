# Caminho Único de Escrita
> Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## 2.2 `fb_write(fx, alias, valor)` — o novo caminho único de escrita

```js
// Toda escrita da base passa a ser: valor do script → correção do adapter →
// canal. Se o engine ainda não expõe adapter.value, degrada para o valor cru.
function fb_adapterValue(id, alias, value) {
  if (typeof adapter !== 'undefined' && typeof adapter.value === 'function') {
    const v = adapter.value(id, alias, value);
    if (v !== null && v !== undefined) return v;
  }
  return value; // identidade — comportamento atual
}

function fb_write(fx, alias, value) {
  const channel = fx.ch ? fx.ch[alias] : null;
  if (channel === null || channel === undefined) return;
  fb_set(channel, fb_adapterValue(fx.id, alias, value));
}
```

- **`fb_set` continua existindo** como primitivo de baixo nível (clamp +
  null-guard), mas os helpers internos da base (`fb_rgb`, `fb_dim`,
  `fb_mhMove`, `fb_mhOpen`, `fb_ribMove`, `fb_ribDim`, `fb_ribLeds`,
  `fb_ribStaticApply`, `fb_blackout*`) migram todos para `fb_write`.
  É essa migração interna que faz **qualquer** transform criado no show
  (ex.: `fix_dimmer` limitando um PAR a 200, `fix_tilt` com offset +6,
  canal invertido) valer automaticamente em todos os 50 scripts.
- **Degradação elegante:** antes do patch no `main.js` (que expõe
  `adapter.value`), `fb_adapterValue` devolve o valor cru — a base funciona
  hoje, byte a byte igual à v1, e "liga" as correções quando o engine for
  atualizado. Preserva o isolamento da fase atual.
