// ALTAR ROXO PROFUNDO
// Fade lento de entrada (~3s) para roxo denso e estável.
// Ideal para momentos de altar, oração e adoração suave.
// Sem strobo, sem pulso — luz baixa e envolvente.

// --- Endereçamento (parLed1, startChannel 1) ---
const PARLED1_DIMMER = 1;
const PARLED1_STROBO = 2;
const PARLED1_RED    = 5;
const PARLED1_GREEN  = 6;
const PARLED1_BLUE   = 7;
const PARLED1_WHITE  = 8;

// --- Valores alvo ---
const TARGET_DIMMER = 77;   // ~30% de 255
const TARGET_RED    = 150;  // vermelho médio → roxo profundo
const TARGET_GREEN  = 0;    // verde zerado
const TARGET_BLUE   = 230;  // azul alto

// --- Timing do fade de entrada ---
// ~3s = 75 ciclos de 40ms
const FADE_IN_CYCLES = 75;

// --- Estado global ---
var cycle = 0;
var currentDimmer = 0;

function OnStart() {
  cycle = 0;
  currentDimmer = 0;

  // Cores configuradas imediatamente (invisíveis com dimmer em 0)
  SetChannel(PARLED1_STROBO, 0);
  SetChannel(PARLED1_RED,    TARGET_RED);
  SetChannel(PARLED1_GREEN,  TARGET_GREEN);
  SetChannel(PARLED1_BLUE,   TARGET_BLUE);
  SetChannel(PARLED1_WHITE,  0);
  SetChannel(PARLED1_DIMMER, 0);
}

function OnExecute() {
  // Fase de fade in: sobe dimmer linearmente até TARGET_DIMMER em 75 ciclos (~3s)
  if (cycle < FADE_IN_CYCLES) {
    cycle++;
    currentDimmer = Math.round((TARGET_DIMMER * cycle) / FADE_IN_CYCLES);
    SetChannel(PARLED1_DIMMER, currentDimmer);
  }
  // Após o fade: mantém estável, sem pulso nem variação
}

function OnTerminate() {
  SetChannel(PARLED1_DIMMER, 0);
  SetChannel(PARLED1_STROBO, 0);
  SetChannel(PARLED1_RED,    0);
  SetChannel(PARLED1_GREEN,  0);
  SetChannel(PARLED1_BLUE,   0);
  SetChannel(PARLED1_WHITE,  0);
}
