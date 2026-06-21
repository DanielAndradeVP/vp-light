// mini-bruts-fita-dimmer-255 - Mini Bruts e Fita LED em dimmer 255. Destino: sem F-key definida.
const FIXTURES = [
  'fixture_1780805067518_mini_brut_01',
  'fixture_1780805067518_mini_brut_02',
  'fixture_1780805067518_mini_brut_03',
  'fixture_1780805067518_mini_brut_04',
  'fixture_1780805067518_fita_led',
];

let dimmers = [];

function OnStart() {
  dimmers = FIXTURES
    .map((fixtureId) => getChannel(fixtureId, 'dimmer'))
    .filter((channel) => channel !== null);
}

function OnExecute() {
  dimmers.forEach((channel) => SetChannel(channel, 100));
}

function OnTerminate() {
  dimmers.forEach((channel) => SetChannel(channel, 0));
}
