// pisca-chase-brut-parled — Chase ping-pong combinado: mini bruts e PAR LEDs correndo
// juntos no mesmo passo/tempo, cada um na sua própria ordem física de palco (mini
// bruts: mesma ordem do pisca-brut-chase.js / FB_BRUT_STAGE; PAR LED: mesma ordem do
// pisca-parled-pingpong.js, por posX real). Não mexe em RGB dos PAR — só dimmer.
//
// Como as contagens são diferentes (4 bruts x 9 par leds), cada grupo faz o próprio
// ping-pong completo na mesma velocidade de passo — o brut "dá a volta" mais rápido
// (ciclo de 6 passos) que o par led (ciclo de 16 passos), mas os dois sempre trocam
// exatamente no mesmo instante (mesmo tick, mesmo flash/gap).

const B01 = 'fixture_1780805067518_mini_brut_01';
const B02 = 'fixture_1780805067518_mini_brut_02';
const B03 = 'fixture_1780805067518_mini_brut_03';
const B04 = 'fixture_1780805067518_mini_brut_04';

// Ordem física real do palco (mesma de fire-base.js FB_BRUT_STAGE / pisca-brut-chase.js).
const BRUT_STAGE = [B01, B03, B02, B04];

// Ordem física real do palco por posX (mesma de pisca-parled-pingpong.js).
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

const FLASH_TICKS = 4; // 160ms aceso
const GAP_TICKS   = 1; // 40ms apagado antes do próximo passo
const STEP_TICKS  = FLASH_TICKS + GAP_TICKS;

let tick = 0;

function setOne(id, value01) {
  adapter.setDimmer(id, value01);
}

// Índice triangular: 0,1,...,n-1,n-2,...,1,0,1... sem segurar duas vezes nas pontas.
function pingpongIndex(stepIndex, n) {
  const period = 2 * (n - 1);
  const m = stepIndex % period;
  return m < n ? m : period - m;
}

function OnStart() {
  tick = 0;
}

function OnExecute() {
  tick++;

  const stepIndex = Math.floor(tick / STEP_TICKS);
  const phase = tick % STEP_TICKS;
  const lit = phase < FLASH_TICKS;

  const brutPos = pingpongIndex(stepIndex, BRUT_STAGE.length);
  const parPos  = pingpongIndex(stepIndex, PAR_STAGE.length);

  for (let i = 0; i < BRUT_STAGE.length; i++) {
    setOne(BRUT_STAGE[i], i === brutPos && lit ? 1 : 0);
  }
  for (let i = 0; i < PAR_STAGE.length; i++) {
    setOne(PAR_STAGE[i], i === parPos && lit ? 1 : 0);
  }
}

function OnTerminate() {
  for (const id of BRUT_STAGE) setOne(id, 0);
  for (const id of PAR_STAGE) setOne(id, 0);
}
