# vp-light — Software DMX para Igreja Vida e Paz

Software DMX desktop para operação ao vivo da Igreja Vida e Paz.
Controla fixtures via Art-Net UDP → SL3000 (Enttec Open DMX) → DMX512.

---

## Instalação (primeira vez)

```bash
git clone <repo>
cd vp-light
npm install
```

---

## Rodar em desenvolvimento

```bash
npm run dev
```

Inicia o Vite (React) na porta 5173 e o Electron em seguida.
O DevTools abre automaticamente em janela separada.
Arquivos em `src/` têm hot reload automático ao salvar.
Arquivos em `electron/` exigem reiniciar o `npm run dev`.

---

## Atalho na área de trabalho / menu

Scripts de setup ficam em `tools/` (separados dos scripts DMX em `scripts/`).

### Windows

Na primeira vez — ou depois de mover/atualizar o projeto — crie os atalhos na Área de Trabalho e no Menu Iniciar:

```bash
npm run setup:windows-app
```

Isso executa `tools/setup-windows-app.ps1` e cria atalhos apontando para `tools/run-vp-light-dev.cmd`, que inicia o app com `npm run dev`.

Se o atalho parar de funcionar após uma atualização do repositório, rode o comando de novo para recriar os atalhos com os caminhos corretos.

### Linux (Ubuntu)

```bash
npm run setup:linux-app
```

Cria o item **VP Light** no menu de aplicativos, usando `tools/run-vp-light-dev.sh` (libera portas ocupadas antes e depois do dev).

Alternativa com terminal visível:

```bash
npm run setup:linux-icon
```

Se o atalho fixado na barra ou dock ainda apontar para um caminho antigo, remova-o e adicione de novo pelo menu após rodar o setup.

---

## Estrutura de arquivos

```
vp-light/
├── electron/
│   ├── main.js        ← processo principal: IPC handlers, engine, scripts
│   ├── preload.js     ← bridge IPC: expõe window.vp.*
│   ├── show.js        ← lê/salva o .show.json
│   └── engine/
│       ├── engine.js  ← loop 40ms (25fps)
│       ├── compositor.js ← composição por camadas, scripts e macros
│       ├── universe.js← Uint8Array[512] dos canais DMX
│       └── artnet.js  ← pacotes UDP Art-Net para SL3000
├── src/
│   ├── App.jsx        ← roteador de telas
│   ├── main.jsx       ← entry point React
│   ├── screens/
│   │   ├── Main.jsx         ← tela principal: mesa de aparelhos, faders, cenas, scripts e páginas
│   │   ├── PainelOperacao.jsx ← tela ao vivo: macros, scripts rápidos, page-scripts e cenas
│   │   ├── Viewer3D.jsx     ← visualizador 3D (janela separada via IPC)
│   │   ├── FixturePanel.jsx ← painel de aparelhos: tabela, novo/remover/duplicar
│   │   └── FixtureEditor.jsx← modal: abas Básico e Descrição
│   └── viewer3d/        ← cena Three.js e modelos por tipo de fixture
│   └── store/
│       └── showStore.js ← estado global via React Context
├── scripts/
│   └── *.js           ← scripts de efeito DMX (F1–F12)
├── tools/
│   └── *              ← utilitários do projeto (setup, launcher dev, sync-scripts)
├── banco-de-conhecimento/
│   └── *.md           ← notas por grupo de aparelho injetadas em scripts novos
├── shows/
│   ├── vp.show.json        ← show padrão carregado na inicialização
│   └── fixture_template.json ← modelo aberto pelo fluxo "Criar novo aparelho (AI)"
├── .agents/skills/    ← skills ativas dos agentes
├── skills-desabilitadas/ ← skills arquivadas (fora do runtime)
├── README_SKILL.md    ← documentação estrutural para agentes
├── index.html
├── vite.config.js
└── package.json
```

---

## Fluxo de dados

```
Renderer (React)
  └─ window.vp.*  [preload bridge]
       └─ ipcMain handler  [electron/main.js]
            ├─ universe.js  [estado dos 512 canais]
            └─ compositor.js [camadas de scripts e macros]
                 └─ engine loop 40ms: renderFrame + Art-Net
                      └─ artnet.sendArtDMX()
                           └─ UDP Art-Net: loopback + broadcasts por interface
                                └─ SL3000 → XLR → Fixtures
```

O envio Art-Net mantém um caminho local para `127.0.0.1` e, em paralelo, cria sockets por
interface IPv4 ativa para enviar broadcast pela rede correta. As interfaces são reavaliadas a cada
10 segundos, e o main process também expõe esse diagnóstico por IPC (`artnet:getInterfaces`).
Isso evita depender apenas da rota que o Windows escolheria para `255.255.255.255`.

