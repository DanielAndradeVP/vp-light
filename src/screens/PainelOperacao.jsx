/**
 * PainelOperacao.jsx — Tela de operação ao vivo
 * MACRO + Disparo rápido (Scripts F1-F12 / Page-Scripts / Cenas)
 */
import React, { useState, useEffect } from 'react';
import { activeSceneMatches, useShow } from '../store/showStore.js';
import theme from '../theme.js';

const C = {
  bg:           theme.colors.bgDarker,
  surface:      theme.colors.panel,
  surfaceAlt:   theme.colors.surfaceAlt,
  panelDark:    theme.colors.panelDark,
  border:       theme.colors.borderSoft,
  borderStrong: theme.colors.borderStrong,
  text:         theme.colors.text,
  textMuted:    theme.colors.textMuted,
  textDisabled: theme.colors.textDisabled,
  accent:       theme.colors.accent,
  warn:         theme.colors.warn,
  active:       theme.colors.active,
  btnBg:        theme.colors.buttonSurface,
  btnHover:     theme.colors.buttonHover,
  selection:    theme.colors.selection,
};

const sp = theme.spacing;   // xxs:2 xs:4 sm:6 md:8 lg:10 xl:12
const ty = theme.typography; // compact(11px) body(12px) label(11px) tooltip(10px) title(14px,700)

const SCENE_KEYS = ['A','S','D','F','G','H','J','K','L','Z','X','C','V'];
const FKEYS      = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];

// ──────────────────────────────────────────────
// Componentes base
// ──────────────────────────────────────────────

function Btn({ children, onClick, active, danger, disabled, style }) {
  const [hover, setHover] = useState(false);
  const base = {
    ...theme.components.button,              // bg #000, color #fff, border 1px solid #fff, borderRadius 0, fontSize 12, fontWeight 700
    cursor:      disabled ? 'not-allowed' : 'pointer',
    opacity:     disabled ? 0.4 : 1,
    borderColor: danger ? theme.colors.warn : active ? theme.colors.borderStrong : theme.colors.text,
    borderWidth: active ? 2 : 1,
    background:  danger && active ? theme.colors.warnOverlay
                : active          ? theme.colors.selection
                : hover           ? C.btnHover
                :                   C.btnBg,
    color:       danger ? theme.colors.warn : theme.colors.text,
    transition:  'background .1s',
    userSelect:  'none',
    ...style,
  };
  return (
    <button
      style={base}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      ...ty.tooltip,                                           // fontSize: '10px'
      fontWeight: 700,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color:   C.textMuted,
      padding: `${sp.sm}px ${sp.lg}px ${sp.xs}px`,
      borderBottom: theme.borders.soft,
    }}>
      {children}
    </div>
  );
}

function InputBase({ style, ...props }) {
  return (
    <input
      style={{
        padding:      theme.spacing.inputPadding,             // '4px 6px'
        background:   C.bg,
        border:       theme.borders.soft,
        color:        C.text,
        ...ty.body,                                           // fontSize: '12px'
        borderRadius: theme.radius.md,
        boxSizing:    'border-box',
        ...style,
      }}
      {...props}
    />
  );
}

// ──────────────────────────────────────────────
// MACRO — editor de passos
// ──────────────────────────────────────────────

const STEP_DEFAULTS = { scriptName: '', duration: 2000, fadeIn: 0, fadeOut: 0 };

