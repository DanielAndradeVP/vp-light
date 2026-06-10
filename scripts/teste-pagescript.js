// LOUVORZÃO BRANCO FOGO
// Branco 100% com strobo médio via canal hardware.
// Ideal para louvor animado, entrada de pregador e clímax de música.
// Strobo gerenciado diretamente pelo fixture — sem lógica de ciclo no software.

// --- Endereçamento (parLed1, startChannel 1) ---
const PARLED1_DIMMER = 1;
const PARLED1_STROBO = 2;
const PARLED1_RED    = 5;
const PARLED1_GREEN  = 6;
const PARLED1_BLUE   = 7;
const PARLED1_WHITE  = 8;

// --- Valores ---
const TARGET_DIMMER = 255;  // 100% de intensidade
const TARGET_WHITE  = 255;  // branco puro no canal white
const STROBO_SPEED  = 77;   // ~30% de velocidade → pulso médio

function OnStart() {
  // RGB zerado — branco exclusivamente via canal white
  SetChannel(PARLED1_RED,    0);
  SetChannel(PARLED1_GREEN,  0);
  SetChannel(PARLED1_BLUE,   0);
  SetChannel(PARLED1_WHITE,  TARGET_WHITE);
  SetChannel(PARLED1_DIMMER, TARGET_DIMMER);
  // Ativa o strobo hardware com velocidade fixa
  SetChannel(PARLED1_STROBO, STROBO_SPEED);
}

function OnExecute() {
  // Strobo controlado pelo hardware via canal 2 — nenhuma ação necessária aqui
}

function OnTerminate() {
  // Para o strobo antes de apagar para evitar flash residual
  SetChannel(PARLED1_STROBO, 0);
  SetChannel(PARLED1_DIMMER, 0);
  SetChannel(PARLED1_WHITE,  0);
  SetChannel(PARLED1_RED,    0);
  SetChannel(PARLED1_GREEN,  0);
  SetChannel(PARLED1_BLUE,   0);
}
