  // ══════════════════════════════════════════════════════════════════════════════
// fire-base.js — Biblioteca compartilhada do pacote-de-scripts-fire.
//
// PROPÓSITO
//   Única fonte da verdade para IDs de fixture, canais, presets de rig, cores e
//   helpers de coreografia. Os 50 scripts-fire consomem SÓ esta base — nenhum ID
//   de fixture, número de canal DMX ou posição de rig é escrito nos scripts.
//   Correção centralizada: ajuste aqui, os 50 scripts herdam.
//
// BIBLIOTECA PURA (isolamento)
//   Este arquivo NÃO define OnStart / OnExecute / OnTerminate de propósito.
//   Sem funções de ciclo de vida, o engine não executa nada ao carregá-lo:
//   é inerte enquanto não for injetado (prepended) num script-fire. Por isso
//   sua mera existência no repositório não altera o comportamento atual.
//
// NAMESPACE
//   Constantes  → FB_ / FB.*      Funções e estado → fb_*
//   Espelha a convenção MP_/mp_ do mov-preset.js: ao ser concatenado antes de um
//   script, nada colide com as variáveis locais do script.
//
// API DO SANDBOX (fornecida pelo engine, ver electron/main.js:1051)
//   SetChannel(canalDMX 1..512, valor 0..255)   → escreve na camada
//   getChannel(fixtureId, alias) → canal DMX (1-based) | null se ausente/desabilitado
//   adapter.resolve(fixtureId, alias, adapterKey, valorLogico) → DMX | null
//
// REGRA DE OURO
//   getChannel retorna null quando o fixture está enabled:false. Todo acesso
//   passa por fb_set(), que ignora canais null com segurança. Nunca escreva
//   SetChannel direto num script-fire — use os helpers daqui.
// ══════════════════════════════════════════════════════════════════════════════


// ── 1. Relógio ────────────────────────────────────────────────────────────────
// Engine roda a 25fps → 1 tick = 40ms. Pense sempre em TICKS, não em ms.
const FB_FPS = 25;
const FB_MS_PER_TICK = 1000 / FB_FPS; // 40

function fb_secToTicks(seconds) {
  return Math.round(seconds * FB_FPS);
}

function fb_ticksToSec(ticks) {
  return ticks / FB_FPS;
}


// ── 2. IDs de fixture — ÚNICA fonte da verdade ────────────────────────────────
// Copiados de shows/vp.show.json. Se um fixture for renomeado no show, corrija
// AQUI (um lugar) e todos os scripts-fire seguem funcionando.
const FB_ID = {
  // Moving Head Beam (par sincronizado — espelho esquerda/direita)
  MH1:  'fixture_1780805067518_moving_head_beam_1',
  MH2:  'fixture_1780805067518_moving_head_beam_2',

  // Moving Wosh (cabeça CMY, modelo diferente dos beams)
  WOSH: 'fixture_1780805067518_moving_wosh_01',

  // Ribaltas RGB estáticas (enabled:false no show → getChannel = null)
  RIB_STATIC: [
    'fixture_1780805067518_ribalta_rgb_static_1',
    'fixture_1780805067518_ribalta_rgb_static_2',
    'fixture_1780805067518_ribalta_rgb_static_3',
    'fixture_1780805067518_ribalta_rgb_static_4',
  ],

  // Mini Bruts — nomes lógicos. DMX real: B01=400 B02=402 B03=401 B04=410.
  BRUT: {
    B01: 'fixture_1780805067518_mini_brut_01',
    B02: 'fixture_1780805067518_mini_brut_02',
    B03: 'fixture_1780805067518_mini_brut_03',
    B04: 'fixture_1780805067518_mini_brut_04',
  },

  // Fita LED (1 canal: dimmer)
  FITA: 'fixture_1780805067518_fita_led',

  // PAR LEDs de produção (9 fixtures Deluxe). Layouts de canal variam entre eles;
  // a resolução por alias devolve null no que não existir naquele modelo.
  PAR: [
    'fixture_1780805067518_parled_deluxe_1',
    'fixture_1780805067518_parled_deluxe_2',
    'fixture_1780805067518_parled_deluxe_3',
    'fixture_1780805067518_parled_deluxe_4',
    'fixture_1780805067518_parled_deluxe_5',
    'fixture_1780805067518_parled_deluxe_6',
    'fixture_1780805067518_parled_deluxe_7',
    'fixture_1780805067518_parled_deluxe_8',
    'fixture_1780805067518_parled_deluxe_9',
  ],

  // PAR de teste "casa" (parLed1). enabled:false em produção — ver modo.js.
  PAR_TEST: 'fixture_1780805067518',
};

