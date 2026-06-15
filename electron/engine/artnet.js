/**
 * artnet.js — Envia pacotes Art-Net (ArtDMX) via UDP
 *
 * Estratégia de envio (3 canais):
 *   1. Loopback 127.0.0.1  — app receptor local; sempre funciona independente de rede
 *   2. Broadcast dirigido por interface — um socket por interface IPv4 ativa, vinculado
 *      ao IP local daquela interface, enviando para o broadcast da sub-rede dela.
 *      Isso garante que o pacote saia pela interface CERTA mesmo quando há múltiplas
 *      interfaces ativas (ex: adaptador USB p/ internet + Wi-Fi hotspot p/ Art-Net).
 *   3. Broadcast global 255.255.255.255 (fallback) — usado apenas se não houver
 *      nenhuma interface disponível para envio dirigido.
 *
 * Por que broadcast dirigido resolve o problema:
 *   O Windows roteia 255.255.255.255 pela interface de menor métrica (geralmente a que
 *   tem acesso à internet). Quando o SL3000 está em outra sub-rede (ex: Wi-Fi hotspot),
 *   os pacotes não chegam. Com um socket vinculado ao IP da interface correta, o OS não
 *   tem escolha — o pacote sai por aquela interface.
 *
 * Protocolo Art-Net:
 *   "Art-Net\0" (8 bytes) | Opcode ArtDMX 0x5000 LE | ProtVer 14 BE |
 *   Sequence(0) Physical(0) | Universe 0 LE | Length 512 BE | DMX[512]
 *   Total: 530 bytes
 */

const dgram = require('dgram');
const os    = require('os');

const ARTNET_PORT    = 6454;
const LOOPBACK_IP    = '127.0.0.1';
const BROADCAST_GLOBAL = '255.255.255.255';
const IFACE_REFRESH_MS = 10_000; // re-enumera interfaces a cada 10s

// ─── Pacote pré-alocado (reutilizado a cada frame, sem GC a 25fps) ─────────
const packet = Buffer.alloc(18 + 512);
packet[0]  = 0x41; packet[1]  = 0x72; packet[2]  = 0x74; packet[3]  = 0x2D; // "Art-"
packet[4]  = 0x4E; packet[5]  = 0x65; packet[6]  = 0x74; packet[7]  = 0x00; // "Net\0"
packet[8]  = 0x00; packet[9]  = 0x50;                                         // OpCode ArtDMX 0x5000 LE
packet[10] = 0x00; packet[11] = 0x0E;                                         // ProtVer 14 BE
packet[12] = 0x00; packet[13] = 0x00;                                         // Sequence, Physical
packet[14] = 0x00; packet[15] = 0x00;                                         // Universe 0 LE
packet[16] = 0x02; packet[17] = 0x00;                                         // Length 512 BE

// ─── Socket loopback (primário, sempre ativo) ───────────────────────────────
let loopbackSocket = null;
let loopbackErrors = 0;
const MAX_LOOPBACK_ERRORS = 10;

function getLoopbackSocket() {
  if (!loopbackSocket) {
    loopbackSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    loopbackSocket.bind(() => {
      try {
        loopbackSocket.setBroadcast(true);
        loopbackSocket.unref();
      } catch (e) {
        console.error('[artnet] loopback setBroadcast error:', e.message);
      }
    });
    loopbackSocket.on('error', (err) => {
      console.error('[artnet] loopback socket error:', err.message);
      loopbackSocket = null;
    });
  }
  return loopbackSocket;
}

// ─── Sockets por interface (broadcast dirigido) ─────────────────────────────
// Map: localIP → { sock: Socket, broadcast: string, name: string }
const ifaceSockets = new Map();
let refreshTimer = null;

/**
 * Calcula o endereço de broadcast da sub-rede dado o IP e a máscara.
 * Ex: ip='192.168.1.5' mask='255.255.255.0' → '192.168.1.255'
 */
function computeDirectedBroadcast(ip, netmask) {
  const ipParts   = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  return ipParts.map((p, i) => (p | (~maskParts[i] & 0xff))).join('.');
}

/**
 * Retorna todas as interfaces IPv4 não-loopback e não link-local disponíveis.
 */
function listActiveIPv4Interfaces() {
  const result = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      // Ignora link-local (169.254.x.x) — autoconfiguração sem DHCP, inútil para Art-Net
      if (addr.address.startsWith('169.254.')) continue;
      result.push({
        name,
        address:   addr.address,
        netmask:   addr.netmask,
        broadcast: computeDirectedBroadcast(addr.address, addr.netmask),
      });
    }
  }
  return result;
}

/**
 * Sincroniza o mapa de sockets com as interfaces atualmente ativas.
 * - Fecha sockets de interfaces que desapareceram.
 * - Cria sockets vinculados para interfaces novas.
 * Chamada na inicialização e periodicamente.
 */
