import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

// Reproducao fiel (nao um import) do compileScriptContext de electron/main.js —
// main.js nao pode ser importado em teste (require('electron') no topo falha
// fora do processo Electron real, limitacao estrutural ja conhecida do
// projeto). Mantenha esta logica em sincronia com main.js sempre que aquele
// arquivo mudar compileScriptContext/SCRIPT_HOOK_TIMEOUT_MS.
//
// Objetivo: provar que um script com loop infinito em OnStart/OnExecute/
// OnTerminate (ou no topo do arquivo) é interrompido pelo timeout do `vm`
// em vez de travar o processo pra sempre — achado C1 da auditoria de
// 24-07-2026 ("new Function sem isolamento, sem watchdog/timeout").
const SCRIPT_HOOK_TIMEOUT_MS = 30;
const CALL_ON_START = new vm.Script('OnStart();', { filename: 'call-onstart.js' });
const CALL_ON_EXECUTE = new vm.Script('OnExecute();', { filename: 'call-onexecute.js' });
const CALL_ON_TERMINATE = new vm.Script('OnTerminate();', { filename: 'call-onterminate.js' });

function compileScriptContext(code, sandboxGlobals) {
  const context = vm.createContext({ ...sandboxGlobals });
  const definitionScript = new vm.Script(code, { filename: 'script.js' });
  definitionScript.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS });

  const ctx = {};
  ctx.OnStart = typeof context.OnStart === 'function'
    ? () => CALL_ON_START.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS })
    : null;
  ctx.OnExecute = typeof context.OnExecute === 'function'
    ? () => CALL_ON_EXECUTE.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS })
    : null;
  ctx.OnTerminate = typeof context.OnTerminate === 'function'
    ? () => CALL_ON_TERMINATE.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS })
    : null;
  return ctx;
}

function makeSandbox() {
  const writes = [];
  return {
    writes,
    globals: {
      SetChannel: (ch, val) => writes.push([ch, val]),
      getChannel: () => 1,
      adapter: { setColor: () => ({ ok: true }) },
    },
  };
}

describe('watchdog de execução de script (vm timeout)', () => {
  it('script bem comportado roda normalmente e mantém estado entre frames', () => {
    const { globals, writes } = makeSandbox();
    const ctx = compileScriptContext(`
      let counter = 0;
      function OnStart() { SetChannel(1, 10); }
      function OnExecute() { counter++; SetChannel(2, counter); }
      function OnTerminate() { SetChannel(3, 255); }
    `, globals);

    ctx.OnStart();
    ctx.OnExecute();
    ctx.OnExecute();
    ctx.OnExecute();
    ctx.OnTerminate();

    expect(writes).toEqual([[1, 10], [2, 1], [2, 2], [2, 3], [3, 255]]);
  });

  it('OnExecute com loop infinito é interrompido pelo timeout, sem travar o processo', () => {
    const { globals } = makeSandbox();
    const ctx = compileScriptContext(`
      function OnExecute() { while (true) {} }
    `, globals);

    const start = Date.now();
    expect(() => ctx.OnExecute()).toThrow(/timed out/i);
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('recursão infinita em OnStart também é interrompida pelo timeout', () => {
    const { globals } = makeSandbox();
    const ctx = compileScriptContext(`
      function loop() { return loop(); }
      function OnStart() { loop(); }
    `, globals);

    expect(() => ctx.OnStart()).toThrow();
  });

  it('loop infinito no topo do script (fora de função) é interrompido na compilação', () => {
    const { globals } = makeSandbox();
    expect(() => compileScriptContext('while (true) {}', globals)).toThrow(/timed out/i);
  });

  it('hooks ausentes continuam null, igual ao comportamento original', () => {
    const { globals } = makeSandbox();
    const ctx = compileScriptContext('function OnExecute() {}', globals);
    expect(ctx.OnStart).toBeNull();
    expect(typeof ctx.OnExecute).toBe('function');
    expect(ctx.OnTerminate).toBeNull();
  });
});
