/**
 * PainelOperacao.jsx — Tela de operação ao vivo
 * MACRO + Disparo rápido (Scripts F1-F12 / Page-Scripts / Cenas)
 */
import React, { useState, useEffect, useMemo } from 'react';
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
const ly = theme.layout;

const SCENE_KEYS = ['A','S','D','F','G','H','J','K','L','Z','X','C','V'];
const FKEYS      = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];

const TOUCH = {
  topBar:    ly.touchTopBarHeight,
  tab:       ly.touchTabHeight,
  scene:     ly.touchSceneHeight,
  fKey:      ly.touchFKeyHeight,
  actionW:   ly.touchActionMinWidth,
  macroCol:  ly.operationPanelMacroWidth,
};

// ──────────────────────────────────────────────
// Componentes base — touch / operação ao vivo
// ──────────────────────────────────────────────

function Btn({ children, onClick, active, danger, disabled, style, touch }) {
  const [hover, setHover] = useState(false);
  const base = {
    ...theme.components.button,
    minHeight: touch ? TOUCH.tab : theme.components.button.minHeight,
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

function PanelFrame({ children, style }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.bg,
      border: theme.borders.thin,
      borderRadius: theme.radius.none,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, subtitle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: `${sp.md}px ${sp.lg}px`,
      minHeight: TOUCH.tab,
      background: C.panelDark,
      borderBottom: theme.borders.thin,
    }}>
      <span style={{
        ...ty.toolbar,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: C.text,
      }}>
        {children}
      </span>
      {subtitle && (
        <span style={{ ...ty.tooltip, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

function TabStrip({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      background: C.bg,
      borderBottom: theme.borders.thin,
      minHeight: TOUCH.tab,
      flexShrink: 0,
    }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              flex: 1,
              minHeight: TOUCH.tab,
              padding: `0 ${sp.sm}px`,
              ...ty.compact,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              background: isActive ? C.surface : C.bg,
              color: isActive ? C.text : C.textMuted,
              border: 'none',
              borderBottom: isActive ? `3px solid ${C.borderStrong}` : '3px solid transparent',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Botão de disparo — espelha barras de cena/F-key da mesa principal */
function DispatchPad({ label, name, active, running, empty, color, onClick, variant, pageScript }) {
  const isScene = variant === 'scene';
  const minH = isScene ? TOUCH.scene : TOUCH.fKey;

  let bg = C.btnBg;
  let borderStyle = `1px solid ${C.border}`;
  let textColor = C.textDisabled;

  if (!empty) {
    if (isScene) {
      bg = pageScript ? theme.colors.bgDarker : (color || C.btnBg);
      borderStyle = (running || active)
        ? `3px solid ${C.borderStrong}`
        : `1px solid ${theme.colors.text}`;
      textColor = C.text;
    } else {
      bg = color || C.btnBg;
      borderStyle = running
        ? `3px solid ${C.borderStrong}`
        : `1px solid ${theme.colors.border}`;
      textColor = C.text;
    }
  }

  return (
    <button
      onClick={empty ? undefined : onClick}
      style={{
        ...theme.components[isScene ? 'sceneButton' : 'fKeyButton'],
        minHeight: minH,
        height: minH,
        padding: `${sp.xs}px ${sp.sm}px`,
        borderRadius: theme.radius.none,
        cursor: empty ? 'default' : 'pointer',
        background: bg,
        border: borderStyle,
        color: textColor,
        boxShadow: theme.elevation.none,
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sp.xxs,
        minWidth: 0,
        userSelect: 'none',
        opacity: empty ? 0.45 : 1,
      }}
    >
      <span style={{ ...ty.button, color: 'inherit', lineHeight: 1.1 }}>{label}</span>
      {isScene && color && !pageScript && !empty && (
        <span style={{
          width: sp.lg + sp.xs,
          height: sp.lg + sp.xs,
          borderRadius: theme.radius.none,
          background: color,
          border: theme.borders.soft,
          flexShrink: 0,
        }} />
      )}
      {name && (
        <span style={{
          ...ty.tooltip,
          fontWeight: running || active ? 700 : 400,
          color: running || active ? C.textSecondary : C.textMuted,
          overflow: 'hidden',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          lineHeight: 1.1,
        }}>
          {name}
        </span>
      )}
      {running && (
        <span style={{ ...ty.tooltip, color: C.borderStrong, fontWeight: 700, letterSpacing: '0.5px' }}>
          ▶ ATIVO
        </span>
      )}
      {active && isScene && !running && (
        <span style={{ ...ty.tooltip, color: C.borderStrong, fontWeight: 700 }}>● ATIVA</span>
      )}
    </button>
  );
}

function InputBase({ style, ...props }) {
  return (
    <input
      style={{
        padding:      theme.spacing.inputPadding,
        background:   C.bg,
        border:       theme.borders.soft,
        color:        C.text,
        ...ty.body,
        borderRadius: theme.radius.none,
        boxSizing:    'border-box',
        minHeight:    32,
        ...style,
      }}
      {...props}
    />
  );
}

function SelectBase({ style, children, ...props }) {
  return (
    <select
      style={{
        padding:      theme.spacing.inputPadding,
        background:   C.bg,
        border:       theme.borders.soft,
        color:        C.text,
        ...ty.body,
        borderRadius: theme.radius.none,
        boxSizing:    'border-box',
        minHeight:    32,
        width:        '100%',
        cursor:       'pointer',
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

// ──────────────────────────────────────────────
// MACRO — editor de passos
// ──────────────────────────────────────────────

const STEP_DEFAULTS = { scriptName: '' };
const DEFAULT_STEP_INTERVAL_MS = 2000;

function MacroEditorModal({ macro, onSave, onClose }) {
  const [availableScripts, setAvailableScripts] = useState([]);
  const [draft, setDraft] = useState(() => {
    if (macro) {
      const steps = macro.steps?.map(s => ({
        scriptName: s.script || s.scriptName || '',
      })) ?? [{ ...STEP_DEFAULTS }];
      const firstDur = macro.steps?.[0]?.durationMs ?? macro.steps?.[0]?.duration;
      return {
        name: macro.name || macro.id,
        steps,
        stepIntervalMs: Number(firstDur) || DEFAULT_STEP_INTERVAL_MS,
      };
    }
    return {
      name: '',
      steps: [{ ...STEP_DEFAULTS }],
      stepIntervalMs: DEFAULT_STEP_INTERVAL_MS,
    };
  });

  useEffect(() => {
    if (!window.vp?.listScripts) return;
    window.vp.listScripts().then((res) => {
      if (!res?.ok || !Array.isArray(res.files)) return;
      const names = res.files.map(f => f.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
      setAvailableScripts(names);
    });
  }, []);

  const scriptOptions = useMemo(() => {
    const names = new Set(availableScripts);
    draft.steps.forEach(s => { if (s.scriptName) names.add(s.scriptName); });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [availableScripts, draft.steps]);

  function setField(key, value) { setDraft(d => ({ ...d, [key]: value })); }
  function setStep(i, value) {
    setDraft(d => {
      const steps = [...d.steps];
      steps[i] = { scriptName: value };
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
        borderRadius: theme.radius.none,
        width: 420, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow:   theme.elevation.modal,
        fontFamily:  ty.fontFamily,
        color:       C.text,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: `${sp.md}px ${sp.xl}px`,
          borderBottom: theme.borders.thin,
          background: C.panelDark,
        }}>
          <span style={{ ...ty.title }}>{macro ? 'Editar Macro' : 'Nova Macro'}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textMuted,
            ...ty.toolbar, cursor: 'pointer', padding: `0 ${sp.xs}px`,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: sp.xl }}>

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

          <div style={{ marginBottom: sp.xl }}>
            <label style={{ ...ty.label, color: C.textMuted, display: 'block', marginBottom: sp.xs }}>
              Intervalo entre passos (ms)
            </label>
            <InputBase
              type="number"
              min={500}
              step={500}
              value={draft.stepIntervalMs}
              onChange={e => setField('stepIntervalMs', Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ ...ty.tooltip, color: C.textDisabled, marginTop: sp.xs }}>
              Tempo que cada script fica ativo antes de passar para o próximo.
            </div>
          </div>

          <div style={{
            ...ty.compact,
            color: C.textMuted,
            marginBottom: sp.sm,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Scripts na sequência
          </div>
          {scriptOptions.length === 0 && (
            <div style={{ ...ty.tooltip, color: C.warn, marginBottom: sp.sm }}>
              Nenhum script encontrado em scripts/. Crie scripts na mesa principal primeiro.
            </div>
          )}
          {draft.steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: sp.sm, alignItems: 'center',
              marginBottom: sp.sm,
            }}>
              <span style={{
                ...ty.button,
                color: C.textMuted,
                minWidth: 24,
                textAlign: 'center',
              }}>
                {i + 1}
              </span>
              <SelectBase
                value={step.scriptName}
                onChange={e => setStep(i, e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">— selecione um script —</option>
                {scriptOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </SelectBase>
              <button
                onClick={() => removeStep(i)}
                disabled={draft.steps.length <= 1}
                style={{
                  background: 'none',
                  border: theme.borders.soft,
                  color: draft.steps.length <= 1 ? C.textDisabled : C.warn,
                  cursor: draft.steps.length <= 1 ? 'not-allowed' : 'pointer',
                  ...ty.button,
                  minWidth: 32,
                  minHeight: 32,
                  padding: 0,
                }}
                title="Remover passo"
              >
                ✕
              </button>
            </div>
          ))}
          <Btn onClick={addStep} style={{ width: '100%', marginTop: sp.xs }}>
            + Script
          </Btn>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: sp.md,
          padding: `${sp.lg}px ${sp.xl}px`,
          borderTop: theme.borders.thin,
          background: C.panelDark,
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
  const [macros, setMacros]           = useState([]);
  const [macroStatus, setMacroStatus] = useState(null); // { id, stepIndex, loop } | null
  const [editorOpen, setEditorOpen]   = useState(false);
  const [editingMacro, setEditingMacro] = useState(null);

  useEffect(() => {
    if (!window.vp?.macroList) return;
    let alive = true;
    const id = setInterval(async () => {
      const list = await window.vp.macroList?.();
      if (alive && Array.isArray(list)) setMacros(list);
      const status = await window.vp.macroStatus?.();
      if (alive) setMacroStatus(status || null);
    }, 200);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function handleSaveMacro(draft) {
    const isEdit = !!editingMacro;
    const id = isEdit
      ? (editingMacro.id || editingMacro.name)
      : draft.name.trim();
    if (!id) return;

    const intervalMs = Math.max(500, Number(draft.stepIntervalMs) || DEFAULT_STEP_INTERVAL_MS);
    const def = {
      name: isEdit ? (editingMacro.name || id) : id,
      mergeMode: 'htp',
      loop: false,
      steps: draft.steps.map(s => ({
        script: s.scriptName.trim(),
        durationMs: intervalMs,
        fadeInMs: 0,
        fadeOutMs: 0,
        overlapMs: 0,
      })),
    };

    const result = isEdit
      ? await window.vp.updateMacro?.(id, def)
      : await window.vp.createMacro?.(id, def);

    if (result?.ok) {
      const list = await window.vp.macroList?.();
      if (Array.isArray(list)) setMacros(list);
      setEditorOpen(false);
      setEditingMacro(null);
    }
  }

  function handleOpenEdit(macro) {
    setEditingMacro(macro);
    setEditorOpen(true);
  }

  async function handleStart(id)  { await window.vp.startMacro?.(id); }
  async function handleStop(id)   { await window.vp.stopMacro?.(id); }
  async function handleNext(id)   { await window.vp.nextMacroStep?.(id); }
  async function handleRemove(id) {
    await window.vp.removeMacro?.(id);
    setMacros(prev => prev.filter(m => m.id !== id));
  }

  const activeMacroId = macroStatus?.id ?? null;
  const currentStep   = macroStatus?.stepIndex ?? -1;

  return (
    <PanelFrame>
      <SectionTitle subtitle={`${macros.length} cadastrada${macros.length !== 1 ? 's' : ''}`}>
        Macros
      </SectionTitle>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: sp.sm, background: C.panelDark }}>
        {macros.length === 0 && (
          <div style={{
            ...ty.body,
            color: C.textDisabled,
            padding: `${sp.xl * 2}px ${sp.lg}px`,
            textAlign: 'center',
            border: theme.borders.soft,
            background: C.bg,
          }}>
            {window.vp?.macroList ? 'Nenhuma macro criada' : 'Backend de macros não disponível'}
          </div>
        )}
        {macros.map((macro) => {
          const macroId = macro.id || macro.name;
          const macroLabel = macro.name || macro.id;
          const isActive  = activeMacroId === macroId;
          const stepIndex = isActive ? currentStep : -1;
          return (
            <div key={macroId} style={{
              marginBottom: sp.sm,
              padding: sp.lg,
              background: isActive ? theme.colors.accentOverlay : C.bg,
              border: isActive ? `3px solid ${C.accent}` : theme.borders.thin,
              borderRadius: theme.radius.none,
            }}>
              {/* Nome + chips + remover */}
              <div style={{ display: 'flex', alignItems: 'center', gap: sp.sm, marginBottom: sp.md }}>
                <span style={{
                  flex: 1, ...ty.title,
                  color: isActive ? C.active : C.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {macroLabel}
                </span>
                {macro.loop && (
                  <span style={{
                    ...ty.chip, color: C.textMuted,
                    border: theme.borders.soft,
                    padding: `${sp.xxs}px ${sp.sm}px`,
                    borderRadius: theme.radius.none,
                  }}>
                    LOOP
                  </span>
                )}
                {(macro.mergeMode === 'htp' || macro.htp) && (
                  <span style={{
                    ...ty.chip, color: C.textMuted,
                    border: theme.borders.soft,
                    padding: `${sp.xxs}px ${sp.sm}px`,
                    borderRadius: theme.radius.none,
                  }}>
                    HTP
                  </span>
                )}
                <button
                  onClick={() => handleOpenEdit(macro)}
                  style={{
                    background: 'none', border: theme.borders.soft,
                    color: C.textMuted, cursor: 'pointer',
                    ...ty.compact, minWidth: 32, minHeight: 32,
                    padding: `0 ${sp.xs}px`,
                  }}
                  title="Editar macro"
                >
                  ✎
                </button>
                <button onClick={() => handleRemove(macroId)} style={{
                  background: 'none', border: theme.borders.soft,
                  color: C.warn, cursor: 'pointer',
                  ...ty.button, minWidth: 32, minHeight: 32,
                  padding: 0,
                }} title="Remover macro">✕</button>
              </div>

              {/* Transport */}
              <div style={{ display: 'flex', gap: sp.sm }}>
                <Btn
                  onClick={() => isActive ? handleStop(macroId) : handleStart(macroId)}
                  active={isActive}
                  touch
                  style={{ flex: 1, ...ty.toolbar }}
                >
                  {isActive ? '■ Stop' : '▶ Start'}
                </Btn>
                {isActive && (
                  <Btn onClick={() => handleNext(macroId)} touch style={{ minWidth: 96, ...ty.compact }}>
                    Próximo →
                  </Btn>
                )}
              </div>

              {/* Passo atual */}
              {isActive && macro.steps?.length > 0 && (
                <div style={{
                  marginTop: sp.md,
                  display: 'flex', gap: sp.xs, flexWrap: 'wrap',
                  paddingTop: sp.sm,
                  borderTop: theme.borders.soft,
                }}>
                  {macro.steps.map((step, si) => (
                    <div key={si} style={{
                      padding: `${sp.xxs + 1}px ${sp.md}px`,
                      minHeight: 24,
                      display: 'flex', alignItems: 'center',
                      ...ty.compact,
                      borderRadius: theme.radius.none,
                      background: si === stepIndex ? C.accent : C.surfaceAlt,
                      color: si === stepIndex ? C.bg : C.textMuted,
                      border: si === stepIndex ? 'none' : theme.borders.soft,
                      fontWeight: si === stepIndex ? 700 : 400,
                    }}>
                      {si + 1}: {step.script || step.scriptName || '?'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botão nova macro */}
      <div style={{ padding: sp.lg, borderTop: theme.borders.thin, background: C.bg, flexShrink: 0 }}>
        <Btn onClick={() => { setEditingMacro(null); setEditorOpen(true); }} touch style={{ width: '100%', ...ty.toolbar }}>
          + Nova Macro
        </Btn>
      </div>

      {editorOpen && (
        <MacroEditorModal
          macro={editingMacro}
          onSave={handleSaveMacro}
          onClose={() => { setEditorOpen(false); setEditingMacro(null); }}
        />
      )}
    </PanelFrame>
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
  const [pageScripts, setPageScripts] = useState({});

  const scenes = show?.pages?.[currentPage]?.scenes ?? {};

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

  useEffect(() => {
    if (!window.vp?.getAllPageScripts) return;
    window.vp.getAllPageScripts(currentPage).then(s => setPageScripts(s || {}));
    let alive = true;
    const id = setInterval(async () => {
      const s = await window.vp.getAllPageScripts?.(currentPage);
      if (alive && s) setPageScripts(s);
    }, 300);
    return () => { alive = false; clearInterval(id); };
  }, [currentPage]);

  async function handleToggleScript(fkey) {
    if (!scripts[fkey]) return;
    const result = await window.vp.toggleScript?.(fkey);
    if (result?.ok != null) {
      setScripts(prev => ({ ...prev, [fkey]: { ...prev[fkey], running: result.running } }));
    }
  }

  async function handleTogglePageScript(sceneKey) {
    if (!pageScripts[sceneKey]) return;
    const result = await window.vp.togglePageScript?.(currentPage, sceneKey);
    if (result?.ok != null) {
      setPageScripts(prev => ({ ...prev, [sceneKey]: { ...prev[sceneKey], running: result.running } }));
    }
  }

  return (
    <PanelFrame>
      <SectionTitle subtitle={`Página ${currentPage}`}>
        Disparo rápido
      </SectionTitle>

      <TabStrip tabs={DISPATCH_TABS} active={tab} onChange={setTab} />

      {/* Conteúdo */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: sp.sm,
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        gap: sp.sm,
      }}>

        {/* ── Scripts F1-F12 ── */}
        {tab === 'scripts' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: sp.xs,
            flex: 1,
            alignContent: 'start',
          }}>
            {FKEYS.map(fkey => {
              const script  = scripts[fkey];
              const running = script?.running ?? false;
              return (
                <DispatchPad
                  key={fkey}
                  label={fkey}
                  name={script?.name}
                  running={running}
                  empty={!script}
                  color={script?.color || C.btnBg}
                  onClick={() => handleToggleScript(fkey)}
                  variant="fkey"
                />
              );
            })}
          </div>
        )}

        {/* ── Page-Scripts ── */}
        {tab === 'pagescripts' && (
          Object.keys(pageScripts).length === 0 ? (
            <div style={{
              ...ty.body,
              color: C.textDisabled,
              textAlign: 'center',
              padding: `${sp.xl * 3}px ${sp.lg}px`,
              border: theme.borders.soft,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              Nenhum script de cena nesta página
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: sp.xs,
              flex: 1,
              alignContent: 'start',
            }}>
              {SCENE_KEYS.map(key => {
                const ps = pageScripts[key];
                if (!ps) return (
                  <DispatchPad key={key} label={key} empty variant="scene" />
                );
                const running = ps.running ?? false;
                return (
                  <DispatchPad
                    key={key}
                    label={key}
                    name={ps.name}
                    running={running}
                    pageScript
                    onClick={() => handleTogglePageScript(key)}
                    variant="scene"
                  />
                );
              })}
            </div>
          )
        )}

        {/* ── Cenas ── */}
        {tab === 'cenas' && (
          Object.keys(scenes).length === 0 ? (
            <div style={{
              ...ty.body,
              color: C.textDisabled,
              textAlign: 'center',
              padding: `${sp.xl * 3}px ${sp.lg}px`,
              border: theme.borders.soft,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              Nenhuma cena nesta página
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: sp.xs,
              flex: 1,
              alignContent: 'start',
            }}>
              {SCENE_KEYS.map(key => {
                const scene  = scenes[key];
                if (!scene?.name) return (
                  <DispatchPad key={key} label={key} empty variant="scene" />
                );
                const isActive = activeScenes.some(activeRef => activeSceneMatches(activeRef, currentPage, key));
                return (
                  <DispatchPad
                    key={key}
                    label={key}
                    name={scene.name}
                    active={isActive}
                    color={scene.color ?? C.border}
                    onClick={() => toggleScene(key)}
                    variant="scene"
                  />
                );
              })}
            </div>
          )
        )}
      </div>
    </PanelFrame>
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
    try { await window.vp.stopAllScripts?.(); } catch (_) { /* ignore */ }
    await blackout();
    setBlackoutActive(true);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: theme.colors.bgDark, color: C.text, fontFamily: ty.fontFamily,
    }}>
      {/* TOP BAR — alinhada à mesa principal */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: sp.md,
        padding: `0 ${sp.lg}px`,
        background: C.panelDark,
        borderBottom: theme.borders.thin,
        minHeight: TOUCH.topBar,
        flexShrink: 0,
      }}>
        <Btn onClick={onClose} touch style={{ minWidth: 44, ...ty.title }}>←</Btn>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span style={{ ...ty.toolbarLarge, letterSpacing: '1.5px', lineHeight: 1.2 }}>
            VP·LIGHT
          </span>
          <span style={{ ...ty.tooltip, color: C.textMuted, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Painel de Operação
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <Btn
          onClick={handleBlackout}
          active={blackoutActive}
          danger
          touch
          style={{ minWidth: TOUCH.actionW, ...ty.toolbar, letterSpacing: '0.5px' }}
        >
          BLACKOUT {blackoutActive ? '●' : '○'}
        </Btn>
        <Btn
          onClick={handleStopAll}
          danger
          touch
          style={{ minWidth: TOUCH.actionW, ...ty.toolbar }}
        >
          Parar tudo
        </Btn>
      </div>

      {/* CONTENT — disparo ocupa área principal; macros à esquerda */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        gap: sp.sm,
        padding: sp.sm,
        background: theme.colors.bgDark,
        minHeight: 0,
      }}>
        <div style={{ width: TOUCH.macroCol, flexShrink: 0, minHeight: 0 }}>
          <MacroPanel />
        </div>

        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <QuickDispatchPanel currentPage={currentPage} />
        </div>
      </div>
    </div>
  );
}
