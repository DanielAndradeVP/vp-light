// onda-branca — Cena de movimento e energia em 4 fases (~40s de loop).
// Fase 1: Respiração lenta (0–12s) — Moving Heads varrem tilt em espelho, ribaltas branco rasante, bruts em onda suave.
// Fase 2: Tensão crescente (12–25s) — MH abrem em fan, prism ativa, ribaltas movem ao altar + chase half-LED.
// Fase 3: Impulso rápido (25–35s) — MH cruzam em pan, tilt oscilatório contraposto + strobo, ribaltas varrendo + strobo.
// Fase 4: Resolução (35–40s) — retorno suave ao neutro, loop recomeça.
// Destino: F1.

// ── IDs de fixture ──────────────────────────────────────────────────────────
const ID_M1   = 'fixture_1780805067518_moving_head_beam_1';
const ID_M2   = 'fixture_1780805067518_moving_head_beam_2';
const ID_R1   = 'fixture_1780805067518_ribalta_1';
const ID_R2   = 'fixture_1780805067518_ribalta_2';
const ID_FITA = 'fixture_1780805067518_fita_led';
const ID_B01  = 'fixture_1780805067518_mini_brut_01';
const ID_B02  = 'fixture_1780805067518_mini_brut_02';
const ID_B03  = 'fixture_1780805067518_mini_brut_03';
const ID_B04  = 'fixture_1780805067518_mini_brut_04';

// ── Canais resolvidos ───────────────────────────────────────────────────────
let m1_cw, m1_strobo, m1_dimmer, m1_prism, m1_pan, m1_tilt, m1_speed;
let m2_cw, m2_strobo, m2_dimmer, m2_prism, m2_pan, m2_tilt, m2_speed;
let r1_tilt, r1_speed, r1_dimmer, r1_strobo, r1_function;
let r2_tilt, r2_speed, r2_dimmer, r2_strobo, r2_function;
let r1_leds = null, r2_leds = null;
let fita, b01, b02, b03, b04;

// ── Estado ──────────────────────────────────────────────────────────────────
let tick = 0;

// ── Timing: 25fps, 40ms/tick ────────────────────────────────────────────────
// LOOP = 1000 ticks ≈ 40s
// Fase 1: ticks  0–299 (12s)   Fase 2: 300–624 (13s)
// Fase 3: ticks 625–874 (10s)  Fase 4: 875–999 (5s)
const LOOP = 1000;
const F2   = 300;
const F3   = 625;
const F4   = 875;

// ── Posições de referência (banco de conhecimento / medidas no rig) ─────────
// Moving Head Beam — posições medidas
// PAN_C=centro simétrico, TILT_F=nivelado frente, TILT_A=ponta altar, PAN_L/R=laterais, TILT_L=tilt lateral
const M1_PAN_C = 84, M1_TILT_F = 36, M1_TILT_A = 78,  M1_PAN_L = 42, M1_TILT_L = 35;
const M2_PAN_C = 84, M2_TILT_F = 32, M2_TILT_A = 72,  M2_PAN_R = 44, M2_TILT_L = 26;

// Ribaltas — catalog: R1 tilt funcional=110 speed=190; R2 tilt funcional=105 speed=90
// TL=tilt louvor, TA=tilt altar, SS=speed lenta, SF=speed rápida
const R1_TL = 110, R1_SS = 190, R1_SF = 20;
const R2_TL = 105, R2_SS = 90,  R2_SF = 20;
const TA    = 145; // tilt altar (ambas)