// Ordem FÍSICA dos bruts no palco (esquerda→direita real): B01→B03→B02→B04.
// Use esta lista para chase/ping-pong; a ordem lógica B01..B04 NÃO é a física.
const FB_BRUT_STAGE = [FB_ID.BRUT.B01, FB_ID.BRUT.B03, FB_ID.BRUT.B02, FB_ID.BRUT.B04];


// ── 3. Setter seguro (todo acesso a canal passa por aqui) ─────────────────────
// Ignora canais null (fixture desabilitado / alias inexistente) e faz clamp 0..255.
function fb_set(channel, value) {
  if (channel === null || channel === undefined) return;
  SetChannel(channel, Math.max(0, Math.min(255, Math.round(value))));
}


// ── 4. Resolvers de canal por família ─────────────────────────────────────────
// Cada resolver devolve um objeto { alias: canalDMX|null, id }. Chame no OnStart
// e guarde o objeto; nos ticks use fb_set(obj.alias, valor).

function fb_mh(id) {
  return {
    id,
    color:    getChannel(id, 'color_wheel'),
    strobo:   getChannel(id, 'strobo'),
    dimmer:   getChannel(id, 'fecho_lampada'), // "dimmer" do beam = fecho da lâmpada
    gobo:     getChannel(id, 'gobo_wheel'),
    prism:    getChannel(id, 'prism_1'),
    speed:    getChannel(id, 'virtual_speed'),
    pan:      getChannel(id, 'pan'),
    panFine:  getChannel(id, 'pan_fine'),
    tilt:     getChannel(id, 'tilt'),
    tiltFine: getChannel(id, 'tilt_fine'),
    reset:    getChannel(id, 'reset'),
  };
}

function fb_ribStatic(id) {
  return {
    id,
    dimmer:  getChannel(id, 'dimmer'),
    r:       getChannel(id, 'red'),
    g:       getChannel(id, 'green'),
    b:       getChannel(id, 'blue'),
    strobo:  getChannel(id, 'strobo'),
    special: getChannel(id, 'special'),
  };
}

function fb_brut(id) {
  return { id, dimmer: getChannel(id, 'dimmer') };
}

function fb_par(id) {
  // Aliases comuns aos dois layouts: dimmer, red, green, blue.
  // white/strobo só existem no layout A → null no layout B (fb_set ignora).
  return {
    id,
    dimmer: getChannel(id, 'dimmer'),
    r:      getChannel(id, 'red'),
    g:      getChannel(id, 'green'),
    b:      getChannel(id, 'blue'),
    white:  getChannel(id, 'white'),
    strobo: getChannel(id, 'strobo'),
  };
}

function fb_fita() {
  return getChannel(FB_ID.FITA, 'dimmer');
}

function fb_wosh() {
  const id = FB_ID.WOSH;
  return {
    id,
    pan:     getChannel(id, 'pan'),
    tilt:    getChannel(id, 'tilt'),
    speed:   getChannel(id, 'pan_tilt_speed'),
    strobo:  getChannel(id, 'strobo'),
    color:   getChannel(id, 'color_wheel'),
    cyan:    getChannel(id, 'cyan'),
    magenta: getChannel(id, 'magenta'),
    yellow:  getChannel(id, 'yellow'),
    zoom:    getChannel(id, 'zoom'),
    panFine: getChannel(id, 'pan_fine'),
    tiltFine:getChannel(id, 'tilt_fine'),
  };
}


