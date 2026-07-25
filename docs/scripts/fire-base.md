# fire-base.js — versão corrigida (adapter-first, enxuta)

Base para o pacote dos 50 scripts-fire. Prepended automaticamente em todo `fire-*.js` (`scriptPrependsFireBase`, `electron/main.js`).

**Pergunta que motivou esta revisão: esse arquivo ainda é necessário?** Parcialmente. Boa parte da v1 (color helper, `fb_mhOpen`/`fb_mhClose`) era só um wrapper vazio em cima do adapter — sem nenhum valor sobre chamar `adapter.setColor`/`adapter.setDimmer` direto no script. Isso foi **cortado**. O que sobra e continua justificado é só o que o adapter **não** cobre:

| Mantido | Por quê |
|---|---|
| `FB_ID`, `FB_BRUT_STAGE` | ids centralizados — adapter não sabe id de fixture |
| `FB_MH1_POS`/`FB_MH2_POS`/`FB_RIB`/`FB_FITA_DIM` | posições/níveis crus — pan/tilt não têm nome lógico no adapter |
| `fb_mhMove` | agrupa 4 chamadas de adapter (pan/tilt/speed × 2 beams) numa só — poupa boilerplate real |
| `fb_rib`/`fb_brut`/`fb_par`/resolvers | canais que o adapter não cobre (tilt/function/leds de ribalta, RGB de PAR sem profile) |
| `fb_lerp`/`fb_smoothstep`/`fb_triangle`/`fb_sine01`/`fb_flashOn`/`fb_chaseIndex`/`fb_keyframeState` | matemática de efeito, adapter não faz isso |
| `fb_blackout*` | conveniência de `OnTerminate`, ainda economiza repetição |

| Cortado | Motivo |
|---|---|
| `FB_MH_COLOR` + `fb_mhColor` | wrapper vazio — chame `adapter.setColor(id, name)` direto no script, confira `.ok` |
| `fb_mhOpen`/`fb_mhClose` | idem — `adapter.setDimmer(id, 1)`/`(id, 0)` direto |

## Cor — sem wrapper, sem tabela hardcoded

O bug antigo (`FB_MH_COLOR.AMBER` quebrando no MH2) some porque não existe mais lista "comum": cada script chama o adapter direto e confere o resultado.

```js
// No script (não em fire-base.js):
const c1 = adapter.setColor(FB_ID.MH1, 'yellow');
const c2 = adapter.setColor(FB_ID.MH2, 'yellow');
if (!c1.ok || !c2.ok) return; // não inventa fallback
```

Nomes lógicos por fixture: consulte `docs/auditorias/bateamento/mapeamento-detalhado-mh1-mh2.md` ou `adapter.getCapabilities(fixtureId)` em runtime — nunca hardcode aqui de novo.

## `fire-base.js` — o que sobra

