# Lacunas da Base Atual
> Mina: fire-base-adapter — origem: docs/auditorias/bateamento/melhoria-fire-base-adapter.md — mina relacionada: adapter-universal (docs/auditorias/exploracao/adapter-universal/)

## 1. Diagnóstico da base atual (o que impede isso hoje)

A `fire-base.js` v1 está correta, mas o adapter só participa em **um** ponto
(`fb_mhColor`, roda de cor dos beams). Três lacunas estruturais:

### LACUNA 1 — escrita cega ao adapter
`fb_set(canal, valor)` recebe só o **número** do canal. Nesse ponto a base já
não sabe de qual fixture/alias o canal veio — impossível consultar
`adapter.value(id, alias, valor)` para aplicar uma correção `transform`.
A informação necessária existia no resolver e foi descartada.

### LACUNA 2 — resolvers perdem o nome do alias
`fb_mh()` devolve `{ panFine: 132, ... }` — a propriedade é camelCase amigável
(`panFine`), mas o alias real do show é `pan_fine`. Sem o alias original, não
há como cruzar com um `transform` que declara `"alias": "pan_fine"`.

### LACUNA 3 — adapter só para cor de beam
Não existe helper genérico para outras rodas (gobo, prisma, macro do PAR) nem
para presets multi-canal. Cada nova adaptação exigiria helper novo — o oposto
de "criar a adaptação no show e os scripts herdarem".