// ── 5. Grupos resolvidos (coleções prontas) ───────────────────────────────────
function fb_allMH()        { return [fb_mh(FB_ID.MH1), fb_mh(FB_ID.MH2)]; }
function fb_allBrut()      { return FB_BRUT_STAGE.map(fb_brut); } // ORDEM FÍSICA
function fb_allPar()       { return FB_ID.PAR.map(fb_par); }
function fb_allRibStatic() { return FB_ID.RIB_STATIC.map(fb_ribStatic); }


// ── 6. Presets de rig (valores medidos — portados de mov-preset.js) ───────────
// Posições pan/tilt reais dos beams. NÃO invente números nos scripts: use estes.
const FB_MH1_POS = {
  PAN_C:      84,  PAN_L:      42,  PAN_R:     120,
  TILT_F:     36,  TILT_A:     78,  TILT_L:     35,
  TILT_MID:  110,  TILT_FLOOR:144,
};
const FB_MH2_POS = {
  PAN_C:      84,  PAN_R:      44,  PAN_L:      50,
  TILT_F:     32,  TILT_A:     72,  TILT_L:     26,
  TILT_MID:  100,  TILT_FLOOR:125,
};

// Separação de pan entre M1 e M2 na mesma trajetória sincronizada.
const FB_MH_GAP = 8;

// virtual_speed: MAIOR = mais lento. (referência mov-traj-*)
const FB_MH_SPEED = { VERY_SLOW: 220, SLOW: 205, MED: 180, FAST: 155, VERY_FAST: 140 };

const FB_FITA_DIM = 178;

// Níveis usados com frequência.
const FB_FULL = 255;
const FB_OFF  = 0;


// ── 7. Cores ──────────────────────────────────────────────────────────────────
// Beams: cor via roda de cor. MH1 e MH2 têm MAPAS DIFERENTES no show, então a
// cor SEMPRE passa por adapter.resolve(id, 'color_wheel', 'color', nome) —
// nunca um valor fixo. Nomes lógicos disponíveis por fixture:
//   MH1: white red green blue_light yellow purple blue amber
//   MH2: white red yellow purple_dark green blue_dark white_2 amber
// Use os nomes comuns aos dois quando quiser as duas iguais.
const FB_MH_COLOR = {
  WHITE: 'white', RED: 'red', GREEN: 'green', YELLOW: 'yellow', AMBER: 'amber',
};

function fb_mhColor(mh, colorName) {
  const dmx = adapter.resolve(mh.id, 'color_wheel', 'color', colorName);
  if (dmx !== null) fb_set(mh.color, dmx);
}

// RGB direto (PAR LED e ribalta estática têm canais red/green/blue).
function fb_rgb(fx, r, g, b) {
  fb_set(fx.r, r);
  fb_set(fx.g, g);
  fb_set(fx.b, b);
}

function fb_dim(fx, value) {
  fb_set(fx.dimmer, value);
}


// ── 8. Movimento dos beams (par espelhado + gap) ──────────────────────────────
// mhList = fb_allMH() → [MH1, MH2]. MH1 recebe pan-gap, MH2 recebe pan+gap.
function fb_mhMove(mhList, pan, tilt, speed) {
  const spd = speed === undefined ? FB_MH_SPEED.SLOW : speed;
  fb_set(mhList[0].pan,  pan - FB_MH_GAP);
  fb_set(mhList[0].tilt, tilt);
  fb_set(mhList[0].speed, spd);
  fb_set(mhList[1].pan,  pan + FB_MH_GAP);
  fb_set(mhList[1].tilt, tilt);
  fb_set(mhList[1].speed, spd);
}

// Abre o beam (lâmpada acesa + shutter aberto). Chame por MH.
function fb_mhOpen(mh) {
  fb_set(mh.dimmer, FB_FULL); // fecho_lampada
  fb_set(mh.strobo, FB_FULL); // shutter aberto (sem strobo)
}

