# Incidente — Sem sinal em nenhum equipamento após queda de energia (24-07-2026)

> **Status:** RESOLVIDO ao vivo durante o culto.
> **Correção aplicada:** `sudo systemctl restart olad`.
> **Impacto:** apagão total de DMX (nenhuma fixture recebia sinal) por alguns minutos.
> **Causa raiz:** o daemon OLA (`olad`) subiu no boot **antes** da rede ter IP, e o
> plugin Art-Net dele não abriu a porta 6454 — então o VP Light mandava o sinal
> corretamente, mas não havia ninguém escutando para repassar ao conversor USB→DMX.

---

## 1. Resumo executivo

Depois que o PC desligou sozinho (queda de energia) e voltou, **nenhum equipamento
recebia mais sinal DMX**. O aplicativo VP Light estava rodando normalmente e enviando
Art-Net sem erro, mas as luzes não acendiam.

O problema **não era** do VP Light, nem do cabo, nem (na origem) de energia do SL3000.
A cadeia real de sinal deste rig é:

```
VP Light (Electron)  →  Art-Net UDP :6454  →  OLA (olad)  →  USB FTDI /dev/ttyUSB0
                                                              (Enttec Open DMX / SL3000)
                                                              →  DMX512  →  fixtures
```

O elo que quebrou foi o **OLA**: ele estava rodando, mas o plugin Art-Net não estava
escutando na porta 6454. Reiniciar o `olad` — com a rede já pronta — recolocou o plugin
no ar e o sinal voltou em segundos (o VP Light já estava transmitindo continuamente).

---

## 2. Linha do tempo

| Hora (aprox.) | Evento |
|---|---|
| — | Queda de energia; PC desliga sozinho no meio da operação. |
| 20:14:41 | Boot do sistema. `olad` inicia via systemd (`/etc/init.d/olad`). **Nesse instante a placa de rede `enp0s31f6` ainda não tinha IP.** |
| ~20:17 | `enp0s31f6` recebe IP por DHCP (192.168.18.8). VP Light sobe e loga `[artnet] interface adicionada: enp0s31f6`. |
| durante o culto | Operador reporta: nenhuma luz acende, "não chega sinal em equipamento nenhum". |
| durante o culto | Diagnóstico completo → identificado OLA sem escutar na 6454. |
| durante o culto | `sudo systemctl restart olad` → **luz volta**. Incidente encerrado. |

---

## 3. Sintomas relatados vs. realidade

- **Relatado:** "a luz não acende", "não chega sinal em nenhum equipamento", e depois
  "o SL3000 dá baixa e liga de novo" (suspeita de energia/brownout).
- **Realidade confirmada por evidência:** o SL3000/conversor USB estava conectado e
  reconhecido pelo SO o tempo todo; o problema era puramente o OLA não repassar o
  Art-Net para o USB. A pista de "energia/brownout" foi um **falso positivo** — o
  reinício do `olad` resolveu sem qualquer mexida elétrica.

> Lição: quando "some o sinal de tudo de uma vez" após um reboot, verificar a **ponte
> Art-Net→USB (OLA)** antes de assumir hardware/energia.

---

## 4. Evidências coletadas no diagnóstico

1. **USB OK** — `/dev/ttyUSB0` presente; `lsusb` mostra `0403:6001 FTDI FT232 Serial (UART)`
   (o conversor Enttec Open DMX / SL3000), serial `A50285BI`.
2. **VP Light OK** — engine rodando a 25fps; log `[engine] iniciado @ 25fps`;
   `[artnet] interface adicionada: enp0s31f6 (192.168.18.8)`; teste manual de envio de
   pacote Art-Net saiu **sem erro do SO** pela interface correta.
3. **Rede OK** — ping no gateway `192.168.18.1` respondeu em ~0,5ms.
4. **O elo quebrado** — `ss -uln` mostrou **ninguém escutando na UDP 6454**.
5. **OLA rodando, mas plugin Art-Net inativo** — `olad` no ar (PID 1978), porém
   `ola_dev_info` **não listava nenhum device Art-Net** (plugin carregado, zero portas).
