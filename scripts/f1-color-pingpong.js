/*
Name: F1 - PingPong Color Fade
Description: Cicla entre vermelho, verde, azul e white com fade ping-pong no dimmer.
             Inclui um strobe simples ligado ao canal de strobo.
*/

// Endereçamento gerado a partir de shows/vida-e-paz.show.json
const PARLED1_DIMMER = 1;
const PARLED1_STROBO = 2;
const PARLED1_RED = 5;
const PARLED1_GREEN = 6;
const PARLED1_BLUE = 7;
const PARLED1_WHITE = 8;

// Variáveis globais de controle (persistem entre chamadas OnExecute)
var cycle = 0;
var pos = 0;              // posição de fade 0..255
var dir = 1;              // 1 = subindo, -1 = descendo
var colorIndex = 0;       // índice do canal de cor ativo
var colors = [PARLED1_RED, PARLED1_GREEN, PARLED1_BLUE, PARLED1_WHITE];

var FADE_STEP = 10;       // incremento por ciclo (ajuste velocidade)
var STROBE_ENABLED = true;
var STROBE_INTERVAL = 6;  // ciclos (6 * 40ms = 240ms)
var STROBE_LEVEL = 255;

function OnStart() {
  cycle = 0;
  pos = 0;
  dir = 1;
  colorIndex = 0;

  // Zera canais usados para garantir estado limpo
  SetChannel(PARLED1_DIMMER, 0);
  SetChannel(PARLED1_STROBO, 0);
  SetChannel(PARLED1_RED, 0);
  SetChannel(PARLED1_GREEN, 0);
  SetChannel(PARLED1_BLUE, 0);
  SetChannel(PARLED1_WHITE, 0);
}

function OnExecute() {
  cycle++;

  // Atualiza posição do fade (ping-pong)
  pos += FADE_STEP * dir;
  if (pos >= 255) {
    pos = 255;
    dir = -1;
    colorIndex = (colorIndex + 1) % colors.length;
  } else if (pos <= 0) {
    pos = 0;
    dir = 1;
    colorIndex = (colorIndex + 1) % colors.length;
  }

  // Dimmer no máximo enquanto houver valor de cor
  var dim = (pos > 0) ? 255 : 0;
  SetChannel(PARLED1_DIMMER, dim);

  // Aplica valores nas cores: apenas a cor ativa recebe 'pos'
  for (var i = 0; i < colors.length; i++) {
    var ch = colors[i];
    var v = (i === colorIndex) ? Math.floor(pos) : 0;
    SetChannel(ch, v);
  }

  // Strobe simples no canal de strobo
  if (STROBE_ENABLED) {
    if ((cycle % STROBE_INTERVAL) === 0) {
      SetChannel(PARLED1_STROBO, STROBE_LEVEL);
    } else {
      SetChannel(PARLED1_STROBO, 0);
    }
  }
}

function OnTerminate() {
  // Zera todos os canais usados pelo script
  SetChannel(PARLED1_DIMMER, 0);
  SetChannel(PARLED1_STROBO, 0);
  SetChannel(PARLED1_RED, 0);
  SetChannel(PARLED1_GREEN, 0);
  SetChannel(PARLED1_BLUE, 0);
  SetChannel(PARLED1_WHITE, 0);
}