// "Acorda" a roda de cor no OnStart (pulso 1→0) para destravar o motor.
function fb_mhColorWake(mh) {
  if (mh.color !== null && mh.color !== undefined) {
    SetChannel(mh.color, 1);
    SetChannel(mh.color, 0);
  }
}


// ── 9. Ribaltas RGB estáticas ─────────────────────────────────────────────────
const FB_RIB_STATIC_DIM_WASH = 220;

function fb_ribStaticApply(list, r, g, b, dim) {
  const d = dim === undefined ? FB_RIB_STATIC_DIM_WASH : dim;
  for (const rib of list) {
    fb_set(rib.special, 0);
    fb_set(rib.strobo, 0);
    fb_set(rib.dimmer, d);
    fb_set(rib.r, r);
    fb_set(rib.g, g);
    fb_set(rib.b, b);
  }
}


// ── 10. Helpers de coreografia (matemática de efeito) ─────────────────────────
function fb_lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function fb_clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Suaviza t (0..1) para acelerar/desacelerar nas pontas — trajetórias sem salto.
function fb_smoothstep(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

// Onda triangular 0→1→0 no período (ticks). Útil p/ dimmer/pan pulsando.
function fb_triangle(tick, period) {
  const p = ((tick % period) + period) % period;
  const half = period / 2;
  return p < half ? p / half : 2 - p / half;
}

// Seno normalizado 0..1 no período (ticks). Movimento orgânico.
function fb_sine01(tick, period) {
  return (Math.sin((2 * Math.PI * tick) / period) + 1) / 2;
}

// Flash on/off: true enquanto aceso dentro do ciclo (onTicks + offTicks).
function fb_flashOn(tick, onTicks, offTicks) {
  return (tick % (onTicks + offTicks)) < onTicks;
}

// Índice aceso agora num chase de `count` passos, cada passo com `stepTicks`.
function fb_chaseIndex(tick, count, stepTicks) {
  return Math.floor(tick / stepTicks) % count;
}

// Interpola pan/tilt por keyframes [{pan,tilt,dur}, ...] com o último = primeiro
// para loop perfeito. Devolve { pan, tilt } suavizado. `phase` = tick % ciclo.
function fb_keyframeState(phase, keyframes) {
  const cycle = keyframes.reduce((s, k) => s + k.dur, 0);
  const p = ((phase % cycle) + cycle) % cycle;
  let acc = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const dur = keyframes[i].dur;
    if (dur > 0 && p < acc + dur) {
      const from = keyframes[i];
      const to = keyframes[i + 1];
      const t = fb_smoothstep((p - acc) / dur);
      return { pan: fb_lerp(from.pan, to.pan, t), tilt: fb_lerp(from.tilt, to.tilt, t) };
    }
    acc += dur;
  }
  const last = keyframes[keyframes.length - 1];
  return { pan: last.pan, tilt: last.tilt };
}


// ── 11. Blackout / reset padrão ───────────────────────────────────────────────
// Use no OnTerminate para deixar cada família num estado limpo e previsível.
function fb_blackoutMH(mh, panRest, tiltRest) {
  fb_set(mh.dimmer, FB_OFF);
  fb_set(mh.strobo, FB_OFF);
  fb_set(mh.speed, FB_OFF);
  if (panRest !== undefined)  fb_set(mh.pan, panRest);
  if (tiltRest !== undefined) fb_set(mh.tilt, tiltRest);
  fb_set(mh.panFine, 0);
}

function fb_blackoutBrut(brutList) {
  for (const b of brutList) fb_set(b.dimmer, FB_OFF);
}

function fb_blackoutPar(parList) {
  for (const p of parList) {
    fb_set(p.dimmer, FB_OFF);
    fb_rgb(p, 0, 0, 0);
    fb_set(p.white, FB_OFF);
    fb_set(p.strobo, FB_OFF);
  }
}
