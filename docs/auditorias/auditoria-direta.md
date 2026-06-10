# Auditoria direta do vp-light

Data da auditoria: 2026-06-10

Este documento explica o projeto sem linguagem pesada. A ideia e deixar claro o que cada parte faz, o que funciona, o que esta pela metade e o que pode dar problema em uso real.

## O que o sistema e hoje

O `vp-light` e um programa desktop para controlar luz DMX. Ele tem uma tela feita em React e uma parte interna em Electron/Node que manda dados Art-Net para a SL3000.

Na pratica:

```text
Voce clica na tela
  -> React chama window.vp
  -> Electron recebe o pedido
  -> altera canais DMX na memoria
  -> a engine manda Art-Net 25 vezes por segundo
  -> a SL3000 recebe
  -> a luz muda
```

Isso esta montado do jeito certo: a tela nao fala direto com hardware. Quem mexe com DMX e UDP e o processo principal do Electron.

## O que cada parte faz

### `electron/main.js`

E o centro do backend do app.

Ele:

- abre a janela do Electron;
- carrega o show padrao;
- inicia a engine DMX;
- recebe pedidos da tela;
- salva e abre show;
- cria, edita, liga e desliga scripts F1-F12;
- executa scripts de efeito.

O que funciona:

- inicia a engine automaticamente;
- carrega `shows/vp.show.json`;
- responde aos comandos da tela;
- abre scripts no VS Code;
- roda scripts a cada 40ms.

O que pode dar problema:

- o blackout nao desliga scripts;
- se um script esta rodando, ele pode acender a luz de novo logo depois do blackout;
- quando troca estado de cena, canais antigos podem continuar acesos;
- scripts ficam guardados no main e a tela so sabe o estado deles quando pergunta ou clica.

### `electron/preload.js`

E a ponte segura entre tela e backend.

Ele cria `window.vp`, com funcoes como:

- `setChannel`
- `blackout`
- `activateScene`
- `saveShow`
- `loadShow`
- `createScript`
- `toggleScript`

O que funciona:

- a tela consegue pedir tudo por IPC;
- a separacao de seguranca do Electron esta respeitada.

O que falta:

- nao valida dados antes de mandar para o main. Se a tela mandar coisa errada, quem precisa se defender e o main.

### `electron/show.js`

Cuida do arquivo `.show.json`.

Ele:

- le o show do disco;
- guarda o show em memoria;
- salva no mesmo arquivo;
- salva como outro arquivo;
- atualiza cena em memoria.

O que funciona:

- carrega e salva JSON;
- faz uma validacao minima;
- salva usando arquivo temporario antes de renomear.

O que falta:

- nao valida se fixture passa do canal 512;
- nao valida se dois fixtures usam o mesmo canal;
- nao valida direito as paginas e cenas;
- nao tem backup automatico se o JSON quebrar.

### `electron/engine/universe.js`

E a memoria dos 512 canais DMX.

Ele guarda um array com 512 valores. Canal 1 na tela vira posicao 0 no array interno.

O que funciona:

- aceita canal de 1 a 512;
- limita valor de 0 a 255;
- zera tudo no blackout;
- retorna snapshot dos canais ligados.

O que esta perigoso:

- aplicar uma cena so muda os canais que vieram na cena;
- ele nao zera os canais que nao fazem mais parte do estado novo;
- o mapa de conflitos acumula cenas antigas em vez de substituir.

### `electron/engine/engine.js`

E o relogio da DMX.

Ele roda a cada 40ms, pega o universo atual e manda para o Art-Net.

O que funciona:

- loop simples;
- 25fps;
- evita recriar estado desnecessario;
- para e fecha socket quando encerrado.

### `electron/engine/artnet.js`

Monta e envia o pacote Art-Net.

O que funciona:

- pacote ArtDMX com 512 canais;
- envia para `255.255.255.255:6454`;
- reaproveita buffer;
- tenta recriar socket depois de erros.

O que falta:

- nao da para configurar IP, universo ou interface de rede pela tela;
- a tela nao recebe aviso se o UDP estiver falhando.

### `src/store/showStore.js`

E o estado global da tela.

Ele guarda:

- show carregado;
- pagina atual;
- fixture selecionado;
- loading;
- uma cena ativa antiga (`activeScene`).

O que funciona:

- carrega show do main;
- salva show;
- adiciona, altera, remove e duplica fixture;
- atualiza cena.

O que esta estranho:

