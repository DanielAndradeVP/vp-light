/**
 * artnet.js — Envia pacotes Art-Net (ArtDMX) via UDP broadcast
 *
 * Protocolo:
 *   "Art-Net\0" (8 bytes)
 *   Opcode ArtDMX: 0x5000 little-endian (2 bytes)
 *   ProtVer: 14 big-endian (2 bytes)
 *   Sequence: 0 (1 byte)
 *   Physical: 0 (1 byte)
 *   Universe: 0 little-endian (2 bytes)
 *   Length: 512 big-endian (2 bytes)
 *   DMX Data: 512 bytes
 *   Total: 530 bytes
 */

const dgram = require('dgram');

const ARTNET_PORT  = 6454;
const BROADCAST_IP = '255.255.255.255';

// Buffer pré-alocado reutilizado em todos os frames — sem alocação por frame
const packet = Buffer.alloc(18 + 512);
// Escreve o header Art-Net uma única vez
packet[0]  = 0x41; packet[1]  = 0x72; packet[2]  = 0x74; packet[3]  = 0x2D; // "Art-"
packet[4]  = 0x4E; packet[5]  = 0x65; packet[6]  = 0x74; packet[7]  = 0x00; // "Net\0"
packet[8]  = 0x00; packet[9]  = 0x50;                                         // OpCode ArtDMX 0x5000 LE
packet[10] = 0x00; packet[11] = 0x0E;                                         // ProtVer 14 BE
packet[12] = 0x00; packet[13] = 0x00;                                         // Sequence, Physical
packet[14] = 0x00; packet[15] = 0x00;                                         // Universe 0 LE
packet[16] = 0x02; packet[17] = 0x00;                                         // Length 512 BE

// Contagem de erros consecutivos de envio — após limite, fecha e recria o socket
let consecutiveSendErrors = 0;
const MAX_SEND_ERRORS = 10;

// Socket único — criado uma vez, reutilizado em todos os frames
let socket = null;

function getSocket() {
  if (!socket) {
    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    socket.bind(() => {
      try {
        socket.setBroadcast(true);
      } catch (e) {
        console.error('[artnet] setBroadcast error:', e.message);
      }
      socket.unref(); // não impede o processo de encerrar normalmente
    });
    socket.on('error', (err) => {
      console.error('[artnet] socket error:', err.message);
      socket = null; // recria na próxima chamada
    });
  }
  return socket;
}

/**
 * Envia um frame ArtDMX para a SL3000.
 * Reutiliza buffer pré-alocado — sem pressão de GC a 25fps.
 * @param {Uint8Array} universeData  512 bytes do universo DMX
 */
function sendArtDMX(universeData) {
  // Copia apenas os 512 bytes de dados DMX (bytes 18–529); header permanece intacto
  Buffer.from(universeData).copy(packet, 18);

  const sock = getSocket();
  if (!sock) return;

  sock.send(packet, 0, packet.length, ARTNET_PORT, BROADCAST_IP, (err) => {
    if (err) {
      consecutiveSendErrors++;
      console.error(`[artnet] send error (${consecutiveSendErrors}/${MAX_SEND_ERRORS}):`, err.message);
      if (consecutiveSendErrors >= MAX_SEND_ERRORS) {
        console.error('[artnet] muitas falhas consecutivas — recriando socket');
        if (socket) { try { socket.close(); } catch (_) {} }
        socket = null;
        consecutiveSendErrors = 0;
      }
    } else {
      consecutiveSendErrors = 0;
    }
  });
}

function closeSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

module.exports = { sendArtDMX, closeSocket };
