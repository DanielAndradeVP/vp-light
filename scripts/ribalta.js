// ribalta.js — Ribaltas 1 e 2 em branco cheio
//
// Arquitetura dos aparelhos:
//   Canal 3  = dimmer   → intensidade geral (master do aparelho)
//   Canal 4–11 = led_1–led_8 → cada LED independente
//
// Para acender: dimmer=255 + todos os LEDs=255
// Só o dimmer não basta — os LEDs ficam em 0 e a luz não sai.
//
// Ribalta_1: startChannel=258 → dimmer=260, led_1=261...led_8=268
// Ribalta_2: startChannel=271 → dimmer=273, led_1=274...led_8=281

const R1 = 'fixture_1780805067518_ribalta_1';
const R2 = 'fixture_1780805067518_ribalta_2';

function OnStart() {
  // Ribalta 1
  SetChannel(getChannel(R1, 'dimmer'), 255);
  SetChannel(getChannel(R1, 'led_1'),  255);
  SetChannel(getChannel(R1, 'led_2'),  255);
  SetChannel(getChannel(R1, 'led_3'),  255);
  SetChannel(getChannel(R1, 'led_4'),  255);
  SetChannel(getChannel(R1, 'led_5'),  255);
  SetChannel(getChannel(R1, 'led_6'),  255);
  SetChannel(getChannel(R1, 'led_7'),  255);
  SetChannel(getChannel(R1, 'led_8'),  255);

  // Ribalta 2
  SetChannel(getChannel(R2, 'dimmer'), 255);
  SetChannel(getChannel(R2, 'led_1'),  255);
  SetChannel(getChannel(R2, 'led_2'),  255);
  SetChannel(getChannel(R2, 'led_3'),  255);
  SetChannel(getChannel(R2, 'led_4'),  255);
  SetChannel(getChannel(R2, 'led_5'),  255);
  SetChannel(getChannel(R2, 'led_6'),  255);
  SetChannel(getChannel(R2, 'led_7'),  255);
  SetChannel(getChannel(R2, 'led_8'),  255);
}

function OnExecute() {
  // Estático — tudo já setado no OnStart, nada a fazer por frame
}

function OnTerminate() {
  // O compositor zera a camada automaticamente ao parar — sem ação necessária
}