// ── Utilitários ─────────────────────────────────────────────────────────────
function ch(c, v) {
  if (c !== null && c !== undefined) {
    SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v)     { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Pulso senoidal contínuo entre min e max com período em ticks
// Em t=0+offset: retorna midpoint; at sin=1: max; at sin=-1: min
function spulse(t, min, max, period) {
  return min + ((max - min) / 2) * (1 + Math.sin(2 * Math.PI * t / period));
}

// ── OnStart ─────────────────────────────────────────────────────────────────
function OnStart() {
  tick = 0;

  // Moving Head 1
  m1_cw     = getChannel(ID_M1, 'color_wheel');
  m1_strobo = getChannel(ID_M1, 'strobo');
  m1_dimmer = getChannel(ID_M1, 'dimmer');
  m1_prism  = getChannel(ID_M1, 'prism');
  m1_pan    = getChannel(ID_M1, 'pan');
  m1_tilt   = getChannel(ID_M1, 'tilt');
  m1_speed  = getChannel(ID_M1, 'speed');

  // Moving Head 2
  m2_cw     = getChannel(ID_M2, 'color_wheel');
  m2_strobo = getChannel(ID_M2, 'strobo');
  m2_dimmer = getChannel(ID_M2, 'dimmer');
  m2_prism  = getChannel(ID_M2, 'prism');
  m2_pan    = getChannel(ID_M2, 'pan');
  m2_tilt   = getChannel(ID_M2, 'tilt');
  m2_speed  = getChannel(ID_M2, 'speed');

  // Ribalta 1
  r1_tilt     = getChannel(ID_R1, 'tilt');
  r1_speed    = getChannel(ID_R1, 'speed');
  r1_dimmer   = getChannel(ID_R1, 'dimmer');
  r1_strobo   = getChannel(ID_R1, 'strobo');
  r1_function = getChannel(ID_R1, 'function');
  r1_leds = [];
  for (let i = 1; i <= 8; i++) r1_leds.push(getChannel(ID_R1, 'led_' + i));

  // Ribalta 2
  r2_tilt     = getChannel(ID_R2, 'tilt');
  r2_speed    = getChannel(ID_R2, 'speed');
  r2_dimmer   = getChannel(ID_R2, 'dimmer');
  r2_strobo   = getChannel(ID_R2, 'strobo');
  r2_function = getChannel(ID_R2, 'function');
  r2_leds = [];
  for (let i = 1; i <= 8; i++) r2_leds.push(getChannel(ID_R2, 'led_' + i));

  // Garante modo DMX manual nas ribaltas (function=0)
  ch(r1_function, 0);
  ch(r2_function, 0);

  // Fita e Mini Bruts
  fita = getChannel(ID_FITA, 'dimmer');
  b01  = getChannel(ID_B01,  'dimmer');
  b02  = getChannel(ID_B02,  'dimmer');
  b03  = getChannel(ID_B03,  'dimmer');
  b04  = getChannel(ID_B04,  'dimmer');
}

// ── OnExecute ───────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;
  const t    = tick % LOOP;
  const fase = t < F2 ? 1 : t < F3 ? 2 : t < F4 ? 3 : 4;
  const lt   = t < F2 ? t : t < F3 ? t - F2 : t < F4 ? t - F3 : t - F4; // tick local na fase

  // ────────────────────────────────────────────────────────────────────────
  // MOVING HEADS
  // color_wheel=0 (branco) em todas as fases — confirmar: 0 = branco no fixture
  // strobo=255 = shutter aberto (contínuo); strobe na Fase 3 via toggle do dimmer
  // ────────────────────────────────────────────────────────────────────────
  ch(m1_cw, 0); ch(m2_cw, 0);

  if (fase === 1) {
    // Speed lenta — tilt desce em espelho de FRONT até ALTAR ao longo de 12s
    const p = clamp01(lt / (F2 - 1));
    ch(m1_speed,  210); ch(m2_speed,  210);
    ch(m1_pan,    M1_PAN_C); ch(m2_pan, M2_PAN_C);
    ch(m1_tilt,   lerp(M1_TILT_F, M1_TILT_A, p)); // 36 → 78
    ch(m2_tilt,   lerp(M2_TILT_F, M2_TILT_A, p)); // 32 → 72 (espelho)
    ch(m1_dimmer, 255); ch(m2_dimmer, 255);
    ch(m1_strobo, 255); ch(m2_strobo, 255);         // 255 = shutter aberto
    ch(m1_prism,  0);   ch(m2_prism,  0);
  }
  else if (fase === 2) {
    // Speed moderada — fan abre nos primeiros 150t (6s), prism ativa aos 150t
    const fp = clamp01(lt / 150);
    ch(m1_speed,  160); ch(m2_speed,  160);
    ch(m1_pan,    lerp(M1_PAN_C, M1_PAN_L, fp));    // 84 → 42 (lateral esquerda)
    ch(m2_pan,    lerp(M2_PAN_C, M2_PAN_R, fp));    // 84 → 44 (lateral direita)
    ch(m1_tilt,   lerp(M1_TILT_A, M1_TILT_L, fp)); // 78 → 35
    ch(m2_tilt,   lerp(M2_TILT_A, M2_TILT_L, fp)); // 72 → 26
    ch(m1_dimmer, 255); ch(m2_dimmer, 255);
    ch(m1_strobo, 255); ch(m2_strobo, 255);
    // Prism ativa aos 150 ticks (6s = marca de 18s no loop total)
    // NOTA: valor 16 tenta ativar prism 3-faces — ajustar se o fixture usar valor diferente
    const pv = lt >= 150 ? 16 : 0;
    ch(m1_prism,  pv); ch(m2_prism, pv);
  }
  else if (fase === 3) {
    // Speed rápida — M1 varre pan 42→120, M2 faz 44→84→50 (cruzamento no centro)
    ch(m1_speed, 30); ch(m2_speed, 30);
    const sp = clamp01(lt / (F4 - F3 - 1));             // 0→1 em 10s
    ch(m1_pan, lerp(M1_PAN_L, 120, sp));                 // 42 → 120
    if (lt < 125) {
      ch(m2_pan, lerp(M2_PAN_R, M2_PAN_C, lt / 124));   // 44 → 84
    } else {
      ch(m2_pan, lerp(M2_PAN_C, 50, (lt - 125) / 124)); // 84 → 50
    }
    // Tilt oscila (período 50t ≈ 2s), M1 e M2 em fase oposta (contraponto)
    const s1 = Math.sin(2 * Math.PI * lt / 50);
    ch(m1_tilt,   lerp(M1_TILT_F, M1_TILT_A, (1 + s1) / 2)); // oscila 36 ↔ 78
    ch(m2_tilt,   lerp(M2_TILT_F, M2_TILT_A, (1 - s1) / 2)); // oscila 32 ↔ 72, invertido
    // Strobo via toggle de dimmer (~8Hz = toggle a cada 3 ticks)
    const son = (lt % 3) < 2;
    ch(m1_dimmer, son ? 255 : 0);
    ch(m2_dimmer, son ? 255 : 0);
    ch(m1_strobo, 255); ch(m2_strobo, 255);
    ch(m1_prism,  0);   ch(m2_prism,  0);
  }
  else { // fase 4 — retorno suave ao neutro
    ch(m1_speed,  210); ch(m2_speed,  210);
    ch(m1_pan,    M1_PAN_C);  ch(m2_pan,  M2_PAN_C);
    ch(m1_tilt,   M1_TILT_F); ch(m2_tilt, M2_TILT_F);
    ch(m1_dimmer, 255); ch(m2_dimmer, 255);
    ch(m1_strobo, 255); ch(m2_strobo, 255);
    ch(m1_prism,  0);   ch(m2_prism,  0);
  }

  // ────────────────────────────────────────────────────────────────────────
  // RIBALTAS
  // ────────────────────────────────────────────────────────────────────────
  ch(r1_dimmer, 255); ch(r2_dimmer, 255);

  if (fase === 1) {
    // Posição de louvor (rasante), branco cheio, estático
    ch(r1_speed, R1_SS); ch(r2_speed, R2_SS);
    ch(r1_tilt,  R1_TL); ch(r2_tilt,  R2_TL);
    ch(r1_strobo, 0);    ch(r2_strobo, 0);
    for (let i = 0; i < 8; i++) { ch(r1_leds[i], 255); ch(r2_leds[i], 255); }
  }
  else if (fase === 2) {
    // Move para altar (motor se desloca); chase half-LED começa após ~5s (125t)
    ch(r1_speed, 170); ch(r2_speed, 170);
    ch(r1_tilt,  TA);  ch(r2_tilt,  TA);
    ch(r1_strobo, 0);  ch(r2_strobo, 0);
    if (lt >= 125) {
      // Alterna: led_1–4 vs led_5–8, período 38t (~1.5s por ciclo, 19t cada metade)
      const ledPhase = Math.floor((lt - 125) / 19) % 2;
      for (let i = 0; i < 8; i++) {
        const v = (i < 4) ? (ledPhase === 0 ? 0 : 255) : (ledPhase === 0 ? 255 : 0);
        ch(r1_leds[i], v); ch(r2_leds[i], v);
      }
    } else {
      for (let i = 0; i < 8; i++) { ch(r1_leds[i], 255); ch(r2_leds[i], 255); }
    }
  }
  else if (fase === 3) {
    // Speed rápida — tilt oscila louvor ↔ altar a cada 62t (~2.5s/ciclo)
    ch(r1_speed, R1_SF); ch(r2_speed, R2_SF);
    const osc = Math.floor(lt / 62) % 2;
    ch(r1_tilt,  osc === 0 ? R1_TL : TA);
    ch(r2_tilt,  osc === 0 ? R2_TL : TA);
    ch(r1_strobo, 55); ch(r2_strobo, 55); // strobo leve
    for (let i = 0; i < 8; i++) { ch(r1_leds[i], 255); ch(r2_leds[i], 255); }
  }
  else { // fase 4 — retorna ao louvor, tudo branco, sem strobo
    ch(r1_speed, R1_SS); ch(r2_speed, R2_SS);
    ch(r1_tilt,  R1_TL); ch(r2_tilt,  R2_TL);
    ch(r1_strobo, 0);    ch(r2_strobo, 0);
    for (let i = 0; i < 8; i++) { ch(r1_leds[i], 255); ch(r2_leds[i], 255); }
  }

  // ────────────────────────────────────────────────────────────────────────
  // MINI BRUTS — dimmer-only (halogênio via hack dimmer)
  // ────────────────────────────────────────────────────────────────────────
  if (fase === 1 || fase === 4) {
    // Onda senoidal lenta (período 100t ≈ 4s), desfase 25t entre bruts → onda esq→dir
    ch(b01, spulse(t,       76, 255, 100));
    ch(b02, spulse(t + 25,  76, 255, 100));
    ch(b03, spulse(t + 50,  76, 255, 100));
    ch(b04, spulse(t + 75,  76, 255, 100));
  }
  else if (fase === 2) {
    // Onda mais rápida (período 62t ≈ 2.5s), desfase proporcional
    ch(b01, spulse(t,       76, 255, 62));
    ch(b02, spulse(t + 16,  76, 255, 62));
    ch(b03, spulse(t + 31,  76, 255, 62));
    ch(b04, spulse(t + 47,  76, 255, 62));
  }
  else { // fase 3 — bump xadrez (b01+b03 vs b02+b04) a cada 10t ≈ 400ms
    const xa = (lt % 10) < 5;
    ch(b01, xa ? 255 : 0); ch(b03, xa ? 255 : 0);
    ch(b02, xa ? 0 : 255); ch(b04, xa ? 0 : 255);
  }

  // ────────────────────────────────────────────────────────────────────────
  // FITA LED — dimmer-only, presença de preenchimento
  // ────────────────────────────────────────────────────────────────────────
  if (fase === 1) {
    ch(fita, 178);                                        // 70% constante
  }
  else if (fase === 2) {
    ch(fita, lerp(178, 255, clamp01(lt / 75)));           // sobe a 100% em 3s
  }
  else if (fase === 3) {
    ch(fita, 255);                                        // 100% sustentado
  }
  else {
    ch(fita, lerp(255, 178, clamp01(lt / (LOOP - F4 - 1)))); // volta a 70% em 5s
  }
}

// ── OnTerminate ─────────────────────────────────────────────────────────────
function OnTerminate() {
  // Moving Heads — apaga dimmer, fecha prism, zera cw
  ch(m1_dimmer, 0); ch(m2_dimmer, 0);
  ch(m1_strobo, 0); ch(m2_strobo, 0);
  ch(m1_prism,  0); ch(m2_prism,  0);
  ch(m1_cw,     0); ch(m2_cw,     0);

  // Ribaltas — apaga dimmer, leds e strobo
  ch(r1_dimmer, 0); ch(r2_dimmer, 0);
  ch(r1_strobo, 0); ch(r2_strobo, 0);
  if (r1_leds) { for (let i = 0; i < 8; i++) ch(r1_leds[i], 0); }
  if (r2_leds) { for (let i = 0; i < 8; i++) ch(r2_leds[i], 0); }

  // Fita e Mini Bruts
  ch(fita, 0);
  ch(b01, 0); ch(b02, 0); ch(b03, 0); ch(b04, 0);
}
