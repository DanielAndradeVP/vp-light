# Auditoria — Adapter Semântico, Fixture Profiles e Calibração Física

> Auditoria **read-only**. Executor: subagente Claude (general-purpose). Auditor principal: Claude (Sonnet 5).
> Nenhum arquivo alterado. Data: 2026-07-24.
> `[fato]` = arquivo:linha, validado inclusive programaticamente (Node ad-hoc) quando indicado. `[análise]` = interpretação.

Escopo: `electron/adapter.js`, `fixtureOffsets.js`, `fixtureProfiles/{index,movingHeadBeam1,movingHeadBeam2,parLedDeluxeLayoutA,parLedDeluxeLayoutB}.js`, `ribaltaPhysicalCalib.js`, cruzado com `shows/vp.show.json` (24 fixtures) e `electron/main.js`.

---

## Achado mais crítico: `adapter.setFocus`/`setFrost`/`setPrismRotation` nunca chegam aos scripts

- [fato] `electron/adapter.js:443-458` exporta 14 símbolos, incluindo `setFocus`, `setFrost`, `setPrismRotation` (definidos em adapter.js:356-393).
- [fato] `electron/main.js:1060-1079` monta o objeto `adapter` injetado na sandbox de scripts (`compileScriptContext`, main.js:1114-1125) com apenas 9 métodos: `resolve, setColor, setDimmer, setMovementSpeed, setPanTilt, setStrobe, setPrism, setGobo, getCapabilities`. **`setFocus`, `setFrost`, `setPrismRotation` não estão na lista.**
- [fato] `docs/auditorias/bateamento/mapeamento-detalhado-mh1-mh2.md:49-104` documenta a criação dessas 3 funções com testes unitários passando (`tests/adapter-semantic.test.js:266-295`), mas **os testes chamam `adapter.setFocus(deps,...)` direto no módulo**, nunca pela sandbox de main.js — por isso a suíte ficou verde sem detectar a lacuna.
- **Cenário de disparo:** qualquer script/macro que chame `adapter.setFocus(...)`, `adapter.setFrost(...)` ou `adapter.setPrismRotation(...)` recebe `TypeError: adapter.setFocus is not a function` dentro do `new Function(...)` da sandbox, podendo derrubar `OnStart`/`OnExecute`/`OnTerminate` inteiro.
- [análise] O commit 65b56e4 (e os "Atualizado 5/8/9" do mapeamento) resolveram o problema **só na camada de dados** (show.json + profiles + módulo `adapter.js`); a camada de wiring runtime (`main.js`) nunca foi atualizada. Hoje 3 de 10 capabilities "prontas" nos dois Moving Head Beam são inacessíveis a partir de qualquer script real. **Ação recomendada: adicionar as 3 entradas faltantes em `main.js:1060-1079`.**

---

## electron/adapter.js
- `setColor` para `rgb/rgbw` usa `STANDARD_RGB_COLORS` fixo, não `fixture.adapters` — nenhum PAR LED do show tem `adapters`, então não há inconsistência hoje, mas é uma pegadinha de design.
- Para `rgbw`, não há mistura de branco com cor (é R+G+B *ou* W, nunca combinado) — limitação de design, não bug.
- `clampDmx` garante 0-255 sempre, independente do show.json — defesa em profundidade correta.

## electron/fixtureOffsets.js
- `FIXTURE_OFFSET_RULES = {}` continua vazio, mas **é intencional e documentado** (fonte única de offset = show.json) — recategorizado de "lacuna" para "simplificação arquitetural", ponto de clareza de nome de função, não de funcionalidade.
- `TESTE_ZERO_OFFSET = false` hoje (modo produção). Flag hardcoded, não exposta à UI — risco baixo, mas vale confirmar explicitamente que ninguém deixou isso em `true` antes do evento (se `true`, todo pan/tilt sai sem calibração, silenciosamente).
- `Moving_Wosh` tem `pan`/`tilt` mas **não tem `panOffset`/`tiltOffset` no show.json** — hoje recebe offset zero (não calibrado, não é bug).

