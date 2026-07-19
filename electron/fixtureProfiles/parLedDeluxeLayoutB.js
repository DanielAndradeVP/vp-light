module.exports = {
  id: 'par-led-deluxe-layout-b',
  label: 'ParLed Deluxe (Layout B - RGB com color_wheel/macro)',
  fixtureType: 'par_led',
  match: { hasAlias: 'color_wheel' },
  channels: {
    macro:      { alias: 'macro', optional: true },
    colorWheel: { alias: 'color_wheel', optional: true },
    speed:      { alias: 'speed', optional: true },
    dimmer:     { alias: 'dimmer' },
    red:        { alias: 'red' },
    green:      { alias: 'green' },
    blue:       { alias: 'blue' },
  },
  capabilities: {
    color:  { type: 'rgb', status: 'ready' },
    dimmer: { type: 'continuous', status: 'ready' },
    strobe: { type: 'range', status: 'mapping-incomplete' },
  },
};
