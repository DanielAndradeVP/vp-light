# Matriz resumida de capabilities — VP-Light

Complementa o relatório principal: [19-07-2026-auditoria-completa-adapter-capabilities-fixtures.md](./19-07-2026-auditoria-completa-adapter-capabilities-fixtures.md).

Legenda de status:
- ✅ **Confirmado** — valor/comportamento verificado em código ou documentação.
- 🟡 **Parcial** — canal existe e é resolvível, mas faltam valores semânticos completos.
- ⚪ **Presente na definição, não usado** — alias existe no show.json, nenhum script ativo o utiliza com valor real.
- ❌ **Ausente** — a fixture não tem esse canal/capability.
- ❓ **Desconhecido / exige teste físico** — não há evidência em código nem documentação.

---

## Movimento

| Capability | Moving 1 | Moving 2 | Ribaltas | Mini Bruts | PAR LEDs | Implementação atual | Mapeamento faltante | Teste físico necessário |
|---|---|---|---|---|---|---|---|---|
| Pan | ❓ canal existe (132), valor não medido | ✅ canal 212, offset aplicado | ❌ | ❌ | ❌ | Interpolador (`interpolator.js`) + offset em `universe.js` | Limites físicos M1 | Sim (M1, hoje à noite) |
| Tilt | ❓ canal existe (134) | ✅ canal 214, `tiltOffset:6` | ✅ canal `tilt` por ribalta, com calibração física própria | ❌ | ❌ | Interpolador + `ribaltaPhysicalCalib.js` (só ribalta) | Limites físicos M1 | Sim (M1) |
| Pan fine / Tilt fine | ⚪ alias existe (133/135), sem uso | ⚪ alias existe, sem uso | ❌ | ❌ | ❌ | Nenhuma combinação 16-bit implementada em nenhum fixture | Decisão: implementar 16-bit ou não | Não urgente |
| `movement_speed` (`virtual_speed`) | ✅ funcional via interpolador | ✅ funcional (nota: invertido no M2) | ✅ canal físico `speed` (sem interpolação) | ❌ | ❌ | `electron/engine/interpolator.js` | — | Não |
| Inversão/offset | 🟡 `panOffset:40`,`tiltOffset:4` já aplicados | ✅ `tiltOffset:6` | ✅ `tiltOffset:0` em ambas | ❌ | ❌ | `electron/fixtureOffsets.js` | Confirmar se M1 precisa de offset adicional após medição | Sim |
| Resolução 8/16-bit | 8-bit em uso | 8-bit em uso | 8-bit | — | — | Todos os fixtures hoje operam em 8-bit efetivo | 16-bit não implementado em lugar nenhum | Não |

---

## Intensidade e shutter

| Capability | Moving 1 | Moving 2 | Ribaltas | Mini Bruts | PAR LEDs | Implementação atual | Mapeamento faltante | Teste físico |
|---|---|---|---|---|---|---|---|---|
| Dimmer (`fecho_lampada`/dimmer) | 🟡 canal 125, scripts usam 255 fixo | 🟡 canal 205, scripts usam 255 fixo | ✅ canal `dimmer` por ribalta, 255 nos scripts | ✅ canal único, 0-255, usado dinamicamente | ✅ canal `dimmer` (posição varia por layout A/B) | Direto via `getChannel`+`SetChannel` | Faixas finas de dimmer (dimming curve) | Não urgente |
| Shutter/strobe | ⚪ canal 124, só 0/255 usado | 🟡 canal 204, nota JSON cita 175/190/205 mas não usado | ⚪ canal `strobo` por ribalta, só 0 usado | ❌ | 🟡 layout A tem alias `strobo`; layout B usa `macro` 201-255 | Sem API semântica de strobo | Faixas de strobo lento/médio/rápido para M1/M2 | Sim (M1); recomendado confirmar M2 |
| Strobo aleatório | ❓ | ❓ | ❓ | ❌ | ❓ (dentro do range de macro do layout B) | Não implementado | Sim | Sim, se desejado |

