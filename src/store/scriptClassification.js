export const CATEGORY_ICONS = {
  movimento: '↻',
  strobe: '⚡',
  estatico: '●',
  transicao: '⇢',
  sequencia: '⋯',
  utilitario: '⚙',
};

export const SPEED_LEVELS = { lento: 1, medio: 2, rapido: 3 };

export const INTENSITY_STRIPES = {
  suave:    { height: 2, color: '#4caf82' },
  moderado: { height: 3, color: '#e6a23c' },
  intenso:  { height: 4, color: '#e33344' },
};

export const CATEGORY_OPTIONS = ['', 'movimento', 'strobe', 'estatico', 'transicao', 'sequencia', 'utilitario'];
export const SPEED_OPTIONS = ['lento', 'medio', 'rapido'];
export const INTENSITY_OPTIONS = ['suave', 'moderado', 'intenso'];

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || null;
}

export function getSpeedLevel(speed) {
  return SPEED_LEVELS[speed] ?? SPEED_LEVELS.medio;
}

export function getIntensityStripe(intensity) {
  return INTENSITY_STRIPES[intensity] || INTENSITY_STRIPES.moderado;
}
