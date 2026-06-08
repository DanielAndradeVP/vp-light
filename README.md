# vp-light — Software DMX para Igreja Vida e Paz

Software DMX desktop para operação ao vivo. Controla fixtures via
Art-Net UDP → SL3000 (Enttec Open DMX) → DMX512.

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

Isso inicia o Vite (React) na porta 5173 e o Electron em seguida.
O DevTools abre automaticamente em janela separada.

---

## Estrutura de arquivos

```
vp-light/
├── electron/
│   ├── main.js           ← processo principal (IPC handlers, janela)
│   ├── preload.js        ← bridge IPC: expõe window.vp.*
│   ├── show.js           ← lê/salva o .show.json
│   └── engine/
│       ├── engine.js     ← loop 40ms (25fps)
│       ├── universe.js   ← Uint8Array[512] dos canais DMX
│       └── artnet.js     ← pacotes UDP Art-Net para SL3000
├── src/
│   ├── App.jsx           ← roteador de telas
│   ├── main.jsx          ← entry point React
│   ├── screens/
│   │   ├── Main.jsx      ← tela ao vivo: grade A–N, páginas, blackout
│   │   └── SceneEditor.jsx ← faders por canal, preview ao vivo, salvar
│   └── store/
│       └── showStore.js  ← estado global via React Context
├── shows/
│   └── vida-e-paz.show.json ← show padrão carregado na inicialização
├── index.html
├── vite.config.js
└── package.json
```

---

## Fluxo de dados

```
Renderer (React)
  └─ window.vp.activateScene(channels)  [preload bridge]
       └─ IPC: dmx:activateScene
            └─ universe.applyScene(channels)  [main process]
                 └─ engine loop 40ms
                      └─ artnet.sendArtDMX(universe)
                           └─ UDP broadcast 255.255.255.255:6454
                                └─ SL3000 → XLR → Fixtures
```

---

## Atalhos de teclado (tela principal)

| Tecla       | Ação                        |
|-------------|-----------------------------|
| A – N       | Ativa a cena correspondente |
| Espaço      | BLACKOUT                    |
| ← / PgUp    | Página anterior             |
| → / PgDn    | Próxima página              |
| Duplo-clique num botão | Abre editor da cena |

---

## Formato do .show.json

```json
{
  "version": "1.0",
  "meta": { "name": "Nome do Show" },
  "fixtures": [
    {
      "id": "parled_1",
      "name": "ParLed_Deluxe_1",
      "startChannel": 1,
      "channelCount": 8,
      "channels": ["Dimmer", "Red", "Green", "Blue", "White", "Strobe", "Mode", "Speed"]
    }
  ],
  "pages": {
    "1": {
      "name": "LOUVOR",
      "scenes": {
        "A": {
          "name": "BASE QUENTE",
          "channels": { "1": 255, "2": 200, "3": 80 }
        }
      }
    }
  }
}
```

---

## Hardware necessário

- **SL3000 (Sourlight)** conectada via USB
- Driver **Enttec Open DMX** instalado no Windows
- IP do PC deve estar na mesma rede que a SL3000 (ou broadcast funciona mesmo sem)

---

## O que NÃO está no MVP (deixado para depois)

- Scripts de efeito em JavaScript (F-keys)
- DMX Monitor em tempo real (512 canais)
- ShowConfig (tela para editar fixtures)
- Integração com API Claude para geração de cenas

---

## Troubleshooting

**Luz não acende:**
1. Verifique se a SL3000 está conectada (LED aceso)
2. Abra o Wireshark → filtre `udp.port == 6454` → deve aparecer pacotes a cada 40ms
3. Confirme que o driver Enttec Open DMX está instalado e ativo

**Engine não inicia:**
- Verifique o console do DevTools (F12) por erros no socket UDP
- Confirme que a porta 6454 não está bloqueada pelo firewall
