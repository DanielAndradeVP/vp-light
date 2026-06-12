#!/usr/bin/env node
/**
 * modo.js — Alterna o show entre modo desenvolvimento (casa) e produção (igreja).
 *
 * Uso:
 *   node modo.js producao       → parLed1 OFF, ParLed_Deluxe_1 ON  (todos os 9 PAR LEDs ativos)
 *   node modo.js desenvolvimento → parLed1 ON,  ParLed_Deluxe_1 OFF (fixture de teste ativo)
 */

const fs   = require('fs');
const path = require('path');

const SHOW_PATH      = path.join(__dirname, 'shows', 'vp.show.json');
const ID_TESTE       = 'fixture_1780805067518';                      // parLed1 (casa)
const ID_DELUXE_1    = 'fixture_1780805067518_parled_deluxe_1';      // ParLed_Deluxe_1 (igreja)

const modo = process.argv[2];

if (!['producao', 'desenvolvimento'].includes(modo)) {
  console.error('Uso: node modo.js producao | desenvolvimento');
  process.exit(1);
}

const show = JSON.parse(fs.readFileSync(SHOW_PATH, 'utf8'));

show.fixtures.forEach(f => {
  if (f.id === ID_TESTE) {
    f.enabled = (modo === 'desenvolvimento');
    console.log(`parLed1           → enabled: ${f.enabled}  ${f.enabled ? '(ativo - modo teste)' : '(desativado)'}`);
  }
  if (f.id === ID_DELUXE_1) {
    f.enabled = (modo === 'producao');
    console.log(`ParLed_Deluxe_1   → enabled: ${f.enabled}  ${f.enabled ? '(ativo - modo produção)' : '(desativado)'}`);
  }
});

fs.writeFileSync(SHOW_PATH, JSON.stringify(show, null, 2), 'utf8');
console.log(`\nShow salvo. Modo: ${modo.toUpperCase()} ✓`);
console.log('Reabra o show no vp-light para carregar as alterações.');
