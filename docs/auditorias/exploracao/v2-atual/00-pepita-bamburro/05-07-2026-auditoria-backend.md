# Auditoria — Escopo: Backend (Engine / DMX / Art‑Net / Persistência)

> Extraído da Auditoria Completa — VP Light (2026-07-05). Documento read-only.
> Todas as afirmações marcadas com `arquivo:linha` foram lidas diretamente no código; o que é interpretação/opinião está marcado como **[análise]**.

---

## Auditoria da engine / DMX / Art‑Net

**Funcionamento (bem estruturado):**
- Loop único a 25 fps, sem loops paralelos; a janela 3D reaproveita o mesmo ciclo via `onFrame` (`engine.js:28`, `main.js:288`). **[preservar]**
- `universe.js` valida canal (1–512) e normaliza valor (0–255) em toda escrita (`universe.js:24,32`). Separação **lógico↔físico** por offset é elegante e mantém o fader do operador em 0 mesmo com calibração aplicada.
- Compositor usa **contagem por frames** para fades (determinístico, imune a jitter de `Date.now()`), buffers pré-alocados (sem GC por frame), e HTP como default para crossfade sem "dip" (`compositor.js:22-28`). **[preservar]**
- `artnet.js` resolve corretamente o problema real de múltiplas interfaces no Windows (socket vinculado ao IP de cada interface), com re-enumeração a cada 10 s e recuperação do socket loopback após N erros. **[preservar]**
- `ribaltaPhysicalCalib.js` é a peça mais sofisticada: mapeia tilt lógico→físico com **gain** (erro que cresce) + **soft-offset com joelho** (erro constante sem zona morta), aplicado **só** no buffer de Art‑Net, sem contaminar cena/3D (`ribaltaPhysicalCalib.js:199`). **[preservar]**

**Frágil / risco:**
- **Scripts rodam na thread do loop.** `compileScriptContext` usa `new Function` e `OnExecute` é chamado dentro do `renderFrame` (`compositor.js:228`). O `try/catch` remove a camada em caso de **exceção**, mas **não protege contra laço infinito ou trabalho pesado** — isso trava o `setInterval`, e o Art‑Net para (palco congela no último frame). **Crítico para operação ao vivo.**
- **Guard de canais desabilitados é recomputado com frequência.** `getDisabledFixtureChannelSet()` percorre todos os fixtures a cada chamada e é invocado **por canal** em `setDmxChannelRuntime`/`isDmxChannelEnabled`/`filterDisabledFixtureChannels` (`main.js:802,823,827`). Numa cena de 92 canais isso multiplica varreduras. No compositor está correto (uma vez por frame via provider). **[análise]** ineficiência O(fixtures×canais) no caminho de cena; hoje tolerável (24 fixtures) mas é dívida.
- **`engine:stop` exposto** (`preload`? não — só `stopEngine`, `preload.js:38`) encerra o loop **e** fecha sockets, parando também a janela 3D. Não há UI óbvia chamando; risco baixo, mas é um botão de desligar tudo acessível por IPC.
- **`detectConflicts`** (`universe.js:160`) compara apenas cenas em `_activeScenesMap`; não detecta conflito cena×script×fader. É um detector parcial.

---

## Auditoria de persistência e arquivos

- **Escrita atômica:** `saveShow`/`saveShowAs` gravam em `.tmp` e fazem `renameSync` (`show.js:186,205`) — evita `show.json` parcial/corrompido. **[preservar]**
- **Merge cuidadoso no save:** `buildMergedShow` (`main.js:585`) preserva scripts/páginas/macros do runtime do main sobre o snapshot possivelmente defasado do renderer; `show.saveShow` ainda preserva `scripts.color` e faz fallback se `scripts` vier `null` (`show.js:161`). Boa defesa contra apagar dados ao salvar. **[preservar]**
- **Validação assimétrica:** `saveShow`/`saveShowAs` chamam `validateFixtures`; **`loadShow` NÃO valida endereçamento** — só exige `version`, `fixtures`, `pages` (`show.js:133`). Um `show.json` editado à mão com sobreposição/estouro **carrega e roda**. **Alto.**
- **Backup:** os arquivos `vp.show_backup.json` e `*.bak_offset_*` são **cópias manuais**; não há rotação/backup automático antes de salvar. Perda de show por save ruim é possível (mitigada só pelo git). **Médio.**
- **Startup tolerante demais:** se `loadShow` lançar no boot, o `catch` (`main.js:1584`) só faz `warn` e o app segue com engine rodando **sem show** (universo vazio, sem scripts). **Baixo/Médio.**
- **Caminhos de script portáveis:** `loadScriptMeta` tenta o caminho absoluto salvo e cai para `<name>.js` relativo ao `SCRIPTS_DIR` (`main.js:697`) — bom para portabilidade entre PCs.
- **Versionamento:** `git status` no início mostrava docs deletados/movidos não commitados. `.bak` e `.tmp` no diretório `shows/` podem sujar o repo. **[análise] Baixo.**

## Recomendações de melhoria (deste escopo)

1. **Watchdog de script**: medir o tempo de `OnExecute` por camada; se estourar um orçamento (ex.: 5–8 ms) derrubar a camada e avisar a UI. Opcional: validar/compilar o script num teste seco antes de ativar.
2. **Validar endereçamento no load** (`validateFixtures` em modo aviso, sem derrubar o app) e sinalizar na UI.
3. backup rotativo antes do rename
4. Memoizar `getDisabledFixtureChannelSet` por show carregado.
5. modelo de calibração (offset vs gain vs knee).
6. **CP‑2 (integridade de dados):** validação no load (modo aviso) + backup rotativo antes do save + linter de show. Critério: show inválido é sinalizado, nunca silenciosamente rodado.
