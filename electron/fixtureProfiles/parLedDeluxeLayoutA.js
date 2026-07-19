module.exports = {
  id: 'par-led-deluxe-layout-a',
  label: 'ParLed Deluxe (Layout A - RGBW com strobo dedicado)',
  fixtureType: 'par_led',
  match: { hasAlias: 'white', missingAlias: 'color_wheel' },
  channels: {
    dimmer:     { alias: 'dimmer' },
    strobe:     { alias: 'strobo' },
    macro:      { alias: 'macro', optional: true },
    macroSpeed: { alias: 'macro_speed', optional: true },
    red:        { alias: 'red' },
    green:      { alias: 'green' },
    blue:       { alias: 'blue' },
    white:      { alias: 'white' },
  },
  capabilities: {
    color:  { type: 'rgbw', status: 'ready' },
    dimmer: { type: 'continuous', status: 'ready' },
    strobe: { type: 'range', status: 'mapping-incomplete' },
  },
};