## electron/fixtureProfiles/index.js
- 4 profiles 100% válidos estruturalmente (`validateAllProfiles()` rodado de fato).
- Resolução testada contra as 24 fixtures reais: **12 fixtures não resolvem para nenhum profile** (Ribalta_1/2, 4x ribalta-rgb-static, Fita_Led, 4x Mini_Brut, Moving_Wosh) — `PROFILES` só cobre `moving_head_beam`/`par_led`. `setDimmer`/`setMovementSpeed`/`setPanTilt` continuam funcionando nessas fixtures (não passam por profile), só `setColor/setStrobe/setPrism/setGobo/setFocus/setFrost/setPrismRotation/getCapabilities` retornam `PROFILE_NOT_FOUND`.
- Se uma fixture ganhar `profileId: null` explícito no editor, ela some do sistema de profiles mesmo com `fixtureType` compatível, sem aviso (nenhuma fixture real tem essa chave hoje).

## Moving Head Beam 1 e 2 — dados físicos
- 13 aliases cada, todos batendo com `channels[]`/`startChannel` real do show.json, sem colisão de canal.
- Scanner automático não encontrou valores DMX fora de 0-255 nem duas cores mapeando pro mesmo valor em nenhuma das 7 tabelas de capability, nos dois fixtures — **a alegação de "mapeamento físico completo" procede na camada de dados.**
- [análise] Gap no color wheel do MH1: `blue_claro:90` → `laranja_claro:110` pula o valor 100 — já observado em 19/07, ainda presente, recomenda-se confirmação física (não é urgente).
- **Nomenclatura de cor totalmente divergente entre MH1 (português) e MH2 (majoritariamente inglês)** — só `white/red/green/yellow` são nomes comuns. Dificulta escrever scripts genéricos para os dois beams sem camada de tradução.
- `prism`/`frost` (ambos os beams) só têm o valor `"ligado"` mapeado — **não existe `"desligado"`**. `adapter.setPrism/setFrost(id,'desligado')` sempre falha com `VALUE_NOT_SUPPORTED`; única forma de desligar é `SetChannel` cru.

## PAR LED Layout A / B
- Ambos com `color` tipo `rgb`/`rgbw` `status:'ready'` e genuinamente funcional (não depende de `fixture.adapters`).
- `strobe` declarado `mapping-incomplete` nos dois layouts — nenhuma das 9 fixtures reais tem campo `adapters`, então mesmo se virasse `ready` não haveria tabela.
- **Achado novo**: Layout B declara `strobe: {type:'range', status:'mapping-incomplete'}` mas **nenhum dos 4 fixtures Layout B tem alias `"strobo"` no `channels[]` real** — a capability é estruturalmente inalcançável com o hardware atual, não apenas incompleta. Sugestão: remover do profile ou documentar como "só via `macro`".

## ribaltaPhysicalCalib.js — Ribalta_2 gain divergente (convergente com relatório de engine)
- [fato] Comentário (linha 71-72) diz Ribalta_2 usa `gain 0.915` "para anular o ficar cada vez mais à frente ao subir o tilt". Dado real (linha 79): `gain: 1` — o valor **default**, ou seja, nenhuma correção está sendo aplicada de fato.
- [fato] `git log` confirma que a divergência existe **desde o commit original** que introduziu o sistema (`3794fe4`, 26/06) — não é regressão recente.
- [fato] Já tinha sido flagrada em `docs/auditorias/exploracao/adapter-fixtures/19-07-2026-matriz-capabilities-fixtures.md:97` — **conhecida há 5+ dias e ainda não corrigida** na véspera/dia do evento.
- **Ação recomendada: checagem física visual das duas ribaltas em movimento (tilt baixo→alto) antes do show**, e decidir se `gain` deve virar `0.915`/valor medido, ou se o comentário deve ser corrigido (se o problema já foi resolvido mecanicamente no rig).
- Fórmula de soft-offset verificada matematicamente sem bug — só o parâmetro `gain` está desalinhado com a documentação.

