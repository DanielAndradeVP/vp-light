# Guia — Base comum `fire-base.js` e como escrever scripts-fire

> Companheiro da auditoria `auditoria-fable5-fire-scripts.md`.
> Arquivo da base: `scripts/fire-base.js` (criado, validado, isolado).
> Público: quem for construir o `pacote-de-scripts-fire` (fase Sonnet + Codex).

---

## 0. O que foi entregue e por que é seguro

- **`scripts/fire-base.js`** — biblioteca única de IDs de fixture, canais, presets de
  rig, cores e helpers de coreografia. Corrige-se num lugar só; os 50 scripts herdam.
- **Isolamento garantido:** a base é uma *biblioteca pura*. Ela **não** define
  `OnStart` / `OnExecute` / `OnTerminate`. Sem funções de ciclo de vida, o engine
  não executa nada ao carregá-la — é inerte. Sua mera presença no repositório
  **não altera o comportamento atual** do sistema (nenhum script existente muda,
  nada roda sozinho). Só passa a agir quando for *injetada* num script-fire.
- **Validação feita:** o arquivo foi compilado no sandbox exato do engine
  (`new Function(SetChannel, getChannel, adapter, ctx, ...)`) sobre o
  `shows/vp.show.json` real. Confirmado: parseia, não define ciclo de vida, e todos
  os resolvers devolvem os canais DMX corretos (MH1 pan=132, bruts em ordem física
  400/401/402/410, PAR layout B sem `white`, fixtures `enabled:false` → `null`,
  cor via adapter difere MH1=30 / MH2=16 para "red").

---

## 1. Como a base chega até um script (ativação)

O sandbox dos scripts **não tem `require`/`import`**. O único jeito de compartilhar
código é *concatenar* (prepend) o texto da base antes do script, na hora de compilar.

Hoje o engine já faz isso para `mov-*` com o `mov-preset.js`
(`readScriptCode` em `electron/main.js:1078`). Para os scripts-fire é preciso um
gancho equivalente por prefixo `fire-`. **Este patch ainda NÃO foi aplicado** — de
propósito, para não alterar o comportamento atual. Aplique-o no início da fase de
construção do pacote.

### Patch mínimo e seguro (aplicar ao iniciar o pacote)

Em `electron/main.js`, logo abaixo de `scriptPrependsMovPreset` (~linha 1076):

```js
const FIRE_BASE = path.join(SCRIPTS_DIR, 'fire-base.js');

/** Scripts fire-* (exceto fire-base.js) concatenam a base antes de compilar. */
function scriptPrependsFireBase(filePath) {
  const base = path.basename(filePath);
  if (base === 'fire-base.js') return false;
  return base.startsWith('fire-') && base.endsWith('.js');
}
```

Em `readScriptCode` (~linha 1078), adicionar o segundo caso:

```js
function readScriptCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  if (scriptPrependsMovPreset(filePath)) {
    if (fs.existsSync(MOV_PADRAO_PRESET)) {
      code = fs.readFileSync(MOV_PADRAO_PRESET, 'utf-8') + '\n\n' + code;
    }
  } else if (scriptPrependsFireBase(filePath)) {           // <── novo
    if (fs.existsSync(FIRE_BASE)) {                          // <── novo
      code = fs.readFileSync(FIRE_BASE, 'utf-8') + '\n\n' + code; // <── novo
    }                                                       // <── novo
  }
  return code;
}
```

No watcher (`handleScriptFileEvent`, ~linha 1303), para hot-reload quando a base muda:

```js
  if (filename === 'mov-preset.js') {
    /* ...bloco existente... */
  } else if (filename === 'fire-base.js') {                 // <── novo
    for (const [fkey, meta] of Object.entries(scriptMeta)) {
      if (scriptPrependsFireBase(meta.file) && runningScripts[fkey]) {
        stopRunningScript(fkey, 'fire-base modificado');
        startScript(fkey);
      }
    }
  } else {
    /* ...bloco existente... */
  }
```

**Por que é seguro:** só afeta arquivos novos com prefixo `fire-`. Nenhum `mov-*`,
`brut-*` ou qualquer script atual entra nesse caminho. `mov-preset` continua intacto.
Exige reiniciar `npm run dev` (mudança no main process).