As pontes `window.vp.*` mantêm o renderer sem acesso direto ao hardware. Entre os contratos mais
importantes estão `setChannelRange` para escrever vários canais com um valor, `restoreState` para
reconstruir o universo a partir de um mapa de canais, `setActiveSceneChannels` para travar a
prioridade das cenas ativas no compositor, e as funções de macro (`createMacro`, `startMacro`,
`stopMacro`, `nextMacroStep`, `removeMacro`, `macroList`, `macroStatus`).

---

## Atalhos de teclado (tela principal)

| Tecla | Ação |
|-------|------|
| A, S, D, F, G, H, J, K, L, Z, X, C, V | Ativa/desativa a cena da página atual ou alterna o script daquela tecla, quando existir |
| Espaço | BLACKOUT |
| ESC | Fecha modal, menu de contexto ou pop-up aberto |

Na tela principal, os botões `PgUp` e `PgDw` mudam a página visual atual. Os botões `F1` a `F12`
ficam na barra inferior e executam scripts globais associados a cada F-key.

---

## Formato do .show.json

```json
{
  "version": "1.0",
  "meta": {
    "name": "Nome do Show",
    "viewport": {
      "grid": { "zoom": 1, "panX": 0, "panY": 0 }
    }
  },
  "fixtures": [
    {
      "id": "fixture_123",
      "name": "parLed1",
      "manufacturer": "Fabricante",
      "model": "Modelo",
      "fixtureType": "par_led",
      "universe": 0,
      "group": "Frente",
      "note": "Observação operacional",
      "startChannel": 1,
      "channelCount": 8,
      "channels": ["dimmer", "strobo", "", "", "red", "green", "blue", "white"],
      "posX": 10,
      "posY": 10,
      "panOffset": 0,
      "tiltOffset": 0,
      "enabled": true
    }
  ],
  "pages": {
    "1": {
      "name": "LOUVOR",
      "scenes": {
        "A": {
          "name": "BASE QUENTE",
          "color": "#cc6600",
          "channels": { "1": 255, "5": 200 }
        }
      }
    }
  },
  "page_scripts": {
    "1": {
      "A": {
        "name": "script-da-cena-a",
        "file": "C:\\vp-light\\scripts\\script-da-cena-a.js"
      }
    }
  },
  "scripts": {
    "F1": {
      "name": "rgb-loop",
      "file": "C:\\vp-light\\scripts\\rgb-loop.js"
    }
  },
  "macros": [
    {
      "id": "macro-louvor",
      "name": "Macro Louvor",
      "mergeMode": "htp",
      "loop": false,
      "steps": [
        {
          "script": "rgb-loop",
          "durationMs": 2000,
          "fadeInMs": 400,
          "fadeOutMs": 400,
          "overlapMs": 200
        }
      ]
    }
  ]
}
```

**Regra de canal DMX:**
`canal DMX real = startChannel + índice no array channels`
O alias (nome do canal) é um rótulo visual usado pelos agentes de script.

Ao salvar, o sistema valida fixtures antes de gravar: `channelCount` precisa bater com o tamanho
de `channels`, a faixa `startChannel..startChannel + channelCount - 1` precisa ficar dentro de
1–512, e duas fixtures não podem ocupar o mesmo canal DMX.

Campos como `manufacturer`, `model`, `fixtureType`, `group`, `universe` e `note` são usados pela
tabela de configuração, pelo painel de descrição, pelo modo agrupado da mesa e pelos agentes de
normalização. `fixtureType` também é o discriminador das funções personalizadas por tipo de
aparelho, como o ALL ON das ribaltas.

`panOffset` e `tiltOffset` são ajustes físicos opcionais para canais com alias `pan` e `tilt`.
O operador continua vendo valores lógicos de 0 a 255 nos faders e snapshots; o backend soma o
offset antes de gravar no universo DMX e subtrai esse offset ao retornar o estado para o renderer.

`page_scripts` guarda scripts associados às teclas de cena por página; `scripts` guarda scripts
globais dos botões `F1` a `F12`; `macros` guarda sequências de scripts com duração, fades, overlap,
modo de mistura e loop. O bloco `meta.viewport.grid` persiste zoom e deslocamento da mesa.

Quando uma fixture fica com `enabled: false`, ela continua registrada no show, mas seus canais não
participam do controle ativo enquanto não houver outra fixture habilitada cobrindo os mesmos canais.
Isso permite manter um aparelho documentado no patch sem mandar DMX para ele.

