// pisca-parled-pingpong — PAR LEDs acendendo um de cada vez em sequência física,
// tipo "cobrinha": 1 acende/apaga, 2 acende/apaga, 3... até o último, aí volta
// (8, 7, 6... até o 1) e reinicia — ping-pong contínuo. Mesma lógica/timing do
// pisca-brut-lados, só que 1 fixture por vez em vez de 2 grupos alternando.
// Não mexe em RGB — só liga/desliga o dimmer, preserva a cor que já estiver ativa.
//
// Ordem FÍSICA no palco (esquerda→direita real, por posX) — NÃO é a ordem lógica
// dos IDs (mesmo princípio do FB_BRUT_STAGE em fire-base.js: usar ordem física
// pra chase/ping-pong, senão pula de um lado pro outro do palco).
// parled_deluxe_6 = "ParLed_Deluxe_10" (último da sequência no setup real da igreja,
// vem depois do deluxe_9 — nome antigo "9_extra" era placeholder).
const PAR_STAGE = [
  'fixture_1780805067518_parled_deluxe_1',
  'fixture_1780805067518_parled_deluxe_2',
  'fixture_1780805067518_parled_deluxe_3',
  'fixture_1780805067518_parled_deluxe_5',
  'fixture_1780805067518_parled_deluxe_7',
  'fixture_1780805067518_parled_deluxe_8',
  'fixture_1780805067518_parled_deluxe_4',
  'fixture_1780805067518_parled_deluxe_9',
  'fixture_1780805067518_parled_deluxe_6', // ParLed_Deluxe_10
];

const FLASH_TICKS = 3; // 120ms aceso
const GAP_TICKS   = 1; // 40ms apagado antes de ir pro próximo
const STEP_TICKS  = FLASH_TICKS + GAP_TICKS;

const N = PAR_STAGE.length;
const PINGPONG_STEPS = 2 * (N - 1); // ida (N-1 passos) + volta (N-1 passos), sem repetir as pontas

let tick = 0;

function setOne(id, value01) {
  adapter.setDimmer(id, value01);
}

// Índice triangular: 0,1,2,...,N-1,N-2,...,1,0,1,2... sem segurar duas vezes nas pontas.
function pingpongIndex(stepIndex) {
  const m = stepIndex % PINGPONG_STEPS;
  return m < N ? m : PINGPONG_STEPS - m;
}

function OnStart() {
  tick = 0;
}

function OnExecute() {
  tick++;

  const stepIndex = Math.floor(tick / STEP_TICKS);
  const phase = tick % STEP_TICKS;
  const activePos = pingpongIndex(stepIndex);
  const lit = phase < FLASH_TICKS;

  for (let i = 0; i < N; i++) {
    setOne(PAR_STAGE[i], i === activePos && lit ? 1 : 0);
  }
}

function OnTerminate() {
  for (const id of PAR_STAGE) setOne(id, 0);
}