6. **Configuração estava correta e persistida** — logo, era só timing de boot:
   - `ola_dev_info`: FTDI `A50285BI` **patched to universe 0** (saída USB OK).
   - `/etc/ola/ola-port.conf`: linha `2-1-I-0 = 0` → **entrada Art-Net (plugin 2) porta 0
     patchada no universo 0** (entrada OK, salva).
   - `/etc/ola/ola-artnet.conf`: `enabled = true`, `ip =` (auto), `use_loopback = false`.

---

## 5. Causa raiz

`olad` é um serviço de sistema (systemd, via `/etc/init.d/olad`) que **inicia cedo no
boot**. O plugin Art-Net do OLA, ao subir, precisa de uma interface de rede com IP
válido para abrir a porta 6454. Como:

- o `olad` iniciou às **20:14:41**, e
- a `enp0s31f6` só recebeu IP por volta das **20:17** (DHCP), e
- a config tem `use_loopback = false` (não usa nem a interface de loopback),

no momento em que o plugin Art-Net tentou inicializar **não havia nenhuma interface
utilizável**. Resultado: o plugin não criou device de entrada e **não abriu a 6454**.

O VP Light seguia enviando Art-Net corretamente (loopback + broadcast), mas **não havia
receptor** → nada chegava ao `/dev/ttyUSB0` → nada de DMX → apagão total.

Nada disso é defeito de código do VP Light. É uma condição de corrida de **ordem de
inicialização no boot** (serviço de rede vs. `olad`).

---

## 6. Correção aplicada (imediata)

```bash
sudo systemctl restart olad
```

Com a rede já no ar, o plugin Art-Net reinicializou, abriu a 6454, restaurou o patch
`entrada Art-Net → universo 0` (que já estava salvo em `ola-port.conf`) e o sinal
retornou. Como o VP Light nunca parou de transmitir, a luz voltou em **1–2 segundos**.

---

## 7. Correção permanente recomendada (para não repetir a cada reboot)

Ainda **não aplicada** (exige `sudo` / permissão do grupo `olad`; deixada para um momento
fora do culto). Duas opções, da mais robusta para a complementar:

### 7.1. (Recomendado) Ativar loopback no plugin Art-Net do OLA

O VP Light **sempre** envia Art-Net para o loopback `127.0.0.1` como canal primário
(ver `electron/engine/artnet.js`). Se o OLA escutar no loopback, ele **recebe o sinal
independentemente de a placa de rede estar pronta ou não** no boot — imunizando contra
exatamente esta falha.

Editar `/etc/ola/ola-artnet.conf`:

```diff
- use_loopback = false
+ use_loopback = true
```

Depois: `sudo systemctl restart olad`.

### 7.2. (Complementar) Garantir que o `olad` só suba após a rede

Fazer o serviço esperar a rede online (ex.: dependência `network-online.target`), para
que, mesmo sem loopback, o plugin Art-Net encontre a interface no primeiro start.

> Aplicando 7.1, o item 7.2 vira opcional — o loopback já resolve o caso.

---

## 8. Ação relacionada nesta sessão (código do VP Light)

Durante a investigação foi corrigido um **bug latente separado** em
`electron/engine/artnet.js`: o código descartava interfaces com IP link-local
(`169.254.x.x`), o que quebraria o cenário de **PC ligado direto no SL3000 por cabo, sem
DHCP** (item A-05 da auditoria pré-evento). O filtro foi removido.

- **Este bug NÃO foi a causa deste incidente** (aqui a `enp0s31f6` tinha IP de DHCP).
- A alteração só passa a valer após reiniciar o `npm run dev` — **não reiniciado durante
  o culto** de propósito, para não interromper a operação ao vivo.

---

## 9. Checklist rápido para o operador (se sumir o sinal de novo)

1. As luzes do VP Light (UI) reagem, mas o palco não? → provavelmente a ponte OLA.
2. Rodar no terminal: `ss -uln | grep 6454`.
   - Se **não aparecer nada** → OLA não está escutando → `sudo systemctl restart olad`.
   - Se aparecer → o problema é a jusante (USB/cabo/SL3000/fixture).
3. Conferir USB: `ls /dev/ttyUSB0` deve existir.
4. Só depois disso investigar energia/cabo físico do SL3000.
