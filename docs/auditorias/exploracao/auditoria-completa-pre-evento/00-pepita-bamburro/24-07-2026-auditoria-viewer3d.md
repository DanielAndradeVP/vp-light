# Auditoria — Viewer 3D (preview do palco)

> Auditoria **read-only**. Executor: subagente Claude (general-purpose). Auditor principal: Claude (Sonnet 5).
> Nenhum arquivo alterado. Data: 2026-07-24.
> `[fato]` = arquivo:linha. `[análise]` = interpretação.

Escopo: `src/viewer3d-main.jsx`, `src/screens/Viewer3D.jsx`, `src/viewer3d/scene.js`, `src/viewer3d/fixtures/{parled,movinghead,ribalta,minibrut,fitaled}.js`, cruzado com `shows/vp.show.json` (24 fixtures) e pontos específicos de `electron/engine/engine.js`/`universe.js`.

---

## Bugs reais — nenhuma colisão/canal errado/off-by-one encontrado hoje

Conferência campo a campo dos 5 mapas hardcoded de `scene.js` contra `startChannel+índice` real do show.json:

| Mapa | Fixtures | Resultado |
|---|---|---|
| `PARLED_CHANNELS` | 1-9 | ✅ todos batem, nenhuma colisão |
| `MOVING_HEAD_BEAM_CHANNELS` | beam_1, beam_2 | ✅ batem |
| `RIBALTA_CHANNELS` | ribalta_1, ribalta_2 | ✅ batem |
| `MINI_BRUT_CHANNELS` | 01-04 | ✅ batem — **troca 02/03 do relatório de 23/07 confirmada corrigida** |
| `FITA_LED_CHANNELS` | fita_led | ✅ bate |

- **Colisão macro/dimmer do PAR LED Layout A: confirmada corrigida.** Os 4 fixtures Layout A não têm mais campo `macro`/`speed` conflitando com `dimmer`.
- **Off-by-one: nenhum encontrado.** Todos os 5 arquivos de fixture usam `channels[ch.<campo> - 1]` consistentemente, coerente com `universe.js:_toIndex(channel) = channel - 1`.

### [Alto] `Moving_Wosh` totalmente ausente do preview 3D (não é "estático sem updater" — não existe grupo 3D nenhum)
- [fato] `fixture_1780805067518_moving_wosh_01` (habilitada, `fixtureType: moving_head`) não aparece em nenhum `add*()`, nenhum item de `FIXTURE_LAYOUT`, e `moving_head` não é chave de `FIXTURE_UPDATERS`.
- [análise] Se essa fixture for usada ao vivo, o operador não terá **nenhum** retorno visual no preview (nem estático, nem animado) — é gap de escopo já documentado (`docs/relatorios/19-07-2026-implementacao-adapter-semantico-fixtures.md:147`), não regressão nova, mas vale confirmação consciente antes do evento.
- As 4 `ribalta_rgb_static_*` (desabilitadas) também não têm representação — inofensivo hoje, mas não é controlado por checagem de `enabled`; se alguém habilitar uma, ela continua invisível silenciosamente.

## Código morto
- `addFitaLed()` (scene.js:777-786) — **nunca chamada**. A fixture real `Fita_Led` é construída por `addAltarFrontLedStrip()`. Mesmo se chamada, seria incompatível com `fitaled.js` (que procura objetos por nome que `addFitaLed` não define).
- `PARLED_CHANNELS[4]` — entrada morta correspondendo à fixture desabilitada `parled_deluxe_4`, inofensiva.

## Pontos de melhoria

### [Alto, estrutural] `scene.js` não lê `shows/vp.show.json` em runtime
- [fato] Nenhum `import`/`require`/`fetch` do show.json existe em `scene.js` — os 5 mapas de canal, IDs e posições são constantes hardcoded mantidas manualmente em paralelo ao show real.
- [análise] Essa é a **causa raiz** da classe de bug que já ocorreu duas vezes (Mini_Brut 02/03, colisão macro/dimmer PAR LED A) — ambas corrigidas hoje, mas a estrutura que permitiu os bugs continua idêntica. Qualquer edição futura de canal no show.json não se propaga automaticamente.
- Sem log/warning quando `group.userData.channels` está ausente/incorreto — todo `update()` sai silenciosamente com `if (!ch) return`. Hoje todos os 15 `fixtureId` batem (sem typo), mas é risco estrutural para o próximo ciclo de manutenção.

### [Baixo] Rótulo cosmético incorreto — confirmado ainda presente
- [fato] `scene.js:945` gera `name = "ParLed_Deluxe_6"` para `item.n=6`, mas o nome real dessa fixture no show.json é **"ParLed_Deluxe_10"** (scene.js:940; vp.show.json linha 146). É exatamente o item citado no relatório de prontidão de 23/07 como pendência **ainda não corrigida** — confirmado que segue assim hoje. Sem impacto em canal/DMX (só o `THREE.Group.name`); sem exposição visível na UI atual (não há tooltip/label por fixture renderizado ao usuário).

### Observação lateral (fora do escopo primário, não confirmada como bug)
- Comentário em `electron/engine/engine.js:68` ("onFrame usa universo lógico") é impreciso para canais com `panOffset`/`tiltOffset` (Moving Head Beam 1/2) — `getUniverse()` retorna o buffer já com offset somado, não o lógico puro. Não afeta consistência visual hoje (3D e Art-Net usam o mesmo buffer), mas pode induzir a erro em debug futuro de calibração de pan/tilt.

## Tabela de divergências show.json ↔ viewer3D (resumo — ver relatório bruto do agente para a tabela completa fixture-a-fixture)
Todas as 18 fixtures com representação esperada no 3D batem corretamente em canal. Únicas exceções: `Moving_Wosh` (ausente do 3D) e o rótulo cosmético do `ParLed_Deluxe_10`.

## Resumo priorizado

**Crítico**: nenhum — os bugs de canal relatados em 23/07 estão confirmadamente corrigidos.

**Alto**
1. `Moving_Wosh` habilitada no show, mas totalmente ausente do preview 3D.
2. `scene.js` sem leitura em runtime do show.json — causa raiz recorrente de bugs de canal hardcoded.

**Médio**
3. `addFitaLed()` código morto e incompatível com `fitaled.js`.
4. Sem log/warning em falha silenciosa de `userData.channels` ausente.

**Baixo**
5. Rótulo cosmético `ParLed_Deluxe_6` vs. nome real `ParLed_Deluxe_10` — ainda não corrigido, sem impacto prático hoje.
6. `PARLED_CHANNELS[4]` entrada morta (fixture desabilitada).
7. Notas desatualizadas no show.json ("pending_label") não refletem `channels[]` real.