---

## Cor

| Capability | Moving 1 | Moving 2 | Ribaltas | Mini Bruts | PAR LEDs | Implementação atual | Mapeamento faltante | Teste físico |
|---|---|---|---|---|---|---|---|---|
| `color_wheel` (enumerado) | ❓ canal 123, **nenhum valor medido** | 🟡 8 valores no `show.json` (prováv. desatualizados vs. medição do operador) | ❌ | ❌ | ❌ (layout B tem alias `color_wheel`, mas é macro de aparelho, não roda de cor discreta) | `adapter.resolve` + `fixture.adapters.color` (usado só por script inerte) | M1 completo; reconciliar M2 | Sim (M1 hoje; M2 já parcialmente feito) |
| RGB/RGBW discreto | ❌ | ❌ | ❌ | ❌ | ✅ canais `red/green/blue(/white)` resolvíveis por `getChannel` | Nenhuma função semântica `setColor` para RGB ainda | Função `setColor` unificando color wheel e RGB | Não (já é numérico direto) |
| Split colors | ❓ | ❓ | ❌ | ❌ | ❌ | Não observado em nenhum lugar | Sim, se existir fisicamente | Sim, se desejado |
| Rotação do color wheel / velocidade | ❓ | ❓ | ❌ | ❌ | ❌ | Não implementado | Sim | Sim, se desejado |
| Macros de cor internos do aparelho (PAR) | — | — | — | — | ✅ documentado (`macro` 11-200) | Só cenas estáticas usam isso hoje | Script dinâmico de macro PAR | Não |

---

## Prisma

| Capability | Moving 1 | Moving 2 | Ribaltas | Mini Bruts | PAR LEDs | Implementação atual | Mapeamento faltante | Teste físico |
|---|---|---|---|---|---|---|---|---|
| Prism on/off | ❓ canal 127, scripts só escrevem 0 | ❓ canal 207, scripts só escrevem 0 | ❌ | ❌ | ❌ | Nenhum valor de ativação conhecido em nenhum dos dois | Sim, ambos | Sim, ambos |
| Tipo/nº de facetas | ❓ | ❓ | ❌ | ❌ | ❌ | Não documentado | Sim | Sim |
| Rotação (sentido/velocidade) | ❓ canal 128 (`prism_1_rotation`) | ❓ canal 208 (`prism_rotation` — nome de alias já diferente do M1) | ❌ | ❌ | ❌ | Não implementado | Sim, ambos | Sim, ambos |
| 2º canal de rotação/refinamento | ❓ canal 131 (`prism_1_rotation_2`) — função não confirmada | ❓ canal 211 é `focus` no M2 (não existe 2º canal de prisma) — **layout já diverge aqui** | ❌ | ❌ | ❌ | Não implementado | Confirmar função real do canal 131 no M1 | Sim |

---

## Gobo

| Capability | Moving 1 | Moving 2 | Ribaltas | Mini Bruts | PAR LEDs | Implementação atual | Mapeamento faltante | Teste físico |
|---|---|---|---|---|---|---|---|---|
| `gobo_wheel` (open + gobos fixos) | ❓ canal 126, nenhum script usa | ❓ canal 206, nenhum script usa | ❌ | ❌ | ❌ | Nenhum valor conhecido para nenhum dos dois | Sim, ambos | Sim, ambos |
| Rotação/indexação/shake | ❓ | ❓ | ❌ | ❌ | ❌ | Não implementado | Sim, se existir fisicamente | Sim, se desejado |

---

## Óptica (focus/zoom/frost/iris)