```js
const FB_ID = {
  MH1: 'fixture_1780805067518_moving_head_beam_1',
  MH2: 'fixture_1780805067518_moving_head_beam_2',
  WOSH: 'fixture_1780805067518_moving_wosh_01',
  RIB1: 'fixture_1780805067518_ribalta_1',
  RIB2: 'fixture_1780805067518_ribalta_2',
  FITA: 'fixture_1780805067518_fita_led',
  BRUT: {
    B01: 'fixture_1780805067518_mini_brut_01', B02: 'fixture_1780805067518_mini_brut_02',
    B03: 'fixture_1780805067518_mini_brut_03', B04: 'fixture_1780805067518_mini_brut_04',
  },
  PAR: [/* ...9 ids Deluxe... */],
};
const FB_BRUT_STAGE = [FB_ID.BRUT.B01, FB_ID.BRUT.B03, FB_ID.BRUT.B02, FB_ID.BRUT.B04]; // ordem física real

const FB_MH1_POS = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_MID: 110, TILT_FLOOR: 144 };
const FB_MH2_POS = { PAN_C: 84, PAN_R: 44, PAN_L: 50,  TILT_F: 32, TILT_A: 72, TILT_MID: 100, TILT_FLOOR: 125 };
const FB_MH_GAP = 8;
const FB_MH_SPEED = { VERY_SLOW: 0.86, SLOW: 0.80, MED: 0.71, FAST: 0.61, VERY_FAST: 0.55 }; // 0..1 nativo do adapter
const FB_RIB = { TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 0.75, SPEED_FAST: 0.08, DIM_WASH: 0.86 };
const FB_FITA_DIM = 0.70;

// Move os dois MH com pan-base + gap simétrico, sempre via adapter.
function fb_mhMove(pan, tilt, speed01) {
  adapter.setPanTilt(FB_ID.MH1, { pan: pan - FB_MH_GAP, tilt });
  adapter.setPanTilt(FB_ID.MH2, { pan: pan + FB_MH_GAP, tilt });
  adapter.setMovementSpeed(FB_ID.MH1, speed01);
  adapter.setMovementSpeed(FB_ID.MH2, speed01);
}

function fb_mhColorWake(mhId) {
  const ch = getChannel(mhId, 'color_wheel');
  if (ch !== null) { SetChannel(ch, 1); SetChannel(ch, 0); }
}

// Ribalta: dimmer/speed via adapter; tilt/function/leds/strobo raw (sem profile).
function fb_ribMove(ribId, tilt, speed01) {
  const fn = getChannel(ribId, 'function');
  const tiltCh = getChannel(ribId, 'tilt');
  if (fn !== null) SetChannel(fn, 0);
  if (tiltCh !== null) SetChannel(tiltCh, tilt);
  adapter.setMovementSpeed(ribId, speed01);
}
function fb_ribDim(ribId, value01) { adapter.setDimmer(ribId, value01); }
function fb_ribLeds(ribId, value) {
  for (let i = 1; i <= 8; i++) {
    const led = getChannel(ribId, 'led_' + i);
    if (led !== null) SetChannel(led, Math.max(0, Math.min(255, Math.round(value))));
  }
}

// Matemática de coreografia — sem equivalente no adapter.
function fb_lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function fb_smoothstep(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
function fb_triangle(tick, period) {
  const p = ((tick % period) + period) % period, half = period / 2;
  return p < half ? p / half : 2 - p / half;
}
function fb_sine01(tick, period) { return (Math.sin((2 * Math.PI * tick) / period) + 1) / 2; }
function fb_flashOn(tick, onTicks, offTicks) { return (tick % (onTicks + offTicks)) < onTicks; }
function fb_chaseIndex(tick, count, stepTicks) { return Math.floor(tick / stepTicks) % count; }

function fb_keyframeState(phase, keyframes) {
  if (!Array.isArray(keyframes) || keyframes.length < 2) return { pan: 0, tilt: 0 }; // FIX: guarda lista inválida
  const cycle = keyframes.reduce((s, k) => s + k.dur, 0) || 1; // FIX: nunca 0/NaN
  const p = ((phase % cycle) + cycle) % cycle;
  let acc = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const dur = keyframes[i].dur;
    if (dur > 0 && p < acc + dur) {
      const t = fb_smoothstep((p - acc) / dur);
      return { pan: fb_lerp(keyframes[i].pan, keyframes[i + 1].pan, t), tilt: fb_lerp(keyframes[i].tilt, keyframes[i + 1].tilt, t) };
    }
    acc += dur;
  }
  const last = keyframes[keyframes.length - 1];
  return { pan: last.pan, tilt: last.tilt };
}

// Blackout de conveniência para OnTerminate.
function fb_blackoutMH(mhId, panRest, tiltRest) {
  adapter.setDimmer(mhId, 0);
  adapter.setMovementSpeed(mhId, 0);
  if (panRest !== undefined) adapter.setPanTilt(mhId, { pan: panRest, tilt: tiltRest });
}
function fb_blackoutRib(ribId) {
  fb_ribDim(ribId, 0);
  fb_ribMove(ribId, FB_RIB.TILT_LOW, 0);
  fb_ribLeds(ribId, 0);
}
function fb_blackoutBrut(brutId) { adapter.setDimmer(brutId, 0); }
```

## Nota sobre duplicação de posições (não resolvida por adapter)

`FB_MH1_POS`/`FB_MH2_POS` continuam duplicando `MP_M1`/`MP_M2` de `mov-preset.js` porque `mov-*` e `fire-*` são famílias de prepend separadas, e pan/tilt não têm nome lógico no adapter — o número cru precisa morar em algum lugar. Mitigação: nunca editar uma posição sem checar `docs/auditorias/bateamento/mapeamento-detalhado-mh1-mh2.md` primeiro — ele é a fonte, os dois arquivos são cópia.
