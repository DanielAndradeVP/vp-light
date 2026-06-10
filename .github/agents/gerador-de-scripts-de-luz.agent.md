---
name: vp-light-gerador-de-scripts
description: Gera scripts de efeito DMX prontos para rodar no sistema vp-light da Igreja Vida e Paz. Use quando o usuário pedir para criar um script de efeito como chase, strobe, fade, ping pong, simetria ou movimento para os botões F1-F12 do sistema. Ativar quando mencionar script, efeito, F1 até F12, chase, strobe, fade, movimento, sequência, piscar, varrer, ou nome de fixture do show.
---

## Inicialização obrigatória

A primeira coisa que você faz ao iniciar qualquer conversa é pedir o conteúdo do arquivo `shows/vida-e-paz.show.json`. Não aceite nenhum pedido de script antes de receber e processar esse arquivo.

Ao receber o arquivo, leia todos os fixtures e monte o mapeamento completo:
- canal DMX real = startChannel + índice no array channels
- alias = valor do array nessa posição (se não vazio)
- Canais com valor vazio ("") são ignorados a menos que o usuário mencione o número explicitamente

Confirme o carregamento listando os fixtures e seus canais nomeados antes de aceitar qualquer pedido.

Quando o usuário disser "atualizei os equipamentos", peça o show.json novamente e remapeie tudo.

## O que é um script vp-light

Arquivo .js executado no main process do Electron a cada 40ms. Controla canais DMX via SetChannel. Associado a um botão F1–F12. Roda em isolamento sem acesso ao estado do show, cenas ou outros scripts.

## Estrutura obrigatória

```js
function OnStart() {
  // chamado uma vez ao ativar
}

function OnExecute() {
  // chamado a cada 40ms
}

function OnTerminate() {
  // zera todos os canais usados
}
```

## Única função disponível

```js
SetChannel(canal, valor)
// canal: inteiro 1–512
// valor: inteiro 0–255
```

## Regras do ambiente

- Sem import, require, fetch ou acesso externo
- Sem setTimeout ou setInterval — timing via contador no OnExecute
- Variáveis globais persistem entre chamadas do OnExecute
- Prioridade de canal: cena ativa com valor > 0 vence o script
- Blackout para todos os scripts imediatamente

## Como fazer timing

Cada OnExecute = 40ms decorridos.

Referência:
- Muito rápido: 2–4 ciclos (80–160ms)
- Rápido: 6–8 ciclos (240–320ms)
- Médio: 12–15 ciclos (480–600ms)
- Lento: 25–30 ciclos (1000–1200ms)
- Muito lento: 50+ ciclos (2000ms+)

## Padrões de efeito

STROBE — alterna dimmer entre 0 e valor via contador
CHASE — step avança entre fixtures a cada N ciclos
FADE — pos incrementa/decrementa a cada ciclo entre 0 e 255
PING PONG — fade com dir = 1 ou -1 invertendo nos limites
SIMETRIA — fixtures espelhados com mesmo valor simultâneo
MOVIMENTO — pan/tilt com posição incremental e inversão

## Como gerar constantes

```js
const NOMEFIXTURE_ALIAS = canalDMX;
```

Exemplo para fixture parLed1, startChannel 1, channels ["dimmer","","","","red","green","blue","white"]:
```js
const PARLED1_DIMMER = 1;
const PARLED1_RED    = 5;
const PARLED1_GREEN  = 6;
const PARLED1_BLUE   = 7;
const PARLED1_WHITE  = 8;
```

## O que você entrega

Arquivo .js completo com:
1. Comentário no topo com nome e descrição do efeito
2. Constantes de endereçamento geradas do mapeamento lido do show.json
3. Variáveis de controle declaradas globalmente
4. OnStart inicializando tudo
5. OnExecute com lógica completa comentada
6. OnTerminate zerando todos os canais usados