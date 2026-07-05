# Relatório: Estado de Execução ao Vivo e Modo Dev+Operacional — vp-light

**Data:** 05/07/2026
**Contexto:** análise feita com o sistema em operação ao vivo (culto), sem tocar em nenhum arquivo de `electron/`, `src/`, `shows/` ou `scripts/`. Este relatório é só leitura + proposta.
**Autor:** Claude (a pedido do Dan)

---

## 1. Estado atual do repositório

`git status` mostra **dezenas de arquivos modificados e não commitados** (praticamente todo `electron/`, `src/`, `scripts/`, `docs/`, `skills-desabilitadas/`). Isso confirma que o estado de trabalho de hoje só existe no disco local — não há commit recente cobrindo essas mudanças. Enquanto não for commitado, qualquer operação destrutiva no working tree (checkout, stash, reset, reinstalação) apaga esse trabalho. Recomendo commitar (ou pelo menos copiar `shows/vp.show.json` e `scripts/`) assim que a janela de silêncio no culto permitir, independente do resto deste relatório.

## 2. O que já é seguro hoje (não precisa de nada novo)

| Camada | Mecanismo já existente | Precisa reiniciar? |
|---|---|---|
| `src/**` (React/UI) | HMR do Vite | Não — hot reload automático ao salvar |
| `scripts/**/*.js` (F-keys, page scripts) | `fs.watch(SCRIPTS_DIR)` em `main.js` recompila e troca a camada no compositor (`stopRunningScript` + `startScript`) | Não |
| `scripts/mov-preset.js` | Mesmo watcher recarrega todos os scripts `mov-*` que dependem do preset | Não |
| Saída Art-Net | `artnet.setFrozen(true/false)` congela só o UDP; engine, compositor e preview 3D continuam rodando | Não |

Ou seja: **você já pode editar scripts de efeito (F-keys, cenas por página, o preset de moving) ao vivo, sem risco**, porque isso já tem hot-swap. Esse é o único tipo de mudança já "modo dev+operacional" hoje.

## 3. Onde está o risco real

Segundo o próprio `CLAUDE.md` do projeto: *"Alterações de IPC ou engine → mexer em `electron/` e reiniciar `npm run dev`"*. Isso é literal — `engine.js`, `artnet.js`, `compositor.js`, `universe.js` e `main.js` são carregados uma vez via `require` na subida do processo Electron, e o loop de 40ms (`engine.js`) referencia essas funções por closure. Editar qualquer um desses arquivos hoje **não faz nada até reiniciar o processo**.

Reiniciar (`npm run dev`, ou o script `tools/run-vp-light-dev.sh`, que mata as portas 5173/3000-3002 e sobe tudo de novo) causa, na prática:

- **Art-Net para de sair** durante todo o tempo de boot do Vite + Electron (tipicamente alguns segundos) — apagão real no palco, não um freeze controlado.
- **`universe.js` reseta**: a instância `DmxUniverse` é recriada do zero (todos os 512 canais voltam a 0 até o show recarregar).
- **Camadas do compositor (`_layers`), macros ativas e scripts rodando são perdidos** — precisam ser reativados manualmente depois do restart.
- **Sockets Art-Net (`artnet.js`) são recriados** — perde o cache de interfaces de rede por alguns segundos.
- Isso é uma reinicialização completa de processo, não um reload de módulo — não tem meio-termo hoje.

Resumindo: **hoje, qualquer mudança em `electron/engine/*` ou `electron/main.js` só entra em vigor com apagão + perda de estado em runtime.**

## 4. O que precisa mudar para existir um "modo dev+operacional"

Ideia central: **separar estado de lógica**. O que não pode nunca ser recriado (estado runtime) fica fixo; só o código de comportamento é trocado a quente.

**Estado que precisa sobreviver a qualquer reload** (nunca re-instanciar):
- Buffer de 512 canais (`universe.js` → `_universe`)
- Sockets UDP abertos (`artnet.js` → `loopbackSocket`, `ifaceSockets`)
- Camadas ativas e macros (`compositor.js` → `_layers`, `_macros`)
- O próprio `setInterval` do loop de 40ms em `engine.js` (não pode parar e recriar — isso já é uma pausa de frames)

**Lógica que pode ser trocada a quente** (recompilar e substituir função por função, sem tocar no estado acima):
- Algoritmo de merge do compositor (`renderFrame`, `_tickEnvelope`)
- Construção/envio do pacote Art-Net (`_transmitPacket`, `sendArtDMX`) — mantendo os sockets já abertos
- Interpolação de pan/tilt (`interpolator.js`)
- Handlers de IPC em `main.js` que não criam janelas novas

**Mecanismo proposto** (mesmo padrão que já existe para `scripts/`, só que aplicado em `electron/engine/`):

1. Um watcher (`fs.watch` ou `chokidar`) observa `electron/engine/*.js` e partes de `electron/main.js`.
2. Ao salvar, o processo faz `delete require.cache[...]` **só do módulo de lógica editado** e re-`require`.
3. `engine.js` passa a chamar a lógica por referência indireta (ex.: `let compositor = require('./compositor')`, reatribuída no reload) em vez de destructuring fixo — assim o loop de 40ms nunca para, só troca o código executado dentro dele.
4. `universe.js` e os sockets do `artnet.js` ficam fora do escopo do watcher — nunca são recarregados, então o estado (canais, macros, camadas, conexões) nunca reseta.
5. Erro de sintaxe/exceção no reload não derruba o processo: se o novo módulo falhar ao compilar, mantém a versão anterior rodando e loga o erro (mesma filosofia do `try/catch` que já existe em `startScript`).

**Dois comandos, como você pediu:**
- Ligar modo dev: ativa o watcher de `electron/engine/**` (e do subconjunto seguro de `main.js`), loga cada hot-swap no console.
- Desligar modo dev: só para o watcher. As mudanças que você já salvou enquanto estava ligado **já estão rodando** (foram aplicadas no momento do save) — desligar não desfaz nada, só impede que futuras edições sejam injetadas sem revisão.

**Limite honesto:** mudanças estruturais em `main.js` — nova janela (`BrowserWindow`), novo canal `ipcMain.handle` que não existia antes, mudança na ordem de inicialização do show — não dá pra tornar 100% hot-swappable sem risco. Para esse tipo de mudança específica, a recomendação é: continuar exigindo restart, mas *avisar antes* e, se possível, fazer isso fora da janela de música/fala do culto (não hoje, com tudo em memória e não commitado).

## 5. O que eu vou respeitar enquanto isso não for implementado

Confirmando as linhas vermelhas que você definiu:
- Nenhum restart do processo/`npm run dev`.
- Nenhum save/overwrite do show ativo (`shows/vp.show.json`) nem de `electron/`.
- Nenhum comando de output/DMX/blackout.
- Este relatório é o único artefato gerado — nenhum arquivo do projeto foi alterado (só leitura), exceto este relatório novo em `docs/relatorios/`, conforme a convenção do próprio `CLAUDE.md`.

## 6. Próximos passos sugeridos

1. Você revisar esta proposta e decidir se quer que eu implemente o watcher de hot-reload em `electron/engine/` (arquivo novo, ex. `electron/engine/hot-reload.js`, sem tocar na lógica existente até você aprovar).
2. Fazer um commit (ou snapshot manual de `shows/` e `scripts/`) do estado atual assim que houver uma pausa no culto — independente da implementação do modo dev.
3. Definir os comandos exatos que você quer digitar (ex.: atalho de teclado no app, endpoint IPC `dev:hotswap:on/off`, ou script npm) — me diga sua preferência e eu implemento nesse formato.