> **Convenção obrigatória de nome:** todo script do pacote começa com `fire-`
> (ex.: `fire-01-pisca-cruz.js`). É o prefixo que dispara a injeção da base.

### Validar sem tocar no app (recomendado durante o desenvolvimento)

Dá para testar qualquer script-fire fora do Electron, usando o mesmo compilador do
engine. Guarde este harness em `tools/validate-fire.js` (ver §7) e rode
`node tools/validate-fire.js scripts/fire-01-*.js` antes de ligar no app.

---

## 2. Anatomia de um script-fire (esqueleto)

Três funções de ciclo de vida. A base já está disponível (foi prepended), então
você tem `FB_*`, `fb_*`, `SetChannel`, `getChannel`, `adapter`.

```js
// fire-NN-nome.js — <descrição curta do efeito e destino>.
// Base: scripts/fire-base.js (injetada automaticamente).

let mh, ribs, bruts;     // handles resolvidos (canais)
let tick = 0;

// Parâmetros de coreografia — SÓ ritmo/tempo aqui. Zero ID, zero canal, zero
// posição de rig (isso mora na base).
const ON_TICKS  = 4;     // 160ms aceso
const OFF_TICKS = 2;     // 80ms apagado

function OnStart() {
  tick = 0;
  mh    = fb_allMH();     // [MH1, MH2] com canais resolvidos
  ribs  = fb_bothRib();   // [RIB1, RIB2]
  bruts = fb_allBrut();   // ordem FÍSICA (400,401,402,410)
  for (const m of mh) fb_mhColorWake(m); // destrava roda de cor
}

function OnExecute() {    // chamado a cada 40ms
  tick++;
  const on = fb_flashOn(tick, ON_TICKS, OFF_TICKS);
  fb_blackoutBrut(bruts);
  if (on) for (const b of bruts) fb_set(b.dimmer, FB_FULL);
}

function OnTerminate() {  // limpeza ao desativar
  fb_blackoutBrut(bruts);
}
```

**Regras do esqueleto:**
- Resolva canais no `OnStart` (não em todo tick). `getChannel` lê o show; chamar
  uma vez basta.
- `OnExecute` roda a 25fps. Pense em **ticks** (`fb_secToTicks(2)` = 50).
- `OnTerminate` **sempre** deixa as fixtures usadas num estado limpo
  (`fb_blackout*`). Sem isso, o palco "trava" no último frame ao desligar.
- Warmup opcional (~50 ticks) para reposicionar beams sem luz antes de acender —
  padrão herdado dos `mov-traj-*`.

---

## 3. Referência da API da base (cheat sheet)

### Relógio
| Símbolo | O quê |
|---|---|
| `FB_FPS` (25), `FB_MS_PER_TICK` (40) | constantes do loop |
| `fb_secToTicks(s)` / `fb_ticksToSec(t)` | conversão tempo ↔ ticks |

### IDs e grupos
| Símbolo | O quê |
|---|---|
| `FB_ID.MH1/MH2/WOSH/RIB1/RIB2/FITA/PAR_TEST` | IDs individuais |
| `FB_ID.RIB_STATIC[]`, `FB_ID.PAR[]`, `FB_ID.BRUT.{B01..B04}` | coleções de IDs |
| `FB_BRUT_STAGE` | IDs dos bruts em **ordem física** de palco |

### Resolvers (chamar no `OnStart`) → objeto `{alias: canal|null}`
| Função | Devolve |
|---|---|
| `fb_mh(id)` | `{color,strobo,dimmer,gobo,prism,speed,pan,panFine,tilt,tiltFine,reset,id}` |
| `fb_rib(id)` | `{tilt,speed,dimmer,leds[8],strobo,fn,id}` |
| `fb_ribStatic(id)` | `{dimmer,r,g,b,strobo,special,id}` |
| `fb_par(id)` | `{dimmer,r,g,b,white,strobo,id}` (`white`/`strobo`=null no layout B) |
| `fb_brut(id)` | `{dimmer,id}` |
| `fb_wosh()` | `{pan,tilt,speed,strobo,color,cyan,magenta,yellow,zoom,...}` |
| `fb_fita()` | canal do dimmer da fita (número, não objeto) |

