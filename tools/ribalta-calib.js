/**
 * ribalta-calib.js
 * Liga/desliga a calibração física de tilt das duas ribaltas (Ribalta_1 e Ribalta_2)
 * enquanto o VP Light está rodando, sem precisar reiniciar o app.
 *
 * Uso (a partir da raiz do projeto):
 *   node tools/ribalta-calib.js on       -> ativa a calibração (padrão)
 *   node tools/ribalta-calib.js off      -> desativa (tilt sai cru, sem correção)
 *   node tools/ribalta-calib.js status   -> mostra o estado atual
 *
 * Como funciona: este comando só escreve/lê um arquivo de estado
 * (electron/ribalta-calib-state.json). O processo principal do VP Light observa
 * esse arquivo (chokidar) e aplica a mudança no próximo frame — não afeta o
 * Viewer3D (ele já lê o universo antes desta camada).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATE_PATH = path.join(ROOT, 'electron', 'ribalta-calib-state.json');

function readState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return { enabled: data.enabled !== false };
  } catch (e) {
    return { enabled: true }; // default: calibração ativa
  }
}

function writeState(enabled) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ enabled }, null, 2) + '\n', 'utf-8');
}

const arg = (process.argv[2] || '').trim().toLowerCase();

if (arg === 'on') {
  writeState(true);
  console.log('Calibração física de tilt das ribaltas: ATIVADA.');
} else if (arg === 'off') {
  writeState(false);
  console.log('Calibração física de tilt das ribaltas: DESATIVADA (tilt sai cru).');
} else if (arg === 'status') {
  const { enabled } = readState();
  console.log(`Calibração física de tilt das ribaltas está: ${enabled ? 'ATIVADA' : 'DESATIVADA'}.`);
} else {
  console.error('Uso: node tools/ribalta-calib.js on|off|status');
  process.exit(1);
}
