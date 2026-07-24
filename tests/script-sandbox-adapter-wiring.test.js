import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fixtureAdapter = require('../electron/adapter.js');

// electron/main.js nao pode ser importado em teste (require('electron') no topo
// falha fora do processo Electron real). Este teste le o codigo-fonte como texto
// e verifica que toda funcao semantica exportada por adapter.js foi de fato
// conectada ao objeto `adapter` injetado na sandbox de scripts (buildScriptSandbox).
// Existe pra nao repetir o achado C8 da auditoria de 24-07-2026: setFocus/setFrost/
// setPrismRotation foram implementadas e testadas, mas ficaram fora da sandbox —
// qualquer script real que as chamasse recebia TypeError, e nenhum teste unitario
// pegou isso porque testam o modulo isolado, nao a integracao com a sandbox.
const NOT_SANDBOX_FACING = new Set(['normalizeKey', 'clampDmx']);

describe('sandbox de scripts expõe todas as funções semânticas do adapter', () => {
  it('todo export set*/getCapabilities de adapter.js aparece referenciado dentro de buildScriptSandbox', () => {
    const mainJsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'electron', 'main.js');
    const source = fs.readFileSync(mainJsPath, 'utf-8');

    const start = source.indexOf('function buildScriptSandbox');
    const end = source.indexOf('\nfunction ', start + 1);
    expect(start).toBeGreaterThan(-1);
    const sandboxBody = source.slice(start, end === -1 ? undefined : end);

    const exportedNames = Object.keys(fixtureAdapter).filter((name) => !NOT_SANDBOX_FACING.has(name));
    const missing = exportedNames.filter((name) => !sandboxBody.includes(`fixtureAdapter.${name}`) && name !== 'resolve');

    expect(missing).toEqual([]);
    // `resolve` é exposto sob o mesmo nome, mas via resolveAdapterValue() (wrapper legado) — checagem separada.
    expect(sandboxBody).toContain('resolve:');
  });
});