### Grupos resolvidos (atalhos)
`fb_allMH()` · `fb_bothRib()` · `fb_allBrut()` (ordem física) · `fb_allPar()` · `fb_allRibStatic()`

### Escrita (nunca use `SetChannel` cru num script)
| Função | O quê |
|---|---|
| `fb_set(canal, valor)` | escreve com clamp 0..255; ignora canal `null` |
| `fb_rgb(fx, r, g, b)` | cor RGB direta (PAR / ribalta estática) |
| `fb_dim(fx, v)` | dimmer da fixture |

### Cor dos beams (via adapter — obrigatório)
| Função / const | O quê |
|---|---|
| `fb_mhColor(mh, nome)` | roda de cor por adapter — trata MH1≠MH2 sozinho |
| `FB_MH_COLOR.{WHITE,RED,GREEN,YELLOW,AMBER}` | nomes comuns aos dois beams |
| `fb_mhColorWake(mh)` | pulso 1→0 no `OnStart` p/ destravar o motor da roda |

### Movimento
| Função | O quê |
|---|---|
| `fb_mhMove(mhList, pan, tilt, speed)` | move o par espelhado (MH1 pan−gap, MH2 pan+gap) |
| `fb_mhOpen(mh)` | acende lâmpada + abre shutter |
| `fb_ribMove(ribs, speed, tilt)` | move o par de ribaltas **sincronizado** (mesma speed/tilt) |
| `fb_ribDim(ribs, v)` / `fb_ribLeds(ribs, v)` | dimmer / barra de leds das ribaltas |
| `fb_ribStaticApply(list, r,g,b, dim)` | RGB nas ribaltas estáticas |

### Presets de rig (não invente números)
| Const | O quê |
|---|---|
| `FB_MH1_POS`, `FB_MH2_POS` | posições pan/tilt medidas (`PAN_C/L/R`, `TILT_F/A/L/MID/FLOOR`) |
| `FB_MH_GAP` (8) | separação de pan entre os dois beams |
| `FB_MH_SPEED.{VERY_SLOW..VERY_FAST}` | virtual_speed (maior = mais lento) |
| `FB_RIB.{TILT_*,SPEED_*,DIM_*}` | tilts/speeds/dimmers de ribalta |
| `FB_FITA_DIM` (178), `FB_FULL` (255), `FB_OFF` (0) | níveis comuns |

### Coreografia (matemática de efeito)
| Função | O quê |
|---|---|
| `fb_lerp(a,b,t)` / `fb_clamp(v,lo,hi)` | interpolação / limite |
| `fb_smoothstep(t)` | suaviza 0..1 (trajetória sem salto) |
| `fb_triangle(tick, period)` | onda 0→1→0 |
| `fb_sine01(tick, period)` | seno normalizado 0..1 |
| `fb_flashOn(tick, on, off)` | true enquanto aceso no ciclo |
| `fb_chaseIndex(tick, count, step)` | índice aceso agora num chase |
| `fb_keyframeState(phase, keyframes)` | pan/tilt suave por keyframes `[{pan,tilt,dur}]` (último = primeiro p/ loop) |

### Blackout / reset (use no `OnTerminate`)
`fb_blackoutMH(mh, panRest?, tiltRest?)` · `fb_blackoutRib(ribs)` · `fb_blackoutBrut(brutList)` · `fb_blackoutPar(parList)`

---

## 4. Exemplo A — chase físico nos Mini Bruts

```js
// fire-07-brut-pingpong.js — Ping-pong dos bruts na ordem real do palco.
let bruts, tick = 0;
const STEP_TICKS = 5; // 200ms por brut

function OnStart() {
  tick = 0;
  bruts = fb_allBrut();           // já em ordem física 400→401→402→410
}

function OnExecute() {
  tick++;
  // vai-e-volta: 0,1,2,3,2,1 → índice de 6 passos mapeado nos 4 bruts
  const seq = [0, 1, 2, 3, 2, 1];
  const idx = seq[fb_chaseIndex(tick, seq.length, STEP_TICKS)];
  fb_blackoutBrut(bruts);
  fb_set(bruts[idx].dimmer, FB_FULL);
}

function OnTerminate() {
  fb_blackoutBrut(bruts);
}
```
Nenhum ID, nenhum canal DMX, nenhuma ordem "400/401" escrita à mão — tudo vem da base.

