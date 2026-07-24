import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const compositor = require('../electron/engine/compositor.js');
const universe = require('../electron/engine/universe.js');

function createLayer(channelValues) {
  const buffer = new Uint8Array(512);
  const touched = new Uint8Array(512);

  return {
    buffer,
    touched,
    context: {
      OnExecute: () => {
        for (const [channel, value] of Object.entries(channelValues)) {
          const index = Number(channel) - 1;
          buffer[index] = value;
          touched[index] = 1;
        }
      },
    },
  };
}

describe('compositor - execução simultânea de camadas', () => {
  beforeEach(() => {
    compositor.clearMacros();
    compositor.clearLayers();
    compositor.setMacroStepErrorHandler(null);
    compositor.setMergeMode('htp');
    compositor.setSceneLock(new Uint8Array(512), {});
    compositor.setDisabledChannelsProvider(() => new Set());
    universe.setChannelOffsets({});
    universe.blackout();
  });

  it('mantém duas camadas distintas ativas e renderiza ambas', () => {
    compositor.addLayer('A', createLayer({ 1: 80 }));
    compositor.addLayer('B', createLayer({ 2: 160 }));

    compositor.renderFrame();

    expect(compositor.layerCount()).toBe(2);
    expect(compositor.hasLayer('A')).toBe(true);
    expect(compositor.hasLayer('B')).toBe(true);
    expect(universe.getUniverse()[0]).toBe(80);
    expect(universe.getUniverse()[1]).toBe(160);
  });

  it('mantém cinco camadas distintas ativas e renderiza todas', () => {
    const values = [30, 60, 90, 120, 150];
    values.forEach((value, index) => {
      compositor.addLayer(`layer-${index + 1}`, createLayer({ [index + 1]: value }));
    });

    compositor.renderFrame();

    expect(compositor.layerCount()).toBe(5);
    values.forEach((value, index) => {
      expect(compositor.hasLayer(`layer-${index + 1}`)).toBe(true);
      expect(universe.getUniverse()[index]).toBe(value);
    });
  });

  it('iniciar B não para A', () => {
    compositor.addLayer('A', createLayer({ 1: 100 }));
    compositor.renderFrame();
    expect(universe.getUniverse()[0]).toBe(100);

    compositor.addLayer('B', createLayer({ 2: 200 }));
    compositor.renderFrame();

    expect(compositor.hasLayer('A')).toBe(true);
    expect(compositor.hasLayer('B')).toBe(true);
    expect(compositor.layerCount()).toBe(2);
    expect(universe.getUniverse()[0]).toBe(100);
    expect(universe.getUniverse()[1]).toBe(200);
  });

  it('parar C não afeta A nem B', () => {
    compositor.addLayer('A', createLayer({ 1: 50 }));
    compositor.addLayer('B', createLayer({ 2: 100 }));
    compositor.addLayer('C', createLayer({ 3: 150 }));
    compositor.renderFrame();

    expect(compositor.stopLayer('C')).toBe(true);
    compositor.renderFrame();

    expect(compositor.hasLayer('A')).toBe(true);
    expect(compositor.hasLayer('B')).toBe(true);
    expect(compositor.hasLayer('C')).toBe(false);
    expect(compositor.layerCount()).toBe(2);
    expect(universe.getUniverse()[0]).toBe(50);
    expect(universe.getUniverse()[1]).toBe(100);
  });

  it('parar uma camada com OnTerminate vazio não reaplica o último look ao universo (achado C-01 da auditoria de 24-07-2026)', () => {
    // Antes do fix, _removeLayerInternal chamava OnTerminate sem limpar
    // buffer/touched primeiro — como touched ainda carregava o último frame
    // renderizado (100% ligado), _flushLayerToUniverse reescrevia
    // explicitamente esse valor obsoleto no universo, mesmo quando o
    // template padrão de script gera um OnTerminate vazio (caso comum, não
    // extremo). O canal deve permanecer como já estava (sem uma nova escrita
    // redundante), não porque alguém decidiu "reaplicar 100%".
    compositor.addLayer('effect', createLayer({ 1: 255 }));
    compositor.renderFrame();
    expect(universe.getUniverse()[0]).toBe(255);

    const setChannelSpy = vi.spyOn(universe, 'setChannel');
    compositor.stopLayer('effect');

    expect(setChannelSpy).not.toHaveBeenCalled();
    setChannelSpy.mockRestore();
  });

  it('parar uma camada cujo OnTerminate limpa só parte dos canais tocados não reaplica os demais', () => {
    const buffer = new Uint8Array(512);
    const touched = new Uint8Array(512);
    compositor.addLayer('effect', {
      buffer, touched,
      context: {
        OnExecute: () => { buffer[0] = 200; touched[0] = 1; buffer[1] = 200; touched[1] = 1; },
        // Só limpa o canal 1 — canal 2 fica sem tratamento explícito.
        OnTerminate: () => { buffer[0] = 0; touched[0] = 1; },
      },
    });
    compositor.renderFrame();
    expect(universe.getUniverse()[0]).toBe(200);
    expect(universe.getUniverse()[1]).toBe(200);

    const setChannelSpy = vi.spyOn(universe, 'setChannel');
    compositor.stopLayer('effect');

    // Só o canal 1 (explicitamente escrito pelo OnTerminate) deveria ser tocado.
    const touchedChannels = setChannelSpy.mock.calls.map(([channel]) => channel);
    expect(touchedChannels).toEqual([1]);
    setChannelSpy.mockRestore();
  });

  it('aplica HTP escolhendo o maior valor no mesmo canal', () => {
    compositor.addLayer('low', createLayer({ 10: 90 }));
    compositor.addLayer('high', createLayer({ 10: 210 }));

    compositor.renderFrame();

    expect(universe.getUniverse()[9]).toBe(210);
  });

  it('preserva o valor da camada restante ao parar outra no mesmo canal', () => {
    compositor.addLayer('low', createLayer({ 10: 90 }));
    compositor.addLayer('high', createLayer({ 10: 210 }));
    compositor.renderFrame();

    compositor.stopLayer('low');
    compositor.renderFrame();

    expect(compositor.hasLayer('low')).toBe(false);
    expect(compositor.hasLayer('high')).toBe(true);
    expect(universe.getUniverse()[9]).toBe(210);
  });

  it('considera camadas ativas inclusive durante fade-out', () => {
    expect(compositor.hasActiveControlLayers()).toBe(false);

    compositor.addLayer('fade', { ...createLayer({ 1: 100 }), fadeOutFrames: 2 });
    expect(compositor.hasActiveControlLayers()).toBe(true);

    compositor.releaseLayer('fade');
    expect(compositor.hasActiveControlLayers()).toBe(true);
    compositor.renderFrame();
    expect(compositor.hasActiveControlLayers()).toBe(true);
    compositor.renderFrame();
    expect(compositor.hasActiveControlLayers()).toBe(false);
  });

  it('clearMacros remove todas as macros e seus status', () => {
    compositor.createMacro('clear-me', [{ makeLayer: () => createLayer({ 1: 80 }) }]);
    expect(compositor.startMacro('clear-me')).toEqual({ ok: true });
    expect(compositor.getActiveMacroStatus()).not.toBeNull();

    compositor.clearMacros();

    expect(compositor.getActiveMacroStatus()).toBeNull();
    expect(compositor.startMacro('clear-me')).toEqual({
      ok: false,
      error: 'macro inexistente ou sem passos',
    });
  });

  it('bloqueia macro linear quando já existe camada ativa', () => {
    compositor.addLayer('common', createLayer({ 1: 120 }));
    compositor.createMacro('linear-blocked', [{ makeLayer: () => createLayer({ 2: 200 }) }], { mergeMode: 'linear' });

    const result = compositor.startMacro('linear-blocked');

    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(compositor.getActiveMacroStatus()).toBeNull();
  });

  it('permite reiniciar a mesma macro linear enquanto ela está ativa', () => {
    compositor.createMacro('linear-restart', [{ makeLayer: () => createLayer({ 2: 200 }) }], { mergeMode: 'linear' });

    expect(compositor.startMacro('linear-restart')).toEqual({ ok: true });
    expect(compositor.startMacro('linear-restart')).toEqual({ ok: true });
    expect(compositor.getActiveMacroStatus()?.id).toBe('linear-restart');
  });

  it('permite HTP com outras camadas e linear sem outras camadas', () => {
    compositor.addLayer('common', createLayer({ 1: 120 }));
    compositor.createMacro('htp-ok', [{ makeLayer: () => createLayer({ 2: 200 }) }], { mergeMode: 'htp' });
    expect(compositor.startMacro('htp-ok')).toEqual({ ok: true });
    expect(compositor.getActiveMacroStatus()?.id).toBe('htp-ok');

    compositor.stopMacro('htp-ok');
    compositor.stopLayer('common');
    compositor.createMacro('linear-ok', [{ makeLayer: () => createLayer({ 3: 220 }) }], { mergeMode: 'linear' });
    expect(compositor.startMacro('linear-ok')).toEqual({ ok: true });
    expect(compositor.getActiveMacroStatus()?.id).toBe('linear-ok');
  });

  it('avança para o próximo passo quando OnExecute do passo falha', () => {
    let layerCreations = 0;
    compositor.createMacro('execute-error', [
      {
        makeLayer: () => {
          layerCreations++;
          const layer = createLayer({ 1: 80 });
          layer.context.OnExecute = () => { throw new Error('falha no passo 0'); };
          return layer;
        },
      },
      { makeLayer: () => { layerCreations++; return createLayer({ 1: 160 }); } },
    ]);

    expect(compositor.startMacro('execute-error')).toEqual({ ok: true });
    compositor.renderFrame();

    expect(layerCreations).toBe(2);
    expect(compositor.getActiveMacroStatus()).toEqual({ id: 'execute-error', stepIndex: 1, loop: false });
    expect(compositor.layerCount()).toBe(1);
  });

  it('notifica o erro do passo de macro com os dados corretos', () => {
    const errors = [];
    compositor.setMacroStepErrorHandler((macroId, stepIndex, error) => {
      errors.push({ macroId, stepIndex, error });
    });
    compositor.createMacro('error-handler', [{
      makeLayer: () => {
        const layer = createLayer({ 1: 80 });
        layer.context.OnExecute = () => { throw new Error('erro monitorado'); };
        return layer;
      },
    }]);

    expect(compositor.startMacro('error-handler')).toEqual({ ok: true });
    compositor.renderFrame();

    expect(errors).toHaveLength(1);
    expect(errors[0].macroId).toBe('error-handler');
    expect(errors[0].stepIndex).toBe(0);
    expect(errors[0].error).toEqual(expect.objectContaining({ message: 'erro monitorado' }));
  });
});
