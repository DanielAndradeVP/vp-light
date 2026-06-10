/**
 * sync-scripts.js
 * Associa scripts da pasta scripts/ aos botões F1–F12 no show.json.
 * Uso: node scripts/sync-scripts.js (a partir da raiz do projeto)
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const ROOT        = path.join(__dirname, '..');
const SCRIPTS_DIR = __dirname;
const SHOW_PATH   = path.join(ROOT, 'shows', 'vp.show.json');
const FKEYS       = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];

// ─── Leitura ──────────────────────────────────────────────────────────────────

const scriptFiles = fs.readdirSync(SCRIPTS_DIR)
  .filter(f => f.endsWith('.js') && f !== 'sync-scripts.js')
  .map(f => ({ name: f.slice(0, -3), file: path.join(SCRIPTS_DIR, f) }));

if (!fs.existsSync(SHOW_PATH)) {
  console.error(`Erro: show.json não encontrado em ${SHOW_PATH}`);
  process.exit(1);
}

const show = JSON.parse(fs.readFileSync(SHOW_PATH, 'utf-8'));
if (!show.scripts) show.scripts = {};

// mapa reverso: nome → fkey
const nameToFkey = {};
for (const [fkey, meta] of Object.entries(show.scripts)) {
  nameToFkey[meta.name] = fkey;
}

// ─── Diagnóstico ──────────────────────────────────────────────────────────────

const associated   = scriptFiles.filter(s =>  nameToFkey[s.name]);
const unassociated = scriptFiles.filter(s => !nameToFkey[s.name]);

console.log('\n╔══════════════════════════════╗');
console.log('║   vp-light — Sync Scripts    ║');
console.log('╚══════════════════════════════╝\n');

console.log('Scripts já associados:');
if (associated.length === 0) {
  console.log('  (nenhum)\n');
} else {
  associated.forEach(s => console.log(`  [${nameToFkey[s.name]}] ${s.name}`));
  console.log('');
}

console.log('Scripts sem associação:');
if (unassociated.length === 0) {
  console.log('  (nenhum — tudo já está no show.json)');
  console.log('\nNada a fazer. show.json não foi alterado.\n');
  process.exit(0);
}
unassociated.forEach(s => console.log(`  · ${s.name}`));

const occupiedFkeys = new Set(Object.keys(show.scripts));
const availableFkeys = FKEYS.filter(f => !occupiedFkeys.has(f));

console.log(`\nF-keys livres: ${availableFkeys.length > 0 ? availableFkeys.join(', ') : '(nenhuma — todas ocupadas)'}`);

if (availableFkeys.length === 0 && unassociated.length > 0) {
  console.log('\nAviso: não há F-keys livres. Você pode sobrescrever uma existente ao ser perguntado.\n');
}

// ─── Interação ────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));
}

async function main() {
  console.log('\nPara cada script, informe a F-key desejada ou S para pular:\n');

  const newAssociations = [];
  // cópia local para rastrear o que foi ocupado nesta sessão
  const nowOccupied = new Set(occupiedFkeys);

  for (const script of unassociated) {
    const livres = FKEYS.filter(f => !nowOccupied.has(f));
    const opcoesLabel = livres.length > 0 ? livres.join('/') : 'somente sobrescrita';

    while (true) {
      const raw    = await ask(`  [${script.name}] → F-key (${opcoesLabel}  ou S pular): `);
      const answer = raw.toUpperCase();

      if (answer === 'S' || answer === '') {
        console.log(`  → pulado\n`);
        break;
      }

      if (!FKEYS.includes(answer)) {
        console.log(`  ✗ "${answer}" não é uma F-key válida. Use F1–F12 ou S.\n`);
        continue;
      }

      if (nowOccupied.has(answer)) {
        const existing = show.scripts[answer] || newAssociations.find(a => a.fkey === answer);
        const existingName = existing?.name ?? '(desconhecido)';
        const confirm = await ask(`  ✗ ${answer} já está com "${existingName}". Sobrescrever? (s/N): `);
        if (confirm.toLowerCase() !== 's') {
          console.log('  → mantido. Tente outra F-key.\n');
          continue;
        }
        // remove associação anterior das novas (se for desta sessão)
        const idx = newAssociations.findIndex(a => a.fkey === answer);
        if (idx !== -1) newAssociations.splice(idx, 1);
      }

      newAssociations.push({ fkey: answer, name: script.name, file: script.file });
      nowOccupied.add(answer);
      console.log(`  ✓ ${answer} → ${script.name}\n`);
      break;
    }
  }

  rl.close();

  // ─── Salvar ─────────────────────────────────────────────────────────────────

  if (newAssociations.length === 0) {
    console.log('Nenhuma associação nova. show.json não foi alterado.\n');
    return;
  }

  for (const { fkey, name, file } of newAssociations) {
    show.scripts[fkey] = { name, file };
  }

  fs.writeFileSync(SHOW_PATH, JSON.stringify(show, null, 2), 'utf-8');

  // ─── Resumo ─────────────────────────────────────────────────────────────────

  console.log('╔══════════════════╗');
  console.log('║      Resumo      ║');
  console.log('╚══════════════════╝');
  newAssociations.forEach(({ fkey, name }) => console.log(`  ✓ [${fkey}] ${name}`));
  console.log(`\nshow.json atualizado: ${SHOW_PATH}`);
  console.log('Reinicie o vp-light (npm run dev) para carregar as novas associações.\n');
}

main().catch(err => {
  console.error('\nErro inesperado:', err.message);
  rl.close();
  process.exit(1);
});
