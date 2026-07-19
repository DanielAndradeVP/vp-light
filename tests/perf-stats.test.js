import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyDuration, createStatTracker } = require('../electron/engine/perfStats.js');

describe('perfStats', () => {
  it('classifica todas as faixas e seus limites exatos', () => {
    expect(classifyDuration(29.9)).toBe('healthy');
    expect(classifyDuration(30)).toBe('warn');
    expect(classifyDuration(39.9)).toBe('warn');
    expect(classifyDuration(40)).toBe('overrun');
    expect(classifyDuration(44.9)).toBe('overrun');
    expect(classifyDuration(45)).toBe('degraded');
    expect(classifyDuration(99.9)).toBe('degraded');
    expect(classifyDuration(100)).toBe('critical');
  });

  it('registra média, máximo, última amostra, estouros e limita o histórico', () => {
    const tracker = createStatTracker(3);
    expect(tracker.record(10)).toMatchObject({ avg: 10, max: 10, last: 10, overruns: 0 });
    expect(tracker.record(20).avg).toBe(15);
    expect(tracker.record(40)).toMatchObject({ avg: 70 / 3, max: 40, last: 40, overruns: 1 });
    tracker.record(50);

    expect(tracker.snapshot()).toEqual({
      avg: 110 / 3,
      max: 50,
      overruns: 2,
      last: 50,
      samples: 3,
    });
  });

  it('aplica rate-limit usando somente o now recebido', () => {
    const tracker = createStatTracker(10, 3000);
    expect(tracker.shouldWarn(100)).toBe(true);
    expect(tracker.shouldWarn(3099)).toBe(false);
    expect(tracker.shouldWarn(3100)).toBe(true);
  });

  it('retorna snapshot zerado sem amostras e sem NaN', () => {
    const snapshot = createStatTracker().snapshot();
    expect(snapshot).toEqual({ avg: 0, max: 0, overruns: 0, last: 0, samples: 0 });
    expect(Number.isNaN(snapshot.avg)).toBe(false);
  });
});
