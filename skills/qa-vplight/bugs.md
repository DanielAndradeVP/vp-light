# bugs.md — Registro de Bugs do vp-light

Workflow:
1. Dan preenche id, titulo, descricao_usuario, status: pendente
2. Dan pede ao qa-vplight: "investigue o bug id:X"
3. QA investiga, preenche descricao_qa e muda status para concluido

---

## id: 001
**titulo:** cena nao persiste apos salvar show e recarregar
**descricao_usuario:** quando salvo uma cena no botao e depois salvo o show, ao fechar e reabrir o app os valores da cena voltam errados ou incompletos
**status:** concluido
**descricao_qa:** o handler show:save em electron/main.js fazia um merge shallow das paginas com `{ ...currentShow.pages, ...showData.pages }` substituindo a pagina inteira pelo objeto do renderer, se o renderer enviasse a pagina sem a cena mais recente (por timing entre o setShow do React e o handleSave) a cena era descartada no disco antes de chegar ao JSON.stringify, a correcao aplicada foi um merge profundo por pagina onde currentShow.pages serve de base e showData.pages sobrescreve cena a cena individualmente garantindo que nenhuma cena seja perdida por substituicao acidental da pagina inteira.

---

## id: 002
**titulo:** script nao manda sinal quando ha cena ativa nos mesmos canais
**descricao_usuario:** quando ativo uma cena e depois ligo um script, o script parece rodar mas nao muda nada no equipamento
**status:** concluido
**descricao_qa:** comportamento por design no compositor em electron/engine/compositor.js na funcao renderFrame, a linha `if (ch in _sceneLock) continue` bloqueia silenciosamente qualquer escrita de script nos canais que estao travados pela cena ativa, o _sceneLock e atualizado via dmx:setActiveSceneChannels sempre que activeScenes muda no renderer em Main.jsx, enquanto a cena estiver ativa todos os seus canais ficam protegidos e o script e ignorado a cada frame de 40ms sem nenhum erro ou aviso, solucao pendente de definicao de UX sobre modo de operacao Cena vs Script.

---

## id: 003
**titulo:** desmarcar qualquer script de um conjunto ativo causa blackout nos demais
**descricao_usuario:** quando seleciono script 1 e depois script 2 (podendo ter até 3 simultâneos), ao desmarcar o script 2 o sistema dá blackout imediato apagando também o script 1 que deveria continuar rodando. O botão do script 1 ainda aparece como selecionado e o painel de teste ainda mostra valores no canal, mas o DMX vai a zero — o script anterior "parece" ativo mas o universo está zerado.
**status:** concluido
**descricao_qa:** a causa raiz está em src/screens/Main.jsx linha 295 dentro de resolveUniverseState, chamada sempre que um script é desligado via handleToggleScript (linha 658). O problema: resolveUniverseState chamava window.vp.blackout() que mapeia para o IPC dmx:blackout em electron/main.js linha 300, e esse handler executa stopAllRunningScripts('blackout') antes de zerar o universo — matando todos os scripts ativos, inclusive os que deveriam continuar rodando. O React não recebia notificação do encerramento forçado, então o botão e o painel de teste continuavam mostrando o script como ativo enquanto o main process já havia removido a camada do compositor e zerado o universo. A correção foi substituir window.vp.blackout() + window.vp.restoreState(merged) condicional por um único window.vp.restoreState(merged) incondicional: o IPC dmx:restoreState chama universe.blackout() para limpar o buffer e depois reaplica os canais de cena, sem nunca chamar stopAllRunningScripts, mantendo todos os outros scripts em execução — que reescrevem seus canais no próximo tick do compositor em até 40ms.
