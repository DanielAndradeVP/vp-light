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

const ARTNET_PORT = 6454;
const BROADCAST_IP = '255.255.255.255';
const ARTDMX_HEADER = Buffer.from([
  // "Art-Net\0"
  0x41, 0x72, 0x74, 0x2D, 0x4E, 0x65, 0x74, 0x00,
  // OpCode ArtDMX = 0x5000 LE
  0x00, 0x50,
  // ProtVer = 14 BE
  0x00, 0x0E,
  // Sequence, Physical
  0x00, 0x00,
  // Universe = 0 LE
  0x00, 0x00,
  // Length = 512 BE
  0x02, 0x00,
]);

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
    });
    socket.on('error', (err) => {
      console.error('[artnet] socket error:', err.message);
      // Recria o socket na próxima chamada
      socket = null;
    });
  }
  return socket;
}

/**
 * Envia um frame ArtDMX para a SL3000.
 * @param {Uint8Array} universeData  512 bytes do universo DMX
 */
function sendArtDMX(universeData) {
  const packet = Buffer.allocUnsafe(18 + 512);
  ARTDMX_HEADER.copy(packet, 0);
  Buffer.from(universeData).copy(packet, 18);

  const sock = getSocket();
  if (!sock) return;

  sock.send(packet, 0, packet.length, ARTNET_PORT, BROADCAST_IP, (err) => {
    if (err) console.error('[artnet] send error:', err.message);
  });
}

function closeSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

module.exports = { sendArtDMX, closeSocket };
