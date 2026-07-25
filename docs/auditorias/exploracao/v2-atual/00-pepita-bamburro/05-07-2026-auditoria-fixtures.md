# Auditoria — Escopo: Fixtures e Endereçamento

> Extraído da Auditoria Completa — VP Light (2026-07-05). Documento read-only.
> Todas as afirmações marcadas com `arquivo:linha` foram lidas diretamente no código; o que é interpretação/opinião está marcado como **[análise]**.

---

## Auditoria de fixtures e endereçamento

Fonte: `shows/vp.show.json` (24 fixtures), lido integralmente pelo Codex‑XHigh. O campo de tipo usado é **`fixtureType`** (`type` está vazio em todos).

**Resumo de endereçamento (habilitados):** faixas `1‑8, 9‑16, 17‑24, 33‑40, 49‑56, 57‑64, 65‑72, 74‑81` (ParLeds), `123‑138` (Moving Head Beam 1), `171‑186` (Moving_Wosh, tipo `moving_head`), `203‑218` (Moving Head Beam 2), `258‑270`/`271‑283` (Ribalta_1/2), `400,401,402,410` (Mini Bruts), `404` (Fita).

**Achados:**
- ✅ **Sem sobreposição** entre fixtures habilitados; nada fora de 1–512; `channelCount` bate com `channels.length` em todos.
- ⚠️ **`startChannel` duplicado no canal 1:** `ParLed_Deluxe_1` (habilitado) e `parLed1` (`enabled:false`). Como um está desabilitado, `validateFixtures` aceita (`show.js:112`) e `getDisabledFixtureChannelSet` mantém 1–8 habilitado (regra: só bloqueia canal sem nenhum dono habilitado, `main.js:802`). Correto, porém é um fixture-fantasma que confunde. **Baixo.**
- ⚠️ **Gap no canal 73** entre `ParLed_Deluxe_9` (65‑72) e `ParLed_Deluxe_10` (start 74). Provavelmente intencional (patch físico), mas não documentado. **Baixo.**
- ⚠️ **`Moving_Wosh`** (`moving_head`, 171‑186, habilitado) ocupa 16 canais e **nenhum script o controla** (scripts miram `moving_head_beam`). É controlável só por fader manual — possível equipamento legado/fantasma reservando 16 canais no meio do patch. **[análise] Médio** (ocupa espaço e pode ser ligado por engano em cena/teste).
- ⚠️ **Aliases divergentes entre os dois Moving Head Beam:** Beam 1 usa `prism_1_rotation`/`prism_1_rotation_2`; Beam 2 usa `prism_rotation`/`focus`; **Beam 2 tem um alias final vazio `""`** (16º canal). `getFixtureAliasCandidates` (`main.js:1020`) já contorna parte disso com fallbacks (`prism`→`prism_1`, `dimmer`→`fecho_lampada`, etc.), mas o alias vazio pode casar por engano em buscas de alias vazio. **Médio.**
- ⚠️ **Ribaltas RGB estáticas 1‑4** e `ParLed_Deluxe_4` e `parLed1` estão `enabled:false` — cobririam 25‑32 e 284‑307. Não interferem, mas inflam o show. **Baixo.**

**Validações existentes:** `validateFixtures` (`show.js:87`) cobre `channelCount==channels.length`, `startChannel` inteiro ≥1, fim ≤512 e não-sobreposição entre habilitados. **Não valida** unicidade de aliases, `adapters`, nem canais das cenas. E **só roda no save**. **[análise]**

## Recomendações de melhoria (deste escopo)

1. Revisar patch: decidir sobre `Moving_Wosh`, o alias `""` do Beam 2 e os fixtures `enabled:false`.
2. revisar patch; padronizar aliases; remover alias vazio
3. patch DMX oficial (planilha canal→fixture→alias)
4. **Validações automatizadas desejáveis:** teste de `validateFixtures` + um linter de show (sobreposição, aliases duplicados, refs de macro, cenas com canais fora de fixture habilitado) rodável por `node tools/…`.