async function refreshIfaceSockets() {
  const activeInterfaces = listActiveIPv4Interfaces();
  const activeIPs = new Set(activeInterfaces.map(i => i.address));

  // Fecha sockets de interfaces que sumiram
  for (const [ip, entry] of ifaceSockets) {
    if (!activeIPs.has(ip)) {
      try { entry.sock.close(); } catch (_) {}
      ifaceSockets.delete(ip);
      console.log(`[artnet] interface removida: ${entry.name} (${ip})`);
    }
  }

  // Cria sockets para interfaces novas
  for (const iface of activeInterfaces) {
    if (ifaceSockets.has(iface.address)) continue;

    try {
      const sock = await new Promise((resolve, reject) => {
        const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        s.bind({ address: iface.address, port: 0 }, () => {
          try {
            s.setBroadcast(true);
            s.unref();
            resolve(s);
          } catch (e) {
            try { s.close(); } catch (_) {}
            reject(e);
          }
        });
        s.on('error', (err) => {
          console.error(`[artnet] socket (${iface.address}) error: ${err.message}`);
          ifaceSockets.delete(iface.address);
          try { s.close(); } catch (_) {}
        });
      });

      ifaceSockets.set(iface.address, {
        sock,
        broadcast: iface.broadcast,
        name:      iface.name,
      });
      console.log(`[artnet] interface adicionada: ${iface.name} (${iface.address}) → broadcast ${iface.broadcast}`);
    } catch (e) {
      console.error(`[artnet] falha ao criar socket para ${iface.address} (${iface.name}): ${e.message}`);
    }
  }
}

function startIfaceRefresh() {
  if (refreshTimer) return;
  // Primeira rodada imediata (assíncrona — não bloqueia o start do engine)
  refreshIfaceSockets().catch(e => console.error('[artnet] refresh inicial:', e.message));
  refreshTimer = setInterval(() => {
    refreshIfaceSockets().catch(e => console.error('[artnet] refresh periódico:', e.message));
  }, IFACE_REFRESH_MS);
  if (refreshTimer.unref) refreshTimer.unref();
}

// Inicia a gestão de interfaces imediatamente ao carregar o módulo
startIfaceRefresh();

// ─── Envio ──────────────────────────────────────────────────────────────────

/**
 * Envia um frame ArtDMX para todos os destinos.
 * Reutiliza buffer pré-alocado — sem pressão de GC a 25fps.
 * @param {Uint8Array} universeData  512 bytes do universo DMX
 */
function sendArtDMX(universeData) {
  // Copia os 512 bytes de DMX para o buffer (header permanece intacto)
  Buffer.from(universeData).copy(packet, 18);

  // 1) Loopback — receptor local; health check do socket principal
  const ls = getLoopbackSocket();
  if (ls) {
    ls.send(packet, 0, packet.length, ARTNET_PORT, LOOPBACK_IP, (err) => {
      if (err) {
        loopbackErrors++;
        console.error(`[artnet] loopback error (${loopbackErrors}/${MAX_LOOPBACK_ERRORS}): ${err.message}`);
        if (loopbackErrors >= MAX_LOOPBACK_ERRORS) {
          console.error('[artnet] muitas falhas — recriando socket loopback');
          try { loopbackSocket.close(); } catch (_) {}
          loopbackSocket = null;
          loopbackErrors = 0;
        }
      } else {
        loopbackErrors = 0;
      }
    });
  }

  // 2) Broadcast por interface — cada socket está vinculado ao IP da interface,
  //    forçando a saída por ela. Usa 255.255.255.255 (não directed broadcast) porque:
  //    a) Windows bloqueia directed broadcasts (ex: 172.20.10.15) por padrão.
  //    b) 255.255.255.255 é entregue localmente a TODOS os processos no mesmo PC
  //       escutando na porta 6454, independente de qual interface o pacote sai —
  //       isso é essencial quando o Art-Net to DMX roda na mesma máquina.
  if (ifaceSockets.size > 0) {
    for (const [, entry] of ifaceSockets) {
      entry.sock.send(packet, 0, packet.length, ARTNET_PORT, BROADCAST_GLOBAL, () => {});
    }
    return;
  }

  // 3) Fallback: broadcast global via socket loopback (usado só se nenhuma
  //    interface foi detectada ainda — ex: durante os primeiros 200ms do startup)
  if (ls) {
    ls.send(packet, 0, packet.length, ARTNET_PORT, BROADCAST_GLOBAL, () => {});
  }
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * Retorna snapshot das interfaces ativas e seus broadcasts.
 * Útil para IPC de diagnóstico / seleção manual de interface.
 */
function getActiveInterfaces() {
  return Array.from(ifaceSockets.entries()).map(([ip, entry]) => ({
    name:      entry.name,
    address:   ip,
    broadcast: entry.broadcast,
  }));
}

/**
 * Fecha todos os sockets (chamado pelo engine ao parar).
 */
function closeSocket() {
  // Loopback
  if (loopbackSocket) {
    try { loopbackSocket.close(); } catch (_) {}
    loopbackSocket = null;
  }
  // Por interface
  for (const [, entry] of ifaceSockets) {
    try { entry.sock.close(); } catch (_) {}
  }
  ifaceSockets.clear();
  // Para o timer de refresh
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  console.log('[artnet] sockets fechados');
}

module.exports = { sendArtDMX, closeSocket, getActiveInterfaces };
