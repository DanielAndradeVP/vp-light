/**
 * FixtureEditor.jsx — Modal de edição de aparelho
 * Abas: Básico | Descrição
 */
import React, { useState, useEffect } from 'react';
import { useShow } from '../store/showStore.js';
import theme from '../theme.js';

const C = {
  bg: '#1a1a1a', surface: '#242424', border: '#383838',
  text: '#e0e0e0', textMuted: '#888', white: '#ffffff',
  overlay: 'rgba(0,0,0,0.7)', input: '#2e2e2e', inputBorder: '#444',
};

export default function FixtureEditor({ fixtureId, draftFixture, onCreate, onClose }) {
  const { show, updateFixture, saveShow } = useShow();
  const isNewFixture = fixtureId === 'new';
  const original = isNewFixture
    ? draftFixture
    : show.fixtures.find(f => f.id === fixtureId);
  const editorFixtureId = original?.id || fixtureId;

  const [tab, setTab] = useState('basico');
  const [name, setName] = useState(original?.name || '');
  const [manufacturer, setManufacturer] = useState(original?.manufacturer || '');
  const [model, setModel] = useState(original?.model || '');
  const [note, setNote] = useState(original?.note ?? original?.observation ?? '');
  const [startChannel, setStartChannel] = useState(original?.startChannel || 1);
  const [channelCount, setChannelCount] = useState(original?.channelCount || 1);
  const [channels, setChannels] = useState(() => {
    const base = original?.channels || [];
    // garante array do tamanho channelCount
    return Array.from({ length: original?.channelCount || 1 }, (_, i) => base[i] || '');
  });

  // Quando channelCount muda, ajusta o array de channels
  function handleChannelCountChange(val) {
    const n = Math.max(1, Math.min(512, Number(val)));
    setChannelCount(n);
    setChannels(prev => Array.from({ length: n }, (_, i) => prev[i] || ''));
  }

  function handleChannelName(i, val) {
    setChannels(prev => { const next = [...prev]; next[i] = val; return next; });
  }

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  async function handleConfirm() {
    const fixtureData = {
      name,
      manufacturer,
      model,
      note,
      observation: '',
      startChannel: Number(startChannel),
      channelCount: Number(channelCount),
      channels,
    };
    const nextFixture = { ...(original || {}), ...fixtureData };
    const nextShow = {
      ...show,
      fixtures: isNewFixture
        ? [...(show.fixtures || []), nextFixture]
        : (show.fixtures || []).map(f => f.id === fixtureId ? nextFixture : f),
    };

    if (isNewFixture) {
      onCreate?.(nextFixture);
    } else {
      updateFixture(fixtureId, fixtureData);
    }
    const result = await saveShow(nextShow);
    if (result && result.ok === false) {
      window.alert(result.message || result.error || 'Erro ao salvar aparelho');
      return;
    }
    onClose();
  }

  return (
    /* Overlay */
    <div style={{ position:'fixed', inset:0, background:C.overlay, display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:theme.colors.surface, border:`1px solid ${theme.colors.hover}`, borderRadius:6, width:460, maxHeight:'80vh', display:'flex', flexDirection:'column', fontFamily:theme.typography.fontFamily, color:theme.colors.text, boxShadow:theme.elevation.z2 }}>

        {/* Cabeçalho */}
        <div style={{ padding:'10px 16px', borderBottom:`1px solid ${theme.colors.hover}`, fontSize:14, fontWeight:600, color:theme.colors.text }}>
          Editor de Aparelho
        </div>

        {/* Abas */}
        <div style={{ display:'flex', borderBottom:`1px solid ${theme.colors.hover}` }}>
          {['basico','descricao'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'7px 20px', fontSize:12, cursor:'pointer', border:'none',
              background: tab === t ? C.surface : C.bg,
              color: tab === t ? C.white : C.textMuted,
              borderBottom: tab === t ? `2px solid ${C.white}` : '2px solid transparent',
            }}>
              {t === 'basico' ? 'Básico' : 'Descrição'}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {tab === 'basico' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <Field label="Id">
                <input value={editorFixtureId} disabled style={inputStyle(true)} />
              </Field>
              <Field label="Nome">
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="Fabricante">
                <input value={manufacturer} onChange={e => setManufacturer(e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="Modelo">
                <input value={model} onChange={e => setModel(e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="Número de canais">
                <input type="number" min={1} max={512} value={channelCount}
                  onChange={e => handleChannelCountChange(e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="Canal de início">
                <input type="number" min={1} max={512} value={startChannel}
                  onChange={e => setStartChannel(e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="Observacoes">
                <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle(), minHeight:64, resize:'vertical' }} />
              </Field>
            </div>
          )}

          {tab === 'descricao' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {channels.map((ch, i) => (
                <Field key={i} label={`Canal ${i + 1}`}>
                  <input
                    value={ch}
                    onChange={e => handleChannelName(i, e.target.value)}
                    placeholder={`Nome do canal ${i + 1}`}
                    style={inputStyle()}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{ padding:'10px 16px', borderTop:`1px solid ${theme.colors.hover}`, display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} style={{ minHeight:36, padding:'0 16px', borderRadius:4, cursor:'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:'transparent', color:theme.colors.primary, border:'none', boxShadow:'none' }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} style={{ minHeight:36, padding:'0 16px', borderRadius:4, cursor:'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:theme.colors.primary, color:'#ffffff', border:'none', boxShadow:theme.elevation.z2 }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <label style={{ width:130, fontSize:12, color:'#888', flexShrink:0 }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle(disabled) {
  return {
    flex:1,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body.fontSize,
    color: disabled ? theme.colors.textDisabled : theme.colors.text,
    background: theme.colors.surface,
    padding: theme.spacing.inputPadding,
    marginTop: theme.spacing.inputMarginTop,
    border: 'none',
    borderBottom: `1px solid ${theme.colors.textSecondary}`,
    outline: 'none',
  };
}