## 5. Exemplo B — trajetória sincronizada dos beams

```js
// fire-23-mh-varredura.js — Beams varrendo em par, cor âmbar, ribaltas em wash.
let mh, ribs, tick = 0;

const KF = [
  { pan: FB_MH1_POS.PAN_L, tilt: FB_MH1_POS.TILT_A,     dur: 90 },
  { pan: FB_MH1_POS.PAN_R, tilt: FB_MH1_POS.TILT_FLOOR, dur: 90 },
  { pan: FB_MH1_POS.PAN_C, tilt: FB_MH1_POS.TILT_MID,   dur: 90 },
  { pan: FB_MH1_POS.PAN_L, tilt: FB_MH1_POS.TILT_A,     dur: 0  }, // fecha o loop
];

function OnStart() {
  tick = 0;
  mh   = fb_allMH();
  ribs = fb_bothRib();
  for (const m of mh) fb_mhColorWake(m);
}

function OnExecute() {
  tick++;
  const p = fb_keyframeState(tick, KF);
  for (const m of mh) { fb_mhOpen(m); fb_mhColor(m, FB_MH_COLOR.AMBER); }
  fb_mhMove(mh, p.pan, p.tilt, FB_MH_SPEED.SLOW);
  fb_ribMove(ribs, FB_RIB.SPEED_SLOW, FB_RIB.TILT_LOUVOR);
  fb_ribDim(ribs, FB_RIB.DIM_WASH);
}

function OnTerminate() {
  fb_blackoutMH(mh[0], FB_MH1_POS.PAN_L, FB_MH1_POS.TILT_MID);
  fb_blackoutMH(mh[1], FB_MH2_POS.PAN_L, FB_MH2_POS.TILT_MID);
  fb_blackoutRib(ribs);
}
```

---

## 6. Regras de ouro (checklist por script)

- [ ] Nome começa com `fire-` e é único (`fire-NN-descricao.js`).
- [ ] **Zero** ID de fixture literal (`fixture_...`) e **zero** canal DMX literal no script.
- [ ] Toda escrita passa por `fb_set` / helpers — nunca `SetChannel` direto.
- [ ] Canais resolvidos no `OnStart`, não a cada tick.
- [ ] Cor de beam **sempre** por `fb_mhColor` (adapter) — nunca valor fixo na roda.
- [ ] Ribaltas motorizadas movidas **em par** por `fb_ribMove` — nunca offset manual
      (+70 etc.) nem speed diferente por lado (a calibração física é do engine).
- [ ] `OnTerminate` limpa todas as famílias usadas (`fb_blackout*`).
- [ ] Durações/velocidades específicas do efeito ficam em constantes no topo do script.
- [ ] Efeito distinto dos outros 49 (ver matriz, §8).

---

## 7. Harness de validação offline (`tools/validate-fire.js`)

Compila um script-fire exatamente como o engine (base + script no mesmo escopo),
sobre o show real, e reporta erros de parse, ciclo de vida ausente e canais escritos.

