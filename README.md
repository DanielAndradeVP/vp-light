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

## Estrutura de arquivos

```
vp-light/
├── electron/
│   ├── main.js        ← processo principal: IPC handlers, engine, scripts
│   ├── preload.js     ← bridge IPC: expõe window.vp.*
│   ├── show.js        ← lê/salva o .show.json
│   └── engine/
│       ├── engine.js  ← loop 40ms (25fps)
│       ├── universe.js← Uint8Array[512] dos canais DMX
│       └── artnet.js  ← pacotes UDP Art-Net para SL3000
├── src/
│   ├── App.jsx        ← roteador de telas
│   ├── main.jsx       ← entry point React
│   ├── screens/
│   │   ├── Main.jsx         ← tela principal: mesa de aparelhos, faders, cenas A-M, F1-F12
│   │   ├── FixturePanel.jsx ← painel de aparelhos: tabela, novo/remover/duplicar
│   │   └── FixtureEditor.jsx← modal: abas Básico e Descrição
│   └── store/
│       └── showStore.js ← estado global via React Context
├── scripts/
│   └── *.js           ← scripts de efeito DMX (F1–F12)
├── shows/
│   └── vida-e-paz.show.json ← show padrão carregado na inicialização
├── .agents/           ← skills dos agentes VS Code
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
            └─ universe.js  [Uint8Array 512 canais]
                 └─ engine loop 40ms
                      └─ artnet.sendArtDMX()
                           └─ UDP broadcast 255.255.255.255:6454
                                └─ SL3000 → XLR → Fixtures
```

---

## Atalhos de teclado (tela principal)

| Tecla   | Ação                    |
|---------|-------------------------|
| A – M   | Ativa / desativa a cena |
| Espaço  | BLACKOUT                |
| ESC     | Fecha modal aberto      |

---

## Formato do .show.json

```json
{
  "version": "1.0",
  "meta": { "name": "Nome do Show" },
  "fixtures": [
    {
      "id": "fixture_123",
      "name": "parLed1",
      "startChannel": 1,
      "channelCount": 8,
      "channels": ["dimmer", "strobo", "", "", "red", "green", "blue", "white"],
      "posX": 10,
      "posY": 10
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
  "scripts": {
    "F1": {
      "name": "rgb-loop",
      "file": "C:\\vp-light\\scripts\\rgb-loop.js"
    }
  }
}
```

**Regra de canal DMX:**
`canal DMX real = startChannel + índice no array channels`
O alias (nome do canal) é um rótulo visual usado pelos agentes de script.

---

## Scripts de efeito (F1–F12)

Scripts são arquivos `.js` em `C:\vp-light\scripts\` associados aos botões F1–F12.

Estrutura obrigatória:

```js
function OnStart()    { } // chamado uma vez ao ativar
function OnExecute()  { } // chamado a cada 40ms
function OnTerminate(){ } // chamado ao desativar ou blackout
```

Para criar: clique direito no botão F-key → Criar Script → define o nome → abre no VS Code.
Para ativar/desativar: clique esquerdo no botão F-key.

---

## Agentes de IA

O projeto usa agentes no VS Code via `.agents/` para auxiliar o desenvolvimento.

### desenvolvedor-senior-vplight
Engenheiro sênior especialista em todo o projeto. Use para alterações de arquitetura, novos recursos, correção de bugs, IPC, engine DMX e React.

### vp-light-gerador-de-scripts
Gera scripts de efeito `.js` prontos para os botões F1–F12.

Como usar:
1. Abra um novo chat com o agente
2. Cole o conteúdo do `shows/vida-e-paz.show.json`
3. Peça o script no formato:

```
Arquivo: nome-do-script.js
parLed1 — descrição do efeito desejado
```

Se adicionar novos fixtures, diga "atualizei os equipamentos" e cole o show.json atualizado.
PS: Para 

### idealizador-de-cenas-vplight
Agente criativo para planejar atmosferas de iluminação. Lê o show.json, entende os fixtures disponíveis e gera ideias de cenas em linguagem humana — sem código, sem números de canal. A saída serve de entrada para o gerador de scripts.

Use quando quiser: ideias de cenas, planejar o louvor, atmosfera para o altar, preparar o Fire, ou qualquer criação criativa de iluminação.

---

## Gerando Scripts DMX

Existem duas formas de gerar scripts para os botões F1–F12:

### 1. Via CoWork (Claude)

Abra o projeto `C:\vp-light` no CoWork e entre no chat **"Gerar Scripts"**. Mencione a skill `gerador-de-scripts-vplight` e descreva o efeito desejado informando o id do fixture e as características (cores, strobo, dimmer, etc.).

O agente lê automaticamente o `vida-e-paz.show.json` para mapear os fixtures e suas funções por canal (via label da descrição), e gera o arquivo `.js` direto na pasta `scripts/` do projeto.

Reinicie o `npm run dev` para o script aparecer no sistema.

### 2. Via Copilot no VS Code

No chat do VS Code, mencione a skill `gerador-de-scripts-vplight` e anexe o arquivo `vida-e-paz.show.json`. Descreva o efeito desejado da mesma forma.

O agente mapeia os fixtures pelo mesmo critério (label da descrição do canal) e gera o arquivo `.js` na pasta `scripts/` do projeto.

Reinicie o `npm run dev` para o script aparecer no sistema.

---

> **Nota:** O `vida-e-paz.show.json` é a fonte da verdade dos equipamentos. Sempre que adicionar ou editar um fixture no sistema e salvar, o arquivo é atualizado automaticamente — o agente vai refletir essas mudanças na próxima vez que for usado.

---

## Hardware necessário

- **SL3000 (Sourlight)** conectada via USB
- **art-net to dmx.exe** (Freestyler) rodando em segundo plano
- Firewall do Windows liberado para a porta 6454 (UDP)

---

## Troubleshooting

**Luz não acende:**
1. Confirme que o `art-net to dmx.exe` está aberto e mostrando "Enttec open DMX interface selected"
2. Verifique se a SL3000 está conectada (LED verde aceso)
3. Confirme que o firewall liberou a porta 6454

**Scripts não aparecem ao reiniciar:**
- Confirme que o campo `scripts` existe no `vida-e-paz.show.json`
- Confirme que os caminhos dos arquivos `.js` estão corretos

**Engine não inicia:**
- Verifique o console do DevTools por erros no socket UDP
- Confirme que a porta 6454 não está bloqueada pelo firewall

