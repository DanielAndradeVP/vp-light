import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

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
    compositor.clearLayers();
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
});
