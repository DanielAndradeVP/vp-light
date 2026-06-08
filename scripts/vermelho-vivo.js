// VERMELHO VIVO
// Vermelho puro com pulso ping-pong no dimmer entre 60% e 100% (~2s de período).
// O pulso suave dá "vida" à luz sem ser um strobo duro.
// Ideal para louvores de guerra espiritual e momentos de clamor.

// --- Endereçamento (parLed1, startChannel 1) ---
const PARLED1_DIMMER = 1;
const PARLED1_STROBO = 2;
const PARLED1_RED    = 5;
const PARLED1_GREEN  = 6;
const PARLED1_BLUE   = 7;
const PARLED1_WHITE  = 8;

// --- Limites do pulso ---
const DIM_LOW  = 153;  // 60% de 255 — piso do pulso
const DIM_HIGH = 255;  // 100%        — teto do pulso

// --- Velocidade do pulso ---
// STEP 4 → ~26 ciclos por direção → ~1s subida + 1s descida ≈ 2s/ciclo completo
// Compatível com BPM ~120 (louvores animados)
const STEP = 4;

// --- Estado global ---
var dimmer = 153;
var dir = 1;  // 1 = subindo, -1 = descendo

function OnStart() {
  dimmer = DIM_LOW;
  dir = 1;

  // Sem strobo hardware — o pulso no dimmer é o efeito
  SetChannel(PARLED1_STROBO, 0);

  // Vermelho puro: red no máximo, RGB complementares zerados
  SetChannel(PARLED1_GREEN,  0);
  SetChannel(PARLED1_BLUE,   0);
  SetChannel(PARLED1_WHITE,  0);
  SetChannel(PARLED1_RED,    255);

  SetChannel(PARLED1_DIMMER, dimmer);
}

function OnExecute() {
  // Ping-pong: sobe até DIM_HIGH, inverte, desce até DIM_LOW, inverte, repete
  dimmer += dir * STEP;

  if (dimmer >= DIM_HIGH) {
    dimmer = DIM_HIGH;
    dir = -1;  // inverte: começa a descer
  } else if (dimmer <= DIM_LOW) {
    dimmer = DIM_LOW;
    dir = 1;   // inverte: começa a subir
  }

  SetChannel(PARLED1_DIMMER, dimmer);
}

function OnTerminate() {
  SetChannel(PARLED1_DIMMER, 0);
  SetChannel(PARLED1_STROBO, 0);
  SetChannel(PARLED1_RED,    0);
  SetChannel(PARLED1_GREEN,  0);
  SetChannel(PARLED1_BLUE,   0);
  SetChannel(PARLED1_WHITE,  0);
}