Os caminhos em `scripts` e `page_scripts` podem aparecer absolutos no arquivo, mas o app recarrega
os scripts pelo `name` dentro de `C:\vp-light\scripts\`. Isso mantém o show mais portátil entre PCs.

---

## Scripts de efeito

Scripts são arquivos `.js` em `C:\vp-light\scripts\`. Existem dois usos:

- **Scripts globais:** associados aos botões `F1` a `F12`.
- **Scripts de cena:** associados a uma tecla de cena da página atual (`A`, `S`, `D`, etc.) e
  salvos em `page_scripts`.

O modelo atual de execução usa composição por camadas. Cada script ativo vira uma camada com seu
próprio buffer de 512 canais. A engine tem um único relógio de 40ms: em cada frame, o compositor
executa os scripts, mistura as camadas e só então o engine envia o universo por Art-Net. Scripts
não têm mais um `setInterval` próprio para renderizar DMX.

Estrutura obrigatória:

```js
function OnStart()    { } // chamado uma vez ao ativar
function OnExecute()  { } // chamado a cada 40ms
function OnTerminate(){ } // chamado ao desativar ou blackout
```

Funções disponíveis dentro do script:

```js
SetChannel(1, 255);                    // define um canal DMX real
const dimmer = getChannel(id, "dimmer"); // resolve um alias de canal de uma fixture
```

`SetChannel` escreve no buffer da camada do script. O compositor aplica as regras de prioridade na
hora de misturar tudo: canais de fixtures desabilitadas são ignorados, e scripts não sobrescrevem
canais bloqueados por cenas ativas. O BLACKOUT para scripts, scripts de cena e macros antes de
zerar o universo.

Para scripts globais: clique direito em um botão `F1`–`F12`, escolha criar/editar/mover/limpar,
e use clique esquerdo para ativar/desativar. Ao criar ou editar, o arquivo abre no VS Code.

Ao criar um script novo, o modal pode incluir um **Banco de conhecimento**. Marcar grupos como
Par LEDs, Ribaltas, Moving Heads, Bruts ou Fita LED faz o app inserir no topo do arquivo comentários
vindos de `banco-de-conhecimento/<grupo>.md`. É um atalho para deixar o script nascer com notas de
canais, valores úteis e cuidados daquele tipo de aparelho. Esses arquivos também documentam
comportamentos específicos do patch atual, como orientação física dos Moving Heads e canais úteis
das Ribaltas.

Para scripts de cena: clique direito em uma tecla de cena na barra inferior. Uma tecla pode guardar
uma cena comum ou um script; ao criar script naquela tecla, a cena existente naquela posição é
removida.

### Macros

Uma macro é uma sequência de scripts já existentes. Ela não substitui o contrato `OnStart`,
`OnExecute` e `OnTerminate`; ela usa esses scripts como passos.

Cada passo pode ter duração, fade-in, fade-out e overlap. Com isso, o compositor consegue fazer
crossfade entre looks: um script vai saindo enquanto o próximo entra. A mistura padrão é HTP, ou
seja, em cada canal vence o valor mais forte; também existe modo linear para somar valores
ponderados. Macros rodam no backend por IPC (`createMacro`, `startMacro`, `stopMacro`,
`nextMacroStep`, `removeMacro`, `macroList`, `macroStatus`) e ficam salvas no campo `macros` do
show.

A tela **Painel de Operação** reúne o uso ao vivo dessas rotinas. A coluna de macros permite criar
uma sequência, iniciar/parar, avançar manualmente para o próximo passo e remover definições. A área
de disparo rápido oferece abas para scripts `F1`–`F12`, page-scripts da página atual e cenas da
página atual, reutilizando a mesma lógica de ativação da mesa principal.

---

## Aparelhos e patch DMX

A tela **Configuração de aparelhos** mostra a lista de fixtures, com filtro por nome, fabricante,
modelo, tipo, endereço e quantidade de canais. O editor de aparelho tem abas **Básico** e
**Descrição**:

- **Básico:** nome, fabricante, modelo, número de canais, canal de início e observações.
- **Descrição:** alias de cada canal DMX, usado nos faders, no painel de descrição e pelos scripts.

Para criar manualmente, use **Criar novo aparelho (Manual)**, preencha os dados e confirme. O
aparelho só entra no show ao clicar em **Confirmar** no editor. Para preparar um cadastro com IA,
use **Criar novo aparelho (AI)**; o sistema abre `shows/fixture_template.json` no VS Code para
servir como modelo.

Na mesa principal, fixtures podem ser arrastadas na grade. A posição usa snap por quadrado e evita
sobreposição visual durante o arraste. A seleção por área permite mover múltiplas fixtures juntas.
O botão `mode` alterna entre o layout manual da grade e um layout agrupado por `group`/tipo de
fixture; no modo agrupado os aparelhos são reorganizados visualmente para operação e seleção, sem
reescrever suas posições salvas.

O painel direito da tela principal exibe **Descrição**: faders dos canais da fixture selecionada
e acompanham a prioridade real do universo — cenas ativas primeiro, depois scripts em execução,
depois zero. Com múltiplas fixtures selecionadas, canais com o mesmo alias são agrupados em um
fader único.

Alguns tipos de fixture podem expor funções personalizadas no painel de faders. Ribaltas usam esse
mecanismo para o ALL ON: o painel agrupa os canais de LED e envia o mesmo valor em lote por
`setChannelRange`, inclusive quando várias ribaltas do mesmo tipo estão selecionadas.

---

## Agentes de IA

Skills **ativas** ficam em `.agents/skills/` (pastas com `SKILL.md`):

- `desenvolvedor-backend`: backend/engine, Art-Net, IPC, scripts de efeito, macros.
- `desenvolvedor-frontend`: UI, telas, tokens do `src/theme.js`, visualizador 3D.
- `fiscal-do-sistema`: sincroniza `README_SKILL.md` e `README.md` a partir de mudanças no código.
- `create-skill`: cria novas skills no projeto.

Skills arquivadas (não usadas pelo runtime) estão em `skills-desabilitadas/`.

Uso rápido:
1. Leia `.agents/skills/<nome>/SKILL.md` para entender o propósito da skill.
2. Abra o chat do agente no VS Code/Cursor e invoque a skill pelo nome.
3. Para gerar scripts, cole `shows/vp.show.json` antes de pedir geração.
4. Ao alterar equipamentos ou o show, atualize e cole `vp.show.json` antes de usar as skills.

---

## Gerando Scripts DMX com agentes

Existem duas formas de gerar scripts DMX para associar a botões `F1`–`F12` ou a teclas de cena:

### 1. Via agente no Cursor / VS Code

Abra o projeto e mencione a skill `desenvolvedor-backend` (scripts diretos) ou
`desenvolvedor-frontend` (UI). Descreva o efeito desejado informando o id da fixture e as
características dos canais (cores, strobo, dimmer, etc.).

O agente deve usar `vp.show.json` para mapear as fixtures e suas funções por canal (via label da
descrição), e então gerar ou orientar a criação do arquivo `.js` na pasta `scripts/` do projeto.

Depois de criar o arquivo, associe-o a uma F-key ou a uma tecla de cena pelo menu de contexto na
tela principal.

### 2. Via Copilot no VS Code (alternativa)

No chat do VS Code, mencione a skill adequada e anexe `shows/vp.show.json`. Descreva o efeito
desejado da mesma forma.

O agente mapeia as fixtures pelo mesmo critério (label da descrição do canal) e gera ou orienta o
arquivo `.js` na pasta `scripts/` do projeto.

Se o arquivo for criado com o app já aberto, use o menu de script para criar/associar ou reabra o
show para recarregar metadados persistidos.

---

> **Nota:** O `vp.show.json` é a fonte da verdade dos equipamentos. Sempre que adicionar ou editar um fixture no sistema e salvar, o arquivo é atualizado automaticamente — o agente vai refletir essas mudanças na próxima vez que for usado.

---

## Hardware necessário

- **SL3000 (Sourlight)** conectada via USB
- **art-net to dmx.exe** (Freestyler) rodando em segundo plano
- Firewall do Windows liberado para a porta 6454 (UDP)

O app envia Art-Net para o receptor local em `127.0.0.1` e também tenta broadcast por cada
interface IPv4 ativa. Isso ajuda quando o computador usa uma interface para internet e outra para a
rede/hostspot de iluminação.

---

## Troubleshooting

**Luz não acende:**
1. Confirme que o `art-net to dmx.exe` está aberto e mostrando "Enttec open DMX interface selected"
2. Verifique se a SL3000 está conectada (LED verde aceso)
3. Confirme que o firewall liberou a porta 6454
4. Se houver mais de uma placa de rede ativa, confira no console as interfaces Art-Net detectadas
   pelo backend; elas são reenumeradas periodicamente pelo módulo `artnet.js`.

**Scripts não aparecem ao reiniciar:**
- Confirme que o campo `scripts` existe no `vp.show.json`
- Para scripts de cena, confirme que o campo `page_scripts` existe no `vp.show.json`
- Confirme que os caminhos dos arquivos `.js` estão corretos

**Show não salva depois de editar aparelhos:**
- Confira se `channelCount` é igual ao tamanho do array `channels`
- Verifique se a faixa de canais da fixture fica entre 1 e 512
- Confirme que o endereço DMX da fixture não sobrepõe outro aparelho

**Engine não inicia:**
- Verifique o console do DevTools por erros no socket UDP
- Confirme que a porta 6454 não está bloqueada pelo firewall