```js
// tools/validate-fire.js — node tools/validate-fire.js scripts/fire-01-*.js
const fs = require('fs'); const path = require('path');
const show = require('../shows/vp.show.json');
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const isEnabled = f => f?.enabled !== false;
const getFixture = id => show.fixtures.find(f => f.id === id || norm(f.name) === norm(id)) || null;
const beamFallback = { dimmer:['dimmer','fecho_lampada'], speed:['speed','virtual_speed'], prism:['prism','prism_1'], gobo:['gobo','gobo_wheel'], strobo_dimmer:['strobo_dimmer','strobo'] };
function cands(f, t){ return norm(f.fixtureType||f.type)==='moving_head_beam' ? (beamFallback[t]||[t]) : [t]; }
function getChannel(id, alias){ const f=getFixture(id); if(!f||!isEnabled(f)||!Array.isArray(f.channels)) return null; const t=norm(alias); const idx=f.channels.findIndex(c=>cands(f,t).includes(norm(c))); return idx===-1?null:(Number(f.startChannel)||1)+idx; }
const writes = new Set();
function SetChannel(ch, v){ if(ch>=1&&ch<=512) writes.add(ch); }
const adapter = { resolve:(id,alias,key,logical)=>{ const f=getFixture(id); if(!f||!isEnabled(f)) return null; const idx=(f.channels||[]).findIndex(c=>norm(c)===norm(alias)); if(idx===-1) return null; const m=f.adapters?.[norm(key)]; if(!m) return null; const lk=norm(logical); return Object.prototype.hasOwnProperty.call(m,lk)?Math.max(0,Math.min(255,Math.round(m[lk]))):null; } };

const scriptPath = process.argv[2];
const base = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'fire-base.js'), 'utf-8');
const code = base + '\n\n' + fs.readFileSync(scriptPath, 'utf-8');
const ctx = {};
try {
  new Function('SetChannel','getChannel','adapter','ctx', code + `
    ctx.OnStart=typeof OnStart==='function'?OnStart:null;
    ctx.OnExecute=typeof OnExecute==='function'?OnExecute:null;
    ctx.OnTerminate=typeof OnTerminate==='function'?OnTerminate:null;
  `)(SetChannel, getChannel, adapter, ctx);
} catch (e) { console.error('PARSE FAIL:', e.message); process.exit(1); }

if (!ctx.OnExecute) { console.error('FALTA OnExecute'); process.exit(1); }
if (ctx.OnStart) ctx.OnStart();
for (let i = 0; i < 400; i++) { try { ctx.OnExecute(); } catch(e){ console.error('OnExecute tick',i,'->',e.message); process.exit(1);} }
if (ctx.OnTerminate) ctx.OnTerminate();

// Anti-hardcode: nenhum ID/canal literal no script (fora comentários)
const raw = fs.readFileSync(scriptPath, 'utf-8').replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
const hardId = /fixture_\d+/.test(raw);
const hardCh = /SetChannel\s*\(\s*\d/.test(raw);
console.log('OK:', path.basename(scriptPath), '| canais tocados:', writes.size,
  '| lifecycle:', !!ctx.OnStart, !!ctx.OnExecute, !!ctx.OnTerminate,
  hardId ? '| ⚠ ID literal!' : '', hardCh ? '| ⚠ SetChannel literal!' : '');
```

Critério de aceite por script: `PARSE OK`, tem `OnExecute`, 400 ticks sem erro,
`OnTerminate` sem erro, **sem** `⚠ ID literal` / `⚠ SetChannel literal`.

---

## 8. Matriz dos 50 (evitar duplicação) — dividir ANTES de codar

Combine efeito × família × ritmo para garantir 50 distintos. Sugestão de eixos:

| Eixo | Valores |
|---|---|
| Família | bruts · beams · ribaltas motorizadas · ribaltas estáticas · PAR · fita · combos |
| Padrão | flash · chase/ping-pong · varredura · wash/respiração · strobo · keyframe · pulso musical |
| Ritmo | lento (louvor) · médio · rápido (celebração) |

Regra prática: cada script fixa **1 família dominante + 1 padrão + 1 ritmo**; combos
misturam 2 famílias mas com padrões que não repitam um script simples já existente.
Numere por categoria (ex.: `fire-01..10` bruts, `11..20` beams, `21..30` ribaltas,
`31..40` PAR/fita, `41..50` combos). Sonnet 01–25, Codex 26–50.

---

## 9. Próximos passos

1. Aplicar o patch de injeção (§1) e reiniciar `npm run dev`. Testar com 1 script-piloto.
2. Criar `tools/validate-fire.js` (§7) e rodar em CI local antes de cada commit.
3. Fechar a matriz dos 50 (§8) para não haver efeito repetido entre os dois autores.
4. Escrever os 50 consumindo só a base; validar cada um pelo harness e no app.
5. README curto do pacote apontando para este guia como referência da API.