| Capability | Moving 1 | Moving 2 | Moving_Wosh | Ribaltas | PAR LEDs | Implementação atual | Mapeamento faltante | Teste físico |
|---|---|---|---|---|---|---|---|---|
| `frost` | ❓ canal 130 | ❓ canal 210 | ❌ | ❌ | ❌ | Não implementado | Sim, se relevante | Sim, se desejado |
| `focus` | ❌ (M1 não declara este alias) | ❓ canal 211 | ❌ | ❌ | ❌ | Não implementado | Sim | Sim, se desejado |
| `zoom` | ❌ | ❌ | ✅ canal 183 (documentado no banco) | ❌ | ❌ | Resolvível via `getChannel`, sem API semântica | Função semântica | Não urgente |
| `iris` | ❌ | ❌ | ❌ | ❌ | ❌ | Não presente em nenhuma fixture do show atual | — | — |

---

## PAR LED e RGB/RGBW (visão consolidada)

| Capability | Layout A (`_1,_5,_6,_7`) | Layout B (`_2,_3,_4,_8,_9`) | Implementação atual | Mapeamento faltante | Teste físico |
|---|---|---|---|---|---|
| Master dimmer | ✅ canal dedicado | ✅ canal dedicado | Resolvível via `getChannel` | — | Não |
| Red/Green/Blue | ✅ | ✅ | Resolvível via `getChannel` | Função semântica `setColor` RGB | Não |
| White | ✅ canal dedicado (não usado no Viewer3D) | ❌ (canal vazio no lugar do 8º alias) | Documentado no JSON, ignorado no preview 3D | Corrigir Viewer3D para ler `white` | Não |
| Strobe dedicado | ✅ | ❌ (via `macro` 201-255) | Só layout A tem alias próprio | Unificar semântica de "strobo" entre layouts | Não |
| Macro/velocidade de programa | ✅ (`macro`,`macro_speed`) | ✅ (`macro`, mais `speed`/`color_wheel` do próprio aparelho) | Documentado, só usado em cenas estáticas | Scripts dinâmicos de PAR LED (nenhum existe hoje) | Não |
| Combinação dinâmica (chase/onda/fade/pulso) | Tecnicamente possível hoje (compositor sem limitação) | idem | **Nenhum script ativo faz isso hoje** | Apenas criação de scripts — sem mudança de adapter necessária | Não |

---

## Ribaltas e Mini Bruts (visão consolidada)

| Capability | Ribalta 1 | Ribalta 2 | Mini Bruts (01-04) | Implementação atual | Mapeamento faltante | Teste físico |
|---|---|---|---|---|---|---|
| Tilt + calibração física | ✅ `offset:-20,knee:40` | ✅ `offset:-20,knee:40,gain:1` (doc cita gain 0.915 — divergência) | ❌ | `ribaltaPhysicalCalib.js`, só na saída Art-Net | Confirmar `gain` correto da Ribalta 2 | Recomendado |
| Speed | ✅ canal físico | ✅ canal físico | ❌ | Direto, sem interpolação | — | Não |
| Dimmer + 8 LEDs | ✅ | ✅ | Mini brut = 1 canal único (dimmer) | Direto via `getChannel` | — | Não |
| Debug dedicado | ❌ | ✅ exclusivo (`VP_RIBALTA_DEBUG=1`) | ❌ | `electron/engine/ribaltaDebug.js` | Criar equivalente para Ribalta 1 (opcional) | Não |
| Scripts dinâmicos existentes | ✅ (`mov-traj-*`, `mov-desc-*`) | ✅ (idem) | ✅ (`brut-pisca-*`) | Já em produção | — | Não |

---

## Resumo executivo da matriz

- **Pronto e em uso:** pan/tilt/speed de moving heads e ribaltas; dimmer de todos os tipos; padrões dinâmicos de mini brut.
- **Resolvível mas não semântico:** color_wheel (só M2 tem dados parciais, prováv. desatualizados), RGB de PAR LED.
- **Presente na definição, zero uso real:** strobe fino, prism, gobo, frost/focus/zoom — em ambos os moving heads.
- **Bloqueado por falta de dado físico:** praticamente tudo do Moving 1 além de canal/alias.
- **Bloqueado por decisão de arquitetura, não por dado físico:** API semântica unificada (`adapter.setColor`, etc.) — não existe ainda, mas os dados para construí-la (parcialmente) já existem.