- ele ainda pensa em uma cena ativa so;
- a tela principal usa varias cenas ativas;
- entao existem dois jeitos diferentes de pensar cena ativa;
- paginas nao tem funcoes proprias de criar, apagar ou renomear.

### `src/screens/Main.jsx`

E a mesa principal. E o arquivo mais importante da tela.

Ele faz muita coisa:

- mostra os aparelhos na mesa;
- deixa arrastar aparelhos;
- seleciona varios com area;
- mostra faders do fixture selecionado;
- salva e ativa cenas;
- troca numero de pagina;
- controla blackout;
- controla scripts F1-F12;
- mostra painel de teste;
- mostra conflitos;
- tem painel direito com Chat/Descricao;
- abre modais de cena e script.

O que funciona:

- fader mexe na luz;
- cenas aparecem e podem ser ativadas;
- pode salvar cena com botao direito;
- F-keys aparecem;
- scripts podem ser ligados e desligados;
- painel de teste le o universo;
- fixtures podem ser arrastados.

O que esta pela metade:

- aba Chat so mostra "em desenvolvimento";
- troca de pagina muda o numero, mas nao cria pagina no show;
- se for para pagina 2, ela so existe de verdade depois que uma cena for salva;
- painel direito tem botoes laterais que parecem layout futuro;
- muita coisa visual esta hardcoded, sem usar totalmente o tema.

O que pode quebrar:

- trocar pagina nao limpa cenas ativas;
- uma cena ativa da pagina 1 pode continuar no estado interno quando voce vai para pagina 2;
- salvar cena depende de `liveValues`, que pode nao representar tudo que esta realmente aceso;
- blackout nao conversa com scripts ativos;
- conflitos sao buscados a cada 100ms, mas o mapa no backend pode estar velho.

### `src/screens/FixturePanel.jsx`

E a tela de configuracao de aparelhos.

O que funciona:

- lista fixtures;
- filtra;
- cria fixture;
- edita fixture;
- remove;
- duplica;
- salva.

O que esta pela metade:

- varias abas existem so de visual;
- muitos botoes laterais aparecem desabilitados;
- o painel mostra campos como fabricante/modelo/universo/grupo, mas o editor nao edita tudo isso.

O que pode dar problema:

- novo fixture nasce no canal 1;
- duplicar copia o mesmo canal;
- isso pode gerar conflito DMX facil;
- nao ha aviso de sobreposicao.

### `src/screens/FixtureEditor.jsx`

E o modal de editar aparelho.

Ele edita:

- nome;
- canal inicial;
- quantidade de canais;
- nome de cada canal.

O que funciona:

- muda dados basicos do fixture;
- salva direto no show.

O que falta:

- nao valida se passa do canal 512;
- nao avisa se bate com outro fixture;
- nao edita universo;
- nao edita fabricante/modelo/grupo;
- salva direto chamando `window.vp.saveShow`, alem de mexer no store.

### `src/screens/SceneEditor.jsx`

E um editor de cena mais antigo ou separado.

O que ele faz:

- mostra faders por fixture;
- altera canais ao vivo;
- salva cena.

O problema:

- ele nao esta ligado no app atual;
- `App.jsx` so alterna entre Main e FixturePanel;
- entao esse arquivo existe, mas nao entra no fluxo normal.

### `src/theme.js`

Guarda cores, fontes, espacamentos e alguns estilos.

O que funciona:

- telas importam o tema;
- existe uma paleta central.

O problema:

- muita coisa ainda usa cor escrita direto no componente;
- entao mudar o tema nao muda tudo;
- a documentacao antiga fala preto/cinza/branco, mas o tema atual usa azul/cinza/verde.

### `shows/vp.show.json`

E o show atual.

Hoje ele tem:

- 1 aparelho: `parLed1`;
- canais 1 a 8;
- 1 pagina: `"1"`;
- 1 cena na pagina 1: cena `A`, roxa;
- scripts em F1-F6.

Isso explica parte do problema de pagina: o sistema deixa ir para pagina 2, 3, 4, mas o arquivo so tem a pagina 1.

### `scripts/*.js`

Sao os efeitos ligados nos botoes F1-F12.

O que funciona:

- os scripts seguem o formato `OnStart`, `OnExecute`, `OnTerminate`;
- usam `SetChannel`;
- fazem efeitos reais no `parLed1`.

O que pode dar problema:

- todos estao feitos para o patch atual do `parLed1`;
- se mudar canais do fixture, scripts ficam errados;
- nao ha uma camada que traduza "red" para canal automaticamente;
- e canal hardcoded mesmo.

