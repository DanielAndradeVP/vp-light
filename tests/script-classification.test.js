import { describe, expect, it } from 'vitest';
import {
  getCategoryIcon,
  getIntensityStripe,
  getSpeedLevel,
} from '../src/store/scriptClassification.js';

describe('classificação visual de scripts', () => {
  it('resolve ícones válidos e omite categoria vazia ou desconhecida', () => {
    expect(getCategoryIcon('movimento')).toBe('↻');
    expect(getCategoryIcon('strobe')).toBe('⚡');
    expect(getCategoryIcon('estatico')).toBe('●');
    expect(getCategoryIcon('transicao')).toBe('⇢');
    expect(getCategoryIcon('sequencia')).toBe('⋯');
    expect(getCategoryIcon('utilitario')).toBe('⚙');
    expect(getCategoryIcon('')).toBeNull();
    expect(getCategoryIcon('desconhecida')).toBeNull();
  });

  it('resolve os três níveis de velocidade e usa médio como padrão', () => {
    expect(getSpeedLevel('lento')).toBe(1);
    expect(getSpeedLevel('medio')).toBe(2);
    expect(getSpeedLevel('rapido')).toBe(3);
    expect(getSpeedLevel('desconhecido')).toBe(2);
  });

  it('resolve as três faixas de intensidade e usa moderado como padrão', () => {
    expect(getIntensityStripe('suave')).toEqual({ height: 2, color: '#4caf82' });
    expect(getIntensityStripe('moderado')).toEqual({ height: 3, color: '#e6a23c' });
    expect(getIntensityStripe('intenso')).toEqual({ height: 4, color: '#e33344' });
    expect(getIntensityStripe('desconhecida')).toEqual({ height: 3, color: '#e6a23c' });
  });
});