## Cruzamento com show.json
- Nenhuma sobreposição de canais entre fixtures habilitadas (e `validateFixtures` bloquearia se houvesse).
- `warnInvalidAdapters` cobre todos os `adapters.*` de todas as fixtures, só `console.warn`, nunca bloqueia — nenhum valor fora de 0-255 encontrado hoje.
- Sem validação cruzada entre aliases de `channels[]` e o que o profile resolvido espera — se alguém renomear `"pan"` para `"pan2"` no editor, nada aponta a quebra antes do runtime.
- `scripts/fire-base.js:250-251` (comentário) lista nomes de cor (`purple`,`blue`,`white_2`) que **não existem** em nenhuma das duas tabelas reais — documentação desatualizada.
- `scripts/fire-base.js:253-255` `FB_MH_COLOR.AMBER='amber'` só existe em MH1; em MH2 é `amber_1`/`amber_2` — `fb_mhColor(mh2, AMBER)` seria um no-op silencioso. Hoje inofensivo porque `fire-base.js` não tem nenhum consumidor `fire-*.js` ainda (ver relatório de scripts/macros).

## Tabela de status por fixture

| Fixture | Profile | color | dimmer | pan/tilt | strobe | prism/frost | gobo | focus/prismRotation |
|---|---|---|---|---|---|---|---|---|
| ParLed_Deluxe_1/5/7/10 | layout-a | ✅ | ✅ | n/a | ⚠️ parcial | ❌ | ❌ | ❌ |
| ParLed_Deluxe_2/3/8/9 | layout-b | ✅ | ✅ | n/a | ❌ inalcançável | ❌ | ❌ | ❌ |
| ParLed_Deluxe_4, parLed1 (desabilitadas) | — | — | — | — | — | — | — | — |
| **Moving Head Beam 1/2** | próprio | ✅ | ✅ | ✅ | ✅ | ⚠️ só "ligado" | ✅ | ⚠️ **dados prontos, função ausente na sandbox** |
| Ribalta_1/2 | nenhum | ❌ | ✅ canal direto | ✅ (gain divergente na Rib_2) | ❌ | ❌ | ❌ | ❌ |
| Fita_Led, Mini_Brut_01-04 | nenhum | ❌ | ✅ canal direto | n/a | ❌ | ❌ | ❌ | ❌ |
| Moving_Wosh | nenhum | ❌ (CMY) | ✅ canal direto | ✅ sem offset calibrado | ❌ | ❌ | ❌ | ❌ |

## Resumo priorizado

**Crítico**
1. `adapter.setFocus/setFrost/setPrismRotation` ausentes do objeto `adapter` da sandbox (main.js:1060-1079) — `TypeError` garantido se algum script chamar.

**Alto**
2. `ribaltaPhysicalCalib.js` — `gain:1` na Ribalta_2 contradiz o comentário (`0.915`); divergência conhecida desde 19/07, sem correção até 24/07. Checagem física recomendada antes do show.

**Médio**
3. `prism`/`frost` sem valor "desligado" mapeado em nenhum dos dois Moving Head Beam.
4. `fire-base.js` com nomes/comentários de cor desatualizados frente aos dados reais (`purple`/`blue`/`white_2` inexistentes; `AMBER` ausente em MH2).
5. `parLedDeluxeLayoutB.js` declara `strobe` estruturalmente inalcançável (sem canal físico em nenhuma fixture real).
6. Gap sem cor mapeada em DMX 100 na roda do MH1 — provavelmente intencional, requer confirmação física.

**Baixo**
7. Nomenclatura de cor MH1 (PT) vs MH2 (EN) sem tradução comum.
8. `fixtureOffsets.js` com nome de mecanismo (`FIXTURE_OFFSET_RULES`) maior do que o que hoje existe (simplificação intencional).
9. `profileId: null` explícito removeria fixture do sistema de profiles sem aviso (armadilha futura, não ativa hoje).
10. Falta validação cruzada automática `channels[]` ↔ aliases esperados pelo profile.