### `scripts/sync-scripts.js`

E uma ferramenta de terminal para associar scripts aos botoes F1-F12.

O que funciona:

- le arquivos da pasta `scripts`;
- pergunta qual F-key usar;
- escreve no `shows/vp.show.json`.

O cuidado:

- ele altera o show por fora do app;
- se o app estiver aberto com show em memoria, pode haver diferenca entre disco e memoria.

## O que esta funcionando bem

- A separacao entre tela e engine esta correta.
- O DMX fica no main process.
- O Art-Net esta implementado de forma leve.
- A engine roda em loop fixo de 40ms.
- A tela principal ja controla luz de verdade.
- Scripts F1-F12 ja existem e rodam.
- O show salva em JSON.
- A base e simples o bastante para evoluir rapido.

## O que esta quebrado ou perigoso

### Blackout

O blackout zera os canais, mas nao para scripts.

Resultado possivel: voce aperta blackout e a luz volta porque um script continua mandando canal.

### Estado das cenas

Quando uma cena e desligada, o sistema tenta restaurar o estado restante. Mas o backend so aplica os canais novos, nao zera os antigos.

Resultado possivel: canal fica preso aceso.

### Conflitos

O backend acumula cenas no mapa de conflitos. Se uma cena saiu, ela pode continuar contando.

Resultado possivel: alerta de conflito falso.

### Paginas

A troca de pagina muda o numero, mas nao garante que a pagina existe no show. Tambem nao limpa o estado operacional.

Resultado possivel: voce acha que esta na pagina 2, mas ela e so uma pagina vazia temporaria ate salvar algo. Cenas antigas podem continuar na memoria.

### Fixtures

Adicionar ou duplicar aparelho pode criar aparelhos no mesmo canal.

Resultado possivel: dois aparelhos respondem juntos ou uma cena mexe no aparelho errado.

### Scripts

Scripts usam canais fixos.

Resultado possivel: mudou o patch, quebrou o script.

## O que foi feito pela metade

- Sistema de paginas.
- Painel Chat.
- Varios botoes da tela de fixtures.
- Editor completo de fixture.
- `SceneEditor.jsx`.
- Tema centralizado.
- Deteccao de conflitos.
- Sincronizacao completa entre cenas, scripts e blackout.
- Build empacotado para Windows.

## O que pode dar problema em producao

1. Apertar blackout e script reacender a luz.
2. Trocar cena e canal antigo ficar ligado.
3. Trocar pagina e continuar com cena ativa da pagina anterior.
4. Duplicar fixture e criar conflito de canal sem perceber.
5. Script parar por erro e a tela continuar achando que esta rodando.
6. App empacotado nao levar `shows/` e `scripts/`, porque o `package.json` inclui so `electron/**/*` e `dist/**/*`.
7. Empacotamento falhar no Windows por permissao de symlink.
8. Alterar patch e esquecer de atualizar scripts hardcoded.
9. Salvar show mesclando paginas antigas, dificultando apagar pagina de verdade.
10. Usar `sync-scripts.js` com o app aberto e ficar com disco e memoria diferentes.

## Resumo honesto

O projeto ja tem uma base boa. A luz pode ser controlada, scripts rodam, cenas existem, fixtures aparecem e o Art-Net esta no lugar certo.

O maior problema agora nao e "falta tudo". O maior problema e sincronizacao. Existem varios estados ao mesmo tempo:

- universo DMX real no main;
- show em memoria no main;
- show no store React;
- `activeScenes` local na tela;
- scripts rodando no main;
- `liveValues` local na tela;
- arquivo JSON no disco.

Enquanto esses estados nao forem organizados com uma fonte de verdade mais clara, bugs de palco vao aparecer justamente nas horas mais perigosas: blackout, troca de pagina, troca de cena e script rodando junto.

## Ordem sugerida para o proximo dia

1. Arrumar blackout para parar scripts.
2. Arrumar restauracao de universo para zerar canais antigos.
3. Arrumar mapa de conflitos para nao acumular cena antiga.
4. Formalizar paginas: criar, salvar, trocar, limpar estado.
5. Colocar cenas ativas no store, nao soltas dentro de `Main.jsx`.
6. Validar fixtures antes de salvar.
7. Decidir se `SceneEditor.jsx` volta para o fluxo ou sai.
8. Revisar build para incluir `shows/` e `scripts/`.