function MacroEditorModal({ macro, onSave, onClose }) {
  const [draft, setDraft] = useState(() => macro ? {
    name:    macro.name,
    steps:   macro.steps?.map(s => ({ ...STEP_DEFAULTS, ...s })) ?? [{ ...STEP_DEFAULTS }],
    loop:    macro.loop    ?? false,
    htp:     macro.htp     ?? true,
    overlap: macro.overlap ?? 0,
  } : { name: '', steps: [{ ...STEP_DEFAULTS }], loop: false, htp: true, overlap: 0 });

  function setField(key, value) { setDraft(d => ({ ...d, [key]: value })); }
  function setStep(i, key, value) {
    setDraft(d => {
      const steps = [...d.steps];
      steps[i] = { ...steps[i], [key]: value };
      return { ...d, steps };
    });
  }
  function addStep()    { setDraft(d => ({ ...d, steps: [...d.steps, { ...STEP_DEFAULTS }] })); }
  function removeStep(i){ setDraft(d => ({ ...d, steps: d.steps.filter((_, idx) => idx !== i) })); }

  const canSave = draft.name.trim() && draft.steps.length > 0 && draft.steps.every(s => s.scriptName.trim());

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: theme.components.modal.overlay,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        background:   theme.components.modal.background,
        border:       theme.components.modal.border,
        borderRadius: theme.radius.md,
        width: 540, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow:   theme.elevation.modal,
        fontFamily:  ty.fontFamily,
        color:       C.text,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: `${sp.md}px ${sp.xl + sp.md}px`,
          borderBottom: theme.borders.soft,
        }}>
          <span style={{ ...ty.title }}>{macro ? 'Editar Macro' : 'Nova Macro'}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textMuted,
            ...ty.toolbar, cursor: 'pointer', padding: `0 ${sp.xs}px`,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: `${sp.xl}px ${sp.xl + sp.md}px` }}>

          {/* Nome */}
          <div style={{ marginBottom: sp.xl }}>
            <label style={{ ...ty.label, color: C.textMuted, display: 'block', marginBottom: sp.xs }}>
              Nome da macro
            </label>
            <InputBase
              value={draft.name}
              onChange={e => setField('name', e.target.value)}
              disabled={!!macro}
              placeholder="nome-da-macro"
              style={{ width: '100%' }}
            />
          </div>

          {/* Opções globais */}
          <div style={{ display: 'flex', gap: sp.xl + sp.xs, marginBottom: sp.xl, ...ty.body }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: sp.sm, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.loop} onChange={e => setField('loop', e.target.checked)} />
              Loop
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: sp.sm, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.htp} onChange={e => setField('htp', e.target.checked)} />
              HTP (máx canal)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: sp.sm }}>
              Overlap (ms):
              <InputBase
                type="number" min={0} step={100} value={draft.overlap}
                onChange={e => setField('overlap', Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
          </div>

          {/* Passos */}
          <div style={{ ...ty.compact, color: C.textMuted, marginBottom: sp.sm, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Passos
          </div>
          {draft.steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: sp.sm, alignItems: 'center',
              marginBottom: sp.sm,
              padding: `${sp.sm}px ${sp.md}px`,
              background: C.surfaceAlt,
              border: theme.borders.soft,
              borderRadius: theme.radius.md,
            }}>
              <span style={{ ...ty.compact, color: C.textMuted, minWidth: 18 }}>{i + 1}</span>
              <InputBase
                value={step.scriptName}
                onChange={e => setStep(i, 'scriptName', e.target.value)}
                placeholder="nome-do-script"
                style={{ flex: 2 }}
              />
              <span style={{ ...ty.compact, color: C.textMuted }}>Dur</span>
              <InputBase type="number" min={100} step={100} value={step.duration}
                onChange={e => setStep(i, 'duration', Number(e.target.value))}
                style={{ width: 72 }}
              />
              <span style={{ ...ty.compact, color: C.textMuted }}>In</span>
              <InputBase type="number" min={0} step={100} value={step.fadeIn}
                onChange={e => setStep(i, 'fadeIn', Number(e.target.value))}
                style={{ width: 60 }}
              />
              <span style={{ ...ty.compact, color: C.textMuted }}>Out</span>
              <InputBase type="number" min={0} step={100} value={step.fadeOut}
                onChange={e => setStep(i, 'fadeOut', Number(e.target.value))}
                style={{ width: 60 }}
              />
              <button onClick={() => removeStep(i)} style={{
                background: 'none', border: 'none', color: C.warn,
                cursor: 'pointer', ...ty.title, padding: `0 ${sp.xs}px`,
              }} title="Remover passo">✕</button>
            </div>
          ))}
          <button onClick={addStep} style={{
            marginTop: sp.xs,
            padding: `${sp.sm}px ${sp.xl}px`,
            background: C.btnBg, border: theme.borders.soft,
            color: C.text, ...ty.body, cursor: 'pointer',
            borderRadius: theme.radius.md,
          }}>
            + Passo
          </button>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: sp.md,
          padding: `${sp.lg}px ${sp.xl + sp.md}px`,
          borderTop: theme.borders.soft,
        }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn onClick={() => canSave && onSave(draft)} disabled={!canSave} active>
            {macro ? 'Salvar' : 'Criar'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// MACRO — painel esquerdo
// ──────────────────────────────────────────────

function MacroPanel() {
  const [macros, setMacros]           = useState({});
  const [macroStatus, setMacroStatus] = useState(null); // { activeMacro, currentStep }
  const [editorOpen, setEditorOpen]   = useState(false);
  const [editingMacro, setEditingMacro] = useState(null);

  useEffect(() => {
    if (!window.vp?.getMacros) return;
    let alive = true;
    const id = setInterval(async () => {
      const result = await window.vp.getMacros?.();
      if (alive && result) setMacros(result);
      const status = await window.vp.getMacroStatus?.();
      if (alive && status) setMacroStatus(status);
    }, 200);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function handleCreate(draft) {
    const result = await window.vp.createMacro?.(draft);
    if (result?.ok) {
      setMacros(prev => ({ ...prev, [draft.name]: { ...draft, running: false, currentStep: -1 } }));
      setEditorOpen(false);
      setEditingMacro(null);
    }
  }

  async function handleStart(name)  { await window.vp.startMacro?.(name); }
  async function handleStop(name)   { await window.vp.stopMacro?.(name); }
  async function handleNext(name)   { await window.vp.nextMacroStep?.(name); }
  async function handleRemove(name) {
    await window.vp.removeMacro?.(name);
    setMacros(prev => { const n = { ...prev }; delete n[name]; return n; });
  }

  const macroList      = Object.values(macros);
  const activeMacroName = macroStatus?.activeMacro ?? null;
  const currentStep     = macroStatus?.currentStep ?? -1;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.panelDark, border: theme.borders.soft,
      borderRadius: theme.radius.md, overflow: 'hidden',
    }}>
      <SectionTitle>Macros</SectionTitle>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${sp.sm}px 0` }}>
        {macroList.length === 0 && (
          <div style={{ ...ty.body, color: C.textDisabled, padding: `${sp.xl}px ${sp.lg}px`, textAlign: 'center' }}>
            {window.vp?.getMacros ? 'Nenhuma macro criada' : 'Backend de macros não disponível'}
          </div>
        )}
        {macroList.map((macro) => {
          const isActive  = activeMacroName === macro.name;
          const stepIndex = isActive ? currentStep : -1;
          return (
            <div key={macro.name} style={{
              margin: `${sp.xs}px ${sp.md}px`,
              padding: `${sp.md}px ${sp.lg}px`,
              background: isActive ? theme.colors.accentOverlay : C.btnBg,
              border:     isActive ? `2px solid ${C.accent}` : theme.borders.soft,
              borderRadius: theme.radius.md,
            }}>
              {/* Nome + chips + remover */}
              <div style={{ display: 'flex', alignItems: 'center', gap: sp.sm, marginBottom: isActive ? sp.sm : 0 }}>
                <span style={{
                  flex: 1, ...ty.title,
                  color: isActive ? C.active : C.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {macro.name}
                </span>
                {macro.loop && (
                  <span style={{ ...ty.tooltip, color: C.textMuted, border: theme.borders.soft, padding: `1px ${sp.xs}px`, borderRadius: theme.radius.md }}>
                    LOOP
                  </span>
                )}
                {macro.htp && (
                  <span style={{ ...ty.tooltip, color: C.textMuted, border: theme.borders.soft, padding: `1px ${sp.xs}px`, borderRadius: theme.radius.md }}>
                    HTP
                  </span>
                )}
                <button onClick={() => handleRemove(macro.name)} style={{
                  background: 'none', border: 'none', color: C.textDisabled,
                  cursor: 'pointer', ...ty.title, padding: `0 ${sp.xxs}px`,
                }} title="Remover macro">✕</button>
              </div>

              {/* Transport */}
              <div style={{ display: 'flex', gap: sp.xs }}>
                <Btn
                  onClick={() => isActive ? handleStop(macro.name) : handleStart(macro.name)}
                  active={isActive}
                  style={{ flex: 1, ...ty.compact }}
                >
                  {isActive ? '■ Stop' : '▶ Start'}
                </Btn>
                {isActive && (
                  <Btn onClick={() => handleNext(macro.name)} style={{ ...ty.compact, minWidth: 64 }}>
                    Próximo →
                  </Btn>
                )}
              </div>

              {/* Passo atual */}
              {isActive && macro.steps?.length > 0 && (
                <div style={{ marginTop: sp.sm, display: 'flex', gap: sp.xs, flexWrap: 'wrap' }}>
                  {macro.steps.map((step, si) => (
                    <div key={si} style={{
                      padding:      `2px ${sp.md}px`,
                      ...ty.compact,
                      borderRadius: theme.radius.md,
                      background:   si === stepIndex ? C.accent     : C.surfaceAlt,
                      color:        si === stepIndex ? C.bg          : C.textMuted,
                      border:       si === stepIndex ? 'none'        : theme.borders.soft,
                      fontWeight:   si === stepIndex ? 700           : 400,
                    }}>
                      {si + 1}: {step.scriptName || '?'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botão nova macro */}
      <div style={{ padding: `${sp.md}px ${sp.lg}px`, borderTop: theme.borders.soft }}>
        <Btn onClick={() => { setEditingMacro(null); setEditorOpen(true); }} style={{ width: '100%' }}>
          + Nova Macro
        </Btn>
      </div>

      {editorOpen && (
        <MacroEditorModal
          macro={editingMacro}
          onSave={handleCreate}
          onClose={() => { setEditorOpen(false); setEditingMacro(null); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// DISPARO RÁPIDO — painel direito
// ──────────────────────────────────────────────

const DISPATCH_TABS = [
  { key: 'scripts',     label: 'Scripts F1–F12' },
  { key: 'pagescripts', label: 'Page-Scripts'   },
  { key: 'cenas',       label: 'Cenas'          },
];

function QuickDispatchPanel({ currentPage }) {
  const { show, activeScenes, toggleScene } = useShow();
  const [tab, setTab]       = useState('scripts');
  const [scripts, setScripts] = useState({});

  const scenes      = show?.pages?.[currentPage]?.scenes  ?? {};
  const pageScripts = show?.page_scripts?.[currentPage]   ?? {};

  useEffect(() => {
    if (!window.vp?.getAllScripts) return;
    window.vp.getAllScripts().then(s => setScripts(s || {}));
    let alive = true;
    const id = setInterval(async () => {
      const s = await window.vp.getAllScripts?.();
      if (alive && s) setScripts(s);
    }, 300);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function handleToggleScript(fkey) {
    if (!scripts[fkey]) return;
    const result = await window.vp.toggleScript?.(fkey);
    if (result?.ok != null) {
      setScripts(prev => ({ ...prev, [fkey]: { ...prev[fkey], running: result.running } }));
    }
  }

  async function handleTogglePageScript(sceneKey) {
    if (!pageScripts[sceneKey]) return;
    await window.vp.togglePageScript?.(currentPage, sceneKey);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.panelDark, border: theme.borders.soft,
      borderRadius: theme.radius.md, overflow: 'hidden',
    }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: theme.borders.soft }}>
        {DISPATCH_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: `${sp.md}px ${sp.xs}px`,
            ...ty.compact, fontWeight: 700,
            background:   tab === t.key ? C.surface  : C.panelDark,
            color:        tab === t.key ? C.text      : C.textMuted,
            border:       'none',
            borderBottom: tab === t.key ? `2px solid ${C.borderStrong}` : '2px solid transparent',
            cursor: 'pointer', letterSpacing: '0.5px',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: sp.lg }}>

        {/* ── Scripts F1-F12 ── */}
        {tab === 'scripts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: sp.sm }}>
            {FKEYS.map(fkey => {
              const script  = scripts[fkey];
              const running = script?.running ?? false;
              return (
                <button key={fkey} onClick={() => handleToggleScript(fkey)} style={{
                  padding:      `${sp.lg}px ${sp.sm}px`,
                  cursor:       script ? 'pointer' : 'default',
                  background:   running ? theme.colors.accentOverlay : script ? C.btnBg : C.bg,
                  border:       running ? `2px solid ${C.accent}`    : theme.borders.soft,
                  color:        running ? C.active : script ? C.text : C.textDisabled,
                  borderRadius: theme.radius.md,
                  display:      'flex', flexDirection: 'column', alignItems: 'center', gap: sp.xxs,
                  userSelect:   'none',
                }}>
                  <span style={{ ...ty.tooltip, color: running ? C.active : C.textMuted }}>{fkey}</span>
                  <span style={{ ...ty.compact, fontWeight: 700, overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {script?.name ?? '—'}
                  </span>
                  {running && <span style={{ ...ty.tooltip, color: C.active }}>▶ ATIVO</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Page-Scripts ── */}
        {tab === 'pagescripts' && (
          <>
            {Object.keys(pageScripts).length === 0 && (
              <div style={{ ...ty.body, color: C.textDisabled, textAlign: 'center', marginTop: sp.xl + sp.xl }}>
                Nenhum script de cena nesta página
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: sp.sm }}>
              {SCENE_KEYS.map(key => {
                const ps = pageScripts[key];
                if (!ps) return null;
                return (
                  <button key={key} onClick={() => handleTogglePageScript(key)} style={{
                    padding:      `${sp.lg}px ${sp.sm}px`,
                    cursor:       'pointer',
                    background:   C.btnBg,
                    border:       theme.borders.soft,
                    color:        C.text,
                    borderRadius: theme.radius.md,
                    display:      'flex', flexDirection: 'column', alignItems: 'center', gap: sp.xxs,
                    userSelect:   'none',
                  }}>
                    <span style={{ ...ty.tooltip, color: C.textMuted }}>{key}</span>
                    <span style={{ ...ty.compact, fontWeight: 700, overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ps.name ?? '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── Cenas ── */}
        {tab === 'cenas' && (
          <>
            {Object.keys(scenes).length === 0 && (
              <div style={{ ...ty.body, color: C.textDisabled, textAlign: 'center', marginTop: sp.xl + sp.xl }}>
                Nenhuma cena nesta página
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: sp.sm }}>
              {SCENE_KEYS.map(key => {
                const scene  = scenes[key];
                if (!scene?.name) return null;
                const isActive = activeScenes.some(activeRef => activeSceneMatches(activeRef, currentPage, key));
                return (
                  <button key={key} onClick={() => toggleScene(key)} style={{
                    padding:      `${sp.lg}px ${sp.sm}px`,
                    cursor:       'pointer',
                    background:   isActive ? theme.colors.primaryOverlay : C.btnBg,
                    border:       isActive ? `2px solid ${C.borderStrong}` : theme.borders.soft,
                    color:        C.text,
                    borderRadius: theme.radius.md,
                    display:      'flex', flexDirection: 'column', alignItems: 'center', gap: sp.xxs,
                    userSelect:   'none',
                  }}>
                    <span style={{ ...ty.tooltip, color: isActive ? C.text : C.textMuted }}>{key}</span>
                    <span style={{
                      width: sp.lg, height: sp.lg, borderRadius: '50%',
                      background: scene.color ?? C.border,
                      display: 'block', flexShrink: 0,
                    }} />
                    <span style={{ ...ty.compact, fontWeight: 700, overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {scene.name}
                    </span>
                    {isActive && <span style={{ ...ty.tooltip, color: C.borderStrong }}>● ATIVA</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tela principal
// ──────────────────────────────────────────────

export default function PainelOperacao({ onClose }) {
  const { currentPage, blackout } = useShow();
  const [blackoutActive, setBlackoutActive] = useState(false);

  async function handleBlackout() {
    if (blackoutActive) {
      setBlackoutActive(false);
    } else {
      setBlackoutActive(true);
      await blackout();
    }
  }

  async function handleStopAll() {
    try { await window.vp.stopAllScripts?.(); } catch (_) { /* handler opcional */ }
    await blackout();
    setBlackoutActive(true);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: C.bg, color: C.text, fontFamily: ty.fontFamily,
    }}>
      {/* TOP BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: sp.sm, padding: `0 ${sp.lg}px`,
        background:   theme.colors.panelDark,
        borderBottom: theme.borders.thin,
        minHeight:    48, flexShrink: 0,
      }}>
        <Btn onClick={onClose} style={{ ...ty.title, minWidth: 36 }}>←</Btn>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '1.5px', marginRight: sp.md }}>
          VP·LIGHT{' '}
          <span style={{ ...ty.compact, fontWeight: 400, color: C.textMuted, letterSpacing: 0 }}>
            PAINEL DE OPERAÇÃO
          </span>
        </span>

        <div style={{ flex: 1 }} />

        <Btn
          onClick={handleBlackout}
          active={blackoutActive}
          danger
          style={{ minWidth: 100, ...ty.toolbar, letterSpacing: '1px' }}
        >
          BLACKOUT {blackoutActive ? '●' : '○'}
        </Btn>
        <Btn onClick={handleStopAll} danger style={{ minWidth: 90 }}>
          Parar tudo
        </Btn>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: sp.lg, padding: sp.lg }}>
        {/* Coluna esquerda — MACRO */}
        <div style={{ width: 320, flexShrink: 0, minHeight: 0 }}>
          <MacroPanel />
        </div>

        {/* Coluna direita — Disparo rápido */}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <QuickDispatchPanel currentPage={currentPage} />
        </div>
      </div>
    </div>
  );
}
