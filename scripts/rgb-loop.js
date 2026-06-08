// Nome: RGB Loop parLed1
// Descrição: Ciclo contínuo de cores em parLed1 com dimmer fixo em 255.
//           Cada cor fica ativa por 3 segundos antes de avançar para a próxima.

const PARLED1_DIMMER = 1;
const PARLED1_RED = 5;
const PARLED1_GREEN = 6;
const PARLED1_BLUE = 7;

const CYCLES_PER_COLOR = 75; // 3 segundos / 40ms = 75 ciclos

let phase = 0;
let cycleCount = 0;

function OnStart() {
  // força o dimmer no máximo e inicia o ciclo RGB em vermelho.
  phase = 0;
  cycleCount = 0;

  SetChannel(PARLED1_DIMMER, 255);
  SetChannel(PARLED1_RED, 255);
  SetChannel(PARLED1_GREEN, 0);
  SetChannel(PARLED1_BLUE, 0);
}

function OnExecute() {
  // executado a cada 40ms; mantém o dimmer e alterna a cor a cada 75 ciclos.
  cycleCount += 1;

  if (cycleCount >= CYCLES_PER_COLOR) {
    cycleCount = 0;
    phase = (phase + 1) % 3;
  }

  if (phase === 0) {
    SetChannel(PARLED1_RED, 255);
    SetChannel(PARLED1_GREEN, 0);
    SetChannel(PARLED1_BLUE, 0);
  } else if (phase === 1) {
    SetChannel(PARLED1_RED, 0);
    SetChannel(PARLED1_GREEN, 255);
    SetChannel(PARLED1_BLUE, 0);
  } else {
    SetChannel(PARLED1_RED, 0);
    SetChannel(PARLED1_GREEN, 0);
    SetChannel(PARLED1_BLUE, 255);
  }

  SetChannel(PARLED1_DIMMER, 255);
}

function OnTerminate() {
  // zera todos os canais usados quando o efeito terminar.
  SetChannel(PARLED1_DIMMER, 0);
  SetChannel(PARLED1_RED, 0);
  SetChannel(PARLED1_GREEN, 0);
  SetChannel(PARLED1_BLUE, 0);
}